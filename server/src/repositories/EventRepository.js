const { Event } = require('../models/Event');
const { escapeRegex } = require('../utils/helpers');

class EventRepository {
  create(data) {
    return Event.create(data);
  }

  findById(id) {
    return Event.findById(id).populate('organizer', 'name email');
  }

  updateById(id, data) {
    return Event.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true });
  }

  deleteById(id) {
    return Event.findByIdAndDelete(id);
  }

  /** Public browse: text-ish search by name, city, date range, type + pagination. */
  async search({ q, city, type, from, to, page = 1, limit = 9, includePast = false }) {
    const filter = { isPublished: true };
    if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };
    if (city) filter['venue.city'] = { $regex: `^${escapeRegex(city)}$`, $options: 'i' };
    if (type) filter.type = type;
    const range = {};
    if (!includePast) range.$gte = new Date();
    if (from) range.$gte = new Date(Math.max(new Date(from).getTime(), includePast ? 0 : Date.now()));
    if (to) range.$lte = new Date(to);
    if (Object.keys(range).length) filter.startsAt = range;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Event.find(filter).sort({ startsAt: 1 }).skip(skip).limit(limit).populate('organizer', 'name').lean(),
      Event.countDocuments(filter),
    ]);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  findByOrganizer(organizerId) {
    return Event.find({ organizer: organizerId }).sort({ startsAt: 1 }).lean();
  }

  distinctCities() {
    return Event.distinct('venue.city', { isPublished: true });
  }
}

module.exports = EventRepository;
