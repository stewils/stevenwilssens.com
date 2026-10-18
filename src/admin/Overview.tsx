import { BarChart } from './Charts'
import { dayAxis, dayLabel, fillDays, formatNumber, formatUsd } from './format'
import type { Need } from './needs'
import { pages, type PageId } from './pages'
import type { AdminData } from './types'

// The headline numbers, what needs Steven (linking to the page it is on), and a tile
// per page with a line of what is there.
export function Overview({ data, needs, summaries }: { data: AdminData; needs: Need[]; summaries: Partial<Record<PageId, string>> }) {
  const { stats, ask, resume } = data
  const report = resume?.report
  const daily = stats ? fillDays(stats.daily, stats.days) : []
  const titleOf = (id: PageId) => pages.find((page) => page.id === id)?.title ?? ''
  return (
    <>
      <dl className="kpis card" aria-label="Headline numbers">
        <div><dt>Visitors</dt><dd className="kpi-value">{stats ? formatNumber(stats.totals.visitors) : '…'}</dd><dd className="kpi-note">{data.days === 1 ? 'today' : `last ${data.days} days`}</dd></div>
        <div><dt>Pageviews</dt><dd className="kpi-value">{stats ? formatNumber(stats.totals.pageviews) : '…'}</dd><dd className="kpi-note">{stats && stats.totals.visitors ? `${(stats.totals.pageviews / stats.totals.visitors).toFixed(1)} per visitor` : ''}</dd></div>
        <div><dt>Résumé downloads</dt><dd className="kpi-value">{stats ? formatNumber(stats.totals.downloads) : '…'}</dd><dd className="kpi-note">{stats ? `by ${formatNumber(stats.totals.downloaders)} visitors` : ''}</dd></div>
        <div><dt>Contact clicks</dt><dd className="kpi-value">{stats ? formatNumber(stats.totals.contactClicks) : '…'}</dd><dd className="kpi-note">email and LinkedIn</dd></div>
        <div><dt>Résumé score</dt><dd className={`kpi-value ${report ? (report.score >= 90 ? 'good' : report.score < 70 ? 'bad' : '') : ''}`}>{resume ? (report ? `${report.score}` : '—') : '…'}</dd><dd className="kpi-note">{report ? `of 100 · ${report.warnings ?? 0} ${report.warnings === 1 ? 'warning' : 'warnings'}${report.baseline && report.baseline.change !== 0 ? ` · ${report.baseline.change > 0 ? '+' : ''}${report.baseline.change} vs before` : ''}` : resume ? 'no report in this deployment' : ''}</dd></div>
        <div><dt>Assistant this month</dt><dd className="kpi-value">{ask ? formatUsd(ask.month.costMicro) : '…'}</dd><dd className="kpi-note">{ask ? `${formatNumber(ask.month.questions)} questions · ${formatUsd(ask.budgetUsd * 1_000_000)} budget` : ''}</dd></div>
      </dl>

      <section aria-labelledby="h-needs">
        <div className="sec-head"><h2 id="h-needs">Needs you</h2></div>
        <div className="needs">
          {needs.length === 0 ? <p className="all-clear">Nothing is waiting for you.</p> : needs.map((need) => (
            <a key={need.key} className="need" href={`#${need.page}`}><span className="need-n">{need.n}</span><span className="need-text">{need.text}</span><span className="need-where">{titleOf(need.page)} →</span></a>
          ))}
        </div>
      </section>

      <section aria-labelledby="h-goto">
        <div className="sec-head"><h2 id="h-goto">Go to</h2></div>
        <div className="tiles">
          {pages.filter((page) => page.id !== 'overview').map((page) => (
            <a key={page.id} className="tile" href={`#${page.id}`}>
              <span className="tile-head">{page.icon}<strong>{page.title}</strong></span>
              <span className="tile-text">{summaries[page.id] ?? page.sub}</span>
            </a>
          ))}
        </div>
      </section>

      {stats && (
        <section className="card">
          <div className="card-head"><h2>Visitors per day</h2></div>
          <BarChart title={data.days === 1 ? 'Today' : `Last ${data.days} days`} bars={daily.map((row) => ({ key: row.day, label: dayLabel(row.day), value: row.visitors, detail: `${formatNumber(row.visitors)} visitors · ${formatNumber(row.pageviews)} pageviews` }))} axisLabels={dayAxis(daily)} />
        </section>
      )}
    </>
  )
}
