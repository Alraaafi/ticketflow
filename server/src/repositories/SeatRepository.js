const mongoose = require('mongoose');
const { Seat, SEAT_STATUS } = require('../models/Seat');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

class SeatRepository {
  insertMany(seats) {
    return Seat.insertMany(seats, { ordered: false });
  }

  deleteByEvent(eventId) {
    return Seat.deleteMany({ event: eventId });
  }

  findByEvent(eventId) {
    return Seat.find({ event: eventId }).select('row number label category status holdExpiresAt heldBy').sort({ row: 1, number: 1 }).lean();
  }

  findByLabels(eventId, labels) {
    return Seat.find({ event: eventId, label: { $in: labels } }).lean();
  }

  countActive(eventId) {
    return Seat.countDocuments({ event: eventId, status: { $ne: SEAT_STATUS.AVAILABLE } });
  }

  async statsByEvent(eventId) {
    const rows = await Seat.aggregate([{ $match: { event: oid(eventId) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const stats = { AVAILABLE: 0, HELD: 0, BOOKED: 0 };
    rows.forEach((r) => { stats[r._id] = r.count; });
    return stats;
  }

  /**
   * THE double-booking guard. A single atomic findOneAndUpdate that only
   * matches when the seat is AVAILABLE. MongoDB guarantees that for two
   * concurrent requests only one can match and flip the status; the other gets null.
   */
  holdSeat(eventId, label, { bookingId, userId, expiresAt }) {
    return Seat.findOneAndUpdate(
      { event: eventId, label, status: SEAT_STATUS.AVAILABLE },
      { $set: { status: SEAT_STATUS.HELD, booking: bookingId, heldBy: userId, holdExpiresAt: expiresAt } },
      { returnDocument: 'after' },
    );
  }

  /** Releases seats owned by a booking back to AVAILABLE (from the given statuses). */
  releaseByBooking(bookingId, fromStatuses = [SEAT_STATUS.HELD]) {
    return Seat.updateMany(
      { booking: bookingId, status: { $in: fromStatuses } },
      { $set: { status: SEAT_STATUS.AVAILABLE, booking: null, heldBy: null, holdExpiresAt: null } },
    );
  }

  markBookedByBooking(bookingId) {
    return Seat.updateMany(
      { booking: bookingId, status: SEAT_STATUS.HELD },
      { $set: { status: SEAT_STATUS.BOOKED, holdExpiresAt: null } },
    );
  }
}

module.exports = SeatRepository;
