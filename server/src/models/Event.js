const mongoose = require('mongoose');
const { collection } = require('../config/db');

const { EVENT_TYPES } = require('../domain/constants');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    color: { type: String, default: '#6366f1' },
    rowFrom: { type: String, required: true }, // e.g. "A"
    rowTo: { type: String, required: true }, // e.g. "C"
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 3000 },
    type: { type: String, enum: EVENT_TYPES, default: 'CONCERT' },
    venue: {
      name: { type: String, required: true, trim: true },
      address: { type: String, default: '' },
      city: { type: String, required: true, trim: true, index: true },
    },
    startsAt: { type: Date, required: true, index: true },
    imageUrl: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    layout: {
      rows: { type: Number, required: true, min: 1, max: 26 },
      seatsPerRow: { type: Number, required: true, min: 1, max: 40 },
    },
    categories: { type: [categorySchema], validate: (v) => v.length > 0 },
    pricing: {
      strategy: { type: String, enum: ['BASE', 'EARLY_BIRD'], default: 'BASE' },
      earlyBirdDiscountPercent: { type: Number, min: 1, max: 90 },
      earlyBirdEndsAt: { type: Date },
    },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: collection('events') },
);

eventSchema.index({ title: 'text', 'venue.city': 'text' });

module.exports = { Event: mongoose.model('Event', eventSchema), EVENT_TYPES };
