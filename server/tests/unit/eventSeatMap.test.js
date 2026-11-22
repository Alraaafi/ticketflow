const { buildSeats } = require('../../src/services/EventService');
const S = require('../../src/validators/schemas');
const MemoryCache = require('../../src/cache/MemoryCache');

describe('Seat map generation', () => {
  const categories = [
    { name: 'VIP', price: 1000, rowFrom: 'A', rowTo: 'A' },
    { name: 'General', price: 500, rowFrom: 'B', rowTo: 'C' },
  ];

  test('creates rows x seats with the right category per row', () => {
    const seats = buildSeats('e1', { rows: 3, seatsPerRow: 4 }, categories);
    expect(seats).toHaveLength(12);
    expect(seats[0]).toEqual({ event: 'e1', row: 'A', number: 1, label: 'A1', category: 'VIP' });
    expect(seats.at(-1)).toMatchObject({ label: 'C4', category: 'General' });
  });

  test('fails if a row has no category', () => {
    expect(() => buildSeats('e1', { rows: 4, seatsPerRow: 2 }, categories)).toThrow(/Row D/);
  });
});

describe('Event validation rules', () => {
  const base = {
    title: 'My Show', venue: { name: 'Hall', city: 'Dhaka' }, startsAt: new Date(Date.now() + 864e5).toISOString(),
    layout: { rows: 2, seatsPerRow: 5 }, categories: [{ name: 'All', price: 100, rowFrom: 'A', rowTo: 'B' }],
  };

  test('accepts a valid event', () => {
    expect(S.createEvent.safeParse(base).success).toBe(true);
  });

  test('rejects overlapping categories, past dates and incomplete early-bird', () => {
    const overlap = { ...base, categories: [{ name: 'X', price: 1, rowFrom: 'A', rowTo: 'B' }, { name: 'Y', price: 1, rowFrom: 'B', rowTo: 'B' }] };
    expect(S.createEvent.safeParse(overlap).success).toBe(false);
    expect(S.createEvent.safeParse({ ...base, startsAt: '2000-01-01' }).success).toBe(false);
    expect(S.createEvent.safeParse({ ...base, pricing: { strategy: 'EARLY_BIRD' } }).success).toBe(false);
  });
});

describe('MemoryCache', () => {
  test('get/set with TTL and prefix invalidation', async () => {
    const c = new MemoryCache();
    await c.set('events:list:1', { a: 1 }, 60);
    await c.set('other', 1, 60);
    expect(await c.get('events:list:1')).toEqual({ a: 1 });
    await c.delByPrefix('events:list:');
    expect(await c.get('events:list:1')).toBeNull();
    expect(await c.get('other')).toBe(1);
    await c.set('old', 1, -1);
    expect(await c.get('old')).toBeNull();
  });
});
