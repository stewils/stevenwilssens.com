// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isBranch, MAX_ROWS, parseIngest, runKeyOf } from './ingest'

const NOW = Date.UTC(2026, 9, 19, 12)
const session = '11eaf387-9864-4c17-aeb5-bc210ba44e2b'
const row = (extra: Record<string, unknown> = {}) => ({ branch: 'dev-costs', role: 'senior-developer', batch: 3, batchAt: NOW - 1000, model: 'claude-opus-5-5', input: 12, output: 3400, cacheRead: 910000, cacheWrite5m: 0, cacheWrite1h: 31249, ...extra })
const local = (extra: Record<string, unknown> = {}) => ({ v: 1, source: 'local', session, startedAt: NOW - 5000, endedAt: NOW, billing: 'estimated', rows: [row()], ...extra })
const github = (extra: Record<string, unknown> = {}) => ({ v: 1, source: 'github', workflow: 'review', job: 'team', runId: 39349674556, runAttempt: 1, branch: 'dev-costs', pr: 61, billing: 'billed', costMicro: 5645206, numTurns: 16, durationMs: 418786, endedAt: NOW, ...extra })
const parse = (body: unknown) => parseIngest(typeof body === 'string' ? body : JSON.stringify(body), NOW)

describe('the ingest accepts exactly the two documented shapes', () => {
  it('takes a local session and a GitHub run, and builds their run keys itself', () => {
    const localBody = parse(local())!
    expect(localBody).toEqual({ source: 'local', session, startedAt: NOW - 5000, endedAt: NOW, billing: 'estimated', rows: [row()] })
    expect(runKeyOf(localBody)).toBe(`local:${session}`)
    const githubBody = parse(github())!
    expect(githubBody).toMatchObject({ source: 'github', workflow: 'review', job: 'team', pr: 61 })
    expect(runKeyOf(githubBody)).toBe('github:39349674556:1:team')
    const { pr: _pr, ...withoutPr } = github({ workflow: 'site-update', job: 'update', branch: 'update/x-12' })
    expect(parse(withoutPr)).toMatchObject({ workflow: 'site-update', job: 'update', pr: null })
  })

  it('accepts every cap at its value', () => {
    expect(parse(local({ rows: Array.from({ length: MAX_ROWS }, (_, batch) => row({ batch })) }))).not.toBeNull()
    expect(parse(local({ rows: [row({ input: 1e10, output: 1e10, cacheRead: 1e10, cacheWrite5m: 1e10, cacheWrite1h: 1e10, batch: 10_000 })] }))).not.toBeNull()
    expect(parse(github({ numTurns: 10_000, durationMs: 86_400_000, costMicro: 1e9, pr: 1e6, runId: 1e13, runAttempt: 100 }))).not.toBeNull()
    expect(parse(local({ startedAt: Date.UTC(2026, 0, 1), endedAt: NOW + 86_400_000 }))).not.toBeNull()
    expect(parse(local({ rows: [row({ model: 'claude-opus-5-5:fast', role: 'unknown-agent', branch: 'feature/x' })] }))).not.toBeNull()
    expect(parse(local({ billing: 'unknown' }))).not.toBeNull()
  })

  it('refuses one above every cap, and numbers that are not whole', () => {
    const refused: unknown[] = [
      local({ rows: Array.from({ length: MAX_ROWS + 1 }, (_, batch) => row({ batch })) }),
      local({ rows: [] }),
      local({ rows: row() }),
      ...['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'].flatMap((kind) => [local({ rows: [row({ [kind]: 1e10 + 1 })] }), local({ rows: [row({ [kind]: -1 })] }), local({ rows: [row({ [kind]: 1.5 })] }), local({ rows: [row({ [kind]: '5' })] })]),
      local({ rows: [row({ batch: 10_001 })] }),
      github({ numTurns: 10_001 }), github({ durationMs: 86_400_001 }), github({ costMicro: 1e9 + 1 }), github({ costMicro: -1 }), github({ costMicro: 2.5 }),
      github({ pr: 1e6 + 1 }), github({ pr: 0 }), github({ runId: 1e13 + 1 }), github({ runId: 0 }), github({ runAttempt: 101 }), github({ runAttempt: 0 }),
      '{"v":1,"source":"github","workflow":"review","job":"team","runId":1,"runAttempt":1,"branch":"x","billing":"billed","costMicro":1e309,"numTurns":1,"durationMs":1,"endedAt":' + NOW + '}',
    ]
    for (const body of refused) expect(parse(body), JSON.stringify(body).slice(0, 120)).toBeNull()
  })

  it('refuses unknown or missing keys at every level, __proto__ included', () => {
    const { rows: _rows, ...noRows } = local()
    const { costMicro: _cost, ...noCost } = github()
    const refused: unknown[] = [
      local({ extra: 1 }), noRows, github({ extra: 1 }), noCost,
      local({ rows: [row({ extra: 1 })] }), local({ rows: [{ ...row(), price: 3 }] }),
      local({ runKey: 'local:x' }), github({ runKey: 'github:1:1:team' }), github({ models: [] }), github({ input: 5 }),
      local({ v: 2 }), local({ source: 'other' }), null, [], 'not json', '"x"',
      `{"__proto__":{"x":1},"v":1,"source":"local","session":"${session}","startedAt":${NOW - 5000},"endedAt":${NOW},"billing":"estimated","rows":[]}`,
      `{"v":1,"source":"local","session":"${session}","startedAt":${NOW - 5000},"endedAt":${NOW},"billing":"estimated","rows":[${JSON.stringify(row()).slice(0, -1)},"__proto__":{}}]}`,
    ]
    for (const body of refused) expect(parse(body)).toBeNull()
  })

  it('refuses a job that does not belong to its workflow, an unknown workflow, source or billing', () => {
    for (const body of [github({ job: 'update' }), github({ workflow: 'site-update', job: 'team' }), github({ workflow: 'deploy' }), github({ billing: 'free' }), local({ billing: 'billed' }), local({ billing: 'free' })]) expect(parse(body)).toBeNull()
  })

  it('refuses a session that is not a UUID, times out of range and an end before the start', () => {
    for (const body of [
      local({ session: 'not-a-uuid' }), local({ session: session.toUpperCase() }),
      local({ startedAt: Date.UTC(2025, 11, 31) }), local({ endedAt: NOW + 86_400_001 }), local({ startedAt: NOW, endedAt: NOW - 1 }),
      local({ rows: [row({ batchAt: Date.UTC(2025, 11, 31) })] }), github({ endedAt: NOW + 86_400_001 }),
    ]) expect(parse(body)).toBeNull()
  })

  it('takes role and model ids only in their patterns', () => {
    expect(parse(local({ rows: [row({ model: 'a'.repeat(64) })] }))).not.toBeNull()
    for (const extra of [{ role: '<script>' }, { role: 'Senior-Developer' }, { role: 'a'.repeat(42) }, { model: 'claude opus' }, { model: 'a'.repeat(65) }, { model: '<synthetic>' }, { model: 'claude:slow' }]) {
      expect(parse(local({ rows: [row(extra)] }))).toBeNull()
    }
  })
})

describe('a branch name', () => {
  it('passes the set of characters and git’s ref rules', () => {
    for (const branch of ['dev-costs', 'feature/x', 'update/add-the-patents-12', 'a'.repeat(200), 'v1.2']) expect(isBranch(branch), branch).toBe(true)
    for (const branch of ['a'.repeat(201), 'a..b', 'a@{1}', '-x', '/x', 'x/', 'x.lock', 'a//b', 'a b', 'a\u0001b', '"><img src=x onerror=alert(1)>', '', 42]) expect(isBranch(branch), String(branch)).toBe(false)
  })
})
