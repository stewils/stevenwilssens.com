export type Env = {
  DB: D1Database
  ASSETS: Fetcher            // the site's static files, provided by Pages
  ADMIN_TOKEN?: string
  HASH_SALT?: string
  MCP_OWNER_KEY?: string     // the only key to /mcp: Steven's private career workspace
  // The MCP server's site updates: starts the "Site update" GitHub workflow and reads
  // runs and pull requests. A fine-grained token with Actions: write, Contents: read,
  // Pull requests: write on the repository; GITHUB_REPO defaults to stewils/stevenwilssens.com.
  GITHUB_TOKEN?: string
  GITHUB_REPO?: string
  // "Ask about Steven", the assistant on the site (functions/_lib/ask).
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_WORKSPACE_ID?: string   // when the key was made outside a workspace
  ASK_BUDGET_USD?: string           // monthly cap, default 25
  ASK_MOCK?: string                 // '1' locally: canned answers, no API call
  ASK_CHECK_AFTER_USD?: string      // the human check switches on once the day's spend passes this, default 10
  TURNSTILE_SECRET_KEY?: string     // with TURNSTILE_SITE_KEY: a human check when the assistant looks under attack
  TURNSTILE_SITE_KEY?: string
}
