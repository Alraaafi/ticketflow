const AppError = require('../utils/AppError');
const { rowLabel, rowIndex } = require('../utils/helpers');
const { createPricingStrategy } = require('../domain/pricing/pricingStrategyFactory');

const LIST_CACHE_PREFIX = 'events:list:';

/** Builds one seat doc per (row x seat), each tagged with its category. */
function buildSeats(eventId, layout, categories) {
  const seats = [];
  for (let r = 0; r < layout.rows; r += 1) {
    const row = rowLabel(r);
    const cat = categories.find((c) => r >= rowIndex(c.rowFrom) && r <= rowIndex(c.rowTo));
    if (!cat) throw AppError.badRequest(`Row ${row} has no seat category`);
    for (let n = 1; n <= layout.seatsPerRow; n += 1) {
      seats.push({ event: eventId, row, number: n, label: `${row}${n}`, category: cat.name });
    }
  }
  return seats;
}

class EventService {
  constructor({ eventRepository, seatRepository, bookingRepository, cache, cacheTtl, imageUploader, eventBus, DomainEvents }) {
    this.events = eventRepository;
    this.seats = seatRepository;
    this.bookings = bookingRepository;
    this.cache = cache;
    this.cacheTtl = cacheTtl;
    this.imageUploader = imageUploader;
    this.eventBus = eventBus;
    this.DomainEvents = DomainEvents;
  }

  async #assertOwner(eventId, user) {
    const event = await this.events.findById(eventId);
    if (!event) throw AppError.notFound('Event not found');
    if (String(event.organizer._id || event.organizer) !== String(user.id)) {
      throw AppError.forbidden('You can only manage your own events');
    }
    return event;
  }

  async #invalidateList() {
    await this.cache.delByPrefix(LIST_CACHE_PREFIX);
  }

  async create(user, data) {
    const event = await this.events.create({ ...data, organizer: user.id });
    try {
      await this.seats.insertMany(buildSeats(event._id, event.layout, event.categories));
    } catch (err) {
      await this.events.deleteById(event._id);
      throw err;
    }
    await this.#invalidateList();
    return event;
  }

  async update(eventId, user, data) {
    const event = await this.#assertOwner(eventId, user);
    const layoutChanged = data.layout || data.categories;
    if (layoutChanged && (await this.seats.countActive(eventId)) > 0) {
      throw AppError.conflict('Seat map cannot change after seats are held or booked', 'SEATMAP_LOCKED');
    }
    const updated = await this.events.updateById(eventId, data);
    if (layoutChanged) {
      await this.seats.deleteByEvent(eventId);
      await this.seats.insertMany(buildSeats(event._id, updated.layout, updated.categories));
      this.eventBus.publish(this.DomainEvents.SEATS_CHANGED, { eventId: String(eventId) });
    }
    await this.#invalidateList();
    return updated;
  }

  async remove(eventId, user) {
    const event = await this.#assertOwner(eventId, user);
    if ((await this.seats.countActive(eventId)) > 0) {
      throw AppError.conflict('Event has active bookings and cannot be deleted', 'EVENT_HAS_BOOKINGS');
    }
    await this.seats.deleteByEvent(eventId);
    await this.events.deleteById(eventId);
    if (event.imagePublicId) await this.imageUploader.remove(event.imagePublicId).catch(() => {});
    await this.#invalidateList();
  }

  async uploadImage(eventId, user, file) {
    const event = await this.#assertOwner(eventId, user);
    if (!file) throw AppError.badRequest('Image file is required');
    const { url, publicId } = await this.imageUploader.upload(file.buffer);
    if (event.imagePublicId) await this.imageUploader.remove(event.imagePublicId).catch(() => {});
    const updated = await this.events.updateById(eventId, { imageUrl: url, imagePublicId: publicId });
    await this.#invalidateList();
    return updated;
  }

  /** Cache-aside: read from cache, otherwise DB then cache it. */
  async search(filters) {
    const key = LIST_CACHE_PREFIX + JSON.stringify(filters);
    const cached = await this.cache.get(key);
    if (cached) return { ...cached, cached: true };
    const result = await this.events.search(filters);
    await this.cache.set(key, result, this.cacheTtl);
    return { ...result, cached: false };
  }

  cities() {
    return this.events.distinctCities();
  }

  async getDetail(eventId) {
    const event = await this.events.findById(eventId);
    if (!event || !event.isPublished) throw AppError.notFound('Event not found');
    const [seats, stats] = await Promise.all([this.seats.findByEvent(eventId), this.seats.statsByEvent(eventId)]);
    return { event, seats: seats.map(({ heldBy, ...s }) => ({ ...s, heldBy: heldBy ? String(heldBy) : null })), stats };
  }

  async seatMap(eventId) {
    return this.seats.findByEvent(eventId);
  }

  async quote(eventId, labels) {
    const event = await this.events.findById(eventId);
    if (!event) throw AppError.notFound('Event not found');
    const seats = await this.seats.findByLabels(eventId, labels);
    if (seats.length !== labels.length) throw AppError.badRequest('One or more seats do not exist');
    return createPricingStrategy(event.pricing).calculate({ seats, categories: event.categories, now: new Date() });
  }

  async listMine(user) {
    const events = await this.events.findByOrganizer(user.id);
    return Promise.all(events.map(async (e) => ({ ...e, stats: await this.seats.statsByEvent(e._id) })));
  }

  async getMineDetail(eventId, user) {
    const event = await this.#assertOwner(eventId, user);
    const [stats, bookings] = await Promise.all([this.seats.statsByEvent(eventId), this.bookings.findByEvent(eventId)]);
    const revenue = bookings.filter((b) => b.status === 'CONFIRMED').reduce((s, b) => s + (b.pricing?.total || 0), 0);
    return { event, stats, bookings, revenue };
  }
}

module.exports = EventService;
module.exports.buildSeats = buildSeats;
