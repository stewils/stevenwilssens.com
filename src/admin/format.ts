// Google's Core Web Vitals thresholds: [good up to, poor above].
export const vitalInfo: Record<string, { name: string; good: number; poor: number; unit: 'ms' | '' }> = {
  LCP: { name: 'Largest Contentful Paint', good: 2500, poor: 4000, unit: 'ms' },
  INP: { name: 'Interaction to Next Paint', good: 200, poor: 500, unit: 'ms' },
  CLS: { name: 'Cumulative Layout Shift', good: 0.1, poor: 0.25, unit: '' },
  FCP: { name: 'First Contentful Paint', good: 1800, poor: 3000, unit: 'ms' },
  TTFB: { name: 'Time to First Byte', good: 800, poor: 1800, unit: 'ms' },
}

export const rateVital = (metric: string, value: number) => {
  const info = vitalInfo[metric]
  if (!info) return 'good'
  return value <= info.good ? 'good' : value <= info.poor ? 'needs-improvement' : 'poor'
}

export const formatVital = (metric: string, value: number | undefined) => {
  if (value == null) return '—'
  if (vitalInfo[metric]?.unit !== 'ms') return value.toFixed(2)
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`
}

export const formatNumber = (value: number | null | undefined) => (value ?? 0).toLocaleString('en-US')

export const formatDuration = (ms: number | null | undefined) => {
  if (!ms) return '—'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export const formatPercent = (value: number | null | undefined, isFraction = false) => (value == null ? '—' : `${Math.round(isFraction ? value * 100 : value)}%`)

export const formatTime = (ts: number) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

// Fill the gaps so days with no traffic still show as zero-height bars.
export const fillDays = (rows: { day: string; pageviews: number; visitors: number }[], days: number, now = new Date()) => {
  const byDay = new Map(rows.map((row) => [row.day, row]))
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now)
    date.setDate(date.getDate() - (days - 1 - index))
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return byDay.get(day) ?? { day, pageviews: 0, visitors: 0 }
  })
}
