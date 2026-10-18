import { BarChart } from './Charts'
import { DataTable, type Column } from './DataTable'
import { dayAxis, dayLabel, fillDays, formatNumber, formatTime } from './format'
import type { CrawlBot, CrawlCategory, CrawlHit, CrawlPage, Stats } from './types'

const crawlCategories: Record<CrawlCategory, string> = {
  search: 'Search engine',
  'ai-search': 'AI search',
  'ai-training': 'AI training',
  'ai-assistant': 'AI assistant',
  social: 'Link preview',
  seo: 'SEO tool',
  other: 'Other bot',
}
const purpose = (category: CrawlCategory) => <span className={`badge ${category}`}>{crawlCategories[category]}</span>

const botColumns: Column<CrawlBot>[] = [
  { key: 'bot', label: 'Crawler', value: (row) => row.bot, strong: true },
  { key: 'category', label: 'Purpose', value: (row) => crawlCategories[row.category], render: (row) => purpose(row.category) },
  { key: 'operator', label: 'Operator', value: (row) => row.operator },
  { key: 'network', label: 'Network', value: (row) => row.network ?? 'Unknown', render: (row) => <>{row.network ?? 'Unknown'}{row.networks > 1 && <small className="muted"> +{row.networks - 1} more</small>}</> },
  { key: 'requests', label: 'Requests', value: (row) => row.requests, num: true },
  { key: 'pages', label: 'Pages', value: (row) => row.pages, num: true },
  { key: 'errors', label: 'Errors', value: (row) => row.errors || null, num: true, render: (row) => (row.errors ? formatNumber(row.errors) : '') },
  { key: 'lastSeen', label: 'Last seen', value: (row) => row.lastSeen, render: (row) => formatTime(row.lastSeen) },
]

const pageColumns: Column<CrawlPage>[] = [
  { key: 'path', label: 'Address', value: (row) => row.path, strong: true, render: (row) => <>{row.path}{row.status >= 400 && <small className="muted"> · {row.status}</small>}</> },
  { key: 'requests', label: 'Requests', value: (row) => row.requests, num: true },
  { key: 'search', label: 'Search', value: (row) => row.search, num: true },
  { key: 'ai', label: 'AI crawlers', value: (row) => row.ai, num: true },
  { key: 'assistant', label: 'AI assistants', value: (row) => row.assistant, num: true },
  { key: 'bots', label: 'Crawlers', value: (row) => row.bots, num: true },
]

const hitColumns: Column<CrawlHit>[] = [
  { key: 'ts', label: 'Time', value: (row) => row.ts, render: (row) => formatTime(row.ts) },
  { key: 'bot', label: 'Crawler', value: (row) => row.bot, strong: true },
  { key: 'category', label: 'Purpose', value: (row) => crawlCategories[row.category], render: (row) => purpose(row.category) },
  { key: 'path', label: 'Address', value: (row) => row.path },
  { key: 'status', label: 'Status', value: (row) => row.status, num: true, render: (row) => String(row.status) },
  { key: 'network', label: 'Network', value: (row) => row.network },
  { key: 'country', label: 'Country', value: (row) => row.country },
]

export function CrawlersPage({ stats }: { stats: Stats }) {
  const totals = stats.crawlTotals
  const daily = fillDays(stats.crawlDaily, stats.days, new Date(), (day) => ({ day, requests: 0, search: 0, ai: 0 }))
  return (
    <>
      <section className="card" data-part="Totals">
        <div className="card-head"><h2>Crawlers: search engines and AI</h2></div>
        <p className="note">Requests from bots, recorded on the server because crawlers rarely run the page tracker. They are not counted as visitors. <b>AI assistant</b> means a person asked ChatGPT, Claude, Perplexity or similar something that made it read the page right then. <b>AI search</b> indexes pages for AI answers, and <b>AI training</b> collects text to train models. Anyone can pretend to be a crawler, so check that the network matches the operator (Googlebot from Google, GPTBot from Microsoft, and so on). <b>Errors</b> are 4xx and 5xx answers to named crawlers, worth a look because they can mean a broken link to the site. <b>Probes</b> are the same answers to unknown bots and scripts: scanners trying WordPress and PHP paths that never existed here, which a 404 answers correctly.</p>
        <div className="stats">
          <div><span>Crawler requests</span><strong>{formatNumber(totals.requests)}</strong><small>from {formatNumber(totals.bots)} crawlers</small></div>
          <div><span>Search engines</span><strong>{formatNumber(totals.search)}</strong><small>Google, Bing, Apple…</small></div>
          <div><span>AI crawlers</span><strong>{formatNumber(totals.ai)}</strong><small>AI search and training</small></div>
          <div className="highlight"><span>AI assistants</span><strong>{formatNumber(totals.assistant)}</strong><small>read when someone asked an AI</small></div>
          <div><span>Other bots</span><strong>{formatNumber(totals.other)}</strong><small>link previews, SEO tools, scripts</small></div>
          <div><span>Errors</span><strong>{formatNumber(totals.errors)}</strong><small>named crawlers answered 4xx or 5xx</small></div>
          <div><span>Probes</span><strong>{formatNumber(totals.probes)}</strong><small>unknown bots asking for pages that never existed</small></div>
        </div>
        {totals.requests === 0 ? <p className="empty">No crawler requests in this range yet</p> : (
          <BarChart title="Crawler requests per day" bars={daily.map((row) => ({ key: row.day, label: dayLabel(row.day), value: row.requests, detail: `${formatNumber(row.requests)} requests · ${formatNumber(row.search)} search · ${formatNumber(row.ai)} AI` }))} axisLabels={dayAxis(daily)} />
        )}
      </section>

      {totals.requests > 0 && (
        <>
          <section className="card" data-part="Crawlers">
            <div className="card-head"><h2>Crawlers</h2></div>
            <DataTable columns={botColumns} rows={stats.crawlBots} rowKey={(row) => `${row.bot}|${row.category}`} label="Crawlers" />
          </section>
          <section className="card" data-part="Most crawled">
            <div className="card-head"><h2>Most crawled</h2></div>
            <DataTable columns={pageColumns} rows={stats.crawlPages} rowKey={(row) => row.path} label="Most crawled pages" />
          </section>
          <section className="card" data-part="Latest crawls">
            <div className="card-head"><h2>Latest crawls</h2></div>
            <DataTable columns={hitColumns} rows={stats.crawlRecent} rowKey={(_, index) => String(index)} label="Latest crawls" />
          </section>
        </>
      )}
    </>
  )
}
