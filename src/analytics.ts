import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'

// First-party, cookie-free analytics. Events go to /api/collect (a Pages Function
// that writes to D1). Nothing is stored on the visitor's device except the
// opt-out flag the admin dashboard sets for Steven's own browsers.

export const ignoreKey = 'sw-analytics-ignore'
const endpoint = '/api/collect'

type EventPayload = Record<string, unknown> & { type: 'pageview' | 'engagement' | 'click' | 'vital' }

const optedOut = () => (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || navigator.doNotTrack === '1'

const isIgnored = () => {
  if (optedOut()) return true
  try { return localStorage.getItem(ignoreKey) === '1' } catch { return false }
}

const send = (payload: EventPayload) => {
  const body = JSON.stringify(payload)
  if (navigator.sendBeacon?.(endpoint, body)) return
  void fetch(endpoint, { method: 'POST', body, keepalive: true }).catch(() => undefined)
}

export const classifyLink = (href: string, hasDownload: boolean, currentHost = window.location.host) => {
  if (hasDownload || /\.pdf($|\?)/i.test(href)) return 'download'
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return 'email'
  try { return new URL(href, window.location.href).host === currentHost ? 'internal' : 'outbound' } catch { return 'internal' }
}

const cleanText = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)

export const describeClick = (element: Element) => {
  const anchor = element.closest('a')
  const control = anchor ?? element.closest('button')
  if (!control) return null
  const section = control.closest('article, section, header, footer')
  const heading = section?.querySelector('h1, h2, h3')
  const context = control.closest('header') ? 'Header' : control.closest('footer') ? 'Footer' : cleanText(heading?.textContent)
  const label = cleanText(control.getAttribute('aria-label') || control.textContent)
  if (anchor) {
    const href = anchor.getAttribute('href') ?? ''
    return { category: classifyLink(href, anchor.hasAttribute('download')), label, target: href, context }
  }
  return { category: 'button', label, target: null, context }
}

// Once a visit is recorded, drop ?ref= and utm_ tags from the address bar so
// links people copy and share do not carry the original source.
export const removeTrackingParams = () => {
  const url = new URL(window.location.href)
  const tracking = [...url.searchParams.keys()].filter((key) => key === 'ref' || key.startsWith('utm_'))
  if (tracking.length === 0) return
  for (const key of tracking) url.searchParams.delete(key)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

let started = false

export const startAnalytics = () => {
  if (started || !import.meta.env.PROD || isIgnored()) return
  started = true

  let pageviewId = ''
  let visibleSince = 0
  let visibleMs = 0
  let maxScroll = 0

  const measureScroll = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight
    const pct = scrollable <= 0 ? 100 : Math.round((window.scrollY / scrollable) * 100)
    maxScroll = Math.max(maxScroll, Math.min(pct, 100))
  }

  const flushEngagement = () => {
    if (!pageviewId) return
    if (visibleSince) visibleMs += performance.now() - visibleSince
    visibleSince = document.visibilityState === 'visible' ? performance.now() : 0
    measureScroll()
    send({ type: 'engagement', pageviewId, path: window.location.pathname, durationMs: Math.round(visibleMs), scrollPct: maxScroll })
  }

  const trackPageview = () => {
    if (pageviewId) flushEngagement()
    pageviewId = crypto.randomUUID()
    visibleMs = 0
    maxScroll = 0
    visibleSince = document.visibilityState === 'visible' ? performance.now() : 0
    const params = new URLSearchParams(window.location.search)
    const utm = Object.fromEntries(['source', 'medium', 'campaign', 'term', 'content'].map((key) => [key, params.get(`utm_${key}`) ?? '']))
    if (!utm.source && params.get('ref')) utm.source = params.get('ref') ?? ''
    send({
      type: 'pageview',
      pageviewId,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      utm,
      language: navigator.language,
      screen: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    })
    requestAnimationFrame(measureScroll)
    removeTrackingParams()
  }

  window.addEventListener('scroll', measureScroll, { passive: true })
  window.addEventListener('popstate', trackPageview)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEngagement()
    else visibleSince = performance.now()
  })
  window.addEventListener('pagehide', flushEngagement)
  document.addEventListener('click', (event) => {
    const details = event.target instanceof Element ? describeClick(event.target) : null
    if (details) send({ type: 'click', pageviewId, path: window.location.pathname, ...details })
  }, { capture: true })

  trackPageview()

  // Core Web Vitals from real visits. Each metric reports once per page load.
  const reportVital = (metric: Metric) => send({ type: 'vital', pageviewId, path: window.location.pathname, metric: metric.name, value: metric.value, rating: metric.rating })
  onLCP(reportVital)
  onINP(reportVital)
  onCLS(reportVital)
  onFCP(reportVital)
  onTTFB(reportVital)
}
