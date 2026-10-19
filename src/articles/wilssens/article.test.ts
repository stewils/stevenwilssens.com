import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enhanceArticle, feedDate } from './article'

// An IntersectionObserver per call that the test drives by hand.
class FakeObserver {
  static all: FakeObserver[] = []
  observed = new Set<Element>()
  callback: IntersectionObserverCallback
  options?: IntersectionObserverInit
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) { this.callback = callback; this.options = options; FakeObserver.all.push(this) }
  observe = (element: Element) => { this.observed.add(element) }
  unobserve = (element: Element) => { this.observed.delete(element) }
  disconnect = vi.fn(() => { this.observed.clear() })
  fire = (entries: [Element, boolean][]) => this.callback(entries.map(([target, isIntersecting]) => ({ target, isIntersecting }) as IntersectionObserverEntry), this as unknown as IntersectionObserver)
}
const observerOf = (element: Element) => FakeObserver.all.find((observer) => observer.observed.has(element))!

const media = (matching: string[]) => vi.fn((query: string) => ({ matches: matching.some((part) => query.includes(part)), media: query, addEventListener: () => {}, removeEventListener: () => {} }))

let frames: FrameRequestCallback[] = []
const runFrames = (time = 0) => { const pending = frames; frames = []; pending.forEach((frame) => frame(time)) }

const article = ({ feed = '/api/building/wilssens' }: { feed?: string | null } = {}) => {
  document.body.innerHTML = `<article class="wx">
    <div class="wx-progress"><span></span></div>
    <p><span data-read-time>9 min read</span></p>
    <dl class="wx-stats"${feed ? ` data-feed="${feed}"` : ''}>
      <dt><span data-count="12" data-stat="mailboxes" data-decimals="0">12</span></dt>
      <dt><span data-count="1.5" data-stat="cost" data-decimals="2">1.50</span></dt>
      <dt><span data-count="7" data-stat="sites">7</span></dt>
    </dl>
    <button class="wx-copy" type="button" data-copy="https://steven.wilssens.com/building-wilssens">Copy link</button>
    <nav class="wx-toc"><details open><summary>Contents</summary><ol><li><a href="#one" data-toc="one">One</a></li><li><a href="#two" data-toc="two">Two</a></li><li><a href="#gone" data-toc="gone">Gone</a></li></ol></details></nav>
    <div class="wx-body">
      <section><h2 id="one" class="wx-h2">One</h2><p>${'word '.repeat(460)}</p></section>
      <section><h2 id="two" class="wx-h2">Two</h2>
        <figure class="wx-figure wx-diagram"><svg><g data-part=""></g><g data-part=""></g></svg></figure>
        <figure class="wx-figure wx-shot"><button type="button" data-zoom="/big.jpg" data-zoom-alt="A big screenshot"><img alt="" /><span class="hint">zoom</span></button></figure>
        <figure class="wx-figure wx-shot"><button type="button" data-zoom="/other.jpg"><img alt="" /></button></figure>
        <p class="wx-callout">Note</p>
      </section>
    </div>
    <p>As of <span data-feed-date="">1 October 2026.</span></p>
    <dialog class="wx-lightbox"><img alt="" /></dialog>
  </article>`
  return document.querySelector<HTMLElement>('article')!
}
const stat = (key: string) => document.querySelector<HTMLElement>(`[data-stat="${key}"]`)!

const fetchMock = vi.fn()
const feedResponse = (body: unknown, ok = true) => fetchMock.mockResolvedValue({ ok, json: async () => body })
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

beforeEach(() => {
  frames = []
  FakeObserver.all = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  vi.stubGlobal('matchMedia', media([]))
  fetchMock.mockReset()
  feedResponse(null, false)
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
  Reflect.deleteProperty(window, 'IntersectionObserver')
  Reflect.deleteProperty(window, 'matchMedia')
  document.body.innerHTML = ''
})

describe('feedDate', () => {
  it('writes the day the numbers were read, the same in every time zone', () => {
    expect(feedDate('2026-10-18T23:30:00Z')).toBe('18 October 2026')
    expect(feedDate('2026-10-19T00:30:00+02:00')).toBe('18 October 2026')
  })
})

describe('enhanceArticle', () => {
  it('works out the reading time from the words on the page', () => {
    const root = article()
    enhanceArticle(root)
    expect(root.querySelector('[data-read-time]')).toHaveTextContent('2 min read')
  })

  it('fills the reading progress bar as the article scrolls past, and stops on cleanup', () => {
    const root = article()
    vi.stubGlobal('innerHeight', 1000)
    const rect = vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 3000 } as DOMRect)
    const stop = enhanceArticle(root)
    runFrames()
    const bar = root.querySelector<HTMLElement>('.wx-progress span')!
    expect(bar.style.transform).toBe('scaleX(0)')
    rect.mockReturnValue({ top: -1000, height: 3000 } as DOMRect)
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll')) // one frame for a burst of scroll events
    expect(frames).toHaveLength(1)
    runFrames()
    expect(bar.style.transform).toBe('scaleX(0.5)')
    rect.mockReturnValue({ top: 0, height: 500 } as DOMRect) // shorter than the window: read in full
    window.dispatchEvent(new Event('resize'))
    runFrames()
    expect(bar.style.transform).toBe('scaleX(1)')
    stop()
    window.dispatchEvent(new Event('scroll'))
    expect(frames).toHaveLength(0)
    expect(root.dataset.wxMotion).toBeUndefined()
  })

  it('marks the section being read in the contents', () => {
    const root = article()
    enhanceArticle(root)
    const [one, two] = [...root.querySelectorAll('section')]
    const spy = observerOf(one)
    expect(spy.observed.has(two)).toBe(true)
    const link = (id: string) => root.querySelector(`[data-toc="${id}"]`)!
    spy.fire([[two, true]])
    expect(link('two')).toHaveAttribute('aria-current', 'true')
    expect(link('one')).not.toHaveAttribute('aria-current')
    spy.fire([[one, true]])
    expect(link('one')).toHaveAttribute('aria-current', 'true')
    expect(link('two')).not.toHaveAttribute('aria-current')
    spy.fire([[one, false], [two, false]]) // between sections: the last mark stays
    expect(link('one')).toHaveAttribute('aria-current', 'true')
  })

  it('folds the contents on narrow screens, and again after a section is chosen', () => {
    vi.stubGlobal('matchMedia', media(['max-width: 1099px']))
    const root = article()
    const stop = enhanceArticle(root)
    const details = root.querySelector('details')!
    expect(details.open).toBe(false)
    details.open = true
    root.querySelector('summary')!.click()
    details.open = true
    root.querySelector<HTMLAnchorElement>('[data-toc="two"]')!.addEventListener('click', (event) => event.preventDefault())
    root.querySelector<HTMLAnchorElement>('[data-toc="two"]')!.click()
    expect(details.open).toBe(false)
    stop()
    details.open = true
    root.querySelector<HTMLAnchorElement>('[data-toc="two"]')!.click()
    expect(details.open).toBe(true)
  })

  it('keeps the contents open on wide screens', () => {
    const root = article()
    enhanceArticle(root)
    const details = root.querySelector('details')!
    root.querySelector<HTMLAnchorElement>('[data-toc="one"]')!.addEventListener('click', (event) => event.preventDefault())
    root.querySelector<HTMLAnchorElement>('[data-toc="one"]')!.click()
    expect(details.open).toBe(true)
  })

  it('lets figures rise in and diagram parts follow one by one, then counts the numbers up once they are seen', () => {
    const root = article({ feed: null })
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const stop = enhanceArticle(root)
    expect(root.dataset.wxMotion).toBe('on')
    const parts = root.querySelectorAll<SVGElement>('[data-part]')
    expect(parts[1].style.getPropertyValue('--i')).toBe('1')

    const figure = root.querySelector('.wx-figure')!
    const reveal = observerOf(figure)
    reveal.fire([[figure, true], [root.querySelector('.wx-callout')!, false]])
    expect((figure as HTMLElement).dataset.shown).toBe('')
    expect(reveal.observed.has(figure)).toBe(false)
    expect(reveal.observed.has(root.querySelector('.wx-callout')!)).toBe(true)

    const cost = stat('cost')
    const counters = observerOf(cost)
    counters.fire([[cost, true], [stat('mailboxes'), false]])
    expect(cost.dataset.counted).toBe('')
    runFrames(550) // half way: eased, not yet there
    expect(Number(cost.textContent)).toBeGreaterThan(0.75)
    expect(Number(cost.textContent)).toBeLessThan(1.5)
    runFrames(2000)
    expect(cost.textContent).toBe('1.50')
    expect(frames).toHaveLength(0)

    stop()
    expect(reveal.disconnect).toHaveBeenCalled()
    expect(counters.disconnect).toHaveBeenCalled()
    expect(root.dataset.wxMotion).toBeUndefined()
  })

  it('stays still with reduced motion: nothing hidden, nothing counted', () => {
    vi.stubGlobal('matchMedia', media(['reduce']))
    const root = article({ feed: null })
    enhanceArticle(root)
    expect(root.dataset.wxMotion).toBeUndefined()
    expect(FakeObserver.all).toHaveLength(1) // only the contents spy
  })

  it('does without IntersectionObserver and without matchMedia', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return 1 })
    vi.stubGlobal('fetch', fetchMock)
    const root = article({ feed: null })
    const stop = enhanceArticle(root)
    expect(root.dataset.wxMotion).toBeUndefined()
    expect(root.querySelector('details')!.open).toBe(true)
    expect(stop).not.toThrow()
  })

  it('shows today\'s numbers from the live feed at once when the page is still', async () => {
    vi.stubGlobal('matchMedia', media(['reduce']))
    feedResponse({ asOf: '2026-10-19T08:00:00Z', numbers: { mailboxes: 14, cost: 2.256, sites: 7, extra: 1 } })
    const root = article()
    enhanceArticle(root)
    expect(fetchMock).toHaveBeenCalledWith('/api/building/wilssens', expect.objectContaining({ headers: { Accept: 'application/json' } }))
    await settle()
    expect(stat('mailboxes')).toHaveTextContent('14')
    expect(stat('mailboxes').dataset.count).toBe('14')
    expect(stat('cost')).toHaveTextContent('2.26')
    expect(stat('sites')).toHaveTextContent('7')
    expect(root.querySelector('[data-feed-date]')).toHaveTextContent('19 October 2026.')
  })

  it('counts a figure already on screen on to today\'s value, and lets one not yet shown start from it', async () => {
    let resolveFeed: (value: unknown) => void = () => {}
    fetchMock.mockReturnValue(new Promise((resolve) => { resolveFeed = resolve }))
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const root = article()
    enhanceArticle(root)
    const mailboxes = stat('mailboxes')
    observerOf(mailboxes).fire([[mailboxes, true]])
    runFrames(5000)
    expect(mailboxes).toHaveTextContent('12')
    resolveFeed({ ok: true, json: async () => ({ asOf: 'not a date', numbers: { mailboxes: 20, cost: 3, sites: 'many' } }) })
    await settle()
    runFrames(5000)
    expect(mailboxes).toHaveTextContent('20')
    expect(stat('cost').dataset.count).toBe('3')
    expect(stat('cost')).toHaveTextContent('1.50') // counts from 0 to 3 once it comes into view
    expect(stat('sites').dataset.count).toBe('7')
    expect(root.querySelector('[data-feed-date]')).toHaveTextContent('1 October 2026.')
  })

  it('keeps the numbers from the last refresh when the live feed fails, is empty, or the page is left first', async () => {
    feedResponse({ asOf: '2026-10-19T08:00:00Z' })
    enhanceArticle(article())
    await settle()
    expect(stat('mailboxes')).toHaveTextContent('12')

    feedResponse(null, false)
    enhanceArticle(article())
    await settle()
    expect(stat('mailboxes')).toHaveTextContent('12')

    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    const stop = enhanceArticle(article())
    const signal = (fetchMock.mock.calls.at(-1)![1] as RequestInit).signal!
    stop()
    expect(signal.aborted).toBe(true)
    await settle()
    expect(stat('mailboxes')).toHaveTextContent('12')
  })

  it('opens a screenshot full size in a dialog, and closes it on the backdrop', () => {
    const root = article({ feed: null })
    const dialog = root.querySelector('dialog')!
    dialog.showModal = vi.fn()
    dialog.close = vi.fn()
    enhanceArticle(root)
    root.querySelector<HTMLElement>('.hint')!.click()
    expect(dialog.showModal).toHaveBeenCalled()
    const big = dialog.querySelector('img')!
    expect(big.getAttribute('src')).toBe('/big.jpg')
    expect(big.alt).toBe('A big screenshot')
    root.querySelector<HTMLButtonElement>('[data-zoom="/other.jpg"]')!.click()
    expect(big.alt).toBe('')
    big.click()
    expect(dialog.close).not.toHaveBeenCalled()
    dialog.click()
    expect(dialog.close).toHaveBeenCalled()
  })

  it('leaves screenshots alone in a browser without dialogs', () => {
    const root = article({ feed: null })
    enhanceArticle(root)
    Reflect.set(root.querySelector('dialog')!, 'showModal', undefined)
    expect(() => root.querySelector<HTMLButtonElement>('[data-zoom]')!.click()).not.toThrow()
    root.querySelector('dialog')!.remove()
    const bare = article({ feed: null })
    bare.querySelector('dialog')!.remove()
    enhanceArticle(bare)
    expect(() => bare.querySelector<HTMLButtonElement>('[data-zoom]')!.click()).not.toThrow()
  })

  it('copies the article link and says so for a moment', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      const root = article({ feed: null })
      enhanceArticle(root)
      const button = root.querySelector<HTMLButtonElement>('[data-copy]')!
      button.click()
      await vi.waitFor(() => expect(button).toHaveTextContent('Copied ✓'))
      expect(writeText).toHaveBeenCalledWith('https://steven.wilssens.com/building-wilssens')
      vi.advanceTimersByTime(1800)
      expect(button).toHaveTextContent('Copy link')

    } finally {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('says "Copy failed" when the browser refuses the clipboard or has none, then shows the label again', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(async () => { throw new Error('denied') })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      const root = article({ feed: null })
      const stop = enhanceArticle(root)
      const button = root.querySelector<HTMLButtonElement>('[data-copy]')!
      button.click()
      await vi.waitFor(() => expect(button).toHaveTextContent('Copy failed'))
      vi.advanceTimersByTime(1800)
      expect(button).toHaveTextContent('Copy link')

      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
      button.click()
      await vi.waitFor(() => expect(button).toHaveTextContent('Copy failed'))
      stop() // a timer still running is cleared with the rest
      vi.advanceTimersByTime(1800)
      expect(button).toHaveTextContent('Copy failed')
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('goes back to "Copy link" after a double click, not to "Copied"', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}) } })
    try {
      const root = article({ feed: null })
      enhanceArticle(root)
      const button = root.querySelector<HTMLButtonElement>('[data-copy]')!
      button.click()
      await vi.waitFor(() => expect(button).toHaveTextContent('Copied ✓'))
      vi.advanceTimersByTime(1000)
      button.click()
      await settle()
      expect(button).toHaveTextContent('Copied ✓')
      vi.advanceTimersByTime(1000) // the first click's timer would have put the label back by now
      expect(button).toHaveTextContent('Copied ✓')
      vi.advanceTimersByTime(800)
      expect(button).toHaveTextContent('Copy link')
      vi.advanceTimersByTime(1800)
      expect(button).toHaveTextContent('Copy link')
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('handles an article without a body, contents, progress bar or feed', () => {
    document.body.innerHTML = '<article><span data-read-time>5 min read</span></article>'
    const root = document.querySelector('article')!
    const stop = enhanceArticle(root)
    runFrames()
    expect(root.querySelector('[data-read-time]')).toHaveTextContent('5 min read')
    expect(fetchMock).not.toHaveBeenCalled()
    stop()
  })
})
