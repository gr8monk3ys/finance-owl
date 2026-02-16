/**
 * Database Backup Script
 *
 * Creates a gzipped pg_dump backup of the FinanceOwl database.
 * Supports automatic rotation: keeps last 7 daily, 4 weekly, 3 monthly.
 *
 * Usage:
 *   npx tsx scripts/backup.ts                     # default ./backups/
 *   npx tsx scripts/backup.ts --output /tmp/bak    # custom directory
 *   pnpm db:backup
 */

import { execFileSync, execSync } from 'child_process';
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
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs(): { outputDir: string } {
  const args = process.argv.slice(2);
  let outputDir = path.resolve(__dirname, '../backups');

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
      outputDir = path.resolve(args[i + 1]);
      i++;
    }
  }

  return { outputDir };
}

// ---------------------------------------------------------------------------
// Format timestamp for filenames
// ---------------------------------------------------------------------------
function formatTimestamp(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d}_${h}-${mi}`;
}

// ---------------------------------------------------------------------------
// Parse date from backup filename
// ---------------------------------------------------------------------------
function parseDateFromFilename(filename: string): Date | null {
  const match = filename.match(/backup_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(
    parseInt(match[1]),
    parseInt(match[2]) - 1,
    parseInt(match[3]),
    parseInt(match[4]),
    parseInt(match[5]),
  );
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
// Rotation strategy
// ---------------------------------------------------------------------------
interface BackupFile {
  filename: string;
  fullPath: string;
  date: Date;
}

function rotateBackups(backupDir: string): void {
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('backup_') && f.endsWith('.sql.gz'))
    .map((filename): BackupFile | null => {
      const date = parseDateFromFilename(filename);
      if (!date) return null;
      return { filename, fullPath: path.join(backupDir, filename), date };
    })
    .filter((f): f is BackupFile => f !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime()); // newest first

  if (files.length === 0) return;

  const keepSet = new Set<string>();

  // Keep last 7 daily backups (one per day, most recent per day)
  const dailyBuckets = new Map<string, BackupFile>();
  for (const file of files) {
    const dayKey = file.date.toISOString().slice(0, 10);
    if (!dailyBuckets.has(dayKey)) {
      dailyBuckets.set(dayKey, file);
    }
  }
  const dailyKeys = Array.from(dailyBuckets.keys()).sort().reverse().slice(0, 7);
  for (const key of dailyKeys) {
    const file = dailyBuckets.get(key);
    if (file) keepSet.add(file.fullPath);
  }

  // Keep last 4 weekly backups (one per ISO week, most recent per week)
  const weeklyBuckets = new Map<string, BackupFile>();
  for (const file of files) {
    const d = file.date;
    const dayOfYear = Math.floor(
      (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000,
    );
    const weekKey = `${d.getFullYear()}-W${String(Math.ceil(dayOfYear / 7)).padStart(2, '0')}`;
    if (!weeklyBuckets.has(weekKey)) {
      weeklyBuckets.set(weekKey, file);
    }
  }
  const weeklyKeys = Array.from(weeklyBuckets.keys()).sort().reverse().slice(0, 4);
  for (const key of weeklyKeys) {
    const file = weeklyBuckets.get(key);
    if (file) keepSet.add(file.fullPath);
  }

  // Keep last 3 monthly backups (one per month, most recent per month)
  const monthlyBuckets = new Map<string, BackupFile>();
  for (const file of files) {
    const monthKey = file.date.toISOString().slice(0, 7);
    if (!monthlyBuckets.has(monthKey)) {
      monthlyBuckets.set(monthKey, file);
    }
  }
  const monthlyKeys = Array.from(monthlyBuckets.keys()).sort().reverse().slice(0, 3);
  for (const key of monthlyKeys) {
    const file = monthlyBuckets.get(key);
    if (file) keepSet.add(file.fullPath);
  }

  // Delete files not in keep set
  let deletedCount = 0;
  for (const file of files) {
    if (!keepSet.has(file.fullPath)) {
      fs.unlinkSync(file.fullPath);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    console.log(`  Rotation: removed ${deletedCount} old backup(s), kept ${keepSet.size}`);
  }
}

// ---------------------------------------------------------------------------
// Parse DATABASE_URL for pg_dump
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
// Main backup function
// ---------------------------------------------------------------------------
async function backup(): Promise<void> {
  const startTime = Date.now();
  console.log('FinanceOwl -- Database Backup');
  console.log('==========================================\n');

  const { outputDir } = parseArgs();
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/finance_owl';

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`  Created backup directory: ${outputDir}`);
  }

  const timestamp = formatTimestamp(new Date());
  const filename = `backup_${timestamp}.sql.gz`;
  const outputPath = path.join(outputDir, filename);
  const tempPath = path.join(outputDir, `${filename}.tmp`);

  const dbConfig = parseDatabaseUrl(databaseUrl);

  console.log(`  Database:  ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
  console.log(`  Output:    ${outputPath}`);
  console.log('');

  // Check if pg_dump is available
  try {
    execFileSync('which', ['pg_dump'], { stdio: 'pipe' });
  } catch {
    console.error('ERROR: pg_dump is not installed or not in PATH.');
    console.error('Install PostgreSQL client tools:');
    console.error('  macOS:  brew install libpq');
    console.error('  Ubuntu: sudo apt-get install postgresql-client');
    process.exit(1);
  }

  // Build pg_dump arguments
  const pgDumpArgs = [
    `--host=${dbConfig.host}`,
    `--port=${dbConfig.port}`,
    `--username=${dbConfig.user}`,
    '--format=plain',
    '--no-owner',
    '--no-acl',
    '--clean',
    '--if-exists',
    dbConfig.database,
  ];

  const env = {
    ...process.env,
    PGPASSWORD: dbConfig.password,
  };

  console.log('  Running pg_dump...');

  try {
    // Step 1: Run pg_dump to a temp SQL file, then gzip it.
    // We use execFileSync for pg_dump (safe, no shell injection) and pipe via
    // Node streams to gzip.
    const sqlDump = execFileSync('pg_dump', pgDumpArgs, {
      env,
      maxBuffer: 512 * 1024 * 1024, // 512 MB
      timeout: 300000, // 5 minute timeout
    });

    // Step 2: Gzip the output using zlib
    const { gzipSync } = await import('zlib');
    const compressed = gzipSync(sqlDump, { level: 6 });

    // Write atomically via temp file
    fs.writeFileSync(tempPath, compressed);
    fs.renameSync(tempPath, outputPath);
  } catch (err: any) {
    console.error('ERROR: pg_dump failed.');
    if (err.stderr) {
      console.error(err.stderr.toString());
    }
    // Clean up partial files
    for (const f of [tempPath, outputPath]) {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    }
    process.exit(1);
  }

  // Verify output
  if (!fs.existsSync(outputPath)) {
    console.error('ERROR: Backup file was not created.');
    process.exit(1);
  }

  const stats = fs.statSync(outputPath);
  if (stats.size === 0) {
    console.error('ERROR: Backup file is empty.');
    fs.unlinkSync(outputPath);
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`  Backup completed successfully.`);
  console.log(`  File size: ${formatSize(stats.size)}`);
  console.log(`  Duration:  ${elapsed}s`);

  // Rotate old backups
  console.log('\n  Checking rotation policy...');
  rotateBackups(outputDir);

  console.log('\n==========================================');
  console.log(`Backup saved: ${outputPath}`);
  console.log('==========================================\n');
}

backup().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
