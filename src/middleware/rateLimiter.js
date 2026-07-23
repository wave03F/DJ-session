const { getRedis } = require('../config/redis');

/**
 * In-memory fallback when Redis is unavailable
 */
const memoryStore = new Map();

async function increment(key, windowMs) {
  try {
    const redis = getRedis();
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, windowMs);
    }
    return current;
  } catch {
    // Fallback: in-memory
    const now = Date.now();
    const entry = memoryStore.get(key);
    if (!entry || now > entry.resetAt) {
      memoryStore.set(key, { count: 1, resetAt: now + windowMs });
      return 1;
    }
    entry.count++;
    return entry.count;
  }
}

/**
 * Create a rate limiter middleware
 * @param {object} opts
 * @param {number} opts.max - Max requests per window
 * @param {number} opts.windowMs - Window in milliseconds
 * @param {string} opts.keyPrefix - Redis key prefix
 * @param {string} opts.message - Error message
 */
function createLimiter({ max, windowMs, keyPrefix, message }) {
  return async function rateLimitMiddleware(req, res, next) {
    try {
      const identifier = req.user?.id || req.ip || 'anonymous';
      const key = `rl:${keyPrefix}:${identifier}`;
      const current = await increment(key, windowMs);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));

      if (current > max) {
        return res.status(429).json({
          error: message || 'Too many requests. Please slow down.',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      next();
    } catch {
      // If rate limiter fails, allow request through (fail open)
      next();
    }
  };
}

// Pre-configured limiters
const apiLimiter = createLimiter({
  max: 100,
  windowMs: 60 * 1000,
  keyPrefix: 'api',
  message: 'Too many API requests. Limit: 100/minute.'
});

const authLimiter = createLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'auth',
  message: 'Too many login attempts. Try again in 15 minutes.'
});

const chatLimiter = createLimiter({
  max: 60,
  windowMs: 60 * 1000,
  keyPrefix: 'chat',
  message: 'Sending messages too fast. Limit: 60/minute.'
});

const profileViewLimiter = createLimiter({
  max: 10,
  windowMs: 60 * 1000,
  keyPrefix: 'profile_view',
  message: 'Too many profile views. Limit: 10/minute.'
});

const likeLimiter = createLimiter({
  max: 30,
  windowMs: 60 * 1000,
  keyPrefix: 'like',
  message: 'Liking too fast. Limit: 30/minute.'
});

const uploadLimiter = createLimiter({
  max: 10,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'upload',
  message: 'Too many uploads. Limit: 10/hour.'
});

/**
 * Socket.io movement rate limiter (in-memory, per socket)
 * Returns false if rate exceeded
 */
const movementCounters = new Map();
function checkMovementRate(socketId) {
  const now = Date.now();
  const entry = movementCounters.get(socketId);
  if (!entry || now > entry.resetAt) {
    movementCounters.set(socketId, { count: 1, resetAt: now + 1000 });
    return true;
  }
  entry.count++;
  // 30 updates/second max
  return entry.count <= 30;
}

function clearMovementCounter(socketId) {
  movementCounters.delete(socketId);
}

module.exports = {
  apiLimiter,
  authLimiter,
  chatLimiter,
  profileViewLimiter,
  likeLimiter,
  uploadLimiter,
  checkMovementRate,
  clearMovementCounter,
  createLimiter
};
