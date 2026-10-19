const rowSelector = '.timeline-item, .recommendation, .archive-list article, .project-card, .capability-grid article, .work-list article'
const staggerMs = 90
const maxStaggerMs = 450
let firstLoad = true

// Rows arrive like a signal sweeping across the page: a playhead draws the row's
// rule and uncovers its content as it scrolls into view. Rows only start hidden
// once this runs, so the page is complete without JavaScript or with reduced motion.
// On the first load the rows already on screen were painted from the prerendered
// HTML and stay as they are ("still"): hiding them until the script arrives would
// delay the largest paint (LCP) on a slow connection.
export function revealRows(root: ParentNode = document): () => void {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion || !('IntersectionObserver' in window)) {
    delete document.documentElement.dataset.rowReveal
    return () => {}
  }
  const rows = [...root.querySelectorAll<HTMLElement>(rowSelector)]
  if (firstLoad) {
    firstLoad = false
    rows.forEach((row) => { if (row.getBoundingClientRect().top < window.innerHeight) row.dataset.shown = 'still' })
  }
  document.documentElement.dataset.rowReveal = 'on'
  const observer = new IntersectionObserver((entries) => {
    const arriving = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target as HTMLElement)
    arriving.forEach((row, index) => {
      row.style.setProperty('--reveal-delay', `${Math.min(index * staggerMs, maxStaggerMs)}ms`)
      row.dataset.shown = ''
      observer.unobserve(row)
    })
  }, { rootMargin: '0px 0px -8% 0px' })
  rows.forEach((row) => { if (!('shown' in row.dataset)) observer.observe(row) })
  return () => observer.disconnect()
}
