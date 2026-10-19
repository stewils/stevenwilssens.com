-- Every question asked of the site assistant, so /admin shows how many people used
-- it and what they asked. The visitor is the analytics' daily-rotating code (no IP
-- address), so one person counts once a day and links to that day's visit. Email
-- addresses, phone numbers and keys are redacted; a pasted job description is kept
-- as its size and first words only. Not written when the browser sends Global
-- Privacy Control or Do Not Track. Kept 90 days, as /privacy says.
CREATE TABLE IF NOT EXISTS ask_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,              -- epoch milliseconds
  visitor TEXT NOT NULL,            -- daily-rotating visitor code, as in events.visitor
  kind TEXT NOT NULL,               -- question | fit
  page TEXT,                        -- the page the visitor was on
  question TEXT NOT NULL,
  answer TEXT,
  outcome TEXT NOT NULL,            -- answered | gap | off | limited | failed
  country TEXT,
  as_org TEXT
);

CREATE INDEX IF NOT EXISTS ask_log_ts ON ask_log (ts);
