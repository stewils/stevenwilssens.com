import { useEffect, useRef, useState, type RefObject } from 'react'

// The section bar: the parts of the page shown (elements with data-part="Label") as a
// sticky row of chips at the top of the pane. Clicking one scrolls there; the chip of
// the part being read lights up. Shown once a page has two or more parts. The parts
// are read from the DOM after each render, so they follow whatever the page shows.
type Part = { label: string; el: HTMLElement }

export function SubNav({ scroller, page, version }: { scroller: RefObject<HTMLElement | null>; page: string; version: string }) {
  const [parts, setParts] = useState<Part[]>([])
  const [current, setCurrent] = useState(0)
  const [stuck, setStuck] = useState(false)
  const nav = useRef<HTMLElement>(null)

  // The parts are read from the DOM after each render that could have changed them.
  const collect = () => {
    const root = scroller.current
    if (!root) return
    const found = [...root.querySelectorAll<HTMLElement>('.page [data-part]')].filter((el) => el.getClientRects().length > 0).map((el) => ({ label: el.dataset.part ?? '', el }))
    setParts((previous) => (previous.length === found.length && previous.every((part, index) => part.el === found[index].el) ? previous : found))
  }
  useEffect(collect, [page, version])

  useEffect(() => {
    const root = scroller.current
    if (!root) return
    let frame = 0
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const spy = () => {
      frame = 0
      const top = root.getBoundingClientRect().top
      const line = top + (nav.current?.offsetHeight ?? 0) + 32
      let index = 0
      parts.forEach((part, i) => { if (part.el.getBoundingClientRect().top <= line) index = i })
      // At the very bottom, the last part counts even when it is short.
      if (root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 4) index = parts.length - 1
      setCurrent(index)
      setStuck(root.scrollTop > 0 && Boolean(nav.current) && nav.current!.getBoundingClientRect().top <= top + 1)
      // Keep the lit chip in view in a bar that scrolls sideways (phones).
      const chip = nav.current?.children[index] as HTMLElement | undefined
      if (chip && nav.current && nav.current.scrollWidth > nav.current.clientWidth) nav.current.scrollTo({ left: chip.offsetLeft - nav.current.clientWidth / 2 + chip.offsetWidth / 2, behavior: reduced ? 'auto' : 'smooth' })
    }
    const schedule = () => { frame ||= requestAnimationFrame(spy) }
    root.addEventListener('scroll', schedule, { passive: true })
    addEventListener('resize', schedule)
    spy()
    return () => { root.removeEventListener('scroll', schedule); removeEventListener('resize', schedule); if (frame) cancelAnimationFrame(frame) }
  }, [scroller, parts])

  if (parts.length < 2) return null
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <nav ref={nav} className={`subnav ${stuck ? 'stuck' : ''}`} aria-label="On this page">
      {parts.map((part, index) => (
        <button type="button" key={`${part.label}-${index}`} aria-current={index === current ? 'true' : undefined} onClick={() => part.el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })}>{part.label}</button>
      ))}
    </nav>
  )
}
