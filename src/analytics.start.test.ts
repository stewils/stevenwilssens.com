import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MetricWithAttribution } from 'web-vitals/attribution'

// The web-vitals reporters are replaced by ones the test fires by hand.
const vitals = vi.hoisted(() => ({ handlers: [] as ((metric: unknown) => void)[] }))
vi.mock('web-vitals/attribution', () => {
  const on = (handler: (metric: unknown) => void) => { vitals.handlers.push(handler) }
  return { onLCP: on, onINP: on, onCLS: on, onFCP: on, onTTFB: on }
})

type Sent = Record<string, unknown>
const beacon = vi.fn<(url: string, body: string) => boolean>()
const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
const sent = (): Sent[] => [...beacon.mock.calls.map((call) => call[1]), ...fetchMock.mock.calls.map((call) => ((call as unknown as [string, RequestInit])[1].body as string))].map((body) => JSON.parse(body) as Sent)
const ofType = (type: string) => sent().filter((event) => event.type === type)

// Each test gets a fresh module, since analytics starts only once per page load. The
// listeners a start adds stay on window and document, so they are taken off after each test.
const added: [EventTarget, string, EventListenerOrEventListenerObject, AddEventListenerOptions | boolean | undefined][] = []
const load = async () => { vi.resetModules(); return import('./analytics') }
const trackListeners = () => {
  for (const target of [window, document] as EventTarget[]) {
    const original = target.addEventListener.bind(target)
    vi.spyOn(target, 'addEventListener').mockImplementation((type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) => {
      if (listener) added.push([target, type, listener, options])
      original(type, listener, options)
    })
  }
}

const setNavigator = (key: string, value: unknown) => Object.defineProperty(navigator, key, { configurable: true, value })

beforeEach(() => {
  trackListeners()
  vitals.handlers = []
  beacon.mockReset()
  beacon.mockReturnValue(true)
  fetchMock.mockClear()
  setNavigator('sendBeacon', beacon)
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubEnv('PROD', true)
  localStorage.clear()
  window.history.replaceState(null, '', '/experience?utm_source=linkedin&utm_medium=social&keep=1#roles')
  document.title = 'Experience | Steven Wilssens'
})
afterEach(() => {
  for (const [target, type, listener, options] of added.splice(0)) target.removeEventListener(type, listener, options)
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'sendBeacon')
  Reflect.deleteProperty(navigator, 'doNotTrack')
  Reflect.deleteProperty(navigator, 'globalPrivacyControl')
  window.history.replaceState(null, '', '/')
  document.body.innerHTML = ''
})

describe('startAnalytics', () => {
  it('records a pageview with where the visitor came from, then drops the tracking tags from the address', async () => {
    const { startAnalytics } = await load()
    startAnalytics()
    const [view] = ofType('pageview')
    expect(beacon).toHaveBeenCalledWith('/api/collect', expect.any(String))
    expect(view).toMatchObject({ path: '/experience', title: 'Experience | Steven Wilssens', utm: { source: 'linkedin', medium: 'social', campaign: '', term: '', content: '' } })
    expect(view.pageviewId).toEqual(expect.any(String))
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/experience?keep=1#roles')
    startAnalytics() // once per page load
    expect(ofType('pageview')).toHaveLength(1)
  })

  it('takes ?ref= as the source when there is no utm_source', async () => {
    window.history.replaceState(null, '', '/?ref=newsletter')
    const { startAnalytics } = await load()
    startAnalytics()
    expect(ofType('pageview')[0].utm).toMatchObject({ source: 'newsletter' })
    expect(window.location.search).toBe('')
  })

  it('falls back to fetch with keepalive when the beacon is refused or missing, and ignores a failed send', async () => {
    beacon.mockReturnValue(false)
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    const { startAnalytics } = await load()
    startAnalytics()
    expect(fetchMock).toHaveBeenCalledWith('/api/collect', expect.objectContaining({ method: 'POST', keepalive: true }))
    Reflect.deleteProperty(navigator, 'sendBeacon')
    window.dispatchEvent(new Event('pagehide'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sends how long the page was read and how far it was scrolled when the tab is hidden or closed', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 })
    vi.stubGlobal('innerHeight', 1000)
    vi.stubGlobal('scrollY', 500)
    const { startAnalytics } = await load()
    startAnalytics()
    window.dispatchEvent(new Event('scroll'))

    now.mockReturnValue(4000)
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(ofType('engagement')[0]).toMatchObject({ path: '/experience', durationMs: 3000, scrollPct: 50 })

    // Back on the tab: the clock runs again from now.
    visibility.mockReturnValue('visible')
    now.mockReturnValue(10_000)
    document.dispatchEvent(new Event('visibilitychange'))
    now.mockReturnValue(11_000)
    window.dispatchEvent(new Event('pagehide'))
    expect(ofType('engagement')[1]).toMatchObject({ durationMs: 4000 })
    Reflect.deleteProperty(document.documentElement, 'scrollHeight')
  })

  it('counts a page that does not scroll as read to the end', async () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 500 })
    vi.stubGlobal('innerHeight', 1000)
    const { startAnalytics } = await load()
    startAnalytics()
    window.dispatchEvent(new Event('pagehide'))
    expect(ofType('engagement')[0].scrollPct).toBe(100)
    Reflect.deleteProperty(document.documentElement, 'scrollHeight')
  })

  it('starts a new pageview on back and forward, closing the previous one', async () => {
    const { startAnalytics } = await load()
    startAnalytics()
    const first = ofType('pageview')[0].pageviewId
    window.history.replaceState(null, '', '/about')
    window.dispatchEvent(new PopStateEvent('popstate'))
    const views = ofType('pageview')
    expect(views).toHaveLength(2)
    expect(views[1]).toMatchObject({ path: '/about' })
    expect(views[1].pageviewId).not.toBe(first)
    expect(ofType('engagement')[0].pageviewId).toBe(first)
  })

  it('records clicks on links and buttons, but not on plain text', async () => {
    document.body.innerHTML = '<section><h2>Contact</h2><a href="/steven-wilssens-resume-2026.pdf" download>Resume</a><p>Text</p></section>'
    const { startAnalytics } = await load()
    startAnalytics()
    document.querySelector('a')!.addEventListener('click', (event) => event.preventDefault())
    document.querySelector('a')!.click()
    document.querySelector('p')!.click()
    document.dispatchEvent(new Event('click'))
    expect(ofType('click')).toEqual([expect.objectContaining({ category: 'download', label: 'Resume', context: 'Contact', path: '/experience' })])
  })

  it('reports Core Web Vitals with the element responsible', async () => {
    const { startAnalytics } = await load()
    startAnalytics()
    expect(vitals.handlers).toHaveLength(5)
    vitals.handlers[0]({ name: 'LCP', value: 1234, rating: 'good', attribution: { target: 'img.hero' } })
    expect(ofType('vital')[0]).toMatchObject({ metric: 'LCP', value: 1234, rating: 'good', target: 'img.hero', path: '/experience' })
  })

  it('does nothing in development, with Do Not Track or Global Privacy Control, or on Steven\'s own browsers', async () => {
    vi.stubEnv('PROD', false)
    ;(await load()).startAnalytics()
    vi.stubEnv('PROD', true)
    setNavigator('doNotTrack', '1')
    ;(await load()).startAnalytics()
    Reflect.deleteProperty(navigator, 'doNotTrack')
    setNavigator('globalPrivacyControl', true)
    ;(await load()).startAnalytics()
    Reflect.deleteProperty(navigator, 'globalPrivacyControl')
    const { ignoreKey } = await load()
    localStorage.setItem(ignoreKey, '1')
    ;(await load()).startAnalytics()
    expect(beacon).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still records a visit when storage cannot be read', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    ;(await load()).startAnalytics()
    expect(ofType('pageview')).toHaveLength(1)
    getItem.mockRestore()
  })
})

describe('analytics helpers', () => {
  it('names the element behind each Core Web Vital', async () => {
    const { vitalTarget } = await load()
    const metric = (value: unknown) => value as MetricWithAttribution
    expect(vitalTarget(metric({ name: 'LCP', attribution: { target: 'img' } }))).toBe('img')
    expect(vitalTarget(metric({ name: 'INP', attribution: { interactionType: 'pointer', interactionTarget: 'button.send' } }))).toBe('pointer: button.send')
    expect(vitalTarget(metric({ name: 'INP', attribution: { interactionType: 'keyboard', interactionTarget: '' } }))).toBe('')
    expect(vitalTarget(metric({ name: 'CLS', attribution: { largestShiftTarget: 'main' } }))).toBe('main')
    expect(vitalTarget(metric({ name: 'TTFB', attribution: {} }))).toBeUndefined()
  })

  it('leaves an address without tracking tags alone', async () => {
    const { removeTrackingParams } = await load()
    window.history.replaceState({ kept: true }, '', '/work?keep=1')
    const replace = vi.spyOn(window.history, 'replaceState')
    removeTrackingParams()
    expect(replace).not.toHaveBeenCalled()
    replace.mockRestore()
  })

  it('treats an address it cannot parse as internal, and a phone number as contact', async () => {
    const { classifyLink, describeClick } = await load()
    expect(classifyLink('http://[bad', false, 'steven.wilssens.com')).toBe('internal')
    expect(classifyLink('tel:+1206', false)).toBe('email')
    expect(classifyLink('/resume.pdf?v=2', false)).toBe('download')
    document.body.innerHTML = '<footer><a aria-label="LinkedIn profile">in</a></footer><div><button>  Send   now </button></div>'
    expect(describeClick(document.querySelector('a')!)).toEqual({ category: 'internal', label: 'LinkedIn profile', target: '', context: 'Footer' })
    expect(describeClick(document.querySelector('button')!)).toEqual({ category: 'button', label: 'Send now', target: null, context: '' })
  })
})
