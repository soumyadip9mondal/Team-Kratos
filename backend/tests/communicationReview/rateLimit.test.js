/**
 * Rate Limiter Unit & Integration Tests
 *
 * Verifies fail-closed 503 behavior when Redis is unavailable,
 * in-flight locking, and hourly/daily rate limiting limits.
 */

const rateLimitMiddleware = require('../../src/middleware/communicationStressTestRateLimit');
const cacheManager = require('../../src/config/cacheManager');

describe('Communication Stress-Test Rate Limiter Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {
        tenantId: 'tenant-123',
        id: 'user-456',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('FAIL-CLOSED: returns HTTP 503 when Redis is unavailable', async () => {
    // Mock Redis health as unavailable
    jest.spyOn(cacheManager, 'getRedisHealth').mockReturnValue({
      available: false,
      client: null,
    });

    await rateLimitMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FEATURE_DISABLED',
        error: expect.stringContaining('temporarily unavailable'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('locks request and calls next() when Redis is available and limits are clean', async () => {
    const mockClient = {
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    };

    jest.spyOn(cacheManager, 'getRedisHealth').mockReturnValue({
      available: true,
      client: mockClient,
    });

    await rateLimitMiddleware(req, res, next);

    expect(mockClient.set).toHaveBeenCalled();
    expect(mockClient.incr).toHaveBeenCalledTimes(2); // user rate + tenant rate
    expect(next).toHaveBeenCalled();
  });

  test('returns 429 TEST_IN_PROGRESS when in-flight lock is already held', async () => {
    const mockClient = {
      set: jest.fn().mockResolvedValue(null), // Lock failed
    };

    jest.spyOn(cacheManager, 'getRedisHealth').mockReturnValue({
      available: true,
      client: mockClient,
    });

    await rateLimitMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TEST_IN_PROGRESS',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
