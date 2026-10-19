// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DEFAULT_BUDGET_USD, MODEL } from '../../_lib/ask/agent'
import { D1AskStore, dayOf } from '../../_lib/ask/store'
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
    expect(data.log).toEqual([{ id: 1, ts: now - 60_000, visitor: 'abc', kind: 'question', page: 'home', question: 'What did he ship?', answer: 'Windows data.', outcome: 'answered', country: 'US', asOrg: 'Contoso' }])
    expect(data).toMatchObject({ logDays: 7, logCapped: false })
    // A year asked for still reads 90 days: an entry past them is not sent even before it is deleted.
    db.sqlite.prepare('INSERT INTO ask_log (ts, visitor, kind, question, outcome) VALUES (?, ?, ?, ?, ?)').run(now - 120 * 86_400_000, 'ancient', 'question', 'Long ago', 'answered')
    const year = await (await send(get('?days=365'), db)).json() as Record<string, any>
    expect(year.logDays).toBe(90)
    expect(year.log.map((e: { visitor: string }) => e.visitor)).toEqual(['abc', 'old'])
    db.failOn = /ask_log/
    const response = await send(get('?days=7'), db)
    expect(response.status).toBe(200)
    expect(((await response.json()) as Record<string, unknown>).log).toBeUndefined()
  })
})

