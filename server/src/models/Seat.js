const mongoose = require('mongoose');
const { collection } = require('../config/db');

const { SEAT_STATUS } = require('../domain/constants');

/**
 * One document per physical seat. The unique (event, label) index plus
 * conditional atomic updates on `status` are what make double booking impossible.
 */
const seatSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    row: { type: String, required: true },
    number: { type: Number, required: true },
    label: { type: String, required: true }, // "A12"
    category: { type: String, required: true },
    status: { type: String, enum: Object.values(SEAT_STATUS), default: SEAT_STATUS.AVAILABLE },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    holdExpiresAt: { type: Date, default: null },
  },
  { timestamps: true, collection: collection('seats') },
);

seatSchema.index({ event: 1, label: 1 }, { unique: true });
seatSchema.index({ booking: 1 });

module.exports = { Seat: mongoose.model('Seat', seatSchema), SEAT_STATUS };
