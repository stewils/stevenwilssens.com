// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../_lib/env'
import { resetTeamReads, TeamReads } from '../_lib/team-reads'
import { context, fakeD1, type FakeD1 } from '../_lib/testing/d1'
import * as team from './team'
import { onRequestGet, onRequestPost, parseTeamRequest } from './team'

// GET and POST /api/team against an in-memory D1 with every migration applied.
const token = 'admin-secret'
const url = 'https://steven.wilssens.com/api/team'
const id = (digit: string) => digit.repeat(40)
const auth = { Authorization: `Bearer ${token}` }
const get = (headers: Record<string, string> = auth, at = url) => new Request(at, { headers })
const postRequest = (body: unknown, headers: Record<string, string> = { ...auth, 'Content-Type': 'application/json' }, at = url) =>
  new Request(at, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
const env = (db: FakeD1, extra: Partial<Env> = {}) => ({ DB: db, ADMIN_TOKEN: token, ...extra }) as Env
const sendGet = (request: Request, db: FakeD1, extra?: Partial<Env>) => onRequestGet(context(request, env(db, extra)).ctx)
const sendPost = (request: Request, db: FakeD1, extra?: Partial<Env>) => onRequestPost(context(request, env(db, extra)).ctx)
const body = async (response: Response) => (await response.json()) as { read: string[]; unread: string[] }

afterEach(() => { vi.restoreAllMocks(); resetTeamReads() })

describe('/api/team refuses everyone but Steven', () => {
  it('answers 401 before touching D1 or the body: no token, a wrong one, another scheme, the token in the query or a cookie, or no ADMIN_TOKEN set', async () => {
    const db = fakeD1()
    const attempts: [Record<string, string>, string, Partial<Env>?][] = [
      [{}, url],
      [{ Authorization: 'Bearer wrong' }, url],
      [{ Authorization: `Basic ${token}` }, url],
      [{}, `${url}?token=${token}`],
      [{ Cookie: `token=${token}; ADMIN_TOKEN=${token}` }, url],
      [auth, url, { ADMIN_TOKEN: undefined }],
    ]
    for (const [headers, at, extra] of attempts) {
      const read = await sendGet(get(headers, at), db, extra)
      expect(read.status).toBe(401)
      const request = postRequest({ action: 'read', ids: [id('a')] }, { ...headers, 'Content-Type': 'application/json' }, at)
      const bodyRead = vi.spyOn(request, 'text')
      const write = await sendPost(request, db, extra)
      expect(write.status).toBe(401)
      expect(bodyRead).not.toHaveBeenCalled()
      expect(request.bodyUsed).toBe(false)
    }
    expect(db.queries).toHaveLength(0)
  })

  it('exports only GET and POST, so every other method is not routed', () => {
    expect(Object.keys(team).filter((name) => name.startsWith('onRequest')).sort()).toEqual(['onRequestGet', 'onRequestPost'])
  })

  it('sends no CORS header and no cookie, and no-store on every answer, errors included', async () => {
    const db = fakeD1()
    const failing = fakeD1()
    failing.failOn = /team_reads/
    const answers = [
      await sendGet(get(), db),
      await sendGet(get({}), db),
      await sendPost(postRequest({ action: 'read', ids: [id('a')] }), db),
      await sendPost(postRequest('nope'), db),
      await sendPost(postRequest('{}', { ...auth, 'Content-Type': 'text/plain' }), db),
      await sendPost(postRequest('x'.repeat(17 * 1024)), db),
      await sendGet(get(), failing),
    ]
    expect(answers.map((answer) => answer.status)).toEqual([200, 401, 200, 400, 415, 413, 500])
    for (const answer of answers) {
      expect(answer.headers.get('Cache-Control')).toBe('no-store')
      expect(answer.headers.get('Set-Cookie')).toBeNull()
      expect([...answer.headers.keys()].filter((name) => name.toLowerCase().startsWith('access-control-'))).toEqual([])
    }
  })
})

describe('POST /api/team checks what it is sent', () => {
  it('answers 415 for anything but JSON, form encodings included', async () => {
    const db = fakeD1()
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', '']) {
      const headers: Record<string, string> = type ? { ...auth, 'Content-Type': type } : { ...auth }
      const answer = await sendPost(new Request(url, { method: 'POST', headers, body: JSON.stringify({ action: 'read', ids: [id('a')] }) }), db)
      expect(answer.status).toBe(415)
    }
    expect((await sendPost(postRequest({ action: 'read', ids: [id('a')] }, { ...auth, 'Content-Type': 'Application/JSON; charset=utf-8' }), db)).status).toBe(200)
  })

  it('answers 413 for a body over 16 KB, by its Content-Length and by the bytes actually read', async () => {
    const db = fakeD1()
    const big = JSON.stringify({ action: 'read', ids: [id('a')], pad: 'x'.repeat(17 * 1024) })
    expect((await sendPost(postRequest(big, { ...auth, 'Content-Type': 'application/json', 'Content-Length': String(big.length) }), db)).status).toBe(413)
    const streamed = new Request(url, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: new ReadableStream({ start(controller) { for (let i = 0; i < 20; i++) controller.enqueue(new TextEncoder().encode('x'.repeat(1024))); controller.close() } }),
      duplex: 'half',
    } as RequestInit)
    expect((await sendPost(streamed, db)).status).toBe(413)
    expect(db.queries).toHaveLength(0)
  })

  it('answers 413 from a Content-Length over 16 KB before reading the body, even when the body is small', async () => {
    const db = fakeD1()
    const small = postRequest({ action: 'read', ids: [id('a')] }, { ...auth, 'Content-Type': 'application/json', 'Content-Length': '20000' })
    expect(small.headers.get('Content-Length')).toBe('20000')
    const read = vi.spyOn(small, 'text')
    const response = await sendPost(small, db)
    expect(response.status).toBe(413)
    expect(small.bodyUsed).toBe(false)
    expect(read).not.toHaveBeenCalled()
    expect(db.queries).toHaveLength(0)
  })

  it('answers 400 with a fixed body that echoes nothing for every malformed request', async () => {
    const db = fakeD1()
    const bad: string[] = [
      'not json',
      'null',
      '[]',
      '"read"',
      JSON.stringify({ action: 'forget', ids: [id('a')] }),
      JSON.stringify({ action: 'read', ids: [id('a')], extra: 1 }),
      JSON.stringify({ action: 'read' }),
      JSON.stringify({ ids: [id('a')], other: 'read' }),
      JSON.stringify({ action: 'read', ids: [] }),
      JSON.stringify({ action: 'read', ids: id('a') }),
      JSON.stringify({ action: 'read', ids: Array.from({ length: 201 }, (_, index) => index.toString(16).padStart(40, '0')) }),
      JSON.stringify({ action: 'read', ids: ['a'.repeat(39)] }),
      JSON.stringify({ action: 'read', ids: ['a'.repeat(41)] }),
      JSON.stringify({ action: 'read', ids: ['A'.repeat(40)] }),
      JSON.stringify({ action: 'read', ids: ['g'.repeat(40)] }),
      JSON.stringify({ action: 'read', ids: [42] }),
      JSON.stringify({ action: 7, ids: [id('a')] }),
      JSON.stringify({ action: 'read', ids: ["'; DROP TABLE team_reads; --"] }),
      '{"__proto__": {"x": 1}, "action": "read", "ids": ["' + id('a') + '"]}',
    ]
    for (const text of bad) {
      const answer = await sendPost(postRequest(text), db)
      expect(answer.status).toBe(400)
      const raw = await answer.text()
      expect(raw).toBe('{"error":"bad request"}')
    }
    expect(db.queries).toHaveLength(0)
  })

  it('takes exactly { action, ids } and de-duplicates the ids', () => {
    expect(parseTeamRequest(JSON.stringify({ ids: [id('a'), id('a'), id('b')], action: 'readAll' }))).toEqual({ action: 'readAll', ids: [id('a'), id('b')] })
  })
})

describe('the read state, kept in D1', () => {
  it('read, unread and readAll upsert by id with read = 1 or 0, and answer the state', async () => {
    const db = fakeD1()
    const first = await sendPost(postRequest({ action: 'readAll', ids: [id('a'), id('b'), id('c')] }), db)
    expect(first.status).toBe(200)
    expect((await body(first)).read.sort()).toEqual([id('a'), id('b'), id('c')])
    const after = await body(await sendPost(postRequest({ action: 'unread', ids: [id('b')] }), db))
    expect(after.unread).toEqual([id('b')])
    expect(after.read.sort()).toEqual([id('a'), id('c')])
    expect(db.sqlite.prepare('SELECT id, read FROM team_reads ORDER BY id').all().map((row) => ({ ...row }))).toEqual([{ id: id('a'), read: 1 }, { id: id('b'), read: 0 }, { id: id('c'), read: 1 }])
  })

  it('an id marked read on one request is read on the next GET, and unread likewise (another device)', async () => {
    const db = fakeD1()
    await sendPost(postRequest({ action: 'read', ids: [id('a')] }), db)
    expect(await body(await sendGet(get(), db))).toEqual({ read: [id('a')], unread: [] })
    await sendPost(postRequest({ action: 'unread', ids: [id('a')] }), db)
    expect(await body(await sendGet(get(), db))).toEqual({ read: [], unread: [id('a')] })
    await sendPost(postRequest({ action: 'read', ids: [id('a')] }), db)
    expect(await body(await sendGet(get(), db))).toEqual({ read: [id('a')], unread: [] })
  })

  it('stores unread for an id it has never seen (a change from before the launch)', async () => {
    const db = fakeD1()
    const answer = await body(await sendPost(postRequest({ action: 'unread', ids: [id('d')] }), db))
    expect(answer).toEqual({ read: [], unread: [id('d')] })
  })

  it('marking twice keeps one row with the first read time, and repeating a request gives the same body', async () => {
    const db = fakeD1()
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const once = await (await sendPost(postRequest({ action: 'read', ids: [id('a'), id('b')] }), db)).text()
    vi.spyOn(Date, 'now').mockReturnValue(2000)
    const twice = await (await sendPost(postRequest({ action: 'read', ids: [id('a'), id('b')] }), db)).text()
    expect(twice).toBe(once)
    expect(db.sqlite.prepare('SELECT id, at FROM team_reads ORDER BY id').all().map((row) => ({ ...row }))).toEqual([{ id: id('a'), at: 1000 }, { id: id('b'), at: 1000 }])
    const unreadOnce = await (await sendPost(postRequest({ action: 'unread', ids: [id('a')] }), db)).text()
    const unreadTwice = await (await sendPost(postRequest({ action: 'unread', ids: [id('a')] }), db)).text()
    expect(unreadTwice).toBe(unreadOnce)
  })

  it('answers only read and unread ids', async () => {
    const db = fakeD1()
    await sendPost(postRequest({ action: 'read', ids: [id('a')] }), db)
    expect(Object.keys(await body(await sendGet(get(), db))).sort()).toEqual(['read', 'unread'])
  })

  it('fails closed: a database that throws answers 500 unavailable, without the SQL, and logs no headers', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = fakeD1()
    db.failOn = /team_reads/
    for (const answer of [await sendGet(get(), db), await sendPost(postRequest({ action: 'read', ids: [id('a')] }), db)]) {
      expect(answer.status).toBe(500)
      expect(await answer.text()).toBe('{"error":"unavailable"}')
    }
    expect(JSON.stringify(log.mock.calls)).not.toContain(token)
    expect(log).toHaveBeenCalledWith('team reads failed:', 'D1_ERROR: forced failure')
    log.mockClear()
    const odd = fakeD1()
    odd.prepare = (() => { throw 'not an error' }) as unknown as D1Database['prepare']
    expect((await sendGet(get(), odd)).status).toBe(500)
    expect(log).toHaveBeenCalledWith('team reads failed:', 'unknown error')
  })

  it('a failing write answers 500 and reports nothing as saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = fakeD1()
    await new TeamReads(db).ensure()
    db.failOn = /INSERT INTO team_reads/
    expect((await sendPost(postRequest({ action: 'read', ids: [id('a')] }), db)).status).toBe(500)
    db.failOn = undefined
    expect(await body(await sendGet(get(), db))).toEqual({ read: [], unread: [] })
  })
})

describe('the team_reads table', () => {
  it('refuses an id that is not 40 lower-case hex, and a read that is not 0 or 1', () => {
    const db = fakeD1()
    const insert = (row: string, read: number) => () => db.sqlite.prepare('INSERT INTO team_reads (id, read, at) VALUES (?, ?, 1)').run(row, read)
    expect(insert('A'.repeat(40), 1)).toThrow(/CHECK/)
    expect(insert('z'.repeat(40), 1)).toThrow(/CHECK/)
    expect(insert('a'.repeat(39), 1)).toThrow(/CHECK/)
    expect(insert('a'.repeat(40), 2)).toThrow(/CHECK/)
    expect(insert('a'.repeat(40), 1)).not.toThrow()
  })

  it('is created on first use when the migration was not applied', async () => {
    const db = fakeD1()
    db.sqlite.exec('DROP TABLE team_reads')
    expect(await body(await sendGet(get(), db))).toEqual({ read: [], unread: [] })
    expect(db.queries[0]).toMatch(/^CREATE TABLE IF NOT EXISTS team_reads/)
  })

  it('tries to create it again after a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = fakeD1()
    db.failOn = /CREATE TABLE/
    expect((await sendGet(get(), db)).status).toBe(500)
    db.failOn = undefined
    expect((await sendGet(get(), db)).status).toBe(200)
  })
})
