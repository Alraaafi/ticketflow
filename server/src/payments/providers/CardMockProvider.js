const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

/** Mock card gateway (Stripe/SSLCommerz style). Card 4000 0000 0000 0002 is declined. */
class CardMockProvider extends PaymentProvider {
  get id() { return 'card'; }
  get displayName() { return 'Visa / Mastercard'; }

  async charge({ amount, details = {} }) {
    const card = String(details.cardNumber || '').replace(/\s+/g, '');
    if (!/^\d{16}$/.test(card)) return { success: false, failureReason: 'Card number must be 16 digits' };
    if (card === '4000000000000002') return { success: false, failureReason: 'Card declined by bank' };
    if (!(amount > 0)) return { success: false, failureReason: 'Invalid amount' };
    return { success: true, providerRef: `ch_${crypto.randomBytes(8).toString('hex')}` };
  }

  async refund({ providerRef }) {
    return { success: true, providerRef: `re_${providerRef}` };
  }
}

module.exports = CardMockProvider;
