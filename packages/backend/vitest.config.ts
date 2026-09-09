import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['src/**/*.integration.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/**/*.integration.{test,spec}.ts',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/main.ts',
      ],
      // Ratchet, not an aspiration: these are the levels the suite
      // actually reaches today. CI never enforced them before — the
      // `--coverage` flag was swallowed by pnpm's own arg parsing — so
      // raise them as coverage improves rather than starting red.
      thresholds: {
        lines: 49,
        branches: 42,
        functions: 37,
        statements: 49,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
