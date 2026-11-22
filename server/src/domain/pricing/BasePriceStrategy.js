const PricingStrategy = require('./PricingStrategy');
const { roundMoney } = require('../../utils/helpers');

/** Every seat costs exactly its category price. */
class BasePriceStrategy extends PricingStrategy {
  calculate({ seats, categories }) {
    const lines = PricingStrategy.baseLines(seats, categories);
    const subtotal = roundMoney(lines.reduce((sum, l) => sum + l.price, 0));
    return { strategy: 'BASE', subtotal, discount: 0, total: subtotal, lines };
  }
}

module.exports = BasePriceStrategy;
