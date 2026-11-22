const cloudinary = require('cloudinary').v2;
const env = require('./env');

// The SDK reads CLOUDINARY_URL from process.env automatically.
const isConfigured = Boolean(env.CLOUDINARY_URL);
if (isConfigured) cloudinary.config({ secure: true });

module.exports = { cloudinary, isConfigured };
