// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../_lib/env'
import { CostStore, DAILY_ROWS, MAX_BUDGETS } from '../_lib/costs/store'
import type { CostsAnswer } from '../_lib/costs/views'
import { context, fakeD1, type FakeD1 } from '../_lib/testing/d1'
import * as costs from './costs'
import { onRequestGet, onRequestPost } from './costs'
import * as budget from './costs/budget'
import { onRequestGet as askAdmin } from './ask/admin'
import { onRequestGet as mcpGet } from './mcp'
import { onRequestGet as resumeGet } from './resume'
import { onRequestGet as statsGet } from './stats'
import { onRequestGet as teamGet, onRequestPost as teamPost } from './team'

// POST /api/costs (the ingest), GET /api/costs and POST /api/costs/budget, on an in-memory D1
// with every migration applied (0013_dev_costs.sql included).
const admin = 'admin-secret'
const ingest = 'i'.repeat(40)
const url = 'https://steven.wilssens.com/api/costs'
const session = '11eaf387-9864-4c17-aeb5-bc210ba44e2b'
const NOW = Date.now()
const row = (extra: Record<string, unknown> = {}) => ({ branch: 'dev-costs', role: 'senior-developer', batch: 1, batchAt: NOW - 5000, model: 'claude-opus-5-5', input: 0, output: 1000, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, ...extra })
const local = (extra: Record<string, unknown> = {}) => ({ v: 1, source: 'local', session, startedAt: NOW - 10_000, endedAt: NOW - 1000, billing: 'estimated', rows: [row()], ...extra })
const github = (extra: Record<string, unknown> = {}) => ({ v: 1, source: 'github', workflow: 'review', job: 'team', runId: 100, runAttempt: 1, branch: 'dev-costs', pr: 61, billing: 'billed', costMicro: 1_500_000, numTurns: 16, durationMs: 60_000, endedAt: NOW - 1000, ...extra })
const env = (db: FakeD1, extra: Partial<Env> = {}) => ({ DB: db, ADMIN_TOKEN: admin, COSTS_INGEST_TOKEN: ingest, ...extra }) as Env
const postRequest = (body: unknown, headers: Record<string, string> = { Authorization: `Bearer ${ingest}`, 'Content-Type': 'application/json' }, at = url) =>
  new Request(at, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
const send = (request: Request, db: FakeD1, extra?: Partial<Env>) => onRequestPost(context(request, env(db, extra)).ctx)
const read = (db: FakeD1, token = admin, extra?: Partial<Env>) => onRequestGet(context(new Request(url, { headers: { Authorization: `Bearer ${token}` } }), env(db, extra)).ctx)
const setBudget = (db: FakeD1, body: unknown, token = admin) => budget.onRequestPost(context(new Request(`${url}/budget`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env(db)).ctx)
const stored = (db: FakeD1) => db.sqlite.prepare('SELECT run_key, branch, batch, role, model, output_tokens, reported_micro, billing, ended_at FROM dev_cost_runs ORDER BY id').all()
const answerOf = async (response: Response) => (await response.json()) as CostsAnswer

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('POST /api/costs refuses first and reads later', () => {
  it('answers 401 before reading the body or touching D1: no token, a wrong one, another scheme, the token in the query or a cookie, the admin token', async () => {
    const db = fakeD1()
    const attempts: [Record<string, string>, string][] = [
      [{}, url], [{ Authorization: 'Bearer wrong' }, url], [{ Authorization: `Basic ${ingest}` }, url], [{ Authorization: ingest }, url],
      [{}, `${url}?token=${ingest}`], [{ Cookie: `token=${ingest}` }, url], [{ Authorization: `Bearer ${admin}` }, url],
    ]
    for (const [headers, at] of attempts) {
      const request = postRequest(local(), { ...headers, 'Content-Type': 'application/json' }, at)
      const answer = await send(request, db)
      expect(answer.status).toBe(401)
      expect(await answer.text()).toBe('{"error":"unauthorized"}')
      expect(request.bodyUsed).toBe(false)
    }
    expect(db.queries).toHaveLength(0)
  })

  it('answers 503 when the secret is unset, shorter than 32 characters or the admin token', async () => {
    const db = fakeD1()
    for (const secret of [undefined, '', 'x'.repeat(31), admin.padEnd(32, 'x')]) {
      const extra = { COSTS_INGEST_TOKEN: secret, ADMIN_TOKEN: admin.padEnd(32, 'x') }
      const answer = await send(postRequest(local(), { Authorization: `Bearer ${secret ?? ''}`, 'Content-Type': 'application/json' }), db, extra)
      expect(answer.status).toBe(503)
      expect(await answer.json()).toEqual({ error: 'not configured' })
    }
    expect(db.queries).toHaveLength(0)
  })

  it('is refused on a pages.dev preview, which shares the production database', async () => {
    const db = fakeD1()
    for (const host of ['https://dev-costs.stevenwilssens.pages.dev/api/costs', 'https://stevenwilssens.pages.dev/api/costs']) {
      expect((await send(postRequest(local(), undefined, host), db)).status).toBe(403)
    }
    expect(db.queries).toHaveLength(0)
  })

  it('exports GET and POST only, so PUT, DELETE and the rest are not routed', () => {
    expect(Object.keys(costs).filter((name) => name.startsWith('onRequest')).sort()).toEqual(['onRequestGet', 'onRequestPost'])
    expect(Object.keys(budget).filter((name) => name.startsWith('onRequest'))).toEqual(['onRequestPost'])
  })

  it('answers 415 for anything but JSON and 413 over 16 KB, by Content-Length and by the bytes read', async () => {
    const db = fakeD1()
    expect((await send(postRequest(local(), { Authorization: `Bearer ${ingest}`, 'Content-Type': 'text/plain' }), db)).status).toBe(415)
    const big = JSON.stringify({ ...local(), pad: 'x'.repeat(16 * 1024) })
    expect((await send(postRequest(big), db)).status).toBe(413)
    const lying = postRequest(local(), { Authorization: `Bearer ${ingest}`, 'Content-Type': 'application/json', 'Content-Length': '20000' })
    expect((await send(lying, db)).status).toBe(413)
    expect(lying.bodyUsed).toBe(false)
    const streamed = new Request(url, {
      method: 'POST', headers: { Authorization: `Bearer ${ingest}`, 'Content-Type': 'application/json' }, duplex: 'half',
      body: new ReadableStream({ start(controller) { for (let i = 0; i < 17; i++) controller.enqueue(new TextEncoder().encode('x'.repeat(1024))); controller.close() } }),
    } as RequestInit)
    expect((await send(streamed, db)).status).toBe(413)
    expect((await send(new Request(url, { method: 'POST', headers: { Authorization: `Bearer ${ingest}`, 'Content-Type': 'application/json' } }), db)).status).toBe(400)
    expect(db.queries).toHaveLength(0)
  })

  it('answers every malformed body with the same 400 that echoes nothing, writes nothing and logs no body', async () => {
    const db = fakeD1()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const marker = '"><img src=x onerror=alert(1)>'
    for (const body of [local({ rows: [row({ branch: marker })] }), local({ runKey: 'local:x' }), github({ workflow: 'review', job: 'update' }), github({ models: [{ model: 'claude-opus-5-5' }] }), github({ input: 5 }), 'nope', github({ costMicro: -1 })]) {
      const answer = await send(postRequest(body), db)
      expect(answer.status).toBe(400)
      expect(await answer.text()).toBe('{"error":"invalid"}')
    }
    expect(db.queries).toHaveLength(0)
    expect(log).not.toHaveBeenCalled()
  })

  it('sends no CORS header and no-store on every answer, errors included', async () => {
    const db = fakeD1()
    const failing = fakeD1()
    failing.failOn = /dev_cost/
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const answers = [await send(postRequest(local()), db), await send(postRequest(local()), db, { COSTS_INGEST_TOKEN: undefined }), await send(postRequest('x'), db), await send(postRequest(local()), failing), await read(db), await read(db, ingest), await read(failing), await setBudget(db, { branch: 'x', amountUsd: 1 })]
    expect(answers.map((answer) => answer.status)).toEqual([200, 503, 400, 500, 200, 401, 500, 200])
    for (const answer of answers) {
      expect(answer.headers.get('Cache-Control')).toBe('no-store')
      expect([...answer.headers.keys()].filter((name) => name.startsWith('access-control-'))).toEqual([])
    }
    // The error's class only, never what was sent.
    expect(log.mock.calls.map((call) => call.join(' '))).toEqual(['costs ingest failed: Error', 'costs read failed: Error'])
  })
})

describe('the ingest writes upserts', () => {
  it('builds the run key itself and stores a GitHub run as one row with its reported cost', async () => {
    const db = fakeD1()
    expect((await send(postRequest(github()), db)).status).toBe(200)
    expect(stored(db)).toEqual([{ run_key: 'github:100:1:team', branch: 'dev-costs', batch: 0, role: 'review-workflow', model: 'reported', output_tokens: 0, reported_micro: 1_500_000, billing: 'billed', ended_at: NOW - 1000 }])
  })

  it('gives the same rows for the same body twice, new rows for attempt 2', async () => {
    const db = fakeD1()
    await send(postRequest(github()), db)
    await send(postRequest(github()), db)
    expect(stored(db)).toHaveLength(1)
    await send(postRequest(github({ runAttempt: 2 })), db)
    expect(stored(db).map((item) => item.run_key)).toEqual(['github:100:1:team', 'github:100:2:team'])
  })

  it('replaces a resumed session’s totals (never their sum), adds its new rows, and ignores an older body sent late', async () => {
    const db = fakeD1()
    await send(postRequest(local()), db)
    await send(postRequest(local({ endedAt: NOW, rows: [row({ output: 2500 }), row({ branch: 'fix-x', batch: 2, output: 10 })] })), db)
    expect(stored(db).map((item) => [item.branch, item.output_tokens])).toEqual([['dev-costs', 2500], ['fix-x', 10]])
    // The first post, left in a queue and sent again after the second: nothing changes.
    await send(postRequest(local()), db)
    expect(stored(db).map((item) => [item.branch, item.output_tokens])).toEqual([['dev-costs', 2500], ['fix-x', 10]])
  })

  it('refuses a body that would take the day past its cap with 429, writing none of it', async () => {
    // One clock for the whole test, so it cannot straddle UTC midnight.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    const db = fakeD1()
    const today = Date.now()
    const insert = db.sqlite.prepare("INSERT INTO dev_cost_runs (source, run_key, branch, role, batch, batch_at, model, billing, started_at, ended_at, received_at) VALUES ('local', ?, 'x', 'lead', 0, 1, 'm', 'estimated', 1, 1, ?)")
    for (let i = 0; i < DAILY_ROWS - 1; i++) insert.run(`local:${i}`, today)
    const two = local({ rows: [row(), row({ batch: 2 })] })
    const answer = await send(postRequest(two), db)
    expect(answer.status).toBe(429)
    expect(await answer.json()).toEqual({ error: 'daily limit' })
    expect((stored(db) as unknown[]).length).toBe(DAILY_ROWS - 1)
    expect((await send(postRequest(local()), db)).status).toBe(200)
  })

  it('has no round and no phase column', () => {
    const db = fakeD1()
    const names = (db.sqlite.prepare('PRAGMA table_info(dev_cost_runs)').all() as { name: string }[]).map((column) => column.name)
    expect(names.filter((name) => /round|phase/.test(name))).toEqual([])
  })
})

describe('GET /api/costs', () => {
  it('is the admin’s only: the ingest token and every other token are refused', async () => {
    const db = fakeD1()
    for (const token of [ingest, '', 'wrong']) expect((await read(db, token)).status).toBe(401)
    expect(db.queries).toHaveLength(0)
  })

  it('answers an empty database with the five views and the no-data flag', async () => {
    const answer = await answerOf(await read(fakeD1()))
    expect(answer).toMatchObject({ empty: true, features: [], waste: { fix: { billed: 0 } } })
    expect(answer.months).toHaveLength(12)
    expect(answer.roles).toHaveLength(9)
  })

  it('prices local rows now, keeps no session id, and asks GitHub only for the states', async () => {
    const db = fakeD1()
    await send(postRequest(local({ rows: [row(), row({ batch: 2, model: 'claude-x-1' })] })), db)
    await send(postRequest(github()), db)
    const sha = 'c'.repeat(40)
    const fetch = vi.fn(async () => Response.json([{ number: 61, title: 't', html_url: 'u', head: { ref: 'dev-costs' }, state: 'closed', merged_at: '2026-10-18', merge_commit_sha: sha, body: null, created_at: 'x' }]))
    vi.stubGlobal('fetch', fetch)
    const response = await read(db, admin, { GITHUB_TOKEN: 'ghp_test' })
    const text = await response.clone().text()
    expect(text).not.toContain(session)
    expect(text).not.toContain(ingest)
    expect(text).not.toContain('ghp_test')
    const answer = await answerOf(response)
    const [feature] = answer.features
    expect(feature.total).toEqual({ billed: 1_500_000, estimated: 20_000, unknown: 0, unpriced: [{ model: 'claude-x-1', tokens: 1000 }] })
    expect(feature.pull).toEqual({ state: 'merged', number: 61, mergeCommit: sha, supersededBy: null })
    expect(String(fetch.mock.calls[0])).toContain('/repos/stewils/stevenwilssens.com/pulls?state=all&per_page=100&page=1')
  })

  it('says every state is unknown when GitHub fails or there is no token, and the rest stands', async () => {
    const db = fakeD1()
    await send(postRequest(local()), db)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad gateway', { status: 502 })))
    for (const extra of [{ GITHUB_TOKEN: 'ghp_test', GITHUB_REPO: 'someone/fork' }, {}, { GITHUB_TOKEN: 'ghp_test', GITHUB_REPO: 'not a repo' }]) {
      const answer = await answerOf(await read(db, admin, extra))
      expect(answer.features[0].pull?.state).toBe('unknown')
      expect(answer.features[0].total.estimated).toBe(20_000)
    }
    const fetch = vi.mocked(globalThis.fetch)
    expect(String(fetch.mock.calls[0][0])).toContain('/repos/someone/fork/')
    expect(String(fetch.mock.calls[1][0])).toContain('/repos/stewils/stevenwilssens.com/')
  })

  it('marks a closed pull request superseded when another one’s site-update marker names it, and counts it as redone', async () => {
    const db = fakeD1()
    await send(postRequest(github({ pr: 54 })), db)
    const marker = `<!-- site-update-request ${btoa(JSON.stringify({ title: 'Redo', instruction: 'x', proposals: [], supersedes: 54 }))} -->`
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([
      { number: 54, title: 'first', html_url: 'u', head: { ref: 'dev-costs' }, state: 'closed', merged_at: null, merge_commit_sha: null, body: null, created_at: 'x' },
      { number: 56, title: 'redo', html_url: 'u', head: { ref: 'update/redo-56' }, state: 'open', merged_at: null, merge_commit_sha: null, body: marker, created_at: 'x' },
    ])))
    const answer = await answerOf(await read(db, admin, { GITHUB_TOKEN: 'ghp_test' }))
    const [feature] = answer.features
    expect(feature.pull).toEqual({ state: 'superseded', number: 54, mergeCommit: null, supersededBy: 56 })
    expect(feature.waste).toMatchObject({ closed: true, redoneBy: 56 })
    expect(answer.waste.closed.billed).toBe(1_500_000)
  })

  it('reads the newest rows when there are more than it reads, in order', async () => {
    const db = fakeD1()
    for (const batchAt of [3, 1, 2].map((n) => NOW - n * 60_000)) await send(postRequest(local({ rows: [row({ batch: Math.round((NOW - batchAt) / 60_000), batchAt })] })), db)
    const rows = await new CostStore(db).rows(2)
    expect(rows.map((item) => item.batch)).toEqual([2, 1])
    expect((await new CostStore(db).rows()).map((item) => item.batch)).toEqual([3, 2, 1])
  })

  it('reads a later price for an old row: local rows are priced when read', async () => {
    const db = fakeD1()
    await send(postRequest(local({ rows: [row({ model: 'claude-opus-4-8' })] })), db)
    const answer = await answerOf(await read(db))
    expect(answer.features[0].total.estimated).toBe(25_000)
  })
})

describe('POST /api/costs/budget', () => {
  it('sets, changes and removes a budget, which the next read shows', async () => {
    const db = fakeD1()
    await send(postRequest(local()), db)
    expect(await (await setBudget(db, { branch: 'dev-costs', amountUsd: 10 })).json()).toEqual({ branch: 'dev-costs', budgetMicro: 10_000_000 })
    expect(await (await setBudget(db, { branch: 'dev-costs', amountUsd: 1000 })).json()).toEqual({ branch: 'dev-costs', budgetMicro: 1_000_000_000 })
    expect((await answerOf(await read(db))).features[0].budgetMicro).toBe(1_000_000_000)
    expect(await (await setBudget(db, { branch: 'dev-costs', amountUsd: null })).json()).toEqual({ branch: 'dev-costs', budgetMicro: null })
    expect((await answerOf(await read(db))).features[0].budgetMicro).toBeNull()
  })

  it('refuses everyone but the admin, and every malformed budget with a fixed body', async () => {
    const db = fakeD1()
    expect((await setBudget(db, { branch: 'x', amountUsd: 1 }, ingest)).status).toBe(401)
    for (const body of [{ branch: 'x', amountUsd: 0 }, { branch: 'x', amountUsd: -1 }, { branch: 'x', amountUsd: 1000.01 }, { branch: 'x', amountUsd: '10' }, { branch: 'a..b', amountUsd: 1 }, { branch: 'main', amountUsd: 1 }, { branch: 'x' }, { branch: 'x', amountUsd: 1, extra: 1 }, 'nope', [], null]) {
      const answer = await setBudget(db, body)
      expect(answer.status).toBe(400)
      expect(await answer.text()).toBe('{"error":"invalid"}')
    }
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM dev_cost_budgets').get()).toEqual({ n: 0 })
    const request = new Request(`${url}/budget`, { method: 'POST', headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'text/plain' }, body: '{}' })
    expect((await budget.onRequestPost(context(request, env(db)).ctx)).status).toBe(415)
    const big = new Request(`${url}/budget`, { method: 'POST', headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' }, body: 'x'.repeat(5000) })
    expect((await budget.onRequestPost(context(big, env(db)).ctx)).status).toBe(413)
  })

  it('refuses the 501st budget, but still changes one that exists', async () => {
    const db = fakeD1()
    const insert = db.sqlite.prepare('INSERT INTO dev_cost_budgets (branch, budget_micro, updated_at) VALUES (?, 1, 1)')
    for (let i = 0; i < MAX_BUDGETS; i++) insert.run(`b-${i}`)
    const full = await setBudget(db, { branch: 'one-more', amountUsd: 5 })
    expect(full.status).toBe(400)
    expect(await full.json()).toEqual({ error: 'too many budgets' })
    expect((await setBudget(db, { branch: 'b-1', amountUsd: 5 })).status).toBe(200)
  })

  it('answers 500 with a fixed body when D1 fails', async () => {
    const db = fakeD1()
    db.failOn = /dev_cost_budgets/
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const answer = await setBudget(db, { branch: 'x', amountUsd: 1 })
    expect(answer.status).toBe(500)
    expect(await answer.json()).toEqual({ error: 'unavailable' })
  })
})

describe('the ingest token opens nothing else', () => {
  it('is refused by every admin route', async () => {
    const db = fakeD1()
    const headers = { Authorization: `Bearer ${ingest}` }
    const at = (path: string) => new Request(`https://steven.wilssens.com${path}`, { headers })
    const routes = [
      () => statsGet(context(at('/api/stats?days=7'), env(db)).ctx),
      () => teamGet(context(at('/api/team'), env(db)).ctx),
      () => teamPost(context(new Request('https://steven.wilssens.com/api/team', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' }), env(db)).ctx),
      () => resumeGet(context(at('/api/resume'), env(db)).ctx),
      () => askAdmin(context(at('/api/ask/admin'), env(db)).ctx),
      () => mcpGet(context(at('/api/mcp'), env(db)).ctx),
      () => read(db, ingest),
      () => setBudget(db, { branch: 'x', amountUsd: 1 }, ingest),
    ]
    for (const route of routes) expect((await route()).status).toBe(401)
  })
})
