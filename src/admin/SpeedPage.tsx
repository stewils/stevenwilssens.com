import { DataTable, type Column } from './DataTable'
import { formatNumber, formatPercent, formatVital, rateVital, vitalInfo } from './format'
import type { Stats, VitalCulprit, VitalSummary } from './types'

const ratingLabel = { good: '✓ Good', 'needs-improvement': '! Needs work', poor: '✕ Poor' } as const
const order = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB']

type VitalPage = { path: string } & Record<string, number>
const pageColumns: Column<VitalPage>[] = [
  { key: 'path', label: 'Page', value: (row) => row.path, strong: true },
  ...order.map((metric): Column<VitalPage> => ({ key: metric, label: metric, num: true, value: (row) => row[metric] ?? null, render: (row) => (row[metric] == null ? '—' : <span className={`status-text ${rateVital(metric, row[metric])}`}>{formatVital(metric, row[metric])}</span>) })),
]

const culpritColumns: Column<VitalCulprit>[] = [
  { key: 'metric', label: 'Metric', value: (row) => row.metric, strong: true },
  { key: 'path', label: 'Page', value: (row) => row.path },
  { key: 'target', label: 'Element', value: (row) => row.target, className: 'target' },
  { key: 'samples', label: 'Visits', value: (row) => row.samples, num: true },
  { key: 'p75', label: '75th pct', value: (row) => row.p75, num: true, render: (row) => <span className={`status-text ${rateVital(row.metric, row.p75)}`}>{formatVital(row.metric, row.p75)}</span> },
]

export function SpeedPage({ vitals }: { vitals: Stats['vitals'] }) {
  const metrics = order.map((metric) => vitals.metrics.find((row) => row.metric === metric)).filter((row): row is VitalSummary => Boolean(row))
  return (
    <>
      <section className="card" data-part="Assessment">
        <div className="card-head"><h2>Core Web Vitals</h2></div>
        <p className="note">Measured in visitors' browsers. Values are the 75th percentile, the number Google uses to rate a site. Google rates phones and desktops separately; a device type passes when LCP, INP and CLS are all good. The bar shows the share of visits rated good, needs work, and poor.</p>
        {metrics.length === 0 ? <p className="empty">No measurements yet</p> : (
          <>
            <div className="assessments">
              {vitals.devices.map((row) => (
                <div key={row.device} className={`assessment ${row.passes === null ? '' : row.passes ? 'good' : 'poor'}`}>
                  <span className="vital-name">{row.device} <small>{formatNumber(row.visits)} visits</small></span>
                  <strong>{row.passes === null ? 'Not enough data' : row.passes ? '✓ Passes' : '✕ Fails'}</strong>
                  <small>{(['LCP', 'INP', 'CLS'] as const).map((metric) => `${metric} ${formatVital(metric, row[metric])}`).join(' · ')}</small>
                </div>
              ))}
            </div>
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
          </>
        )}
      </section>

      {metrics.length > 0 && (
        <>
          <section className="card" data-part="Pages">
            <div className="card-head"><h2>By page</h2></div>
            <DataTable columns={pageColumns} rows={vitals.pages} rowKey={(row) => row.path} label="Web vitals by page" />
          </section>
          <section className="card" data-part="What to fix">
            <div className="card-head"><h2>What to fix</h2></div>
            <p className="note">The page elements behind visits rated needs work or poor: the largest image or text block (LCP), the control that responded slowly (INP), and the element that moved most (CLS).</p>
            <DataTable columns={culpritColumns} rows={vitals.culprits} rowKey={(row) => `${row.metric}|${row.path}|${row.target}`} empty="Nothing slow to report" label="Slow elements" />
          </section>
        </>
      )}
    </>
  )
}
