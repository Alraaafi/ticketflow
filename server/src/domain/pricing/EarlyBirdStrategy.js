const PricingStrategy = require('./PricingStrategy');
const { roundMoney } = require('../../utils/helpers');

/** X% off the whole order while `now` is before the early-bird deadline. */
class EarlyBirdStrategy extends PricingStrategy {
  constructor({ discountPercent, endsAt }) {
    super();
    if (!(discountPercent > 0 && discountPercent < 100)) throw new Error('discountPercent must be between 0 and 100');
    if (!endsAt) throw new Error('endsAt is required for early-bird pricing');
    this.discountPercent = Number(discountPercent);
    this.endsAt = new Date(endsAt);
  }

  isActive(now) {
    return now.getTime() < this.endsAt.getTime();
  }

  calculate({ seats, categories, now = new Date() }) {
    const lines = PricingStrategy.baseLines(seats, categories);
    const subtotal = roundMoney(lines.reduce((sum, l) => sum + l.price, 0));
    const active = this.isActive(now);
    const discount = active ? roundMoney((subtotal * this.discountPercent) / 100) : 0;
    return {
      strategy: 'EARLY_BIRD',
      subtotal,
      discount,
      total: roundMoney(subtotal - discount),
      lines,
      note: active ? `Early-bird ${this.discountPercent}% off until ${this.endsAt.toISOString()}` : 'Early-bird period has ended',
    };
  }
}

module.exports = EarlyBirdStrategy;
