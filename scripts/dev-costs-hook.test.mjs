// @vitest-environment node
// The SessionEnd hook that records what a local Claude Code session cost (.claude/hooks/dev-costs.mjs,
// specs/dev-costs.md AC-5 to AC-11 and AC-33). Every test works in its own temp folder: a fake
// ~/.claude with the fixture transcripts (scripts/fixtures/dev-costs/), a fake repository root for
// the queue, and a fetch stub that refuses any call it was not given. Nothing touches the real
// ~/.claude, the repository's queue or the network.
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendQueue, billingOf, capQueue, collect, FINISH_BY_MS, ingestUrl, isBranch, isInside, LOCK_WAIT_MS, main, MAX_BODY_BYTES, MAX_QUEUE, MAX_QUEUE_BYTES, MAX_ROWS, parseLines, payloadsOf, PRODUCTION_URL, QUEUE_FILE,
  readAgents, readQueue, SEND_FOR_MS, sendQueue, sessionPayloads, settleQueue, STALE_LOCK_MS, summarize, withQueueLock, writeQueue,
} from '../.claude/hooks/dev-costs.mjs'
import { parseIngest } from '../functions/_lib/costs/ingest.ts'

const repo = resolve(import.meta.dirname, '..')
const fixtures = join(repo, 'scripts/fixtures/dev-costs/session')
const SESSION = 'aaaaaaaa-1111-4111-8111-111111111111'
const TOKEN = 't'.repeat(40)
const NOW = Date.UTC(2026, 9, 19, 12)
const CANARIES = ['CANARY', 'steven@example.com', 'C:\\\\CANARY', '/home/CANARY']

let temp
let home
let root
let folder
beforeEach(() => {
  temp = mkdtempSync(join(tmpdir(), 'dev-costs-'))
  home = join(temp, 'home')
  root = join(temp, 'repo')
  folder = join(home, '.claude', 'projects', 'e--repos-x')
  mkdirSync(folder, { recursive: true })
  mkdirSync(root, { recursive: true })
  cpSync(fixtures, folder, { recursive: true })
})
afterEach(() => { vi.useRealTimers(); rmSync(temp, { recursive: true, force: true }) })

const transcript = () => join(folder, `${SESSION}.jsonl`)
const stdin = (path = transcript(), session = SESSION) => JSON.stringify({ session_id: session, transcript_path: path, cwd: 'C:\\CANARY-CWD', hook_event_name: 'SessionEnd', reason: 'other' })
// A fetch that answers from a list and records what it was sent; anything past the list fails the test.
const fetchStub = (answers = []) => {
  const calls = []
  const fetch = vi.fn(async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) })
    const answer = answers.shift()
    if (answer === undefined) throw new Error(`unexpected request to ${url}`)
    if (answer instanceof Error) throw answer
    return new Response(null, { status: answer })
  })
  return { fetch, calls }
}
const run = async ({ env = {}, input = stdin(), argv = [], fetch = fetchStub().fetch, now = () => NOW } = {}) => {
  const out = []
  const err = []
  const code = await main({ argv, env, stdin: input, fetch, home, root, now, stdout: (line) => out.push(line), stderr: (line) => err.push(line) })
  return { code, out, err }
}
const queueText = () => (existsSync(join(root, QUEUE_FILE)) ? readFileSync(join(root, QUEUE_FILE), 'utf8') : '')
const rowsOf = (payload) => payload.rows.map((row) => `${row.batch} ${row.branch} ${row.role} ${row.model} ${row.output}`)

describe('the hook setting', () => {
  const settings = JSON.parse(readFileSync(join(repo, '.claude/settings.json'), 'utf8'))
  const command = settings.hooks.SessionEnd[0].hooks[0].command

  it('holds exactly the one SessionEnd command, with the GitHub guard first and the script under .claude/hooks/', () => {
    expect(settings).toEqual({ hooks: { SessionEnd: [{ hooks: [{ type: 'command', timeout: 5, command: '[ "$GITHUB_ACTIONS" = true ] || node "$CLAUDE_PROJECT_DIR/.claude/hooks/dev-costs.mjs"' }] }] } })
    expect(command.startsWith('[ "$GITHUB_ACTIONS" = true ] ||')).toBe(true)
    expect(Object.keys(settings)).toEqual(['hooks'])
  })

  // The command itself, in bash: on GitHub it starts no node process at all (a marker script would say so).
  const bash = spawnSync('bash', ['-c', 'exit 0']).status === 0
  it.skipIf(!bash && !process.env.CI)('runs no script on GitHub and the script elsewhere, under bash', () => {
    const project = join(temp, 'project')
    mkdirSync(join(project, '.claude/hooks'), { recursive: true })
    const marker = join(temp, 'ran')
    writeFileSync(join(project, '.claude/hooks/dev-costs.mjs'), `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`.replace('require', "(await import('node:module')).createRequire(import.meta.url)"))
    const env = { ...process.env, CLAUDE_PROJECT_DIR: project }
    execFileSync('bash', ['-c', command], { env: { ...env, GITHUB_ACTIONS: 'true' } })
    expect(existsSync(marker)).toBe(false)
    execFileSync('bash', ['-c', command], { env: { ...env, GITHUB_ACTIONS: '' } })
    expect(existsSync(marker)).toBe(true)
  })

  it('does nothing when GITHUB_ACTIONS is set, even when the command is bypassed: no file read, no request', async () => {
    const { fetch } = fetchStub()
    expect((await run({ env: { GITHUB_ACTIONS: 'true', COSTS_INGEST_TOKEN: TOKEN }, fetch })).code).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
    expect(queueText()).toBe('')
  })

  it('keeps the queue and the local settings out of git, and no secret in the committed settings', () => {
    const ignored = readFileSync(join(repo, '.gitignore'), 'utf8').split(/\r?\n/).map((line) => line.trim())
    // The queue, its temp file and its lock.
    expect(ignored).toContain('.dev-costs-queue.jsonl*')
    expect(ignored).toContain('.claude/settings.local.json')
    expect(JSON.stringify(settings)).not.toMatch(/env|TOKEN|apiKeyHelper|permissions/)
  })
})

describe('what a session is summed into', () => {
  it('sums per branch, batch, role and model, from the last line of each message, only this session, without synthetic lines', () => {
    const summary = summarize({ sessionId: SESSION, lines: parseLines(readFileSync(transcript(), 'utf8')), agents: readAgents(transcript()), now: NOW })
    expect(summary.rows.map((row) => `${row.batch} ${row.branch} ${row.role} ${row.model} ${row.output}`)).toEqual([
      '0 dev-costs lead claude-opus-5-5 249',
      '0 dev-costs lead claude-fable-5-1 7',
      // A fast message apart, and a HEAD line taking the branch before it.
      '0 dev-costs lead claude-opus-5-5:fast 11',
      '0 fix-x lead claude-opus-5-5 13',
      // A branch that fails the rule is No feature, and so is the empty branch after it.
      '0 HEAD lead claude-opus-5-5 36',
      // A corrupt and a missing meta file: unknown-agent, with no batch to join.
      '0 dev-costs unknown-agent claude-opus-5-5 700',
      '1 dev-costs product-manager claude-opus-5-5 100',
      // A nested agent takes its parent's batch.
      '1 dev-costs senior-tester claude-opus-5-5 500',
      // Agents started in one message share a batch and its time; a role not in the pattern is unknown-agent.
      '2 dev-costs explore claude-opus-5-5 200',
      '2 dev-costs senior-developer claude-opus-5-5 600',
      '2 dev-costs unknown-agent claude-opus-5-5 700',
    ])
    const [first] = summary.rows
    expect(first).toEqual({ branch: 'dev-costs', role: 'lead', batch: 0, batchAt: Date.parse('2026-10-18T10:00:02.000Z'), model: 'claude-opus-5-5', input: 10, output: 249, cacheRead: 1000, cacheWrite5m: 100, cacheWrite1h: 50 })
    expect(summary.rows.filter((row) => row.batch === 2).map((row) => row.batchAt)).toEqual(Array(3).fill(Date.parse('2026-10-18T10:00:06.000Z')))
    expect(summary.rows.find((row) => row.model === 'claude-fable-5-1')).toMatchObject({ input: 5, output: 7 })
    expect([summary.startedAt, summary.endedAt]).toEqual([Date.parse('2026-10-18T10:00:02.000Z'), Date.parse('2026-10-18T10:00:26.000Z')])
    expect(JSON.stringify(summary)).not.toMatch(/msg_other|999999|synthetic/)
  })

  it('takes a cache write without its split as five-minute writes, and skips lines without a time or with a time out of range', () => {
    const line = (id, usage, timestamp = '2026-10-18T10:00:00.000Z') => ({ type: 'assistant', sessionId: SESSION, gitBranch: 'x', timestamp, message: { id, model: 'claude-opus-5-5', usage } })
    const summary = summarize({ sessionId: SESSION, now: NOW, lines: [line('a', { cache_creation_input_tokens: 40, output_tokens: -5, input_tokens: 'many' }), line('b', { output_tokens: 1 }, 'never'), line('c', { output_tokens: 1 }, '2025-12-31T23:59:59Z'), line('d', { output_tokens: 1 }, '2026-10-21T12:00:01Z'), line('e', null)] })
    expect(summary.rows).toEqual([{ branch: 'x', role: 'lead', batch: 0, batchAt: Date.parse('2026-10-18T10:00:00.000Z'), model: 'claude-opus-5-5', input: 0, output: 0, cacheRead: 0, cacheWrite5m: 40, cacheWrite1h: 0 }])
    expect(summarize({ sessionId: SESSION, lines: [], now: NOW })).toBeNull()
  })

  it('names a model outside the pattern unknown-model, and reads no subagents when there are none', () => {
    const lines = [{ type: 'assistant', sessionId: SESSION, timestamp: '2026-10-18T10:00:00Z', message: { id: 'a', model: 'Claude <X>', usage: { output_tokens: 2 } } }]
    expect(summarize({ sessionId: SESSION, lines, now: NOW }).rows[0]).toMatchObject({ model: 'unknown-model', branch: 'HEAD' })
    expect(readAgents(join(temp, 'nothing.jsonl'))).toEqual([])
  })

  it('keeps every key of the first post when the session goes on: HEAD lines after a branch, then resumed on another branch (S-17)', () => {
    const at = (s) => `2026-10-18T11:00:${String(s).padStart(2, '0')}Z`
    const line = (s, branch, id, output) => ({ type: 'assistant', sessionId: SESSION, gitBranch: branch, timestamp: at(s), message: { id, model: 'claude-opus-5-5', usage: { output_tokens: output } } })
    const firstLines = [line(1, 'feat-a', 'm1', 5), line(2, 'HEAD', 'm2', 6), line(3, '', 'm3', 7)]
    const first = summarize({ sessionId: SESSION, lines: firstLines, now: NOW })
    const second = summarize({ sessionId: SESSION, lines: [...firstLines, line(4, 'feat-b', 'm4', 8), line(5, 'HEAD', 'm5', 9), { ...line(5, 'HEAD', 'm2', 60) }], now: NOW })
    const key = (row) => `${row.branch}|${row.batch}|${row.role}|${row.model}`
    for (const row of first.rows) {
      const later = second.rows.find((item) => key(item) === key(row))
      expect(later, key(row)).toBeDefined()
      expect(later.output).toBeGreaterThanOrEqual(row.output)
    }
    expect(second.rows.map((row) => `${row.branch} ${row.output}`)).toEqual(['feat-a 72', 'feat-b 17'])
  })

  it('keeps a message before any branch under No feature, also once the session is resumed on a branch (S-17)', () => {
    const lines = [{ type: 'assistant', sessionId: SESSION, gitBranch: 'HEAD', timestamp: '2026-10-18T10:00:00Z', message: { id: 'a', model: 'claude-opus-5-5', usage: { output_tokens: 2 } } }]
    const resumed = [...lines, { type: 'user', sessionId: SESSION, gitBranch: 'later' }, { type: 'assistant', sessionId: SESSION, timestamp: '2026-10-18T10:01:00Z', message: { id: 'b', model: 'claude-opus-5-5', usage: { output_tokens: 3 } } }]
    expect([...collect(lines, SESSION).values()][0].branch).toBeNull()
    expect([...collect(resumed, SESSION).values()].map((message) => message.branch)).toEqual([null, 'later'])
    const first = summarize({ sessionId: SESSION, lines, now: NOW })
    const second = summarize({ sessionId: SESSION, lines: resumed, now: NOW })
    expect(first.rows.map((row) => `${row.branch} ${row.output}`)).toEqual(['HEAD 2'])
    expect(second.rows.map((row) => `${row.branch} ${row.output}`)).toEqual(['HEAD 2', 'later 3'])
  })

  it('reads the role of every team agent, lower-cased, from its meta file', () => {
    const session = join(temp, 'roles.jsonl')
    const subagents = join(temp, 'roles', 'subagents')
    mkdirSync(subagents, { recursive: true })
    const types = ['product-manager', 'senior-recruiter', 'ux-designer', 'senior-developer', 'security-engineer', 'senior-tester', 'Senior-Developer', 'lead']
    types.forEach((agentType, n) => {
      writeFileSync(join(subagents, `agent-r${n}.jsonl`), '')
      writeFileSync(join(subagents, `agent-r${n}.meta.json`), JSON.stringify({ agentType, toolUseId: `toolu_${n}` }))
    })
    // The lead is the main thread: an agent cannot claim it.
    expect(readAgents(session).map((agent) => agent.role)).toEqual(['product-manager', 'senior-recruiter', 'ux-designer', 'senior-developer', 'security-engineer', 'senior-tester', 'senior-developer', 'unknown-agent'])
  })

  it('marks a session estimated, or unknown with an API key in the environment; never billed', () => {
    expect(billingOf({})).toBe('estimated')
    expect(billingOf({ ANTHROPIC_API_KEY: 'sk-ant-x' })).toBe('unknown')
  })
})

describe('what leaves the machine', () => {
  it('is exactly the allowlist at both levels, and no canary from a prompt, answer, tool input or result, cwd, path or address', async () => {
    const { fetch, calls } = fetchStub([200])
    const result = await run({ env: { COSTS_INGEST_TOKEN: TOKEN, ANTHROPIC_API_KEY: 'sk-ant-CANARY' }, fetch })
    expect(calls).toHaveLength(1)
    const [{ url, init, body }] = calls
    expect(url).toBe(PRODUCTION_URL)
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' })
    expect(Object.keys(body)).toEqual(['v', 'source', 'session', 'startedAt', 'endedAt', 'billing', 'rows'])
    expect(body).toMatchObject({ v: 1, source: 'local', session: SESSION, billing: 'unknown' })
    for (const row of body.rows) expect(Object.keys(row)).toEqual(['branch', 'role', 'batch', 'batchAt', 'model', 'input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'])
    expect(JSON.stringify(body)).not.toMatch(/"(price|costMicro|costUsd)"\s*:/i)
    for (const canary of CANARIES) {
      expect(init.body).not.toContain(canary.replace(/\\\\/g, '\\'))
      expect(result.out.join('\n') + result.err.join('\n')).not.toContain('CANARY')
    }
    expect(init.body).not.toContain('CANARY')
    expect(init.body).not.toContain('img')
  })

  it('puts nothing but the payload in the queue, and no canary', async () => {
    await run({})
    const text = queueText()
    expect(text).not.toContain('CANARY')
    expect(text).not.toContain('example.com')
    expect(readQueue(root).map((line) => rowsOf(JSON.parse(line)).length)).toEqual([11])
  })

  it('sends a session of more than 64 rows in bodies of at most 64', () => {
    const rows = Array.from({ length: 70 }, (_, batch) => ({ branch: 'x', role: 'lead', batch, batchAt: NOW, model: 'm', input: 0, output: 1, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, extra: 'CANARY' }))
    const bodies = payloadsOf({ sessionId: SESSION, summary: { startedAt: NOW, endedAt: NOW, rows }, billing: 'estimated' })
    expect(bodies.map((body) => body.rows.length)).toEqual([MAX_ROWS, 6])
    expect(JSON.stringify(bodies)).not.toContain('CANARY')
    expect(payloadsOf({ sessionId: 'not-a-uuid', summary: { startedAt: NOW, endedAt: NOW, rows }, billing: 'estimated' })).toEqual([])
    expect(payloadsOf({ sessionId: SESSION, summary: null, billing: 'estimated' })).toEqual([])
  })

  it('splits by size as well, so a long branch name never makes a body the server refuses (16 KB)', () => {
    const branch = `feature/${'b'.repeat(192)}`
    expect(isBranch(branch)).toBe(true)
    const rows = Array.from({ length: MAX_ROWS }, (_, batch) => ({ branch, role: 'senior-developer', batch, batchAt: NOW, model: 'claude-opus-5-5', input: 123_456_789, output: 9_876_543, cacheRead: 1_234_567_890, cacheWrite5m: 98_765_432, cacheWrite1h: 12_345_678 }))
    const bodies = payloadsOf({ sessionId: SESSION, summary: { startedAt: NOW, endedAt: NOW, rows }, billing: 'estimated' })
    expect(bodies.length).toBeGreaterThan(1)
    for (const body of bodies) expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThanOrEqual(MAX_BODY_BYTES)
    expect(MAX_BODY_BYTES).toBeLessThan(16 * 1024)
    expect(bodies.flatMap((body) => body.rows.map((row) => row.batch))).toEqual(rows.map((row) => row.batch))
  })

  it('sends a body every row of which the server’s parser takes (the contract with /api/costs)', () => {
    const bodies = sessionPayloads({ sessionId: SESSION, transcript: transcript(), env: {}, now: NOW })
    expect(bodies).toHaveLength(1)
    for (const body of bodies) expect(parseIngest(JSON.stringify(body), NOW)).toMatchObject({ source: 'local', session: SESSION, rows: body.rows })
  })

  it('reads no transcript outside the projects folder, and no session id that is not a UUID', async () => {
    const outside = join(temp, `${SESSION}.jsonl`)
    cpSync(transcript(), outside)
    await run({ input: stdin(outside) })
    await run({ input: stdin(join(folder, '..', '..', `${SESSION}.jsonl`)) })
    await run({ input: stdin(transcript(), 'not-a-uuid') })
    await run({ input: 'not json' })
    expect(queueText()).toBe('')
    expect(isInside(folder, join(folder, 'missing.jsonl'))).toBe(false)
    expect(isInside(folder, folder)).toBe(false)
  })

  it('refuses a link inside the projects folder that points outside it, for a transcript and for a backfill folder', async (context) => {
    const outsideDir = join(temp, 'elsewhere')
    cpSync(folder, outsideDir, { recursive: true })
    const projects = join(home, '.claude', 'projects')
    const fileLink = join(folder, 'bbbbbbbb-2222-4222-8222-222222222222.jsonl')
    const dirLink = join(projects, 'linked')
    try {
      // A junction needs no privilege on Windows; elsewhere the type is ignored.
      symlinkSync(outsideDir, dirLink, 'junction')
      symlinkSync(join(outsideDir, `${SESSION}.jsonl`), fileLink, 'file')
    } catch (error) {
      // Windows without Developer Mode cannot make a file link: nothing to test there.
      if (['EPERM', 'EACCES', 'ENOSYS'].includes(error?.code)) return context.skip()
      throw error
    }
    expect(isInside(projects, fileLink)).toBe(false)
    expect(isInside(projects, join(dirLink, `${SESSION}.jsonl`))).toBe(false)
    await run({ input: stdin(fileLink) })
    await run({ input: stdin(join(dirLink, `${SESSION}.jsonl`)) })
    expect(queueText()).toBe('')
    expect((await run({ argv: ['--backfill', '--dir', dirLink] })).err).toEqual(['dev-costs: the backfill folder is not a project folder of Claude Code'])
    expect(queueText()).toBe('')
    // The positive control: the same transcript through its real path inside the folder is read.
    await run({ input: stdin() })
    expect(queueText()).not.toBe('')
  })

  it('reads the Claude config folder from CLAUDE_CONFIG_DIR when it is set', async () => {
    const config = join(temp, 'config')
    cpSync(join(home, '.claude'), config, { recursive: true })
    await run({ env: { CLAUDE_CONFIG_DIR: config }, input: stdin(join(config, 'projects', 'e--repos-x', `${SESSION}.jsonl`)) })
    expect(readQueue(root)).toHaveLength(1)
    rmSync(join(root, QUEUE_FILE))
    await run({ env: { CLAUDE_CONFIG_DIR: config } })
    expect(queueText()).toBe('')
  })

  it('posts only to steven.wilssens.com, or to localhost for a local test', () => {
    expect(ingestUrl({})).toBe(PRODUCTION_URL)
    for (const url of ['https://evil.example/api/costs', 'http://localhost.evil.example/', 'https://localhost:8788/api/costs', 'http://127.0.0.1@evil.example/', 'http://127.0.0.1:8788 /x']) expect(ingestUrl({ COSTS_INGEST_URL: url })).toBe(PRODUCTION_URL)
    for (const url of ['http://127.0.0.1:8788/api/costs', 'http://localhost:8788/api/costs', 'http://localhost/api/costs']) expect(ingestUrl({ COSTS_INGEST_URL: url })).toBe(url)
  })

  it('follows the server’s branch rule', () => {
    for (const branch of ['dev-costs', 'feature/x']) expect(isBranch(branch)).toBe(true)
    for (const branch of ['a..b', '-x', 'x/', 'x.lock', 'a//b', 'a b', '"><img>', 7]) expect(isBranch(branch)).toBe(false)
  })
})

describe('the hook never gets in the way', () => {
  it('queues without the secret and makes no request at all', async () => {
    const { fetch } = fetchStub()
    const result = await run({ fetch })
    expect(result).toEqual({ code: 0, out: [], err: [] })
    expect(fetch).not.toHaveBeenCalled()
    expect(readQueue(root)).toHaveLength(1)
  })

  it('keeps what a failed network did not send and sends it with the next session', async () => {
    const failing = fetchStub([new TypeError('fetch failed')])
    await run({ env: { COSTS_INGEST_TOKEN: TOKEN }, fetch: failing.fetch })
    expect(readQueue(root)).toHaveLength(1)
    const ok = fetchStub([204, 204])
    // The next session end: the old payload first, then its own (here the same session again).
    await run({ env: { COSTS_INGEST_TOKEN: TOKEN }, fetch: ok.fetch })
    expect(ok.calls).toHaveLength(2)
    expect(queueText()).toBe('')
  })

  it('leaves no lock behind after adding to the queue and after settling it (real clock)', () => {
    const lock = join(root, `${QUEUE_FILE}.lock`)
    const entry = JSON.stringify({ v: 1, source: 'local', rows: [] })
    appendQueue(root, [entry, entry])
    expect(existsSync(lock)).toBe(false)
    expect(settleQueue(root, [entry])).toEqual([entry])
    expect(existsSync(lock)).toBe(false)
    expect(readdirSync(root)).toEqual([QUEUE_FILE])
  })

  it('gives up on a held lock after a bounded number of tries when the clock does not move', () => {
    const lock = join(root, `${QUEUE_FILE}.lock`)
    writeFileSync(lock, '')
    const started = Date.now()
    const frozen = Date.now()
    expect(withQueueLock(root, (queued) => queued.length, { now: () => frozen })).toBe(0)
    // About LOCK_WAIT_MS of pauses, not forever; the other session's lock stays.
    expect(Date.now() - started).toBeLessThan(LOCK_WAIT_MS * 4)
    expect(existsSync(lock)).toBe(true)
  })

  it('counts the time already spent against its two seconds: no request starts once they are gone', async () => {
    let clock = NOW
    const { calls, fetch } = fetchStub([200])
    await run({ env: { COSTS_INGEST_TOKEN: TOKEN }, fetch, now: () => (clock += SEND_FOR_MS / 2 + 1) })
    expect(calls).toHaveLength(0)
    expect(readQueue(root)).toHaveLength(1)
  })

  it('does not wait for a lock after the request when the hook’s time is up, and still settles the queue', async () => {
    const lock = join(root, `${QUEUE_FILE}.lock`)
    let clock = NOW
    const { calls, fetch } = fetchStub([200])
    // Another session takes the lock while the request is out, and the request takes the time that is left.
    const slow = async (...args) => { writeFileSync(lock, ''); clock += FINISH_BY_MS; return fetch(...args) }
    const started = Date.now()
    await run({ env: { COSTS_INGEST_TOKEN: TOKEN }, fetch: slow, now: () => clock })
    expect(Date.now() - started).toBeLessThan(LOCK_WAIT_MS / 2)
    expect(calls).toHaveLength(1)
    expect(queueText()).toBe('')
    expect(existsSync(lock)).toBe(true)
  })

  it('aborts a request that never answers after 2.5 seconds and keeps the payload', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))))
    const done = run({ env: { COSTS_INGEST_TOKEN: TOKEN }, fetch })
    await vi.advanceTimersByTimeAsync(2499)
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect((await done).code).toBe(0)
    expect(readQueue(root)).toHaveLength(1)
  })

  it('keeps a payload on 429 and on a server error, and drops one the server refuses with a single line', async () => {
    for (const status of [429, 503]) {
      const { calls, fetch } = fetchStub([status])
      await run({ env: { COSTS_INGEST_TOKEN: TOKEN }, fetch })
      expect(calls).toHaveLength(1)
    }
    // Each run queued its own payload; neither was accepted.
    expect(readQueue(root)).toHaveLength(2)
    const refused = fetchStub([400, 403])
    const result = await run({ env: { COSTS_INGEST_TOKEN: TOKEN }, fetch: refused.fetch, input: '' })
    expect(result.err).toEqual(['dev-costs: the server refused a payload (400); it was dropped', 'dev-costs: the server refused a payload (403); it was dropped'])
    expect(queueText()).toBe('')
    expect(result.err.join('')).not.toContain(TOKEN)
  })

  it('stops starting requests after two seconds, so it ends inside the hook’s five', async () => {
    let clock = NOW
    const { calls, fetch } = fetchStub([200, 200])
    const entries = [1, 2, 3].map((n) => JSON.stringify({ v: 1, source: 'local', rows: [{ n }] }))
    const result = await sendQueue(entries, { fetch: async (...args) => { clock += 1500; return fetch(...args) }, token: TOKEN, url: PRODUCTION_URL, now: () => clock, stderr: () => {}, deadline: 2000 })
    expect(calls).toHaveLength(2)
    expect(result).toMatchObject({ sentRows: 2, stopped: true })
    expect(result.remaining).toHaveLength(1)
  })

  it('keeps at most 200 entries and 256 KB, the oldest dropped, and drops a line that does not parse', () => {
    const entry = (n, pad = '') => JSON.stringify({ v: 1, source: 'local', rows: [], n, pad })
    expect(capQueue(Array.from({ length: MAX_QUEUE + 1 }, (_, n) => entry(n)))).toEqual(Array.from({ length: MAX_QUEUE }, (_, n) => entry(n + 1)))
    const big = Array.from({ length: 5 }, (_, n) => entry(n, 'x'.repeat(60 * 1024)))
    const kept = capQueue(big)
    expect(kept).toEqual(big.slice(1))
    expect(kept.join('\n').length).toBeLessThanOrEqual(MAX_QUEUE_BYTES)
    writeFileSync(join(root, QUEUE_FILE), `${entry(1)}\n{broken\n["array"]\n${JSON.stringify({ v: 2, source: 'local', rows: [] })}\n\n${entry(2)}\n`)
    expect(readQueue(root)).toEqual([entry(1), entry(2)])
  })

  it('writes the queue through a temp file and a rename, and removes it when empty', () => {
    writeQueue(root, ['{"v":1,"source":"local","rows":[]}'])
    expect(readdirSync(root)).toEqual([QUEUE_FILE])
    writeQueue(root, [])
    expect(readdirSync(root)).toEqual([])
  })

  it('leaves the old queue whole when writing the new one fails: it never writes the queue in place', () => {
    const old = '{"v":1,"source":"local","rows":[1]}'
    writeQueue(root, [old])
    // The temp file's name taken by a folder: the write fails before anything touches the queue.
    mkdirSync(join(root, `${QUEUE_FILE}.${process.pid}.tmp`))
    expect(() => writeQueue(root, [old, '{"v":1,"source":"local","rows":[2]}'])).toThrow()
    expect(queueText()).toBe(`${old}\n`)
    expect(readQueue(root)).toEqual([old])
  })

  it('keeps a payload another session queued while this one was sending', async () => {
    const other = JSON.stringify({ v: 1, source: 'local', rows: [{ other: true }] })
    const { calls, fetch } = fetchStub([200])
    // The other session ends while this one's request is out.
    const sending = async (...args) => { appendQueue(root, [other]); return fetch(...args) }
    await run({ env: { COSTS_INGEST_TOKEN: TOKEN }, fetch: sending })
    expect(calls).toHaveLength(1)
    expect(readQueue(root)).toEqual([other])
    expect(readdirSync(root)).toEqual([QUEUE_FILE])
  })

  it('waits for another session’s lock, goes on without it after a second, and clears a stale one', () => {
    const lock = join(root, `${QUEUE_FILE}.lock`)
    const entry = JSON.stringify({ v: 1, source: 'local', rows: [] })
    writeFileSync(lock, '')
    let clock = Date.now()
    const ticks = []
    appendQueue(root, [entry])
    expect(readQueue(root)).toEqual([entry])
    // Held, and fresh: the change still happens once the wait is over, and the other session's lock stays.
    withQueueLock(root, (queued) => writeQueue(root, [...queued, entry]), { now: () => { ticks.push(clock); return (clock += LOCK_WAIT_MS / 4) } })
    expect(readQueue(root)).toEqual([entry, entry])
    expect(ticks.length).toBeGreaterThan(3)
    expect(existsSync(lock)).toBe(true)
    // Left by a killed session: removed, taken and released.
    utimesSync(lock, new Date(Date.now() - STALE_LOCK_MS - 1000), new Date(Date.now() - STALE_LOCK_MS - 1000))
    expect(withQueueLock(root, (queued) => queued.length)).toBe(2)
    expect(existsSync(lock)).toBe(false)
  })

  it('exits 0 with one fixed line when anything goes wrong, never the token', async () => {
    rmSync(root, { recursive: true })
    writeFileSync(root, 'a file where the repository should be')
    const result = await run({ env: { COSTS_INGEST_TOKEN: TOKEN } })
    expect(result).toEqual({ code: 0, out: [], err: ['dev-costs: the costs of this session could not be recorded'] })
  })

  it('posts to a localhost address when one is given for a local test', async () => {
    const { calls, fetch } = fetchStub([200])
    await run({ env: { COSTS_INGEST_TOKEN: TOKEN, COSTS_INGEST_URL: 'http://127.0.0.1:8788/api/costs' }, fetch })
    expect(calls[0].url).toBe('http://127.0.0.1:8788/api/costs')
  })
})

describe('the backfill', () => {
  const second = 'cccccccc-3333-4333-8333-333333333333'
  const rewrite = (from, to) => writeFileSync(to, readFileSync(from, 'utf8').replaceAll(SESSION, second))
  // A second past session with its subagents; and a file that is no session.
  const addSecond = () => {
    rewrite(transcript(), join(folder, `${second}.jsonl`))
    cpSync(join(folder, SESSION), join(folder, second), { recursive: true })
    const subagents = join(folder, second, 'subagents')
    for (const name of readdirSync(subagents).filter((entry) => entry.endsWith('.jsonl'))) rewrite(join(subagents, name), join(subagents, name))
    writeFileSync(join(folder, 'notes.jsonl'), '')
  }

  it('queues and sends every past session of the repository’s folder, and ends with one line of counts', async () => {
    addSecond()
    // Claude Code names a project's folder after its path, every other character a dash.
    const projectRoot = root
    const named = join(home, '.claude', 'projects', projectRoot.replace(/[^A-Za-z0-9]/g, '-'))
    cpSync(folder, named, { recursive: true })
    rmSync(folder, { recursive: true })
    folder = named
    const { calls, fetch } = fetchStub([200, 200])
    const out = []
    await main({ argv: ['--backfill'], env: { COSTS_INGEST_TOKEN: TOKEN }, fetch, home, root: projectRoot, now: () => NOW, stdout: (line) => out.push(line), stderr: () => {} })
    expect(calls.map((call) => call.body.session)).toEqual([SESSION, second])
    expect(out).toEqual(['dev-costs backfill: sessions read 2, rows sent 22, rows still queued 0'])
    // Run again: the same keys, which the server's upsert makes harmless.
    const again = fetchStub([200, 200])
    await main({ argv: ['--backfill', '--dir', folder], env: { COSTS_INGEST_TOKEN: TOKEN }, fetch: again.fetch, home, root: projectRoot, now: () => NOW, stdout: () => {}, stderr: () => {} })
    expect(again.calls.map((call) => rowsOf(call.body))).toEqual(calls.map((call) => rowsOf(call.body)))
  })

  it('leaves the rest queued after a 429 from the day’s cap', async () => {
    addSecond()
    const { calls, fetch } = fetchStub([429])
    const result = await run({ argv: ['--backfill', '--dir', folder], env: { COSTS_INGEST_TOKEN: TOKEN }, fetch })
    expect(calls).toHaveLength(1)
    expect(result.out).toEqual(['dev-costs backfill: sessions read 1, rows sent 0, rows still queued 11'])
  })

  it('queues without the secret and says how much waits', async () => {
    addSecond()
    const result = await run({ argv: ['--backfill', '--dir', folder] })
    expect(result.out).toEqual(['dev-costs backfill: sessions read 2, rows sent 0, rows still queued 22'])
  })

  it('refuses a folder outside the projects folder, and a repository without one', async () => {
    for (const argv of [['--backfill', '--dir', temp], ['--backfill', '--dir'], ['--backfill']]) {
      const result = await run({ argv })
      expect(result).toEqual({ code: 0, out: [], err: ['dev-costs: the backfill folder is not a project folder of Claude Code'] })
    }
    rmSync(join(home, '.claude'), { recursive: true })
    expect((await run({ argv: ['--backfill'] })).err).toHaveLength(1)
  })
})

describe('a corrupt transcript', () => {
  it('skips the lines that do not parse and keeps the rest', () => {
    const before = summarize({ sessionId: SESSION, lines: parseLines(readFileSync(transcript(), 'utf8')), agents: readAgents(transcript()), now: NOW })
    appendFileSync(transcript(), '\n{"type":"assistant"\n[1,2]\nnull\n"text"\n{"type":"assistant","sessionId":"' + SESSION + '","message":')
    const after = summarize({ sessionId: SESSION, lines: parseLines(readFileSync(transcript(), 'utf8')), agents: readAgents(transcript()), now: NOW })
    expect(after.rows).toHaveLength(11)
    expect(after).toEqual(before)
    expect(parseLines('{"a":1}\nnope\n[1]\n"x"\n\n')).toEqual([{ a: 1 }])
  })
})
