import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Global cache module.
 *
 * Registered as `@Global()` so that any module in the application can inject
 * `CacheService` without adding `CacheModule` to its own `imports` array.
 *
 * Connection details are read from environment variables at runtime:
 *   - `REDIS_URL`  — full connection string (takes precedence)
 *   - `REDIS_HOST` — hostname (default `localhost`)
 *   - `REDIS_PORT` — port number (default `6379`)
 *
 * When neither `REDIS_URL` nor `REDIS_HOST` is set, or when the Redis server
 * is unreachable, the module falls back to a process-local in-memory Map.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
