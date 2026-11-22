const mongoose = require('mongoose');
const { collection } = require('../config/db');
const BookingStatus = require('../domain/booking/BookingStatus');

const historySchema = new mongoose.Schema(
  {
    from: { type: String, default: null },
    to: { type: String, required: true },
    at: { type: Date, default: Date.now },
    reason: { type: String, default: '' },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // human friendly, e.g. TF-8K2D9Q
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    seats: [{ label: String, category: String, price: Number, _id: false }],
    pricing: {
      strategy: String,
      subtotal: Number,
      discount: Number,
      total: Number,
      note: String,
    },
    currency: { type: String, default: 'BDT' },
    status: { type: String, enum: Object.values(BookingStatus), default: BookingStatus.HELD, index: true },
    statusHistory: { type: [historySchema], default: [] },
    expiresAt: { type: Date, index: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    refund: {
      amount: Number,
      percent: Number,
      reason: String,
      providerRef: String,
    },
  },
  { timestamps: true, collection: collection('bookings') },
);

bookingSchema.index({ status: 1, expiresAt: 1 });

module.exports = { Booking: mongoose.model('Booking', bookingSchema) };
