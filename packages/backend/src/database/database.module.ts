import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';
import { getPoolConfig } from '../config/production.config';

export const DATABASE_TOKEN = 'DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';

        let poolConfig: PoolConfig;

        if (isProduction) {
          poolConfig = getPoolConfig();
          logger.log(
            `Database pool: min=${poolConfig.min}, max=${poolConfig.max}, ssl=${!!poolConfig.ssl}`,
          );
        } else {
          const connectionString =
            configService.get<string>('DATABASE_URL') ||
            'postgresql://postgres:postgres@localhost:5432/finance_owl';
          poolConfig = { connectionString };
        }

        const pool = new Pool(poolConfig);
        const db = drizzle(pool, { schema });

        const migrationsPath = path.resolve(__dirname, '../../drizzle');
        if (fs.existsSync(migrationsPath)) {
          try {
            await migrate(db, { migrationsFolder: migrationsPath });
            logger.log('Database migrations applied successfully');
          } catch (error) {
            logger.error('Failed to apply migrations', error);
            throw error;
          }
        } else {
          logger.warn(
            'No migrations folder found — run `pnpm db:generate` then `pnpm db:migrate`',
          );
        }

        logger.log('PostgreSQL database initialized');
        return db;
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule {}

export type DrizzleDB = NodePgDatabase<typeof schema>;
