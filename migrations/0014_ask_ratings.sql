-- What produced each logged answer, and Steven's ratings of them (/admin → Ask about
-- Steven → Answer quality and Rate answers). 0014, not 0013: dev-costs takes 0013.

-- The model that served the answer (pattern-checked on the server, else the configured
-- one; `mock` for the canned local stream), whether a server-side fallback served it,
-- the instruction version (rules, the fit-check prefix, the fixed replies, the request
-- settings) and the knowledge version (the dossier part of the system prompt), each
-- 8 hex characters, and the source ids an answered answer cited (a JSON array).
-- Rows logged before this migration have NULLs.
ALTER TABLE ask_log ADD COLUMN model TEXT;
ALTER TABLE ask_log ADD COLUMN fallback INTEGER;
ALTER TABLE ask_log ADD COLUMN prompt_version TEXT;
ALTER TABLE ask_log ADD COLUMN knowledge_version TEXT;
ALTER TABLE ask_log ADD COLUMN sources TEXT;

-- Steven's rating of one logged answer, one per answer. It outlives the log: when prune()
-- deletes the ask_log row, log_id, note and question_id are cleared, and the day, the
-- versions, the kind, the outcome and the scores stay. The answer's day only, never its
-- time, so a kept rating cannot be joined back to one visitor's session.
CREATE TABLE IF NOT EXISTS ask_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_id INTEGER UNIQUE,            -- ask_log.id; NULL once pruned (no FOREIGN KEY: prune clears it itself)
  day TEXT NOT NULL,                -- the answer's day, YYYY-MM-DD UTC
  model TEXT,                       -- these five are copied from the ask_log row on the server
  fallback INTEGER,
  prompt_version TEXT,
  knowledge_version TEXT,
  kind TEXT NOT NULL,               -- question | fit
  outcome TEXT NOT NULL,            -- answered | gap | off
  accurate TEXT NOT NULL CHECK (accurate IN ('yes', 'partly', 'no')),
  supported TEXT NOT NULL CHECK (supported IN ('yes', 'partly', 'no', 'na')),
  answers TEXT NOT NULL CHECK (answers IN ('yes', 'partly', 'no')),
  tone TEXT NOT NULL CHECK (tone IN ('yes', 'partly', 'no', 'na')),
  overall INTEGER NOT NULL CHECK (overall BETWEEN 1 AND 5),
  note TEXT,                        -- Steven's, at most 1,000 characters; cleared with the log row
  question_id INTEGER,              -- the ask_questions row "Add to my questions" made, so a re-save adds no second
  rated_at INTEGER NOT NULL         -- epoch milliseconds, when Steven rated it
);

CREATE INDEX IF NOT EXISTS ask_ratings_day ON ask_ratings (day);
