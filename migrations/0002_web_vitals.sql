-- Core Web Vitals measured in real visitors' browsers (type = 'vital').
ALTER TABLE events ADD COLUMN metric TEXT;         -- LCP | INP | CLS | FCP | TTFB
ALTER TABLE events ADD COLUMN metric_value REAL;   -- ms, or unitless for CLS
ALTER TABLE events ADD COLUMN metric_rating TEXT;  -- good | needs-improvement | poor
