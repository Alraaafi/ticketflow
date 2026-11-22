const crypto = require('crypto');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const BookingStatus = require('../domain/booking/BookingStatus');
const { assertTransition } = require('../domain/booking/bookingStateMachine');
const { computeHoldExpiry, isHoldExpired } = require('../domain/booking/holdPolicy');
const { createPricingStrategy } = require('../domain/pricing/pricingStrategyFactory');
const { SEAT_STATUS, PAYMENT_STATUS } = require('../domain/constants');

const MAX_SEATS_PER_BOOKING = 10;
const newCode = () => `TF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

/**
 * Orchestrates the booking lifecycle:
 *   holdSeats -> checkout -> pay -> (CONFIRMED) -> cancel
 * Depends only on injected abstractions (repositories, PaymentService,
 * RefundPolicy, EventBus), which keeps it unit-testable with fakes (DIP).
 */
class BookingService {
  constructor({ bookingRepository, seatRepository, eventRepository, paymentService, paymentRepository, refundPolicy, holdExpiryService, eventBus, DomainEvents, holdMinutes }) {
    this.bookings = bookingRepository;
    this.seats = seatRepository;
    this.events = eventRepository;
    this.payments = paymentService;
    this.paymentRepo = paymentRepository;
    this.refundPolicy = refundPolicy;
    this.holdExpiry = holdExpiryService;
    this.eventBus = eventBus;
    this.E = DomainEvents;
    this.holdMinutes = holdMinutes;
  }

  // ---------- helpers ----------
  async #loadOwned(bookingId, user) {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) throw AppError.notFound('Booking not found');
    if (String(booking.customer) !== String(user.id)) throw AppError.forbidden('This is not your booking');
    return booking;
  }

  /** Atomic, state-machine-checked status change. */
  async #transition(booking, to, reason, set = {}) {
    assertTransition(booking.status, to);
    const updated = await this.bookings.transition(booking._id, { from: booking.status, to, reason, set });
    if (!updated) throw AppError.conflict('Booking was changed by another request, please refresh', 'CONCURRENT_UPDATE');
    return updated;
  }

  #seatsChanged(eventId) {
    this.eventBus.publish(this.E.SEATS_CHANGED, { eventId: String(eventId) });
  }

  #summary(booking, event, extra = {}) {
    return {
      bookingId: String(booking._id),
      code: booking.code,
      customerId: String(booking.customer),
      eventTitle: event?.title || '',
      seats: booking.seats.map((s) => s.label),
      total: booking.pricing.total,
      ...extra,
    };
  }

  // ---------- 1. hold ----------
  async holdSeats(user, { eventId, seats: labels }) {
    const unique = [...new Set(labels.map((l) => String(l).toUpperCase()))];
    if (unique.length === 0 || unique.length > MAX_SEATS_PER_BOOKING) {
      throw AppError.badRequest(`Select between 1 and ${MAX_SEATS_PER_BOOKING} seats`);
    }
    const event = await this.events.findById(eventId);
    if (!event || !event.isPublished) throw AppError.notFound('Event not found');
    if (new Date(event.startsAt) <= new Date()) throw AppError.badRequest('This event has already started');

    // Free any holds that just expired on this event so they can be taken right now.
    await this.holdExpiry.sweep({ eventId });

    const seatDocs = await this.seats.findByLabels(eventId, unique);
    if (seatDocs.length !== unique.length) throw AppError.badRequest('One or more seats do not exist');

    const bookingId = new mongoose.Types.ObjectId();
    const expiresAt = computeHoldExpiry(new Date(), this.holdMinutes);

    // Atomically grab each seat; all-or-nothing.
    const results = await Promise.all(unique.map((label) => this.seats.holdSeat(eventId, label, { bookingId, userId: user.id, expiresAt })));
    const failed = unique.filter((_, i) => !results[i]);
    if (failed.length) {
      await this.seats.releaseByBooking(bookingId, [SEAT_STATUS.HELD]);
      throw AppError.conflict(`Seat(s) ${failed.join(', ')} were just taken by someone else`, 'SEAT_UNAVAILABLE', { seats: failed });
    }

    try {
      const quote = createPricingStrategy(event.pricing).calculate({ seats: seatDocs, categories: event.categories, now: new Date() });
      const booking = await this.bookings.create({
        _id: bookingId,
        code: newCode(),
        customer: user.id,
        event: event._id,
        seats: quote.lines.map((l) => ({ label: l.seat, category: l.category, price: l.price })),
        pricing: { strategy: quote.strategy, subtotal: quote.subtotal, discount: quote.discount, total: quote.total, note: quote.note },
        status: BookingStatus.HELD,
        statusHistory: [{ from: null, to: BookingStatus.HELD, at: new Date(), reason: `Seats held for ${this.holdMinutes} minutes` }],
        expiresAt,
      });
      this.#seatsChanged(eventId);
      return booking;
    } catch (err) {
      await this.seats.releaseByBooking(bookingId, [SEAT_STATUS.HELD]);
      throw err;
    }
  }

  // ---------- 2. checkout ----------
  async checkout(user, bookingId) {
    const booking = await this.#loadOwned(bookingId, user);
    if (booking.status === BookingStatus.PENDING_PAYMENT) return booking;
    await this.#assertNotExpired(booking);
    return this.#transition(booking, BookingStatus.PENDING_PAYMENT, 'Customer proceeded to payment');
  }

  async #assertNotExpired(booking) {
    if (isHoldExpired(booking.expiresAt)) {
      await this.holdExpiry.sweep({ eventId: booking.event });
      throw AppError.conflict('Your seat hold has expired. Please select seats again.', 'HOLD_EXPIRED');
    }
  }

  // ---------- 3. pay ----------
  async pay(user, bookingId, { provider, details, idempotencyKey }) {
    let booking = await this.#loadOwned(bookingId, user);

    // Retried request after success: idempotent, just return the result.
    if (booking.status === BookingStatus.CONFIRMED) {
      const { payment } = await this.payments.pay({ booking, providerId: provider, idempotencyKey, details });
      return { booking, payment, replayed: true };
    }
    if (booking.status === BookingStatus.HELD) booking = await this.checkout(user, bookingId);
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw AppError.conflict(`Booking is ${booking.status} and cannot be paid`, 'INVALID_STATUS_TRANSITION');
    }
    await this.#assertNotExpired(booking);

    const { payment, replayed } = await this.payments.pay({ booking, providerId: provider, idempotencyKey, details });
    if (payment.status === PAYMENT_STATUS.FAILED) {
      throw new AppError(402, 'PAYMENT_FAILED', payment.failureReason || 'Payment failed', { paymentId: payment._id });
    }
    if (payment.status !== PAYMENT_STATUS.SUCCEEDED) {
      throw AppError.conflict('Payment is still processing, retry with the same Idempotency-Key', 'PAYMENT_PROCESSING');
    }

    assertTransition(booking.status, BookingStatus.CONFIRMED);
    const confirmed = await this.bookings.transition(booking._id, {
      from: BookingStatus.PENDING_PAYMENT,
      to: BookingStatus.CONFIRMED,
      reason: `Paid via ${payment.provider} (${payment.providerRef})`,
      set: { payment: payment._id, expiresAt: null },
    });

    if (!confirmed) {
      // The hold expired between charge and confirm: give the money back.
      const fresh = await this.bookings.findById(booking._id);
      if (fresh?.status === BookingStatus.CONFIRMED) return { booking: fresh, payment, replayed: true };
      await this.payments.refund(payment, payment.amount);
      throw AppError.conflict('Your hold expired during payment. You have been refunded in full.', 'HOLD_EXPIRED');
    }

    await this.seats.markBookedByBooking(booking._id);
    const event = await this.events.findById(booking.event);
    this.eventBus.publish(this.E.BOOKING_CONFIRMED, this.#summary(confirmed, event));
    this.#seatsChanged(booking.event);
    return { booking: confirmed, payment, replayed };
  }

  // ---------- 4. cancel ----------
  async cancel(user, bookingId) {
    const booking = await this.#loadOwned(bookingId, user);
    const event = await this.events.findById(booking.event);

    // Releasing an unpaid hold.
    if ([BookingStatus.HELD, BookingStatus.PENDING_PAYMENT].includes(booking.status)) {
      const updated = await this.#transition(booking, BookingStatus.CANCELLED, 'Hold released by customer');
      await this.seats.releaseByBooking(booking._id, [SEAT_STATUS.HELD]);
      this.#seatsChanged(booking.event);
      return { booking: updated, refund: null };
    }

    assertTransition(booking.status, BookingStatus.CANCELLED);
    if (event && new Date(event.startsAt) <= new Date()) throw AppError.badRequest('Event has already started and cannot be cancelled');

    const refund = this.refundPolicy.calculate({ amountPaid: booking.pricing.total, eventStartsAt: event.startsAt, cancelledAt: new Date() });
    const payment = booking.payment ? await this.paymentRepo.findById(booking.payment) : null;
    const refundResult = refund.refundAmount > 0 ? await this.payments.refund(payment, refund.refundAmount) : null;

    const updated = await this.#transition(booking, BookingStatus.CANCELLED, refund.reason, {
      refund: { amount: refund.refundAmount, percent: refund.refundPercent, reason: refund.reason, providerRef: refundResult?.providerRef || '' },
    });
    await this.seats.releaseByBooking(booking._id, [SEAT_STATUS.BOOKED, SEAT_STATUS.HELD]);
    this.eventBus.publish(this.E.BOOKING_CANCELLED, this.#summary(updated, event, { refundAmount: refund.refundAmount }));
    this.#seatsChanged(booking.event);
    return { booking: updated, refund };
  }

  // ---------- read ----------
  listMine(user, query) {
    return this.bookings.findByCustomer(user.id, query);
  }

  async getOne(user, bookingId) {
    const booking = await this.bookings.findByIdDetailed(bookingId);
    if (!booking) throw AppError.notFound('Booking not found');
    const isOwner = String(booking.customer) === String(user.id);
    const isOrganizer = booking.event && String(booking.event.organizer) === String(user.id);
    if (!isOwner && !isOrganizer) throw AppError.forbidden('This is not your booking');
    return booking;
  }

  async refundPreview(user, bookingId) {
    const booking = await this.#loadOwned(bookingId, user);
    const event = await this.events.findById(booking.event);
    if (booking.status !== BookingStatus.CONFIRMED) return { refundAmount: 0, refundPercent: 0, reason: 'Unpaid hold: nothing to refund' };
    return this.refundPolicy.calculate({ amountPaid: booking.pricing.total, eventStartsAt: event.startsAt });
  }
}

module.exports = BookingService;
