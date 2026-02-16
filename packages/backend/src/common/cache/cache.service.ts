import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin abstraction over Redis (or an in-memory Map fallback) that exposes a
 * typed, JSON-aware cache with TTL, pattern deletion, and a cache-aside
 * `wrap()` helper.
 *
 * When Redis is unreachable at startup (or the connection drops later) the
 * service transparently falls back to a process-local Map.  This keeps the
 * rest of the application working in local-development setups that do not
 * run a Redis instance.
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);

  /** Active Redis client, or `null` when running in fallback mode. */
  private redis: Redis | null = null;

  /** Process-local fallback store:  key -> { value, expiresAt } */
  private readonly memoryStore = new Map<
    string,
    { value: string; expiresAt: number | null }
  >();

  /** Interval handle for the in-memory TTL sweeper. */
  private memorySweepInterval: ReturnType<typeof setInterval> | null = null;

  /** Whether we are using the in-memory fallback. */
  private usingFallback = false;

  constructor(private readonly config: ConfigService) {}

  // ── Lifecycle ─────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.get<string>('REDIS_URL');
    const redisHost = this.config.get<string>('REDIS_HOST');
    const redisPort = this.config.get<number>('REDIS_PORT');

    if (!redisUrl && !redisHost) {
      this.logger.warn(
        'No REDIS_URL or REDIS_HOST configured — using in-memory cache fallback',
      );
      this.enableFallback();
      return;
    }

    try {
      this.redis = redisUrl
        ? new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
          })
        : new Redis({
            host: redisHost!,
            port: redisPort ?? 6379,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
          });

      this.redis.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
        if (!this.usingFallback) {
          this.logger.warn('Switching to in-memory cache fallback');
          this.enableFallback();
        }
      });

      await this.redis.connect();
      this.logger.log('Redis cache connected');
    } catch (err) {
      this.logger.warn(
        `Failed to connect to Redis: ${(err as Error).message} — using in-memory cache fallback`,
      );
      this.redis?.disconnect();
      this.redis = null;
      this.enableFallback();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.memorySweepInterval) {
      clearInterval(this.memorySweepInterval);
      this.memorySweepInterval = null;
    }
    if (this.redis) {
      await this.redis.quit().catch(() => {});
      this.redis = null;
    }
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Retrieve a cached value.  Returns `null` on cache miss.
   * The raw JSON string is automatically deserialized.
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.usingFallback) {
      return this.memoryGet<T>(key);
    }

    try {
      const raw = await this.redis!.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.error(`Cache get error [${key}]: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Set a value in the cache.  `ttlSeconds` is optional — when omitted the
   * entry never expires.
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.usingFallback) {
      this.memorySet(key, serialized, ttlSeconds);
      return;
    }

    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis!.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.redis!.set(key, serialized);
      }
    } catch (err) {
      this.logger.error(`Cache set error [${key}]: ${(err as Error).message}`);
    }
  }

  /**
   * Delete a single cache key.
   */
  async del(key: string): Promise<void> {
    if (this.usingFallback) {
      this.memoryStore.delete(key);
      return;
    }

    try {
      await this.redis!.del(key);
    } catch (err) {
      this.logger.error(`Cache del error [${key}]: ${(err as Error).message}`);
    }
  }

  /**
   * Delete all keys matching a glob-style pattern (e.g. `user:123:*`).
   *
   * For Redis this uses SCAN to avoid blocking.  For the in-memory fallback
   * it iterates the Map and matches using a simple glob-to-regex converter.
   */
  async delPattern(pattern: string): Promise<number> {
    if (this.usingFallback) {
      return this.memoryDelPattern(pattern);
    }

    try {
      let deleted = 0;
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.redis!.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          deleted += await this.redis!.del(...keys);
        }
      } while (cursor !== '0');

      return deleted;
    } catch (err) {
      this.logger.error(
        `Cache delPattern error [${pattern}]: ${(err as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Cache-aside (read-through) pattern.
   *
   * If the key exists in cache, return it.  Otherwise call `factory()` to
   * compute the value, cache it with the given TTL, and return it.
   */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Expose whether the service is currently running in fallback mode.
   * Useful for health checks and diagnostics.
   */
  isUsingFallback(): boolean {
    return this.usingFallback;
  }

  // ── In-memory fallback internals ──────────────────────────────────

  private enableFallback(): void {
    this.usingFallback = true;

    // Sweep expired entries every 30 seconds
    if (!this.memorySweepInterval) {
      this.memorySweepInterval = setInterval(
        () => this.memorySweep(),
        30_000,
      );
      // Allow the Node process to exit even if the interval is still active
      if (this.memorySweepInterval.unref) {
        this.memorySweepInterval.unref();
      }
    }
  }

  private memoryGet<T>(key: string): T | null {
    const entry = this.memoryStore.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }

    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  private memorySet(
    key: string,
    serialized: string,
    ttlSeconds?: number,
  ): void {
    const expiresAt =
      ttlSeconds && ttlSeconds > 0
        ? Date.now() + ttlSeconds * 1000
        : null;

    this.memoryStore.set(key, { value: serialized, expiresAt });
  }

  private memoryDelPattern(pattern: string): number {
    const regex = globToRegex(pattern);
    let deleted = 0;

    for (const key of this.memoryStore.keys()) {
      if (regex.test(key)) {
        this.memoryStore.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  private memorySweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.memoryStore.delete(key);
      }
    }
  }

  // ── Test helpers (package-private) ────────────────────────────────

  /** @internal — reset for test isolation */
  _resetForTesting(): void {
    this.memoryStore.clear();
    this.usingFallback = false;
    if (this.memorySweepInterval) {
      clearInterval(this.memorySweepInterval);
      this.memorySweepInterval = null;
    }
  }

  /** @internal — force fallback mode for tests */
  _enableFallbackForTesting(): void {
    this.usingFallback = true;
  }

  /** @internal — expose store size for assertions */
  _getStoreSize(): number {
    return this.memoryStore.size;
  }
}

// ── Utility ────────────────────────────────────────────────────────

/**
 * Convert a simple glob pattern (supporting `*` and `?`) into a RegExp.
 * Used only by the in-memory fallback for `delPattern`.
 */
function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`);
}
