import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SpatialField from './SpatialField'
import { applyTheme, currentTheme, serverTheme, subscribeTheme } from './theme'

// matchMedia that answers the queries a test names as matching.
const media = (matching: string[]) => vi.fn((query: string) => ({ matches: matching.some((part) => query.includes(part)), media: query, addEventListener: () => {}, removeEventListener: () => {} }))

// An IntersectionObserver the test drives: `fire` reports entries to an observer. Tests find
// the one watching their rows (`watching`), not just the latest: another module may create one.
class FakeObserver {
  static latest: FakeObserver | null = null
  static all: FakeObserver[] = []
  static watching = (element: Element) => FakeObserver.all.find((observer) => observer.observed.has(element)) ?? null
  observed = new Set<Element>()
  callback: IntersectionObserverCallback
  options?: IntersectionObserverInit
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) { this.callback = callback; this.options = options; FakeObserver.latest = this; FakeObserver.all.push(this) }
  observe = (element: Element) => { this.observed.add(element) }
  unobserve = (element: Element) => { this.observed.delete(element) }
  disconnect = vi.fn(() => { this.observed.clear() })
  fire = (entries: [Element, boolean][]) => this.callback(entries.map(([target, isIntersecting]) => ({ target, isIntersecting }) as IntersectionObserverEntry), this as unknown as IntersectionObserver)
}

let frames: FrameRequestCallback[] = []
beforeEach(() => {
  frames = []
  FakeObserver.latest = null
  FakeObserver.all = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'matchMedia')
  Reflect.deleteProperty(window, 'IntersectionObserver')
  delete document.documentElement.dataset.rowReveal
  document.body.innerHTML = ''
})
const runFrames = () => { const pending = frames; frames = []; pending.forEach((frame) => frame(0)) }

describe('SpatialField', () => {
  const field = () => document.querySelector<HTMLElement>('.spatial-field')!

  it('leans the rings toward the pointer on a mouse or trackpad', () => {
    vi.stubGlobal('matchMedia', media(['pointer: fine']))
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 800)
    const view = render(<SpatialField><img alt="Steven Wilssens" /></SpatialField>)
    vi.spyOn(field(), 'getBoundingClientRect').mockReturnValue({ left: 400, top: 300, width: 200, height: 200 } as DOMRect)
    fireEvent.pointerMove(window, { clientX: 1000, clientY: 0 })
    runFrames()
    expect(field().style.getPropertyValue('--px')).toBe('1.000') // clamped at the edge
    expect(field().style.getPropertyValue('--py')).toBe('-1.000')
    fireEvent.pointerMove(window, { clientX: 750, clientY: 400 })
    runFrames()
    expect(field().style.getPropertyValue('--px')).toBe('0.500')
    expect(field().style.getPropertyValue('--py')).toBe('0.000')
    view.unmount()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  it('stays still with reduced motion, on touch screens, and without matchMedia', () => {
    for (const matching of [['pointer: fine', 'reduce'], []]) {
      vi.stubGlobal('matchMedia', media(matching))
      render(<SpatialField><img alt="" /></SpatialField>)
      fireEvent.pointerMove(window, { clientX: 10, clientY: 10 })
      expect(frames).toHaveLength(0)
      cleanup()
    }
    vi.unstubAllGlobals()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return 1 })
    render(<SpatialField><img alt="" /></SpatialField>)
    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 })
    expect(frames).toHaveLength(0)
  })

  it('sends out a wave when the photo is pressed, keeps at most four, and clears each when it ends', () => {
    render(<SpatialField><img alt="Steven Wilssens" /></SpatialField>)
    const mark = document.querySelector('.hero-mark')!
    expect(document.querySelectorAll('.spatial-rings > span:not(.spatial-wave)')).toHaveLength(6)
    let now = 1000
    vi.spyOn(Date, 'now').mockImplementation(() => ++now)
    for (let i = 0; i < 5; i++) fireEvent.pointerDown(mark)
    const waves = () => document.querySelectorAll('.spatial-wave')
    expect(waves()).toHaveLength(4)
    // jsdom has no AnimationEvent, so React listens for the prefixed name.
    act(() => { const wave = waves()[0]; fireEvent.animationEnd(wave); wave.dispatchEvent(new Event('webkitAnimationEnd', { bubbles: true })) })
    expect(waves()).toHaveLength(3)
  })
})

describe('revealRows', () => {
  // rowReveal keeps whether the page's first load has happened in the module, so each test
  // loads it fresh; `afterFirstLoad` uses that first call up on an empty root.
  let revealRows: typeof import('./rowReveal').revealRows
  beforeEach(async () => {
    vi.resetModules()
    ;({ revealRows } = await import('./rowReveal'))
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    revealRows(document.createElement('div'))
    FakeObserver.all = []
    FakeObserver.latest = null
  })

  it('on the first load leaves the rows already on screen as painted, and sweeps in the rest', async () => {
    vi.resetModules()
    ;({ revealRows } = await import('./rowReveal'))
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    document.body.innerHTML = '<div class="timeline-item">on screen</div><div class="timeline-item">below</div>'
    const [onScreen, below] = [...document.querySelectorAll<HTMLElement>('.timeline-item')]
    vi.spyOn(below, 'getBoundingClientRect').mockReturnValue({ top: window.innerHeight + 200 } as DOMRect)
    revealRows()
    expect(onScreen.dataset.shown).toBe('still')
    expect('shown' in below.dataset).toBe(false)
    expect(FakeObserver.watching(below)).not.toBeNull()
    expect(FakeObserver.watching(onScreen)).toBeNull()
  })

  const rows = () => {
    document.body.innerHTML = '<div class="timeline-item">1</div><div class="recommendation">2</div><div class="project-card" data-shown="">3</div><p>not a row</p>'
    return [...document.querySelectorAll<HTMLElement>('.timeline-item, .recommendation, .project-card')]
  }

  it('uncovers rows one after another as they scroll into view', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const [first, second, already] = rows()
    const stop = revealRows()
    expect(document.documentElement.dataset.rowReveal).toBe('on')
    const observer = FakeObserver.watching(first)!
    expect([...observer.observed]).toEqual([first, second]) // the row already shown is left alone
    observer.fire([[first, true], [second, true]])
    expect(first.dataset.shown).toBe('')
    expect(first.style.getPropertyValue('--reveal-delay')).toBe('0ms')
    expect(second.style.getPropertyValue('--reveal-delay')).toBe('90ms')
    expect(observer.observed.size).toBe(0)
    expect('shown' in already.dataset).toBe(true)
    stop()
    expect(observer.disconnect).toHaveBeenCalled()
  })

  it('caps the stagger, and leaves rows that are not yet in view', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    document.body.innerHTML = Array.from({ length: 8 }, (_, i) => `<article class="work-list"><div></div></article><div class="timeline-item">${i}</div>`).join('')
    const items = [...document.querySelectorAll<HTMLElement>('.timeline-item')]
    revealRows(document.body)
    FakeObserver.latest!.fire([...items.map((item) => [item, true] as [Element, boolean]), [document.createElement('div'), false]])
    expect(items[7].style.getPropertyValue('--reveal-delay')).toBe('450ms')
  })

  it('shows everything at once with reduced motion or without IntersectionObserver', () => {
    document.documentElement.dataset.rowReveal = 'on'
    vi.stubGlobal('matchMedia', media(['reduce']))
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    rows()
    const stop = revealRows()
    expect(document.documentElement.dataset.rowReveal).toBeUndefined()
    expect(FakeObserver.latest).toBeNull()
    expect(stop).not.toThrow()

    vi.unstubAllGlobals()
    document.documentElement.dataset.rowReveal = 'on'
    revealRows()
    expect(document.documentElement.dataset.rowReveal).toBeUndefined()
  })
})

describe('theme', () => {
  afterEach(() => { delete document.documentElement.dataset.theme; localStorage.clear() })

  it('is dark unless light was chosen, and remembers the choice', () => {
    expect(serverTheme()).toBe('dark')
    expect(currentTheme()).toBe('dark')
    document.documentElement.dataset.theme = 'sepia'
    expect(currentTheme()).toBe('dark')
    const listener = vi.fn()
    const unsubscribe = subscribeTheme(listener)
    applyTheme('light')
    expect(currentTheme()).toBe('light')
    expect(localStorage.getItem('sw-theme')).toBe('light')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    applyTheme('dark')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('still switches when storage is blocked', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    applyTheme('light')
    expect(currentTheme()).toBe('light')
    setItem.mockRestore()
  })
})
