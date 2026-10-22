// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BUDGET_USD, MODEL } from '../../_lib/ask/agent'
import { D1AskStore, dayOf, type LogInput } from '../../_lib/ask/store'
import type { Env } from '../../_lib/env'
import { context, fakeD1, type FakeD1 } from '../../_lib/testing/d1'
import { onRequestGet } from './admin'

const token = 'admin-secret'
const get = (query = '', auth: string | null = `Bearer ${token}`) => new Request(`https://steven.wilssens.com/api/ask/admin${query}`, { headers: auth ? { Authorization: auth } : {} })
const send = async (request: Request, db: FakeD1 = fakeD1(), env: Partial<Env> = { ADMIN_TOKEN: token }) => {
  const { ctx } = context(request, { DB: db, ...env } as Env)
  return onRequestGet(ctx)
}

describe('GET /api/ask/admin', () => {
  it('refuses without the admin token, with a wrong one, and when none is configured', async () => {
    const db = fakeD1()
    for (const [request, env] of [[get('', null), { ADMIN_TOKEN: token }], [get('', 'Bearer wrong'), { ADMIN_TOKEN: token }], [get(), {}]] as const) {
      const response = await send(request, db, env)
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'unauthorized' })
    }
    expect(db.queries).toHaveLength(0)
  })

  it('adds up this month per outcome and shows the budget, the check, votes and the open questions', async () => {
    const db = fakeD1()
    const store = new D1AskStore(db)
    const now = Date.now()
    const today = dayOf(now)
    await store.recordUsage(today, 'answered', { input: 100, output: 50, cacheRead: 1000, cacheWrite: 10 }, 2_000, 400, 900)
    await store.recordUsage(today, 'answered', { input: 100, output: 50, cacheRead: 1000, cacheWrite: 10 }, 2_000, 400, 900)
    await store.recordUsage(today, 'gap', { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 }, 500, 300, 600)
    await store.recordVote(today, true)
    await store.saveQuestion({ ts: now, reason: 'gap', page: 'home', question: 'Does he speak French?', answer: null, country: 'BE', asOrg: null }, 86_400_000)
    const response = await send(get('?days=7'), db, { ADMIN_TOKEN: token, ANTHROPIC_API_KEY: 'sk', ASK_BUDGET_USD: '40', TURNSTILE_SECRET_KEY: 's', TURNSTILE_SITE_KEY: 'k' })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const data = await response.json() as Record<string, any>
    expect(data).toMatchObject({ configured: true, mock: false, model: MODEL, budgetUsd: 40, budgetMicro: 40_000_000, humanCheck: true, days: 7 })
    expect(data.month).toEqual({ questions: 3, answered: 2, gap: 1, off: 0, limited: 0, failed: 0, costMicro: 4_500, inputTokens: 210, outputTokens: 105, cacheReadTokens: 2_000, cacheWriteTokens: 20 })
    expect(data.check).toMatchObject({ state: 'standby', why: null, lastHour: 0, spentTodayMicro: 4_500 })
    expect(data.daily).toHaveLength(2)
    expect(data.votes).toEqual([{ day: today, helpful: 1, unhelpful: 0 }])
    expect(data.questions).toHaveLength(1)
    expect(data.resolved).toEqual({ answered: 0, dismissed: 0 })
  })

  it('reports an unconfigured assistant on the default budget, and clamps the period', async () => {
    const off = await (await send(get('?days=0'), fakeD1(), { ADMIN_TOKEN: token, ASK_MOCK: '1' })).json() as Record<string, any>
    expect(off).toMatchObject({ configured: false, mock: true, budgetUsd: DEFAULT_BUDGET_USD, humanCheck: false, days: 30 })
    expect(off.check).toMatchObject({ state: 'off', why: null })
    expect(((await (await send(get('?days=10000'))).json()) as { days: number }).days).toBe(365)
    expect(((await (await send(get('?days=-1'))).json()) as { days: number }).days).toBe(1)
  })

  it('sends every question in the range with its visitor, and still answers when the log cannot be read', async () => {
    const db = fakeD1()
    const store = new D1AskStore(db)
    const now = Date.now()
    await store.logQuestion({ ts: now - 60_000, visitor: 'abc', kind: 'question', page: 'home', question: 'What did he ship?', answer: 'Windows data.', outcome: 'answered', country: 'US', asOrg: 'Contoso' }, 90 * 86_400_000)
    await store.logQuestion({ ts: now - 10 * 86_400_000, visitor: 'old', kind: 'question', page: 'home', question: 'Earlier', answer: null, outcome: 'off', country: null, asOrg: null }, 90 * 86_400_000)
    const data = await (await send(get('?days=7'), db)).json() as Record<string, any>
    expect(data.log).toEqual([{ id: 1, ts: now - 60_000, visitor: 'abc', kind: 'question', page: 'home', question: 'What did he ship?', answer: 'Windows data.', outcome: 'answered', country: 'US', asOrg: 'Contoso', model: null, fallback: null, promptVersion: null, knowledgeVersion: null, sources: [], rating: null, cut: false }])
    expect(data).toMatchObject({ logDays: 7, logCapped: false })
    await store.logQuestion({ ts: now - 30_000, visitor: 'long', kind: 'question', page: 'home', question: 'Tell me everything', answer: 'x'.repeat(5000), outcome: 'answered', country: null, asOrg: null }, 90 * 86_400_000)
    const long = (await (await send(get('?days=7'), db)).json() as { log: { visitor: string; answer: string }[] }).log.find((e) => e.visitor === 'long')!
    expect(long.answer).toHaveLength(1501)
    expect(long.answer.endsWith('…')).toBe(true)
    // A year asked for still reads 90 days: an entry past them is not sent even before it is deleted.
    db.sqlite.prepare('INSERT INTO ask_log (ts, visitor, kind, question, outcome) VALUES (?, ?, ?, ?, ?)').run(now - 120 * 86_400_000, 'ancient', 'question', 'Long ago', 'answered')
    const year = await (await send(get('?days=365'), db)).json() as Record<string, any>
    expect(year.logDays).toBe(90)
    expect(year.log.map((e: { visitor: string }) => e.visitor)).toEqual(['long', 'abc', 'old'])
    db.failOn = /ask_log/
    const response = await send(get('?days=7'), db)
    expect(response.status).toBe(200)
    expect(((await response.json()) as Record<string, unknown>).log).toBeUndefined()
  })
})


// What produced each answer and Steven's ratings (specs/ask-ratings.md, AC-6), on a fixed clock.
describe('GET /api/ask/admin and the ratings', () => {
  const NOW = Date.UTC(2026, 9, 20, 12)
  const day = 86_400_000
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW) })
  afterEach(() => { vi.useRealTimers() })
  const seed = async (db: FakeD1, overrides: Partial<LogInput> = {}) => {
    await new D1AskStore(db).logQuestion({ ts: NOW - day, visitor: 'v1', kind: 'question', page: 'experience', question: 'Has he led managers?', answer: 'Yes, at Microsoft.', outcome: 'answered', country: 'BE', asOrg: null, model: 'claude-opus-5-5', fallback: false, promptVersion: 'a1b2c3d4', knowledgeVersion: '5e4d3c2b', sources: ['role:csx-data', 'site:gone'], ...overrides }, 90 * day)
    return (db.sqlite.prepare('SELECT MAX(id) AS id FROM ask_log').get() as { id: number }).id
  }
  const rate = (db: FakeD1, logId: number, overall = 4) => new D1AskStore(db).saveRating({ logId, accurate: 'yes', supported: 'yes', answers: 'yes', tone: 'yes', overall, note: 'Fine.', ratedAt: NOW })

  it("sends each entry's model, versions, sources with their titles, and its rating; a source no longer in the data comes back as its id", async () => {
    const db = fakeD1()
    const id = await seed(db)
    const unrated = await seed(db, { ts: NOW - 2 * day, outcome: 'gap', sources: null })
    await seed(db, { ts: NOW - 3 * day, outcome: 'limited' })
    await seed(db, { ts: NOW - 10 * day })
    const rating = await rate(db, id)
    // A rating whose answer the log no longer has still counts in the range.
    db.sqlite.prepare("INSERT INTO ask_ratings (log_id, day, kind, outcome, accurate, supported, answers, tone, overall, rated_at) VALUES (NULL, '2026-10-01', 'question', 'answered', 'no', 'no', 'no', 'no', 1, 1)").run()
    const data = await (await send(get('?days=30'), db)).json() as Record<string, any>
    expect(data.log[0]).toMatchObject({ id, model: 'claude-opus-5-5', fallback: false, promptVersion: 'a1b2c3d4', knowledgeVersion: '5e4d3c2b', rating, cut: false })
    expect(data.log[0].sources).toEqual([{ id: 'role:csx-data', title: expect.stringContaining('Microsoft'), href: 'https://steven.wilssens.com/experience' }, { id: 'site:gone', title: null, href: null }])
    expect(data.log[1]).toMatchObject({ id: unrated, sources: [], rating: null })
    expect(data.ratings).toHaveLength(2)
    expect(data.ratings[0]).toMatchObject({ logId: null, day: '2026-10-01', overall: 1 })
    // The rateable answers of the last seven days without a rating, whatever the range.
    expect(data.unratedWeek).toEqual([unrated])
    const today = await (await send(get('?days=1'), db)).json() as Record<string, any>
    expect(today.unratedWeek).toEqual([unrated])
    expect(today.ratings.map((r: { logId: number }) => r.logId)).toEqual([id])
  })

  it('sends the whole stored answer of one entry, not the 1,500-character cut', async () => {
    const db = fakeD1()
    const id = await seed(db, { answer: 'y'.repeat(6000) })
    await rate(db, id, 2)
    const list = await (await send(get('?days=7'), db)).json() as Record<string, any>
    expect(list.log[0].answer).toHaveLength(1501)
    expect(list.log[0].cut).toBe(true)
    const response = await send(get(`?entry=${id}`), db)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const { entry } = await response.json() as { entry: Record<string, any> }
    expect(entry.answer).toHaveLength(6000)
    expect(entry).toMatchObject({ id, rating: { overall: 2 }, sources: [{ id: 'role:csx-data' }, { id: 'site:gone', title: null }] })
    expect(entry).not.toHaveProperty('cut')
  })

  it('refuses one entry without the token (401), a bad id (400) and a missing or pruned id (404), all no-store', async () => {
    const db = fakeD1()
    const id = await seed(db)
    await seed(db, { ts: NOW + 100 * day })
    const unauthorized = await send(get(`?entry=${id}`, null), db)
    expect(unauthorized.status).toBe(401)
    for (const bad of ['0', '-1', '1.5', 'abc', '', '99999999999999999999']) {
      const response = await send(get(`?entry=${bad}`), db)
      expect(response.status, bad).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid', field: 'entry' })
    }
    for (const missing of [String(id), '999']) {
      const response = await send(get(`?entry=${missing}`), db)
      expect(response.status).toBe(404)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
    }
    expect(unauthorized.headers.get('Cache-Control')).toBe('no-store')
  })
})
