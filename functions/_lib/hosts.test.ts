import { describe, expect, it } from 'vitest'
import { redirectHost, redirectTarget } from './hosts'

describe('host redirects', () => {
  it('sends the production pages.dev address to the custom domain', () => {
    expect(redirectHost('stevenwilssens.pages.dev')).toBe('steven.wilssens.com')
    expect(redirectTarget(new URL('http://stevenwilssens.pages.dev/experience?x=1'))).toBe('https://steven.wilssens.com/experience?x=1')
  })

  it('leaves the custom domain, preview deployments and local dev alone', () => {
    expect(redirectHost('steven.wilssens.com')).toBeNull()
    expect(redirectHost('abc123.stevenwilssens.pages.dev')).toBeNull()
    expect(redirectHost('localhost')).toBeNull()
    expect(redirectTarget(new URL('http://localhost:8788/about'))).toBeNull()
  })

  it('mirrors every wilssens.net name onto wilssens.com', () => {
    expect(redirectTarget(new URL('https://steven.wilssens.net/experience'))).toBe('https://steven.wilssens.com/experience')
    expect(redirectTarget(new URL('http://steven.wilssens.net/'))).toBe('https://steven.wilssens.com/')
    expect(redirectTarget(new URL('https://kijkvoetbal.wilssens.net/schema?week=3'))).toBe('https://kijkvoetbal.wilssens.com/schema?week=3')
  })

  it('sends the bare .net domain to the family platform', () => {
    expect(redirectTarget(new URL('https://wilssens.net/'))).toBe('https://www.wilssens.com/')
    expect(redirectTarget(new URL('https://www.wilssens.net/account'))).toBe('https://www.wilssens.com/account')
  })

  it('sends old blog addresses to the home page', () => {
    expect(redirectTarget(new URL('http://steven.wilssens.net/ADayOfFirsts.aspx'))).toBe('https://steven.wilssens.com/')
    expect(redirectTarget(new URL('http://steven.wilssens.net/CategoryView.aspx?category=Team%20System'))).toBe('https://steven.wilssens.com/')
    expect(redirectTarget(new URL('http://steven.wilssens.net/aggbug.ashx?id=1'))).toBe('https://steven.wilssens.com/')
    expect(redirectTarget(new URL('https://www.wilssens.net/x.aspx'))).toBe('https://www.wilssens.com/x.aspx')
  })
})
