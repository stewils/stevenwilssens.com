export type Env = {
  DB: D1Database
  ASSETS: Fetcher          // the site's static files, provided by Pages
  ADMIN_TOKEN?: string
  HASH_SALT?: string
  MCP_OWNER_KEY?: string   // the only key to /mcp: Steven's private career workspace
}
