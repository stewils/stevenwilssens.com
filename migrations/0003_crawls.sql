-- One row per request from a search engine, AI or other crawler, recorded on the
-- server because crawlers rarely run the browser tracker. No IP addresses are stored.
CREATE TABLE crawls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,              -- epoch milliseconds (server time)
  bot TEXT NOT NULL,                -- crawler name, such as Googlebot or GPTBot
  operator TEXT,                    -- company behind it, when known
  category TEXT NOT NULL,           -- search | ai-search | ai-training | ai-assistant | social | seo | other
  path TEXT NOT NULL,
  status INTEGER,                   -- HTTP status the site answered with
  user_agent TEXT,
  country TEXT,
  asn INTEGER,
  as_org TEXT                       -- network it came from; a faked user agent shows up as an unexpected network
);

CREATE INDEX crawls_ts ON crawls (ts);
