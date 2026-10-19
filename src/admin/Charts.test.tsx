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
