/**
 * Fans a message out to every registered channel.
 * Adding SMS / push = write a new NotificationChannel and register it in
 * container.js. No booking code changes (Open/Closed).
 */
class NotificationService {
  constructor({ channels = [], userRepository, logger }) {
    this.channels = channels;
    this.userRepository = userRepository;
    this.logger = logger;
  }

  register(channel) {
    this.channels.push(channel);
  }

  async notify(userId, { type, title, message, data = {} }) {
    const user = await this.userRepository.findById(userId);
    if (!user) return [];
    const results = await Promise.allSettled(this.channels.map((c) => c.send({ user, type, title, message, data })));
    results.forEach((r, i) => {
      if (r.status === 'rejected') this.logger.error({ err: r.reason }, `Notification channel "${this.channels[i].name}" failed`);
    });
    return results;
  }

  /** Wires domain events -> user notifications. */
  subscribeTo(eventBus, DomainEvents) {
    const fmt = (b) => `${b.eventTitle} | Seats: ${b.seats.join(', ')}`;
    eventBus.subscribe(DomainEvents.BOOKING_CONFIRMED, (b) => this.notify(b.customerId, {
      type: 'BOOKING_CONFIRMED',
      title: `Booking confirmed (${b.code})`,
      message: `${fmt(b)} | Paid ৳${b.total}`,
      data: { bookingId: b.bookingId },
    }));
    eventBus.subscribe(DomainEvents.BOOKING_CANCELLED, (b) => this.notify(b.customerId, {
      type: 'BOOKING_CANCELLED',
      title: `Booking cancelled (${b.code})`,
      message: `${fmt(b)} | Refund: ৳${b.refundAmount ?? 0}`,
      data: { bookingId: b.bookingId },
    }));
  }
}

module.exports = NotificationService;
