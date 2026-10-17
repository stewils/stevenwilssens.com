import { describe, expect, it } from 'vitest'
import { redirectTarget } from './hosts'

describe('host redirects', () => {
  it('sends the production pages.dev address to the custom domain', () => {
    expect(redirectTarget(new URL('http://stevenwilssens.pages.dev/experience?x=1'))).toBe('https://steven.wilssens.com/experience?x=1')
  })

  it('leaves the custom domain, preview deployments and local dev alone', () => {
    expect(redirectTarget(new URL('https://steven.wilssens.com/'))).toBeNull()
    expect(redirectTarget(new URL('https://abc123.stevenwilssens.pages.dev/about'))).toBeNull()
    expect(redirectTarget(new URL('http://localhost:8788/about'))).toBeNull()
  })

  it('sends every wilssens.net address to steven.wilssens.com, keeping the path', () => {
    expect(redirectTarget(new URL('https://steven.wilssens.net/experience'))).toBe('https://steven.wilssens.com/experience')
    expect(redirectTarget(new URL('http://steven.wilssens.net/'))).toBe('https://steven.wilssens.com/')
    expect(redirectTarget(new URL('https://wilssens.net/'))).toBe('https://steven.wilssens.com/')
    expect(redirectTarget(new URL('https://www.wilssens.net/about?utm_source=x'))).toBe('https://steven.wilssens.com/about?utm_source=x')
  })

  it('sends old blog addresses to the home page', () => {
    expect(redirectTarget(new URL('http://steven.wilssens.net/ADayOfFirsts.aspx'))).toBe('https://steven.wilssens.com/')
    expect(redirectTarget(new URL('http://steven.wilssens.net/CategoryView.aspx?category=Team%20System'))).toBe('https://steven.wilssens.com/')
    expect(redirectTarget(new URL('http://www.wilssens.net/aggbug.ashx?id=1'))).toBe('https://steven.wilssens.com/')
    expect(redirectTarget(new URL('https://steven.wilssens.com/x.aspx'))).toBeNull()
  })
})
