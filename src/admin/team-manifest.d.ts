// The Team page's manifest, generated at build time by scripts/team-manifest.mjs and served by
// the teamManifest plugin in vite.config.ts. Import it only from src/admin/ (the admin bundle);
// the tests map it to src/test/team-manifest.fixture.ts (vitest.config.ts).
declare module 'virtual:team-manifest' {
  const manifest: import('./team-types').TeamManifest
  export default manifest
}
