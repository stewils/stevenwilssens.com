// @vitest-environment node
// The traffic summary for site_analytics, from the real SQL on an in-memory SQLite with
// every migration applied, and the sentences Claude reads instead of the tables.
import { describe, expect, it } from 'vitest'
import { fakeD1, type FakeD1 } from './testing/d1'
import { describeTraffic, trafficSummary, type TrafficSummary } from './traffic'

const now = Date.UTC(2026, 9, 19, 12)
const day = 86_400_000

const event = (db: FakeD1, row: Record<string, unknown>) => {
  const columns = Object.keys(row)
  db.sqlite.prepare(`INSERT INTO events (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...(Object.values(row) as (string | number | null)[]))
}
const pageview = (db: FakeD1, visitor: string, ts: number, extra: Record<string, unknown> = {}) => event(db, { type: 'pageview', visitor, ts, path: '/', ...extra })
const crawl = (db: FakeD1, bot: string, category: string, ts: number, path = '/', operator: string | null = null) =>
  db.sqlite.prepare('INSERT INTO crawls (ts, bot, operator, category, path) VALUES (?, ?, ?, ?, ?)').run(ts, bot, operator, category, path)

describe('the traffic summary', () => {
  it('answers zeros and empty lists for an empty database', async () => {
    const summary = await trafficSummary(fakeD1(), 7, now)
    expect(summary).toMatchObject({ days: 7, from: '2026-10-12', to: '2026-10-19', daily: [], topPages: [], referrers: [], channels: [], countries: [], organizations: [] })
    expect(summary.people).toEqual({ visitors: 0, pageviews: 0, previousVisitors: 0, previousPageviews: 0, resumeDownloads: 0, contactClicks: 0, avgSecondsOnPage: null, avgScrollPct: null })
    expect(summary.crawlers).toEqual({ requests: 0, bots: 0, byCategory: { search: 0, aiSearch: 0, aiTraining: 0, aiAssistant: 0, social: 0, seo: 0, other: 0 }, topBots: [], topPages: [] })
    expect(summary.assistant).toEqual({ questions: 0, answered: 0, gaps: 0, helpful: 0, unhelpful: 0 })
    expect(summary.publicMcp).toEqual({ calls: 0, byTool: [] })
  })

  it('sums people, crawlers, the assistant and the public MCP server over the period', async () => {
    const db = fakeD1()
    // This period: three visitors over two days; the period before: one.
    pageview(db, 'v1', now - 1 * day, { path: '/about', referrer: 'https://www.linkedin.com/feed/', referrer_host: 'www.linkedin.com', country: 'BE', as_org: 'Proximus' })
    pageview(db, 'v1', now - 1 * day + 1000, { path: '/experience', country: 'BE', as_org: 'Proximus' })
    pageview(db, 'v2', now - 2 * day, { path: '/about', utm_source: 'resume', country: 'US' })
    pageview(db, 'v3', now - 2 * day + 5, { path: '/', referrer: 'https://www.google.com/', referrer_host: 'www.google.com' })
    pageview(db, 'v4', now - 2 * day + 9, { path: '/', utm_source: 'github', referrer: 'https://github.com/stewils', referrer_host: 'github.com' })
    pageview(db, 'old', now - 10 * day)
    event(db, { type: 'engagement', visitor: 'v1', ts: now - day, pageview_id: 'p1', duration_ms: 30_000, scroll_pct: 50 })
    event(db, { type: 'engagement', visitor: 'v1', ts: now - day, pageview_id: 'p1', duration_ms: 40_000, scroll_pct: 90 })
    event(db, { type: 'engagement', visitor: 'v2', ts: now - day, pageview_id: 'p2', duration_ms: 20_000, scroll_pct: 30 })
    event(db, { type: 'click', visitor: 'v1', ts: now - day, category: 'download' })
    event(db, { type: 'click', visitor: 'v1', ts: now - day, category: 'email' })
    event(db, { type: 'click', visitor: 'v2', ts: now - day, category: 'outbound' })
    crawl(db, 'Googlebot', 'search', now - day, '/', 'Google')
    crawl(db, 'Googlebot', 'search', now - day, '/about', 'Google')
    crawl(db, 'GPTBot', 'ai-training', now - day, '/about', 'OpenAI')
    crawl(db, 'ChatGPT-User', 'ai-assistant', now - 3 * day, '/', 'OpenAI')
    crawl(db, 'OAI-SearchBot', 'ai-search', now - 3 * day, '/')
    crawl(db, 'Old', 'seo', now - 30 * day)
    db.sqlite.prepare("INSERT INTO ask_daily (day, outcome, questions) VALUES ('2026-10-18', 'answered', 4), ('2026-10-18', 'gap', 1), ('2026-10-17', 'off', 2), ('2026-09-01', 'answered', 9)").run()
    db.sqlite.prepare("INSERT INTO ask_votes (day, helpful, unhelpful) VALUES ('2026-10-18', 3, 1), ('2026-09-01', 9, 9)").run()
    db.sqlite.prepare('INSERT INTO mcp_calls (ts, tool) VALUES (?, ?), (?, ?), (?, ?), (?, ?)').run(now - day, 'about_steven', now - day, 'about_steven', now - day, 'get_role', now - 30 * day, 'about_steven')

    const summary = await trafficSummary(db, 7, now)
    expect(summary.people).toEqual({ visitors: 4, pageviews: 5, previousVisitors: 1, previousPageviews: 1, resumeDownloads: 1, contactClicks: 2, avgSecondsOnPage: 30, avgScrollPct: 60 })
    expect(summary.daily).toEqual([
      { day: '2026-10-16', visitors: 0, pageviews: 0, crawlerRequests: 2, aiRequests: 2 },
      { day: '2026-10-17', visitors: 3, pageviews: 3, crawlerRequests: 0, aiRequests: 0 },
      { day: '2026-10-18', visitors: 1, pageviews: 2, crawlerRequests: 3, aiRequests: 1 },
    ])
    expect(summary.topPages[0]).toEqual({ path: '/about', views: 2, visitors: 2 })
    expect(summary.referrers).toEqual(expect.arrayContaining([{ name: 'www.linkedin.com', visitors: 1 }, { name: 'Direct / none', visitors: 1 }]))
    expect(summary.channels.map((channel) => channel.name).sort()).toEqual(['LinkedIn', 'Resume', 'Search', 'Tagged'])
    expect(summary.channels.find((channel) => channel.name === 'Search')).toEqual({ name: 'Search', visitors: 1, detail: 'www.google.com' })
    expect(summary.channels.find((channel) => channel.name === 'Resume')).toEqual({ name: 'Resume', visitors: 1, detail: '' })
    expect(summary.channels.find((channel) => channel.name === 'Tagged')?.detail).toBe('github')
    expect(summary.countries[0]).toEqual({ name: 'Unknown', visitors: 2 })
    expect(summary.organizations).toContainEqual({ name: 'Proximus', visitors: 1 })
    expect(summary.crawlers).toMatchObject({ requests: 5, bots: 4, byCategory: { search: 2, aiSearch: 1, aiTraining: 1, aiAssistant: 1, social: 0, seo: 0, other: 0 } })
    expect(summary.crawlers.topBots[0]).toEqual({ bot: 'Googlebot', operator: 'Google', category: 'search', requests: 2, pages: 2, lastSeen: '2026-10-18' })
    expect(summary.crawlers.topPages).toContainEqual({ path: '/', requests: 3, aiRequests: 2 })
    expect(summary.assistant).toEqual({ questions: 7, answered: 4, gaps: 1, helpful: 3, unhelpful: 1 })
    expect(summary.publicMcp).toEqual({ calls: 3, byTool: [{ tool: 'about_steven', calls: 2 }, { tool: 'get_role', calls: 1 }] })
  })

  it('passes a D1 failure on to the caller', async () => {
    const db = fakeD1()
    db.failOn = /FROM crawls/
    await expect(trafficSummary(db, 7, now)).rejects.toThrow('D1_ERROR')
  })
})

const summary = (overrides: Partial<TrafficSummary> = {}): TrafficSummary => ({
  days: 7, from: '2026-10-12', to: '2026-10-19',
  people: { visitors: 12, pageviews: 30, previousVisitors: 10, previousPageviews: 20, resumeDownloads: 2, contactClicks: 1, avgSecondsOnPage: 42, avgScrollPct: 60 },
  daily: [], topPages: [{ path: '/', views: 20, visitors: 10 }, { path: '/about', views: 10, visitors: 5 }], referrers: [],
  channels: [{ name: 'LinkedIn', visitors: 6, detail: 'lnkd.in' }, { name: 'Direct', visitors: 4, detail: '' }], countries: [], organizations: [],
  crawlers: { requests: 50, bots: 5, byCategory: { search: 20, aiSearch: 5, aiTraining: 10, aiAssistant: 2, social: 3, seo: 4, other: 6 }, topBots: [{ bot: 'Googlebot', operator: 'Google', category: 'search', requests: 20, pages: 9, lastSeen: '2026-10-19' }], topPages: [] },
  assistant: { questions: 9, answered: 7, gaps: 2, helpful: 3, unhelpful: 1 },
  publicMcp: { calls: 1, byTool: [] },
  ...overrides,
})

describe('describing the traffic', () => {
  it('says how the period compares, where people came from and what crawled', () => {
    expect(describeTraffic(summary())).toEqual([
      'People, last 7 days (2026-10-12 to 2026-10-19): 12 visitors (+20% vs the 7 days before), 30 pageviews, 2 résumé downloads, 1 contact click, about 42s on a page.',
      'Crawlers: 50 requests from 5 bots; 17 from AI (5 AI search, 10 training, 2 assistants fetching for a person), 20 search engines, 13 other.',
      'Top pages: / (20), /about (10).',
      'Where people came from: LinkedIn 6 (lnkd.in), Direct 4.',
      'Busiest bots: Googlebot 20.',
      'The site assistant: 9 questions, 7 answered, 2 it could not answer, 3 voted helpful and 1 not. Public MCP server: 1 call.',
    ])
  })

  it('handles a quiet period: drops, no previous visitors, nothing at all', () => {
    const down = describeTraffic(summary({ days: 1, people: { visitors: 1, pageviews: 1, previousVisitors: 4, previousPageviews: 4, resumeDownloads: 0, contactClicks: 0, avgSecondsOnPage: null, avgScrollPct: null } }))
    expect(down[0]).toBe('People, last 1 day (2026-10-12 to 2026-10-19): 1 visitor (-75% vs the 1 day before), 1 pageview, 0 résumé downloads, 0 contact clicks.')
    const fresh = describeTraffic(summary({ people: { ...summary().people, previousVisitors: 0 } }))
    expect(fresh[0]).toContain('(up from none vs')
    const empty = describeTraffic(summary({ people: { ...summary().people, visitors: 0, previousVisitors: 0 }, topPages: [], channels: [], crawlers: { ...summary().crawlers, topBots: [] } }))
    expect(empty[0]).toContain('0 visitors (no change vs')
    expect(empty).toHaveLength(3)
  })
})
