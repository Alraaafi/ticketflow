const EventService = require('../../src/services/EventService');
const MemoryCache = require('../../src/cache/MemoryCache');
const { EventBus, DomainEvents } = require('../fakes');

function setup({ activeSeats = 0 } = {}) {
  const store = new Map([['e1', { _id: 'e1', organizer: { _id: 'org1' }, title: 'Show', isPublished: true, layout: { rows: 1, seatsPerRow: 2 }, categories: [{ name: 'A', price: 100, rowFrom: 'A', rowTo: 'A' }], pricing: { strategy: 'BASE' } }]]);
  const eventRepository = {
    create: jest.fn(async (d) => ({ _id: 'new', ...d })),
    findById: jest.fn(async (id) => store.get(id) || null),
    updateById: jest.fn(async (id, d) => ({ ...store.get(id), ...d })),
    deleteById: jest.fn(async () => {}),
    search: jest.fn(async () => ({ items: [], total: 0 })),
  };
  const seatRepository = {
    insertMany: jest.fn(async () => {}),
    deleteByEvent: jest.fn(async () => {}),
    countActive: jest.fn(async () => activeSeats),
    findByLabels: jest.fn(async (_e, labels) => labels.map((label) => ({ label, category: 'A' }))),
  };
  const imageUploader = { upload: jest.fn(async () => ({ url: 'https://img', publicId: 'p1' })), remove: jest.fn(async () => {}) };
  const service = new EventService({ eventRepository, seatRepository, bookingRepository: {}, cache: new MemoryCache(), cacheTtl: 60, imageUploader, eventBus: new EventBus(), DomainEvents });
  return { service, eventRepository, seatRepository, imageUploader };
}

const owner = { id: 'org1' };
const stranger = { id: 'org2' };

describe('EventService: organizers manage only their own events', () => {
  test('create generates the seat map', async () => {
    const { service, seatRepository } = setup();
    await service.create(owner, { layout: { rows: 2, seatsPerRow: 3 }, categories: [{ name: 'X', price: 1, rowFrom: 'A', rowTo: 'B' }] });
    expect(seatRepository.insertMany.mock.calls[0][0]).toHaveLength(6);
  });

  test.each(['update', 'remove', 'uploadImage'])('%s by another organizer -> 403', async (method) => {
    const { service } = setup();
    await expect(service[method]('e1', stranger, {})).rejects.toMatchObject({ statusCode: 403 });
  });

  test('owner can update and delete', async () => {
    const { service, eventRepository } = setup();
    await service.update('e1', owner, { title: 'New' });
    await service.remove('e1', owner);
    expect(eventRepository.deleteById).toHaveBeenCalledWith('e1');
  });

  test('seat map is locked once seats are held/booked', async () => {
    const { service } = setup({ activeSeats: 3 });
    await expect(service.update('e1', owner, { layout: { rows: 1, seatsPerRow: 1 }, categories: [] })).rejects.toMatchObject({ code: 'SEATMAP_LOCKED' });
    await expect(service.remove('e1', owner)).rejects.toMatchObject({ code: 'EVENT_HAS_BOOKINGS' });
  });

  test('image upload goes through the uploader adapter', async () => {
    const { service, imageUploader } = setup();
    const res = await service.uploadImage('e1', owner, { buffer: Buffer.from('x') });
    expect(imageUploader.upload).toHaveBeenCalled();
    expect(res.imageUrl).toBe('https://img');
  });

  test('event list is cached until an event changes', async () => {
    const { service, eventRepository } = setup();
    expect((await service.search({ page: 1 })).cached).toBe(false);
    expect((await service.search({ page: 1 })).cached).toBe(true);
    await service.update('e1', owner, { title: 'x' });
    expect((await service.search({ page: 1 })).cached).toBe(false);
    expect(eventRepository.search).toHaveBeenCalledTimes(2);
  });

  test('quote uses the event pricing strategy', async () => {
    const { service } = setup();
    const q = await service.quote('e1', ['A1', 'A2']);
    expect(q.total).toBe(200);
  });
});
