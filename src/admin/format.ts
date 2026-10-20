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
type DayRow = { day: string; pageviews: number; visitors: number }
export function fillDays(rows: DayRow[], days: number, now?: Date): DayRow[]
export function fillDays<T extends { day: string }>(rows: T[], days: number, now: Date, blank: (day: string) => T): T[]
export function fillDays(rows: { day: string }[], days: number, now = new Date(), blank: (day: string) => { day: string } = (day): DayRow => ({ day, pageviews: 0, visitors: 0 })) {
  const byDay = new Map(rows.map((row) => [row.day, row]))
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now)
    date.setDate(date.getDate() - (days - 1 - index))
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return byDay.get(day) ?? blank(day)
  })
}

export const formatUsd = (micro: number) => `$${(micro / 1_000_000).toFixed(2)}`
// Whole dollars, for a chart axis ($100, not $100.00).
export const formatUsdWhole = (micro: number) => `$${Math.round(micro / 1_000_000).toLocaleString('en-US')}`

export const formatBytes = (bytes: number) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`)

export const formatDay = (ts: number) => new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

export const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
// First, middle and last day under a chart of days.
export const dayAxis = (rows: { day: string }[]) => (rows.length > 1 ? [dayLabel(rows[0].day), dayLabel(rows[Math.floor(rows.length / 2)].day), dayLabel(rows[rows.length - 1].day)] : rows.map((row) => dayLabel(row.day)))

export const place = (row: { city: string | null; region?: string | null; country: string | null }) => [row.city, row.region, row.country].filter(Boolean).join(', ') || 'Unknown'

// A round axis maximum (4, 5, 10, 20, 25, 50, 100, …) so the gridlines read as whole numbers.
export const niceMax = (value: number) => {
  if (value <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 2.5, 5, 10]) if (value <= step * power) return step * power
  return 10 * power
}

// This period against the one before it: "+12%", "−8%", "same", or "new" when the
// period before had nothing. Null when there is nothing to compare with.
export type Trend = { text: string; dir: 'up' | 'down' | 'flat' }
export const trendOf = (current: number, previous: number | null | undefined): Trend | null => {
  if (previous === null || previous === undefined) return null
  if (previous === 0) return current === 0 ? { text: 'same', dir: 'flat' } : { text: 'new', dir: 'up' }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { text: 'same', dir: 'flat' }
  return { text: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`, dir: pct > 0 ? 'up' : 'down' }
}
// The name of the period a range is compared with.
export const periodBefore = (days: number) => (days === 1 ? 'yesterday' : days === 365 ? 'the year before' : `the ${days} days before`)

// Where this month's spend ends at its pace so far (UTC, as the server counts the month).
export const projectMonth = (spentMicro: number, now = new Date()) => {
  const day = now.getUTCDate()
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  return Math.round((spentMicro / day) * daysInMonth)
}
export const monthName = (now = new Date()) => now.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })

// "just now", "4 min ago", "2 h ago", then the date.
export const formatAgo = (ts: number, now = Date.now()) => {
  const seconds = Math.max(0, Math.round((now - ts) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return formatTime(ts)
}

// A development cost (the Costs page, AC-26): no mark when all of it was billed, ≈ when some of
// it is an estimate, ? when the run did not say which, a trailing + when a sum leaves out
// tokens that have no price. `text` is shown (its marks hidden from screen readers), `words` is
// read: "estimated $3.20", "billing unknown, $3.20", "…, plus unpriced runs".
export type CostMark = 'billed' | 'estimated' | 'unknown'
export const formatCost = (micro: number, mark: CostMark = 'billed', unpriced = false) => {
  const plus = unpriced ? '+' : ''
  const plusWords = unpriced ? ', plus unpriced runs' : ''
  if (micro <= 0) return unpriced ? { text: '+', words: 'unpriced runs only' } : { text: '—', words: 'none' }
  const amount = micro < 10_000 ? '<$0.01' : `$${(micro / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const spoken = micro < 10_000 ? 'less than $0.01' : amount
  const sign = mark === 'estimated' ? '≈' : mark === 'unknown' ? '?' : ''
  const words = mark === 'estimated' ? `estimated ${spoken}` : mark === 'unknown' ? `billing unknown, ${spoken}` : spoken
  return { text: `${sign}${amount}${plus}`, words: `${words}${plusWords}` }
}
