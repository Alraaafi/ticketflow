const Redis = require('ioredis');

/** Redis-backed cache, used automatically when REDIS_URL is set (e.g. Upstash free tier). */
class RedisCache {
  constructor(url, logger) {
    this.client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
    this.client.on('error', (err) => logger.warn({ err: err.message }, 'Redis error'));
  }

  async get(key) {
    const raw = await this.client.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  async set(key, value, ttlSeconds) {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async delByPrefix(prefix) {
    const stream = this.client.scanStream({ match: `${prefix}*`, count: 100 });
    for await (const keys of stream) {
      if (keys.length) await this.client.del(...keys);
    }
  }
}

module.exports = RedisCache;
