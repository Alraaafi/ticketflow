/**
 * Strategy pattern: every pricing strategy exposes the same `calculate()`
 * contract, so BookingService never needs to know which one an event uses
 * (Open/Closed + Liskov Substitution).
 */
class PricingStrategy {
  /**
   * @param {{ seats: Array<{label:string, category:string}>, categories: Array<{name:string, price:number}>, now: Date }} ctx
   * @returns {{ subtotal:number, discount:number, total:number, lines:Array, strategy:string, note?:string }}
   */
  // eslint-disable-next-line no-unused-vars
  calculate(ctx) {
    throw new Error('calculate() must be implemented');
  }

  /** Shared helper: base price per seat from its category. */
  static baseLines(seats, categories) {
    const priceOf = new Map(categories.map((c) => [c.name, Number(c.price)]));
    return seats.map((s) => {
      if (!priceOf.has(s.category)) throw new Error(`Unknown seat category "${s.category}"`);
      return { seat: s.label, category: s.category, price: priceOf.get(s.category) };
    });
  }
}

module.exports = PricingStrategy;
