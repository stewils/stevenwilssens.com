// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { bearerToken, isAdmin, sameSecret } from './auth'
import type { Env } from './env'

const request = (authorization?: string) => new Request('https://steven.wilssens.com/api/admin', authorization ? { headers: { Authorization: authorization } } : {})
const env = (token?: string) => ({ ADMIN_TOKEN: token }) as Env

describe('secrets', () => {
  it('compares equal and unequal secrets, including different lengths', () => {
    expect(sameSecret('abc', 'abc')).toBe(true)
    expect(sameSecret('abc', 'abd')).toBe(false)
    expect(sameSecret('abc', 'abcd')).toBe(false)
    expect(sameSecret('', '')).toBe(true)
  })

  it('reads the bearer token whatever the case of the scheme, or nothing', () => {
    expect(bearerToken(request('Bearer s3cret'))).toBe('s3cret')
    expect(bearerToken(request('bearer   s3cret'))).toBe('s3cret')
    expect(bearerToken(request())).toBe('')
  })
})

describe('the admin', () => {
  it('lets in only the request carrying the admin token', () => {
    expect(isAdmin(request('Bearer s3cret'), env('s3cret'))).toBe(true)
    expect(isAdmin(request('Bearer wrong!'), env('s3cret'))).toBe(false)
    expect(isAdmin(request(), env('s3cret'))).toBe(false)
  })

  it('refuses everyone when no admin token is configured, even an empty bearer', () => {
    expect(isAdmin(request(), env())).toBe(false)
    expect(isAdmin(request(), env(''))).toBe(false)
    expect(isAdmin(request('Bearer '), env(''))).toBe(false)
  })
})
