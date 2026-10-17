-- Steven's LinkedIn profile as last imported through the MCP server (save_linkedin_profile):
-- one row, the parsed profile as JSON, so compare_linkedin and review_for_recruiters can
-- say what to change on LinkedIn to match the site and the resume.
CREATE TABLE linkedin_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  imported_at INTEGER NOT NULL,     -- epoch milliseconds
  source TEXT NOT NULL,             -- text | csv
  json TEXT NOT NULL
);
