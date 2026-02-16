/**
 * Database Restore Script
 *
 * Restores the FinanceOwl database from a backup file (.sql or .sql.gz).
 * Drops and recreates the public schema, restores data, then runs migrations.
 *
 * Usage:
 *   npx tsx scripts/restore.ts ./backups/backup_2025-01-15_10-30.sql.gz
 *   npx tsx scripts/restore.ts --force ./backups/backup_2025-01-15_10-30.sql.gz
 *   pnpm db:restore -- ./backups/backup_2025-01-15_10-30.sql.gz
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

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
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs(): { backupFile: string; force: boolean } {
  const args = process.argv.slice(2);
  let backupFile = '';
  let force = false;

  for (const arg of args) {
    if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (!arg.startsWith('-')) {
      backupFile = path.resolve(arg);
    }
  }

  return { backupFile, force };
}

// ---------------------------------------------------------------------------
// Prompt for confirmation
// ---------------------------------------------------------------------------
async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// ---------------------------------------------------------------------------
// Format file size
// ---------------------------------------------------------------------------
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Parse DATABASE_URL
// ---------------------------------------------------------------------------
function parseDatabaseUrl(dbUrl: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  const parsed = new URL(dbUrl);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
  };
}

// ---------------------------------------------------------------------------
// Main restore function
// ---------------------------------------------------------------------------
async function restore(): Promise<void> {
  const startTime = Date.now();
  console.log('FinanceOwl -- Database Restore');
  console.log('==========================================\n');

  const { backupFile, force } = parseArgs();

  // Validate backup file argument
  if (!backupFile) {
    console.error('ERROR: No backup file specified.');
    console.error('');
    console.error('Usage:');
    console.error('  npx tsx scripts/restore.ts <backup-file>');
    console.error('  npx tsx scripts/restore.ts --force <backup-file>');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx scripts/restore.ts ./backups/backup_2025-01-15_10-30.sql.gz');
    console.error('  npx tsx scripts/restore.ts --force ./backups/backup_2025-01-15_10-30.sql');
    process.exit(1);
  }

  // Validate file exists
  if (!fs.existsSync(backupFile)) {
    console.error(`ERROR: Backup file not found: ${backupFile}`);
    process.exit(1);
  }

  // Validate file extension
  const ext = backupFile.endsWith('.sql.gz') ? '.sql.gz' : path.extname(backupFile);
  if (ext !== '.sql' && ext !== '.sql.gz') {
    console.error(`ERROR: Invalid file type "${ext}". Expected .sql or .sql.gz`);
    process.exit(1);
  }

  const stats = fs.statSync(backupFile);
  const isGzipped = ext === '.sql.gz';

  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/finance_owl';

  const dbConfig = parseDatabaseUrl(databaseUrl);

  console.log(`  Backup file: ${backupFile}`);
  console.log(`  File size:   ${formatSize(stats.size)}`);
  console.log(`  Compressed:  ${isGzipped ? 'yes' : 'no'}`);
  console.log(`  Database:    ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
  console.log('');

  // Confirm unless --force
  if (!force) {
    console.log('WARNING: This will DROP ALL DATA in the target database and replace');
    console.log('it with the contents of the backup file.');
    console.log('');
    const confirmed = await confirm('Are you sure you want to continue?');
    if (!confirmed) {
      console.log('Restore cancelled.');
      process.exit(0);
    }
    console.log('');
  }

  // Check if psql is available
  try {
    execFileSync('which', ['psql'], { stdio: 'pipe' });
  } catch {
    console.error('ERROR: psql is not installed or not in PATH.');
    console.error('Install PostgreSQL client tools:');
    console.error('  macOS:  brew install libpq');
    console.error('  Ubuntu: sudo apt-get install postgresql-client');
    process.exit(1);
  }

  const env = {
    ...process.env,
    PGPASSWORD: dbConfig.password,
  };

  const psqlBaseArgs = [
    `--host=${dbConfig.host}`,
    `--port=${dbConfig.port}`,
    `--username=${dbConfig.user}`,
    '--no-password',
    dbConfig.database,
  ];

  // Step 1: Drop and recreate public schema
  console.log('  [1/3] Dropping and recreating schema...');
  try {
    execFileSync('psql', [
      ...psqlBaseArgs,
      '--command',
      'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;',
    ], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });
    console.log('        Schema recreated.');
  } catch (err: any) {
    console.error('ERROR: Failed to drop/recreate schema.');
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }

  // Step 2: Restore from backup
  console.log('  [2/3] Restoring from backup...');
  try {
    let sqlData: Buffer;

    if (isGzipped) {
      const { gunzipSync } = await import('zlib');
      const compressed = fs.readFileSync(backupFile);
      sqlData = gunzipSync(compressed);
    } else {
      sqlData = fs.readFileSync(backupFile);
    }

    execFileSync('psql', [
      ...psqlBaseArgs,
      '--set', 'ON_ERROR_STOP=off',
    ], {
      env,
      input: sqlData,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 512 * 1024 * 1024,
      timeout: 300000,
    });
    console.log('        Backup restored.');
  } catch (err: any) {
    // psql may return non-zero even with warnings; check if it's a real failure
    const stderr = err.stderr ? err.stderr.toString() : '';
    if (stderr.includes('FATAL') || stderr.includes('could not connect')) {
      console.error('ERROR: Failed to restore backup.');
      console.error(stderr);
      process.exit(1);
    }
    // Non-fatal warnings are expected (e.g., "role does not exist")
    console.log('        Backup restored (with non-fatal warnings).');
  }

  // Step 3: Run migrations
  console.log('  [3/3] Running migrations...');
  try {
    execFileSync('npx', ['drizzle-kit', 'push', '--force'], {
      env,
      cwd: path.resolve(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    });
    console.log('        Migrations applied.');
  } catch (err: any) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    // drizzle-kit push may succeed with output on stderr
    if (err.status !== 0 && !stderr.includes('No changes')) {
      console.warn('  WARNING: Migration step completed with warnings.');
      if (stderr) console.warn(`  ${stderr.slice(0, 500)}`);
    } else {
      console.log('        Migrations applied (no changes needed).');
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n==========================================');
  console.log(`Restore completed in ${elapsed}s`);
  console.log('==========================================\n');
}

restore().catch((err) => {
  console.error('Restore failed:', err);
  process.exit(1);
});
