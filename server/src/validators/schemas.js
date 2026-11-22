const { z } = require('zod');
const { EVENT_TYPES } = require('../domain/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const rowLetter = z.string().regex(/^[A-Za-z]$/, 'Row must be a single letter').transform((s) => s.toUpperCase());

const register = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email('Invalid email')),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  role: z.enum(['CUSTOMER', 'ORGANIZER']).default('CUSTOMER'),
  phone: z.string().trim().max(20).optional(),
});

const login = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Invalid email')),
  password: z.string().min(1),
});

const category = z.object({
  name: z.string().trim().min(1).max(30),
  price: z.coerce.number().min(0).max(1_000_000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  rowFrom: rowLetter,
  rowTo: rowLetter,
});

/** Built twice: with defaults for create, without defaults for PATCH (so missing fields stay untouched). */
const eventShape = (withDefaults) => {
  const d = (schema, value) => (withDefaults ? schema.default(value) : schema);
  return z.object({
    title: z.string().trim().min(3).max(120),
    description: d(z.string().max(3000), ''),
    type: d(z.enum(EVENT_TYPES), 'CONCERT'),
    venue: z.object({
      name: z.string().trim().min(2).max(120),
      address: z.string().max(200).default(''),
      city: z.string().trim().min(2).max(60),
    }),
    startsAt: z.coerce.date(),
    imageUrl: z.string().url().or(z.literal('')).optional(),
    layout: z.object({
      rows: z.coerce.number().int().min(1).max(26),
      seatsPerRow: z.coerce.number().int().min(1).max(40),
    }),
    categories: z.array(category).min(1).max(10),
    pricing: d(z.object({
      strategy: z.enum(['BASE', 'EARLY_BIRD']).default('BASE'),
      earlyBirdDiscountPercent: z.coerce.number().min(1).max(90).optional(),
      earlyBirdEndsAt: z.coerce.date().optional(),
    }), { strategy: 'BASE' }),
    isPublished: d(z.boolean(), true),
  });
};

/** Business rules on the seat map: categories must cover every row exactly once. */
function checkSeatMap(data, ctx) {
  if (data.startsAt && data.startsAt <= new Date()) {
    ctx.addIssue({ code: 'custom', path: ['startsAt'], message: 'Event date must be in the future' });
  }
  if (data.pricing?.strategy === 'EARLY_BIRD') {
    if (!data.pricing.earlyBirdDiscountPercent) ctx.addIssue({ code: 'custom', path: ['pricing', 'earlyBirdDiscountPercent'], message: 'Discount % is required for early-bird' });
    if (!data.pricing.earlyBirdEndsAt) ctx.addIssue({ code: 'custom', path: ['pricing', 'earlyBirdEndsAt'], message: 'Early-bird end date is required' });
  }
  if (data.layout && data.categories) {
    const covered = new Array(data.layout.rows).fill(0);
    data.categories.forEach((c, i) => {
      const from = c.rowFrom.charCodeAt(0) - 65;
      const to = c.rowTo.charCodeAt(0) - 65;
      if (from > to) ctx.addIssue({ code: 'custom', path: ['categories', i], message: `${c.name}: rowFrom must be before rowTo` });
      for (let r = from; r <= to; r += 1) {
        if (r >= data.layout.rows) ctx.addIssue({ code: 'custom', path: ['categories', i], message: `${c.name}: row ${String.fromCharCode(65 + r)} is outside the seat map` });
        else covered[r] += 1;
      }
    });
    covered.forEach((n, r) => {
      const row = String.fromCharCode(65 + r);
      if (n === 0) ctx.addIssue({ code: 'custom', path: ['categories'], message: `Row ${row} is not assigned to any category` });
      if (n > 1) ctx.addIssue({ code: 'custom', path: ['categories'], message: `Row ${row} is in more than one category` });
    });
    const names = data.categories.map((c) => c.name.toLowerCase());
    if (new Set(names).size !== names.length) ctx.addIssue({ code: 'custom', path: ['categories'], message: 'Category names must be unique' });
  }
}

const createEvent = eventShape(true).superRefine(checkSeatMap);
const updateEvent = eventShape(false).partial().superRefine((data, ctx) => {
  if ((data.layout && !data.categories) || (!data.layout && data.categories)) {
    ctx.addIssue({ code: 'custom', path: ['layout'], message: 'layout and categories must be updated together' });
  }
  checkSeatMap(data, ctx);
});

const searchEvents = z.object({
  q: z.string().trim().max(100).optional(),
  city: z.string().trim().max(60).optional(),
  type: z.enum(EVENT_TYPES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(9),
});

const seatLabels = z.array(z.string().trim().regex(/^[A-Za-z]\d{1,2}$/, 'Invalid seat label')).min(1).max(10);

const quote = z.object({ seats: seatLabels });
const hold = z.object({ eventId: objectId, seats: seatLabels });

const pay = z.object({
  provider: z.string().trim().min(1),
  details: z.object({
    walletNumber: z.string().trim().optional(),
    cardNumber: z.string().trim().optional(),
    cardName: z.string().trim().optional(),
  }).default({}),
});

const idParam = z.object({ id: objectId });

module.exports = { register, login, createEvent, updateEvent, searchEvents, quote, hold, pay, idParam };
