export type Env = {
  DB: D1Database
  ADMIN_TOKEN?: string
  HASH_SALT?: string
  MCP_OWNER_KEY?: string   // secret that unlocks the interview (write) tools of /mcp
}
