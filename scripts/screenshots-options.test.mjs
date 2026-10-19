// The screenshot script's options (scripts/screenshots-options.mjs): which pages it takes,
// and that the local admin token never goes to another host.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { measureScroller, normalizePaths, OptionError, parseDevVars, resolveOptions, scrollScrollerTo, sliceTops, STICKY, viewportsFor } from './screenshots-options.mjs'

const preview = 'https://review-team.stevenwilssens.pages.dev'

describe('the pages', () => {
  it('takes home by default, maps home to / and adds the missing slash', () => {
    expect(normalizePaths([])).toEqual(['/'])
    expect(normalizePaths(['home', 'experience', '/work', 'admin#resume'])).toEqual(['/', '/experience', '/work', '/admin#resume'])
  })
})

describe('the server', () => {
  it('serves locally on --port without --base', () => {
    expect(resolveOptions({ port: '8798' })).toMatchObject({ base: 'http://127.0.0.1:8798', local: true, paths: ['/'], token: '' })
  })

  it('takes a preview address as remote, without a trailing slash', () => {
    expect(resolveOptions({ base: `${preview}/` })).toMatchObject({ base: preview, local: false })
  })

  it('treats localhost and [::1] as local', () => {
    expect(resolveOptions({ base: 'http://localhost:8788' }).local).toBe(true)
    expect(resolveOptions({ base: 'http://[::1]:8788' }).local).toBe(true)
  })

  it('refuses a port or an address it cannot use', () => {
    expect(() => resolveOptions({ port: 'abc' })).toThrow(OptionError)
    expect(() => resolveOptions({ port: '70000' })).toThrow('--port 70000 is not a port number')
    expect(() => resolveOptions({ base: 'not a url' })).toThrow('--base not a url is not an address')
  })
})

describe('the admin token', () => {
  const env = { ADMIN_TOKEN: 'local-secret' }

  it('uses ADMIN_TOKEN, then .dev.vars, for a local server', () => {
    expect(resolveOptions({ positionals: ['admin'], env }).token).toBe('local-secret')
    expect(resolveOptions({ positionals: ['admin'], devVars: { ADMIN_TOKEN: 'from-dev-vars' } }).token).toBe('from-dev-vars')
  })

  it('prefers --token', () => {
    expect(resolveOptions({ positionals: ['admin'], token: 'given', env }).token).toBe('given')
  })

  it('never sends the local token to a preview', () => {
    expect(resolveOptions({ base: preview, env, devVars: env }).token).toBe('')
    expect(resolveOptions({ base: preview, token: 'given', positionals: ['admin'] }).token).toBe('given')
  })

  it('refuses admin pages on a preview without --token, even with a local token', () => {
    expect(() => resolveOptions({ base: preview, positionals: ['admin#resume'], env })).toThrow(`Admin pages on ${preview} need --token`)
  })

  it('refuses admin pages locally without any token', () => {
    expect(() => resolveOptions({ positionals: ['/admin'] })).toThrow('Admin pages need a token')
  })
})

describe('.dev.vars', () => {
  it('reads KEY=value lines and skips comments, blanks and lines without =', () => {
    expect(parseDevVars('# comment\n\nADMIN_TOKEN=a=b\r\nOTHER = x\nnonsense\n')).toEqual({ ADMIN_TOKEN: 'a=b', 'OTHER ': ' x' })
  })
})

describe('the widths', () => {
  it('takes desktop and phone by default, the phone at 2x with slices, and any other width by its number', () => {
    expect(viewportsFor()).toEqual([{ name: 'desktop', width: 1440, height: 900, scale: 1 }, { name: 'phone', width: 390, height: 844, scale: 1 }])
    expect(viewportsFor('1440, 1280,390', true)).toEqual([
      { name: 'desktop', width: 1440, height: 900, scale: 1 },
      { name: 'w1280', width: 1280, height: 800, scale: 1 },
      { name: 'phone', width: 390, height: 844, scale: 2 },
    ])
    expect(viewportsFor('320')).toEqual([{ name: 'w320', width: 320, height: 844, scale: 1 }])
  })

  it('refuses a width that is not a number of pixels a screen has', () => {
    for (const widths of ['wide', '1280px', '100', '5000', '1440,-1']) expect(() => viewportsFor(widths), widths).toThrow(OptionError)
  })
})

// The admin's pane scrolls, the window does not: the shots follow whatever scrolls.
describe('what the screenshots scroll', () => {
  const sized = (element, scrollHeight, clientHeight) => {
    Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight })
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight })
    return element
  }
  afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); delete document.documentElement.scrollHeight; delete document.documentElement.clientHeight })

  it('measures and scrolls the admin pane when it scrolls', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(callback, 0))
    const pane = sized(Object.assign(document.createElement('main'), { className: 'main' }), 4000, 860)
    document.body.append(pane)
    sized(document.documentElement, 900, 900)
    expect(measureScroller()).toEqual({ pane: true, scrollHeight: 4000, clientHeight: 860 })
    expect(await scrollScrollerTo(800)).toBe(800)
    expect(pane.scrollTop).toBe(800)
    expect(document.documentElement.scrollTop).toBe(0)
  })

  it('measures and scrolls the document on a page without a pane, or with one that does not scroll', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(callback, 0))
    sized(document.documentElement, 3000, 900)
    expect(measureScroller()).toEqual({ pane: false, scrollHeight: 3000, clientHeight: 900 })
    const pane = sized(Object.assign(document.createElement('main'), { className: 'main' }), 500, 860)
    document.body.append(pane)
    expect(measureScroller()).toEqual({ pane: false, scrollHeight: 3000, clientHeight: 900 })
    await scrollScrollerTo(900)
    expect(document.documentElement.scrollTop).toBe(900)
    expect(pane.scrollTop).toBe(0)
  })

  it('slices the pane a screen less the sticky bar at a time, the window a screen at a time, ending at the bottom', () => {
    expect(STICKY).toBe(60)
    expect(sliceTops({ pane: true, scrollHeight: 2000, clientHeight: 860 })).toEqual([0, 800, 1140])
    expect(sliceTops({ pane: false, scrollHeight: 2000, clientHeight: 900 })).toEqual([0, 900, 1100])
    expect(sliceTops({ pane: false, scrollHeight: 600, clientHeight: 900 })).toEqual([0])
    expect(sliceTops({ pane: true, scrollHeight: 1000, clientHeight: 40 })).toEqual(Array.from({ length: 960 }, (_, top) => top).concat(960))
  })
})
