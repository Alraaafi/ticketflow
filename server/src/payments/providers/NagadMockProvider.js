const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

/** Mock Nagad wallet. Added after the first two providers with zero booking-code changes. */
class NagadMockProvider extends PaymentProvider {
  get id() { return 'nagad'; }
  get displayName() { return 'Nagad'; }

  async charge({ amount, details = {} }) {
    const wallet = String(details.walletNumber || '');
    if (!/^01[3-9]\d{8}$/.test(wallet)) return { success: false, failureReason: 'Invalid Nagad wallet number' };
    if (!(amount > 0)) return { success: false, failureReason: 'Invalid amount' };
    return { success: true, providerRef: `NGD${crypto.randomBytes(5).toString('hex').toUpperCase()}` };
  }

  async refund({ providerRef }) {
    return { success: true, providerRef: `${providerRef}-RF` };
  }
}

module.exports = NagadMockProvider;
