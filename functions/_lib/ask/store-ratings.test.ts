// @vitest-environment node
// What produced an answer and Steven's ratings of it (specs/ask-ratings.md, AC-1, AC-7 and
// AC-9): the D1 store runs its real SQL on an in-memory SQLite, the memory store must agree.
import { describe, expect, it } from 'vitest'
import { applyMigration, fakeD1 } from '../testing/d1'
import { D1AskStore, MemoryAskStore, type AskStore, type LogInput, type RatingInput } from './store'

const day = 86_400_000

type Kept = { store: AskStore; dump: () => string; dropLog: (id: number) => void }
const keptStores: [string, () => Kept][] = [
  ['D1', () => {
    const db = fakeD1()
    return { store: new D1AskStore(db), dump: () => JSON.stringify(['ask_log', 'ask_ratings', 'ask_questions'].map((table) => db.sqlite.prepare(`SELECT * FROM ${table}`).all())), dropLog: (id) => { db.sqlite.prepare('DELETE FROM ask_log WHERE id = ?').run(id) } }
  }],
  ['memory', () => {
    const store = new MemoryAskStore()
    return { store, dump: () => JSON.stringify([store.entries, store.ratingRows, store.saved]), dropLog: (id) => { store.entries = store.entries.filter((e) => e.id !== id) } }
  }],
]
const logged = (ts: number, overrides: Partial<LogInput> = {}): LogInput => ({ ts, visitor: 'visitor-code', kind: 'question', page: 'experience', question: 'Has he led managers of managers?', answer: 'Yes. As Group PM he led a team.', outcome: 'answered', country: 'BE', asOrg: 'Proximus', model: 'claude-opus-5-5', fallback: false, promptVersion: 'a1b2c3d4', knowledgeVersion: '5e4d3c2b', sources: ['role:csx-data', 'site:recommendations'], ...overrides })
const scores = { accurate: 'yes', supported: 'partly', answers: 'yes', tone: 'yes', overall: 4 } as const
const rating = (logId: number, overrides: Partial<RatingInput> = {}): RatingInput => ({ logId, ...scores, note: 'Missed the team size.', ratedAt: 5 * day, ...overrides })
const lastId = async (store: AskStore) => (await store.log(0, 1))[0].id

describe.each(keptStores)('ratings in the %s assistant store', (_, make) => {
  it('logs what produced an answer and reads one entry back whole', async () => {
    const { store } = make()
    await store.logQuestion(logged(2 * day), 90 * day)
    await store.logQuestion(logged(3 * day, { model: undefined, fallback: undefined, promptVersion: undefined, knowledgeVersion: undefined, sources: undefined, outcome: 'gap' }), 90 * day)
    await store.logQuestion(logged(4 * day, { fallback: true, model: 'claude-sonnet-5', sources: null }), 90 * day)
    const [fallback, old, first] = await store.log(0, 10)
    expect(first).toMatchObject({ model: 'claude-opus-5-5', fallback: false, promptVersion: 'a1b2c3d4', knowledgeVersion: '5e4d3c2b', sources: ['role:csx-data', 'site:recommendations'] })
    expect(old).toMatchObject({ model: null, fallback: null, promptVersion: null, knowledgeVersion: null, sources: null })
    expect(fallback).toMatchObject({ model: 'claude-sonnet-5', fallback: true, sources: null })
    expect(await store.entry(first.id)).toEqual(first)
    expect(await store.entry(999)).toBeNull()
  })

  it('holds one rating per answer, copied from the log row, with the day and never the time', async () => {
    const { store } = make()
    await store.logQuestion(logged(Date.UTC(2026, 9, 14, 9, 12)), 900 * day)
    const id = await lastId(store)
    const saved = await store.saveRating(rating(id))
    expect(saved).toMatchObject({ logId: id, day: '2026-10-14', model: 'claude-opus-5-5', fallback: false, promptVersion: 'a1b2c3d4', knowledgeVersion: '5e4d3c2b', kind: 'question', outcome: 'answered', ...scores, note: 'Missed the team size.', questionId: null, ratedAt: 5 * day })
    expect(saved).not.toHaveProperty('ts')
    // A second save replaces the first: one row, the second values.
    const again = await store.saveRating(rating(id, { accurate: 'no', overall: 2, note: null, ratedAt: 6 * day }))
    expect(again).toMatchObject({ id: saved!.id, accurate: 'no', overall: 2, note: null, ratedAt: 6 * day, day: '2026-10-14' })
    expect(await store.ratings('2026-10-01')).toEqual([again])
    expect(await store.ratings('2026-10-15')).toEqual([])
    expect(await store.ratingFor(id)).toEqual(again)
    expect(await store.ratingFor(id + 1)).toBeNull()
    expect(await store.linkRatingQuestion(saved!.id, 77)).toBe(77)
    expect((await store.ratingFor(id))?.questionId).toBe(77)
    // A link never replaces one already there.
    expect(await store.linkRatingQuestion(saved!.id, 78)).toBe(77)
    expect((await store.ratingFor(id))?.questionId).toBe(77)
  })

  it("adds a rating's question once: again after a failed link it reuses the open one", async () => {
    const { store } = make()
    await store.logQuestion(logged(Date.UTC(2026, 9, 20, 6)), 900 * day)
    const id = await lastId(store)
    const saved = (await store.saveRating(rating(id, { accurate: 'no', overall: 2 })))!
    const q = { ts: Date.UTC(2026, 9, 20, 6), reason: 'rated' as const, page: 'experience', question: 'Has he led managers of managers?', answer: 'Yes.', country: null, asOrg: null }
    // An earlier save made the question, then its link failed: the next save links that one.
    const left = await store.saveQuestion(q, 900 * day)
    expect(await store.addRatingQuestion(saved.id, q, 900 * day)).toBe(left)
    expect(await store.questions(0, 10)).toHaveLength(1)
    expect((await store.ratingFor(id))?.questionId).toBe(left)
    // Saved again with the box ticked: still one question.
    expect(await store.addRatingQuestion(saved.id, q, 900 * day)).toBe(left)
    expect(await store.questions(0, 10)).toHaveLength(1)
  })

  it('a poor rating of a gap answer links the gap question the answer raised, and adds no second one', async () => {
    const { store } = make()
    const ts = Date.UTC(2026, 9, 20, 6)
    await store.logQuestion(logged(ts, { outcome: 'gap', sources: null }), 900 * day)
    const id = await lastId(store)
    const gap = await store.saveQuestion({ ts, reason: 'gap', page: 'experience', question: 'Has he led managers of managers?', answer: 'Yes. As Group PM he led a team.', country: 'BE', asOrg: 'Proximus' }, 900 * day)
    const saved = (await store.saveRating(rating(id, { accurate: 'no', overall: 2 })))!
    const q = { ts, reason: 'rated' as const, page: 'experience', question: 'Has he led managers of managers?', answer: 'Yes.', country: null, asOrg: null }
    expect(await store.addRatingQuestion(saved.id, q, 900 * day)).toBe(gap)
    expect(await store.questions(0, 10)).toMatchObject([{ id: gap, reason: 'gap' }])
    // The gap question of another answer is never reused.
    await store.logQuestion(logged(ts + 1, { outcome: 'gap', sources: null }), 900 * day)
    const other = (await store.saveRating(rating(await lastId(store), { accurate: 'no', overall: 2 })))!
    const added = await store.addRatingQuestion(other.id, { ...q, ts: ts + 1 }, 900 * day)
    expect(added).not.toBe(gap)
    expect((await store.questions(0, 10)).map((question) => [question.id, question.reason])).toEqual([[added, 'rated'], [gap, 'gap']])
  })

  it('a save that loses the race to link drops the question it made, and an answer pruned meanwhile gets none', async () => {
    const { store } = make()
    await store.logQuestion(logged(Date.UTC(2026, 9, 20, 6)), 900 * day)
    const id = await lastId(store)
    const saved = (await store.saveRating(rating(id, { accurate: 'no', overall: 2 })))!
    const q = { ts: Date.UTC(2026, 9, 20, 6), reason: 'rated' as const, page: 'experience', question: 'Has he led managers of managers?', answer: 'Yes.', country: null, asOrg: null }
    const other = await store.saveQuestion({ ...q, ts: q.ts + 1 }, 900 * day)
    await store.linkRatingQuestion(saved.id, other)
    expect(await store.addRatingQuestion(saved.id, q, 900 * day)).toBe(other)
    expect((await store.questions(0, 10)).map((question) => question.id)).toEqual([other])
    await store.prune(Date.UTC(2026, 9, 21))
    expect(await store.addRatingQuestion(saved.id, { ...q, ts: Date.UTC(2026, 9, 22) }, 900 * day)).toBeNull()
    expect(await store.questions(0, 10)).toEqual([])
  })

  it('rates only answers the model gave, and n/a only on an off-topic one', async () => {
    const { store } = make()
    for (const [at, outcome] of [[1, 'limited'], [2, 'failed'], [3, 'off'], [4, 'gap']] as const) await store.logQuestion(logged(at * day, { outcome }), 900 * day)
    const [gap, off, failed, limited] = await store.log(0, 10)
    expect(await store.saveRating(rating(limited.id))).toBeNull()
    expect(await store.saveRating(rating(failed.id))).toBeNull()
    expect(await store.saveRating(rating(999))).toBeNull()
    expect(await store.saveRating(rating(gap.id, { supported: 'na' }))).toBeNull()
    expect(await store.saveRating(rating(gap.id, { tone: 'na' }))).toBeNull()
    expect(await store.ratings('1970-01-01')).toEqual([])
    expect(await store.saveRating(rating(off.id, { supported: 'na', tone: 'na' }))).toMatchObject({ outcome: 'off', supported: 'na', tone: 'na' })
    expect(await store.saveRating(rating(gap.id))).toMatchObject({ outcome: 'gap', kind: 'question' })
  })

  it('lists the rateable answers without a rating, newest first', async () => {
    const { store } = make()
    await store.logQuestion(logged(1 * day), 900 * day)
    await store.logQuestion(logged(2 * day, { outcome: 'limited' }), 900 * day)
    await store.logQuestion(logged(3 * day, { kind: 'fit' }), 900 * day)
    await store.logQuestion(logged(4 * day, { outcome: 'off' }), 900 * day)
    const [off, fit, , first] = await store.log(0, 10)
    await store.saveRating(rating(fit.id))
    expect(await store.unrated(0)).toEqual([off.id, first.id])
    expect(await store.unrated(2 * day)).toEqual([off.id])
  })

  it('never gives a pruned answer\'s id to a new one, so an old rating cannot attach to it', async () => {
    const { store } = make()
    await store.logQuestion(logged(1 * day), 90 * day)
    const old = await lastId(store)
    await store.saveRating(rating(old))
    await store.logQuestion(logged(100 * day, { visitor: 'new' }), 90 * day)
    const fresh = await lastId(store)
    expect(fresh).toBeGreaterThan(old)
    expect(await store.ratingFor(fresh)).toBeNull()
  })
})

describe.each(keptStores)('pruning the ratings of the %s assistant store', (_, make) => {
  it('a pruned answer keeps its rating: day, model, versions, kind, outcome and scores, without the link, the note or the question', async () => {
    const { store } = make()
    await store.logQuestion(logged(0), 90 * day)
    const id = await lastId(store)
    const saved = await store.saveRating(rating(id, { ratedAt: 89 * day }))
    await store.linkRatingQuestion(saved!.id, 3)
    await store.logQuestion(logged(91 * day, { visitor: 'later' }), 90 * day)
    expect(await store.entry(id)).toBeNull()
    expect(await store.ratings('1970-01-01')).toEqual([{ ...saved, logId: null, note: null, questionId: null }])
  })

  it("an answer logged earlier on the cutoff's own day loses its rating's link, note and question in the same prune", async () => {
    const { store } = make()
    await store.logQuestion(logged(Date.UTC(2026, 9, 20, 6)), 900 * day)
    const id = await lastId(store)
    const saved = await store.saveRating(rating(id, { note: "Steven's own note" }))
    expect(await store.linkRatingQuestion(saved!.id, 5)).toBe(5)
    await store.prune(Date.UTC(2026, 9, 20, 12))
    expect(await store.entry(id)).toBeNull()
    // The day sweep alone would keep it until tomorrow: the answer's day is the cutoff's day.
    expect(await store.ratings('1970-01-01')).toMatchObject([{ day: '2026-10-20', logId: null, note: null, questionId: null, overall: 4 }])
  })

  it('the sweep clears a rating whose answer went another way', async () => {
    const { store, dropLog } = make()
    await store.logQuestion(logged(1 * day), 900 * day)
    const id = await lastId(store)
    await store.saveRating(rating(id))
    dropLog(id)
    await store.prune(10 * day)
    expect(await store.ratings('1970-01-01')).toMatchObject([{ logId: null, note: null, questionId: null, overall: 4 }])
  })

  it('keeps a rating whole while its answer is kept', async () => {
    const { store } = make()
    await store.logQuestion(logged(5 * day), 900 * day)
    const id = await lastId(store)
    await store.saveRating(rating(id))
    await store.prune(5 * day)
    expect(await store.ratingFor(id)).toMatchObject({ logId: id, note: 'Missed the team size.' })
  })

  it('after 90 days no question, answer, visitor code, network or note is left anywhere', async () => {
    const { store, dump } = make()
    await store.logQuestion(logged(0, { question: 'Secret question from Jane', answer: 'Secret answer to Jane' }), 90 * day)
    const id = await lastId(store)
    const saved = await store.saveRating(rating(id, { note: 'Secret note of Steven', accurate: 'no' }))
    const questionId = await store.saveQuestion({ ts: 0, reason: 'rated', page: 'experience', question: 'Secret question from Jane', answer: 'Secret answer to Jane', country: null, asOrg: null }, 90 * day)
    await store.linkRatingQuestion(saved!.id, questionId)
    await store.prune(91 * day)
    const left = dump()
    for (const text of ['Secret question', 'Secret answer', 'Secret note', 'visitor-code', 'Proximus', '"BE"', 'experience']) expect(left).not.toContain(text)
    expect(left).toContain('claude-opus-5-5')
    expect(await store.ratings('1970-01-01')).toMatchObject([{ day: '1970-01-01', accurate: 'no', overall: 4, logId: null, questionId: null }])
  })
})

describe('migration 0014', () => {
  it('keeps every ask_log row and leaves model, versions and sources empty on the old ones', async () => {
    const db = fakeD1({ through: '0013' })
    const columns = (table: string) => (db.sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((column) => column.name)
    expect(columns('ask_log')).not.toContain('model')
    db.sqlite.prepare("INSERT INTO ask_log (ts, visitor, kind, question, answer, outcome) VALUES (1, 'a', 'question', 'Old one', 'Old answer', 'answered'), (2, 'b', 'fit', 'Old fit', NULL, 'gap')").run()
    applyMigration(db, '0014')
    const store = new D1AskStore(db)
    const rows = await store.log(0, 10)
    expect(rows.map((row) => row.question)).toEqual(['Old fit', 'Old one'])
    for (const row of rows) expect(row).toMatchObject({ model: null, fallback: null, promptVersion: null, knowledgeVersion: null, sources: null })
    // The ratings table keeps the answer's day and never its time.
    expect(columns('ask_ratings')).toEqual(['id', 'log_id', 'day', 'model', 'fallback', 'prompt_version', 'knowledge_version', 'kind', 'outcome', 'accurate', 'supported', 'answers', 'tone', 'overall', 'note', 'question_id', 'rated_at'])
    expect(await store.saveRating(rating(rows[1].id))).toMatchObject({ day: '1970-01-01', model: null, promptVersion: null, fallback: null })
  })

  it('reads a stored source list that is not a list of ids as none', async () => {
    const db = fakeD1()
    db.sqlite.prepare("INSERT INTO ask_log (ts, visitor, kind, question, outcome, sources) VALUES (1, 'a', 'question', 'q', 'answered', '{bad'), (2, 'b', 'question', 'q', 'answered', '{\"a\":1}'), (3, 'c', 'question', 'q', 'answered', '[\"site:about\", 4]')").run()
    expect((await new D1AskStore(db).log(0, 10)).map((row) => row.sources)).toEqual([['site:about'], null, null])
  })
})
