const mongoose = require('mongoose');
const { collection } = require('../config/db');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: Object, default: {} },
    read: { type: Boolean, default: false },
  },
  { timestamps: true, collection: collection('notifications') },
);

module.exports = { Notification: mongoose.model('Notification', notificationSchema) };
