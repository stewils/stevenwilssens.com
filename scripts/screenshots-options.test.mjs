// The screenshot script's options (scripts/screenshots-options.mjs): which pages it takes,
// and that the local admin token never goes to another host.
import { describe, expect, it } from 'vitest'
import { normalizePaths, OptionError, parseDevVars, resolveOptions } from './screenshots-options.mjs'

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
