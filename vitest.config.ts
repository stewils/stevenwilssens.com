import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // The Team page's build-time manifest (vite.config.ts): the tests get a fixed one, never this repository's history.
  resolve: { alias: { 'virtual:team-manifest': fileURLToPath(new URL('./src/test/team-manifest.fixture.ts', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Not this repository's tests: a reviewer's copy of main under .review/, and the projects
    // the Site update workflow checks out into sources/.
    exclude: [...configDefaults.exclude, '.review/**', 'sources/**'],
    css: false,
    // `npm run test:coverage` (and the Review workflow) fail when any file is below 90%
    // (perFile). Left out: the code that only starts the app in a browser or the build
    // (nothing to test) and the test helpers (src/test, functions/_lib/testing). The
    // gates' pure parts are in (the recruiter comparison, the resume gate's exit code, the
    // screenshot options): a CI gate needs tests like the site does.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'functions/**/*.ts', 'scripts/recruiter-compare.mjs', 'scripts/resume-gate.mjs', 'scripts/screenshots-options.mjs', 'scripts/team-manifest.mjs', 'scripts/claude-run-summary.mjs', 'scripts/site-update-outcome.mjs', 'scripts/building-feed.mjs', 'scripts/site-update-bundle.mjs', 'scripts/assistant-check.mjs', 'scripts/assistant-export.ts', 'scripts/resume-data.mjs'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts', 'src/test/**', 'functions/_lib/testing/**', 'src/main.tsx', 'src/admin/main.tsx', 'src/entry-server.tsx'],
      reporter: ['text-summary', 'json-summary', 'json'],
      thresholds: { perFile: true, statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
})
