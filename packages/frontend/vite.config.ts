import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import type { PluginOption } from 'vite';

async function getSentryPlugins(): Promise<PluginOption[]> {
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

const sentryPlugins = await getSentryPlugins();

export default defineConfig({
	plugins: [tailwindcss(), ...sentryPlugins, sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		coverage: {
			provider: 'v8' as const,
			reporter: ['text-summary', 'json-summary'] as const,
			all: true,
			include: ['src/**/*.{ts,svelte}'],
			exclude: ['src/**/*.d.ts'],
			thresholds: {
				lines: 40,
				branches: 50,
				functions: 40,
				statements: 40,
			},
		}
	}
});
