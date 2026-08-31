import { Module, Global, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';
import { getPoolConfig } from '../config/production.config';

export const DATABASE_TOKEN = 'DATABASE';
export const DATABASE_POOL_TOKEN = 'DATABASE_POOL';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL_TOKEN,
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get<string>('NODE_ENV') === 'production';

        let poolConfig: PoolConfig;

        if (isProduction) {
          poolConfig = getPoolConfig();
        } else {
          const connectionString =
            configService.get<string>('DATABASE_URL') ||
            'postgresql://postgres:postgres@localhost:5432/finance_owl';
          poolConfig = { connectionString };
        }

        return new Pool(poolConfig);
      },
      inject: [ConfigService],
    },
    {
      provide: DATABASE_TOKEN,
      useFactory: async (pool: Pool, configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const isProduction = configService.get<string>('NODE_ENV') === 'production';

        if (isProduction) {
          const poolConfig = getPoolConfig();
          logger.log(
            `Database pool: min=${poolConfig.min}, max=${poolConfig.max}, ssl=${!!poolConfig.ssl}`,
          );
        }

        const db = drizzle(pool, { schema });

        const migrationsPath = path.resolve(__dirname, '../../drizzle');
        if (fs.existsSync(migrationsPath)) {
          if (isProduction) {
            try {
              await migrate(db, { migrationsFolder: migrationsPath });
              logger.log('Database migrations applied successfully');
            } catch (error) {
              logger.error('Failed to apply migrations', error);
              throw error;
            }
          } else {
            logger.log(
              'Skipping automatic database migrations in development. Run `pnpm --filter @finance-owl/backend db:migrate` when schema changes.',
            );
          }
        } else {
          logger.warn('No migrations folder found — run `pnpm db:generate` then `pnpm db:migrate`');
        }

        logger.log('PostgreSQL database initialized');
        return db;
      },
      inject: [DATABASE_POOL_TOKEN, ConfigService],
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger('DatabaseModule');

  constructor(@Inject(DATABASE_POOL_TOKEN) private readonly pool: Pool) {}

  async onModuleDestroy() {
    this.logger.log('Closing database pool connections...');
    await this.pool.end();
    this.logger.log('Database pool connections closed');
  }
}

export type DrizzleDB = NodePgDatabase<typeof schema>;
