import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/routes/health.ts',
        'src/routes/auth.ts',
        'src/routes/filters.ts',
        'src/routes/verses.ts',
        'src/routes/tafseer.ts',
        'src/middleware/auth.ts',
        'src/utils/scholar-metadata.ts',
      ],
      exclude: ['tests/**/*.test.ts'],
      thresholds: {
        statements: 51,
        branches: 41,
        functions: 72,
        lines: 51,
      },
    },
  },
});
