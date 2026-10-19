import { BarChart, TrendChart, Vs } from './Charts'
import { DataTable, type Column } from './DataTable'
import { dayLabel, fillDays, formatDuration, formatNumber, formatPercent, formatTime, place } from './format'
import type { ClickRow, PageRow, RecentRow, Stats, VisitorRow } from './types'

const hourLabel = (hour: number) => new Date(2000, 0, 1, hour).toLocaleTimeString('en-US', { hour: 'numeric' })

const visitorColumns: Column<VisitorRow>[] = [
  { key: 'lastSeen', label: 'Last seen', value: (row) => row.lastSeen, render: (row) => formatTime(row.lastSeen) },
  { key: 'organization', label: 'Organization', value: (row) => row.organization ?? 'Unknown', strong: true },
  { key: 'place', label: 'Location', value: (row) => place(row) },
  { key: 'channel', label: 'Channel', value: (row) => [row.channel, row.utmSource ?? row.referrer].filter(Boolean).join(' · '), render: (row) => <><span className="strong">{row.channel}</span>{(row.utmSource ?? row.referrer) && <small className="muted"> · {row.utmSource ?? row.referrer}</small>}</> },
  { key: 'pageviews', label: 'Pages', value: (row) => row.pageviews, num: true },
  { key: 'engaged', label: 'Time', value: (row) => row.engagedMs ?? null, num: true, render: (row) => formatDuration(row.engagedMs) },
  { key: 'device', label: 'Device', value: (row) => `${row.device} · ${row.os} · ${row.browser}` },
  { key: 'resume', label: 'Résumé', value: (row) => (row.downloaded ? 'Downloaded' : ''), render: (row) => (row.downloaded ? <span className="badge download">Downloaded</span> : '') },
]

const pageColumns: Column<PageRow>[] = [
  { key: 'name', label: 'Page', value: (row) => row.name, strong: true },
  { key: 'views', label: 'Views', value: (row) => row.views, num: true },
  { key: 'visitors', label: 'Visitors', value: (row) => row.visitors, num: true },
  { key: 'time', label: 'Avg time', value: (row) => row.avgDurationMs, num: true, render: (row) => formatDuration(row.avgDurationMs) },
  { key: 'scroll', label: 'Avg scroll', value: (row) => row.avgScrollPct, num: true, render: (row) => formatPercent(row.avgScrollPct) },
]

const clickColumns: Column<ClickRow>[] = [
  { key: 'category', label: 'Type', value: (row) => row.category, render: (row) => <span className={`badge ${row.category}`}>{row.category}</span> },
  { key: 'label', label: 'Label', value: (row) => row.label, strong: true },
  { key: 'context', label: 'Where', value: (row) => row.context },
  { key: 'target', label: 'Target', value: (row) => row.target, className: 'target' },
  { key: 'clicks', label: 'Clicks', value: (row) => row.clicks, num: true },
  { key: 'visitors', label: 'Visitors', value: (row) => row.visitors, num: true },
]

const detail = (row: RecentRow) => (row.type === 'click' ? row.label ?? '' : row.type === 'engagement' ? `${formatDuration(row.durationMs)} · ${formatPercent(row.scrollPct)} scrolled` : row.referrer ? `from ${row.referrer}` : '')
const recentColumns: Column<RecentRow>[] = [
  { key: 'ts', label: 'Time', value: (row) => row.ts, render: (row) => formatTime(row.ts) },
  { key: 'type', label: 'Event', value: (row) => (row.type === 'click' ? row.category ?? '' : row.type), render: (row) => <span className={`badge ${row.type}`}>{row.type === 'click' ? row.category : row.type}</span> },
  { key: 'path', label: 'Page', value: (row) => row.path, strong: true },
  { key: 'detail', label: 'Detail', value: detail },
  { key: 'organization', label: 'Organization', value: (row) => row.organization },
  { key: 'place', label: 'Location', value: (row) => place(row) },
  { key: 'device', label: 'Device', value: (row) => `${row.device} · ${row.browser}` },
]

export function TrafficPage({ stats }: { stats: Stats }) {
  const { totals, previous, days } = stats
  const daily = fillDays(stats.daily, stats.days)
  const hourly = Array.from({ length: 24 }, (_, hour) => stats.hours.find((row) => row.hour === hour)?.pageviews ?? 0)
  return (
    <>
      <section className="card" data-part="Visitors">
        <div className="card-head"><h2>Visitors</h2></div>
        <div className="stats" aria-label="Summary">
          <div><span>Visitors</span><strong>{formatNumber(totals.visitors)}</strong><small><Vs current={totals.visitors} previous={previous?.visitors} days={days} /></small></div>
          <div><span>Pageviews</span><strong>{formatNumber(totals.pageviews)}</strong><small>{totals.visitors ? (totals.pageviews / totals.visitors).toFixed(1) : '0'} per visitor · <Vs current={totals.pageviews} previous={previous?.pageviews} days={days} /></small></div>
          <div><span>Time on page</span><strong>{formatDuration(totals.avgDurationMs)}</strong><small>average, while visible</small></div>
          <div><span>Scroll depth</span><strong>{formatPercent(totals.avgScrollPct)}</strong><small>average deepest point</small></div>
          <div><span>Bounce rate</span><strong>{formatPercent(totals.bounceRate, true)}</strong><small>viewed a single page</small></div>
          <div className="highlight"><span>Résumé downloads</span><strong>{formatNumber(totals.downloads)}</strong><small>by {formatNumber(totals.downloaders)} visitors · <Vs current={totals.downloads} previous={previous?.downloads} days={days} /></small></div>
          <div><span>Contact clicks</span><strong>{formatNumber(totals.contactClicks)}</strong><small>email &amp; LinkedIn · <Vs current={totals.contactClicks} previous={previous?.contactClicks} days={days} /></small></div>
        </div>
        <div className="charts">
          <TrendChart title="Visitors per day" unit="visitors" points={daily.map((row) => ({ key: row.day, label: dayLabel(row.day), value: row.visitors, detail: `${formatNumber(row.visitors)} visitors · ${formatNumber(row.pageviews)} pageviews` }))} />
          <BarChart title="Pageviews by hour (your time)" bars={hourly.map((value, hour) => ({ key: String(hour), label: hourLabel(hour), value, detail: `${formatNumber(value)} pageviews` }))} axisLabels={['12 AM', '6 AM', '12 PM', '6 PM', '11 PM']} />
        </div>
      </section>

      <section className="card" data-part="Who visited">
        <div className="card-head"><h2>Who visited</h2></div>
        <p className="note">Each row is one visitor on one day, with the pages they viewed in order (open a row). Organization is the network they browsed from, which is often their employer.</p>
        <DataTable columns={visitorColumns} rows={stats.visitors} rowKey={(row) => row.visitor} empty="No visitors in this range yet" label="Visitors" rowName={(row) => `${row.organization ?? 'an unknown network'}, ${formatTime(row.lastSeen)}`} expand={(row) => <><p><b>Journey:</b> {row.journey}</p><p><b>Clicked:</b> {row.clicked ?? 'nothing'}</p><p><b>First seen:</b> {formatTime(row.firstSeen)}</p></>} />
      </section>

      <section className="card" data-part="Pages">
        <div className="card-head"><h2>Pages</h2></div>
        <DataTable columns={pageColumns} rows={stats.pages} rowKey={(row) => row.name} empty="No pageviews yet" label="Pages" />
      </section>

      <section className="card" data-part="Clicks">
        <div className="card-head"><h2>Clicks</h2></div>
        <DataTable columns={clickColumns} rows={stats.clicks} rowKey={(_, index) => String(index)} empty="No clicks yet" label="Clicks" />
      </section>

      <section className="card" data-part="Activity">
        <div className="card-head"><h2>Activity log</h2></div>
        <p className="note">The latest 200 events, newest first.</p>
        <DataTable columns={recentColumns} rows={stats.recent} rowKey={(_, index) => String(index)} empty="Nothing recorded yet" label="Activity log" />
      </section>
    </>
  )
}
