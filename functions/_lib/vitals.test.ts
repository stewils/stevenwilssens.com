import { describe, expect, it } from 'vitest'
import { summarizeVitals, type VitalRow } from './vitals'

const row = (metric: string, value: number, rating: string, extra: Partial<VitalRow> = {}): VitalRow => ({ metric, value, rating, path: '/', device: 'mobile', ...extra })

describe('summarizing the Core Web Vitals', () => {
  it('returns empty lists without data', () => {
    expect(summarizeVitals([])).toEqual({ metrics: [], pages: [], devices: [], culprits: [] })
  })

  it('takes the 75th percentile and the share of each rating per metric', () => {
    const ratings = ['good', 'good', 'needs-improvement', 'poor']
    const rows = [4000, 1000, 3000, 2000].map((value, index) => row('LCP', value, ratings[index]))
    const { metrics, pages } = summarizeVitals(rows)
    expect(metrics).toEqual([{ metric: 'LCP', p75: 4000, samples: 4, good: 0.5, needsImprovement: 0.25, poor: 0.25 }])
    expect(pages).toEqual([{ path: '/', LCP: 4000 }])
  })

  it('rates each device type, mobile first, unknown last, and counts visits by TTFB', () => {
    const rows = [
      row('LCP', 1200, 'good', { device: 'desktop' }), row('CLS', 0.01, 'good', { device: 'desktop' }), row('TTFB', 100, 'good', { device: 'desktop' }),
      row('LCP', 3000, 'needs-improvement'), row('CLS', 0.02, 'good'), row('INP', 100, 'good'), row('TTFB', 300, 'good'), row('TTFB', 400, 'good'),
      row('LCP', 1000, 'good', { device: null }),
      row('FCP', 900, 'good', { device: 'tv' }),
      row('LCP', 900, 'good', { device: 'tablet' }), row('CLS', 0.5, 'poor', { device: 'tablet' }),
    ]
    const devices = summarizeVitals(rows).devices
    expect(devices.map((device) => device.device)).toEqual(['mobile', 'desktop', 'tablet', 'unknown', 'tv'])
    expect(devices[0]).toMatchObject({ visits: 2, passes: false, LCP: 3000, INP: 100 })
    expect(devices[1]).toMatchObject({ visits: 1, passes: true })
    expect(devices[2]).toMatchObject({ passes: false })
    expect(devices.find((device) => device.device === 'unknown')).toMatchObject({ visits: 0, passes: null })
    expect(devices.find((device) => device.device === 'tv')).toMatchObject({ passes: null, FCP: 900 })
  })

  it('lists the elements behind slow visits, most frequent first, at most fifteen', () => {
    const rows: VitalRow[] = [
      row('LCP', 4000, 'poor', { path: '/', target: 'img.hero' }),
      row('LCP', 3000, 'needs-improvement', { path: '/', target: 'img.hero' }),
      row('CLS', 0.3, 'poor', { path: '/about', target: 'div.banner' }),
      row('LCP', 900, 'good', { target: 'img.hero' }),
      row('TTFB', 2000, 'poor', { target: 'document' }),
      row('INP', 600, 'poor'),
      ...Array.from({ length: 20 }, (_, index) => row('INP', 300, 'needs-improvement', { path: `/p${index}`, target: 'button' })),
    ]
    const { culprits } = summarizeVitals(rows)
    expect(culprits).toHaveLength(15)
    expect(culprits[0]).toEqual({ metric: 'LCP', path: '/', target: 'img.hero', samples: 2, p75: 4000 })
    expect(culprits.some((culprit) => culprit.metric === 'TTFB')).toBe(false)
  })
})
