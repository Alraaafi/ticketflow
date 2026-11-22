const { Booking } = require('../models/Booking');

class BookingRepository {
  create(data) {
    return Booking.create(data);
  }

  findById(id) {
    return Booking.findById(id);
  }

  findByIdDetailed(id) {
    return Booking.findById(id).populate('event', 'title venue startsAt imageUrl type organizer').populate('payment', 'provider status providerRef amount');
  }

  async findByCustomer(customerId, { page = 1, limit = 20 } = {}) {
    const filter = { customer: customerId };
    const [items, total] = await Promise.all([
      Booking.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('event', 'title venue startsAt imageUrl type').populate('payment', 'provider status providerRef').lean(),
      Booking.countDocuments(filter),
    ]);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  findByEvent(eventId) {
    return Booking.find({ event: eventId }).sort({ createdAt: -1 }).populate('customer', 'name email').lean();
  }

  /**
   * Optimistic, atomic status change: only succeeds if the booking is STILL in
   * `from`. Returns null if someone else (e.g. the expiry sweeper) changed it first.
   */
  transition(id, { from, to, reason = '', set = {}, extraFilter = {} }) {
    return Booking.findOneAndUpdate(
      { _id: id, status: from, ...extraFilter },
      { $set: { status: to, ...set }, $push: { statusHistory: { from, to, at: new Date(), reason } } },
      { returnDocument: 'after' },
    );
  }

  findExpired(now = new Date(), { eventId, limit = 200 } = {}) {
    const filter = { status: { $in: ['HELD', 'PENDING_PAYMENT'] }, expiresAt: { $lte: now } };
    if (eventId) filter.event = eventId;
    return Booking.find(filter).limit(limit).lean();
  }
}

module.exports = BookingRepository;
