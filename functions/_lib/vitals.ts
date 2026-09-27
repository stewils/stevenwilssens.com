export type VitalRow = { metric: string; value: number; rating: string; path: string }

// 75th percentile, the threshold Google uses to rate a page's Core Web Vitals.
const p75 = (sorted: number[]) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]

export const summarizeVitals = (rows: VitalRow[]) => {
  const byMetric = new Map<string, VitalRow[]>()
  for (const row of rows) byMetric.set(row.metric, [...(byMetric.get(row.metric) ?? []), row])
  const metrics = [...byMetric].map(([metric, samples]) => {
    const values = samples.map((sample) => sample.value).sort((a, b) => a - b)
    const share = (rating: string) => samples.filter((sample) => sample.rating === rating).length / samples.length
    return { metric, p75: p75(values), samples: samples.length, good: share('good'), needsImprovement: share('needs-improvement'), poor: share('poor') }
  })
  const byPath = new Map<string, Record<string, number[]>>()
  for (const row of rows) {
    const entry = byPath.get(row.path) ?? {}
    ;(entry[row.metric] ??= []).push(row.value)
    byPath.set(row.path, entry)
  }
  const pages = [...byPath].map(([path, values]) => ({ path, ...Object.fromEntries(Object.entries(values).map(([metric, list]) => [metric, p75(list.sort((a, b) => a - b))])) }))
  return { metrics, pages }
}
