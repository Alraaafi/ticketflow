/**
 * Common interface for every payment provider (Strategy / Adapter).
 * PaymentService talks only to this, so switching bKash <-> Card <-> Nagad
 * never touches booking code.
 */
class PaymentProvider {
  /** Unique key, e.g. "bkash" */
  get id() { throw new Error('id getter must be implemented'); }

  /** Display name for the UI */
  get displayName() { return this.id; }

  /**
   * @returns {Promise<{ success:boolean, providerRef?:string, failureReason?:string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async charge({ amount, currency, idempotencyKey, details }) {
    throw new Error('charge() must be implemented');
  }

  /** @returns {Promise<{ success:boolean, providerRef?:string }>} */
  // eslint-disable-next-line no-unused-vars
  async refund({ providerRef, amount }) {
    throw new Error('refund() must be implemented');
  }
}

module.exports = PaymentProvider;
