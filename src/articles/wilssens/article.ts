// The article's motion and small tools, added after hydration. Without JavaScript
// (or with reduced motion) the page is complete and still: nothing starts hidden
// until this runs and sets data-wx-motion on the article.

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// The day a feed's numbers were read, as a date (in UTC, the same on the server and in every browser).
export const feedDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

// Counts a headline number from one value to another over about a second.
const countTo = (element: HTMLElement, target: number, from: number) => {
  const decimals = Number(element.dataset.decimals ?? 0)
  const start = performance.now(), duration = 1100
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    element.textContent = (from + (target - from) * (1 - Math.pow(1 - t, 3))).toFixed(decimals)
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function enhanceArticle(root: HTMLElement): () => void {
  const cleanups: (() => void)[] = []
  const motion = !reducedMotion() && 'IntersectionObserver' in window

  // Reading time from the words on the page (about 230 a minute).
  const words = root.querySelector('.wx-body')?.textContent?.trim().split(/\s+/).length ?? 0
  const readTime = root.querySelector('[data-read-time]')
  if (readTime && words) readTime.textContent = `${Math.max(1, Math.round(words / 230))} min read`

  // Reading progress: a bar across the top that fills as the article is read.
  const bar = root.querySelector<HTMLElement>('.wx-progress span')
  let frame = 0
  const onScroll = () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      const rect = root.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      const done = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1
      if (bar) bar.style.transform = `scaleX(${done})`
    })
  }
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  cleanups.push(() => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame) })

  // Table of contents: marks the section being read.
  const links = new Map([...root.querySelectorAll<HTMLAnchorElement>('[data-toc]')].map((link) => [link.dataset.toc!, link]))
  if ('IntersectionObserver' in window) {
    const visible = new Set<string>()
    const order = [...links.keys()]
    // Watch whole sections (the heading's parent), so a long section stays current while it is read.
    const sectionIds = new Map<Element, string>()
    order.forEach((id) => { const section = root.querySelector(`#${CSS.escape(id)}`)?.closest('section'); if (section) sectionIds.set(section, id) })
    const sectionSpy = new IntersectionObserver((entries) => {
      for (const entry of entries) { const id = sectionIds.get(entry.target)!; if (entry.isIntersecting) visible.add(id); else visible.delete(id) }
      const current = order.find((id) => visible.has(id))
      if (!current) return
      links.forEach((link, id) => { if (id === current) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current') })
    }, { rootMargin: '-20% 0px -60% 0px' })
    sectionIds.forEach((_, section) => sectionSpy.observe(section))
    cleanups.push(() => sectionSpy.disconnect())
  }
  // On narrow screens the contents start folded; choosing a section folds them again.
  const details = root.querySelector<HTMLDetailsElement>('.wx-toc details')
  const narrow = window.matchMedia?.('(max-width: 1099px)')
  if (details && narrow?.matches) details.open = false
  const onTocClick = (event: Event) => { if ((event.target as HTMLElement).closest('a') && narrow?.matches && details) details.open = false }
  details?.addEventListener('click', onTocClick)
  cleanups.push(() => details?.removeEventListener('click', onTocClick))

  if (motion) {
    root.dataset.wxMotion = 'on'
    // Figures, cards and list items rise in as they arrive; a diagram's parts follow one by one.
    root.querySelectorAll('.wx-diagram svg').forEach((svg) => svg.querySelectorAll<SVGElement>('[data-part]').forEach((part, index) => part.style.setProperty('--i', String(index))))
    const reveal = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry) => { (entry.target as HTMLElement).dataset.shown = ''; reveal.unobserve(entry.target) })
    }, { rootMargin: '0px 0px -10% 0px' })
    root.querySelectorAll('.wx-figure, .wx-card, .wx-practices li, .wx-h2, .wx-callout').forEach((element) => reveal.observe(element))
    cleanups.push(() => reveal.disconnect())

    // The headline numbers count up once, when they come into view.
    const counters = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
        const element = entry.target as HTMLElement
        counters.unobserve(element)
        element.dataset.counted = ''
        countTo(element, Number(element.dataset.count), 0)
      })
    })
    root.querySelectorAll('[data-count]').forEach((element) => counters.observe(element))
    cleanups.push(() => counters.disconnect())
  }

  // The headline numbers are the project's as of the last refresh (feed.json, written into the
  // page); the live ones come from the project's own database through /api/building/<project>.
  // A figure already on screen counts on to today's value; one not yet shown starts from it.
  const stats = root.querySelector<HTMLElement>('[data-feed]')
  if (stats?.dataset.feed && typeof fetch === 'function') {
    const controller = new AbortController()
    cleanups.push(() => controller.abort())
    fetch(stats.dataset.feed, { headers: { Accept: 'application/json' }, signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((feed: { asOf?: string; numbers?: Record<string, unknown> } | null) => {
      if (!feed?.numbers) return
      stats.querySelectorAll<HTMLElement>('[data-stat]').forEach((element) => {
        const value = feed.numbers![element.dataset.stat!]
        if (typeof value !== 'number' || !Number.isFinite(value) || value === Number(element.dataset.count)) return
        const shown = Number(element.dataset.count)
        element.dataset.count = String(value)
        if (!motion) element.textContent = value.toFixed(Number(element.dataset.decimals ?? 0))
        else if ('counted' in element.dataset) countTo(element, value, shown)
      })
      // The sentence's full stop sits inside the span, so the Markdown copy reads as one sentence.
      const date = root.querySelector('[data-feed-date]')
      if (date && feed.asOf && !Number.isNaN(Date.parse(feed.asOf))) date.textContent = `${feedDate(feed.asOf)}.`
    }).catch(() => undefined)
  }

  // Screenshots open full size in a dialog.
  const dialog = root.querySelector<HTMLDialogElement>('.wx-lightbox')
  const big = dialog?.querySelector('img')
  const onZoom = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-zoom]')
    if (!button || !dialog || !big || typeof dialog.showModal !== 'function') return
    big.src = button.dataset.zoom!
    big.alt = button.dataset.zoomAlt ?? ''
    dialog.showModal()
  }
  const onBackdrop = (event: MouseEvent) => { if (event.target === dialog) dialog?.close() }
  root.addEventListener('click', onZoom)
  dialog?.addEventListener('click', onBackdrop)
  cleanups.push(() => { root.removeEventListener('click', onZoom); dialog?.removeEventListener('click', onBackdrop) })

  // Copy link, with a short "Copied" in place of the label.
  const onCopy = async (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]')
    if (!button) return
    try { await navigator.clipboard.writeText(button.dataset.copy!); const label = button.textContent; button.textContent = 'Copied ✓'; setTimeout(() => { button.textContent = label }, 1800) } catch { /* clipboard unavailable */ }
  }
  root.addEventListener('click', onCopy)
  cleanups.push(() => root.removeEventListener('click', onCopy))

  return () => { cleanups.forEach((cleanup) => cleanup()); delete root.dataset.wxMotion }
}
