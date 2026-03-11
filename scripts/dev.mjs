import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rootEnvPath = path.join(rootDir, '.env.local');
const backendEnvPath = path.join(rootDir, 'packages/backend/.env.local');
const frontendEnvPath = path.join(rootDir, 'packages/frontend/.env.local');
const mobileEnvPath = path.join(rootDir, 'packages/mobile/.env');

const backendEnvOrder = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRY',
  'JWT_REFRESH_EXPIRY',
  'ENCRYPTION_KEY',
  'ENCRYPTION_MASTER_SECRET',
  'REDIS_URL',
  'FRONTEND_URL',
  'STRIPE_SECRET_KEY',
];

const mobileEnvOrder = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_WEB_URL',
];

const frontendEnvOrder = ['API_URL'];
const composeArgs = ['compose', '-f', 'docker-compose.dev.yml'];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return new Map();
  }

  const env = new Map();
  const content = readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    env.set(key, value);
  }

  return env;
}

function ensureEnvFile(filePath, orderedKeys, resolvedValues) {
  mkdirSync(path.dirname(filePath), { recursive: true });

  if (!existsSync(filePath)) {
    const contents =
      orderedKeys.map((key) => `${key}=${resolvedValues[key]}`).join('\n') + '\n';
    writeFileSync(filePath, contents, 'utf8');
    return { created: true, appendedKeys: [] };
  }

  const currentValues = parseEnvFile(filePath);
  const missingKeys = orderedKeys.filter((key) => !currentValues.has(key));

  if (missingKeys.length > 0) {
    const appended =
      '\n' + missingKeys.map((key) => `${key}=${resolvedValues[key]}`).join('\n') + '\n';
    appendFileSync(filePath, appended, 'utf8');
  }

  return { created: false, appendedKeys: missingKeys };
}

function upsertEnvFile(filePath, orderedKeys, resolvedValues) {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const existing = parseEnvFile(filePath);
  for (const key of orderedKeys) {
    existing.set(key, resolvedValues[key]);
  }

  const orderedEntries = [];
  const seen = new Set();

  for (const key of orderedKeys) {
    orderedEntries.push([key, existing.get(key)]);
    seen.add(key);
  }

  for (const [key, value] of existing.entries()) {
    if (!seen.has(key)) {
      orderedEntries.push([key, value]);
    }
  }

  const contents = orderedEntries.map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  writeFileSync(filePath, contents, 'utf8');
}

function resolveBackendEnvValues() {
  const existingValues = new Map([
    ...parseEnvFile(backendEnvPath),
    ...parseEnvFile(rootEnvPath),
  ]);

  return {
    DATABASE_URL:
      existingValues.get('DATABASE_URL') ||
      'postgresql://postgres:postgres@localhost:5432/finance_owl',
    JWT_SECRET:
      existingValues.get('JWT_SECRET') || randomBytes(48).toString('base64'),
    JWT_REFRESH_SECRET:
      existingValues.get('JWT_REFRESH_SECRET') || randomBytes(48).toString('base64'),
    JWT_ACCESS_EXPIRY: existingValues.get('JWT_ACCESS_EXPIRY') || '15m',
    JWT_REFRESH_EXPIRY: existingValues.get('JWT_REFRESH_EXPIRY') || '7d',
    ENCRYPTION_KEY:
      existingValues.get('ENCRYPTION_KEY') || randomBytes(32).toString('hex'),
    ENCRYPTION_MASTER_SECRET:
      existingValues.get('ENCRYPTION_MASTER_SECRET') ||
      randomBytes(48).toString('base64'),
    REDIS_URL: existingValues.get('REDIS_URL') || 'redis://localhost:6379',
    FRONTEND_URL: existingValues.get('FRONTEND_URL') || 'http://localhost:3000',
    STRIPE_SECRET_KEY:
      existingValues.get('STRIPE_SECRET_KEY') || 'sk_test_placeholder',
  };
}

function parsePortFromUrl(value, fallbackPort) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    return parsed.port ? Number(parsed.port) : fallbackPort;
  } catch {
    return null;
  }
}

function resolveMobileEnvValues() {
  const existingValues = parseEnvFile(mobileEnvPath);

  return {
    EXPO_PUBLIC_API_URL:
      existingValues.get('EXPO_PUBLIC_API_URL') || 'http://localhost:4000/api',
    EXPO_PUBLIC_WEB_URL:
      existingValues.get('EXPO_PUBLIC_WEB_URL') || 'http://localhost:3000',
  };
}

function runStep(command, args, description, envOverrides = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  if (result.error) {
    throw new Error(`${description} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`${description} failed with exit code ${result.status}`);
  }
}

function runCommand(command, args) {
  return spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: process.env,
  });
}

function findListeningProcess(port) {
  const result = runCommand('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);

  if (result.status === 1) {
    return '';
  }

  if (result.error) {
    return '';
  }

  return result.stdout.trim();
}

function assertPortAvailable(port, label) {
  const details = findListeningProcess(port);
  if (!details) {
    return;
  }

  throw new Error(
    `${label} port ${port} is already in use.\n` +
      `Stop the existing process, then run \`pnpm dev\` again.\n\n${details}`,
  );
}

async function waitForPort(port, label, timeoutMs = 20_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const isReady = await new Promise((resolve) => {
      const socket = net.connect({ host: '127.0.0.1', port });

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
    });

    if (isReady) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${label} did not become available on port ${port} in time.`);
}

function logEnvResult(filePath, result) {
  if (result.created) {
    console.log(`Created ${path.relative(rootDir, filePath)}`);
    return;
  }

  if (result.appendedKeys.length > 0) {
    console.log(
      `Updated ${path.relative(rootDir, filePath)} with missing keys: ${result.appendedKeys.join(', ')}`,
    );
  }
}

function getListeningProcessDetails(port) {
  return findListeningProcess(port);
}

function isPortTaken(port) {
  return Boolean(getListeningProcessDetails(port));
}

function findAvailablePort(startPort) {
  let port = startPort;
  while (isPortTaken(port)) {
    port += 1;
  }
  return port;
}

function getComposePublishedPort(service, internalPort) {
  const result = runCommand('docker', [...composeArgs, 'port', service, String(internalPort)]);

  if (result.status !== 0) {
    return null;
  }

  const output = result.stdout.trim();
  if (!output) {
    return null;
  }

  const match = output.match(/:(\d+)\s*$/m);
  return match ? Number(match[1]) : null;
}

function resolveServicePort({ service, internalPort, defaultPort, preferredPort }) {
  const composePort = getComposePublishedPort(service, internalPort);
  if (composePort) {
    return composePort;
  }

  if (preferredPort && preferredPort !== defaultPort) {
    return preferredPort;
  }

  if (preferredPort === defaultPort && !isPortTaken(defaultPort)) {
    return defaultPort;
  }

  return findAvailablePort(defaultPort);
}

async function main() {
  const setupOnly = process.argv.includes('--setup-only');
  const existingBackendValues = new Map([
    ...parseEnvFile(backendEnvPath),
    ...parseEnvFile(rootEnvPath),
  ]);

  const frontendPort = findAvailablePort(3000);
  const backendPort = findAvailablePort(4000);
  const postgresPort = resolveServicePort({
    service: 'postgres',
    internalPort: 5432,
    defaultPort: 5432,
    preferredPort: parsePortFromUrl(existingBackendValues.get('DATABASE_URL'), 5432),
  });
  const redisPort = resolveServicePort({
    service: 'redis',
    internalPort: 6379,
    defaultPort: 6379,
    preferredPort: parsePortFromUrl(existingBackendValues.get('REDIS_URL'), 6379),
  });
  const frontendUrl = `http://localhost:${frontendPort}`;
  const backendUrl = `http://localhost:${backendPort}`;

  const backendEnvValues = resolveBackendEnvValues();
  backendEnvValues.DATABASE_URL =
    `postgresql://postgres:postgres@localhost:${postgresPort}/finance_owl`;
  backendEnvValues.REDIS_URL = `redis://localhost:${redisPort}`;
  backendEnvValues.FRONTEND_URL = frontendUrl;

  const mobileEnvValues = {
    ...resolveMobileEnvValues(),
    EXPO_PUBLIC_API_URL: `${backendUrl}/api`,
    EXPO_PUBLIC_WEB_URL: frontendUrl,
  };

  const frontendEnvValues = {
    API_URL: backendUrl,
  };

  upsertEnvFile(rootEnvPath, backendEnvOrder, backendEnvValues);
  upsertEnvFile(backendEnvPath, backendEnvOrder, backendEnvValues);
  upsertEnvFile(frontendEnvPath, frontendEnvOrder, frontendEnvValues);
  upsertEnvFile(mobileEnvPath, mobileEnvOrder, mobileEnvValues);

  runStep(
    'docker',
    [...composeArgs, 'up', '-d', 'postgres', 'redis'],
    'Docker Compose startup',
    {
      POSTGRES_PORT: String(postgresPort),
      REDIS_PORT: String(redisPort),
    },
  );

  await waitForPort(postgresPort, 'PostgreSQL');
  await waitForPort(redisPort, 'Redis');

  runStep(
    'pnpm',
    ['--filter', '@finance-owl/backend', 'db:migrate'],
    'Database migration',
  );

  if (setupOnly) {
    console.log(`Local dev prerequisites are ready. Frontend: ${frontendUrl} Backend: ${backendUrl}`);
    return;
  }

  if (frontendPort !== 3000) {
    console.log(`Using frontend port ${frontendPort} because 3000 is occupied.`);
  }

  if (backendPort !== 4000) {
    console.log(`Using backend port ${backendPort} because 4000 is occupied.`);
  }

  if (postgresPort !== 5432) {
    console.log(`Using PostgreSQL port ${postgresPort} because 5432 is occupied.`);
  }

  if (redisPort !== 6379) {
    console.log(`Using Redis port ${redisPort} because 6379 is occupied.`);
  }

  const child = spawn('pnpm', ['run', 'dev:turbo'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      FRONTEND_PORT: String(frontendPort),
      BACKEND_PORT: String(backendPort),
      FRONTEND_URL: frontendUrl,
      API_URL: backendUrl,
    },
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(`\nLocal dev startup failed.\n${error.message}`);
  process.exit(1);
});
