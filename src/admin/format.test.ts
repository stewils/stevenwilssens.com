import { describe, expect, it } from 'vitest'
import { formatAgo, niceMax, periodBefore, projectMonth, trendOf } from './format'

describe('chart and comparison helpers', () => {
  it('rounds an axis up to a clean maximum', () => {
    expect([0, 3, 4, 5, 7, 12, 23, 26, 70, 101, 999].map(niceMax)).toEqual([4, 4, 4, 5, 10, 20, 25, 50, 100, 200, 1000])
  })

  it('compares a period with the one before it', () => {
    expect(trendOf(12, 10)).toEqual({ text: '+20%', dir: 'up' })
    expect(trendOf(9, 12)).toEqual({ text: '−25%', dir: 'down' })
    expect(trendOf(10, 10)).toEqual({ text: 'same', dir: 'flat' })
    expect(trendOf(3, 0)).toEqual({ text: 'new', dir: 'up' })
    expect(trendOf(0, 0)).toEqual({ text: 'same', dir: 'flat' })
    expect(trendOf(5, undefined)).toBeNull()
    expect([1, 30, 365].map(periodBefore)).toEqual(['yesterday', 'the 30 days before', 'the year before'])
  })

  it('projects the month from its pace so far, in UTC', () => {
    expect(projectMonth(10_000_000, new Date('2026-10-10T12:00:00Z'))).toBe(31_000_000)
    expect(projectMonth(0, new Date('2026-02-01T00:00:00Z'))).toBe(0)
  })

  it('says how long ago the numbers were loaded', () => {
    const now = Date.parse('2026-10-17T12:00:00Z')
    expect(formatAgo(now - 10_000, now)).toBe('just now')
    expect(formatAgo(now - 4 * 60_000, now)).toBe('4 min ago')
    expect(formatAgo(now - 3 * 3_600_000, now)).toBe('3 h ago')
    expect(formatAgo(now - 2 * 86_400_000, now)).toMatch(/Oct 15/)
  })
})
