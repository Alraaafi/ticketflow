const { Payment, PAYMENT_STATUS } = require('../models/Payment');

class PaymentRepository {
  findByKey(idempotencyKey) {
    return Payment.findOne({ idempotencyKey });
  }

  findSucceededByBooking(bookingId) {
    return Payment.findOne({ booking: bookingId, status: PAYMENT_STATUS.SUCCEEDED });
  }

  findById(id) {
    return Payment.findById(id);
  }

  /** Inserts; throws a duplicate-key error (code 11000) if the key already exists. */
  create(data) {
    return Payment.create(data);
  }

  update(id, set) {
    return Payment.findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after' });
  }
}

module.exports = PaymentRepository;
