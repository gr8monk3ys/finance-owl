import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import type { DrizzleDB } from '../../database/database.module';
import type { CacheService } from '../../common/cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDb(opts?: { shouldFail?: boolean }): DrizzleDB {
  return {
    execute: vi.fn().mockImplementation(() => {
      if (opts?.shouldFail) {
        return Promise.reject(new Error('Connection refused'));
      }
      return Promise.resolve([{ '?column?': 1 }]);
    }),
  } as unknown as DrizzleDB;
}

function createMockConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  const store: Record<string, string | undefined> = {
    NODE_ENV: 'development',
    npm_package_version: '0.1.0',
    ...overrides,
  };

  return {
    get: vi.fn((key: string) => store[key]),
  } as unknown as ConfigService;
}

function createMockCacheService(opts?: {
  usingFallback?: boolean;
  pingFails?: boolean;
}): CacheService {
  return {
    isUsingFallback: vi.fn().mockReturnValue(opts?.usingFallback ?? true),
    ping: vi.fn().mockImplementation(() => {
      if (opts?.pingFails) {
        return Promise.reject(new Error('Connection refused'));
      }
      return Promise.resolve('PONG');
    }),
  } as unknown as CacheService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthController', () => {
  let controller: HealthController;
  let db: DrizzleDB;
  let configService: ConfigService;
  let cacheService: CacheService;

  beforeEach(() => {
    db = createMockDb();
    configService = createMockConfig();
    cacheService = createMockCacheService();
    controller = new HealthController(db, configService, cacheService);
  });

  // ---------- GET /health ----------

  describe('GET /health (check)', () => {
    it('should return status ok with timestamp and uptime', () => {
      const result = controller.check();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return a valid ISO timestamp', () => {
      const result = controller.check();
      const parsed = new Date(result.timestamp);

      expect(parsed.toISOString()).toBe(result.timestamp);
    });
  });

  // ---------- GET /health/live ----------

  describe('GET /health/live (live)', () => {
    it('should return status ok with pid', () => {
      const result = controller.live();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('pid');
      expect(typeof result.pid).toBe('number');
      expect(result.pid).toBe(process.pid);
    });
  });

  // ---------- GET /health/ready ----------

  describe('GET /health/ready (ready)', () => {
    it('should return ok when database is connected', async () => {
      const result = await controller.ready();

      expect(result.status).toBe('ok');
      expect(result.services.database.status).toBe('ok');
      expect(result.services.database.responseTimeMs).toBeDefined();
      expect(typeof result.services.database.responseTimeMs).toBe('number');
    });

    it('should return unhealthy when database is down', async () => {
      const failingDb = createMockDb({ shouldFail: true });
      const failController = new HealthController(failingDb, configService, cacheService);

      await expect(failController.ready()).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 'unhealthy',
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: 'error',
              message: 'Database connection failed',
            }),
          }),
        }),
      });
    });

    it('should return redis unavailable when using in-memory fallback', async () => {
      const result = await controller.ready();

      expect(result.services.redis.status).toBe('unavailable');
      expect(result.services.redis.message).toBe(
        'Redis not connected (using in-memory fallback)',
      );
    });

    it('should return redis ok when ping succeeds', async () => {
      const connectedCache = createMockCacheService({ usingFallback: false });
      const redisController = new HealthController(db, configService, connectedCache);

      const result = await redisController.ready();

      expect(result.services.redis.status).toBe('ok');
      expect(result.services.redis.responseTimeMs).toBeDefined();
      expect(connectedCache.ping).toHaveBeenCalled();
    });

    it('should return redis error when ping fails', async () => {
      const failingCache = createMockCacheService({
        usingFallback: false,
        pingFails: true,
      });
      const failController = new HealthController(db, configService, failingCache);

      await expect(failController.ready()).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 'unhealthy',
          services: expect.objectContaining({
            redis: expect.objectContaining({
              status: 'error',
              message: 'Redis connection failed',
            }),
          }),
        }),
      });
    });
  });

  // ---------- GET /health/detailed ----------

  describe('GET /health/detailed (detailed)', () => {
    it('should return comprehensive system information', async () => {
      const result = await controller.detailed();

      // Overall status
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.version).toBe('0.1.0');

      // Services
      expect(result.services.database.status).toBe('ok');
      expect(result.services.database.responseTimeMs).toBeDefined();

      // Memory
      expect(result.memory).toBeDefined();
      expect(typeof result.memory.rss).toBe('number');
      expect(typeof result.memory.heapUsed).toBe('number');
      expect(typeof result.memory.heapTotal).toBe('number');
      expect(typeof result.memory.external).toBe('number');
      expect(typeof result.memory.rssMb).toBe('string');
      expect(typeof result.memory.heapUsedMb).toBe('string');
      expect(typeof result.memory.heapTotalMb).toBe('string');

      // Process info
      expect(result.process.pid).toBe(process.pid);
      expect(result.process.nodeVersion).toBe(process.version);
      expect(result.process.platform).toBe(process.platform);
      expect(result.process.environment).toBe('development');
    });

    it('should report unhealthy when database is down', async () => {
      const failingDb = createMockDb({ shouldFail: true });
      const failController = new HealthController(failingDb, configService, cacheService);

      const result = await failController.detailed();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database.status).toBe('error');
    });

    it('should report the configured version', async () => {
      const versionedConfig = createMockConfig({
        npm_package_version: '2.5.0',
      });
      const versionedController = new HealthController(db, versionedConfig, cacheService);

      const result = await versionedController.detailed();

      expect(result.version).toBe('2.5.0');
    });

    it('should report the configured environment', async () => {
      const prodConfig = createMockConfig({ NODE_ENV: 'production' });
      const prodController = new HealthController(db, prodConfig, cacheService);

      const result = await prodController.detailed();

      expect(result.process.environment).toBe('production');
    });

    it('should include memory values that are positive numbers', async () => {
      const result = await controller.detailed();

      expect(result.memory.rss).toBeGreaterThan(0);
      expect(result.memory.heapUsed).toBeGreaterThan(0);
      expect(result.memory.heapTotal).toBeGreaterThan(0);
      // heapUsed should be less than heapTotal
      expect(result.memory.heapUsed).toBeLessThanOrEqual(result.memory.heapTotal);
    });

    it('should format memory MB values as decimal strings', async () => {
      const result = await controller.detailed();

      // MB strings should be parseable as floating-point numbers
      expect(parseFloat(result.memory.rssMb)).toBeGreaterThan(0);
      expect(parseFloat(result.memory.heapUsedMb)).toBeGreaterThan(0);
      expect(parseFloat(result.memory.heapTotalMb)).toBeGreaterThan(0);
    });
  });
});
