import { Fragment, useEffect, useState } from 'react'
import { ignoreKey } from '../analytics'
import { fillDays, formatDuration, formatNumber, formatPercent, formatTime, formatVital, rateVital, vitalInfo } from './format'

type Row = { name: string; visitors: number; pageviews?: number }
type PageRow = { name: string; views: number; visitors: number; avgDurationMs: number | null; avgScrollPct: number | null }
type ClickRow = { category: string; label: string; target: string | null; context: string | null; clicks: number; visitors: number }
type VisitorRow = {
  visitor: string; firstSeen: number; lastSeen: number; pageviews: number; journey: string; city: string | null; region: string | null; country: string | null
  organization: string | null; browser: string; os: string; device: string; referrer: string | null; utmSource: string | null; engagedMs: number | null; downloaded: number; clicked: string | null
}
type RecentRow = {
  ts: number; type: string; path: string | null; category: string | null; label: string | null; durationMs: number | null; scrollPct: number | null
  referrer: string | null; city: string | null; country: string | null; organization: string | null; browser: string; os: string; device: string
}
type VitalSummary = { metric: string; p75: number; samples: number; good: number; needsImprovement: number; poor: number }
type Stats = {
  days: number
  generatedAt: number
  totals: { pageviews: number; visitors: number; avgDurationMs: number | null; avgScrollPct: number | null; bounceRate: number | null; downloads: number; downloaders: number; contactClicks: number }
  daily: { day: string; pageviews: number; visitors: number }[]
  hours: { hour: number; pageviews: number }[]
  pages: PageRow[]
  entryPages: Row[]
  clicks: ClickRow[]
  visitors: VisitorRow[]
  recent: RecentRow[]
  vitals: { metrics: VitalSummary[]; pages: ({ path: string } & Record<string, number>)[] }
} & Record<'referrers' | 'utmSources' | 'utmCampaigns' | 'countries' | 'cities' | 'organizations' | 'browsers' | 'systems' | 'devices' | 'languages' | 'screens', Row[]>

const tokenKey = 'sw-admin-token'
const ranges = [[1, 'Today'], [7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '1 year']] as const
const cloudflareAnalyticsUrl = 'https://dash.cloudflare.com/?to=/:account/web-analytics'

const storage = {
  get: (key: string) => { try { return localStorage.getItem(key) } catch { return null } },
  set: (key: string, value: string | null) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* storage unavailable */ } },
}

const place = (row: { city: string | null; region?: string | null; country: string | null }) => [row.city, row.region, row.country].filter(Boolean).join(', ') || 'Unknown'

type Bar = { key: string; label: string; value: number; detail: string }

function BarChart({ title, bars, axisLabels }: { title: string; bars: Bar[]; axisLabels: string[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  // Round the axis up to an even number so the midpoint gridline is a whole number.
  const peak = Math.max(...bars.map((bar) => bar.value), 0)
  const max = Math.max(2, peak + (peak % 2))
  const active = hovered === null ? null : bars[hovered]
  return (
    <figure className="chart">
      <figcaption>
        <span>{title}</span>
        <span className="chart-readout">{active ? `${active.label} · ${active.detail}` : `Peak ${formatNumber(peak)}`}</span>
      </figcaption>
      <div className="chart-plot" onMouseLeave={() => setHovered(null)}>
        <span className="chart-grid" style={{ bottom: '100%' }}><em>{formatNumber(max)}</em></span>
        <span className="chart-grid" style={{ bottom: '50%' }}><em>{formatNumber(max / 2)}</em></span>
        <div className="chart-bars">
          {bars.map((bar, index) => (
            <button type="button" key={bar.key} className={`chart-bar ${hovered === index ? 'active' : ''}`} onMouseEnter={() => setHovered(index)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} aria-label={`${bar.label}: ${bar.detail}`}>
              <span style={{ height: `${(bar.value / max) * 100}%` }} />
            </button>
          ))}
        </div>
      </div>
      <div className="chart-axis">{axisLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
    </figure>
  )
}

function RankedList({ title, rows, unit = 'visitors', empty = 'No data yet' }: { title: string; rows: Row[]; unit?: string; empty?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.visitors))
  return (
    <section className="panel">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="empty">{empty}</p> : (
        <ol className="ranked">
          {rows.map((row) => (
            <li key={row.name} title={row.pageviews ? `${formatNumber(row.visitors)} ${unit} · ${formatNumber(row.pageviews)} pageviews` : undefined}>
              <span className="ranked-bar" style={{ width: `${(row.visitors / max) * 100}%` }} />
              <span className="ranked-name">{row.name}</span>
              <span className="ranked-value">{formatNumber(row.visitors)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

const ratingLabel = { good: '✓ Good', 'needs-improvement': '! Needs work', poor: '✕ Poor' } as const

function WebVitals({ vitals }: { vitals: Stats['vitals'] }) {
  const order = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB']
  const metrics = order.map((metric) => vitals.metrics.find((row) => row.metric === metric)).filter((row): row is VitalSummary => Boolean(row))
  return (
    <section className="panel wide">
      <h2>Page speed (Core Web Vitals)</h2>
      <p className="note">Measured in visitors' browsers. Values are the 75th percentile, the number Google uses to rate a site; the bar shows the share of visits rated good, needs work, and poor.</p>
      {metrics.length === 0 ? <p className="empty">No measurements yet</p> : (
        <>
          <div className="vitals">
            {metrics.map((row) => {
              const rating = rateVital(row.metric, row.p75)
              return (
                <div key={row.metric} className="vital">
                  <span className="vital-name" title={vitalInfo[row.metric]?.name}>{row.metric} <small>{vitalInfo[row.metric]?.name}</small></span>
                  <strong>{formatVital(row.metric, row.p75)}</strong>
                  <span className={`status ${rating}`}>{ratingLabel[rating]}</span>
                  <span className="vital-share" aria-label={`${formatPercent(row.good, true)} good, ${formatPercent(row.needsImprovement, true)} needs work, ${formatPercent(row.poor, true)} poor`}>
                    <span className="good" style={{ flexGrow: row.good }} />
                    <span className="needs-improvement" style={{ flexGrow: row.needsImprovement }} />
                    <span className="poor" style={{ flexGrow: row.poor }} />
                  </span>
                  <small>{formatPercent(row.good, true)} good · {formatNumber(row.samples)} visits</small>
                </div>
              )
            })}
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Page</th>{order.map((metric) => <th className="num" key={metric}>{metric}</th>)}</tr></thead>
              <tbody>{vitals.pages.map((row) => <tr key={row.path}><td className="strong">{row.path}</td>{order.map((metric) => <td className="num" key={metric}>{row[metric] == null ? '—' : <span className={`status-text ${rateVital(metric, row[metric])}`}>{formatVital(metric, row[metric])}</span>}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function Login({ onSubmit, error }: { onSubmit: (token: string) => void; error: string }) {
  const [value, setValue] = useState('')
  return (
    <main className="login">
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(value.trim()) }}>
        <h1>Site analytics</h1>
        <p>Enter the admin token to view visitor data for steven.wilssens.com.</p>
        <input type="password" autoComplete="current-password" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Admin token" aria-label="Admin token" autoFocus />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary">View analytics</button>
      </form>
    </main>
  )
}

export default function Admin() {
  const [token, setToken] = useState(() => storage.get(tokenKey) ?? '')
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [refreshCount, setRefreshCount] = useState(0)
  const [loadedKey, setLoadedKey] = useState('')
  const [ignored, setIgnored] = useState(() => storage.get(ignoreKey) === '1')
  const [openVisitor, setOpenVisitor] = useState<string | null>(null)
  const requestKey = `${token}|${days}|${refreshCount}`
  const loading = Boolean(token) && loadedKey !== requestKey
  const load = () => setRefreshCount((count) => count + 1)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(`/api/stats?days=${days}&tz=${-new Date().getTimezoneOffset()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 401) {
          storage.set(tokenKey, null)
          setToken('')
          setError('That token was not accepted.')
          return
        }
        if (!response.ok) throw new Error(`Request failed (${response.status})`)
        const data: Stats = await response.json()
        if (cancelled) return
        setStats(data)
        setError('')
      })
      .catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load analytics.') })
      .finally(() => { if (!cancelled) setLoadedKey(requestKey) })
    return () => { cancelled = true }
  }, [token, days, requestKey])

  const signIn = (value: string) => {
    storage.set(tokenKey, value)
    storage.set(ignoreKey, '1')
    setIgnored(true)
    setToken(value)
  }

  const toggleIgnored = () => {
    storage.set(ignoreKey, ignored ? null : '1')
    setIgnored(!ignored)
  }

  if (!token) return <Login onSubmit={signIn} error={error} />

  const totals = stats?.totals
  const daily = stats ? fillDays(stats.daily, stats.days) : []
  const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const hourly = Array.from({ length: 24 }, (_, hour) => stats?.hours.find((row) => row.hour === hour)?.pageviews ?? 0)
  const hourLabel = (hour: number) => new Date(2000, 0, 1, hour).toLocaleTimeString('en-US', { hour: 'numeric' })

  return (
    <div className="admin">
      <header className="admin-header">
        <a className="wordmark" href="/">steven<span>.</span>wilssens</a>
        <span className="admin-title">Analytics</span>
        <nav className="range" aria-label="Date range">
          {ranges.map(([value, label]) => <button type="button" key={value} className={days === value ? 'active' : ''} aria-pressed={days === value} onClick={() => setDays(value)}>{label}</button>)}
        </nav>
        <button type="button" className="ghost" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </header>

      {error && <p className="error banner">{error}</p>}

      {stats && totals && (
        <main>
          <section className="tiles" aria-label="Summary">
            <div><span>Visitors</span><strong>{formatNumber(totals.visitors)}</strong><small>unique per day</small></div>
            <div><span>Pageviews</span><strong>{formatNumber(totals.pageviews)}</strong><small>{totals.visitors ? (totals.pageviews / totals.visitors).toFixed(1) : '0'} per visitor</small></div>
            <div><span>Time on page</span><strong>{formatDuration(totals.avgDurationMs)}</strong><small>average, while visible</small></div>
            <div><span>Scroll depth</span><strong>{formatPercent(totals.avgScrollPct)}</strong><small>average deepest point</small></div>
            <div><span>Bounce rate</span><strong>{formatPercent(totals.bounceRate, true)}</strong><small>viewed a single page</small></div>
            <div className="highlight"><span>Resume downloads</span><strong>{formatNumber(totals.downloads)}</strong><small>by {formatNumber(totals.downloaders)} visitors</small></div>
            <div><span>Contact clicks</span><strong>{formatNumber(totals.contactClicks)}</strong><small>email & LinkedIn</small></div>
          </section>

          <section className="charts">
            <BarChart
              title="Visitors per day"
              bars={daily.map((row) => ({ key: row.day, label: dayLabel(row.day), value: row.visitors, detail: `${formatNumber(row.visitors)} visitors · ${formatNumber(row.pageviews)} pageviews` }))}
              axisLabels={daily.length > 1 ? [dayLabel(daily[0].day), dayLabel(daily[Math.floor(daily.length / 2)].day), dayLabel(daily[daily.length - 1].day)] : daily.map((row) => dayLabel(row.day))}
            />
            <BarChart
              title="Pageviews by hour (your time)"
              bars={hourly.map((value, hour) => ({ key: String(hour), label: hourLabel(hour), value, detail: `${formatNumber(value)} pageviews` }))}
              axisLabels={['12 AM', '6 AM', '12 PM', '6 PM', '11 PM']}
            />
          </section>

          <section className="panel wide">
            <h2>Visitors</h2>
            <p className="note">Each row is one visitor on one day, with the pages they viewed in order. Organization is the network they browsed from, which is often their employer.</p>
            {stats.visitors.length === 0 ? <p className="empty">No visitors in this range yet</p> : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Last seen</th><th>Organization</th><th>Location</th><th>Came from</th><th>Pages</th><th>Time</th><th>Device</th><th>Resume</th></tr></thead>
                  <tbody>
                    {stats.visitors.map((row) => (
                      <Fragment key={row.visitor}>
                        <tr className="clickable" onClick={() => setOpenVisitor(openVisitor === row.visitor ? null : row.visitor)} aria-expanded={openVisitor === row.visitor}>
                          <td>{formatTime(row.lastSeen)}</td>
                          <td className="strong">{row.organization ?? 'Unknown'}</td>
                          <td>{place(row)}</td>
                          <td>{row.utmSource ?? row.referrer ?? 'Direct'}</td>
                          <td className="num">{row.pageviews}</td>
                          <td className="num">{formatDuration(row.engagedMs)}</td>
                          <td>{row.device} · {row.os} · {row.browser}</td>
                          <td>{row.downloaded ? <span className="badge">Downloaded</span> : ''}</td>
                        </tr>
                        {openVisitor === row.visitor && (
                          <tr className="detail">
                            <td colSpan={8}>
                              <p><b>Journey:</b> {row.journey}</p>
                              <p><b>Clicked:</b> {row.clicked ?? 'nothing'}</p>
                              <p><b>First seen:</b> {formatTime(row.firstSeen)}</p>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel wide">
            <h2>Pages</h2>
            {stats.pages.length === 0 ? <p className="empty">No pageviews yet</p> : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Page</th><th className="num">Views</th><th className="num">Visitors</th><th className="num">Avg time</th><th className="num">Avg scroll</th></tr></thead>
                  <tbody>{stats.pages.map((row) => <tr key={row.name}><td className="strong">{row.name}</td><td className="num">{formatNumber(row.views)}</td><td className="num">{formatNumber(row.visitors)}</td><td className="num">{formatDuration(row.avgDurationMs)}</td><td className="num">{formatPercent(row.avgScrollPct)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid">
            <RankedList title="Organizations" rows={stats.organizations} />
            <RankedList title="Referrers" rows={stats.referrers} />
            <RankedList title="Entry pages" rows={stats.entryPages} />
            <RankedList title="Cities" rows={stats.cities} />
            <RankedList title="Countries" rows={stats.countries} />
            <RankedList title="Campaigns (utm_campaign)" rows={stats.utmCampaigns} />
            <RankedList title="Sources (utm_source / ref)" rows={stats.utmSources} />
            <RankedList title="Devices" rows={stats.devices} />
            <RankedList title="Operating systems" rows={stats.systems} />
            <RankedList title="Browsers" rows={stats.browsers} />
            <RankedList title="Languages" rows={stats.languages} />
            <RankedList title="Screen sizes" rows={stats.screens} />
          </div>

          <WebVitals vitals={stats.vitals} />

          <section className="panel wide">
            <h2>Clicks</h2>
            {stats.clicks.length === 0 ? <p className="empty">No clicks yet</p> : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Type</th><th>Label</th><th>Where</th><th>Target</th><th className="num">Clicks</th><th className="num">Visitors</th></tr></thead>
                  <tbody>{stats.clicks.map((row, index) => <tr key={index}><td><span className={`badge ${row.category}`}>{row.category}</span></td><td className="strong">{row.label}</td><td>{row.context}</td><td className="target">{row.target}</td><td className="num">{formatNumber(row.clicks)}</td><td className="num">{formatNumber(row.visitors)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel wide">
            <h2>Activity log</h2>
            <p className="note">The latest 200 events, newest first.</p>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Time</th><th>Event</th><th>Page</th><th>Detail</th><th>Organization</th><th>Location</th><th>Device</th></tr></thead>
                <tbody>
                  {stats.recent.map((row, index) => (
                    <tr key={index}>
                      <td>{formatTime(row.ts)}</td>
                      <td><span className={`badge ${row.type}`}>{row.type === 'click' ? row.category : row.type}</span></td>
                      <td className="strong">{row.path}</td>
                      <td>{row.type === 'click' ? row.label : row.type === 'engagement' ? `${formatDuration(row.durationMs)} · ${formatPercent(row.scrollPct)} scrolled` : row.referrer ? `from ${row.referrer}` : ''}</td>
                      <td>{row.organization}</td>
                      <td>{place(row)}</td>
                      <td>{row.device} · {row.browser}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="admin-footer">
            <label><input type="checkbox" checked={ignored} onChange={toggleIgnored} /> Exclude this browser from tracking</label>
            <a href={cloudflareAnalyticsUrl} target="_blank" rel="noreferrer">Cloudflare Web Analytics ↗</a>
            <span>Updated {formatTime(stats.generatedAt)}</span>
            <button type="button" className="ghost" onClick={() => { storage.set(tokenKey, null); setToken(''); setStats(null) }}>Sign out</button>
          </footer>
        </main>
      )}
    </div>
  )
}
