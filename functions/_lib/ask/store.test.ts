// @vitest-environment node
// The site assistant's stores: the D1 store runs its real SQL on an in-memory SQLite
// with every migration applied; the memory store must behave the same.
import { describe, expect, it } from 'vitest'
import { fakeD1 } from '../testing/d1'
import { D1AskStore, MemoryAskStore, dayOf, monthStart, sumTotals, type AskStore, type QuestionInput } from './store'

const usage = { input: 100, output: 50, cacheRead: 10, cacheWrite: 5 }
const question = (ts: number, overrides: Partial<QuestionInput> = {}): QuestionInput => ({ ts, reason: 'gap', page: '/about', question: 'Does Steven speak French?', answer: null, country: 'BE', asOrg: 'Proximus', ...overrides })
const day = 86_400_000

describe('days', () => {
  it('names the UTC day and the first of its month', () => {
    expect(dayOf(Date.UTC(2026, 9, 19, 23, 59))).toBe('2026-10-19')
    expect(monthStart(Date.UTC(2026, 9, 19))).toBe('2026-10-01')
  })
})

const stores: [string, () => AskStore][] = [['D1', () => new D1AskStore(fakeD1())], ['memory', () => new MemoryAskStore()]]

describe.each(stores)('the %s assistant store', (_, make) => {
  it('counts hits per visitor and overall since a time', async () => {
    const store = make()
    expect(await store.countHits('a', 0)).toBe(0)
    expect(await store.countAllHits(0)).toBe(0)
    await store.addHit('a', 2 * day)
    await store.addHit('a', 2 * day + 10)
    await store.addHit('b', 2 * day + 20)
    expect(await store.countHits('a', 2 * day)).toBe(2)
    expect(await store.countHits('a', 2 * day + 5)).toBe(1)
    expect(await store.countAllHits(2 * day)).toBe(3)
  })

  it('adds up usage and cost per day and outcome', async () => {
    const store = make()
    await store.recordUsage('2026-10-01', 'answered', usage, 1000, 800.4, 2000.6)
    await store.recordUsage('2026-10-01', 'answered', usage, 500, 200, 1000)
    await store.recordUsage('2026-10-02', 'gap', usage, 300, 100, 400)
    expect(await store.spentMicroSince('2026-10-01')).toBe(1800)
    expect(await store.spentMicroSince('2026-10-02')).toBe(300)
    expect(await store.spentMicroSince('2026-11-01')).toBe(0)
    const rows = await store.daily('2026-10-01')
    expect(rows[0]).toEqual({ day: '2026-10-01', outcome: 'answered', questions: 2, inputTokens: 200, outputTokens: 100, cacheReadTokens: 20, cacheWriteTokens: 10, costMicro: 1500, msFirst: 1000, msTotal: 3001 })
    expect((await store.daily('2026-10-02')).map((row) => row.outcome)).toEqual(['gap'])
  })

  it('counts votes per day and over all time', async () => {
    const store = make()
    expect(await store.allVotes()).toEqual({ helpful: 0, unhelpful: 0 })
    await store.recordVote('2026-10-01', true)
    await store.recordVote('2026-10-01', false)
    await store.recordVote('2026-10-02', true)
    expect(await store.votes('2026-10-02')).toEqual([{ day: '2026-10-02', helpful: 1, unhelpful: 0 }])
    expect(await store.votes('2026-10-01')).toHaveLength(2)
    expect(await store.allVotes()).toEqual({ helpful: 2, unhelpful: 1 })
  })

  it('keeps open questions for a while and lists them newest first', async () => {
    const store = make()
    const first = await store.saveQuestion(question(1 * day), 5 * day)
    const second = await store.saveQuestion(question(2 * day, { reason: 'fit', page: null, country: null, asOrg: null }), 5 * day)
    expect(second).toBeGreaterThan(first)
    expect((await store.questions(0, 10)).map((q) => q.id)).toEqual([second, first])
    expect(await store.questions(0, 1)).toHaveLength(1)
    expect((await store.questions(0, 10))[0]).toMatchObject({ reason: 'fit', page: null, asOrg: null, resolvedAt: null, resolution: null, entryId: null })
    // A question saved much later expires the old open ones.
    const third = await store.saveQuestion(question(10 * day), 5 * day)
    expect((await store.questions(0, 10)).map((q) => q.id)).toEqual([third])
  })

  it('totals everything since the assistant went live', async () => {
    const store = make()
    expect(await store.totals()).toEqual({ since: null, questions: 0, answered: 0, gap: 0, off: 0, limited: 0, costMicro: 0, msFirst: 0 })
    await store.recordUsage('2026-10-02', 'answered', usage, 1000, 500, 900)
    await store.recordUsage('2026-10-01', 'gap', usage, 400, 300, 600)
    await store.recordUsage('2026-10-03', 'off', usage, 100, 9999, 9999)
    await store.recordUsage('2026-10-03', 'limited', usage, 0, 0, 0)
    await store.recordUsage('2026-10-03', 'failed', usage, 50, 0, 0)
    expect(await store.totals()).toEqual({ since: '2026-10-01', questions: 3, answered: 1, gap: 1, off: 1, limited: 1, costMicro: 1550, msFirst: 800 })
  })
})

describe('the D1 assistant store', () => {
  it('drops hits older than a day when it adds one', async () => {
    const db = fakeD1()
    const store = new D1AskStore(db)
    await store.addHit('a', 0)
    await store.addHit('a', 2 * day)
    expect(await store.countAllHits(0)).toBe(1)
  })

  it('keeps answered questions past their expiry and counts them by resolution', async () => {
    const db = fakeD1()
    const store = new D1AskStore(db)
    const answered = await store.saveQuestion(question(1 * day), 5 * day)
    const dismissed = await store.saveQuestion(question(1 * day + 1), 5 * day)
    db.sqlite.prepare("UPDATE ask_questions SET resolved_at = ?, resolution = 'answered', entry_id = 4 WHERE id = ?").run(3 * day, answered)
    db.sqlite.prepare("UPDATE ask_questions SET resolved_at = ?, resolution = 'dismissed' WHERE id = ?").run(4 * day, dismissed)
    db.sqlite.prepare("INSERT INTO ask_questions (ts, reason, question, resolved_at, resolution) VALUES (?, 'gap', 'odd', ?, 'something-else')").run(1 * day, 5 * day)
    expect(await store.resolvedCounts(0)).toEqual({ answered: 1, dismissed: 1 })
    expect(await store.resolvedCounts(4 * day)).toEqual({ answered: 0, dismissed: 1 })
    await store.saveQuestion(question(20 * day), 5 * day)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM ask_questions').get()).toEqual({ n: 4 })
    expect(await store.questions(0, 10)).toHaveLength(1)
  })

  it('passes a D1 failure on to the caller', async () => {
    const db = fakeD1()
    db.failOn = /ask_hits/
    await expect(new D1AskStore(db).countHits('a', 0)).rejects.toThrow('D1_ERROR')
  })
})

describe.each(stores)('the %s assistant store after 90 days', (_, make) => {
  it('keeps a closed question but nothing about where it came from or what the assistant answered', async () => {
    const store = make()
    const closed = await store.saveQuestion(question(1 * day, { answer: 'The assistant said this', page: 'experience' }), 90 * day)
    if (store instanceof MemoryAskStore) Object.assign(store.saved[0], { resolvedAt: 2 * day, resolution: 'answered' })
    else await (store as unknown as { db: D1Database }).db.prepare('UPDATE ask_questions SET resolved_at = ?, resolution = ? WHERE id = ?').bind(2 * day, 'answered', closed).run()
    await store.saveQuestion(question(1 * day + 1), 90 * day)
    await store.saveQuestion(question(92 * day), 90 * day)
    // The open one from day 1 is gone, the closed one is stripped, today's is whole.
    expect(await store.resolvedCounts(0)).toEqual({ answered: 1, dismissed: 0 })
    const open = await store.questions(0, 10)
    expect(open).toHaveLength(1)
    expect(open[0]).toMatchObject({ ts: 92 * day, country: 'BE', asOrg: 'Proximus' })
    const all = store instanceof MemoryAskStore ? store.saved : await (store as unknown as { db: D1Database }).db.prepare('SELECT id, question, answer, page, country, as_org AS asOrg FROM ask_questions ORDER BY id').all().then((r) => r.results)
    expect(all[0]).toMatchObject({ question: 'Does Steven speak French?', answer: null, page: null, country: null, asOrg: null })
  })
})

describe.each(stores)('pruning the %s assistant store', (_, make) => {
  it('keeps everything from the cut on and prunes only what is older', async () => {
    const store = make()
    const cut = 100 * day
    await store.logQuestion({ ts: cut - 1, visitor: 'before', kind: 'question', page: null, question: 'q', answer: null, outcome: 'answered', country: null, asOrg: null }, 1000 * day)
    await store.logQuestion({ ts: cut, visitor: 'at', kind: 'question', page: null, question: 'q', answer: null, outcome: 'answered', country: null, asOrg: null }, 1000 * day)
    await store.saveQuestion(question(cut - 1), 1000 * day)
    await store.saveQuestion(question(cut), 1000 * day)
    await store.prune(cut)
    expect((await store.log(0, 10)).map((e) => e.visitor)).toEqual(['at'])
    expect((await store.questions(0, 10)).map((q) => q.ts)).toEqual([cut])
  })
})

describe.each(stores)('the %s assistant log', (_, make) => {
  const entry = (ts: number, visitor = 'v') => ({ ts, visitor, kind: 'question' as const, page: 'home', question: `q at ${ts}`, answer: null, outcome: 'answered' as const, country: null, asOrg: null })

  it('deletes entries older than the retention when a new one comes in, as /privacy promises', async () => {
    const store = make()
    const now = 200 * day
    await store.logQuestion(entry(now - 91 * day, 'old'), 90 * day)
    await store.logQuestion(entry(now - 89 * day, 'kept'), 90 * day)
    await store.logQuestion(entry(now, 'new'), 90 * day)
    expect((await store.log(0, 100)).map((e) => e.visitor)).toEqual(['new', 'kept'])
  })

  it('reads the log since a time, newest first, up to a limit', async () => {
    const store = make()
    for (const at of [1, 2, 3, 4]) await store.logQuestion(entry(at * day), 90 * day)
    expect((await store.log(2 * day, 10)).map((e) => e.ts)).toEqual([4 * day, 3 * day, 2 * day])
    expect((await store.log(0, 2)).map((e) => e.ts)).toEqual([4 * day, 3 * day])
  })
})

describe('the memory assistant store', () => {
  it('counts closed questions by resolution and keeps them past their expiry', async () => {
    const store = new MemoryAskStore()
    const a = await store.saveQuestion(question(1 * day), 5 * day)
    await store.saveQuestion(question(1 * day + 1), 5 * day)
    Object.assign(store.saved[0], { resolvedAt: 3 * day, resolution: 'answered', entryId: 4 })
    Object.assign(store.saved[1], { resolvedAt: 4 * day, resolution: 'dismissed' })
    expect(await store.resolvedCounts(0)).toEqual({ answered: 1, dismissed: 1 })
    expect(await store.resolvedCounts(4 * day)).toEqual({ answered: 0, dismissed: 1 })
    await store.saveQuestion(question(20 * day), 5 * day)
    expect(store.saved.map((q) => q.id)).toEqual([a, a + 1, a + 2])
  })
})

describe('summing the totals', () => {
  it('takes the earliest day and leaves time to first word out for off-topic questions', () => {
    expect(sumTotals([
      { outcome: 'off', questions: 2, costMicro: 10, msFirst: 500, since: '2026-10-05' },
      { outcome: 'answered', questions: 3, costMicro: 20, msFirst: 900, since: '2026-10-02' },
      { outcome: 'gap', questions: 1, costMicro: 5, msFirst: 100, since: '2026-10-09' },
    ])).toEqual({ since: '2026-10-02', questions: 6, answered: 3, gap: 1, off: 2, limited: 0, costMicro: 35, msFirst: 1000 })
  })
})
