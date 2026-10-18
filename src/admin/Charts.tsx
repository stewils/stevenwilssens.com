import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { formatNumber, niceMax, periodBefore, trendOf } from './format'
import type { Row } from './types'

export type Point = { key: string; label: string; value: number; detail?: string }
export type Bar = { key: string; label: string; value: number; detail: string }

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
// numbers on hover or touch. `max` pins the axis (a score out of 100).
export function TrendChart({ title, points, unit, max: fixedMax, format = formatNumber, readout }: { title: string; points: Point[]; unit: string; max?: number; format?: (value: number) => string; readout?: ReactNode }) {
  const [host, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const W = Math.max(width, 220)
  const H = 150
  const m = { top: 10, right: 52, bottom: 22, left: 44 }
  const iw = W - m.left - m.right
  const ih = H - m.top - m.bottom
  const n = points.length
  const last = n - 1
  const peak = Math.max(0, ...points.map((point) => point.value))
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const max = fixedMax ?? niceMax(Math.max(peak, 1))
  const x = (index: number) => m.left + (n === 1 ? iw / 2 : (index / (n - 1)) * iw)
  const y = (value: number) => m.top + ih - (Math.min(value, max) / max) * ih
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join('')
  const active = hover === null ? null : points[hover]
  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const index = n === 1 ? 0 : Math.round(((event.clientX - box.left) / box.width) * (n - 1))
    setHover(Math.min(Math.max(index, 0), last))
  }
  return (
    <figure className="trend">
      <figcaption><span>{title}</span><span className="chart-readout">{readout ?? (n ? `Total ${format(total)} · peak ${format(peak)}` : '')}</span></figcaption>
      {n === 0 ? <p className="empty">No data yet</p> : (
        <div className="trend-plot" ref={host} onPointerLeave={() => setHover(null)}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${unit} per day. Latest ${format(points[last].value)}, peak ${format(peak)}.`}>
            {[0, max / 2, max].map((tick) => (
              <g key={tick}>
                <line className="grid" x1={m.left} x2={W - m.right} y1={y(tick)} y2={y(tick)} />
                <text className="tick" x={m.left - 8} y={y(tick) + 4} textAnchor="end">{format(tick)}</text>
              </g>
            ))}
            <text className="tick" x={x(0)} y={H - 5} textAnchor="start">{points[0].label}</text>
            {n > 1 && <text className="tick" x={x(last)} y={H - 5} textAnchor="end">{points[last].label}</text>}
            {n > 1 && <path className="area" d={`${line}L${x(last).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`} />}
            <path className="line" d={line} />
            <circle className="dot" cx={x(last)} cy={y(points[last].value)} r={4} />
            <text className="value" x={x(last) + 9} y={y(points[last].value) + 4}>{format(points[last].value)}</text>
            {active && hover !== null && (
              <g>
                <line className="cross" x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} />
                <circle className="dot" cx={x(hover)} cy={y(active.value)} r={4} />
              </g>
            )}
            <rect x={m.left} y={0} width={iw} height={H} fill="transparent" onPointerMove={pick} onPointerDown={pick} />
          </svg>
          {active && hover !== null && (
            <div className={`chart-tip ${x(hover) > W / 2 ? 'left' : ''}`} style={{ left: x(hover), top: y(active.value) }} role="status">
              <strong>{active.label}</strong><span>{active.detail ?? `${format(active.value)} ${unit}`}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  )
}

// Bars for values that are not a series in time (pageviews by hour of the day).
export function BarChart({ title, bars, axisLabels, max: fixedMax }: { title: string; bars: Bar[]; axisLabels: string[]; max?: number }) {
  const [hovered, setHovered] = useState<number | null>(null)
  // Round the axis up to an even number so the midpoint gridline is a whole number.
  const peak = Math.max(...bars.map((bar) => bar.value), 0)
  const max = fixedMax ?? Math.max(2, peak + (peak % 2))
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
              <span style={{ height: `${Math.min(100, (bar.value / max) * 100)}%` }} />
            </button>
          ))}
        </div>
      </div>
      <div className="chart-axis">{axisLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
    </figure>
  )
}

// A ranked breakdown (countries, referrers, …) with a bar behind each name.
export function RankedList({ title, rows, unit = 'visitors', empty = 'No data yet' }: { title: string; rows: Row[]; unit?: string; empty?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.visitors))
  return (
    <div className="ranked-block">
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="empty">{empty}</p> : (
        <ol className="ranked">
          {rows.map((row) => (
            <li key={row.name} title={row.pageviews ? `${formatNumber(row.visitors)} ${unit} · ${formatNumber(row.pageviews)} pageviews` : undefined}>
              <span className="ranked-bar" style={{ width: `${(row.visitors / max) * 100}%` }} />
              <span className="ranked-name">{row.name}{row.detail && <small> · {row.detail}</small>}</span>
              <span className="ranked-value">{formatNumber(row.visitors)}</span>
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
