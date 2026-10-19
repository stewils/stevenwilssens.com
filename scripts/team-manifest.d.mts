// Types for scripts/team-manifest.mjs, for vite.config.ts (the teamManifest plugin).
export type ManifestOptions = { root?: string; ref?: string; maxUpdates?: number; maxBytes?: number; now?: Date }
export const SCHEMA: string
export function manifestModule(options?: ManifestOptions): { code: string; problems: string[] }
