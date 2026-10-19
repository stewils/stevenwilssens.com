import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // `npm run test:coverage` (and the Review workflow) fail below 90%. The code that
    // only starts the app in a browser or the build is left out: it has nothing to test.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'functions/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts', 'src/test/**', 'src/main.tsx', 'src/admin/main.tsx', 'src/entry-server.tsx'],
      reporter: ['text-summary', 'json-summary', 'json'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
})
