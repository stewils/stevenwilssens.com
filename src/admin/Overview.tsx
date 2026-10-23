import type { ReactNode } from 'react'
import { TrendChart, Vs } from './Charts'
import { dayLabel, fillDays, formatNumber, formatUsd } from './format'
import type { Need } from './needs'
import { pages, type PageId } from './pages'
import { Shimmer } from './Skeleton'
import type { AdminData } from './types'

// One headline number; a shimmer until its API has answered.
function Kpi({ label, value, note, tone = '' }: { label: string; value: ReactNode | null; note?: ReactNode; tone?: '' | 'good' | 'bad' }) {
  return <div><dt>{label}</dt><dd className={`kpi-value ${tone}`}>{value ?? <Shimmer className="kpi-shimmer" />}</dd><dd className="kpi-note">{note}</dd></div>
}

// The headline numbers against the period before, what needs Steven (linking to the
// page it is on), a tile per page with a line of what is there, and the visitors per day.
export function Overview({ data, needs, summaries }: { data: AdminData; needs: Need[]; summaries: Partial<Record<PageId, string>> }) {
  const { stats, ask, resume, days } = data
  const report = resume?.report
  const daily = stats ? fillDays(stats.daily, stats.days) : []
  const titleOf = (id: PageId) => pages.find((page) => page.id === id)?.title ?? ''
  const previous = stats?.previous
  // "Nothing is waiting" only once every API has answered; before that, a placeholder.
  // A failed Team read state counts as answered (it shows its own banner), so this never waits forever on it.
  const pending = [stats, ask, resume, data.mcp].some((part) => part === null) || (data.team !== undefined && data.team.reads === null && !data.team.readsError)
  return (
    <>
      <dl className="kpis card" aria-label="Headline numbers">
        <Kpi label="Visitors" value={stats && formatNumber(stats.totals.visitors)} note={stats && <Vs current={stats.totals.visitors} previous={previous?.visitors} days={days} />} />
        <Kpi label="Pageviews" value={stats && formatNumber(stats.totals.pageviews)} note={stats && <Vs current={stats.totals.pageviews} previous={previous?.pageviews} days={days} />} />
        <Kpi label="Résumé downloads" value={stats && formatNumber(stats.totals.downloads)} note={stats && <Vs current={stats.totals.downloads} previous={previous?.downloads} days={days} />} />
        <Kpi label="Contact clicks" value={stats && formatNumber(stats.totals.contactClicks)} note={stats && <Vs current={stats.totals.contactClicks} previous={previous?.contactClicks} days={days} />} />
        <Kpi label="Résumé ATS score" value={resume && (report ? `${report.score}` : '—')} tone={report ? (report.score >= 90 ? 'good' : report.score < 70 ? 'bad' : '') : ''} note={report ? `of 100 · ${report.ats?.warnings ?? report.warnings ?? 0} ${(report.ats?.warnings ?? report.warnings) === 1 ? 'warning' : 'warnings'}${report.baseline && report.baseline.change !== 0 ? ` · ${report.baseline.change > 0 ? '+' : ''}${report.baseline.change} vs before` : ''}` : resume ? 'no report in this deployment' : ''} />
        <Kpi label="Assistant this month" value={ask && formatUsd(ask.month.costMicro)} note={ask ? `${formatNumber(ask.month.questions)} questions · ${formatUsd(ask.budgetUsd * 1_000_000)} budget` : ''} />
      </dl>

      <section aria-labelledby="h-needs">
        <div className="sec-head"><h2 id="h-needs">Needs you</h2></div>
        <div className="needs">
          {needs.length === 0 && pending && <div className="skeleton" aria-hidden="true"><Shimmer /><Shimmer /></div>}
          {needs.length === 0 && !pending && <p className="all-clear">Nothing is waiting for you.</p>}
          {needs.map((need) => (
            <a key={need.key} className="need" href={`#${need.hash ?? need.page}`}><span className="need-n">{need.n}</span><span className="need-text">{need.text}</span><span className="need-where">{titleOf(need.page)} →</span></a>
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
          <TrendChart title={days === 1 ? 'Today' : `Last ${days} days`} unit="visitors" points={daily.map((row) => ({ key: row.day, label: dayLabel(row.day), value: row.visitors, detail: `${formatNumber(row.visitors)} visitors · ${formatNumber(row.pageviews)} pageviews` }))} />
        </section>
      )}
    </>
  )
}
