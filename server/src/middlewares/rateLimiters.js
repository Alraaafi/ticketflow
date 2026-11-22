const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const json = (message) => ({ success: false, error: { code: 'RATE_LIMITED', message } });

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false, message: json('Too many requests, slow down') });

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, skipSuccessfulRequests: true, standardHeaders: 'draft-7', legacyHeaders: false, message: json('Too many login attempts, try again later') });

/** Bonus: rate limit on the booking endpoint, per logged-in user (falls back to IP). */
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id ? `u:${req.user.id}` : ipKeyGenerator(req.ip)),
  message: json('Too many booking attempts, wait a minute'),
});

module.exports = { apiLimiter, authLimiter, bookingLimiter };
