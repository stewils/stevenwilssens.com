// The site's traffic in one summary, for the MCP server's site_analytics tool: who
// came (people, from the browser tracker in `events`), who crawled (search engines,
// AI bots and assistants, from `crawls`), what the assistant was asked and what the
// public MCP server served. Compact on purpose: top tens, not the full dashboard
// (functions/api/stats.ts has that). Days are UTC. A visitor is the tracker's
// daily-rotating hash, so one person over several days counts once per day.
import { classifyChannel } from './channel'

export type Named = { name: string; visitors: number }
export type TrafficSummary = {
  days: number
  from: string
  to: string
  people: { visitors: number; pageviews: number; previousVisitors: number; previousPageviews: number; resumeDownloads: number; contactClicks: number; avgSecondsOnPage: number | null; avgScrollPct: number | null }
  daily: { day: string; visitors: number; pageviews: number; crawlerRequests: number; aiRequests: number }[]
  topPages: { path: string; views: number; visitors: number }[]
  referrers: Named[]
  channels: (Named & { detail: string })[]
  countries: Named[]
  organizations: Named[]
  crawlers: {
    requests: number
    bots: number
    byCategory: { search: number; aiSearch: number; aiTraining: number; aiAssistant: number; social: number; seo: number; other: number }
    topBots: { bot: string; operator: string | null; category: string; requests: number; pages: number; lastSeen: string }[]
    topPages: { path: string; requests: number; aiRequests: number }[]
  }
  assistant: { questions: number; answered: number; gaps: number; helpful: number; unhelpful: number }
  publicMcp: { calls: number; byTool: { tool: string; calls: number }[] }
}

type Totals = { pageviews: number; visitors: number }
type Engagement = { seconds: number | null; scroll: number | null }
type Clicks = { downloads: number; contact: number }
type Daily = { day: string; pageviews: number; visitors: number }
type Entry = { source: string | null; medium: string | null; referrer: string | null; visitors: number }
type CrawlTotals = { requests: number; bots: number; search: number; aiSearch: number; aiTraining: number; aiAssistant: number; social: number; seo: number; other: number }
type CrawlDaily = { day: string; requests: number; ai: number }
type Bot = { bot: string; operator: string | null; category: string; requests: number; pages: number; lastSeen: number }
type CrawlPage = { path: string; requests: number; ai: number }
type Ask = { questions: number; answered: number; gaps: number }
type Votes = { helpful: number; unhelpful: number }

const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10)
const n = (value: number | null | undefined) => Number(value ?? 0)

export const trafficSummary = async (db: D1Database, days: number, now = Date.now()): Promise<TrafficSummary> => {
  const since = now - days * 86_400_000
  const before = since - days * 86_400_000
  const sinceDay = dayOf(since)
  const pv = "type = 'pageview' AND ts >= ?1"
  const statements = {
    totals: db.prepare(`SELECT COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors FROM events WHERE ${pv}`).bind(since),
    previous: db.prepare("SELECT COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors FROM events WHERE type = 'pageview' AND ts >= ?1 AND ts < ?2").bind(before, since),
    engagement: db.prepare("SELECT AVG(d) AS seconds, AVG(s) AS scroll FROM (SELECT MAX(duration_ms) / 1000.0 AS d, MAX(scroll_pct) AS s FROM events WHERE type = 'engagement' AND ts >= ?1 GROUP BY pageview_id)").bind(since),
    clicks: db.prepare("SELECT COALESCE(SUM(category = 'download'), 0) AS downloads, COALESCE(SUM(category IN ('email', 'outbound')), 0) AS contact FROM events WHERE type = 'click' AND ts >= ?1").bind(since),
    daily: db.prepare(`SELECT date(ts / 1000, 'unixepoch') AS day, COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors FROM events WHERE ${pv} GROUP BY day ORDER BY day`).bind(since),
    pages: db.prepare(`SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors FROM events WHERE ${pv} GROUP BY path ORDER BY views DESC LIMIT 10`).bind(since),
    entries: db.prepare(`SELECT utm_source AS source, utm_medium AS medium, referrer_host AS referrer, COUNT(*) AS visitors FROM (SELECT *, MIN(ts) FROM events WHERE ${pv} GROUP BY visitor) GROUP BY source, medium, referrer`).bind(since),
    countries: db.prepare(`SELECT COALESCE(country, 'Unknown') AS name, COUNT(DISTINCT visitor) AS visitors FROM events WHERE ${pv} GROUP BY name ORDER BY visitors DESC LIMIT 10`).bind(since),
    organizations: db.prepare(`SELECT COALESCE(as_org, 'Unknown') AS name, COUNT(DISTINCT visitor) AS visitors FROM events WHERE ${pv} GROUP BY name ORDER BY visitors DESC LIMIT 10`).bind(since),
    crawlTotals: db.prepare(`SELECT COUNT(*) AS requests, COUNT(DISTINCT bot) AS bots, COALESCE(SUM(category = 'search'), 0) AS search, COALESCE(SUM(category = 'ai-search'), 0) AS aiSearch,
      COALESCE(SUM(category = 'ai-training'), 0) AS aiTraining, COALESCE(SUM(category = 'ai-assistant'), 0) AS aiAssistant, COALESCE(SUM(category = 'social'), 0) AS social,
      COALESCE(SUM(category = 'seo'), 0) AS seo, COALESCE(SUM(category = 'other'), 0) AS other FROM crawls WHERE ts >= ?1`).bind(since),
    crawlDaily: db.prepare("SELECT date(ts / 1000, 'unixepoch') AS day, COUNT(*) AS requests, COALESCE(SUM(category IN ('ai-search', 'ai-training', 'ai-assistant')), 0) AS ai FROM crawls WHERE ts >= ?1 GROUP BY day").bind(since),
    bots: db.prepare('SELECT bot, MAX(operator) AS operator, category, COUNT(*) AS requests, COUNT(DISTINCT path) AS pages, MAX(ts) AS lastSeen FROM crawls WHERE ts >= ?1 GROUP BY bot, category ORDER BY requests DESC LIMIT 15').bind(since),
    crawlPages: db.prepare("SELECT path, COUNT(*) AS requests, COALESCE(SUM(category IN ('ai-search', 'ai-training', 'ai-assistant')), 0) AS ai FROM crawls WHERE ts >= ?1 GROUP BY path ORDER BY requests DESC LIMIT 10").bind(since),
    ask: db.prepare("SELECT COALESCE(SUM(questions), 0) AS questions, COALESCE(SUM(CASE WHEN outcome = 'answered' THEN questions END), 0) AS answered, COALESCE(SUM(CASE WHEN outcome = 'gap' THEN questions END), 0) AS gaps FROM ask_daily WHERE day >= ?1").bind(sinceDay),
    votes: db.prepare('SELECT COALESCE(SUM(helpful), 0) AS helpful, COALESCE(SUM(unhelpful), 0) AS unhelpful FROM ask_votes WHERE day >= ?1').bind(sinceDay),
    mcp: db.prepare('SELECT tool, COUNT(*) AS calls FROM mcp_calls WHERE ts >= ?1 GROUP BY tool ORDER BY calls DESC').bind(since),
  }
  const keys = Object.keys(statements) as (keyof typeof statements)[]
  const results = await db.batch(keys.map((key) => statements[key]))
  const rows = <T>(key: keyof typeof statements) => results[keys.indexOf(key)].results as T[]
  const first = <T>(key: keyof typeof statements) => rows<T>(key)[0]

  const totals = first<Totals>('totals'), previous = first<Totals>('previous'), engagement = first<Engagement>('engagement'), clicks = first<Clicks>('clicks')
  const crawlTotals = first<CrawlTotals>('crawlTotals'), ask = first<Ask>('ask'), votes = first<Votes>('votes')

  // Visits and crawls side by side per day.
  const byDay = new Map<string, TrafficSummary['daily'][number]>()
  for (const row of rows<Daily>('daily')) byDay.set(row.day, { day: row.day, visitors: n(row.visitors), pageviews: n(row.pageviews), crawlerRequests: 0, aiRequests: 0 })
  for (const row of rows<CrawlDaily>('crawlDaily')) {
    const day = byDay.get(row.day) ?? { day: row.day, visitors: 0, pageviews: 0, crawlerRequests: 0, aiRequests: 0 }
    day.crawlerRequests = n(row.requests)
    day.aiRequests = n(row.ai)
    byDay.set(row.day, day)
  }

  // Referrers and channels come from each visitor's first pageview, like the dashboard.
  const referrers = new Map<string, number>()
  const channels = new Map<string, { visitors: number; detail: Map<string, number> }>()
  for (const row of rows<Entry>('entries')) {
    const referrer = row.referrer ?? 'Direct / none'
    referrers.set(referrer, (referrers.get(referrer) ?? 0) + n(row.visitors))
    const channel = classifyChannel(row.source, row.medium, row.referrer)
    const entry = channels.get(channel) ?? { visitors: 0, detail: new Map() }
    entry.visitors += n(row.visitors)
    const detail = row.source ?? row.referrer
    if (detail && detail.toLowerCase() !== channel.toLowerCase()) entry.detail.set(detail, (entry.detail.get(detail) ?? 0) + n(row.visitors))
    channels.set(channel, entry)
  }
  const top = (map: Map<string, number>) => [...map].map(([name, visitors]) => ({ name, visitors })).sort((a, b) => b.visitors - a.visitors).slice(0, 10)

  return {
    days, from: sinceDay, to: dayOf(now),
    people: { visitors: n(totals?.visitors), pageviews: n(totals?.pageviews), previousVisitors: n(previous?.visitors), previousPageviews: n(previous?.pageviews), resumeDownloads: n(clicks?.downloads), contactClicks: n(clicks?.contact), avgSecondsOnPage: engagement?.seconds == null ? null : Math.round(engagement.seconds), avgScrollPct: engagement?.scroll == null ? null : Math.round(engagement.scroll) },
    daily: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    topPages: rows<{ path: string; views: number; visitors: number }>('pages').map((row) => ({ path: row.path, views: n(row.views), visitors: n(row.visitors) })),
    referrers: top(referrers),
    channels: [...channels].map(([name, entry]) => ({ name, visitors: entry.visitors, detail: [...entry.detail].sort((a, b) => b[1] - a[1]).map(([label]) => label).slice(0, 3).join(', ') })).sort((a, b) => b.visitors - a.visitors),
    countries: rows<Named>('countries').map((row) => ({ name: row.name, visitors: n(row.visitors) })),
    organizations: rows<Named>('organizations').map((row) => ({ name: row.name, visitors: n(row.visitors) })),
    crawlers: {
      requests: n(crawlTotals?.requests), bots: n(crawlTotals?.bots),
      byCategory: { search: n(crawlTotals?.search), aiSearch: n(crawlTotals?.aiSearch), aiTraining: n(crawlTotals?.aiTraining), aiAssistant: n(crawlTotals?.aiAssistant), social: n(crawlTotals?.social), seo: n(crawlTotals?.seo), other: n(crawlTotals?.other) },
      topBots: rows<Bot>('bots').map((row) => ({ bot: row.bot, operator: row.operator, category: row.category, requests: n(row.requests), pages: n(row.pages), lastSeen: dayOf(n(row.lastSeen)) })),
      topPages: rows<CrawlPage>('crawlPages').map((row) => ({ path: row.path, requests: n(row.requests), aiRequests: n(row.ai) })),
    },
    assistant: { questions: n(ask?.questions), answered: n(ask?.answered), gaps: n(ask?.gaps), helpful: n(votes?.helpful), unhelpful: n(votes?.unhelpful) },
    publicMcp: { calls: rows<{ tool: string; calls: number }>('mcp').reduce((sum, row) => sum + n(row.calls), 0), byTool: rows<{ tool: string; calls: number }>('mcp').map((row) => ({ tool: row.tool, calls: n(row.calls) })) },
  }
}

const pct = (now: number, before: number) => (before === 0 ? (now === 0 ? 'no change' : 'up from none') : `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}%`)
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

// The summary in a few sentences, so Claude can answer "how is the site doing?" without reading the tables.
export const describeTraffic = (t: TrafficSummary): string[] => {
  const ai = t.crawlers.byCategory.aiSearch + t.crawlers.byCategory.aiTraining + t.crawlers.byCategory.aiAssistant
  const lines = [
    `People, last ${plural(t.days, 'day')} (${t.from} to ${t.to}): ${plural(t.people.visitors, 'visitor')} (${pct(t.people.visitors, t.people.previousVisitors)} vs the ${plural(t.days, 'day')} before), ${plural(t.people.pageviews, 'pageview')}, ${plural(t.people.resumeDownloads, 'résumé download')}, ${plural(t.people.contactClicks, 'contact click')}${t.people.avgSecondsOnPage !== null ? `, about ${t.people.avgSecondsOnPage}s on a page` : ''}.`,
    `Crawlers: ${plural(t.crawlers.requests, 'request')} from ${plural(t.crawlers.bots, 'bot')}; ${ai} from AI (${t.crawlers.byCategory.aiSearch} AI search, ${t.crawlers.byCategory.aiTraining} training, ${t.crawlers.byCategory.aiAssistant} assistants fetching for a person), ${t.crawlers.byCategory.search} search engines, ${t.crawlers.byCategory.social + t.crawlers.byCategory.seo + t.crawlers.byCategory.other} other.`,
  ]
  if (t.topPages.length) lines.push(`Top pages: ${t.topPages.slice(0, 5).map((page) => `${page.path} (${page.views})`).join(', ')}.`)
  if (t.channels.length) lines.push(`Where people came from: ${t.channels.slice(0, 5).map((channel) => `${channel.name} ${channel.visitors}${channel.detail ? ` (${channel.detail})` : ''}`).join(', ')}.`)
  if (t.crawlers.topBots.length) lines.push(`Busiest bots: ${t.crawlers.topBots.slice(0, 5).map((bot) => `${bot.bot} ${bot.requests}`).join(', ')}.`)
  lines.push(`The site assistant: ${plural(t.assistant.questions, 'question')}, ${t.assistant.answered} answered, ${t.assistant.gaps} it could not answer, ${t.assistant.helpful} voted helpful and ${t.assistant.unhelpful} not. Public MCP server: ${plural(t.publicMcp.calls, 'call')}.`)
  return lines
}
