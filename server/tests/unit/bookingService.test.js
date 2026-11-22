const BookingService = require('../../src/services/BookingService');
const HoldExpiryService = require('../../src/services/HoldExpiryService');
const PaymentService = require('../../src/payments/PaymentService');
const PaymentProviderRegistry = require('../../src/payments/PaymentProviderRegistry');
const BkashMockProvider = require('../../src/payments/providers/BkashMockProvider');
const CardMockProvider = require('../../src/payments/providers/CardMockProvider');
const RefundPolicy = require('../../src/domain/refund/RefundPolicy');
const { FakeSeatRepo, FakeBookingRepo, FakePaymentRepo, FakeEventRepo, EventBus, DomainEvents, silentLogger, makeEvent, makeSeats } = require('../fakes');

function setup(eventOverrides = {}) {
  const seats = new FakeSeatRepo(makeSeats());
  const bookings = new FakeBookingRepo();
  const paymentRepo = new FakePaymentRepo();
  const events = new FakeEventRepo([makeEvent(eventOverrides)]);
  const bus = new EventBus();
  const published = [];
  Object.values(DomainEvents).forEach((name) => bus.on(name, (p) => published.push({ name, ...p })));
  const paymentService = new PaymentService({ paymentRepository: paymentRepo, providerRegistry: new PaymentProviderRegistry([new BkashMockProvider(), new CardMockProvider()]), logger: silentLogger });
  const holdExpiryService = new HoldExpiryService({ bookingRepository: bookings, seatRepository: seats, eventBus: bus, DomainEvents, logger: silentLogger });
  const service = new BookingService({
    bookingRepository: bookings, seatRepository: seats, eventRepository: events, paymentService, paymentRepository: paymentRepo,
    refundPolicy: new RefundPolicy(), holdExpiryService, eventBus: bus, DomainEvents, holdMinutes: 5,
  });
  return { service, seats, bookings, paymentRepo, events, published, holdExpiryService };
}

const alice = { id: 'alice' };
const bob = { id: 'bob' };
const pay = { provider: 'bkash', details: { walletNumber: '01712345678' } };

describe('BookingService: double booking protection', () => {
  test('50 users race for the same seat -> exactly one wins', async () => {
    const { service, seats } = setup();
    const users = Array.from({ length: 50 }, (_, i) => ({ id: `u${i}` }));
    const results = await Promise.allSettled(users.map((u) => service.holdSeats(u, { eventId: 'evt1', seats: ['A1'] })));
    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(49);
    lost.forEach((r) => expect(r.reason.code).toBe('SEAT_UNAVAILABLE'));
    expect(seats.status('A1')).toBe('HELD');
  });

  test('multi-seat hold is all-or-nothing', async () => {
    const { service, seats } = setup();
    await service.holdSeats(bob, { eventId: 'evt1', seats: ['A2'] });
    await expect(service.holdSeats(alice, { eventId: 'evt1', seats: ['A1', 'A2', 'A3'] })).rejects.toMatchObject({ code: 'SEAT_UNAVAILABLE', details: { seats: ['A2'] } });
    expect(seats.status('A1')).toBe('AVAILABLE'); // rolled back
    expect(seats.status('A3')).toBe('AVAILABLE');
  });

  test('a held seat cannot be taken by anyone else', async () => {
    const { service } = setup();
    await service.holdSeats(alice, { eventId: 'evt1', seats: ['B1'] });
    await expect(service.holdSeats(bob, { eventId: 'evt1', seats: ['B1'] })).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('BookingService: lifecycle', () => {
  test('HELD -> PENDING_PAYMENT -> CONFIRMED with full status history', async () => {
    const { service, seats, published } = setup();
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['a1', 'B1'] });
    expect(held).toMatchObject({ status: 'HELD', pricing: { total: 1500 } });

    const pending = await service.checkout(alice, held._id);
    expect(pending.status).toBe('PENDING_PAYMENT');

    const { booking } = await service.pay(alice, held._id, { ...pay, idempotencyKey: 'k1' });
    expect(booking.status).toBe('CONFIRMED');
    expect(booking.statusHistory.map((h) => h.to)).toEqual(['HELD', 'PENDING_PAYMENT', 'CONFIRMED']);
    expect(seats.status('A1')).toBe('BOOKED');
    expect(published.some((p) => p.name === DomainEvents.BOOKING_CONFIRMED && p.code === booking.code)).toBe(true);
  });

  test('paying twice with the same key never double-charges', async () => {
    const { service, paymentRepo } = setup();
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['A1'] });
    await service.pay(alice, held._id, { ...pay, idempotencyKey: 'same' });
    const again = await service.pay(alice, held._id, { ...pay, idempotencyKey: 'same' });
    expect(again.replayed).toBe(true);
    expect(paymentRepo.items.filter((p) => p.status === 'SUCCEEDED')).toHaveLength(1);
  });

  test('failed payment returns 402 and keeps the hold for a retry', async () => {
    const { service, bookings } = setup();
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['A1'] });
    await expect(service.pay(alice, held._id, { provider: 'bkash', details: { walletNumber: '01700000000' }, idempotencyKey: 'x1' }))
      .rejects.toMatchObject({ statusCode: 402, code: 'PAYMENT_FAILED' });
    expect((await bookings.findById(held._id)).status).toBe('PENDING_PAYMENT');
    const { booking } = await service.pay(alice, held._id, { ...pay, idempotencyKey: 'x2' });
    expect(booking.status).toBe('CONFIRMED');
  });

  test('an expired hold cannot be paid and its seat is released', async () => {
    const { service, bookings, seats } = setup();
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['A1'] });
    bookings.items.get(held._id).expiresAt = new Date(Date.now() - 1000);
    await expect(service.pay(alice, held._id, { ...pay, idempotencyKey: 'k' })).rejects.toMatchObject({ code: 'HOLD_EXPIRED' });
    expect((await bookings.findById(held._id)).status).toBe('EXPIRED');
    expect(seats.status('A1')).toBe('AVAILABLE');
    // ...and someone else can now take it
    await expect(service.holdSeats(bob, { eventId: 'evt1', seats: ['A1'] })).resolves.toMatchObject({ status: 'HELD' });
  });

  test('cannot pay or cancel someone else\'s booking', async () => {
    const { service } = setup();
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['A1'] });
    await expect(service.pay(bob, held._id, { ...pay, idempotencyKey: 'k' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.cancel(bob, held._id)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('cannot pay a cancelled booking', async () => {
    const { service } = setup();
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['A1'] });
    await service.cancel(alice, held._id);
    await expect(service.pay(alice, held._id, { ...pay, idempotencyKey: 'k' })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('validates seat count, unknown seats and past events', async () => {
    const { service } = setup();
    await expect(service.holdSeats(alice, { eventId: 'evt1', seats: [] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.holdSeats(alice, { eventId: 'evt1', seats: ['Z9'] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.holdSeats(alice, { eventId: 'nope', seats: ['A1'] })).rejects.toMatchObject({ statusCode: 404 });
    const past = setup({ startsAt: new Date(Date.now() - 1000) });
    await expect(past.service.holdSeats(alice, { eventId: 'evt1', seats: ['A1'] })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('BookingService: cancellation + refund rule', () => {
  test('cancelling > 24h before the event gives a full refund and frees the seat', async () => {
    const { service, seats, paymentRepo, published } = setup();
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['A1'] });
    await service.pay(alice, held._id, { ...pay, idempotencyKey: 'k' });
    const { booking, refund } = await service.cancel(alice, held._id);
    expect(booking.status).toBe('CANCELLED');
    expect(refund).toMatchObject({ refundAmount: 1000, refundPercent: 100 });
    expect(booking.refund.amount).toBe(1000);
    expect(paymentRepo.items[0].status).toBe('REFUNDED');
    expect(seats.status('A1')).toBe('AVAILABLE');
    expect(published.some((p) => p.name === DomainEvents.BOOKING_CANCELLED && p.refundAmount === 1000)).toBe(true);
  });

  test('cancelling within 24h gives no refund', async () => {
    const { service, paymentRepo } = setup({ startsAt: new Date(Date.now() + 5 * 36e5) });
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['B1'] });
    await service.pay(alice, held._id, { ...pay, idempotencyKey: 'k' });
    const { refund } = await service.cancel(alice, held._id);
    expect(refund.refundAmount).toBe(0);
    expect(paymentRepo.items[0].status).toBe('SUCCEEDED');
  });

  test('releasing an unpaid hold cancels it without refund', async () => {
    const { service, seats } = setup();
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['A1'] });
    const { booking, refund } = await service.cancel(alice, held._id);
    expect(booking.status).toBe('CANCELLED');
    expect(refund).toBeNull();
    expect(seats.status('A1')).toBe('AVAILABLE');
  });

  test('a cancelled booking cannot be cancelled again', async () => {
    const { service } = setup();
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['A1'] });
    await service.cancel(alice, held._id);
    await expect(service.cancel(alice, held._id)).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });

  test('refund preview reflects the policy', async () => {
    const { service } = setup();
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['A1'] });
    expect((await service.refundPreview(alice, held._id)).refundAmount).toBe(0);
    await service.pay(alice, held._id, { ...pay, idempotencyKey: 'k' });
    expect((await service.refundPreview(alice, held._id)).refundAmount).toBe(1000);
  });
});

describe('BookingService: early-bird pricing is applied at hold time', () => {
  test('20% off while early-bird is active', async () => {
    const { service } = setup({ pricing: { strategy: 'EARLY_BIRD', earlyBirdDiscountPercent: 20, earlyBirdEndsAt: new Date(Date.now() + 864e5) } });
    const held = await service.holdSeats(alice, { eventId: 'evt1', seats: ['A1', 'A2'] });
    expect(held.pricing).toMatchObject({ strategy: 'EARLY_BIRD', subtotal: 2000, discount: 400, total: 1600 });
  });
});
