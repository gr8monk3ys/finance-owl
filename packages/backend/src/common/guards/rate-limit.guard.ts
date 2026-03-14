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
import { CacheService } from '../cache/cache.service';

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
 * Redis-backed token-bucket rate limiter.
 *
 * Bucket state is stored in Redis (via CacheService) with TTLs that handle
 * expiration automatically, eliminating the need for a background sweep.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    const bucketKey = `ratelimit:${handlerId}:${ip}`;

    const now = Date.now();
    const bucket = await this.getOrCreateBucket(bucketKey, opts, now);

    // Refill tokens based on elapsed time
    this.refill(bucket, opts, now);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;

      // Persist updated bucket state to Redis
      await this.cacheService.set(bucketKey, bucket, opts.windowSeconds * 2);

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

    // Persist updated bucket state to Redis
    await this.cacheService.set(bucketKey, bucket, opts.windowSeconds * 2);

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

  private async getOrCreateBucket(
    key: string,
    opts: RateLimitOptions,
    now: number,
  ): Promise<Bucket> {
    const bucket = await this.cacheService.get<Bucket>(key);
    if (bucket) {
      return bucket;
    }
    return { tokens: opts.maxRequests, lastRefill: now };
  }

  private refill(bucket: Bucket, opts: RateLimitOptions, now: number): void {
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const refillRate = opts.maxRequests / opts.windowSeconds;
    const tokensToAdd = elapsed * refillRate;

    bucket.tokens = Math.min(opts.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  private extractIp(request: Request): string {
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }
}
