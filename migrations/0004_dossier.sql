-- The career dossier behind /mcp: facts and stories Steven records in interview
-- sessions (owner mode), served to recruiters' assistants when marked public.
CREATE TABLE dossier (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,      -- epoch milliseconds
  updated_at INTEGER NOT NULL,
  role TEXT NOT NULL,               -- a key from src/resume.ts, or 'general'
  topic TEXT NOT NULL,              -- scope | outcomes | decisions | challenges | lessons | people | skills | story | transition | ...
  title TEXT NOT NULL,              -- one-line headline
  body TEXT NOT NULL,               -- the fact or story
  visibility TEXT NOT NULL DEFAULT 'private',  -- public | private
  tags TEXT                         -- comma-separated keywords
);

CREATE INDEX dossier_role ON dossier (role, visibility);

-- Every call to a public MCP tool, so gaps in the dossier show up in /admin.
-- No IP addresses: visitor is the same daily-rotating hash as analytics.
CREATE TABLE dossier_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  visitor TEXT,
  tool TEXT NOT NULL,
  query TEXT,
  role TEXT,
  hits INTEGER,
  country TEXT,
  as_org TEXT
);

CREATE INDEX dossier_questions_ts ON dossier_questions (ts);
CREATE INDEX dossier_questions_visitor ON dossier_questions (visitor, ts);

-- Messages left for Steven through the public MCP server.
CREATE TABLE dossier_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  name TEXT,
  company TEXT,
  contact TEXT,
  message TEXT NOT NULL,
  country TEXT,
  as_org TEXT
);

CREATE INDEX dossier_messages_ts ON dossier_messages (ts);

-- Résumé changes the interviewer proposes at the end of a session, for Steven to
-- approve or reject. Approved ones are applied by hand to src/resume.ts and the PDF.
CREATE TABLE resume_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  role TEXT NOT NULL,               -- a role key, or headline | summary | skills | education
  kind TEXT NOT NULL,               -- replace | add | remove
  current_text TEXT,                -- what the résumé says now (null when adding)
  proposed_text TEXT,               -- the new wording (null when removing)
  rationale TEXT NOT NULL,
  based_on TEXT,                    -- dossier entry ids, comma-separated
  status TEXT NOT NULL DEFAULT 'proposed',  -- proposed | approved | rejected | applied
  decision_note TEXT
);

CREATE INDEX resume_proposals_status ON resume_proposals (status, id);
