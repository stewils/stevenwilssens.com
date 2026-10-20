// What a Claude Code session on this repository cost, sent to /admin#costs when the session
// ends (the SessionEnd hook in .claude/settings.json; specs/dev-costs.md AC-5 to AC-11).
//
// It reads the session's own transcript and its subagents' (~/.claude/projects/<repo>/,
// or CLAUDE_CONFIG_DIR), and sums the tokens per branch, batch of agents, role and model.
// Only numbers, role names, model ids, branch names, the session id and times leave the
// machine: the payload is built field by field, never from a transcript object, so no
// prompt, answer, tool input or result, path or address can reach it. It sends tokens,
// never a price (the server prices them when they are read).
//
// It never gets in the way: it exits 0 on every path, writes the payload to the queue file
// (.dev-costs-queue.jsonl at the repository root, git-ignored) before sending it, sends with
// a 2.5-second timeout inside the hook's 5 seconds, and keeps what was not accepted for the
// next session. Without COSTS_INGEST_TOKEN in the environment it only queues: a stranger's
// clone of this public repository sends nothing. It posts only to steven.wilssens.com
// (COSTS_INGEST_URL is honoured for localhost alone) and never on GitHub Actions.
//
// `node .claude/hooks/dev-costs.mjs --backfill [--dir <folder>]` does the same for every past
// session of this repository; the server's upsert makes a second run harmless.
import { closeSync, existsSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const PRODUCTION_URL = 'https://steven.wilssens.com/api/costs'
export const QUEUE_FILE = '.dev-costs-queue.jsonl'
export const MAX_QUEUE = 200
export const MAX_QUEUE_BYTES = 256 * 1024
export const MAX_ROWS = 64
// The server takes 16 KB a body; a long branch name makes 64 rows larger than that.
export const MAX_BODY_BYTES = 15 * 1024
export const REQUEST_MS = 2500
// Stop starting new requests after this, so the last one ends inside the hook's 5 seconds.
export const SEND_FOR_MS = 2000
// Two sessions can end at once: each change to the queue holds its lock file. A session waits
// for it this long, then goes on without it; a lock older than STALE_LOCK_MS was left by a kill.
export const LOCK_WAIT_MS = 1000
export const STALE_LOCK_MS = 10_000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ROLE = /^[a-z][a-z0-9-]{0,40}$/
const MODEL = /^[a-z0-9][a-z0-9.-]{0,63}(:fast)?$/
const EARLIEST = Date.UTC(2026, 0, 1)
const DAY = 86_400_000
const TOKENS_MAX = 10_000_000_000
// The branch the server collects under "No feature" (a detached HEAD, or no branch at all).
export const NO_FEATURE = 'HEAD'

// The server's branch rule (functions/_lib/costs/ingest.ts): a short set of characters and git's ref rules.
export const isBranch = (value) => typeof value === 'string'
  && /^[A-Za-z0-9._/-]{1,200}$/.test(value)
  && !value.includes('..') && !value.includes('//') && !value.includes('@{')
  && !/^[-/]/.test(value) && !/(\/|\.lock)$/.test(value)

// ---- where it may read and post --------------------------------------------------------

export const ingestUrl = (env) => {
  const override = env.COSTS_INGEST_URL
  return override && /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/[^\s]*$/.test(override) ? override : PRODUCTION_URL
}

export const projectsDir = (env, home) => join(env.CLAUDE_CONFIG_DIR || join(home, '.claude'), 'projects')

// True when `child` is inside `parent` once both are resolved (symbolic links followed).
export const isInside = (parent, child) => {
  try {
    const rel = relative(realpathSync(parent), realpathSync(child))
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
  } catch { return false }
}

// ---- reading a transcript --------------------------------------------------------------

export const parseLines = (text) => text.split(/\r?\n/).flatMap((line) => {
  if (!line.trim()) return []
  try {
    const value = JSON.parse(line)
    return value && typeof value === 'object' && !Array.isArray(value) ? [value] : []
  } catch { return [] }
})

const count = (value) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), TOKENS_MAX) : 0)
const timeOf = (line) => {
  const ms = typeof line.timestamp === 'string' ? Date.parse(line.timestamp) : NaN
  return Number.isFinite(ms) ? ms : null
}
const rawBranch = (line) => (typeof line.gitBranch === 'string' && line.gitBranch && line.gitBranch !== 'HEAD' ? line.gitBranch : null)
const blocks = (line) => (Array.isArray(line.message?.content) ? line.message.content : [])

// The API messages of one transcript file, by message id: the first line's time, place and
// branch, the last line's usage (repeated lines carry growing usage), the tool calls in them.
// Only the hook's own session's lines count; `<synthetic>` lines are no API call.
export const collect = (lines, sessionId) => {
  const messages = new Map()
  const branches = []
  lines.forEach((line, index) => {
    if (line.sessionId !== sessionId) return
    const branch = rawBranch(line)
    if (branch) branches.push({ index, branch: isBranch(branch) ? branch : NO_FEATURE })
    if (line.type !== 'assistant' || !line.message || typeof line.message.id !== 'string' || line.message.model === '<synthetic>') return
    const time = timeOf(line)
    if (time === null) return
    const known = messages.get(line.message.id)
    const message = known ?? { index, time, branch, model: String(line.message.model ?? ''), usage: null, tools: [] }
    if (line.message.usage && typeof line.message.usage === 'object') message.usage = line.message.usage
    for (const block of blocks(line)) if (block?.type === 'tool_use' && typeof block.id === 'string') message.tools.push({ id: block.id, name: block.name, index })
    messages.set(line.message.id, message)
  })
  // A message without a branch takes the last one before it, else none (S-17): only earlier
  // lines decide, so a key does not move when the transcript grows or the session is resumed.
  let last = 0
  for (const message of [...messages.values()].sort((a, b) => a.index - b.index)) {
    while (last < branches.length && branches[last].index < message.index) last++
    if (message.branch) { message.branch = isBranch(message.branch) ? message.branch : NO_FEATURE; continue }
    message.branch = last ? branches[last - 1].branch : null
  }
  return messages
}

const modelOf = (message) => {
  const id = message.usage?.speed === 'fast' ? `${message.model}:fast` : message.model
  return MODEL.test(id) ? id : 'unknown-model'
}
const tokensOf = (usage) => {
  const creation = usage?.cache_creation
  const split = creation && typeof creation === 'object'
  return {
    input: count(usage?.input_tokens),
    output: count(usage?.output_tokens),
    cacheRead: count(usage?.cache_read_input_tokens),
    cacheWrite5m: split ? count(creation.ephemeral_5m_input_tokens) : count(usage?.cache_creation_input_tokens),
    cacheWrite1h: split ? count(creation.ephemeral_1h_input_tokens) : 0,
  }
}

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }
const readText = (file) => { try { return readFileSync(file, 'utf8') } catch { return '' } }

// The subagents of a session: <transcript without .jsonl>/subagents/agent-<id>.jsonl, each
// with its agent-<id>.meta.json (role and the tool call that started it).
export const readAgents = (transcript) => {
  const folder = join(transcript.replace(/\.jsonl$/, ''), 'subagents')
  if (!existsSync(folder)) return []
  let names = []
  try { names = readdirSync(folder).filter((name) => /^agent-[\w-]+\.jsonl$/.test(name)).sort() } catch { return [] }
  return names.map((name) => {
    const meta = readJson(join(folder, name.replace(/\.jsonl$/, '.meta.json')))
    const type = typeof meta?.agentType === 'string' ? meta.agentType.toLowerCase() : ''
    return { role: ROLE.test(type) && type !== 'lead' ? type : 'unknown-agent', toolUseId: typeof meta?.toolUseId === 'string' ? meta.toolUseId : null, lines: parseLines(readText(join(folder, name))) }
  })
}

// The rows of a session: per branch × batch × role × model, the five token kinds summed.
// Batch numbers, roles and models are decided by earlier lines only.
export const summarize = ({ sessionId, lines, agents = [], now = Date.now() }) => {
  const inRange = (message) => message.time >= EARLIEST && message.time <= now + DAY
  const lead = [...collect(lines, sessionId).values()].filter(inRange)
  // Batch N: the Nth lead message that started agents, at that message's time.
  const batchOf = new Map()
  const launches = lead.flatMap((message) => message.tools.filter((tool) => tool.name === 'Agent' || tool.name === 'Task').map((tool) => ({ ...tool, message })))
  const order = [...new Set(launches.sort((a, b) => a.index - b.index).map((launch) => launch.message))]
  for (const launch of launches) batchOf.set(launch.id, { batch: order.indexOf(launch.message) + 1, at: launch.message.time, branch: launch.message.branch })
  const subs = agents.map((agent) => ({ ...agent, messages: [...collect(agent.lines, sessionId).values()].filter(inRange) }))
  // A nested agent takes the batch of the agent that started it.
  for (let changed = true; changed;) {
    changed = false
    for (const agent of subs) {
      const parent = agent.toolUseId ? batchOf.get(agent.toolUseId) : undefined
      if (!parent) continue
      for (const message of agent.messages) for (const tool of message.tools) if (!batchOf.has(tool.id)) { batchOf.set(tool.id, parent); changed = true }
    }
  }
  const rows = new Map()
  const addRow = (branch, batch, batchAt, role, message) => {
    const model = modelOf(message)
    const key = JSON.stringify([branch, batch, role, model])
    const row = rows.get(key) ?? { branch, role, batch, batchAt, model, input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }
    row.batchAt = Math.min(row.batchAt, batchAt)
    const tokens = tokensOf(message.usage)
    for (const kind of Object.keys(tokens)) row[kind] = Math.min(row[kind] + tokens[kind], TOKENS_MAX)
    rows.set(key, row)
  }
  for (const message of lead) addRow(message.branch ?? NO_FEATURE, 0, message.time, 'lead', message)
  for (const agent of subs) {
    const parent = agent.toolUseId ? batchOf.get(agent.toolUseId) : undefined
    for (const message of agent.messages) addRow(message.branch ?? parent?.branch ?? NO_FEATURE, parent?.batch ?? 0, parent?.at ?? message.time, agent.role, message)
  }
  const times = [...lead, ...subs.flatMap((agent) => agent.messages)].map((message) => message.time)
  if (!times.length) return null
  return { startedAt: Math.min(...times), endedAt: Math.max(...times), rows: [...rows.values()].sort((a, b) => a.batch - b.batch || a.batchAt - b.batchAt || (a.branch + a.role + a.model).localeCompare(b.branch + b.role + b.model)) }
}

// The bodies POST /api/costs takes, built field by field: at most 64 rows and 15 KB each.
export const payloadsOf = ({ sessionId, summary, billing }) => {
  if (!UUID.test(sessionId) || !summary || !summary.rows.length) return []
  const bodyOf = (rows) => ({ v: 1, source: 'local', session: sessionId, startedAt: summary.startedAt, endedAt: summary.endedAt, billing, rows })
  const empty = Buffer.byteLength(JSON.stringify(bodyOf([])))
  const bodies = []
  let rows = []
  let size = empty
  for (const row of summary.rows) {
    const kept = {
      branch: row.branch, role: row.role, batch: row.batch, batchAt: row.batchAt, model: row.model,
      input: row.input, output: row.output, cacheRead: row.cacheRead, cacheWrite5m: row.cacheWrite5m, cacheWrite1h: row.cacheWrite1h,
    }
    // A row and the comma before it.
    const bytes = Buffer.byteLength(JSON.stringify(kept)) + 1
    if (rows.length && (rows.length >= MAX_ROWS || size + bytes > MAX_BODY_BYTES)) { bodies.push(bodyOf(rows)); rows = []; size = empty }
    rows.push(kept)
    size += bytes
  }
  bodies.push(bodyOf(rows))
  return bodies
}

// A local session is an estimate on the subscription; with an API key in the environment
// the hook cannot tell whether Steven let the session use it. Never "billed" (AC-8).
export const billingOf = (env) => (env.ANTHROPIC_API_KEY ? 'unknown' : 'estimated')

export const sessionPayloads = ({ sessionId, transcript, env, now }) => {
  const summary = summarize({ sessionId, lines: parseLines(readText(transcript)), agents: readAgents(transcript), now })
  return payloadsOf({ sessionId, summary, billing: billingOf(env) })
}

// ---- the queue -------------------------------------------------------------------------

const isPayload = (value) => value && typeof value === 'object' && value.v === 1 && value.source === 'local' && Array.isArray(value.rows)

export const readQueue = (root) => {
  const text = readText(join(root, QUEUE_FILE))
  return text.split(/\r?\n/).filter((line) => {
    if (!line.trim()) return false
    try { return isPayload(JSON.parse(line)) } catch { return false }
  })
}

// The newest entries that fit: 200 at most and 256 KB at most, the oldest dropped first.
export const capQueue = (entries) => {
  const kept = entries.slice(-MAX_QUEUE)
  while (kept.length && kept.reduce((size, line) => size + Buffer.byteLength(line) + 1, 0) > MAX_QUEUE_BYTES) kept.shift()
  return kept
}

// Through a temp file and a rename, so a crash never leaves half a queue.
export const writeQueue = (root, entries) => {
  const file = join(root, QUEUE_FILE)
  const kept = capQueue(entries)
  if (!kept.length) { rmSync(file, { force: true }); return kept }
  const temp = `${file}.${process.pid}.tmp`
  writeFileSync(temp, `${kept.join('\n')}\n`)
  renameSync(temp, file)
  return kept
}

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

// Runs `change` on the queue while holding its lock file (`<queue>.lock`, created with wx).
export const withQueueLock = (root, change, { now = Date.now } = {}) => {
  const lock = join(root, `${QUEUE_FILE}.lock`)
  const until = now() + LOCK_WAIT_MS
  let fd = null
  while (fd === null) {
    try {
      fd = openSync(lock, 'wx')
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      let age = 0
      try { age = now() - statSync(lock).mtimeMs } catch { continue }
      if (age > STALE_LOCK_MS) { rmSync(lock, { force: true }); continue }
      if (now() >= until) break
      pause(20)
    }
  }
  try {
    return change(readQueue(root))
  } finally {
    if (fd !== null) { closeSync(fd); rmSync(lock, { force: true }) }
  }
}

// Adds payloads at the end of the queue, under the lock.
export const appendQueue = (root, lines) => withQueueLock(root, (queued) => writeQueue(root, [...queued, ...lines]))

// Takes out the entries this session sent or dropped, under the lock, keeping anything another
// session queued meanwhile.
export const settleQueue = (root, handled) => withQueueLock(root, (queued) => {
  const done = new Map()
  for (const line of handled) done.set(line, (done.get(line) ?? 0) + 1)
  return writeQueue(root, queued.filter((line) => {
    const left = done.get(line)
    if (!left) return true
    done.set(line, left - 1)
    return false
  }))
})

// Sends the queue in order. Accepted: removed. 429 (the day's cap), a server error, a timeout
// or no network: kept, and nothing more is tried now. Any other refusal: dropped, one line.
export const sendQueue = async (entries, { fetch, token, url, now, stderr, deadline = Infinity }) => {
  const remaining = [...entries]
  let sentRows = 0
  const started = now()
  while (remaining.length) {
    if (now() - started > deadline) break
    const body = remaining[0]
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_MS)
    let status
    try {
      const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body, signal: controller.signal })
      status = response.status
    } catch {
      status = null
    } finally {
      clearTimeout(timer)
    }
    if (status !== null && status >= 200 && status < 300) { sentRows += JSON.parse(body).rows.length; remaining.shift(); continue }
    if (status !== null && status >= 400 && status < 500 && status !== 429) { stderr(`dev-costs: the server refused a payload (${status}); it was dropped`); remaining.shift(); continue }
    break
  }
  return { remaining, sentRows, stopped: remaining.length > 0 }
}

// ---- the hook and the backfill ---------------------------------------------------------

const rowsIn = (entries) => entries.reduce((total, line) => total + JSON.parse(line).rows.length, 0)

const projectFolder = (projects, root) => {
  const name = root.replace(/[^A-Za-z0-9]/g, '-').toLowerCase()
  try { return readdirSync(projects).map((entry) => join(projects, entry)).find((path) => basename(path).toLowerCase() === name && statSync(path).isDirectory()) ?? null } catch { return null }
}

const flagValue = (argv, flag) => { const at = argv.indexOf(flag); return at >= 0 ? argv[at + 1] ?? '' : null }

export async function main({ argv = [], env = {}, stdin = '', fetch = globalThis.fetch, home = homedir(), root, now = Date.now, stdout = () => {}, stderr = () => {} } = {}) {
  try {
    // Never on GitHub: the command checks this first too, before any code of the repository runs.
    if (env.GITHUB_ACTIONS === 'true') return 0
    const projects = projectsDir(env, home)
    const token = env.COSTS_INGEST_TOKEN || ''
    const url = ingestUrl(env)
    const flush = async (deadline) => {
      const queued = readQueue(root)
      if (!token || !queued.length) return { remaining: queued, sentRows: 0, stopped: queued.length > 0 }
      const result = await sendQueue(queued, { fetch, token, url, now, stderr, deadline })
      const remaining = settleQueue(root, queued.slice(0, queued.length - result.remaining.length))
      return { ...result, remaining }
    }

    if (argv.includes('--backfill')) {
      const asked = flagValue(argv, '--dir')
      const folder = asked === null ? projectFolder(projects, root) : resolve(asked)
      if (!folder || !isInside(projects, folder)) { stderr('dev-costs: the backfill folder is not a project folder of Claude Code'); return 0 }
      let sessions = 0
      let sent = 0
      let left = []
      for (const name of readdirSync(folder).filter((entry) => entry.endsWith('.jsonl')).sort()) {
        const sessionId = name.slice(0, -'.jsonl'.length)
        if (!UUID.test(sessionId)) continue
        sessions++
        const payloads = sessionPayloads({ sessionId, transcript: join(folder, name), env, now: now() })
        appendQueue(root, payloads.map((payload) => JSON.stringify(payload)))
        const result = await flush(Infinity)
        sent += result.sentRows
        left = result.remaining
        // The day's cap or no network: the rest waits for the next session end or the next backfill.
        if (token && result.stopped) break
      }
      stdout(`dev-costs backfill: sessions read ${sessions}, rows sent ${sent}, rows still queued ${rowsIn(left.length ? left : readQueue(root))}`)
      return 0
    }

    let input = null
    try { input = JSON.parse(stdin) } catch { input = null }
    const sessionId = typeof input?.session_id === 'string' ? input.session_id : ''
    const transcript = typeof input?.transcript_path === 'string' ? input.transcript_path : ''
    if (UUID.test(sessionId) && transcript && isInside(projects, transcript)) {
      const payloads = sessionPayloads({ sessionId, transcript, env, now: now() })
      // Queued first, so a kill at the hook's timeout loses nothing.
      if (payloads.length) appendQueue(root, payloads.map((payload) => JSON.stringify(payload)))
    }
    await flush(SEND_FOR_MS)
  } catch {
    stderr('dev-costs: the costs of this session could not be recorded')
  }
  return 0
}

/* v8 ignore start -- the command line: everything it does is main's, tested above */
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const chunks = []
  const read = process.argv.includes('--backfill') ? Promise.resolve() : new Promise((done) => { process.stdin.on('data', (chunk) => chunks.push(chunk)); process.stdin.on('end', done); process.stdin.on('error', done) })
  read.then(() => main({
    argv: process.argv.slice(2), env: process.env, stdin: Buffer.concat(chunks).toString('utf8'), root: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'),
    stdout: (line) => process.stdout.write(`${line}\n`), stderr: (line) => process.stderr.write(`${line}\n`),
  })).finally(() => process.exit(0))
}
/* v8 ignore stop */
