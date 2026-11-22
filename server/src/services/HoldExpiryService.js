const BookingStatus = require('../domain/booking/BookingStatus');
const { assertTransition } = require('../domain/booking/bookingStateMachine');
const { SEAT_STATUS } = require('../domain/constants');

/**
 * Releases expired holds automatically.
 *  - Runs on an interval (background sweeper).
 *  - Also runs on-demand for one event right before someone tries to hold seats,
 *    so an expired seat is free immediately, not only on the next tick.
 * The booking's conditional status update is the lock: if the payment flow
 * confirms the booking first, the sweeper's update matches nothing and it backs off.
 */
class HoldExpiryService {
  constructor({ bookingRepository, seatRepository, eventBus, DomainEvents, logger, intervalSeconds = 10 }) {
    this.bookings = bookingRepository;
    this.seats = seatRepository;
    this.eventBus = eventBus;
    this.DomainEvents = DomainEvents;
    this.logger = logger;
    this.intervalMs = intervalSeconds * 1000;
    this.timer = null;
  }

  async sweep({ eventId, now = new Date() } = {}) {
    const expired = await this.bookings.findExpired(now, { eventId });
    let released = 0;
    for (const b of expired) {
      assertTransition(b.status, BookingStatus.EXPIRED);
      const won = await this.bookings.transition(b._id, {
        from: b.status,
        to: BookingStatus.EXPIRED,
        reason: 'Hold expired',
        extraFilter: { expiresAt: { $lte: now } },
      });
      if (!won) continue; // confirmed/cancelled concurrently, leave it alone
      await this.seats.releaseByBooking(b._id, [SEAT_STATUS.HELD]);
      released += 1;
      this.eventBus.publish(this.DomainEvents.BOOKING_EXPIRED, { bookingId: String(b._id), customerId: String(b.customer) });
      this.eventBus.publish(this.DomainEvents.SEATS_CHANGED, { eventId: String(b.event) });
    }
    if (released) this.logger.info(`Released ${released} expired hold(s)`);
    return released;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.sweep().catch((err) => this.logger.error({ err }, 'hold sweep failed'));
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = HoldExpiryService;
