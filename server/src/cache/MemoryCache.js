/** Simple TTL cache in process memory. Same interface as RedisCache. */
class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key, value, ttlSeconds) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delByPrefix(prefix) {
    [...this.store.keys()].filter((k) => k.startsWith(prefix)).forEach((k) => this.store.delete(k));
  }
}

module.exports = MemoryCache;
