-- The admin's Team page: which changes to the agent team Steven has seen. One row per
-- update (the commit's full SHA), read 1 or 0. Changes from before the page went live
-- are read unless a row says otherwise, so "mark as unread" stores read = 0 rather than
-- deleting the row. Also created on first use (functions/_lib/team-reads.ts).
CREATE TABLE IF NOT EXISTS team_reads (
  id TEXT PRIMARY KEY CHECK (length(id) = 40 AND id NOT GLOB '*[^0-9a-f]*'),
  read INTEGER NOT NULL CHECK (read IN (0, 1)),
  at INTEGER NOT NULL
);
