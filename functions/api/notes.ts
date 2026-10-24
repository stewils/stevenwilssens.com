// GET /api/notes: Steven's public dossier notes, the entries he marked public so the site's
// assistant may use them (functions/_lib/ask/prompt.ts). The same notes the public MCP server
// serves, read-only and without a log row, so the Review workflow's assistant check reads what
// the live assistant reads without moving any number on the site. Private notes never leave.
//
// specs/mcp-prs-automation.md, AC-15 (C23): answered from the edge cache for 5 minutes (only a
// 200, keyed on the path without the query and varying on no header), so a hit reads nothing
// from D1; a miss is counted against the same per-client limit as the public MCP server (the
// hashed client, one hour) before the database is read.
import type { Env } from '../_lib/env'
import { ipHash } from '../_lib/ask/agent'
import { D1AskStore } from '../_lib/ask/store'
import { PUBLIC_CALLS_PER_HOUR } from '../_lib/mcp/server'
import { D1Store, type DossierStore } from '../_lib/mcp/store'

export type PublicNote = { id: number; role: string; topic: string; title: string; body: string }

export const publicNotes = async (store: DossierStore): Promise<PublicNote[]> =>
  (await store.list({ visibility: 'public' })).filter((entry) => entry.visibility === 'public').map(({ id, role, topic, title, body }) => ({ id, role, topic, title, body }))

const unavailable = () => new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const notesResponse = async (store: DossierStore) => {
  try {
    return new Response(JSON.stringify({ notes: await publicNotes(store) }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
  } catch (error) {
    console.error('notes', error)
    return unavailable()
  }
}

// The one cache entry: this path on this host, no query string, no request header in the key.
export const cacheKey = (url: string) => {
  const { origin, pathname } = new URL(url)
  return new Request(`${origin}${pathname}`, { method: 'GET' })
}

type NotesRequest = { request: Request; store: DossierStore; cache: Cache | null; limiter: () => Promise<boolean>; waitUntil: (promise: Promise<unknown>) => void }
export const handleNotes = async ({ request, store, cache, limiter, waitUntil }: NotesRequest) => {
  const key = cacheKey(request.url)
  const hit = cache ? await cache.match(key).catch(() => undefined) : undefined
  if (hit) return hit
  let allowed: boolean
  try { allowed = await limiter() } catch (error) {
    console.error('notes limit', error)
    return unavailable()
  }
  if (!allowed) return new Response(JSON.stringify({ error: 'too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '3600' } })
  const response = await notesResponse(store)
  if (cache && response.status === 200) waitUntil(cache.put(key, response.clone()).catch((error: unknown) => console.error('notes cache', error)))
  return response
}

// The client's key in the hits table, as the public MCP server keeps its own: a hash, never the address.
export const notesLimiter = (request: Request, env: Env, now: () => number = Date.now) => async () => {
  const hits = new D1AskStore(env.DB)
  const key = `${await ipHash(request, env)}:notes`
  const at = now()
  if (await hits.countHits(key, at - 3_600_000) >= PUBLIC_CALLS_PER_HOUR) return false
  await hits.addHit(key, at)
  return true
}

const edgeCache = () => (typeof caches === 'undefined' ? null : (caches as unknown as { default: Cache }).default)

export const onRequestGet: PagesFunction<Env> = ({ request, env, waitUntil }) =>
  handleNotes({ request, store: new D1Store(env.DB), cache: edgeCache(), limiter: notesLimiter(request, env), waitUntil: (promise) => waitUntil(promise) })
