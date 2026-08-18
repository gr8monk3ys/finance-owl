import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RateLimitGuard,
  RateLimitPresets,
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from './rate-limit.guard';

// ---------------------------------------------------------------------------
// Mock CacheService
// ---------------------------------------------------------------------------

function createMockCacheService() {
  const store = new Map<string, any>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: any, _ttl?: number) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(overrides?: { ip?: string; className?: string; handlerName?: string }): {
  context: ExecutionContext;
  responseHeaders: Record<string, string>;
} {
  const responseHeaders: Record<string, string> = {};

  const request: any = {
    ip: overrides?.ip ?? '127.0.0.1',
    headers: {} as Record<string, string>,
    socket: { remoteAddress: overrides?.ip ?? '127.0.0.1' },
  };

  const response: any = {
    setHeader: (key: string, value: string) => {
      responseHeaders[key] = value;
    },
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => ({ name: overrides?.handlerName ?? 'testHandler' }),
    getClass: () => ({ name: overrides?.className ?? 'TestController' }),
  } as unknown as ExecutionContext;

  return { context, responseHeaders };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;
  let cacheService: ReturnType<typeof createMockCacheService>;

  beforeEach(() => {
    reflector = new Reflector();
    cacheService = createMockCacheService();
    guard = new RateLimitGuard(reflector, cacheService as any);
  });

  // ---------- no decorator ----------

  it('should allow requests when no @RateLimit decorator is present', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const { context } = createMockContext();
    expect(await guard.canActivate(context)).toBe(true);
  });

  // ---------- basic token deduction ----------

  it('should allow requests up to the limit', async () => {
    const opts: RateLimitOptions = { maxRequests: 3, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context } = createMockContext();

    expect(await guard.canActivate(context)).toBe(true);
    expect(await guard.canActivate(context)).toBe(true);
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('should reject the request once tokens are exhausted', async () => {
    const opts: RateLimitOptions = { maxRequests: 2, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context } = createMockContext();

    await guard.canActivate(context);
    await guard.canActivate(context);

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
  });

  it('should return 429 status code when rate limited', async () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context } = createMockContext();
    await guard.canActivate(context);

    try {
      await guard.canActivate(context);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  // ---------- Retry-After header ----------

  it('should set Retry-After header when rate limited', async () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context, responseHeaders } = createMockContext();
    await guard.canActivate(context); // use the single token

    try {
      await guard.canActivate(context);
    } catch {
      // expected
    }

    expect(responseHeaders['Retry-After']).toBeDefined();
    expect(Number(responseHeaders['Retry-After'])).toBeGreaterThan(0);
  });

  // ---------- X-RateLimit headers on success ----------

  it('should set X-RateLimit-* headers on successful requests', async () => {
    const opts: RateLimitOptions = { maxRequests: 10, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context, responseHeaders } = createMockContext();
    await guard.canActivate(context);

    expect(responseHeaders['X-RateLimit-Limit']).toBe('10');
    expect(Number(responseHeaders['X-RateLimit-Remaining'])).toBeLessThanOrEqual(10);
    expect(responseHeaders['X-RateLimit-Reset']).toBeDefined();
  });

  // ---------- per-IP isolation ----------

  it('should track buckets per IP address', async () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const ctx1 = createMockContext({ ip: '10.0.0.1' });
    const ctx2 = createMockContext({ ip: '10.0.0.2' });

    expect(await guard.canActivate(ctx1.context)).toBe(true);
    expect(await guard.canActivate(ctx2.context)).toBe(true);

    // Both are now at 0 tokens -- both should be rate-limited
    await expect(guard.canActivate(ctx1.context)).rejects.toThrow(HttpException);
    await expect(guard.canActivate(ctx2.context)).rejects.toThrow(HttpException);
  });

  // ---------- IP extraction ----------

  it('should use request.ip for IP extraction', async () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    // Two requests from different IPs should get separate buckets
    const ctx1 = createMockContext({ ip: '203.0.113.50' });
    const ctx2 = createMockContext({ ip: '198.51.100.7' });

    await guard.canActivate(ctx1.context);

    // Different IP should succeed
    expect(await guard.canActivate(ctx2.context)).toBe(true);
  });

  // ---------- per-handler isolation ----------

  it('should track buckets per handler', async () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const ctxA = createMockContext({ handlerName: 'login' });
    const ctxB = createMockContext({ handlerName: 'register' });

    expect(await guard.canActivate(ctxA.context)).toBe(true);
    expect(await guard.canActivate(ctxB.context)).toBe(true);
  });

  // ---------- presets ----------

  it('AUTH preset should allow 5 requests and block the 6th', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(RateLimitPresets.AUTH);

    const { context } = createMockContext();

    for (let i = 0; i < 5; i++) {
      expect(await guard.canActivate(context)).toBe(true);
    }
    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
  });

  it('SENSITIVE preset should allow 3 requests and block the 4th', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(RateLimitPresets.SENSITIVE);

    const { context } = createMockContext();

    for (let i = 0; i < 3; i++) {
      expect(await guard.canActivate(context)).toBe(true);
    }
    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
  });

  it('API preset should allow 100 requests', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(RateLimitPresets.API);

    const { context } = createMockContext();

    for (let i = 0; i < 100; i++) {
      expect(await guard.canActivate(context)).toBe(true);
    }
    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
  });

  // ---------- error response body ----------

  it('should include retryAfter in the error response body', async () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context } = createMockContext();
    await guard.canActivate(context);

    try {
      await guard.canActivate(context);
      expect.unreachable('should have thrown');
    } catch (err) {
      const response = (err as HttpException).getResponse() as any;
      expect(response.retryAfter).toBeGreaterThan(0);
      expect(response.message).toContain('Rate limit exceeded');
    }
  });

  // ---------- cache interaction ----------

  it('should persist bucket state to cache', async () => {
    const opts: RateLimitOptions = { maxRequests: 5, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context } = createMockContext();
    await guard.canActivate(context);

    expect(cacheService.set).toHaveBeenCalled();
    const [key, value, ttl] = cacheService.set.mock.calls[0];
    expect(key).toContain('ratelimit:');
    expect(value).toHaveProperty('tokens');
    expect(value).toHaveProperty('lastRefill');
    expect(ttl).toBe(120); // windowSeconds * 2
  });
});
