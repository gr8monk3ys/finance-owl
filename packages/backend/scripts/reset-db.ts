/**
 * Database Reset Script (Development Only)
 *
 * Drops all tables, runs migrations via drizzle-kit push, and seeds the database.
 * Useful for quickly resetting to a clean state during development.
 *
 * Usage:
 *   npx tsx scripts/reset-db.ts
 *   pnpm db:reset
 *
 * WARNING: This will destroy all data in the database. Do not use in production.
 */

import { execFileSync } from 'child_process';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Load .env if present
// ---------------------------------------------------------------------------
function loadEnv(): void {
  const envPath = path.resolve(__dirname, '../../../.env');
  if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, 'utf-8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Safety check
// ---------------------------------------------------------------------------
function checkEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    console.error('ERROR: Cannot reset database in production environment.');
    console.error('Set NODE_ENV to "development" or "test" to use this script.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main reset function
// ---------------------------------------------------------------------------
async function reset(): Promise<void> {
  const startTime = Date.now();
  console.log('FinanceOwl -- Database Reset');
  console.log('==========================================\n');

  checkEnvironment();

  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/finance_owl';

  // Step 1: Drop all tables
  console.log('[1/3] Dropping all tables...');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Drop the entire public schema and recreate it - cleanest approach
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT ALL ON SCHEMA public TO public');

    // Also drop drizzle's internal schema if it exists
    await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');

    console.log('  All tables dropped.');
  } catch (err: any) {
    console.error('ERROR: Failed to drop tables.');
    console.error(err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }

  // Step 2: Run migrations (drizzle-kit push)
  console.log('[2/3] Running migrations (drizzle-kit push)...');
  const backendDir = path.resolve(__dirname, '..');
  try {
    execFileSync('npx', ['drizzle-kit', 'push', '--force'], {
      cwd: backendDir,
      stdio: 'inherit',
      env: process.env,
      timeout: 60000,
    });
    console.log('  Migrations applied.');
  } catch (err: any) {
    console.error('ERROR: Migration failed.');
    process.exit(1);
  }

  // Step 3: Run seed
  console.log('[3/3] Seeding database...');
  try {
    execFileSync('npx', ['tsx', path.resolve(__dirname, 'seed.ts')], {
      cwd: backendDir,
      stdio: 'inherit',
      env: process.env,
      timeout: 120000,
    });
  } catch (err: any) {
    console.error('ERROR: Seed failed.');
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('==========================================');
  console.log(`Database reset completed in ${elapsed}s`);
  console.log('==========================================\n');
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
