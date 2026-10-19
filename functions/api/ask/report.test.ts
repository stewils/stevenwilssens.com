// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { D1AskStore, dayOf } from '../../_lib/ask/store'
import type { Env } from '../../_lib/env'
import { context, fakeD1, type FakeD1 } from '../../_lib/testing/d1'
import { onRequestGet } from './report'

const get = (db: FakeD1, at = 'https://steven.wilssens.com/api/ask/report?bust=1') => {
  const { ctx, settled } = context(new Request(at), { DB: db } as unknown as Env)
  return { response: onRequestGet(ctx), settled }
}

// The edge cache Pages offers as caches.default, in memory.
const memoryCache = () => {
  const stored = new Map<string, Response>()
  return {
    stored,
    match: vi.fn(async (key: Request) => stored.get(key.url)?.clone()),
    put: vi.fn(async (key: Request, response: Response) => { stored.set(key.url, response) }),
  }
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('GET /api/ask/report', () => {
  it('is the public report card: aggregates only, cacheable and open to other origins', async () => {
    const db = fakeD1()
    const store = new D1AskStore(db)
    await store.recordUsage(dayOf(Date.now()), 'answered', { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, 1_000, 500, 900)
    await store.saveQuestion({ ts: Date.now(), reason: 'gap', page: 'home', question: 'Private question from a visitor', answer: null, country: 'BE', asOrg: 'ISP' }, 86_400_000)
    const { response } = get(db)
    const result = await response
    expect(result.status).toBe(200)
    expect(result.headers.get('Cache-Control')).toBe('public, max-age=600')
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const text = await result.text()
    expect(JSON.parse(text)).toMatchObject({ questions: 1, answered: 1, gapsOpen: 1, costMicro: 1_000 })
    expect(text).not.toContain('Private question')
    expect(text).not.toContain('ISP')
  })

  it('is served from the edge cache under one key, whatever the query string, and fills it on a miss', async () => {
    const cache = memoryCache()
    vi.stubGlobal('caches', { default: cache })
    const db = fakeD1()
    const first = get(db)
    expect((await first.response).status).toBe(200)
    await first.settled()
    expect(cache.put).toHaveBeenCalledTimes(1)
    expect([...cache.stored.keys()]).toEqual(['https://steven.wilssens.com/api/ask/report'])
    const reads = db.queries.length
    const second = get(db, 'https://steven.wilssens.com/api/ask/report?another=2')
    expect((await second.response).status).toBe(200)
    expect(db.queries.length).toBe(reads)
  })

  it('reads the database when the cache fails, and answers even when storing fails', async () => {
    vi.stubGlobal('caches', { default: { match: async () => { throw new Error('cache down') }, put: async () => { throw new Error('cache down') } } })
    const { response, settled } = get(fakeD1())
    expect((await response).status).toBe(200)
    await settled()
  })
})
