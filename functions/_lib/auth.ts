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

