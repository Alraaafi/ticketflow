const mongoose = require('mongoose');
const { collection } = require('../config/db');

const { ROLES } = require('../domain/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.CUSTOMER },
    phone: { type: String, trim: true },
  },
  { timestamps: true, collection: collection('users') },
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = { User: mongoose.model('User', userSchema), ROLES };
