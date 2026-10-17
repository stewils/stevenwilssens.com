import type { Env } from './env'

// Compares two secrets without leaking where they differ through timing.
export const sameSecret = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const bearerToken = (request: Request) => request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''

// True when the request carries the admin token (the /admin password).
export const isAdmin = (request: Request, env: Env) => Boolean(env.ADMIN_TOKEN) && sameSecret(bearerToken(request), env.ADMIN_TOKEN!)

// The analytics visitor id: a hash of IP + user agent + secret salt + the date,
// so nobody can be followed across days and no IP is stored.
export const visitorHash = async (request: Request, env: Env, now: number) => {
  const day = new Date(now).toISOString().slice(0, 10)
  const ip = request.headers.get('CF-Connecting-IP') ?? ''
  const userAgent = request.headers.get('User-Agent') ?? ''
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.HASH_SALT ?? ''}|${day}|${ip}|${userAgent}`))
  return [...new Uint8Array(digest).slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
