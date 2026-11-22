const BasePriceStrategy = require('../../src/domain/pricing/BasePriceStrategy');
const EarlyBirdStrategy = require('../../src/domain/pricing/EarlyBirdStrategy');
const PricingStrategy = require('../../src/domain/pricing/PricingStrategy');
const { createPricingStrategy } = require('../../src/domain/pricing/pricingStrategyFactory');

const categories = [{ name: 'VIP', price: 1000 }, { name: 'General', price: 500 }];
const seats = [{ label: 'A1', category: 'VIP' }, { label: 'B1', category: 'General' }, { label: 'B2', category: 'General' }];

describe('BasePriceStrategy', () => {
  test('sums the category price of each seat', () => {
    const r = new BasePriceStrategy().calculate({ seats, categories });
    expect(r).toMatchObject({ strategy: 'BASE', subtotal: 2000, discount: 0, total: 2000 });
    expect(r.lines).toEqual([
      { seat: 'A1', category: 'VIP', price: 1000 },
      { seat: 'B1', category: 'General', price: 500 },
      { seat: 'B2', category: 'General', price: 500 },
    ]);
  });

  test('throws for an unknown category', () => {
    expect(() => new BasePriceStrategy().calculate({ seats: [{ label: 'Z1', category: 'Ghost' }], categories })).toThrow(/Unknown seat category/);
  });
});

describe('EarlyBirdStrategy', () => {
  const endsAt = new Date('2030-01-10T00:00:00Z');
  const strategy = new EarlyBirdStrategy({ discountPercent: 20, endsAt });

  test('applies the discount before the deadline', () => {
    const r = strategy.calculate({ seats, categories, now: new Date('2030-01-01T00:00:00Z') });
    expect(r).toMatchObject({ strategy: 'EARLY_BIRD', subtotal: 2000, discount: 400, total: 1600 });
  });

  test('charges full price on/after the deadline', () => {
    const r = strategy.calculate({ seats, categories, now: endsAt });
    expect(r).toMatchObject({ discount: 0, total: 2000 });
    expect(r.note).toMatch(/ended/);
  });

  test('rounds money to 2 decimals', () => {
    const s = new EarlyBirdStrategy({ discountPercent: 33, endsAt });
    const r = s.calculate({ seats: [{ label: 'X', category: 'C' }], categories: [{ name: 'C', price: 99.99 }], now: new Date('2030-01-01') });
    expect(r.discount).toBe(33);
    expect(r.total).toBe(66.99);
  });

  test('validates its config', () => {
    expect(() => new EarlyBirdStrategy({ discountPercent: 0, endsAt })).toThrow();
    expect(() => new EarlyBirdStrategy({ discountPercent: 150, endsAt })).toThrow();
    expect(() => new EarlyBirdStrategy({ discountPercent: 10 })).toThrow();
  });
});

describe('pricingStrategyFactory', () => {
  test('builds the strategy chosen by the organizer', () => {
    expect(createPricingStrategy({ strategy: 'BASE' })).toBeInstanceOf(BasePriceStrategy);
    const eb = createPricingStrategy({ strategy: 'EARLY_BIRD', earlyBirdDiscountPercent: 10, earlyBirdEndsAt: '2030-01-01' });
    expect(eb).toBeInstanceOf(EarlyBirdStrategy);
    expect(eb).toBeInstanceOf(PricingStrategy);
  });

  test('defaults to BASE and rejects unknown strategies', () => {
    expect(createPricingStrategy()).toBeInstanceOf(BasePriceStrategy);
    expect(() => createPricingStrategy({ strategy: 'SURGE' })).toThrow(/Unknown pricing strategy/);
  });

  test('abstract base cannot be used directly', () => {
    expect(() => new PricingStrategy().calculate({})).toThrow(/must be implemented/);
  });
});
