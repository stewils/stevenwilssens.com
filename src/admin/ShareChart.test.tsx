import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareChart, type SharePoint, type ShareSeries } from './Charts'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const point = (n: number, good: number, thin = n < 5): SharePoint => ({ n, good, share: good / n, range: { low: Math.max(0, good / n - 0.2), high: Math.min(1, good / n + 0.1) }, thin })
const weeks = ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']
const labels = ['Sep 28', 'Oct 5', 'Oct 12', 'Oct 19']
const series: ShareSeries[] = [
  { key: 'new', label: 'opus-5-5 · a1b2c3d4', style: 'now', points: [null, null, point(7, 6), point(20, 18)] },
  { key: 'old', label: 'opus-5-5 · 9f8e7d6c', style: 'before', points: [point(10, 6), null, point(2, 1), null] },
  { key: 'fallback', label: 'sonnet-5 · a1b2c3d4 · fallback', style: 'other', points: [null, null, point(1, 1), null] },
  { key: 'never', label: 'unrated · 00000000', style: 'other', points: [null, null, null, null] },
]
const show = (overrides: Partial<Parameters<typeof ShareChart>[0]> = {}) => render(<ShareChart title="Rated good by week (30 days)" weeks={weeks} labels={labels} series={series} counts={[10, 0, 10, 20]} readout="Now 90% good (18 of 20)" label="Rated good by week, 30 days." empty="Your scores appear here after your first rating." {...overrides} />)
const plotBox = () => vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 150, right: 100, bottom: 150, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)

describe('ShareChart', () => {
  it('draws one line per version, breaks over a week without ratings, and shows two versions in one week', () => {
    const { container } = show()
    expect(screen.getByRole('img', { name: 'Rated good by week, 30 days.' })).toBeInTheDocument()
    // The version answering now: one segment (weeks 3 and 4); the one before: two runs, joined only within a run.
    expect(container.querySelectorAll('.share-series.now')).toHaveLength(1)
    expect(container.querySelectorAll('.share-series.before')).toHaveLength(2)
    expect(container.querySelector('.trend-plot')!.querySelectorAll('line.share-line.now')).toHaveLength(1)
    expect(container.querySelector('.trend-plot')!.querySelectorAll('line.share-line.before')).toHaveLength(0)
    // Week 3 has three versions, each its own dot; a version without a point is left out entirely.
    expect(container.querySelectorAll('circle.share-dot')).toHaveLength(5)
    expect(container.querySelectorAll('.share-band')).toHaveLength(4)
    expect(within(container.querySelector('.share-legends') as HTMLElement).getAllByText(/·/).map((item) => item.textContent)).toEqual(['opus-5-5 · a1b2c3d4', 'opus-5-5 · 9f8e7d6c', 'sonnet-5 · a1b2c3d4 · fallback'])
    // The last point of the current version carries its value; the readout says it in words.
    expect(container.querySelector('text.value')).toHaveTextContent('90%')
    expect(screen.getByText('Now 90% good (18 of 20)')).toBeInTheDocument()
    expect(container.querySelectorAll('.share-strip')).toHaveLength(3)
    expect(screen.getByText('Bars along the bottom: answers rated per week')).toBeInTheDocument()
  })

  it('thin weeks are hollow points reached by a thin segment', () => {
    const { container } = show()
    expect(container.querySelectorAll('circle.share-dot.thin')).toHaveLength(2)
    expect(container.querySelector('.trend-plot')!.querySelectorAll('line.share-line.thin')).toHaveLength(0)
    cleanup()
    const thinNext = show({ series: [{ key: 'a', label: 'a', style: 'now', points: [point(9, 6), point(2, 2), null, null] }] })
    expect(thinNext.container.querySelector('.trend-plot')!.querySelectorAll('line.share-line.thin')).toHaveLength(1)
  })

  it('the tooltip lists each version\'s share, count and range for the week', () => {
    plotBox()
    const { container } = show()
    fireEvent.pointerMove(container.querySelector('svg rect[fill="transparent"]')!, { clientX: 67 })
    const tip = screen.getByRole('status')
    expect(tip).toHaveTextContent('Week of Oct 12')
    expect(tip).toHaveTextContent('opus-5-5 · a1b2c3d4: 86% good, 6 of 7 rated · range 66 to 96%')
    expect(tip).toHaveTextContent('opus-5-5 · 9f8e7d6c: 50%, 1 of 2, too few to read')
    expect(tip).toHaveClass('left')
    fireEvent.pointerDown(container.querySelector('svg rect[fill="transparent"]')!, { clientX: 33 })
    expect(screen.getByRole('status')).toHaveTextContent('Week of Oct 5No ratings')
    fireEvent.pointerLeave(container.querySelector('.trend-plot')!)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('the weeks table carries every weekly value', () => {
    show()
    const table = screen.getByText('The weeks as a table').closest('details')!.querySelector('table')!
    const rows = [...table.querySelectorAll('tbody tr')].map((row) => row.textContent)
    expect(rows).toEqual([
      'Sep 28opus-5-5 · 9f8e7d6c1060%40 to 70%',
      'Oct 12opus-5-5 · a1b2c3d4786%66 to 96%',
      'Oct 12opus-5-5 · 9f8e7d6c250% (too few)30 to 60%',
      'Oct 12sonnet-5 · a1b2c3d4 · fallback1100% (too few)80 to 100%',
      'Oct 19opus-5-5 · a1b2c3d42090%70 to 100%',
    ])
  })

  it('says so before the first rating, and draws a dot for a single week', () => {
    show({ series: [] })
    expect(screen.getByText('Your scores appear here after your first rating.')).toBeInTheDocument()
    expect(screen.queryByText('The weeks as a table')).not.toBeInTheDocument()
    cleanup()
    plotBox()
    const { container } = show({ weeks: ['2026-10-19'], labels: ['Oct 19'], counts: [3], series: [{ key: 'a', label: 'a', style: 'other', points: [point(3, 3)] }] })
    expect(container.querySelectorAll('circle.share-dot')).toHaveLength(1)
    expect(container.querySelector('.trend-plot')!.querySelectorAll('line.share-line')).toHaveLength(0)
    // A lone week still shows its range, as a short bar instead of a band.
    expect(container.querySelectorAll('line.share-range')).toHaveLength(1)
    expect(container.querySelector('text.value')).toBeNull()
    fireEvent.pointerMove(container.querySelector('svg rect[fill="transparent"]')!, { clientX: 10 })
    expect(screen.getByRole('status')).toHaveTextContent('Week of Oct 19')
  })

})
