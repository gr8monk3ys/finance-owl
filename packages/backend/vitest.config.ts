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
      // `--coverage` flag was swallowed by the package manager's arg parsing — so
      // raise them as coverage improves rather than starting red.
      thresholds: {
        lines: 49,
        branches: 42,
        functions: 37,
        // 48: plans.ts moved to @finance-owl/shared (where it now has its own
        // spec), which removed well-covered lines from this package's denominator.
        statements: 48,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
