import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // `npm run test:coverage` (and the Review workflow) fail when any file is below 90%
    // (perFile). Left out: the code that only starts the app in a browser or the build
    // (nothing to test) and the test helpers (src/test, functions/_lib/testing). The
    // recruiter gate's comparison is in: a CI gate needs tests like the site does.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'functions/**/*.ts', 'scripts/recruiter-compare.mjs'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts', 'src/test/**', 'functions/_lib/testing/**', 'src/main.tsx', 'src/admin/main.tsx', 'src/entry-server.tsx'],
      reporter: ['text-summary', 'json-summary', 'json'],
      thresholds: { perFile: true, statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
})
