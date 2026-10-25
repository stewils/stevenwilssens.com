import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { formatNumber, niceMax, periodBefore, trendOf } from './format'
import type { Row } from './types'

export type Point = { key: string; label: string; value: number; detail?: string }
// `estimated` stacks a second, lighter part on the bar (the Costs page: billed below, estimated on top).
export type Bar = { key: string; label: string; value: number; detail: string; estimated?: number }

// The width of an element, kept current by a ResizeObserver, so an SVG is drawn at the
// width it is shown at and its text stays crisp.
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

// A daily trend as a line: a light wash under it, a dot and the latest value at the
// end, gridlines at zero, half and a round maximum, and a crosshair with that day's
// numbers on hover or touch. `max` pins the axis (a score out of 100). A point without a
// value (a week with no reading) keeps its place on the axis and breaks the line there,
// with no wash under a broken line.
export type TrendPoint = Omit<Point, 'value'> & { value: number | null }
export function TrendChart({ title, points, unit, max: fixedMax, format = formatNumber, readout, per = 'day', empty = 'No data yet' }: { title: string; points: TrendPoint[]; unit: string; max?: number; format?: (value: number) => string; readout?: ReactNode; per?: string; empty?: string }) {
  const [host, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const W = Math.max(width, 220)
  const H = 150
  const m = { top: 10, right: 52, bottom: 22, left: 44 }
  const iw = W - m.left - m.right
  const ih = H - m.top - m.bottom
  const n = points.length
  const values = points.flatMap((point) => (point.value === null ? [] : [point.value]))
  const known = [...points.keys()].filter((index) => points[index].value !== null)
  const last = known[known.length - 1]
  const peak = Math.max(0, ...values)
  const total = values.reduce((sum, value) => sum + value, 0)
  const max = fixedMax ?? niceMax(Math.max(peak, 1))
  const x = (index: number) => m.left + (n === 1 ? iw / 2 : (index / (n - 1)) * iw)
  const y = (value: number) => m.top + ih - (Math.min(value, max) / max) * ih
  const line = known.map((index, at) => `${at && known[at - 1] === index - 1 ? 'L' : 'M'}${x(index).toFixed(1)},${y(points[index].value!).toFixed(1)}`).join('')
  const active = hover === null ? null : points[hover]
  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const index = n === 1 ? 0 : Math.round(((event.clientX - box.left) / box.width) * (n - 1))
    setHover(Math.min(Math.max(index, 0), n - 1))
  }
  return (
    <figure className="trend">
      <figcaption><span>{title}</span><span className="chart-readout">{readout ?? (known.length ? `Total ${format(total)} · peak ${format(peak)}` : '')}</span></figcaption>
      {!known.length ? <p className="empty">{empty}</p> : (
        <div className="trend-plot" ref={host} onPointerLeave={() => setHover(null)}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${unit} per ${per}. Latest ${format(points[last].value!)}, peak ${format(peak)}.`}>
            {[0, max / 2, max].map((tick) => (
              <g key={tick}>
                <line className="grid" x1={m.left} x2={W - m.right} y1={y(tick)} y2={y(tick)} />
                <text className="tick" x={m.left - 8} y={y(tick) + 4} textAnchor="end">{format(tick)}</text>
              </g>
            ))}
            <text className="tick" x={x(0)} y={H - 5} textAnchor="start">{points[0].label}</text>
            {n > 1 && <text className="tick" x={x(n - 1)} y={H - 5} textAnchor="end">{points[n - 1].label}</text>}
            {n > 1 && known.length === n && <path className="area" d={`${line}L${x(last).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`} />}
            <path className="line" d={line} />
            {known.length < n && known.map((index) => <circle key={index} className="dot" cx={x(index)} cy={y(points[index].value!)} r={3} />)}
            <circle className="dot" cx={x(last)} cy={y(points[last].value!)} r={4} />
            <text className="value" x={x(last) + 9} y={y(points[last].value!) + 4}>{format(points[last].value!)}</text>
            {active && hover !== null && (
              <g>
                <line className="cross" x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} />
                {active.value !== null && <circle className="dot" cx={x(hover)} cy={y(active.value)} r={4} />}
              </g>
            )}
            <rect x={m.left} y={0} width={iw} height={H} fill="transparent" onPointerMove={pick} onPointerDown={pick} />
          </svg>
          {active && hover !== null && (
            <div className={`chart-tip ${x(hover) > W / 2 ? 'left' : ''}`} style={{ left: x(hover), top: active.value === null ? m.top + 20 : y(active.value) }} role="status">
              <strong>{active.label}</strong><span>{active.detail ?? (active.value === null ? 'No data' : `${format(active.value)} ${unit}`)}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  )
}

// Bars for values that are not a series in time (pageviews by hour of the day), or for
// discrete months whose bars stack two parts (`estimated`), with a legend.
export function BarChart({ title, bars, axisLabels, max: fixedMax, format = formatNumber, readout, legend }: { title: string; bars: Bar[]; axisLabels: string[]; max?: number; format?: (value: number) => string; readout?: string; legend?: ReactNode }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const stacked = bars.some((bar) => bar.estimated !== undefined)
  const height = (bar: Bar) => bar.value + (bar.estimated ?? 0)
  // Round the axis up to an even number so the midpoint gridline is a whole number.
  const peak = Math.max(...bars.map(height), 0)
  const max = fixedMax ?? Math.max(2, peak + (peak % 2))
  const active = hovered === null ? null : bars[hovered]
  const perBar = stacked && axisLabels.length === bars.length
  const pct = (value: number) => `${Math.min(100, (value / max) * 100)}%`
  return (
    <figure className={`chart${stacked ? ' chart--stacked' : ''}`}>
      <figcaption>
        <span>{title}{legend}</span>
        <span className="chart-readout">{active ? `${active.label} · ${active.detail}` : readout ?? `Peak ${format(peak)}`}</span>
      </figcaption>
      <div className="chart-plot" onMouseLeave={() => setHovered(null)}>
        <span className="chart-grid" style={{ bottom: '100%' }}><em>{format(max)}</em></span>
        <span className="chart-grid" style={{ bottom: '50%' }}><em>{format(max / 2)}</em></span>
        <div className="chart-bars">
          {bars.map((bar, index) => (
            <button type="button" key={bar.key} className={`chart-bar ${hovered === index ? 'active' : ''}`} onMouseEnter={() => setHovered(index)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} aria-label={`${bar.label}: ${bar.detail}`}>
              {stacked
                ? <span className="chart-stack" style={{ height: pct(height(bar)) }}>{(bar.estimated ?? 0) > 0 && <span className="chart-part est" style={{ flexGrow: bar.estimated }} />}{bar.value > 0 && <span className="chart-part billed" style={{ flexGrow: bar.value }} />}</span>
                : <span style={{ height: pct(bar.value) }} />}
            </button>
          ))}
        </div>
      </div>
      {/* A label per bar (stacked months): one axis column per bar, so each label sits under its bar. Fewer
          labels than bars (first, middle and last day) spread from edge to edge, as on the other charts. */}
      <div className={`chart-axis${perBar ? ' chart-axis--per-bar' : ''}`} style={perBar ? { gridTemplateColumns: `repeat(${axisLabels.length}, minmax(0, 1fr))` } : undefined}>{axisLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
    </figure>
  )
}

// A ranked breakdown (countries, referrers, …) with a bar behind each name. `max` pins the
// bars' scale and `format` writes the value (a share out of 100).
export function RankedList({ title, rows, unit = 'visitors', empty = 'No data yet', format = formatNumber, max: fixedMax }: { title: string; rows: Row[]; unit?: string; empty?: string; format?: (value: number) => string; max?: number }) {
  const max = fixedMax ?? Math.max(1, ...rows.map((row) => row.visitors))
  return (
    <div className="ranked-block">
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="empty">{empty}</p> : (
        <ol className="ranked">
          {rows.map((row) => (
            <li key={row.name} title={row.pageviews ? `${formatNumber(row.visitors)} ${unit} · ${formatNumber(row.pageviews)} pageviews` : undefined}>
              <span className="ranked-bar" style={{ width: `${(row.visitors / max) * 100}%` }} />
              <span className="ranked-name">{row.name}{row.detail && <small> · {row.detail}</small>}</span>
              <span className="ranked-value">{format(row.visitors)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// This range against the one before it: "+12% vs the 30 days before".
export function Vs({ current, previous, days }: { current: number; previous: number | null | undefined; days: number }) {
  const trend = trendOf(current, previous)
  if (!trend) return null
  return <><span className={`vs ${trend.dir}`}>{trend.text}</span> vs {periodBefore(days)}</>
}

// A share per week, one line per series (a version of the assistant), each with its 95% range
// as a band: a week without a reading has no point and breaks the line, a thin week (few
// readings) is a hollow dot reached by a 1px segment, and the series are told apart by line
// style as well as colour (now solid, before dashed, others dotted). Under the plot, a strip
// with the readings per week; under the figure, every value as a table.
export type SharePoint = { n: number; good: number; share: number; range: { low: number; high: number }; thin: boolean }
export type ShareSeries = { key: string; label: string; style: 'now' | 'before' | 'other'; points: (SharePoint | null)[] }
const percent = (share: number) => `${Math.round(share * 100)}%`
const shareLine = (series: ShareSeries, point: SharePoint) => point.thin
  ? `${series.label}: ${percent(point.share)}, ${point.good} of ${point.n}, too few to read`
  : `${series.label}: ${percent(point.share)} good, ${point.good} of ${point.n} rated · range ${Math.round(point.range.low * 100)} to ${percent(point.range.high)}`

export function ShareChart({ title, weeks, labels, series, counts, readout, label, empty }: { title: string; weeks: string[]; labels: string[]; series: ShareSeries[]; counts: number[]; readout: string; label: string; empty: string }) {
  const [host, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const W = Math.max(width, 220)
  const strip = 24
  const H = 170 + strip
  const m = { top: 10, right: 52, bottom: 22 + strip, left: 44 }
  const iw = W - m.left - m.right
  const ih = H - m.top - m.bottom
  const n = weeks.length
  const x = (index: number) => m.left + (n === 1 ? iw / 2 : (index / (n - 1)) * iw)
  const y = (share: number) => m.top + ih - share * ih
  const peak = Math.max(1, ...counts)
  const drawn = series.filter((item) => item.points.some(Boolean))
  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const index = n === 1 ? 0 : Math.round(((event.clientX - box.left) / box.width) * (n - 1))
    setHover(Math.min(Math.max(index, 0), n - 1))
  }
  // The runs of weeks with a point, each drawn as one band and its segments.
  const runs = (points: (SharePoint | null)[]) => {
    const found: { index: number; point: SharePoint }[][] = []
    points.forEach((point, index) => {
      if (!point) return
      const last = found[found.length - 1]
      if (last && last[last.length - 1].index === index - 1) last.push({ index, point })
      else found.push([{ index, point }])
    })
    return found
  }
  const tip = hover === null ? [] : drawn.flatMap((item) => (item.points[hover] ? [shareLine(item, item.points[hover]!)] : []))
  const now = drawn.find((item) => item.style === 'now')
  const lastNow = now ? [...now.points.keys()].reverse().find((index) => now.points[index]) : undefined
  return (
    <figure className="trend share-chart">
      <figcaption>
        <span>{title}</span>
        <span className="share-legends">{drawn.map((item) => <span key={item.key} className="share-legend"><svg width="22" height="8" aria-hidden="true"><line className={`share-line ${item.style}`} x1="1" x2="21" y1="4" y2="4" /></svg>{item.label}</span>)}</span>
        <span className="chart-readout">{readout}</span>
      </figcaption>
      {drawn.length === 0 ? <p className="empty">{empty}</p> : (
        <div className="trend-plot" ref={host} onPointerLeave={() => setHover(null)}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
            {[0, 0.5, 1].map((tick) => (
              <g key={tick}>
                <line className="grid" x1={m.left} x2={W - m.right} y1={y(tick)} y2={y(tick)} />
                <text className="tick" x={m.left - 8} y={y(tick) + 4} textAnchor="end">{percent(tick)}</text>
              </g>
            ))}
            {drawn.map((item) => runs(item.points).map((run) => (
              <g key={`${item.key}-${run[0].index}`} className={`share-series ${item.style}`}>
                {run.length === 1 && <line className="share-range" x1={x(run[0].index)} x2={x(run[0].index)} y1={y(run[0].point.range.high)} y2={y(run[0].point.range.low)} />}
                <path className="share-band" d={`${run.map(({ index, point }, at) => `${at ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.range.high).toFixed(1)}`).join('')}${[...run].reverse().map(({ index, point }) => `L${x(index).toFixed(1)},${y(point.range.low).toFixed(1)}`).join('')}Z`} />
                {run.slice(1).map(({ index, point }, at) => <line key={index} className={`share-line ${item.style}${point.thin ? ' thin' : ''}`} x1={x(run[at].index)} y1={y(run[at].point.share)} x2={x(index)} y2={y(point.share)} />)}
                {run.map(({ index, point }) => <circle key={index} className={`share-dot ${item.style}${point.thin ? ' thin' : ''}`} cx={x(index)} cy={y(point.share)} r={4} />)}
              </g>
            )))}
            {now && lastNow !== undefined && <text className="value" x={x(lastNow) + 9} y={y(now.points[lastNow]!.share) + 4}>{percent(now.points[lastNow]!.share)}</text>}
            {counts.map((count, index) => count > 0 && <rect key={index} className="share-strip" x={x(index) - 4} y={H - 22 - (count / peak) * 20} width={8} height={(count / peak) * 20} />)}
            <text className="tick" x={x(0)} y={H - 5} textAnchor="start">{labels[0]}</text>
            {n > 1 && <text className="tick" x={x(n - 1)} y={H - 5} textAnchor="end">{labels[n - 1]}</text>}
            {hover !== null && <line className="cross" x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} />}
            <rect x={m.left} y={0} width={iw} height={H} fill="transparent" onPointerMove={pick} onPointerDown={pick} />
          </svg>
          {hover !== null && (
            <div className={`chart-tip ${x(hover) > W / 2 ? 'left' : ''}`} style={{ left: x(hover), top: m.top + 20 }} role="status">
              <strong>Week of {labels[hover]}</strong>{tip.length ? tip.map((line) => <span key={line}>{line}</span>) : <span>No ratings</span>}
            </div>
          )}
          <p className="share-strip-key"><span aria-hidden="true" />Bars along the bottom: answers rated per week</p>
        </div>
      )}
      {drawn.length > 0 && (
        <details className="notes">
          <summary>The weeks as a table</summary>
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Week</th><th>Version</th><th className="num">Rated</th><th className="num">Good</th><th className="num">Range</th></tr></thead>
              <tbody>
                {weeks.flatMap((week, index) => drawn.flatMap((item) => {
                  const point = item.points[index]
                  return point ? [<tr key={`${week}-${item.key}`}><td>{labels[index]}</td><td>{item.label}</td><td className="num">{point.n}</td><td className="num">{percent(point.share)}{point.thin ? ' (too few)' : ''}</td><td className="num">{Math.round(point.range.low * 100)} to {percent(point.range.high)}</td></tr>] : []
                }))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  )
}
