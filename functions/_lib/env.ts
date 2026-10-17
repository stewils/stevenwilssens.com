export type Env = {
  DB: D1Database
  ASSETS: Fetcher            // the site's static files, provided by Pages
  ADMIN_TOKEN?: string
  HASH_SALT?: string
  MCP_OWNER_KEY?: string     // the only key to /mcp: Steven's private career workspace
  // "Ask about Steven", the assistant on the site (functions/_lib/ask).
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_WORKSPACE_ID?: string   // when the key was made outside a workspace
  ASK_BUDGET_USD?: string           // monthly cap, default 25
  ASK_MOCK?: string                 // '1' locally: canned answers, no API call
  TURNSTILE_SECRET_KEY?: string     // with TURNSTILE_SITE_KEY: a human check before the first question
  TURNSTILE_SITE_KEY?: string
}
