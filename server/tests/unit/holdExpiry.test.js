const { computeHoldExpiry, isHoldExpired, secondsLeft } = require('../../src/domain/booking/holdPolicy');
const HoldExpiryService = require('../../src/services/HoldExpiryService');
const { FakeSeatRepo, FakeBookingRepo, EventBus, DomainEvents, silentLogger, makeSeats } = require('../fakes');

describe('holdPolicy', () => {
  const now = new Date('2030-01-01T10:00:00Z');

  test('hold expires after N minutes', () => {
    expect(computeHoldExpiry(now, 5).toISOString()).toBe('2030-01-01T10:05:00.000Z');
  });

  test('isHoldExpired is true at/after the expiry time only', () => {
    const exp = computeHoldExpiry(now, 5);
    expect(isHoldExpired(exp, new Date('2030-01-01T10:04:59Z'))).toBe(false);
    expect(isHoldExpired(exp, new Date('2030-01-01T10:05:00Z'))).toBe(true);
    expect(isHoldExpired(null, now)).toBe(false);
  });

  test('secondsLeft never goes negative', () => {
    const exp = computeHoldExpiry(now, 1);
    expect(secondsLeft(exp, now)).toBe(60);
    expect(secondsLeft(exp, new Date('2030-01-01T11:00:00Z'))).toBe(0);
  });
});

describe('HoldExpiryService.sweep', () => {
  let seats; let bookings; let bus; let service;

  beforeEach(async () => {
    seats = new FakeSeatRepo(makeSeats());
    bookings = new FakeBookingRepo();
    bus = new EventBus();
    service = new HoldExpiryService({ bookingRepository: bookings, seatRepository: seats, eventBus: bus, DomainEvents, logger: silentLogger });
  });

  async function holdFor(bookingId, label, status, expiresAt) {
    await seats.holdSeat('evt1', label, { bookingId, userId: 'u1', expiresAt });
    await bookings.create({ _id: bookingId, customer: 'u1', event: 'evt1', status, expiresAt, statusHistory: [], seats: [{ label }] });
  }

  test('expires overdue HELD and PENDING_PAYMENT bookings and frees their seats', async () => {
    const past = new Date(Date.now() - 1000);
    await holdFor('b1', 'A1', 'HELD', past);
    await holdFor('b2', 'A2', 'PENDING_PAYMENT', past);
    const published = [];
    bus.on(DomainEvents.SEATS_CHANGED, (p) => published.push(p));

    expect(await service.sweep()).toBe(2);
    expect((await bookings.findById('b1')).status).toBe('EXPIRED');
    expect((await bookings.findById('b2')).status).toBe('EXPIRED');
    expect((await bookings.findById('b1')).statusHistory.at(-1)).toMatchObject({ from: 'HELD', to: 'EXPIRED', reason: 'Hold expired' });
    expect(seats.status('A1')).toBe('AVAILABLE');
    expect(seats.status('A2')).toBe('AVAILABLE');
    expect(published).toHaveLength(2);
  });

  test('leaves holds that are still valid', async () => {
    await holdFor('b1', 'A1', 'HELD', new Date(Date.now() + 60_000));
    expect(await service.sweep()).toBe(0);
    expect(seats.status('A1')).toBe('HELD');
  });

  test('backs off if the booking got confirmed concurrently', async () => {
    const past = new Date(Date.now() - 1000);
    await holdFor('b1', 'A1', 'PENDING_PAYMENT', past);
    // Simulate payment confirming right between findExpired() and transition()
    const original = bookings.findExpired.bind(bookings);
    bookings.findExpired = async (...args) => {
      const list = await original(...args);
      await bookings.transition('b1', { from: 'PENDING_PAYMENT', to: 'CONFIRMED', reason: 'paid' });
      return list;
    };
    expect(await service.sweep()).toBe(0);
    expect((await bookings.findById('b1')).status).toBe('CONFIRMED');
    expect(seats.status('A1')).toBe('HELD'); // not released
  });

  test('start()/stop() manage the background timer', () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(service, 'sweep').mockResolvedValue(0);
    service.start();
    service.start(); // idempotent
    jest.advanceTimersByTime(10_000);
    expect(spy).toHaveBeenCalledTimes(1);
    service.stop();
    jest.advanceTimersByTime(30_000);
    expect(spy).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
