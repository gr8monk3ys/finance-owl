/**
 * Production-specific configuration for Railway deployment.
 *
 * Railway provides DATABASE_URL and REDIS_URL automatically
 * when you attach PostgreSQL and Redis plugins.
 */

export interface ProductionDatabaseConfig {
  connectionString: string;
  pool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  ssl: boolean | { rejectUnauthorized: boolean };
}

export interface ProductionRedisConfig {
  url: string;
  tls: boolean;
  maxRetriesPerRequest: number;
  retryDelayMs: number;
}

export interface ProductionConfig {
  database: ProductionDatabaseConfig;
  redis: ProductionRedisConfig;
  logging: {
    level: string;
  };
  rateLimiting: {
    ttl: number;
    limit: number;
  };
  cors: {
    origin: string;
    credentials: boolean;
  };
}

export function getProductionConfig(): ProductionConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required in production');
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN;
  if (!frontendUrl) {
    throw new Error('FRONTEND_URL or CORS_ORIGIN is required in production for CORS configuration');
  }

  // Railway PostgreSQL URLs use sslmode=require by default
  const requireSsl = databaseUrl.includes('sslmode=require') || process.env.DATABASE_SSL === 'true';

  // Railway Redis URLs may use rediss:// (TLS) protocol
  const redisTls = redisUrl.startsWith('rediss://');

  return {
    database: {
      connectionString: databaseUrl,
      pool: {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      },
      ssl: requireSsl ? { rejectUnauthorized: true } : false,
    },
    redis: {
      url: redisUrl,
      tls: redisTls,
      maxRetriesPerRequest: 3,
      retryDelayMs: 200,
    },
    logging: {
      level: process.env.LOG_LEVEL || 'warn',
    },
    rateLimiting: {
      // Slightly more permissive in production behind Railway's reverse proxy
      // since multiple users may share IPs through NAT
      ttl: 60_000,
      limit: 200,
    },
    cors: {
      origin: frontendUrl,
      credentials: true,
    },
  };
}

/**
 * Create a pg Pool config object suitable for Drizzle/node-postgres.
 * Use this when initializing the database connection in production.
 */
export function getPoolConfig() {
  const config = getProductionConfig();
  return {
    connectionString: config.database.connectionString,
    min: config.database.pool.min,
    max: config.database.pool.max,
    idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
    connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
    ssl: config.database.ssl,
  };
}
