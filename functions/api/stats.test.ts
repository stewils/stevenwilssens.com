// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Env } from '../_lib/env'
import { context, fakeD1, type FakeD1 } from '../_lib/testing/d1'
import { onRequestGet } from './stats'

const token = 'admin-secret'
const get = (query = '', auth: string | null = `Bearer ${token}`) => new Request(`https://steven.wilssens.com/api/stats${query}`, { headers: auth ? { Authorization: auth } : {} })
const send = async (request: Request, db: FakeD1 = fakeD1(), env: Partial<Env> = { ADMIN_TOKEN: token }) => {
  const { ctx } = context(request, { DB: db, ...env } as Env)
  return onRequestGet(ctx)
}

const now = Date.now()
const event = (db: FakeD1, row: Record<string, unknown>) => {
  const columns = Object.keys(row)
  db.sqlite.prepare(`INSERT INTO events (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...(Object.values(row) as (string | number | null)[]))
}
const seed = (db: FakeD1) => {
  const base = { host: 'steven.wilssens.com', browser: 'Chrome', browser_version: '141', os: 'Windows', device: 'desktop', country: 'BE', city: 'Ghent', region: 'Flanders', as_org: 'Example ISP', language: 'en', screen: '1920x1080' }
  // A recruiter from LinkedIn reads two pages and downloads the résumé.
  event(db, { ...base, ts: now - 3_600_000, type: 'pageview', visitor: 'v1', pageview_id: 'a', path: '/', referrer: 'https://www.linkedin.com/feed/', referrer_host: 'linkedin.com' })
  event(db, { ...base, ts: now - 3_500_000, type: 'pageview', visitor: 'v1', pageview_id: 'b', path: '/experience' })
  event(db, { ...base, ts: now - 3_400_000, type: 'engagement', visitor: 'v1', pageview_id: 'a', duration_ms: 30_000, scroll_pct: 80 })
  event(db, { ...base, ts: now - 3_300_000, type: 'click', visitor: 'v1', category: 'download', label: 'Resume PDF', target: '/r.pdf', context: 'header' })
  // A tagged visit from a newsletter, and a direct one.
  event(db, { ...base, ts: now - 7_200_000, type: 'pageview', visitor: 'v2', pageview_id: 'c', path: '/about', utm_source: 'newsletter', utm_medium: 'email' })
  event(db, { ...base, ts: now - 7_100_000, type: 'pageview', visitor: 'v3', pageview_id: 'd', path: '/', utm_source: 'Hacker News' })
  event(db, { ...base, ts: now - 7_000_000, type: 'pageview', visitor: 'v4', pageview_id: 'e', path: '/' })
  event(db, { ...base, ts: now - 7_000_000, type: 'click', visitor: 'v4', category: 'email', label: 'Email' })
  event(db, { ...base, ts: now - 6_000_000, type: 'vital', visitor: 'v4', path: '/', metric: 'LCP', metric_value: 1200, metric_rating: 'good' })
  // The period before: one pageview 40 days ago.
  event(db, { ...base, ts: now - 40 * 86_400_000, type: 'pageview', visitor: 'old', pageview_id: 'z', path: '/' })
  db.sqlite.prepare('INSERT INTO crawls (ts, bot, operator, category, path, status, as_org) VALUES (?, ?, ?, ?, ?, ?, ?)').run(now - 1000, 'Googlebot', 'Google', 'search', '/', 200, 'Google LLC')
  db.sqlite.prepare('INSERT INTO crawls (ts, bot, operator, category, path, status, as_org) VALUES (?, ?, ?, ?, ?, ?, ?)').run(now - 900, 'Scanner', null, 'other', '/wp-login.php', 404, 'Cheap VPS')
}

describe('GET /api/stats', () => {
  it('refuses without the admin token, with a wrong one, and when no token is configured', async () => {
    const db = fakeD1()
    for (const [request, env] of [[get('', null), { ADMIN_TOKEN: token }], [get('', 'Bearer nope'), { ADMIN_TOKEN: token }], [get('', `Bearer ${token}x`), { ADMIN_TOKEN: token }], [get('', 'Bearer '), {}], [get(''), {}]] as const) {
      const response = await send(request, db, env)
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'unauthorized' })
    }
    // Nothing was read.
    expect(db.queries).toHaveLength(0)
  })

  it('answers the dashboard: totals, the period before, pages, channels, visitors, vitals and crawlers', async () => {
    const db = fakeD1()
    seed(db)
    const response = await send(get('?days=30&tz=120'), db)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const data = await response.json() as Record<string, any>
    expect(data.days).toBe(30)
    expect(data.totals).toMatchObject({ pageviews: 5, visitors: 4, downloads: 1, downloaders: 1, contactClicks: 1, avgDurationMs: 30_000, avgScrollPct: 80 })
    expect(data.previous).toMatchObject({ pageviews: 1, visitors: 1, downloads: 0, contactClicks: 0 })
    expect(data.pages[0]).toMatchObject({ name: '/', views: 3 })
    expect(data.entryPages[0]).toMatchObject({ name: '/', visitors: 3 })
    expect(data.referrers).toEqual(expect.arrayContaining([{ name: 'linkedin.com', visitors: 1 }, { name: 'Direct / none', visitors: 3 }]))
    expect(data.utmSources).toEqual(expect.arrayContaining([{ name: 'newsletter', visitors: 1 }, { name: '(none)', visitors: 2 }]))
    expect(data.countries[0]).toMatchObject({ name: 'BE', visitors: 4 })
    expect(data.cities[0].name).toBe('Ghent, Flanders, BE')
    expect(data.browsers[0].name).toBe('Chrome 141')
    expect(data.clicks).toHaveLength(2)
    expect(data.entries).toBeUndefined()
    // The newsletter is Email; "Hacker News" is a tag that names itself; LinkedIn has no extra detail.
    const channels = Object.fromEntries((data.channels as { name: string; visitors: number; detail: string }[]).map((c) => [c.name, c]))
    expect(channels.Email).toEqual({ name: 'Email', visitors: 1, detail: 'newsletter' })
    expect(channels.Tagged).toEqual({ name: 'Tagged', visitors: 1, detail: 'Hacker News' })
    expect(channels.LinkedIn).toEqual({ name: 'LinkedIn', visitors: 1, detail: 'linkedin.com' })
    expect(channels.Direct).toEqual({ name: 'Direct', visitors: 1, detail: '' })
    const v1 = (data.visitors as Record<string, unknown>[]).find((v) => v.visitor === 'v1')
    expect(v1).toMatchObject({ pageviews: 2, journey: '/ → /experience', downloaded: 1, clicked: 'Resume PDF', referrer: 'linkedin.com', channel: 'LinkedIn', engagedMs: 30_000 })
    const visitor = (id: string) => (data.visitors as Record<string, unknown>[]).find((v) => v.visitor === id)
    expect(visitor('v2')).toMatchObject({ downloaded: 0, clicked: null, engagedMs: null, utmSource: 'newsletter', utmMedium: 'email', channel: 'Email' })
    expect(visitor('v4')).toMatchObject({ downloaded: 0, clicked: 'Email' })
    expect(data.vitals).toBeTruthy()
    expect(data.crawlTotals).toMatchObject({ requests: 2, bots: 2, search: 1, errors: 0, probes: 1 })
    expect(data.crawlBots[0].bot).toBeTruthy()
    expect(data.recent.every((row: { type: string }) => row.type !== 'vital')).toBe(true)
  })

  it('names the biggest sources behind a channel first', async () => {
    const db = fakeD1()
    const base = { host: 'steven.wilssens.com', browser: 'Chrome', os: 'Windows', device: 'desktop', path: '/', type: 'pageview' }
    event(db, { ...base, ts: now - 1000, visitor: 'a', utm_source: 'gmail' })
    event(db, { ...base, ts: now - 1000, visitor: 'b', utm_source: 'newsletter' })
    event(db, { ...base, ts: now - 1000, visitor: 'c', utm_source: 'newsletter' })
    const data = await (await send(get(), db)).json() as { channels: { name: string; visitors: number; detail: string }[] }
    expect(data.channels).toEqual([{ name: 'Email', visitors: 3, detail: 'newsletter, gmail' }])
  })

  it('keeps the period between a day and a year and the time zone within fourteen hours, whatever is asked', async () => {
    for (const [query, days] of [['?days=0', 30], ['?days=-4', 1], ['?days=9999', 365], ['?days=abc', 30], ['?days=7&tz=99999', 7], ['?tz=-99999', 30]] as const) {
      const response = await send(get(query))
      expect(response.status).toBe(200)
      expect(((await response.json()) as { days: number }).days).toBe(days)
    }
    // The offset in the SQL text stops at fourteen hours either way (840 minutes).
    for (const [tz, seconds] of [['99999', 50400], ['-99999', -50400]] as const) {
      const db = fakeD1()
      await send(get(`?tz=${tz}`), db)
      expect(db.queries.some((sql) => sql.includes(`(ts / 1000) + ${seconds}, 'unixepoch'`))).toBe(true)
    }
  })

  it('never puts request input into the SQL text', async () => {
    const db = fakeD1()
    await send(get("?days=1);DROP TABLE events;--&tz=1);DROP TABLE crawls;--"), db)
    expect(db.queries.join('\n')).not.toContain('DROP')
    expect(db.queries.some((sql) => sql.includes("(ts / 1000) + 0, 'unixepoch'"))).toBe(true)
  })
})
