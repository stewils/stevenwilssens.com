// @vitest-environment node
// GET /api/notes: the public notes only, read-only, as the assistant check reads them; from the
// edge cache when it can, behind the public MCP server's per-client limit when it cannot (AC-15).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PUBLIC_CALLS_PER_HOUR } from '../_lib/mcp/server'
import { MemoryStore } from '../_lib/mcp/store'
import { context, fakeD1 } from '../_lib/testing/d1'
import { cacheKey, handleNotes, notesLimiter, notesResponse, onRequestGet, publicNotes } from './notes'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

const seeded = async () => {
  const store = new MemoryStore()
  await store.insert({ role: 'general', topic: 'now', title: 'Looking for', body: 'A product leadership role.', visibility: 'public', tags: 'secret-tag' }, 1)
  await store.insert({ role: 'general', topic: 'now', title: 'Private', body: 'Never shown.', visibility: 'private', tags: null }, 2)
  return store
}

// caches.default, in memory: keyed by the request's URL, as the Workers cache keys a GET.
const fakeCache = () => {
  const entries = new Map<string, Response>()
  const keys: Request[] = []
  const cache = {
    match: async (key: Request) => { keys.push(key); return entries.get(key.url)?.clone() },
    put: async (key: Request, response: Response) => { keys.push(key); entries.set(key.url, response) },
  } as unknown as Cache
  return { cache, entries, keys }
}
// A store that counts its reads, so a test sees whether D1 was touched.
const counting = (store: MemoryStore) => {
  const reads = { n: 0 }
  return { reads, store: { list: (filter: Parameters<MemoryStore['list']>[0]) => { reads.n++; return store.list(filter) } } as unknown as MemoryStore }
}
const get = (url = 'https://steven.wilssens.com/api/notes', headers: Record<string, string> = {}) => new Request(url, { headers })
type Ctx = Parameters<typeof onRequestGet>[0]

describe('GET /api/notes', () => {
  it('answers the public notes only, without tags or dates, cacheable', async () => {
    const response = await notesResponse(await seeded())
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
    const body = await response.json() as { notes: Record<string, unknown>[] }
    expect(body.notes).toEqual([{ id: 1, role: 'general', topic: 'now', title: 'Looking for', body: 'A product leadership role.' }])
    expect(JSON.stringify(body)).not.toContain('Never shown')
  })

  it('drops a private entry even when the store ignores the filter', async () => {
    const store = await seeded()
    const careless = { ...store, list: () => store.list({}) } as unknown as MemoryStore
    expect((await publicNotes(careless)).map((note) => note.title)).toEqual(['Looking for'])
  })

  it('answers 503 when the database cannot be read', async () => {
    const broken = { list: async () => { throw new Error('D1 down') } } as unknown as MemoryStore
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await notesResponse(broken)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'unavailable' })
  })
})

describe('the edge cache and the limit (AC-15, C23)', () => {
  it('serves a second call from the cache without touching D1 or the limiter', async () => {
    const { cache } = fakeCache()
    const { store, reads } = counting(await seeded())
    const limiter = vi.fn(async () => true)
    const pending: Promise<unknown>[] = []
    const first = await handleNotes({ request: get(), store, cache, limiter, waitUntil: (p) => pending.push(p) })
    await Promise.all(pending)
    expect(first.status).toBe(200)
    const second = await handleNotes({ request: get(), store, cache, limiter, waitUntil: (p) => pending.push(p) })
    expect(second.status).toBe(200)
    expect(reads.n).toBe(1)
    expect(limiter).toHaveBeenCalledTimes(1)
    // The cached copy holds the public notes only, as the first answer did.
    const body = await second.text()
    expect(body).toContain('Looking for')
    expect(body).not.toContain('Never shown')
    expect(body).not.toContain('secret-tag')
  })

  it('caches only a 200: a 503 from an unreadable database is not put', async () => {
    const { cache, entries } = fakeCache()
    const broken = { list: async () => { throw new Error('D1 down') } } as unknown as MemoryStore
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const pending: Promise<unknown>[] = []
    expect((await handleNotes({ request: get(), store: broken, cache, limiter: async () => true, waitUntil: (p) => pending.push(p) })).status).toBe(503)
    expect(pending).toHaveLength(0)
    expect(entries.size).toBe(0)
  })

  it('keys the cache on the path without the query, varying on no header', async () => {
    const { cache, entries, keys } = fakeCache()
    const { store, reads } = counting(await seeded())
    const pending: Promise<unknown>[] = []
    const response = await handleNotes({ request: get('https://steven.wilssens.com/api/notes?x=1', { Accept: 'text/html', 'X-Test': 'a' }), store, cache, limiter: async () => true, waitUntil: (p) => pending.push(p) })
    await Promise.all(pending)
    expect(response.headers.get('Vary')).toBeNull()
    expect([...entries.keys()]).toEqual(['https://steven.wilssens.com/api/notes'])
    expect(keys.every((key) => [...key.headers.keys()].length === 0)).toBe(true)
    await handleNotes({ request: get('https://steven.wilssens.com/api/notes?y=2', { Accept: 'application/json' }), store, cache, limiter: async () => true, waitUntil: (p) => pending.push(p) })
    expect(reads.n).toBe(1)
    expect(cacheKey('https://steven.wilssens.com/api/notes?a=1#b').url).toBe('https://steven.wilssens.com/api/notes')
  })

  it('on a miss applies the limit before the read: 429, no read, nothing cached', async () => {
    const { cache, entries } = fakeCache()
    const { store, reads } = counting(await seeded())
    const response = await handleNotes({ request: get(), store, cache, limiter: async () => false, waitUntil: () => {} })
    expect(response.status).toBe(429)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Retry-After')).toBe('3600')
    expect(reads.n).toBe(0)
    expect(entries.size).toBe(0)
  })

  it('answers 503 when the limit cannot be read, and works without a cache or with a failing one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { store, reads } = counting(await seeded())
    expect((await handleNotes({ request: get(), store, cache: null, limiter: async () => { throw new Error('D1 down') }, waitUntil: () => {} })).status).toBe(503)
    expect(reads.n).toBe(0)
    expect((await handleNotes({ request: get(), store, cache: null, limiter: async () => true, waitUntil: () => {} })).status).toBe(200)
    // A cache that fails to answer is a miss; one that fails to store is logged, never the visitor's problem.
    const failing = { match: async () => { throw new Error('cache down') }, put: async () => { throw new Error('cache down') } } as unknown as Cache
    const pending: Promise<unknown>[] = []
    expect((await handleNotes({ request: get(), store, cache: failing, limiter: async () => true, waitUntil: (p) => pending.push(p) })).status).toBe(200)
    await expect(Promise.all(pending)).resolves.toBeDefined()
  })

  it('counts the hashed client in the same window and limit as the public MCP server', async () => {
    const db = fakeD1()
    const env = { DB: db, HASH_SALT: 'salt' } as never
    const request = get('https://steven.wilssens.com/api/notes', { 'CF-Connecting-IP': '203.0.113.9' })
    const now = Date.now() - 7_200_000
    const limiter = notesLimiter(request, env, () => now)
    for (let n = 0; n < PUBLIC_CALLS_PER_HOUR; n++) expect(await limiter()).toBe(true)
    expect(await limiter()).toBe(false)
    const rows = db.sqlite.prepare('SELECT ip_hash FROM ask_hits').all() as { ip_hash: string }[]
    expect(rows).toHaveLength(PUBLIC_CALLS_PER_HOUR)
    expect(rows[0].ip_hash).toMatch(/^[0-9a-f]{32}:notes$/)
    expect(JSON.stringify(rows)).not.toContain('203.0.113.9')
    // An hour later the window has moved on.
    expect(await notesLimiter(request, env, () => now + 3_600_001)()).toBe(true)
    expect(await notesLimiter(request, env)()).toBe(true)
  })

  it('reads the D1 database of the request through the Pages entry', async () => {
    const { ctx, settled } = context(get(), { DB: fakeD1(), HASH_SALT: 'salt' })
    const response = await onRequestGet(ctx as unknown as Ctx)
    await settled()
    expect(await response.json()).toEqual({ notes: [] })
  })

  it('uses caches.default at the edge when there is one', async () => {
    const { cache, entries } = fakeCache()
    vi.stubGlobal('caches', { default: cache })
    const { ctx, settled } = context(get(), { DB: fakeD1(), HASH_SALT: 'salt' })
    await onRequestGet(ctx as unknown as Ctx)
    await settled()
    expect(entries.size).toBe(1)
  })
})
