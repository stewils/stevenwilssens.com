-- What each change cost to build with Claude (/admin#costs). One row per GitHub run (the
-- Review or Site update workflow's Claude step: its reported cost, model 'reported') or per
-- local Claude Code session, branch, batch of agents, role and model (tokens only; priced
-- when read, from functions/_lib/prices.ts, so a corrected price fixes the history).
-- Written only by POST /api/costs with COSTS_INGEST_TOKEN, always as an upsert on the
-- unique key below; no round and no phase is stored (both are worked out when read).
-- Admin only: nothing public reads these tables. No visitor data.
CREATE TABLE IF NOT EXISTS dev_cost_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,                 -- github | local
  run_key TEXT NOT NULL,                -- github:<run_id>:<attempt>:<job> | local:<session uuid>, built by the server
  branch TEXT NOT NULL,                 -- main and HEAD collect under "No feature"
  pr INTEGER,                           -- github only; for site-update rows advisory (GitHub is asked when read)
  workflow TEXT,                        -- review | site-update (github)
  job TEXT,                             -- team | update (github)
  run_id INTEGER,
  run_attempt INTEGER,                  -- github: (run_id, run_attempt) orders the Review rounds of a pull request
  role TEXT NOT NULL,                   -- lead | the subagent's type | review-workflow | site-update-workflow
  batch INTEGER NOT NULL DEFAULT 0,     -- local: the lead message that started the agents; 0 for the lead and github
  batch_at INTEGER NOT NULL,            -- epoch ms: orders the batches of a feature across sessions
  model TEXT NOT NULL,                  -- the model id (<id>:fast for fast mode), or 'reported' for github
  billing TEXT NOT NULL,                -- billed | estimated | unknown
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_5m_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_1h_tokens INTEGER NOT NULL DEFAULT 0,
  reported_micro INTEGER,               -- github: total_cost_usd in micro-dollars
  num_turns INTEGER,
  duration_ms INTEGER,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,            -- an upsert only replaces a row with figures at least this new
  received_at INTEGER NOT NULL,         -- when the row was last written: the daily write cap counts these
  UNIQUE (run_key, branch, batch, role, model)
);
CREATE INDEX IF NOT EXISTS dev_cost_runs_received ON dev_cost_runs (received_at);

-- Steven's budget per feature (branch), in micro-dollars. No default budget.
CREATE TABLE IF NOT EXISTS dev_cost_budgets (
  branch TEXT PRIMARY KEY,
  budget_micro INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
