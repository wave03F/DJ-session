const Redis = require('ioredis');

let redis = null;

function getRedis() {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true
    });

    redis.on('error', (err) => {
      console.warn('Redis connection error (non-critical):', err.message);
    });
  }
  return redis;
}

module.exports = { getRedis };
