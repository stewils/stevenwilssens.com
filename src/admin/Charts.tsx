import { useState } from 'react'
import { formatNumber } from './format'
import type { Row } from './types'

export type Bar = { key: string; label: string; value: number; detail: string }

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
