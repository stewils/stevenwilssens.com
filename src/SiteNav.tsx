import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { Page } from './pageMeta'

type Props = { items: [Page, string][]; page: Page }

// Current page first, then the rest in menu order.
const priorityOrder = (length: number, activeIndex: number) => Array.from({ length }, (_, index) => index).sort((a, b) => Number(b === activeIndex) - Number(a === activeIndex))

const chevron = <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>

// Priority+ navigation: shows as many links as fit, always including the current
// page, and moves the rest into a "More" disclosure. When fewer than two links fit
// (phones), everything collapses into a single "Menu" button.
export default function SiteNav({ items, page }: Props) {
  const navRef = useRef<HTMLElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const [visibleCount, setVisibleCount] = useState(items.length)
  const [open, setOpen] = useState(false)

  const activeIndex = items.findIndex(([href]) => href === page)
  const priority = priorityOrder(items.length, activeIndex)
  const shown = new Set(priority.slice(0, visibleCount))
  const overflow = items.filter((_, index) => !shown.has(index))
  const menuOnly = shown.size === 0

  useLayoutEffect(() => {
    const nav = navRef.current
    const measure = measureRef.current
    if (!nav || !measure || !('ResizeObserver' in window)) return
    const priority = priorityOrder(items.length, activeIndex)
    const fit = () => {
      const spans = [...measure.children] as HTMLElement[]
      const widths = spans.slice(0, items.length).map((span) => span.offsetWidth)
      const moreWidth = spans[items.length].offsetWidth
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 0
      const available = nav.clientWidth
      const widthOf = (count: number) => priority.slice(0, count).reduce((sum, index) => sum + widths[index] + gap, 0)
      if (widthOf(items.length) - gap <= available) return setVisibleCount(items.length)
      let count = items.length - 1
      while (count > 0 && widthOf(count) + moreWidth > available) count--
      setVisibleCount(count < 2 ? 0 : count)
      setOpen(false)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(nav)
    document.fonts?.ready.then(fit)
    return () => observer.disconnect()
  }, [items.length, activeIndex])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (!wrapRef.current?.contains(event.target as Node)) setOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus() } }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const link = ([href, label]: [Page, string]) => <a className={page === href ? 'active' : ''} aria-current={page === href ? 'page' : undefined} href={`/${href}`} key={href}>{label}</a>

  return (
    <nav ref={navRef} className={menuOnly ? 'menu-only' : ''} aria-label="Main">
      {items.map((item, index) => shown.has(index) && link(item))}
      {overflow.length > 0 && (
        <div className="nav-more" ref={wrapRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
          <button ref={buttonRef} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>{menuOnly ? 'Menu' : 'More'}{chevron}</button>
          <div className="nav-panel" id={panelId} hidden={!open}>{overflow.map(link)}</div>
        </div>
      )}
      <div className="nav-measure" ref={measureRef} aria-hidden="true">
        {items.map(([href, label]) => <span key={href}>{label}</span>)}
        <span>More{chevron}</span>
      </div>
    </nav>
  )
}
