// @vitest-environment node
// POST /api/ask/rating against an in-memory D1 with every migration applied (specs/ask-ratings.md,
// AC-7, AC-8 and AC-22; the security controls S-1 to S-8 and S-15).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { D1AskStore, type LogInput } from '../../_lib/ask/store'
import type { Env } from '../../_lib/env'
import { context, fakeD1, type FakeD1 } from '../../_lib/testing/d1'
import * as route from './rating'
import { onRequestPost } from './rating'

const token = 'admin-secret'
const url = 'https://steven.wilssens.com/api/ask/rating'
const day = 86_400_000
const NOW = Date.UTC(2026, 9, 20, 12)
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const post = (body: unknown, headers: Record<string, string> = auth) => new Request(url, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
const send = (request: Request, db: FakeD1, extra: Partial<Env> = {}) => onRequestPost(context(request, { DB: db, ADMIN_TOKEN: token, ...extra } as Env).ctx)
const good = { accurate: 'yes', supported: 'yes', answers: 'yes', tone: 'yes', overall: 5 }
const poor = { accurate: 'no', supported: 'partly', answers: 'yes', tone: 'yes', overall: 2 }
const logged = (overrides: Partial<LogInput> = {}): LogInput => ({ ts: NOW - day, visitor: 'v1', kind: 'question', page: 'experience', question: 'When can he start?', answer: 'He can start in March.', outcome: 'answered', country: 'BE', asOrg: 'Proximus', model: 'claude-opus-5-5', fallback: false, promptVersion: 'a1b2c3d4', knowledgeVersion: '5e4d3c2b', sources: ['site:about'], ...overrides })
const seed = async (db: FakeD1, overrides: Partial<LogInput> = {}) => {
  const store = new D1AskStore(db)
  await store.logQuestion(logged(overrides), 90 * day)
  return (db.sqlite.prepare('SELECT MAX(id) AS id FROM ask_log').get() as { id: number }).id
}
const count = (db: FakeD1, table: string) => (db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('POST /api/ask/rating refuses everyone but Steven', () => {
  it('answers 401 without the token, with a wrong one and when none is configured, before reading the body or the database', async () => {
    const db = fakeD1()
    for (const [headers, extra] of [[{ 'Content-Type': 'application/json' }, {}], [{ ...auth, Authorization: 'Bearer wrong' }, {}], [auth, { ADMIN_TOKEN: undefined }]] as const) {
      const request = post({ id: 1, ...good }, headers)
      const read = vi.spyOn(request, 'text')
      const response = await send(request, db, extra)
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'unauthorized' })
      expect(read).not.toHaveBeenCalled()
    }
    expect(db.queries).toHaveLength(0)
  })

  it('exports only POST, so GET and every other method are not routed', () => {
    expect(Object.keys(route).filter((name) => name.startsWith('onRequest'))).toEqual(['onRequestPost'])
  })

  it('refuses a body that is not JSON (415) or over 16 KB (413), by its header and by what is actually sent', async () => {
    const db = fakeD1()
    expect((await send(post({ id: 1, ...good }, { Authorization: auth.Authorization, 'Content-Type': 'text/plain' }), db)).status).toBe(415)
    expect((await send(post({ id: 1, ...good, note: 'x'.repeat(17_000) }), db)).status).toBe(413)
    const small = new Request(url, { method: 'POST', headers: { ...auth, 'Content-Length': String(20_000) }, body: '{}' })
    expect((await send(small, db)).status).toBe(413)
    const streamed = new Request(url, {
      method: 'POST',
      headers: auth,
      body: new ReadableStream({ start(controller) { for (let i = 0; i < 20; i++) controller.enqueue(new TextEncoder().encode('x'.repeat(1024))); controller.close() } }),
      duplex: 'half',
    } as RequestInit)
    expect((await send(streamed, db)).status).toBe(413)
    expect(db.queries).toHaveLength(0)
  })
})

describe('POST /api/ask/rating saves a rating', () => {
  it('saves one, and a second save replaces it', async () => {
    const db = fakeD1()
    const id = await seed(db)
    const first = await send(post({ id, ...good, note: 'Right.' }), db)
    expect(first.status).toBe(200)
    expect(first.headers.get('Cache-Control')).toBe('no-store')
    expect(first.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(((await first.json()) as { rating: unknown }).rating).toMatchObject({ logId: id, overall: 5, note: 'Right.', ratedAt: NOW, questionId: null })
    const second = (await (await send(post({ id, ...poor }), db)).json()) as { rating: Record<string, unknown> }
    expect(second.rating).toMatchObject({ logId: id, accurate: 'no', overall: 2, note: null })
    expect(count(db, 'ask_ratings')).toBe(1)
  })

  it('takes model, versions, kind, outcome and day from the log row, whatever the body says', async () => {
    const db = fakeD1()
    const id = await seed(db, { kind: 'fit', outcome: 'gap' })
    const forged = await send(post({ id, ...good, model: 'claude-x', day: '2020-01-01' }), db)
    expect(forged.status).toBe(400)
    const saved = (await (await send(post({ id, ...good }), db)).json()) as { rating: Record<string, unknown> }
    expect(saved.rating).toMatchObject({ model: 'claude-opus-5-5', fallback: false, promptVersion: 'a1b2c3d4', knowledgeVersion: '5e4d3c2b', kind: 'fit', outcome: 'gap', day: '2026-10-19' })
  })

  it.each([
    ['criterion maybe', { accurate: 'maybe' }, 'accurate'],
    ['n/a on Accurate', { accurate: 'na' }, 'accurate'],
    ['n/a on Answers the question', { answers: 'na' }, 'answers'],
    ['n/a on Supported for an answer that was not off topic', { supported: 'na' }, 'supported'],
    ['n/a on Tone and length for an answer that was not off topic', { tone: 'na' }, 'tone'],
    ['overall 0', { overall: 0 }, 'overall'],
    ['overall 6', { overall: 6 }, 'overall'],
    ['overall 4.5', { overall: 4.5 }, 'overall'],
    ['overall "4"', { overall: '4' }, 'overall'],
    ['overall null', { overall: null }, 'overall'],
    ['a 1,001-character note', { note: 'Private note '.repeat(77) + 'x' }, 'note'],
    ['an unknown key', { question: 'Private question text' }, 'keys'],
    ['id -1', { id: -1 }, 'id'],
    ['id 1.5', { id: 1.5 }, 'id'],
    ['id "7"', { id: '7' }, 'id'],
    ['an id not in the log', { id: 999 }, 'id'],
  ])('refuses %s with 400, names the field and stores nothing', async (_, change, field) => {
    const db = fakeD1()
    const id = await seed(db)
    const response = await send(post({ id, ...good, ...change }), db)
    expect(response.status).toBe(400)
    const text = await response.text()
    expect(JSON.parse(text)).toEqual({ error: 'invalid', field })
    expect(text).not.toMatch(/Private|maybe/)
    expect(count(db, 'ask_ratings')).toBe(0)
  })

  it('accepts a 1,000-character note, and n/a on Supported and Tone and length for an off-topic answer', async () => {
    const db = fakeD1()
    const id = await seed(db, { outcome: 'off', sources: null })
    const response = await send(post({ id, ...good, supported: 'na', tone: 'na', note: 'x'.repeat(1000) }), db)
    expect(response.status).toBe(200)
    expect(((await response.json()) as { rating: Record<string, unknown> }).rating).toMatchObject({ supported: 'na', tone: 'na', outcome: 'off' })
  })

  it('refuses a limited or a failed entry, and a pruned one, with 400 and stores nothing', async () => {
    const db = fakeD1()
    const pruned = await seed(db, { ts: NOW - 95 * day })
    const limited = await seed(db, { outcome: 'limited' })
    const failed = await seed(db, { outcome: 'failed' })
    expect(count(db, 'ask_log')).toBe(2)
    for (const id of [limited, failed, pruned]) expect((await send(post({ id, ...good }), db)).status).toBe(400)
    expect(count(db, 'ask_ratings')).toBe(0)
  })

  it('answers 400 when the answer is pruned between the read and the write', async () => {
    const db = fakeD1()
    const id = await seed(db)
    vi.spyOn(D1AskStore.prototype, 'saveRating').mockResolvedValueOnce(null)
    expect(await (await send(post({ id, ...good }), db)).json()).toEqual({ error: 'invalid', field: 'id' })
  })

  it('accepts answered, gap and off, question and fit', async () => {
    const db = fakeD1()
    for (const [kind, outcome] of [['question', 'answered'], ['question', 'gap'], ['fit', 'off'], ['fit', 'answered']] as const) {
      const id = await seed(db, { kind, outcome })
      expect((await send(post({ id, ...good }), db)).status).toBe(200)
    }
    expect(count(db, 'ask_ratings')).toBe(4)
  })

  it('answers 503 on a database failure, without the note', async () => {
    const db = fakeD1()
    const id = await seed(db)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    db.failOn = /ask_ratings/
    const response = await send(post({ id, ...good, note: 'Private note' }), db)
    expect(response.status).toBe(503)
    const text = await response.text()
    expect(JSON.parse(text)).toEqual({ error: 'unavailable' })
    expect(text).not.toContain('Private')
    expect(errors).toHaveBeenCalledWith('ask rating', 'D1_ERROR: forced failure')
    expect(JSON.stringify(errors.mock.calls)).not.toContain('Private')
  })
})

describe('Add to my questions', () => {
  const questions = (db: FakeD1) => db.sqlite.prepare('SELECT * FROM ask_questions').all() as Record<string, unknown>[]

  it('on a poor rating saves the question with reason rated, built from the stored row; the body cannot send one', async () => {
    const db = fakeD1()
    const id = await seed(db)
    const forged = await send(post({ id, ...poor, addToQuestions: true, question: 'Forged' }), db)
    expect(forged.status).toBe(400)
    const saved = (await (await send(post({ id, ...poor, addToQuestions: true, note: 'Private note' }), db)).json()) as { rating: { questionId: number } }
    const rows = questions(db)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: saved.rating.questionId, reason: 'rated', question: 'When can he start?', answer: 'He can start in March.', page: 'experience', country: null, as_org: null, ts: NOW - day })
    // The note never goes with it, in any column.
    expect(JSON.stringify(rows)).not.toContain('Private')
  })

  it('saving again with it ticked adds no second question', async () => {
    const db = fakeD1()
    const id = await seed(db)
    await send(post({ id, ...poor, addToQuestions: true }), db)
    const again = (await (await send(post({ id, ...poor, overall: 1, addToQuestions: true }), db)).json()) as { rating: { questionId: number } }
    expect(questions(db)).toHaveLength(1)
    expect(again.rating.questionId).toBe(questions(db)[0].id)
  })

  it('unticked, or on a rating that is not poor, nothing is added; overall 4 with Accurate No counts as poor', async () => {
    const db = fakeD1()
    const id = await seed(db)
    await send(post({ id, ...poor }), db)
    await send(post({ id, ...good, overall: 3, addToQuestions: true }), db)
    expect(questions(db)).toHaveLength(0)
    await send(post({ id, ...good, accurate: 'no', overall: 4, addToQuestions: true }), db)
    expect(questions(db)).toHaveLength(1)
  })

  it('a fit check passes on only the stored head of the posting', async () => {
    const db = fakeD1()
    const head = `Job description (5000 characters): ${'Senior PM, data platform. '.repeat(9).slice(0, 240).trim()}…`
    const id = await seed(db, { kind: 'fit', question: head, answer: '**Covered**\n- None' })
    await send(post({ id, ...poor, addToQuestions: true }), db)
    expect(questions(db)[0]).toMatchObject({ reason: 'rated', question: head })
  })

  it('carries the answer\'s time, so it expires with the answer and not 90 days after the rating', async () => {
    const db = fakeD1()
    const store = new D1AskStore(db)
    const asked = NOW
    const id = await seed(db, { ts: asked })
    vi.setSystemTime(asked + 89 * day)
    await send(post({ id, ...poor, addToQuestions: true }), db)
    expect(await store.questions(0, 10)).toHaveLength(1)
    await store.prune(asked + 91 * day - 90 * day)
    expect(await store.questions(0, 10)).toHaveLength(0)
    expect(await store.ratings('2000-01-01')).toMatchObject([{ logId: null, note: null, questionId: null, overall: 2 }])
  })
})
