// @vitest-environment node
// The resume template (scripts/resume.mjs): the honors line in the footer, in every layout the
// build may fall back to, not only the one the committed PDF uses. Importing the module launches
// no browser: Chromium starts only inside buildResume, which no test calls.
import { describe, expect, it } from 'vitest'
import { honorLine, layouts, resumeHtml } from './resume.mjs'

describe('the honors line of the resume', () => {
  it('renders the honors line without empty parentheses in every layout', () => {
    expect(layouts).toHaveLength(5)
    for (const layout of layouts) {
      const line = resumeHtml(layout).match(/<p class="honors">(.*?)<\/p>/)[1]
      expect(line).toContain('Selected for Microsoft’s High Potential (HiPo) program · ')
      expect(line).not.toContain('<small>()</small>')
      expect(line).not.toContain('(Issued by Microsoft)')
      expect(line).toContain('Lighthouse Award for Teamwork <small>(2012)</small>')
      expect(line).toContain('Microsoft MVP: VS Team System <small>(2006)</small>')
    }
  })

  it('formats one honor: the year when dated, nothing when not, and both fields escaped', () => {
    expect(honorLine(['Microsoft Lighthouse Award for Teamwork', 'Issued by Microsoft · Jan 2012'])).toBe('Lighthouse Award for Teamwork <small>(2012)</small>')
    expect(honorLine(['Microsoft Gold Star Award', 'Issued by Microsoft · Jan 2011'])).toBe('Gold Star Award <small>(2011)</small>')
    expect(honorLine(['Most Valuable Professional (MVP): VS Team System', 'Issued by Microsoft · Jan 2006'])).toBe('Microsoft MVP: VS Team System <small>(2006)</small>')
    // Undated: no parentheses at all, and "Microsoft’s" stays because only a leading "Microsoft " is stripped.
    expect(honorLine(['Selected for Microsoft’s High Potential (HiPo) program', 'Issued by Microsoft'])).toBe('Selected for Microsoft’s High Potential (HiPo) program')
    expect(honorLine(['Some Award', ''])).toBe('Some Award')
    expect(honorLine(['Some Award', 'Issued by Microsoft · 2019'])).toBe('Some Award <small>(2019)</small>')
    // Another issuer still prints in full, as before.
    expect(honorLine(['Other Award', 'Issued by ACM · May 2020'])).toBe('Other Award <small>(Issued by ACM · May 2020)</small>')
    expect(honorLine(['<b>Award</b>', 'Issued by <i>'])).toBe('&lt;b&gt;Award&lt;/b&gt; <small>(Issued by &lt;i&gt;)</small>')
  })
})

describe('the layouts of the resume', () => {
  // The build keeps the first layout that fits two pages: tight margins are tried before the older roles lose their first bullet.
  it('tries tight margins before dropping the older roles’ bullets, and only there', () => {
    const tight = layouts.findIndex((layout) => layout.tight)
    const noBullets = layouts.findIndex((layout) => layout.olderBullets === 0)
    expect(layouts[tight]).toEqual({ olderBullets: 1, compact: true, tight: true })
    expect(tight).toBe(noBullets - 1)
    expect(noBullets).toBe(layouts.length - 1)
    expect(layouts.filter((layout) => layout.tight)).toHaveLength(1)
  })

  it('sets the tight margins only in the tight layout', () => {
    const margin = (layout) => resumeHtml(layout).match(/@page \{ size: Letter; margin: ([^;]+); \}/)[1]
    for (const layout of layouts) expect(margin(layout)).toBe(layout.tight ? '0.4in 0.5in 0.36in' : '0.45in 0.55in 0.42in')
    expect(margin()).toBe('0.45in 0.55in 0.42in')
  })
})
