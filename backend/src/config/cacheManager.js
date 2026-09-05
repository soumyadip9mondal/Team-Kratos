const Redis = require('ioredis');

let redisClient = null;
let isRedisAvailable = false;
const inMemoryCache = new Map(); // Fallback Map: key -> { value, expiresAt }

try {
  redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy(times) {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 500, 2000);
    }
  });

  redisClient.on('error', (err) => {
    // Graceful error listener: mark Redis unavailable without crashing Node process
    isRedisAvailable = false;
  });

  redisClient.on('connect', () => {
    isRedisAvailable = true;
  });
} catch (err) {
  isRedisAvailable = false;
}

/**
 * Get item from Redis or in-memory fallback
 */
const getCache = async (key) => {
  try {
    if (isRedisAvailable && redisClient) {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
    }
  } catch (err) {
    isRedisAvailable = false;
  }

  // In-memory fallback
  const cached = inMemoryCache.get(key);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      inMemoryCache.delete(key);
      return null;
    }
    return cached.value;
  }

  return null;
};

/**
 * Set item in Redis or in-memory fallback (default 300s TTL)
 */
const setCache = async (key, value, ttlSeconds = 300) => {
  try {
    if (isRedisAvailable && redisClient) {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }
  } catch (err) {
    isRedisAvailable = false;
  }

  // Store in in-memory fallback regardless
  inMemoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
};

/**
 * Delete cache key
 */
const delCache = async (key) => {
  try {
    if (isRedisAvailable && redisClient) {
      await redisClient.del(key);
    }
  } catch (err) {
    isRedisAvailable = false;
  }
  inMemoryCache.delete(key);
};

module.exports = {
  getCache,
  setCache,
  delCache,
  getRedisHealth: () => ({ available: isRedisAvailable, client: redisClient }),
};
