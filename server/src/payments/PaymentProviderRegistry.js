const AppError = require('../utils/AppError');

/** Registry / Factory: look up a provider by id ("bkash", "card", "nagad"). */
class PaymentProviderRegistry {
  constructor(providers = []) {
    this.providers = new Map();
    providers.forEach((p) => this.register(p));
  }

  register(provider) {
    this.providers.set(provider.id, provider);
  }

  get(id) {
    const p = this.providers.get(id);
    if (!p) throw AppError.badRequest(`Unsupported payment provider "${id}"`);
    return p;
  }

  list() {
    return [...this.providers.values()].map((p) => ({ id: p.id, name: p.displayName }));
  }
}

module.exports = PaymentProviderRegistry;
