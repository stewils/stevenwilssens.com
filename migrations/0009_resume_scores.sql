-- The résumé score of every résumé that went live, one row per PDF (keyed by the
-- PDF's hash), so /admin shows how the score moved with each update. Written by
-- functions/_lib/resume-scores.ts from the report the build writes
-- (dist/resume-report.json).
CREATE TABLE IF NOT EXISTS resume_scores (
  pdf_hash TEXT PRIMARY KEY,
  score INTEGER NOT NULL,
  errors INTEGER NOT NULL DEFAULT 0,
  warnings INTEGER NOT NULL DEFAULT 0,
  pages INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  commit_sha TEXT,
  commit_message TEXT,
  findings TEXT NOT NULL DEFAULT '[]',
  checked_at INTEGER NOT NULL,
  first_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS resume_scores_first_seen ON resume_scores (first_seen);
