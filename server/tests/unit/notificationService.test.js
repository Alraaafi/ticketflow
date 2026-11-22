const NotificationService = require('../../src/notifications/NotificationService');
const NotificationChannel = require('../../src/notifications/channels/NotificationChannel');
const EmailChannel = require('../../src/notifications/channels/EmailChannel');
const InAppChannel = require('../../src/notifications/channels/InAppChannel');
const { EventBus, DomainEvents, silentLogger, tick } = require('../fakes');

const user = { _id: 'u1', email: 'a@b.com' };
const userRepository = { findById: async (id) => (id === 'u1' ? user : null) };

describe('NotificationService (Observer + pluggable channels)', () => {
  test('sends to every channel, including one added later (Open/Closed)', async () => {
    const repo = { create: jest.fn(async (d) => ({ _id: 'n1', ...d })) };
    const realtime = { toUser: jest.fn() };
    const logger = { ...silentLogger, info: jest.fn() };
    const service = new NotificationService({ channels: [new EmailChannel({ logger }), new InAppChannel({ notificationRepository: repo, realtime })], userRepository, logger });

    class SmsChannel extends NotificationChannel {
      constructor() { super(); this.sent = []; }
      get name() { return 'sms'; }
      async send(msg) { this.sent.push(msg); }
    }
    const sms = new SmsChannel();
    service.register(sms);

    await service.notify('u1', { type: 'T', title: 'Hi', message: 'Hello' });
    expect(logger.info).toHaveBeenCalled(); // email logged
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'u1', title: 'Hi' }));
    expect(realtime.toUser).toHaveBeenCalledWith('u1', 'notification:new', expect.any(Object));
    expect(sms.sent).toHaveLength(1);
  });

  test('a failing channel does not stop the others', async () => {
    const bad = { name: 'bad', send: jest.fn().mockRejectedValue(new Error('down')) };
    const good = { name: 'good', send: jest.fn().mockResolvedValue({}) };
    const logger = { ...silentLogger, error: jest.fn() };
    const service = new NotificationService({ channels: [bad, good], userRepository, logger });
    await service.notify('u1', { type: 'T', title: 't', message: 'm' });
    expect(good.send).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  test('reacts to booking.confirmed / booking.cancelled domain events', async () => {
    const channel = { name: 'c', send: jest.fn().mockResolvedValue({}) };
    const service = new NotificationService({ channels: [channel], userRepository, logger: silentLogger });
    const bus = new EventBus();
    service.subscribeTo(bus, DomainEvents);
    const summary = { bookingId: 'b1', code: 'TF-1', customerId: 'u1', eventTitle: 'Show', seats: ['A1'], total: 100 };
    bus.publish(DomainEvents.BOOKING_CONFIRMED, summary);
    bus.publish(DomainEvents.BOOKING_CANCELLED, { ...summary, refundAmount: 100 });
    await tick(); await tick(); await tick();
    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(channel.send.mock.calls[0][0]).toMatchObject({ type: 'BOOKING_CONFIRMED' });
    expect(channel.send.mock.calls[1][0]).toMatchObject({ type: 'BOOKING_CANCELLED' });
  });

  test('unknown user -> nothing sent; abstract channel must be implemented', async () => {
    const channel = { name: 'c', send: jest.fn() };
    const service = new NotificationService({ channels: [channel], userRepository, logger: silentLogger });
    expect(await service.notify('ghost', { type: 'T', title: 't', message: 'm' })).toEqual([]);
    const base = new NotificationChannel();
    expect(() => base.name).toThrow();
    await expect(base.send({})).rejects.toThrow();
  });
});
