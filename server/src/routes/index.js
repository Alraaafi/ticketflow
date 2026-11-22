const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const a = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const makeAuth = require('../middlewares/auth');
const { authLimiter, bookingLimiter } = require('../middlewares/rateLimiters');
const S = require('../validators/schemas');
const AppError = require('../utils/AppError');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => (/^image\/(png|jpe?g|webp)$/.test(file.mimetype) ? cb(null, true) : cb(AppError.badRequest('Only PNG, JPG or WEBP images are allowed'))),
});

function buildRoutes(c) {
  const router = express.Router();
  const { authenticate, authorize } = makeAuth(c.authService);
  const ORG = authorize('ORGANIZER');
  const CUS = authorize('CUSTOMER');
  const id = validate(S.idParam, 'params');

  const auth = require('../controllers/authController')(c);
  const events = require('../controllers/eventController')(c);
  const bookings = require('../controllers/bookingController')(c);
  const notes = require('../controllers/notificationController')(c);

  router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down', time: new Date() } }));

  // Auth
  router.post('/auth/register', authLimiter, validate(S.register), a(auth.register));
  router.post('/auth/login', authLimiter, validate(S.login), a(auth.login));
  router.get('/auth/me', authenticate, a(auth.me));

  // Public browsing
  router.get('/events', validate(S.searchEvents, 'query'), a(events.search));
  router.get('/events/cities', a(events.cities));
  router.get('/events/:id', id, a(events.detail));
  router.get('/events/:id/seats', id, a(events.seats));
  router.post('/events/:id/quote', id, validate(S.quote), a(events.quote));

  // Organizer: manage own events
  router.get('/organizer/events', authenticate, ORG, a(events.mine));
  router.get('/organizer/events/:id', authenticate, ORG, id, a(events.mineDetail));
  router.post('/events', authenticate, ORG, validate(S.createEvent), a(events.create));
  router.patch('/events/:id', authenticate, ORG, id, validate(S.updateEvent), a(events.update));
  router.delete('/events/:id', authenticate, ORG, id, a(events.remove));
  router.post('/events/:id/image', authenticate, ORG, id, upload.single('image'), a(events.uploadImage));

  // Customer: bookings
  router.get('/payments/providers', a(bookings.providers));
  router.post('/bookings/hold', authenticate, CUS, bookingLimiter, validate(S.hold), a(bookings.hold));
  router.get('/bookings', authenticate, CUS, a(bookings.mine));
  router.get('/bookings/:id', authenticate, id, a(bookings.one));
  router.post('/bookings/:id/checkout', authenticate, CUS, id, a(bookings.checkout));
  router.post('/bookings/:id/pay', authenticate, CUS, bookingLimiter, id, validate(S.pay), a(bookings.pay));
  router.get('/bookings/:id/refund-preview', authenticate, CUS, id, a(bookings.refundPreview));
  router.post('/bookings/:id/cancel', authenticate, CUS, id, a(bookings.cancel));

  // Notifications (both roles)
  router.get('/notifications', authenticate, a(notes.list));
  router.patch('/notifications/read-all', authenticate, a(notes.markAllRead));
  router.patch('/notifications/:id/read', authenticate, id, a(notes.markRead));

  return router;
}

module.exports = buildRoutes;
