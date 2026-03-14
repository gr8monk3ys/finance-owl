import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const baseUrl = process.env.LIGHTHOUSE_BASE_URL || 'http://127.0.0.1:4175';
const apiUrl = process.env.API_URL || 'http://localhost:4000';
const authEmail = process.env.LIGHTHOUSE_EMAIL || 'demo@financeowl.com';
const authPassword = process.env.LIGHTHOUSE_PASSWORD || 'Demo123!';

const pages = [
	{
		id: 'home',
		path: '/',
		thresholds: { performance: 95, accessibility: 100, 'best-practices': 100, seo: 100 }
	},
	{
		id: 'login',
		path: '/auth/login',
		thresholds: { performance: 95, accessibility: 100, 'best-practices': 100, seo: 100 }
	},
	{
		id: 'support',
		path: '/support',
		thresholds: { performance: 95, accessibility: 100, 'best-practices': 100, seo: 100 }
	},
	{
		id: 'dashboard',
		path: '/dashboard',
		auth: true,
		thresholds: { performance: 90, accessibility: 100, 'best-practices': 100, seo: 100 }
	}
];

async function createAuthHeadersFile(dir) {
	const response = await fetch(`${apiUrl}/api/auth/login`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Forwarded-For': '10.200.1.10'
		},
		body: JSON.stringify({ email: authEmail, password: authPassword })
	});

	if (!response.ok) {
		throw new Error(`Failed to create Lighthouse auth session: ${response.status}`);
	}

	const body = await response.json();
	const headerPath = path.join(dir, 'dashboard-headers.json');
	writeFileSync(
		headerPath,
		JSON.stringify({
			Cookie: `access_token=${body.accessToken}; refresh_token=${body.refreshToken}`
		})
	);

	return headerPath;
}

function runLighthouse(url, outputPath, extraHeadersPath) {
	const args = [
		'-y',
		'lighthouse',
		url,
		'--only-categories=performance,accessibility,best-practices,seo',
		'--chrome-flags=--headless=new --no-sandbox',
		'--output=json',
		`--output-path=${outputPath}`
	];

	if (extraHeadersPath) {
		args.push(`--extra-headers=${extraHeadersPath}`);
	}

	execFileSync('npx', args, {
		stdio: 'pipe'
	});

	return JSON.parse(readFileSync(outputPath, 'utf8'));
}

function scoreMap(report) {
	return Object.fromEntries(
		Object.entries(report.categories).map(([category, value]) => [category, Math.round(value.score * 100)])
	);
}

function printSummary(id, scores, report) {
	const fcp = report.audits['first-contentful-paint'].displayValue;
	const lcp = report.audits['largest-contentful-paint'].displayValue;
	const tbt = report.audits['total-blocking-time'].displayValue;
	const cls = report.audits['cumulative-layout-shift'].displayValue;

	console.log(
		`${id}: perf ${scores.performance}, a11y ${scores.accessibility}, best ${scores['best-practices']}, seo ${scores.seo} | FCP ${fcp}, LCP ${lcp}, TBT ${tbt}, CLS ${cls}`
	);
}

function assertThresholds(id, scores, thresholds) {
	for (const [category, threshold] of Object.entries(thresholds)) {
		if (scores[category] < threshold) {
			throw new Error(
				`${id} failed Lighthouse threshold for ${category}: ${scores[category]} < ${threshold}`
			);
		}
	}
}

const tempDir = mkdtempSync(path.join(tmpdir(), 'finance-owl-lighthouse-'));

try {
	const dashboardHeadersPath = await createAuthHeadersFile(tempDir);

	for (const page of pages) {
		const outputPath = path.join(tempDir, `${page.id}.json`);
		const report = runLighthouse(
			new URL(page.path, baseUrl).toString(),
			outputPath,
			page.auth ? dashboardHeadersPath : undefined
		);
		const scores = scoreMap(report);
		printSummary(page.id, scores, report);
		assertThresholds(page.id, scores, page.thresholds);
	}

	console.log('Lighthouse thresholds passed.');
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
