import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RateLimitGuard,
  RateLimitPresets,
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from './rate-limit.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(overrides?: {
  ip?: string;
  forwarded?: string;
  className?: string;
  handlerName?: string;
}): {
  context: ExecutionContext;
  responseHeaders: Record<string, string>;
} {
  const responseHeaders: Record<string, string> = {};

  const request: any = {
    ip: overrides?.ip ?? '127.0.0.1',
    headers: {} as Record<string, string>,
    socket: { remoteAddress: overrides?.ip ?? '127.0.0.1' },
  };

  if (overrides?.forwarded) {
    request.headers['x-forwarded-for'] = overrides.forwarded;
  }

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

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RateLimitGuard(reflector);
  });

  afterEach(() => {
    guard._destroy();
  });

  // ---------- no decorator ----------

  it('should allow requests when no @RateLimit decorator is present', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const { context } = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  // ---------- basic token deduction ----------

  it('should allow requests up to the limit', () => {
    const opts: RateLimitOptions = { maxRequests: 3, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context } = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject the request once tokens are exhausted', () => {
    const opts: RateLimitOptions = { maxRequests: 2, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context } = createMockContext();

    guard.canActivate(context);
    guard.canActivate(context);

    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });

  it('should return 429 status code when rate limited', () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context } = createMockContext();
    guard.canActivate(context);

    try {
      guard.canActivate(context);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  // ---------- Retry-After header ----------

  it('should set Retry-After header when rate limited', () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context, responseHeaders } = createMockContext();
    guard.canActivate(context); // use the single token

    try {
      guard.canActivate(context);
    } catch {
      // expected
    }

    expect(responseHeaders['Retry-After']).toBeDefined();
    expect(Number(responseHeaders['Retry-After'])).toBeGreaterThan(0);
  });

  // ---------- X-RateLimit headers on success ----------

  it('should set X-RateLimit-* headers on successful requests', () => {
    const opts: RateLimitOptions = { maxRequests: 10, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context, responseHeaders } = createMockContext();
    guard.canActivate(context);

    expect(responseHeaders['X-RateLimit-Limit']).toBe('10');
    expect(Number(responseHeaders['X-RateLimit-Remaining'])).toBeLessThanOrEqual(10);
    expect(responseHeaders['X-RateLimit-Reset']).toBeDefined();
  });

  // ---------- per-IP isolation ----------

  it('should track buckets per IP address', () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const ctx1 = createMockContext({ ip: '10.0.0.1' });
    const ctx2 = createMockContext({ ip: '10.0.0.2' });

    expect(guard.canActivate(ctx1.context)).toBe(true);
    expect(guard.canActivate(ctx2.context)).toBe(true);

    // Both are now at 0 tokens -- both should be rate-limited
    expect(() => guard.canActivate(ctx1.context)).toThrow(HttpException);
    expect(() => guard.canActivate(ctx2.context)).toThrow(HttpException);
  });

  // ---------- X-Forwarded-For ----------

  it('should use X-Forwarded-For when present (first entry)', () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const ctx = createMockContext({
      ip: '127.0.0.1',
      forwarded: '203.0.113.50, 70.41.3.18, 150.172.238.178',
    });

    guard.canActivate(ctx.context);

    // A second request from a different real IP should succeed
    const ctx2 = createMockContext({
      ip: '127.0.0.1',
      forwarded: '198.51.100.7',
    });
    expect(guard.canActivate(ctx2.context)).toBe(true);
  });

  // ---------- per-handler isolation ----------

  it('should track buckets per handler', () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const ctxA = createMockContext({ handlerName: 'login' });
    const ctxB = createMockContext({ handlerName: 'register' });

    expect(guard.canActivate(ctxA.context)).toBe(true);
    expect(guard.canActivate(ctxB.context)).toBe(true);
  });

  // ---------- token refill ----------

  it('should refill tokens after the window elapses', () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 1 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context } = createMockContext();

    guard.canActivate(context); // exhaust the token

    // Manually age the bucket by manipulating lastRefill
    const buckets = guard._getBuckets();
    for (const bucket of buckets.values()) {
      bucket.lastRefill -= 2000; // pretend 2 seconds have passed
    }

    // Should now have tokens again
    expect(guard.canActivate(context)).toBe(true);
  });

  // ---------- presets ----------

  it('AUTH preset should allow 5 requests and block the 6th', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(
      RateLimitPresets.AUTH,
    );

    const { context } = createMockContext();

    for (let i = 0; i < 5; i++) {
      expect(guard.canActivate(context)).toBe(true);
    }
    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });

  it('SENSITIVE preset should allow 3 requests and block the 4th', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(
      RateLimitPresets.SENSITIVE,
    );

    const { context } = createMockContext();

    for (let i = 0; i < 3; i++) {
      expect(guard.canActivate(context)).toBe(true);
    }
    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });

  it('API preset should allow 100 requests', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(
      RateLimitPresets.API,
    );

    const { context } = createMockContext();

    for (let i = 0; i < 100; i++) {
      expect(guard.canActivate(context)).toBe(true);
    }
    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });

  // ---------- error response body ----------

  it('should include retryAfter in the error response body', () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 60 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context } = createMockContext();
    guard.canActivate(context);

    try {
      guard.canActivate(context);
      expect.unreachable('should have thrown');
    } catch (err) {
      const response = (err as HttpException).getResponse() as any;
      expect(response.retryAfter).toBeGreaterThan(0);
      expect(response.message).toContain('Rate limit exceeded');
    }
  });

  // ---------- sweep ----------

  it('should remove stale buckets during sweep', () => {
    const opts: RateLimitOptions = { maxRequests: 1, windowSeconds: 1 };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(opts);

    const { context } = createMockContext();
    guard.canActivate(context);

    expect(guard._getBuckets().size).toBe(1);

    // Age all buckets beyond 120s threshold
    for (const bucket of guard._getBuckets().values()) {
      bucket.lastRefill -= 200_000;
    }

    // Trigger sweep manually via _getBuckets + recheck
    (guard as any).sweep();
    expect(guard._getBuckets().size).toBe(0);
  });
});
