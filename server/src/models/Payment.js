const mongoose = require('mongoose');
const { collection } = require('../config/db');

const { PAYMENT_STATUS } = require('../domain/constants');

const paymentSchema = new mongoose.Schema(
  {
    // Unique idempotency key: retrying the same request can never create a second charge.
    idempotencyKey: { type: String, required: true, unique: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BDT' },
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PROCESSING },
    providerRef: { type: String, default: '' },
    failureReason: { type: String, default: '' },
    refundedAmount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: collection('payments') },
);

module.exports = { Payment: mongoose.model('Payment', paymentSchema), PAYMENT_STATUS };
