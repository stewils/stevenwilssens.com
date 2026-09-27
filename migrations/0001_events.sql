-- One row per tracked event. Visitors are identified by a hash of
-- IP + user agent + a secret salt that rotates daily, so no cookies are
-- used and the same person cannot be followed across days.
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,              -- epoch milliseconds (server time)
  type TEXT NOT NULL,               -- pageview | engagement | click
  visitor TEXT NOT NULL,            -- daily-rotating visitor hash
  pageview_id TEXT,                 -- client id for one page load; joins engagement/clicks to their view
  host TEXT,
  path TEXT,
  title TEXT,
  referrer TEXT,
  referrer_host TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  category TEXT,                    -- click: download | outbound | email | internal | button
  label TEXT,                       -- click: link or button text
  target TEXT,                      -- click: href
  context TEXT,                     -- click: heading of the surrounding section
  duration_ms INTEGER,              -- engagement: time the page was visible
  scroll_pct INTEGER,               -- engagement: deepest scroll reached
  country TEXT,
  region TEXT,
  city TEXT,
  postal_code TEXT,
  timezone TEXT,
  latitude REAL,
  longitude REAL,
  asn INTEGER,
  as_org TEXT,                      -- network owner, often the visitor's company or ISP
  colo TEXT,
  browser TEXT,
  browser_version TEXT,
  os TEXT,
  device TEXT,                      -- desktop | mobile | tablet
  language TEXT,
  screen TEXT,
  viewport TEXT
);

CREATE INDEX events_ts ON events (ts);
CREATE INDEX events_type_ts ON events (type, ts);
CREATE INDEX events_visitor ON events (visitor);
CREATE INDEX events_pageview ON events (pageview_id);
