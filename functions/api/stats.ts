import type { Env } from '../_lib/env'

// Breakdown dimensions. Keys are fixed here so no request input reaches the SQL text.
// Acquisition dimensions are credited to each visitor's first pageview, so moving
// between pages on the site does not show up as "Direct" traffic.
const acquisition: Record<string, string> = {
  referrers: "COALESCE(referrer_host, 'Direct / none')",
  utmSources: "COALESCE(utm_source, '(none)')",
  utmCampaigns: "COALESCE(utm_campaign, '(none)')",
}

const dimensions: Record<string, string> = {
  countries: "COALESCE(country, 'Unknown')",
  cities: "COALESCE(city, '?') || ', ' || COALESCE(region, '?') || ', ' || COALESCE(country, '?')",
  organizations: "COALESCE(as_org, 'Unknown')",
  browsers: "browser || ' ' || COALESCE(browser_version, '')",
  systems: 'os',
  devices: 'device',
  languages: "COALESCE(language, 'Unknown')",
  screens: "COALESCE(screen, 'Unknown')",
}

const sameLength = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!env.ADMIN_TOKEN || !sameLength(token, env.ADMIN_TOKEN)) return json({ error: 'unauthorized' }, 401)

  const url = new URL(request.url)
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 365)
  const tz = Math.min(Math.max(Number(url.searchParams.get('tz')) || 0, -840), 840)
  const since = Date.now() - days * 86_400_000
  const local = `(ts / 1000) + ${tz * 60}, 'unixepoch'`
  const views = `WITH pv AS (SELECT * FROM events WHERE type = 'pageview' AND ts >= ?1),
    eng AS (SELECT pageview_id, MAX(duration_ms) AS duration, MAX(scroll_pct) AS scroll FROM events WHERE type = 'engagement' AND ts >= ?1 GROUP BY pageview_id)`

  const queries: Record<string, string> = {
    totals: `${views} SELECT
      (SELECT COUNT(*) FROM pv) AS pageviews,
      (SELECT COUNT(DISTINCT visitor) FROM pv) AS visitors,
      (SELECT AVG(duration) FROM eng) AS avgDurationMs,
      (SELECT AVG(scroll) FROM eng) AS avgScrollPct,
      (SELECT AVG(n = 1) FROM (SELECT COUNT(*) AS n FROM pv GROUP BY visitor)) AS bounceRate,
      (SELECT COUNT(*) FROM events WHERE type = 'click' AND category = 'download' AND ts >= ?1) AS downloads,
      (SELECT COUNT(DISTINCT visitor) FROM events WHERE type = 'click' AND category = 'download' AND ts >= ?1) AS downloaders,
      (SELECT COUNT(*) FROM events WHERE type = 'click' AND category IN ('email', 'outbound') AND ts >= ?1) AS contactClicks`,
    daily: `${views} SELECT date(${local}) AS day, COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors FROM pv GROUP BY day ORDER BY day`,
    hours: `${views} SELECT CAST(strftime('%H', ${local}) AS INTEGER) AS hour, COUNT(*) AS pageviews FROM pv GROUP BY hour ORDER BY hour`,
    pages: `${views} SELECT path AS name, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors, AVG(eng.duration) AS avgDurationMs, AVG(eng.scroll) AS avgScrollPct
      FROM pv LEFT JOIN eng USING (pageview_id) GROUP BY path ORDER BY views DESC LIMIT 50`,
    entryPages: `${views} SELECT path AS name, COUNT(*) AS visitors FROM (SELECT visitor, path, MIN(ts) FROM pv GROUP BY visitor) GROUP BY path ORDER BY visitors DESC LIMIT 20`,
    clicks: `SELECT category, label, target, context, COUNT(*) AS clicks, COUNT(DISTINCT visitor) AS visitors FROM events
      WHERE type = 'click' AND ts >= ?1 GROUP BY category, label, target, context ORDER BY clicks DESC LIMIT 100`,
    visitors: `${views}, journeys AS (SELECT visitor, group_concat(path, ' → ') AS journey FROM (SELECT visitor, path FROM pv ORDER BY ts) GROUP BY visitor)
      SELECT pv.visitor, MIN(pv.ts) AS firstSeen, MAX(pv.ts) AS lastSeen, COUNT(*) AS pageviews, journeys.journey,
        MAX(pv.city) AS city, MAX(pv.region) AS region, MAX(pv.country) AS country, MAX(pv.as_org) AS organization,
        MAX(pv.browser) AS browser, MAX(pv.os) AS os, MAX(pv.device) AS device, (SELECT referrer_host FROM pv AS e WHERE e.visitor = pv.visitor ORDER BY ts LIMIT 1) AS referrer, (SELECT utm_source FROM pv AS e WHERE e.visitor = pv.visitor ORDER BY ts LIMIT 1) AS utmSource,
        (SELECT SUM(duration) FROM eng WHERE pageview_id IN (SELECT pageview_id FROM pv AS p2 WHERE p2.visitor = pv.visitor)) AS engagedMs,
        EXISTS (SELECT 1 FROM events AS c WHERE c.visitor = pv.visitor AND c.type = 'click' AND c.category = 'download') AS downloaded,
        (SELECT group_concat(DISTINCT c.label) FROM events AS c WHERE c.visitor = pv.visitor AND c.type = 'click') AS clicked
      FROM pv JOIN journeys USING (visitor) GROUP BY pv.visitor ORDER BY lastSeen DESC LIMIT 200`,
    recent: `SELECT ts, type, path, category, label, duration_ms AS durationMs, scroll_pct AS scrollPct, referrer_host AS referrer,
      city, country, as_org AS organization, browser, os, device FROM events WHERE ts >= ?1 ORDER BY ts DESC LIMIT 200`,
  }
  for (const [key, expression] of Object.entries(acquisition)) {
    queries[key] = `SELECT ${expression} AS name, COUNT(*) AS visitors FROM (SELECT *, MIN(ts) FROM events WHERE type = 'pageview' AND ts >= ?1 GROUP BY visitor)
      GROUP BY name ORDER BY visitors DESC LIMIT 50`
  }
  for (const [key, expression] of Object.entries(dimensions)) {
    queries[key] = `SELECT ${expression} AS name, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS pageviews FROM events
      WHERE type = 'pageview' AND ts >= ?1 GROUP BY name ORDER BY visitors DESC, pageviews DESC LIMIT 50`
  }

  const keys = Object.keys(queries)
  const results = await env.DB.batch(keys.map((key) => env.DB.prepare(queries[key]).bind(since)))
  const data: Record<string, unknown> = { days, generatedAt: Date.now() }
  keys.forEach((key, index) => { data[key] = key === 'totals' ? results[index].results[0] : results[index].results })
  return json(data)
}
