import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const shouldVerify = process.argv.includes('--verify');
const require = createRequire(import.meta.url);

const sections = [];

function addSection(title) {
	const section = { title, checks: [] };
	sections.push(section);
	return section;
}

function addCheck(section, status, label, detail, nextStep) {
	section.checks.push({ status, label, detail, nextStep });
}

function parseEnvFile(filePath) {
	if (!fs.existsSync(filePath)) {
		return {};
	}

	const values = {};
	for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		const separatorIndex = trimmed.indexOf('=');
		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmed.slice(0, separatorIndex).trim();
		const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
		if (key) {
			values[key] = value;
		}
	}

	return values;
}

function loadEnv(paths) {
	return paths.reduce((merged, filePath) => ({ ...merged, ...parseEnvFile(filePath) }), {});
}

function readValue(env, ...keys) {
	for (const key of keys) {
		const processValue = process.env[key];
		if (typeof processValue === 'string' && processValue.trim()) {
			return processValue.trim();
		}

		const fileValue = env[key];
		if (typeof fileValue === 'string' && fileValue.trim()) {
			return fileValue.trim();
		}
	}

	return '';
}

function isHttpsUrl(value) {
	return /^https:\/\//i.test(value);
}

function isConfiguredSecret(value, minLength = 1) {
	return typeof value === 'string' && value.trim().length >= minLength && !/replace-with|placeholder|00000000|your-|example\.com/i.test(value);
}

function isHex64(value) {
	return /^[0-9a-fA-F]{64}$/.test(value);
}

function normalizeUrl(value) {
	try {
		return new URL(value).toString();
	} catch {
		return '';
	}
}

function isLaunchUrl(value) {
	return isHttpsUrl(value) && !/localhost|127\.0\.0\.1|10\.0\.2\.2/i.test(value);
}

function fileExists(relativePath) {
	return fs.existsSync(path.join(rootDir, relativePath));
}

function fileContainsPlaceholder(relativePath, patterns) {
	const filePath = path.join(rootDir, relativePath);
	if (!fs.existsSync(filePath)) {
		return false;
	}

	const contents = fs.readFileSync(filePath, 'utf8');
	return patterns.some((pattern) => pattern.test(contents));
}

function runCommand(command, args, extraEnv = {}) {
	const result = spawnSync(command, args, {
		cwd: rootDir,
		stdio: 'inherit',
		env: { ...process.env, ...extraEnv }
	});

	if (result.error) {
		throw result.error;
	}

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
	}
}

function normalizeApiBaseUrl(value) {
	return value.replace(/\/api\/?$/i, '').replace(/\/$/, '');
}

async function findOpenPort(host = '127.0.0.1') {
	return await new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.on('error', reject);
		server.listen(0, host, () => {
			const address = server.address();
			const port = typeof address === 'object' && address ? address.port : null;
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}

				if (typeof port === 'number') {
					resolve(port);
					return;
				}

				reject(new Error('Failed to allocate a preview port.'));
			});
		});
	});
}

async function waitForUrl(url, timeoutMs = 30_000) {
	const start = Date.now();
	let lastError;

	while (Date.now() - start < timeoutMs) {
		try {
			const response = await fetch(url, { redirect: 'manual' });
			if (response.ok || response.status === 302 || response.status === 303) {
				return;
			}
			lastError = new Error(`Unexpected status ${response.status} for ${url}`);
		} catch (error) {
			lastError = error;
		}

		await new Promise((resolve) => setTimeout(resolve, 250));
	}

	throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

async function startFrontendPreview() {
	const port = await findOpenPort();
	const baseUrl = `http://127.0.0.1:${port}`;
	const child = spawn(
		'pnpm',
		['--filter', '@finance-owl/frontend', 'exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(port)],
		{
			cwd: rootDir,
			stdio: 'ignore',
			env: process.env
		}
	);

	try {
		await waitForUrl(baseUrl);
		return { baseUrl, child };
	} catch (error) {
		child.kill('SIGTERM');
		throw error;
	}
}

function stopChild(child) {
	if (!child || child.killed) {
		return;
	}

	child.kill('SIGTERM');
}

async function isApiReachable(value) {
	if (!isConfiguredSecret(value)) {
		return false;
	}

	try {
		const healthUrl = `${normalizeApiBaseUrl(value)}/api/health/ready`;
		const response = await fetch(healthUrl);
		return response.ok;
	} catch {
		return false;
	}
}

const rootEnv = loadEnv([
	path.join(rootDir, '.env'),
	path.join(rootDir, '.env.local'),
	path.join(rootDir, '.env.production'),
	path.join(rootDir, '.env.production.local')
]);
const backendEnv = loadEnv([
	path.join(rootDir, 'packages/backend/.env'),
	path.join(rootDir, 'packages/backend/.env.local'),
	path.join(rootDir, 'packages/backend/.env.production'),
	path.join(rootDir, 'packages/backend/.env.production.local')
]);
const frontendEnv = loadEnv([
	path.join(rootDir, 'packages/frontend/.env'),
	path.join(rootDir, 'packages/frontend/.env.local'),
	path.join(rootDir, 'packages/frontend/.env.production'),
	path.join(rootDir, 'packages/frontend/.env.production.local')
]);
const mobileEnv = loadEnv([
	path.join(rootDir, 'packages/mobile/.env'),
	path.join(rootDir, 'packages/mobile/.env.local'),
	path.join(rootDir, 'packages/mobile/.env.production'),
	path.join(rootDir, 'packages/mobile/.env.production.local')
]);

const combinedBackendEnv = { ...rootEnv, ...backendEnv };
const combinedFrontendEnv = { ...rootEnv, ...frontendEnv };
const combinedMobileEnv = { ...mobileEnv };

for (const [key, value] of Object.entries(combinedMobileEnv)) {
	if (!(key in process.env)) {
		process.env[key] = value;
	}
}

const repoSection = addSection('Repo Artifacts');
[
	['packages/backend/.env.example', 'Backend env template'],
	['packages/frontend/.env.example', 'Frontend env template'],
	['packages/mobile/.env.example', 'Mobile env template'],
	['packages/frontend/src/routes/support/+page.svelte', 'Public support page'],
	['packages/frontend/src/routes/privacy/+page.svelte', 'Public privacy policy page'],
	['packages/frontend/src/routes/terms/+page.svelte', 'Public terms page'],
	['packages/frontend/src/routes/security/+page.svelte', 'Public security page'],
	['packages/frontend/src/routes/sitemap.xml/+server.ts', 'Sitemap route'],
	['packages/frontend/src/routes/.well-known/security.txt/+server.ts', 'security.txt route'],
	['docs/mobile-release.md', 'Mobile release guide'],
	['docs/launch-readiness.md', 'Launch readiness guide'],
	['docs/app-store-metadata.md', 'App Store metadata template']
].forEach(([relativePath, label]) => {
	addCheck(
		repoSection,
		fileExists(relativePath) ? 'PASS' : 'FAIL',
		label,
		fileExists(relativePath) ? `${relativePath} is present.` : `${relativePath} is missing.`,
		fileExists(relativePath) ? undefined : `Add ${relativePath} before launch.`
	);
});

const frontendSection = addSection('Web Launch Configuration');
const publicSiteUrl = readValue(combinedFrontendEnv, 'PUBLIC_SITE_URL');
const publicSupportEmail = readValue(combinedFrontendEnv, 'PUBLIC_SUPPORT_EMAIL');
const publicPrivacyEmail = readValue(combinedFrontendEnv, 'PUBLIC_PRIVACY_EMAIL');
const publicLegalEmail = readValue(combinedFrontendEnv, 'PUBLIC_LEGAL_EMAIL');
const publicSecurityEmail = readValue(combinedFrontendEnv, 'PUBLIC_SECURITY_EMAIL');
const publicCompanyAddress = readValue(combinedFrontendEnv, 'PUBLIC_COMPANY_ADDRESS');
const apiUrl = readValue(combinedFrontendEnv, 'API_URL');

addCheck(
	frontendSection,
	isLaunchUrl(publicSiteUrl) ? 'PASS' : 'FAIL',
	'Public site URL',
	publicSiteUrl ? `Using ${normalizeUrl(publicSiteUrl)}.` : 'Missing PUBLIC_SITE_URL.',
	'Set packages/frontend/.env.production with an HTTPS PUBLIC_SITE_URL.'
);
addCheck(
	frontendSection,
	isLaunchUrl(apiUrl) ? 'PASS' : 'FAIL',
	'Frontend API URL',
	apiUrl ? `Using ${normalizeUrl(apiUrl)}.` : 'Missing API_URL.',
	'Set packages/frontend/.env.production with the production HTTPS backend URL.'
);
[
	['Support email', publicSupportEmail, 'PUBLIC_SUPPORT_EMAIL'],
	['Privacy email', publicPrivacyEmail, 'PUBLIC_PRIVACY_EMAIL'],
	['Legal email', publicLegalEmail, 'PUBLIC_LEGAL_EMAIL'],
	['Security email', publicSecurityEmail, 'PUBLIC_SECURITY_EMAIL']
].forEach(([label, value, key]) => {
	addCheck(
		frontendSection,
		isConfiguredSecret(value) ? 'PASS' : 'FAIL',
		label,
		value ? `Using ${value}.` : `Missing ${key}.`,
		`Set ${key} in packages/frontend/.env.production.`
	);
});
addCheck(
	frontendSection,
	isConfiguredSecret(publicCompanyAddress) ? 'PASS' : 'WARN',
	'Public company address',
	publicCompanyAddress ? `Using ${publicCompanyAddress}.` : 'PUBLIC_COMPANY_ADDRESS is unset; legal pages show no mailing address.',
	'Set PUBLIC_COMPANY_ADDRESS if your legal or privacy obligations require a published company address.'
);

const metadataSection = addSection('Launch Content');
const appStoreMetadataHasPlaceholders = fileContainsPlaceholder('docs/app-store-metadata.md', [
	/YOUR_DOMAIN/,
	/Replace this/i,
	/App Name:\s*$/m,
	/Subtitle:\s*$/m,
	/Primary Category:\s*$/m,
	/Beta App Description:\s*$/m
]);
addCheck(
	metadataSection,
	appStoreMetadataHasPlaceholders ? 'FAIL' : 'PASS',
	'App Store metadata sheet',
	appStoreMetadataHasPlaceholders
		? 'docs/app-store-metadata.md still contains placeholders or blank launch fields.'
		: 'App Store metadata sheet is filled in.',
	'Fill docs/app-store-metadata.md with the real support URL, privacy URL, copy, reviewer account, and screenshot status.'
);

const backendSection = addSection('Backend Production Configuration');
const databaseUrl = readValue(combinedBackendEnv, 'DATABASE_URL');
const redisUrl = readValue(combinedBackendEnv, 'REDIS_URL');
const frontendUrl = readValue(combinedBackendEnv, 'FRONTEND_URL');
const corsOrigin = readValue(combinedBackendEnv, 'CORS_ORIGIN');
const jwtSecret = readValue(combinedBackendEnv, 'JWT_SECRET');
const jwtRefreshSecret = readValue(combinedBackendEnv, 'JWT_REFRESH_SECRET');
const encryptionKey = readValue(combinedBackendEnv, 'ENCRYPTION_KEY');
const encryptionMasterSecret = readValue(combinedBackendEnv, 'ENCRYPTION_MASTER_SECRET');

addCheck(
	backendSection,
	isConfiguredSecret(databaseUrl) ? 'PASS' : 'FAIL',
	'Database URL',
	databaseUrl ? 'DATABASE_URL is configured.' : 'Missing DATABASE_URL.',
	'Set DATABASE_URL in packages/backend/.env.production or your production secret manager.'
);
addCheck(
	backendSection,
	isConfiguredSecret(redisUrl) ? 'PASS' : 'FAIL',
	'Redis URL',
	redisUrl ? 'REDIS_URL is configured.' : 'Missing REDIS_URL.',
	'Set REDIS_URL in packages/backend/.env.production or your production secret manager.'
);
addCheck(
	backendSection,
	isLaunchUrl(frontendUrl) || isLaunchUrl(corsOrigin) ? 'PASS' : 'FAIL',
	'Frontend/CORS origin',
	frontendUrl || corsOrigin
		? `FRONTEND_URL=${frontendUrl || '(unset)'}, CORS_ORIGIN=${corsOrigin || '(unset)'}.`
		: 'Missing FRONTEND_URL and CORS_ORIGIN.',
		'Configure FRONTEND_URL or CORS_ORIGIN with the public HTTPS frontend origin.'
);
addCheck(
	backendSection,
	isConfiguredSecret(jwtSecret, 32) ? 'PASS' : 'FAIL',
	'JWT secret',
	jwtSecret ? 'JWT_SECRET is configured.' : 'Missing JWT_SECRET.',
	'Generate with `openssl rand -base64 48` and store it securely.'
);
addCheck(
	backendSection,
	isConfiguredSecret(jwtRefreshSecret, 32) ? 'PASS' : 'FAIL',
	'JWT refresh secret',
	jwtRefreshSecret ? 'JWT_REFRESH_SECRET is configured.' : 'Missing JWT_REFRESH_SECRET.',
	'Generate with `openssl rand -base64 48` and store it securely.'
);
addCheck(
	backendSection,
	isHex64(encryptionKey) ? 'PASS' : 'FAIL',
	'Encryption key',
	encryptionKey ? 'ENCRYPTION_KEY is configured.' : 'Missing ENCRYPTION_KEY.',
	'Generate with `openssl rand -hex 32` and store it securely.'
);
addCheck(
	backendSection,
	isConfiguredSecret(encryptionMasterSecret, 32) ? 'PASS' : 'FAIL',
	'Encryption master secret',
	encryptionMasterSecret ? 'ENCRYPTION_MASTER_SECRET is configured.' : 'Missing ENCRYPTION_MASTER_SECRET.',
	'Generate with `openssl rand -base64 48` and store it securely.'
);

const integrationSection = addSection('Feature-backed Services');
const plaidConfigured =
	isConfiguredSecret(readValue(combinedBackendEnv, 'PLAID_CLIENT_ID')) &&
	isConfiguredSecret(readValue(combinedBackendEnv, 'PLAID_SECRET')) &&
	isConfiguredSecret(readValue(combinedBackendEnv, 'PLAID_ENV'));
addCheck(
	integrationSection,
	plaidConfigured ? 'PASS' : 'WARN',
	'Plaid banking integration',
	plaidConfigured ? 'Plaid credentials are configured.' : 'Plaid credentials are missing; bank sync is not launch-ready.',
	plaidConfigured ? undefined : 'Configure Plaid or remove/disable bank-linking promises before launch.'
);

const stripeConfigured =
	isConfiguredSecret(readValue(combinedBackendEnv, 'STRIPE_SECRET_KEY')) &&
	isConfiguredSecret(readValue(combinedBackendEnv, 'STRIPE_WEBHOOK_SECRET')) &&
	isConfiguredSecret(readValue(combinedBackendEnv, 'STRIPE_PRICE_PRO_MONTHLY')) &&
	isConfiguredSecret(readValue(combinedBackendEnv, 'STRIPE_PRICE_PRO_YEARLY')) &&
	isConfiguredSecret(readValue(combinedBackendEnv, 'STRIPE_PRICE_PREMIUM_MONTHLY')) &&
	isConfiguredSecret(readValue(combinedBackendEnv, 'STRIPE_PRICE_PREMIUM_YEARLY'));
addCheck(
	integrationSection,
	stripeConfigured ? 'PASS' : 'WARN',
	'Stripe billing',
	stripeConfigured ? 'Stripe secret, webhook secret, and price IDs are configured.' : 'Stripe billing is incomplete; paid plans are not launch-ready.',
	stripeConfigured ? undefined : 'Run the Stripe product setup script with live credentials and store the resulting price IDs.'
);

const smtpConfigured =
	isConfiguredSecret(readValue(combinedBackendEnv, 'SMTP_HOST')) &&
	isConfiguredSecret(readValue(combinedBackendEnv, 'SMTP_USER')) &&
	isConfiguredSecret(readValue(combinedBackendEnv, 'SMTP_PASS')) &&
	isConfiguredSecret(readValue(combinedBackendEnv, 'SMTP_FROM'));
addCheck(
	integrationSection,
	smtpConfigured ? 'PASS' : 'WARN',
	'Transactional email',
	smtpConfigured ? 'SMTP is configured.' : 'SMTP is missing; email notifications and account emails are not launch-ready.',
	smtpConfigured ? undefined : 'Configure SMTP or another supported delivery provider.'
);

const sentryConfigured = isConfiguredSecret(readValue(combinedBackendEnv, 'SENTRY_DSN')) && isConfiguredSecret(readValue(combinedFrontendEnv, 'PUBLIC_SENTRY_DSN'));
addCheck(
	integrationSection,
	sentryConfigured ? 'PASS' : 'WARN',
	'Sentry monitoring',
	sentryConfigured ? 'Backend and frontend Sentry DSNs are configured.' : 'Sentry is not fully configured.',
	sentryConfigured ? undefined : 'Set backend SENTRY_DSN and frontend PUBLIC_SENTRY_DSN before broad launch.'
);

const webauthnConfigured =
	isConfiguredSecret(readValue(combinedBackendEnv, 'WEBAUTHN_RP_ID')) &&
	isLaunchUrl(readValue(combinedBackendEnv, 'WEBAUTHN_ORIGIN'));
addCheck(
	integrationSection,
	webauthnConfigured ? 'PASS' : 'WARN',
	'WebAuthn / passkeys',
	webauthnConfigured ? 'WebAuthn production origin is configured.' : 'WebAuthn is not production-configured.',
	webauthnConfigured ? undefined : 'Set WEBAUTHN_RP_ID and an HTTPS WEBAUTHN_ORIGIN if passkeys are part of launch.'
);

const mobileSection = addSection('App Store / Mobile Release');
const mobileApiUrl = readValue(combinedMobileEnv, 'EXPO_PUBLIC_API_URL');
const mobileWebUrl = readValue(combinedMobileEnv, 'EXPO_PUBLIC_WEB_URL');
const expoOwner = readValue(combinedMobileEnv, 'EXPO_OWNER');
const expoProjectId = readValue(combinedMobileEnv, 'EXPO_PROJECT_ID');
const ascAppId = readValue(combinedMobileEnv, 'EXPO_ASC_APP_ID', 'APP_STORE_CONNECT_APP_ID');
const ascApiKeyPath = readValue(combinedMobileEnv, 'ASC_API_KEY_PATH', 'APP_STORE_CONNECT_API_KEY_PATH');
const ascApiKeyId = readValue(combinedMobileEnv, 'ASC_API_KEY_ID', 'APP_STORE_CONNECT_API_KEY_ID');
const ascIssuerId = readValue(combinedMobileEnv, 'ASC_API_KEY_ISSUER_ID', 'APP_STORE_CONNECT_ISSUER_ID');
const appleId = readValue(combinedMobileEnv, 'APPLE_ID');
const appSpecificPassword = readValue(combinedMobileEnv, 'APPLE_APP_SPECIFIC_PASSWORD');

let expoAuthOk = false;
let expoAuthDetail = 'Expo authentication is not configured.';

if (isConfiguredSecret(process.env.EXPO_TOKEN || '')) {
	expoAuthOk = true;
	expoAuthDetail = 'Using EXPO_TOKEN.';
} else {
	try {
		const whoami = execFileSync('npx', ['eas-cli', 'whoami', '--non-interactive'], {
			cwd: path.join(rootDir, 'packages/mobile'),
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		}).trim();
		expoAuthOk = true;
		expoAuthDetail = whoami || 'Logged in to Expo.';
	} catch {
		expoAuthOk = false;
	}
}

addCheck(
	mobileSection,
	expoAuthOk ? 'PASS' : 'FAIL',
	'Expo authentication',
	expoAuthDetail,
	'Run `cd packages/mobile && npx eas-cli login` or export EXPO_TOKEN.'
);
addCheck(
	mobileSection,
	isLaunchUrl(mobileApiUrl) ? 'PASS' : 'FAIL',
	'Mobile API URL',
	mobileApiUrl ? `Using ${normalizeUrl(mobileApiUrl)}.` : 'Missing EXPO_PUBLIC_API_URL.',
	'Set EXPO_PUBLIC_API_URL to the production HTTPS API URL.'
);
addCheck(
	mobileSection,
	isLaunchUrl(mobileWebUrl) ? 'PASS' : 'FAIL',
	'Mobile web URL',
	mobileWebUrl ? `Using ${normalizeUrl(mobileWebUrl)}.` : 'Missing EXPO_PUBLIC_WEB_URL.',
	'Set EXPO_PUBLIC_WEB_URL to the production HTTPS web app URL.'
);
addCheck(
	mobileSection,
	isConfiguredSecret(expoOwner) ? 'PASS' : 'FAIL',
	'Expo owner',
	expoOwner ? `Using ${expoOwner}.` : 'Missing EXPO_OWNER.',
	'Set EXPO_OWNER after linking the project to EAS.'
);
addCheck(
	mobileSection,
	isConfiguredSecret(expoProjectId) ? 'PASS' : 'FAIL',
	'EAS project ID',
	expoProjectId ? `Using ${expoProjectId}.` : 'Missing EXPO_PROJECT_ID.',
	'Run `cd packages/mobile && npx eas-cli init` and store the project ID.'
);
addCheck(
	mobileSection,
	isConfiguredSecret(ascAppId) ? 'PASS' : 'FAIL',
	'App Store Connect app ID',
	ascAppId ? `Using ${ascAppId}.` : 'Missing EXPO_ASC_APP_ID.',
	'Create the app record in App Store Connect and set EXPO_ASC_APP_ID.'
);

const ascApiKeyOk =
	isConfiguredSecret(ascApiKeyPath) &&
	isConfiguredSecret(ascApiKeyId) &&
	isConfiguredSecret(ascIssuerId) &&
	fs.existsSync(path.resolve(path.join(rootDir, 'packages/mobile'), ascApiKeyPath));
const appleIdFlowOk = isConfiguredSecret(appleId) && isConfiguredSecret(appSpecificPassword);
addCheck(
	mobileSection,
	ascApiKeyOk || appleIdFlowOk ? 'PASS' : 'FAIL',
	'Apple submission credentials',
	ascApiKeyOk
		? 'App Store Connect API key credentials are configured.'
		: appleIdFlowOk
			? 'Apple ID submission credentials are configured.'
			: 'Missing App Store Connect API key or Apple ID submission credentials.',
	'Provide App Store Connect API key credentials or Apple ID + app-specific password.'
);

let appConfig = {};
try {
	const appConfigModule = require(path.join(rootDir, 'packages/mobile/app.config.js'));
	appConfig = typeof appConfigModule === 'function' ? appConfigModule({}) : appConfigModule;
} catch {
	appConfig = {};
}

addCheck(
	mobileSection,
	isConfiguredSecret(appConfig.ios?.bundleIdentifier || '') ? 'PASS' : 'FAIL',
	'iOS bundle identifier',
	appConfig.ios?.bundleIdentifier ? `Using ${appConfig.ios.bundleIdentifier}.` : 'Missing ios.bundleIdentifier.',
	'Set ios.bundleIdentifier in packages/mobile/app.config.js.'
);
addCheck(
	mobileSection,
	isConfiguredSecret(appConfig.ios?.buildNumber || '') ? 'PASS' : 'FAIL',
	'iOS build number',
	appConfig.ios?.buildNumber ? `Current build number ${appConfig.ios.buildNumber}.` : 'Missing ios.buildNumber.',
	'Set ios.buildNumber in packages/mobile/app.config.js.'
);
addCheck(
	mobileSection,
	isConfiguredSecret(appConfig.android?.package || '') ? 'PASS' : 'FAIL',
	'Android package',
	appConfig.android?.package ? `Using ${appConfig.android.package}.` : 'Missing android.package.',
	'Set android.package in packages/mobile/app.config.js.'
);
addCheck(
	mobileSection,
	typeof appConfig.android?.versionCode === 'number' ? 'PASS' : 'FAIL',
	'Android version code',
	typeof appConfig.android?.versionCode === 'number'
		? `Current version code ${appConfig.android.versionCode}.`
		: 'Missing android.versionCode.',
	'Set android.versionCode in packages/mobile/app.config.js.'
);
addCheck(
	mobileSection,
	appConfig.ios?.config?.usesNonExemptEncryption === false ? 'PASS' : 'WARN',
	'iOS export-compliance flag',
	appConfig.ios?.config?.usesNonExemptEncryption === false
		? 'ios.config.usesNonExemptEncryption is set to false.'
		: 'ios.config.usesNonExemptEncryption is not set to false.',
	'Confirm the app qualifies, then set ios.config.usesNonExemptEncryption in packages/mobile/app.config.js.'
);

if (shouldVerify) {
	const verifySection = addSection('Verification Commands');
	const commands = [
		['Backend typecheck', ['--filter', '@finance-owl/backend', 'typecheck']],
		['Backend tests', ['--filter', '@finance-owl/backend', 'test']],
		['Frontend typecheck', ['--filter', '@finance-owl/frontend', 'typecheck']],
		['Frontend tests with coverage', ['--filter', '@finance-owl/frontend', 'test:coverage']],
		['Frontend build', ['--filter', '@finance-owl/frontend', 'build']],
		['Mobile typecheck', ['--filter', '@finance-owl/mobile', 'typecheck']],
		['Mobile lint', ['--filter', '@finance-owl/mobile', 'lint']],
		['Expo doctor', ['--filter', '@finance-owl/mobile', 'run', 'check:expo']],
		['iOS export', ['--filter', '@finance-owl/mobile', 'export:ios']],
		['Android export', ['--filter', '@finance-owl/mobile', 'export:android']]
	];

	for (const [label, args] of commands) {
		try {
			runCommand('pnpm', args);
			addCheck(verifySection, 'PASS', label, `${label} completed successfully.`);
		} catch (error) {
			addCheck(
				verifySection,
				'FAIL',
				label,
				error instanceof Error ? error.message : `${label} failed.`,
				`Run \`pnpm ${args.join(' ')}\` and fix the failure before launch.`
			);
		}
	}

	if (await isApiReachable(apiUrl)) {
		let preview;

		try {
			preview = await startFrontendPreview();
			const previewEnv = {
				API_URL: normalizeApiBaseUrl(apiUrl),
				PLAYWRIGHT_BASE_URL: preview.baseUrl,
				LIGHTHOUSE_BASE_URL: preview.baseUrl
			};

			try {
				runCommand(
					'pnpm',
					[
						'--filter',
						'@finance-owl/frontend',
						'exec',
						'playwright',
						'test',
						'e2e/navigation.spec.ts',
						'--project=chromium',
						'--workers=1'
					],
					previewEnv
				);
				addCheck(verifySection, 'PASS', 'Public route suite', `Public route browser suite passed against ${preview.baseUrl}.`);
			} catch (error) {
				addCheck(
					verifySection,
					'FAIL',
					'Public route suite',
					error instanceof Error ? error.message : 'Public route browser suite failed.',
					'Fix public route failures before launch.'
				);
			}

			try {
				runCommand('pnpm', ['--filter', '@finance-owl/frontend', 'test:e2e:critical'], previewEnv);
				addCheck(verifySection, 'PASS', 'Critical browser suite', `Playwright critical suite passed against ${preview.baseUrl}.`);
			} catch (error) {
				addCheck(
					verifySection,
					'FAIL',
					'Critical browser suite',
					error instanceof Error ? error.message : 'Playwright critical suite failed.',
					'Fix Playwright critical failures before launch.'
				);
			}

			try {
				runCommand('pnpm', ['--filter', '@finance-owl/frontend', 'quality:lighthouse'], previewEnv);
				addCheck(verifySection, 'PASS', 'Lighthouse gate', `Lighthouse thresholds passed against ${preview.baseUrl}.`);
			} catch (error) {
				addCheck(
					verifySection,
					'FAIL',
					'Lighthouse gate',
					error instanceof Error ? error.message : 'Lighthouse gate failed.',
					'Fix Lighthouse regressions before launch.'
				);
			}
		} catch (error) {
			addCheck(
				verifySection,
				'FAIL',
				'Frontend preview bootstrap',
				error instanceof Error ? error.message : 'Failed to start the frontend preview server.',
				'Make sure the frontend can build and the preview server can bind to localhost before launch.'
			);
		} finally {
			if (preview) {
				stopChild(preview.child);
			}
		}
	} else {
		addCheck(
			verifySection,
			'WARN',
			'Browser and Lighthouse gates',
			`API_URL ${apiUrl || '(unset)'} is not reachable, so preview-based verification was skipped.`,
			'Start the backend API and rerun pnpm launch:verify to exercise Playwright and Lighthouse.'
		);
	}
}

let failCount = 0;
let warnCount = 0;

console.log('\nFinance Owl launch readiness\n');

for (const section of sections) {
	console.log(section.title);
	for (const check of section.checks) {
		if (check.status === 'FAIL') failCount += 1;
		if (check.status === 'WARN') warnCount += 1;
		console.log(`${check.status.padEnd(4)} ${check.label}`);
		console.log(`      ${check.detail}`);
		if (check.nextStep) {
			console.log(`      Next: ${check.nextStep}`);
		}
	}
	console.log('');
}

console.log(`Summary: ${failCount} fail, ${warnCount} warn.`);

if (failCount > 0) {
	process.exitCode = 1;
}
