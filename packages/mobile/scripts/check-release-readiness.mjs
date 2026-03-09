import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const packageDir = process.cwd();
const require = createRequire(import.meta.url);
const appConfigModule = require(path.join(packageDir, 'app.config.js'));

const envFiles = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
];

function parseEnvFile(filePath) {
  const values = {};

  if (!fs.existsSync(filePath)) {
    return values;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');

    if (key) {
      values[key] = value;
    }
  }

  return values;
}

const envFromFiles = envFiles.reduce((accumulator, fileName) => {
  const filePath = path.join(packageDir, fileName);
  return { ...accumulator, ...parseEnvFile(filePath) };
}, {});

for (const [key, value] of Object.entries(envFromFiles)) {
  if (!(key in process.env)) {
    process.env[key] = value;
  }
}

const resolvedConfig =
  typeof appConfigModule === 'function'
    ? appConfigModule({})
    : appConfigModule;
const expo = resolvedConfig ?? {};

function readValue(...keys) {
  for (const key of keys) {
    const directValue = process.env[key];
    if (typeof directValue === 'string' && directValue.trim()) {
      return directValue.trim();
    }

    const fileValue = envFromFiles[key];
    if (typeof fileValue === 'string' && fileValue.trim()) {
      return fileValue.trim();
    }
  }

  return '';
}

function check(label, ok, detail, nextStep) {
  return { label, ok, detail, nextStep };
}

function isHttpsUrl(value) {
  return /^https:\/\//i.test(value);
}

function tryWhoAmI() {
  try {
    const output = execFileSync(
      'npx',
      ['eas-cli', 'whoami', '--non-interactive'],
      {
        cwd: packageDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      },
    ).trim();

    return {
      ok: true,
      detail: output || 'Logged in to Expo.',
    };
  } catch (error) {
    const stderr =
      typeof error?.stderr === 'string' && error.stderr.trim()
        ? error.stderr
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('npm warn'))
            .join('\n')
        : '';

    return {
      ok: false,
      detail: stderr || 'Not logged in to Expo.',
    };
  }
}

function appleCredentialsStatus() {
  const apiKeyPath = readValue(
    'ASC_API_KEY_PATH',
    'APP_STORE_CONNECT_API_KEY_PATH',
  );
  const apiKeyId = readValue(
    'ASC_API_KEY_ID',
    'APP_STORE_CONNECT_API_KEY_ID',
  );
  const issuerId = readValue(
    'ASC_API_KEY_ISSUER_ID',
    'APP_STORE_CONNECT_ISSUER_ID',
  );
  const appleId = readValue('APPLE_ID');
  const appSpecificPassword = readValue('APPLE_APP_SPECIFIC_PASSWORD');

  const hasApiKey =
    !!apiKeyPath &&
    !!apiKeyId &&
    !!issuerId &&
    fs.existsSync(path.resolve(packageDir, apiKeyPath));
  const hasAppleIdFlow = !!appleId && !!appSpecificPassword;

  if (hasApiKey) {
    return {
      ok: true,
      detail: 'App Store Connect API key variables are configured.',
    };
  }

  if (hasAppleIdFlow) {
    return {
      ok: true,
      detail: 'Apple ID submission variables are configured.',
    };
  }

  return {
    ok: false,
    detail:
      'Missing App Store Connect API key credentials or Apple ID submission credentials.',
  };
}

const easAuth = tryWhoAmI();
const appleAuth = appleCredentialsStatus();
const owner = readValue('EXPO_OWNER');
const projectId = readValue('EXPO_PROJECT_ID');
const ascAppId = readValue('EXPO_ASC_APP_ID', 'APP_STORE_CONNECT_APP_ID');
const apiUrl = readValue('EXPO_PUBLIC_API_URL');
const webUrl = readValue('EXPO_PUBLIC_WEB_URL');

const checks = [
  check(
    'Expo account auth',
    easAuth.ok,
    easAuth.detail,
    'Run `cd packages/mobile && npx eas-cli login` or export `EXPO_TOKEN`.',
  ),
  check(
    'Expo owner',
    !!owner,
    owner ? `Using owner ${owner}.` : 'Missing `EXPO_OWNER`.',
    'Set `EXPO_OWNER` in your mobile env before building with EAS.',
  ),
  check(
    'EAS project ID',
    !!projectId,
    projectId ? `Using project ID ${projectId}.` : 'Missing `EXPO_PROJECT_ID`.',
    'Run `cd packages/mobile && npx eas-cli init` once, then store the project ID in env.',
  ),
  check(
    'Production API URL',
    isHttpsUrl(apiUrl),
    apiUrl
      ? `Using ${apiUrl}.`
      : 'Missing `EXPO_PUBLIC_API_URL`.',
    'Set `EXPO_PUBLIC_API_URL` to the production HTTPS API base URL.',
  ),
  check(
    'Production web URL',
    isHttpsUrl(webUrl),
    webUrl
      ? `Using ${webUrl}.`
      : 'Missing `EXPO_PUBLIC_WEB_URL`.',
    'Set `EXPO_PUBLIC_WEB_URL` to the production HTTPS web app URL.',
  ),
  check(
    'App Store Connect app ID',
    !!ascAppId,
    ascAppId
      ? `Using App Store Connect app ID ${ascAppId}.`
      : 'Missing `EXPO_ASC_APP_ID`.',
    'Add the App Store Connect numeric app ID so submission can target the right app.',
  ),
  check(
    'Apple submission credentials',
    appleAuth.ok,
    appleAuth.detail,
    'Provide App Store Connect API key variables or Apple ID submission credentials.',
  ),
  check(
    'iOS bundle identifier',
    !!expo.ios?.bundleIdentifier,
    expo.ios?.bundleIdentifier
      ? `Using ${expo.ios.bundleIdentifier}.`
      : 'Missing iOS bundle identifier.',
    'Set `ios.bundleIdentifier` in app config.',
  ),
  check(
    'iOS build number',
    !!expo.ios?.buildNumber,
    expo.ios?.buildNumber
      ? `Current build number ${expo.ios.buildNumber}.`
      : 'Missing iOS build number.',
    'Set `ios.buildNumber` before shipping.',
  ),
];

const failingChecks = checks.filter((item) => !item.ok);

console.log('\nFinanceOwl iOS release readiness\n');

for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.label}`);
  console.log(`      ${item.detail}`);
  if (!item.ok) {
    console.log(`      Next: ${item.nextStep}`);
  }
}

if (failingChecks.length > 0) {
  console.log(
    `\n${failingChecks.length} release prerequisite${failingChecks.length === 1 ? '' : 's'} missing.`,
  );
  process.exitCode = 1;
} else {
  console.log('\nAll required release prerequisites are configured.');
}
