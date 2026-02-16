import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Metadata key & decorator
// ---------------------------------------------------------------------------

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

/**
 * Decorator that applies a per-IP token-bucket rate limit to a route
 * or controller.
 *
 * Usage:
 *   @RateLimit(5, 60)                       // 5 requests per 60 s
 *   @RateLimit(RateLimitPresets.AUTH)        // preset object
 */
export function RateLimit(maxRequestsOrOpts: number | RateLimitOptions, windowSeconds?: number) {
  let opts: RateLimitOptions;
  if (typeof maxRequestsOrOpts === 'number') {
    opts = { maxRequests: maxRequestsOrOpts, windowSeconds: windowSeconds ?? 60 };
  } else {
    opts = maxRequestsOrOpts;
  }
  return SetMetadata(RATE_LIMIT_KEY, opts);
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const RateLimitPresets = {
  /** Auth endpoints (login, register): 5 req / 60 s */
  AUTH: { maxRequests: 5, windowSeconds: 60 } satisfies RateLimitOptions,

  /** General API endpoints: 100 req / 60 s */
  API: { maxRequests: 100, windowSeconds: 60 } satisfies RateLimitOptions,

  /** Sensitive operations (password change, MFA): 3 req / 60 s */
  SENSITIVE: { maxRequests: 3, windowSeconds: 60 } satisfies RateLimitOptions,
} as const;

// ---------------------------------------------------------------------------
// Token bucket implementation
// ---------------------------------------------------------------------------

interface Bucket {
  tokens: number;
  lastRefill: number;
}

/**
 * In-memory token-bucket rate limiter.
 *
 * The store is a `Map<string, Bucket>` keyed by a composite of the
 * client IP and the handler identifier. Expired buckets are periodically
 * pruned to prevent unbounded memory growth.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly buckets = new Map<string, Bucket>();

  /** How often (ms) the background sweep removes stale buckets. */
  private static readonly SWEEP_INTERVAL_MS = 60_000;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly reflector: Reflector) {
    // Start background sweep
    this.sweepTimer = setInterval(
      () => this.sweep(),
      RateLimitGuard.SWEEP_INTERVAL_MS,
    );
    // Ensure the timer does not prevent Node from exiting.
    if (this.sweepTimer && typeof this.sweepTimer === 'object' && 'unref' in this.sweepTimer) {
      this.sweepTimer.unref();
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const opts = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RateLimit decorator -> allow
    if (!opts) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const ip = this.extractIp(request);
    const handlerId = `${context.getClass().name}#${context.getHandler().name}`;
    const bucketKey = `${ip}:${handlerId}`;

    const now = Date.now();
    const bucket = this.getOrCreateBucket(bucketKey, opts, now);

    // Refill tokens based on elapsed time
    this.refill(bucket, opts, now);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;

      // Expose remaining tokens in response headers (non-standard but useful)
      response.setHeader('X-RateLimit-Limit', String(opts.maxRequests));
      response.setHeader(
        'X-RateLimit-Remaining',
        String(Math.floor(bucket.tokens)),
      );
      response.setHeader(
        'X-RateLimit-Reset',
        String(
          Math.ceil(now / 1000) + opts.windowSeconds,
        ),
      );
      return true;
    }

    // Calculate seconds until at least 1 token is available
    const tokensNeeded = 1 - bucket.tokens;
    const refillRate = opts.maxRequests / opts.windowSeconds; // tokens per second
    const retryAfter = Math.ceil(tokensNeeded / refillRate);

    response.setHeader('Retry-After', String(retryAfter));
    response.setHeader('X-RateLimit-Limit', String(opts.maxRequests));
    response.setHeader('X-RateLimit-Remaining', '0');
    response.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(now / 1000) + retryAfter),
    );

    this.logger.warn(
      `Rate limit exceeded: ip=${ip} handler=${handlerId} limit=${opts.maxRequests}/${opts.windowSeconds}s`,
    );

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
        retryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // ---------- helpers ----------

  /** Visible for testing. */
  _getBuckets(): Map<string, Bucket> {
    return this.buckets;
  }

  /** Visible for testing. */
  _clearBuckets(): void {
    this.buckets.clear();
  }

  /** Stop the background sweep timer (useful in tests). */
  _destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  private getOrCreateBucket(
    key: string,
    opts: RateLimitOptions,
    now: number,
  ): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: opts.maxRequests, lastRefill: now };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private refill(bucket: Bucket, opts: RateLimitOptions, now: number): void {
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const refillRate = opts.maxRequests / opts.windowSeconds;
    const tokensToAdd = elapsed * refillRate;

    bucket.tokens = Math.min(opts.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  private extractIp(request: Request): string {
    // Trust X-Forwarded-For behind a reverse proxy (first entry is the client)
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Remove buckets that have been fully refilled for longer than their window.
   * This prevents unbounded memory growth from short-lived clients.
   */
  private sweep(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, bucket] of this.buckets) {
      const ageSec = (now - bucket.lastRefill) / 1000;
      // If the bucket has not been touched for 2x the window, remove it
      if (ageSec > 120) {
        this.buckets.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(`Swept ${removed} stale rate-limit bucket(s)`);
    }
  }
}
