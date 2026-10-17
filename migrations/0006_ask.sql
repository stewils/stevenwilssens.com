-- "Ask about Steven": the assistant on the site (functions/_lib/ask). No IP
-- addresses are stored: ask_hits keeps a salted hash for the hourly limit only.
CREATE TABLE ask_hits (
  ip_hash TEXT NOT NULL,
  ts INTEGER NOT NULL               -- epoch milliseconds
);

CREATE INDEX ask_hits_ip ON ask_hits (ip_hash, ts);

-- One row per day and outcome: what was asked, what it cost (micro-dollars,
-- from the API's own token counts), and how fast it answered.
CREATE TABLE ask_daily (
  day TEXT NOT NULL,                -- YYYY-MM-DD (UTC)
  outcome TEXT NOT NULL,            -- answered | gap | off | limited | failed
  questions INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cost_micro INTEGER NOT NULL DEFAULT 0,
  ms_first INTEGER NOT NULL DEFAULT 0,   -- summed time to the first word
  ms_total INTEGER NOT NULL DEFAULT 0,   -- summed time to the last word
  PRIMARY KEY (day, outcome)
);

-- Thumbs up and down on answers, per day.
CREATE TABLE ask_votes (
  day TEXT PRIMARY KEY,
  helpful INTEGER NOT NULL DEFAULT 0,
  unhelpful INTEGER NOT NULL DEFAULT 0
);

-- Questions the assistant could not answer from Steven's notes (gap), or whose
-- answer was voted not helpful. Redacted, kept 90 days, shown on /admin and
-- suggested in the MCP interview so the dossier can fill the gap.
CREATE TABLE ask_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  reason TEXT NOT NULL,             -- gap | unhelpful
  page TEXT,                        -- the page the visitor was on
  question TEXT NOT NULL,
  answer TEXT,
  country TEXT,
  as_org TEXT
);

CREATE INDEX ask_questions_ts ON ask_questions (ts);
