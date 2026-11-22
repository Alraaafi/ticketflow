/**
 * Factory: turns the pricing config stored on an Event into a strategy object.
 * To add a new strategy: create a class + add one line to the registry.
 */
const BasePriceStrategy = require('./BasePriceStrategy');
const EarlyBirdStrategy = require('./EarlyBirdStrategy');

const registry = {
  BASE: () => new BasePriceStrategy(),
  EARLY_BIRD: (cfg) => new EarlyBirdStrategy({ discountPercent: cfg.earlyBirdDiscountPercent, endsAt: cfg.earlyBirdEndsAt }),
};

const PRICING_STRATEGIES = Object.keys(registry);

function createPricingStrategy(pricing = { strategy: 'BASE' }) {
  const build = registry[pricing.strategy];
  if (!build) throw new Error(`Unknown pricing strategy "${pricing.strategy}"`);
  return build(pricing);
}

module.exports = { createPricingStrategy, PRICING_STRATEGIES };
