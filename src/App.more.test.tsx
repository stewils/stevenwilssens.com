import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { experiences, recommendations } from './resume'

// What a visitor meets beyond the first screen: the theme switch with and without view
// transitions, the experience timeline following the reader, back and forward, the
// assistant's entry points, and the write-ups by their own address.

class FakeObserver {
  static all: FakeObserver[] = []
  observed: Element[] = []
  callback: IntersectionObserverCallback
  options?: IntersectionObserverInit
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) { this.callback = callback; this.options = options; FakeObserver.all.push(this) }
  observe = (element: Element) => { this.observed.push(element) }
  unobserve = () => {}
  disconnect = vi.fn()
  fire = (entries: [Element, boolean][]) => act(() => this.callback(entries.map(([target, isIntersecting]) => ({ target, isIntersecting }) as IntersectionObserverEntry), this as unknown as IntersectionObserver))
}

const setPath = (path: string) => window.history.pushState({}, '', path)
const fetchMock = vi.fn(async () => Response.json({ ready: false }))

beforeEach(() => {
  FakeObserver.all = []
  setPath('/')
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'IntersectionObserver')
  Reflect.deleteProperty(window, 'matchMedia')
  Reflect.deleteProperty(document, 'startViewTransition')
  delete document.documentElement.dataset.theme
  localStorage.clear()
  setPath('/')
})

describe('theme switch', () => {
  it('cross-fades with a view transition where the browser has one', async () => {
    const startViewTransition = vi.fn((swap: () => void) => { swap() })
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startViewTransition })
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument()
  })

  it('switches at once for visitors who prefer reduced motion', async () => {
    const startViewTransition = vi.fn()
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startViewTransition })
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {} }))
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(startViewTransition).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

describe('experience timeline', () => {
  it('highlights the role being read on the graph, except right after a node was clicked', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    setPath('/experience')
    render(<App />)
    // The timeline's own observer, not the one that reveals rows.
    const observer = FakeObserver.all.find((item) => item.options?.rootMargin === '-35% 0px -55% 0px')!
    expect(observer.observed).toHaveLength(experiences.length)
    const nodes = () => [...document.querySelectorAll('.graph-node')]
    const selected = () => nodes().findIndex((node) => node.classList.contains('selected'))
    expect(selected()).toBe(0)

    const timeline = observer.observed
    const third = timeline[2]
    observer.fire([[timeline[0], false], [third, true]])
    expect(selected()).toBe(2)

    observer.fire([[timeline[0], false]]) // nothing in view: stays where it was
    expect(selected()).toBe(2)
    observer.fire([[document.body, true]]) // not a role
    expect(selected()).toBe(2)

    await userEvent.click(nodes()[1])
    expect(selected()).toBe(1)
    observer.fire([[third, true]]) // the page is still scrolling to the clicked role
    expect(selected()).toBe(1)
  })

  it('watches the graph for size changes where ResizeObserver exists', () => {
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class { observe = observe; disconnect = disconnect })
    setPath('/experience')
    const view = render(<App />)
    expect(observe).toHaveBeenCalledWith(document.querySelector('.graph-scroll'))
    view.unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})

describe('navigation', () => {
  it('follows back and forward without a reload', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Steven Wilssens' })).toBeInTheDocument()
    act(() => {
      setPath('/patents')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByRole('heading', { level: 1, name: 'Patents' })).toBeInTheDocument()
    expect(document.title).toBe('Patents | Steven Wilssens')
  })

  it('opens the wilssens.com write-up at its own address, with Projects marked in the menu', () => {
    setPath('/building-wilssens')
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /Building wilssens\.com/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page')
  })

  it('collapses a recommendation again after reading it in full', async () => {
    setPath('/recommendations')
    render(<App />)
    const first = screen.getAllByRole('button', { name: 'more' })[0]
    await userEvent.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByRole('button', { name: 'more' })).toHaveLength(recommendations.length)
  })
})

describe('the assistant\'s entry points on the home page', () => {
  it('opens the assistant, and opens it straight on the job-description check', async () => {
    const opened = vi.fn()
    window.addEventListener('sw-ask-open', opened)
    try {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Check a job description →' }))
      expect((opened.mock.calls[0][0] as CustomEvent).detail).toEqual({ question: undefined, fit: true })
      const heroButtons = document.querySelectorAll<HTMLButtonElement>('.ask-hero-button')
      expect(heroButtons.length).toBeGreaterThan(0)
      await userEvent.click(heroButtons[0])
      expect((opened.mock.calls[1][0] as CustomEvent).detail).toEqual({ question: undefined, fit: false })
    } finally {
      window.removeEventListener('sw-ask-open', opened)
    }
  })
})
