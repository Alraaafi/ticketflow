/**
 * Composition root (Dependency Injection by hand).
 * The ONLY place that knows concrete classes. Everything else receives its
 * dependencies through the constructor, which is what makes the services
 * testable and the providers/channels/strategies swappable.
 */
const env = require('./config/env');
const logger = require('./config/logger');
const { cloudinary, isConfigured } = require('./config/cloudinary');

const UserRepository = require('./repositories/UserRepository');
const EventRepository = require('./repositories/EventRepository');
const SeatRepository = require('./repositories/SeatRepository');
const BookingRepository = require('./repositories/BookingRepository');
const PaymentRepository = require('./repositories/PaymentRepository');
const NotificationRepository = require('./repositories/NotificationRepository');

const { EventBus, DomainEvents } = require('./events/eventBus');
const MemoryCache = require('./cache/MemoryCache');
const RedisCache = require('./cache/RedisCache');
const Realtime = require('./realtime/Realtime');

const AuthService = require('./services/AuthService');
const EventService = require('./services/EventService');
const BookingService = require('./services/BookingService');
const HoldExpiryService = require('./services/HoldExpiryService');
const ImageUploader = require('./services/ImageUploader');
const RefundPolicy = require('./domain/refund/RefundPolicy');

const PaymentService = require('./payments/PaymentService');
const PaymentProviderRegistry = require('./payments/PaymentProviderRegistry');
const BkashMockProvider = require('./payments/providers/BkashMockProvider');
const CardMockProvider = require('./payments/providers/CardMockProvider');
const NagadMockProvider = require('./payments/providers/NagadMockProvider');

const NotificationService = require('./notifications/NotificationService');
const EmailChannel = require('./notifications/channels/EmailChannel');
const InAppChannel = require('./notifications/channels/InAppChannel');

function buildContainer() {
  // Repositories
  const userRepository = new UserRepository();
  const eventRepository = new EventRepository();
  const seatRepository = new SeatRepository();
  const bookingRepository = new BookingRepository();
  const paymentRepository = new PaymentRepository();
  const notificationRepository = new NotificationRepository();

  // Infrastructure
  const eventBus = new EventBus();
  eventBus.on('error:listener', ({ name, err }) => logger.error({ err }, `listener for ${name} failed`));
  const cache = env.REDIS_URL ? new RedisCache(env.REDIS_URL, logger) : new MemoryCache();
  const authService = new AuthService({ userRepository, jwtSecret: env.JWT_SECRET, jwtExpiresIn: env.JWT_EXPIRES_IN });
  const realtime = new Realtime({ authService, origins: env.clientOrigins, logger });

  // Payments: add a provider here, nothing else changes.
  const providerRegistry = new PaymentProviderRegistry([new BkashMockProvider(), new CardMockProvider(), new NagadMockProvider()]);
  const paymentService = new PaymentService({ paymentRepository, providerRegistry, logger });

  // Notifications: add a channel here, nothing else changes.
  const notificationService = new NotificationService({
    channels: [new EmailChannel({ logger }), new InAppChannel({ notificationRepository, realtime })],
    userRepository,
    logger,
  });
  notificationService.subscribeTo(eventBus, DomainEvents);

  // Real-time seat map: whenever seats change, push the fresh map to viewers.
  eventBus.subscribe(DomainEvents.SEATS_CHANGED, async ({ eventId }) => {
    const seats = await seatRepository.findByEvent(eventId);
    realtime.toEvent(eventId, 'seats:updated', { eventId, seats: seats.map((s) => ({ label: s.label, status: s.status, heldBy: s.heldBy ? String(s.heldBy) : null })) });
  });
  eventBus.subscribe(DomainEvents.BOOKING_EXPIRED, ({ customerId, bookingId }) => realtime.toUser(customerId, 'booking:expired', { bookingId }));

  const holdExpiryService = new HoldExpiryService({
    bookingRepository, seatRepository, eventBus, DomainEvents, logger, intervalSeconds: env.HOLD_SWEEP_INTERVAL_SECONDS,
  });

  const eventService = new EventService({
    eventRepository,
    seatRepository,
    bookingRepository,
    cache,
    cacheTtl: env.CACHE_TTL_SECONDS,
    imageUploader: new ImageUploader({ cloudinary, isConfigured, folder: env.CLOUDINARY_FOLDER }),
    eventBus,
    DomainEvents,
  });

  const bookingService = new BookingService({
    bookingRepository,
    seatRepository,
    eventRepository,
    paymentService,
    paymentRepository,
    refundPolicy: new RefundPolicy({ fullRefundHours: 24 }),
    holdExpiryService,
    eventBus,
    DomainEvents,
    holdMinutes: env.HOLD_MINUTES,
  });

  return {
    env, logger, realtime, eventBus, authService, eventService, bookingService, holdExpiryService,
    providerRegistry, notificationRepository,
  };
}

module.exports = buildContainer;
