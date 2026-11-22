/**
 * In-memory fakes of the repositories. Each "atomic" method does its
 * check-and-set in one synchronous block (after an async tick), mirroring
 * MongoDB's single-document atomicity, so concurrency logic is testable
 * without a database.
 */
const crypto = require('crypto');
const { SEAT_STATUS, PAYMENT_STATUS } = require('../src/domain/constants');
const { EventBus, DomainEvents } = require('../src/events/eventBus');

const tick = () => new Promise((r) => setImmediate(r));
const id = () => crypto.randomBytes(12).toString('hex');
const clone = (o) => (o ? structuredClone(o) : o);

class FakeSeatRepo {
  constructor(seats = []) { this.seats = seats.map((s) => ({ status: SEAT_STATUS.AVAILABLE, booking: null, ...s })); }
  async findByLabels(eventId, labels) { await tick(); return this.seats.filter((s) => s.event === eventId && labels.includes(s.label)).map(clone); }
  async holdSeat(eventId, label, { bookingId, userId, expiresAt }) {
    await tick();
    const s = this.seats.find((x) => x.event === eventId && x.label === label && x.status === SEAT_STATUS.AVAILABLE);
    if (!s) return null;
    Object.assign(s, { status: SEAT_STATUS.HELD, booking: String(bookingId), heldBy: userId, holdExpiresAt: expiresAt });
    return clone(s);
  }
  async releaseByBooking(bookingId, from = [SEAT_STATUS.HELD]) {
    await tick();
    this.seats.filter((s) => s.booking === String(bookingId) && from.includes(s.status))
      .forEach((s) => Object.assign(s, { status: SEAT_STATUS.AVAILABLE, booking: null, heldBy: null, holdExpiresAt: null }));
  }
  async markBookedByBooking(bookingId) {
    await tick();
    this.seats.filter((s) => s.booking === String(bookingId) && s.status === SEAT_STATUS.HELD).forEach((s) => { s.status = SEAT_STATUS.BOOKED; });
  }
  status(label) { return this.seats.find((s) => s.label === label).status; }
}

class FakeBookingRepo {
  constructor() { this.items = new Map(); }
  async create(data) { await tick(); const b = { ...clone(data), _id: String(data._id || id()) }; this.items.set(b._id, b); return clone(b); }
  async findById(bid) { await tick(); return clone(this.items.get(String(bid))); }
  async transition(bid, { from, to, reason, set = {}, extraFilter = {} }) {
    await tick();
    const b = this.items.get(String(bid));
    if (!b || b.status !== from) return null;
    if (extraFilter.expiresAt && !(new Date(b.expiresAt) <= extraFilter.expiresAt.$lte)) return null;
    Object.assign(b, set, { status: to });
    b.statusHistory.push({ from, to, reason, at: new Date() });
    return clone(b);
  }
  async findExpired(now, { eventId } = {}) {
    await tick();
    return [...this.items.values()].filter((b) => ['HELD', 'PENDING_PAYMENT'].includes(b.status) && b.expiresAt && new Date(b.expiresAt) <= now && (!eventId || b.event === eventId)).map(clone);
  }
}

class FakePaymentRepo {
  constructor() { this.items = []; }
  async findByKey(k) { await tick(); return clone(this.items.find((p) => p.idempotencyKey === k)); }
  async findSucceededByBooking(bid) { await tick(); return clone(this.items.find((p) => String(p.booking) === String(bid) && p.status === PAYMENT_STATUS.SUCCEEDED)); }
  async findById(pid) { await tick(); return clone(this.items.find((p) => p._id === String(pid))); }
  async create(data) {
    await tick();
    if (this.items.some((p) => p.idempotencyKey === data.idempotencyKey)) { const e = new Error('dup'); e.code = 11000; throw e; }
    const p = { ...data, _id: id() }; this.items.push(p); return clone(p);
  }
  async update(pid, set) { await tick(); const p = this.items.find((x) => x._id === String(pid)); Object.assign(p, set); return clone(p); }
}

class FakeEventRepo {
  constructor(events = []) { this.events = events; }
  async findById(eid) { await tick(); return clone(this.events.find((e) => e._id === String(eid))); }
}

const silentLogger = { info() {}, warn() {}, error() {} };

function makeEvent(overrides = {}) {
  return {
    _id: 'evt1',
    title: 'Test Concert',
    isPublished: true,
    startsAt: new Date(Date.now() + 10 * 864e5),
    categories: [{ name: 'VIP', price: 1000 }, { name: 'General', price: 500 }],
    pricing: { strategy: 'BASE' },
    ...overrides,
  };
}

function makeSeats(eventId = 'evt1') {
  return ['A1', 'A2', 'A3', 'B1', 'B2'].map((label) => ({ event: eventId, label, category: label.startsWith('A') ? 'VIP' : 'General' }));
}

module.exports = { FakeSeatRepo, FakeBookingRepo, FakePaymentRepo, FakeEventRepo, EventBus, DomainEvents, silentLogger, makeEvent, makeSeats, tick };
