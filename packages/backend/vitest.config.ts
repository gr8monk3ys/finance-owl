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
      thresholds: {
        lines: 20,
        branches: 50,
        functions: 40,
        statements: 20,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
