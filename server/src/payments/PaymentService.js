const { PAYMENT_STATUS } = require('../domain/constants');
const AppError = require('../utils/AppError');

const isDuplicateKey = (err) => err && err.code === 11000;

/**
 * Idempotent payments.
 *  1. Same Idempotency-Key again  -> return the stored result, never charge twice.
 *  2. Booking already has a SUCCEEDED payment -> return it, never charge twice.
 *  3. Two identical requests racing -> the unique index on idempotencyKey lets
 *     only one insert win; the loser reads the winner's record.
 */
class PaymentService {
  constructor({ paymentRepository, providerRegistry, logger }) {
    this.repo = paymentRepository;
    this.providers = providerRegistry;
    this.logger = logger;
  }

  async pay({ booking, providerId, idempotencyKey, details }) {
    if (!idempotencyKey) throw AppError.badRequest('Idempotency-Key is required');
    const provider = this.providers.get(providerId);

    const existing = await this.repo.findByKey(idempotencyKey);
    if (existing) return this.#replay(existing, booking);

    const alreadyPaid = await this.repo.findSucceededByBooking(booking._id);
    if (alreadyPaid) return { payment: alreadyPaid, replayed: true };

    let payment;
    try {
      payment = await this.repo.create({
        idempotencyKey,
        booking: booking._id,
        customer: booking.customer,
        provider: provider.id,
        amount: booking.pricing.total,
        currency: booking.currency,
        status: PAYMENT_STATUS.PROCESSING,
      });
    } catch (err) {
      if (isDuplicateKey(err)) return this.#replay(await this.repo.findByKey(idempotencyKey), booking);
      throw err;
    }

    const result = await provider.charge({ amount: payment.amount, currency: payment.currency, idempotencyKey, details });
    const updated = await this.repo.update(payment._id, result.success
      ? { status: PAYMENT_STATUS.SUCCEEDED, providerRef: result.providerRef }
      : { status: PAYMENT_STATUS.FAILED, failureReason: result.failureReason || 'Payment failed' });
    this.logger.info({ booking: String(booking._id), provider: provider.id, status: updated.status }, 'payment processed');
    return { payment: updated, replayed: false };
  }

  async refund(payment, amount) {
    if (!payment || payment.status !== PAYMENT_STATUS.SUCCEEDED || amount <= 0) return null;
    const provider = this.providers.get(payment.provider);
    const result = await provider.refund({ providerRef: payment.providerRef, amount });
    if (result.success) await this.repo.update(payment._id, { status: PAYMENT_STATUS.REFUNDED, refundedAmount: amount });
    return result;
  }

  #replay(payment, booking) {
    if (String(payment.booking) !== String(booking._id)) {
      throw AppError.conflict('Idempotency-Key was already used for another booking', 'IDEMPOTENCY_KEY_REUSED');
    }
    return { payment, replayed: true };
  }
}

module.exports = PaymentService;
