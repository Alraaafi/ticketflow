const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

/** Mock bKash wallet. Wallet 01700000000 always fails (to demo failures). */
class BkashMockProvider extends PaymentProvider {
  get id() { return 'bkash'; }
  get displayName() { return 'bKash'; }

  async charge({ amount, details = {} }) {
    const wallet = String(details.walletNumber || '');
    if (!/^01[3-9]\d{8}$/.test(wallet)) return { success: false, failureReason: 'Invalid bKash wallet number' };
    if (wallet === '01700000000') return { success: false, failureReason: 'Insufficient bKash balance' };
    if (!(amount > 0)) return { success: false, failureReason: 'Invalid amount' };
    return { success: true, providerRef: `BKS${crypto.randomBytes(5).toString('hex').toUpperCase()}` };
  }

  async refund({ providerRef }) {
    return { success: true, providerRef: `${providerRef}-RF` };
  }
}

module.exports = BkashMockProvider;
