import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SubNav } from './SubNav'

// jsdom lays nothing out: give each part a box, the pane a scroll position and the
// browser the APIs the bar uses.
const box = (top: number, height = 100) => ({ top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
let frames: FrameRequestCallback[] = []
let reduced = false

beforeEach(() => {
  frames = []
  reduced = false
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced, media: query }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    return (this as HTMLElement).dataset.hidden ? ([] as unknown as DOMRectList) : ([box(0)] as unknown as DOMRectList)
  })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const top = (this as HTMLElement).dataset.top
    return box(top ? Number(top) : 0, 40)
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const flush = () => act(() => { const pending = frames; frames = []; pending.forEach((frame) => frame(0)) })

function Pane({ children, page = 'traffic', version = '1' }: { children: ReactNode; page?: string; version?: string }) {
  const scroller = useRef<HTMLDivElement>(null)
  return (
    <div ref={scroller} data-testid="pane" data-top="0">
      <SubNav scroller={scroller} page={page} version={version} />
      <div className="page">{children}</div>
    </div>
  )
}

const parts = (
  <>
    <section data-part="Visitors" data-top="0">a</section>
    <section data-part="Pages" data-top="400">b</section>
    <section data-part="Hidden" data-hidden="1" data-top="500">c</section>
    <section data-part="Clicks" data-top="900">d</section>
  </>
)

const scrollPane = (pane: HTMLElement, { scrollTop, clientHeight = 300, scrollHeight = 2000 }: { scrollTop: number; clientHeight?: number; scrollHeight?: number }) => {
  Object.defineProperty(pane, 'scrollTop', { configurable: true, value: scrollTop })
  Object.defineProperty(pane, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(pane, 'scrollHeight', { configurable: true, value: scrollHeight })
  fireEvent.scroll(pane)
  flush()
}

describe('the section bar', () => {
  it('lists the visible parts of the page and lights the first', () => {
    render(<Pane>{parts}</Pane>)
    const chips = screen.getAllByRole('button')
    expect(chips.map((chip) => chip.textContent)).toEqual(['Visitors', 'Pages', 'Clicks'])
    expect(chips[0]).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('navigation', { name: 'On this page' })).not.toHaveClass('stuck')
  })

  it('is not shown for a page with fewer than two parts', () => {
    render(<Pane><section data-part="Only">x</section></Pane>)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('scrolls to a part when its chip is clicked, smoothly unless motion is reduced', () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const { unmount } = render(<Pane>{parts}</Pane>)
    fireEvent.click(screen.getByRole('button', { name: 'Pages' }))
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' })
    unmount()
    reduced = true
    render(<Pane>{parts}</Pane>)
    fireEvent.click(screen.getByRole('button', { name: 'Clicks' }))
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' })
  })

  it('lights the part being read as the pane scrolls, the last one at the bottom, and sticks', () => {
    render(<Pane>{parts}</Pane>)
    const pane = screen.getByTestId('pane')
    const nav = screen.getByRole('navigation')
    nav.dataset.top = '0'
    // The parts move up as the pane scrolls.
    screen.getByText('b').dataset.top = '20'
    scrollPane(pane, { scrollTop: 380 })
    expect(screen.getByRole('button', { name: 'Pages' })).toHaveAttribute('aria-current', 'true')
    expect(nav).toHaveClass('stuck')
    // A second scroll before the frame runs is folded into the first.
    fireEvent.scroll(pane)
    fireEvent.scroll(pane)
    expect(frames).toHaveLength(1)
    flush()
    scrollPane(pane, { scrollTop: 1700, clientHeight: 300, scrollHeight: 2000 })
    expect(screen.getByRole('button', { name: 'Clicks' })).toHaveAttribute('aria-current', 'true')
  })

  it('keeps the lit chip in view in a bar that scrolls sideways', () => {
    render(<Pane>{parts}</Pane>)
    const nav = screen.getByRole('navigation')
    const scrollTo = vi.fn()
    nav.scrollTo = scrollTo as typeof nav.scrollTo
    Object.defineProperty(nav, 'scrollWidth', { configurable: true, value: 600 })
    Object.defineProperty(nav, 'clientWidth', { configurable: true, value: 300 })
    fireEvent(window, new Event('resize'))
    flush()
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
  })

  it('reads the parts again when the page changes, and cleans up', () => {
    const { rerender, unmount } = render(<Pane version="1">{parts}</Pane>)
    rerender(<Pane version="2"><section data-part="Only">x</section><section data-part="Two">y</section></Pane>)
    expect(screen.getAllByRole('button').map((chip) => chip.textContent)).toEqual(['Only', 'Two'])
    // A render that finds the same parts keeps them.
    rerender(<Pane version="3"><section data-part="Only">x</section><section data-part="Two">y</section></Pane>)
    expect(screen.getAllByRole('button')).toHaveLength(2)
    fireEvent.scroll(screen.getByTestId('pane'))
    unmount()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  it('puts a dot on the chip of a part marked new and names it changed', () => {
    const { container } = render(<Pane><section data-part="Flow" data-new="">a</section><section data-part="Roles">b</section></Pane>)
    expect(screen.getByRole('button', { name: 'Flow, changed' })).toHaveTextContent('Flow')
    expect(screen.getByRole('button', { name: 'Roles' })).toBeInTheDocument()
    const dots = container.querySelectorAll('.subnav-dot')
    expect(dots).toHaveLength(1)
    expect(dots[0]).toHaveAttribute('aria-hidden', 'true')
  })

  it('drops the dot when the part is no longer new and the parts are read again', () => {
    const { rerender } = render(<Pane version="1"><section data-part="Flow" data-new="">a</section><section data-part="Roles">b</section></Pane>)
    expect(screen.getByRole('button', { name: 'Flow, changed' })).toBeInTheDocument()
    rerender(<Pane version="2"><section data-part="Flow">a</section><section data-part="Roles">b</section></Pane>)
    expect(screen.getByRole('button', { name: 'Flow' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Flow, changed' })).not.toBeInTheDocument()
  })

  it('does nothing without a pane', () => {
    function Detached() {
      const scroller = useRef<HTMLDivElement>(null)
      return <SubNav scroller={scroller} page="x" version="1" />
    }
    const { container } = render(<Detached />)
    expect(container).toBeEmptyDOMElement()
  })
})
