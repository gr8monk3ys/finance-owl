import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

async function getSentryPlugins() {
	if (!process.env.SENTRY_AUTH_TOKEN) {
		return [];
	}
	try {
		const { sentrySvelteKit } = await import('@sentry/sveltekit');
		const plugins = await sentrySvelteKit({
			sourceMapsUploadOptions: {
				org: process.env.SENTRY_ORG,
				project: process.env.SENTRY_PROJECT_FRONTEND,
				authToken: process.env.SENTRY_AUTH_TOKEN,
			},
			autoInstrument: {
				load: true,
				serverLoad: true,
			},
		});
		return Array.isArray(plugins) ? plugins : [plugins];
	} catch {
		return [];
	}
}

export default defineConfig(async () => ({
	plugins: [
		tailwindcss(),
		...(await getSentryPlugins()),
		sveltekit(),
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
}));
