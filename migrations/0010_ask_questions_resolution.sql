-- A question the site assistant could not answer can now be closed from the MCP:
-- answered with a dossier entry (the assistant knows it from the next question on)
-- or dismissed. Open questions have resolved_at NULL. A job description checked on
-- the site adds its unmatched requirements the same way (reason 'fit').
ALTER TABLE ask_questions ADD COLUMN resolved_at INTEGER;
ALTER TABLE ask_questions ADD COLUMN resolution TEXT;     -- answered | dismissed
ALTER TABLE ask_questions ADD COLUMN entry_id INTEGER;     -- the dossier entry that answers it

-- Every call to the public, read-only MCP server at /mcp (functions/_lib/mcp/server.ts),
-- so /admin shows whether recruiters' assistants use it. Tool name and query only; no IP
-- address, no visitor hash; kept 90 days.
CREATE TABLE IF NOT EXISTS mcp_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,              -- epoch milliseconds
  tool TEXT NOT NULL,
  query TEXT,                       -- the first text argument, shortened
  role TEXT,                        -- the role key, when the call had one
  hits INTEGER,                     -- results returned by a search
  country TEXT,
  as_org TEXT
);

CREATE INDEX IF NOT EXISTS mcp_calls_ts ON mcp_calls (ts);
