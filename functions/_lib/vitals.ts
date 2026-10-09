export type VitalRow = { metric: string; value: number; rating: string; path: string; device?: string | null; target?: string | null }

// 75th percentile, the threshold Google uses to rate a page's Core Web Vitals.
const p75 = (sorted: number[]) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]
const p75Of = (rows: VitalRow[]) => p75(rows.map((row) => row.value).sort((a, b) => a - b))

// The three metrics Google's page experience assessment uses, with their "good" limits.
const coreLimits: Record<string, number> = { LCP: 2500, INP: 200, CLS: 0.1 }
const deviceOrder = ['mobile', 'desktop', 'tablet']

const groupBy = (rows: VitalRow[], key: (row: VitalRow) => string) => {
  const groups = new Map<string, VitalRow[]>()
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row])
  return groups
}

export const summarizeVitals = (rows: VitalRow[]) => {
  const metrics = [...groupBy(rows, (row) => row.metric)].map(([metric, samples]) => {
    const share = (rating: string) => samples.filter((sample) => sample.rating === rating).length / samples.length
    return { metric, p75: p75Of(samples), samples: samples.length, good: share('good'), needsImprovement: share('needs-improvement'), poor: share('poor') }
  })
  const byPath = new Map<string, Record<string, number[]>>()
  for (const row of rows) {
    const entry = byPath.get(row.path) ?? {}
    ;(entry[row.metric] ??= []).push(row.value)
    byPath.set(row.path, entry)
  }
  const pages = [...byPath].map(([path, values]) => ({ path, ...Object.fromEntries(Object.entries(values).map(([metric, list]) => [metric, p75(list.sort((a, b) => a - b))])) }))

  // Google rates phones and desktops separately. A device type passes when LCP, INP and
  // CLS are all good at the 75th percentile; INP may be missing when nobody interacted.
  const devices = [...groupBy(rows, (row) => row.device ?? 'unknown')]
    .sort(([a], [b]) => (deviceOrder.indexOf(a) + 1 || 99) - (deviceOrder.indexOf(b) + 1 || 99))
    .map(([device, samples]) => {
      const values: Record<string, number> = {}
      for (const [metric, list] of groupBy(samples, (row) => row.metric)) values[metric] = p75Of(list)
      const passes = values.LCP == null || values.CLS == null ? null : Object.entries(coreLimits).every(([metric, limit]) => values[metric] == null || values[metric] <= limit)
      // TTFB is reported once for every page load, so it doubles as the visit count.
      return { device, visits: samples.filter((row) => row.metric === 'TTFB').length, passes, ...values }
    })

  // What to fix: the page elements behind visits that were not rated good.
  const slow = rows.filter((row) => row.metric in coreLimits && row.rating !== 'good' && row.target)
  const culprits = [...groupBy(slow, (row) => `${row.metric}\u0000${row.path}\u0000${row.target}`)]
    .map(([, samples]) => ({ metric: samples[0].metric, path: samples[0].path, target: samples[0].target as string, samples: samples.length, p75: p75Of(samples) }))
    .sort((a, b) => b.samples - a.samples)
    .slice(0, 15)

  return { metrics, pages, devices, culprits }
}
