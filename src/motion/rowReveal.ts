const rowSelector = '.timeline-item, .recommendation, .archive-list article, .project-card, .capability-grid article'
const staggerMs = 90
const maxStaggerMs = 450

// Rows arrive like a signal sweeping across the page: a playhead draws the row's
// rule and uncovers its content as it scrolls into view. Rows only start hidden
// once this runs, so the page is complete without JavaScript or with reduced motion.
export function revealRows(root: ParentNode = document): () => void {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion || !('IntersectionObserver' in window)) return () => {}
  document.documentElement.dataset.rowReveal = 'on'
  const observer = new IntersectionObserver((entries) => {
    const arriving = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target as HTMLElement)
    arriving.forEach((row, index) => {
      row.style.setProperty('--reveal-delay', `${Math.min(index * staggerMs, maxStaggerMs)}ms`)
      row.dataset.shown = ''
      observer.unobserve(row)
    })
  }, { rootMargin: '0px 0px -8% 0px' })
  root.querySelectorAll<HTMLElement>(rowSelector).forEach((row) => { if (!('shown' in row.dataset)) observer.observe(row) })
  return () => observer.disconnect()
}
