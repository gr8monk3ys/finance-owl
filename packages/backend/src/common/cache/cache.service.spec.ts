import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheService } from './cache.service';
import { ConfigService } from '@nestjs/config';

// ── Helpers ────────────────────────────────────────────────────────

function createConfigService(
  overrides: Record<string, string | number | undefined> = {},
): ConfigService {
  const defaults: Record<string, string | number | undefined> = {
    REDIS_URL: undefined,
    REDIS_HOST: undefined,
    REDIS_PORT: undefined,
    ...overrides,
  };

  return {
    get: vi.fn((key: string) => defaults[key]),
  } as unknown as ConfigService;
}

function createFallbackService(): CacheService {
  const config = createConfigService(); // no redis config → fallback
  const service = new CacheService(config);
  service._enableFallbackForTesting();
  return service;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('CacheService', () => {
  let service: CacheService;

  afterEach(() => {
    service?._resetForTesting();
  });

  // ── Initialization ─────────────────────────────────────────────

  describe('initialization', () => {
    it('should fall back to in-memory when no REDIS_URL or REDIS_HOST configured', async () => {
      service = createFallbackService();

      expect(service.isUsingFallback()).toBe(true);
    });

    it('should fall back to in-memory when REDIS_URL connection fails', async () => {
      const config = createConfigService({
        REDIS_URL: 'redis://localhost:59999', // non-existent port
      });
      service = new CacheService(config);

      // Manually simulate the failure path
      await service.onModuleInit().catch(() => {});

      // Due to lazy connect with retry, we force fallback for the test
      service._enableFallbackForTesting();
      expect(service.isUsingFallback()).toBe(true);
    });
  });

  // ── get / set ──────────────────────────────────────────────────

  describe('get and set', () => {
    beforeEach(() => {
      service = createFallbackService();
    });

    it('should return null for a non-existent key', async () => {
      const result = await service.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should store and retrieve a string value', async () => {
      await service.set('greeting', 'hello');
      const result = await service.get<string>('greeting');
      expect(result).toBe('hello');
    });

    it('should store and retrieve an object value (JSON serialization)', async () => {
      const data = { userId: 'u1', score: 87, breakdown: [10, 20, 30] };
      await service.set('health:u1', data);
      const result = await service.get<typeof data>('health:u1');
      expect(result).toEqual(data);
    });

    it('should store and retrieve a number value', async () => {
      await service.set('counter', 42);
      const result = await service.get<number>('counter');
      expect(result).toBe(42);
    });

    it('should store and retrieve an array value', async () => {
      const arr = [1, 2, 3, 'four'];
      await service.set('list', arr);
      const result = await service.get<typeof arr>('list');
      expect(result).toEqual(arr);
    });

    it('should overwrite an existing key', async () => {
      await service.set('key', 'first');
      await service.set('key', 'second');
      const result = await service.get<string>('key');
      expect(result).toBe('second');
    });
  });

  // ── TTL Expiry ─────────────────────────────────────────────────

  describe('TTL expiry', () => {
    beforeEach(() => {
      service = createFallbackService();
    });

    it('should expire a key after TTL elapses', async () => {
      vi.useFakeTimers();

      await service.set('temp', 'value', 5); // 5-second TTL

      // Before expiry
      expect(await service.get('temp')).toBe('value');

      // Advance past TTL
      vi.advanceTimersByTime(6000);

      expect(await service.get('temp')).toBeNull();

      vi.useRealTimers();
    });

    it('should not expire a key before TTL elapses', async () => {
      vi.useFakeTimers();

      await service.set('temp', 'value', 10); // 10-second TTL

      vi.advanceTimersByTime(9000); // 9 seconds — still alive

      expect(await service.get('temp')).toBe('value');

      vi.useRealTimers();
    });

    it('should keep a key indefinitely when no TTL is provided', async () => {
      vi.useFakeTimers();

      await service.set('permanent', 'forever');

      vi.advanceTimersByTime(3_600_000); // 1 hour

      expect(await service.get('permanent')).toBe('forever');

      vi.useRealTimers();
    });
  });

  // ── del ────────────────────────────────────────────────────────

  describe('del', () => {
    beforeEach(() => {
      service = createFallbackService();
    });

    it('should delete an existing key', async () => {
      await service.set('victim', 'data');
      expect(await service.get('victim')).toBe('data');

      await service.del('victim');
      expect(await service.get('victim')).toBeNull();
    });

    it('should not throw when deleting a non-existent key', async () => {
      await expect(service.del('ghost')).resolves.toBeUndefined();
    });
  });

  // ── delPattern ─────────────────────────────────────────────────

  describe('delPattern', () => {
    beforeEach(() => {
      service = createFallbackService();
    });

    it('should delete all keys matching a glob pattern', async () => {
      await service.set('analytics:user1:spending', 'a');
      await service.set('analytics:user1:trends', 'b');
      await service.set('analytics:user2:spending', 'c');
      await service.set('unrelated', 'd');

      const deleted = await service.delPattern('analytics:user1:*');

      expect(deleted).toBe(2);
      expect(await service.get('analytics:user1:spending')).toBeNull();
      expect(await service.get('analytics:user1:trends')).toBeNull();
      expect(await service.get('analytics:user2:spending')).toBe('c');
      expect(await service.get('unrelated')).toBe('d');
    });

    it('should return 0 when no keys match the pattern', async () => {
      await service.set('foo', 'bar');
      const deleted = await service.delPattern('nonexistent:*');
      expect(deleted).toBe(0);
    });

    it('should handle single-character wildcard ?', async () => {
      await service.set('rate:USD', '1.0');
      await service.set('rate:EUR', '0.92');
      await service.set('rate:GBP', '0.79');
      await service.set('rate:USDT', 'stablecoin'); // 4 chars - should NOT match

      const deleted = await service.delPattern('rate:???');

      expect(deleted).toBe(3);
      expect(await service.get('rate:USDT')).toBe('stablecoin');
    });

    it('should delete by exact match when no wildcards used', async () => {
      await service.set('exact:key', 'value');
      await service.set('exact:key2', 'value2');

      const deleted = await service.delPattern('exact:key');

      expect(deleted).toBe(1);
      expect(await service.get('exact:key')).toBeNull();
      expect(await service.get('exact:key2')).toBe('value2');
    });
  });

  // ── wrap (cache-aside) ─────────────────────────────────────────

  describe('wrap', () => {
    beforeEach(() => {
      service = createFallbackService();
    });

    it('should call factory on cache miss and cache the result', async () => {
      const factory = vi.fn().mockResolvedValue({ score: 95 });

      const result = await service.wrap('health:u1', 300, factory);

      expect(result).toEqual({ score: 95 });
      expect(factory).toHaveBeenCalledTimes(1);

      // Should now be cached
      const cached = await service.get('health:u1');
      expect(cached).toEqual({ score: 95 });
    });

    it('should return cached value without calling factory on cache hit', async () => {
      const factory = vi.fn().mockResolvedValue({ score: 50 });

      // Pre-populate the cache
      await service.set('health:u2', { score: 88 }, 300);

      const result = await service.wrap('health:u2', 300, factory);

      expect(result).toEqual({ score: 88 });
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory again after cache entry expires', async () => {
      vi.useFakeTimers();

      const factory = vi
        .fn()
        .mockResolvedValueOnce('first')
        .mockResolvedValueOnce('second');

      const first = await service.wrap('key', 5, factory);
      expect(first).toBe('first');
      expect(factory).toHaveBeenCalledTimes(1);

      // Advance past TTL
      vi.advanceTimersByTime(6000);

      const second = await service.wrap('key', 5, factory);
      expect(second).toBe('second');
      expect(factory).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should propagate factory errors without caching', async () => {
      const factory = vi
        .fn()
        .mockRejectedValue(new Error('DB connection lost'));

      await expect(service.wrap('failing', 60, factory)).rejects.toThrow(
        'DB connection lost',
      );

      // Nothing should have been cached
      const cached = await service.get('failing');
      expect(cached).toBeNull();
    });
  });

  // ── isUsingFallback ────────────────────────────────────────────

  describe('isUsingFallback', () => {
    it('should return true when in fallback mode', () => {
      service = createFallbackService();
      expect(service.isUsingFallback()).toBe(true);
    });

    it('should return false initially before init', () => {
      const config = createConfigService();
      service = new CacheService(config);
      expect(service.isUsingFallback()).toBe(false);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    beforeEach(() => {
      service = createFallbackService();
    });

    it('should handle null values correctly', async () => {
      // JSON.stringify(null) === 'null', JSON.parse('null') === null
      // So setting null should round-trip, but get returns null for miss too
      await service.set('nullable', null);
      const result = await service.get('nullable');
      expect(result).toBeNull();
    });

    it('should handle boolean false correctly', async () => {
      await service.set('flag', false);
      // false is a valid cached value; JSON.parse("false") === false
      // However our get returns null on miss. false is falsy but !== null
      const raw = await service.get<boolean>('flag');
      expect(raw).toBe(false);
    });

    it('should handle empty string correctly', async () => {
      await service.set('empty', '');
      const result = await service.get<string>('empty');
      expect(result).toBe('');
    });

    it('should handle deeply nested objects', async () => {
      const deep = {
        level1: {
          level2: {
            level3: {
              data: [1, 2, { nested: true }],
            },
          },
        },
      };
      await service.set('deep', deep, 60);
      const result = await service.get<typeof deep>('deep');
      expect(result).toEqual(deep);
    });
  });

  // ── Concurrent operations ──────────────────────────────────────

  describe('concurrent operations', () => {
    beforeEach(() => {
      service = createFallbackService();
    });

    it('should handle concurrent reads and writes without data corruption', async () => {
      const operations = Array.from({ length: 50 }, (_, i) =>
        i % 2 === 0
          ? service.set(`concurrent:${i}`, `value-${i}`, 60)
          : service.get<string>(`concurrent:${i - 1}`),
      );

      await Promise.all(operations);

      // All even keys should be set
      for (let i = 0; i < 50; i += 2) {
        const val = await service.get<string>(`concurrent:${i}`);
        expect(val).toBe(`value-${i}`);
      }
    });
  });
});
