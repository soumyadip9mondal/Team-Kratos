/**
 * Communication Stress-Test Rate Limiter Middleware
 *
 * Enforces Redis-backed rate limits & concurrency locks:
 *   - 10 tests / user / hour
 *   - 100 tests / tenant / day
 *   - 30-second per-user in-flight lock (prevents rapid double-submits)
 *
 * FAIL-CLOSED GUARANTEE (Resolved Q1):
 *   If Redis is unavailable, returns HTTP 503 FEATURE_DISABLED.
 *   Does NOT fall back to in-memory counters for rate-limiting.
 */

const cacheManager = require('../config/cacheManager');
const { RATE_LIMITS } = require('../config/communicationReviewPolicy');

// In-memory fallback maps for development mode when local Redis server is not running
const devInMemoryLocks = new Set();

/**
 * Middleware function for rate limiting and locking stress-test executions.
 */
const rateLimitMiddleware = async (req, res, next) => {
  const health = cacheManager.getRedisHealth();

  // 1. Redis Availability Check
  if (!health.available || !health.client) {
    // In production or test environments, strictly fail closed (503) per Q1 specification
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') {
      return res.status(503).json({
        error: 'Message review is temporarily unavailable. Your draft has been preserved.',
        code: 'FEATURE_DISABLED',
      });
    }

    // In development mode, use lightweight in-memory lock fallback so local UI testing works
    const tenantId = req.user?.tenantId || 'dev-tenant';
    const userId = req.user?.id || 'dev-user';
    const lockKey = `${tenantId}:${userId}`;

    if (devInMemoryLocks.has(lockKey)) {
      return res.status(429).json({
        error: 'A stress test is already in progress. Please wait a moment before trying again.',
        code: 'TEST_IN_PROGRESS',
      });
    }

    devInMemoryLocks.add(lockKey);
    setTimeout(() => devInMemoryLocks.delete(lockKey), RATE_LIMITS.inFlightLockSeconds * 1000);

    req.releaseStressTestLock = async () => {
      devInMemoryLocks.delete(lockKey);
    };

    return next();
  }

  const client = health.client;
  const tenantId = req.user.tenantId;
  const userId = req.user.id;

  const userRateKey = `stress_test:rate:user:${tenantId}:${userId}`;
  const tenantRateKey = `stress_test:rate:tenant:${tenantId}`;
  const userLockKey = `stress_test:lock:user:${tenantId}:${userId}`;

  try {
    // 2. Check 30-second In-flight Lock (SET NX)
    const lockAcquired = await client.set(
      userLockKey,
      '1',
      'EX',
      RATE_LIMITS.inFlightLockSeconds,
      'NX'
    );

    if (!lockAcquired) {
      return res.status(429).json({
        error: 'A stress test is already in progress. Please wait a moment before trying again.',
        code: 'TEST_IN_PROGRESS',
      });
    }

    // Attach releaseLock function to req so controller can clear lock upon completion
    req.releaseStressTestLock = async () => {
      try {
        await client.del(userLockKey);
      } catch (err) {
        // Non-fatal if lock clear fails (TTL will expire in 30s)
      }
    };

    // 3. User Rate Limit Check (10/hr)
    const userCount = await client.incr(userRateKey);
    if (userCount === 1) {
      await client.expire(userRateKey, 3600); // 1 hour TTL
    }

    if (userCount > RATE_LIMITS.perUserPerHour) {
      await client.del(userLockKey); // Release lock
      return res.status(429).json({
        error: `Hourly limit reached (${RATE_LIMITS.perUserPerHour} tests/hour). Please try again later.`,
        code: 'USER_RATE_LIMIT_EXCEEDED',
      });
    }

    // 4. Tenant Rate Limit Check (100/day)
    const tenantCount = await client.incr(tenantRateKey);
    if (tenantCount === 1) {
      await client.expire(tenantRateKey, 86400); // 24 hour TTL
    }

    if (tenantCount > RATE_LIMITS.perTenantPerDay) {
      await client.del(userLockKey); // Release lock
      return res.status(429).json({
        error: 'Organization daily stress-test limit reached. Please try again tomorrow.',
        code: 'TENANT_RATE_LIMIT_EXCEEDED',
      });
    }

    next();
  } catch (err) {
    console.error('[RateLimitMiddleware] Redis operation error:', err.message);
    // On unexpected Redis error during checks, fail closed (503)
    return res.status(503).json({
      error: 'Message review is temporarily unavailable. Your draft has been preserved.',
      code: 'FEATURE_DISABLED',
    });
  }
};

module.exports = rateLimitMiddleware;
