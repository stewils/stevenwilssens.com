// GET and POST /api/team: what Steven has seen on the admin's Team page (admin token).
// GET answers { read, unread } (update ids); POST { action: 'read' | 'unread' | 'readAll',
// ids } marks them and answers the same. Only the read ids travel here, never the team
// itself (that is in the admin bundle, from the build). The token only from the
// Authorization header; no CORS header, no cookie; every answer no-store; input that is not
// exactly the shape above is refused with a fixed body that echoes nothing.
import type { Env } from '../_lib/env'
import { isAdmin } from '../_lib/auth'
import { TeamReads, type TeamAction } from '../_lib/team-reads'

const MAX_BODY = 16 * 1024
const MAX_IDS = 200
const actions: TeamAction[] = ['read', 'unread', 'readAll']

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const unauthorized = () => json({ error: 'unauthorized' }, 401)
const badRequest = () => json({ error: 'bad request' }, 400)
const tooLarge = () => json({ error: 'too large' }, 413)
const unavailable = (error: unknown) => {
  console.error('team reads failed:', error instanceof Error ? error.message : 'unknown error')
  return json({ error: 'unavailable' }, 500)
}

// The body, but never more than MAX_BODY bytes of it: null when it is longer.
export const readCapped = async (request: Request) => {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY) { await reader.cancel(); return null }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(bytes)
}

// { action, ids } and nothing else; ids lower-case 40-hex, 1 to 200, de-duplicated.
export const parseTeamRequest = (text: string): { action: TeamAction; ids: string[] } | null => {
  let body: unknown
  try { body = JSON.parse(text) } catch { return null }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const keys = Object.keys(body)
  if (keys.length !== 2 || !keys.includes('action') || !keys.includes('ids')) return null
  const { action, ids } = body as { action: unknown; ids: unknown }
  if (typeof action !== 'string' || !actions.includes(action as TeamAction)) return null
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_IDS) return null
  if (!ids.every((id) => typeof id === 'string' && /^[0-9a-f]{40}$/.test(id))) return null
  return { action: action as TeamAction, ids: [...new Set(ids as string[])] }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return unauthorized()
  try {
    return json(await new TeamReads(env.DB).state())
  } catch (error) {
    return unavailable(error)
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return unauthorized()
  if ((request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'unsupported media type' }, 415)
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY) return tooLarge()
  const text = await readCapped(request)
  if (text === null) return tooLarge()
  const parsed = parseTeamRequest(text)
  if (!parsed) return badRequest()
  try {
    const reads = new TeamReads(env.DB)
    await reads.mark(parsed.action, parsed.ids)
    return json(await reads.state())
  } catch (error) {
    return unavailable(error)
  }
}
