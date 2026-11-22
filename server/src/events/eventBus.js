/**
 * Observer pattern: a tiny in-process domain event bus.
 * BookingService only *publishes* "booking.confirmed" etc. It has no idea who
 * listens (notifications, sockets, analytics...). New listeners = zero changes
 * to booking code.
 */
const { EventEmitter } = require('events');

const DomainEvents = Object.freeze({
  BOOKING_HELD: 'booking.held',
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_CANCELLED: 'booking.cancelled',
  BOOKING_EXPIRED: 'booking.expired',
  SEATS_CHANGED: 'seats.changed',
});

class EventBus extends EventEmitter {
  publish(name, payload) {
    this.emit(name, payload);
  }

  subscribe(name, handler) {
    // Listener errors must never crash the booking flow.
    this.on(name, (payload) => {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((err) => this.emit('error:listener', { name, err }));
    });
  }
}

module.exports = { EventBus, DomainEvents };
