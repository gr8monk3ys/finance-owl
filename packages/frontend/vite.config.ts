import adapterVercel from '@sveltejs/adapter-vercel';
import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import type { PluginOption } from 'vite';

async function getSentryPlugins(): Promise<PluginOption[]> {
  if (!process.env.SENTRY_AUTH_TOKEN) {
    return [];
  }
  try {
    // @sentry/sveltekit 11 moved the Vite plugin to its own entry point and
    // flattened `sourceMapsUploadOptions` into the top-level build options.
    const { sentrySvelteKit } = await import('@sentry/sveltekit/vite');
    const plugins = await sentrySvelteKit({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT_FRONTEND,
      authToken: process.env.SENTRY_AUTH_TOKEN,
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

/**
 * Use adapter-vercel for Vercel deployments (pin runtime to a supported LTS).
 * Use adapter-node for Docker/self-hosted deployments.
 *
 * Set ADAPTER=node to force adapter-node (e.g. in docker-compose).
 */
const useNodeAdapter = process.env.ADAPTER === 'node';

export default defineConfig({
  plugins: [
    tailwindcss(),
    ...sentryPlugins,
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: useNodeAdapter
        ? adapterNode({ out: 'build' })
        : adapterVercel({ runtime: 'nodejs24.x' }),
    }),
  ],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8' as const,
      reporter: ['text-summary', 'json-summary'] as const,
      // vitest 4 removed the `all` option; `include` now defines the full
      // coverage universe on its own.
      include: ['src/**/*.{ts,svelte}'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        lines: 40,
        branches: 50,
        functions: 40,
        statements: 40,
      },
    },
  },
});
