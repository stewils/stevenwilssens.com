import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BarChart, RankedList, TrendChart, Vs } from './Charts'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const points = [
  { key: 'a', label: 'Oct 17', value: 3 },
  { key: 'b', label: 'Oct 18', value: 9, detail: '9 visitors · 20 pageviews' },
  { key: 'c', label: 'Oct 19', value: 5 },
]

// The plot is 100px wide from x = 0, so clientX picks the point at that share.
const plotBox = () => vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 150, right: 100, bottom: 150, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)

describe('TrendChart', () => {
  it('says there is no data for an empty series', () => {
    render(<TrendChart title="Visitors per day" points={[]} unit="visitors" />)
    expect(screen.getByText('No data yet')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('reads out the total, the peak and the latest value', () => {
    render(<TrendChart title="Visitors per day" points={points} unit="visitors" />)
    expect(screen.getByText('Total 17 · peak 9')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Visitors per day: visitors per day. Latest 5, peak 9.' })).toBeInTheDocument()
    expect(screen.getByText('Oct 17')).toBeInTheDocument()
    expect(screen.getByText('Oct 19')).toBeInTheDocument()
  })

  it("shows the day's numbers under the pointer, and hides them when it leaves", () => {
    plotBox()
    const { container } = render(<TrendChart title="Visitors per day" points={points} unit="visitors" />)
    const hit = container.querySelector('rect')!
    fireEvent.pointerMove(hit, { clientX: 50 })
    expect(screen.getByRole('status')).toHaveTextContent('Oct 189 visitors · 20 pageviews')
    fireEvent.pointerDown(hit, { clientX: 0 })
    expect(screen.getByRole('status')).toHaveTextContent('Oct 173 visitors')
    expect(screen.getByRole('status')).not.toHaveClass('left')
    fireEvent.pointerMove(hit, { clientX: 500 })
    expect(screen.getByRole('status')).toHaveTextContent('Oct 19')
    expect(screen.getByRole('status')).toHaveClass('left')
    fireEvent.pointerLeave(container.querySelector('.trend-plot')!)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('draws a single point, a fixed axis, its own format and readout', () => {
    plotBox()
    const { container } = render(<TrendChart title="Score" points={[{ key: 'x', label: 'Oct 1', value: 120 }]} unit="points" max={100} format={(value) => `${value} pts`} readout="Now 120" />)
    expect(screen.getByText('Now 120')).toBeInTheDocument()
    expect(screen.getByText('100 pts')).toBeInTheDocument()
    expect(container.querySelector('path.area')).toBeNull()
    fireEvent.pointerMove(container.querySelector('rect')!, { clientX: 80 })
    expect(screen.getByRole('status')).toHaveTextContent('Oct 1120 pts points')
  })

  it('keeps a point without a value on the axis and breaks the line there, with no wash', () => {
    plotBox()
    const gappy = [{ key: 'a', label: 'Sep 28', value: 40 }, { key: 'b', label: 'Oct 5', value: null, detail: 'No reader votes' }, { key: 'c', label: 'Oct 12', value: 60 }, { key: 'd', label: 'Oct 19', value: 80 }, { key: 'e', label: 'Oct 26', value: null }]
    const { container } = render(<TrendChart title="Reader votes" points={gappy} unit="helpful share" per="week" />)
    // The axis runs over every week, the line starts again after the gap, and the last value is the last week with one.
    expect(screen.getByText('Sep 28')).toBeInTheDocument()
    expect(screen.getByText('Oct 26')).toBeInTheDocument()
    expect(container.querySelector('path.line')!.getAttribute('d')!.match(/M/g)).toHaveLength(2)
    expect(container.querySelector('path.area')).toBeNull()
    expect(container.querySelectorAll('circle.dot')).toHaveLength(4)
    expect(container.querySelector('text.value')).toHaveTextContent('80')
    expect(screen.getByText('Total 180 · peak 80')).toBeInTheDocument()
    const hit = container.querySelector('rect')!
    fireEvent.pointerMove(hit, { clientX: 25 })
    expect(screen.getByRole('status')).toHaveTextContent('Oct 5No reader votes')
    fireEvent.pointerMove(hit, { clientX: 100 })
    expect(screen.getByRole('status')).toHaveTextContent('Oct 26No data')
  })

  it('says there is no data when no point has a value', () => {
    render(<TrendChart title="Reader votes" points={[{ key: 'a', label: 'Oct 5', value: null }]} unit="helpful share" />)
    expect(screen.getByText('No data yet')).toBeInTheDocument()
  })

  it('is drawn at the width it is shown at, and stops watching when it goes', () => {
    const disconnect = vi.fn()
    let measure = () => {}
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { measure = callback } observe() {} disconnect() { disconnect() } })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600)
    const { unmount } = render(<TrendChart title="Visitors per day" points={points} unit="visitors" />)
    measure()
    expect(screen.getByRole('img')).toHaveAttribute('width', '600')
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})

describe('BarChart', () => {
  const bars = [
    { key: '9', label: '9 AM', value: 3, detail: '3 pageviews' },
    { key: '10', label: '10 AM', value: 0, detail: '0 pageviews' },
  ]

  it('shows the peak, rounds the axis to an even number, and reads out the bar under the pointer or focus', () => {
    const { container } = render(<BarChart title="Pageviews by hour" bars={bars} axisLabels={['12 AM', '12 PM']} />)
    expect(screen.getByText('Peak 3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    const bar = screen.getByRole('button', { name: '9 AM: 3 pageviews' })
    fireEvent.mouseEnter(bar)
    expect(screen.getByText('9 AM · 3 pageviews')).toBeInTheDocument()
    expect(bar).toHaveClass('active')
    fireEvent.mouseLeave(container.querySelector('.chart-plot')!)
    expect(screen.getByText('Peak 3')).toBeInTheDocument()
    fireEvent.focus(screen.getByRole('button', { name: '10 AM: 0 pageviews' }))
    expect(screen.getByText('10 AM · 0 pageviews')).toBeInTheDocument()
    fireEvent.blur(screen.getByRole('button', { name: '10 AM: 0 pageviews' }))
    expect(screen.getByText('Peak 3')).toBeInTheDocument()
  })

  it('stacks an estimated part on top of the billed one, from zero, with a legend, a readout and its own axis format', () => {
    const months = [
      { key: '2026-09', label: 'September', value: 20_000_000, estimated: 43_100_000, detail: '$20.00 billed, estimated $43.10, 3 features' },
      { key: '2026-10', label: 'October so far', value: 12_000_000, estimated: 0, detail: '$12.00 billed, estimated $0.00, 5 features' },
      { key: '2026-11', label: 'November', value: 0, estimated: 5_000_000, detail: 'none' },
    ]
    const { container } = render(<BarChart title="Months" bars={months} axisLabels={['Sep', 'Oct', 'Nov']} max={100_000_000} format={(micro) => `$${micro / 1_000_000}`} readout="Last full month ≈$63.10" legend={<span className="chart-legend">billed estimated</span>} />)
    expect(container.querySelector('figure')).toHaveClass('chart--stacked')
    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('$50')).toBeInTheDocument()
    expect(screen.getByText('Last full month ≈$63.10')).toBeInTheDocument()
    expect(screen.getByText('billed estimated')).toBeInTheDocument()
    const september = screen.getByRole('button', { name: 'September: $20.00 billed, estimated $43.10, 3 features' })
    expect(september.querySelector<HTMLElement>('.chart-stack')!.style.height).toBe('63.1%')
    expect([...september.querySelectorAll<HTMLElement>('.chart-part')].map((part) => [part.className, part.style.flexGrow])).toEqual([['chart-part est', '43100000'], ['chart-part billed', '20000000']])
    // A part with nothing in it is not drawn.
    expect(screen.getByRole('button', { name: /^October so far/ }).querySelectorAll('.chart-part')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /^November/ }).querySelector('.chart-part')).toHaveClass('est')
    fireEvent.focus(september)
    expect(screen.getByText('September · $20.00 billed, estimated $43.10, 3 features')).toBeInTheDocument()
  })

  it('keeps a fixed maximum when given one', () => {
    render(<BarChart title="Hours" bars={bars} axisLabels={[]} max={10} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})

describe('RankedList', () => {
  it('lists the rows with their numbers, details and pageviews', () => {
    render(<RankedList title="Countries" rows={[{ name: 'United States', visitors: 1200, pageviews: 3000 }, { name: 'Belgium', visitors: 3, detail: 'Ghent' }]} />)
    expect(screen.getByRole('heading', { name: 'Countries' })).toBeInTheDocument()
    expect(screen.getByText('1,200')).toBeInTheDocument()
    expect(screen.getByText('United States').closest('li')).toHaveAttribute('title', '1,200 visitors · 3,000 pageviews')
    expect(screen.getByText('· Ghent')).toBeInTheDocument()
    expect(screen.getByText('Belgium').closest('li')).not.toHaveAttribute('title')
  })

  it('says when there is nothing to rank', () => {
    render(<RankedList title="Referrers" rows={[]} empty="No referrers" />)
    expect(screen.getByText('No referrers')).toBeInTheDocument()
  })
})

describe('Vs', () => {
  it('compares with the period before', () => {
    const { container } = render(<Vs current={12} previous={10} days={30} />)
    expect(container).toHaveTextContent('+20% vs the 30 days before')
    expect(container.querySelector('.vs.up')).not.toBeNull()
  })

  it('shows nothing without a period to compare with', () => {
    const { container } = render(<Vs current={12} previous={null} days={7} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('RankedList with a pinned scale', () => {
  it('writes the value with the format given and scales the bars to the maximum', () => {
    const { container } = render(<RankedList title="By criterion (share Yes)" format={(value) => `${value}%`} max={100} rows={[{ name: 'Accurate', visitors: 50, detail: '10% partly' }]} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(container.querySelector<HTMLElement>('.ranked-bar')!.style.width).toBe('50%')
  })
})
