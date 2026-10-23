import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderMarkdown, safeHref } from './markdown'

describe('safeHref', () => {
  it('keeps the site, its paths and the allowed hosts', () => {
    expect(safeHref('/experience')).toBe('/experience')
    expect(safeHref('https://steven.wilssens.com/patents')).toBe('https://steven.wilssens.com/patents')
    expect(safeHref('https://www.linkedin.com/in/x')).toBe('https://www.linkedin.com/in/x')
    expect(safeHref('mailto:steven@wilssens.com')).toBe('mailto:steven@wilssens.com')
  })

  it('refuses every scheme-relative form a browser would send to another host', () => {
    for (const href of ['/\\evil.example', '/\\\\evil.example', '\\/evil.example', '//evil.example', '/\\evil.example/x', '/\t/evil.example', '/\n/evil.example', 'https://steven.wilssens.com\\@evil.example']) {
      expect(safeHref(href), href).toBeNull()
    }
  })

  it('refuses other schemes and hosts', () => {
    expect(safeHref('https://evil.example')).toBeNull()
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('http://steven.wilssens.com/')).toBeNull()
  })

  it('renders a backslash link as its label, not a link', () => {
    const html = renderToStaticMarkup(renderMarkdown('[x](/\\evil.example) and [y](//evil.example)'))
    expect(html).not.toContain('<a')
    expect(html).toContain('x and y')
  })
})
