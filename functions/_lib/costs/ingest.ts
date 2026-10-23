// What POST /api/costs accepts: exactly one of two shapes, every key known, every value in
// its range (specs/dev-costs.md AC-14). Pure: the route reads the body (16 KB at most) and
// hands the text here; anything that is not exactly the shape is null, and the route answers
// the same fixed 400 whatever failed. The server builds the run key itself from the
// validated fields; no body carries one.

export const MAX_ROWS = 64
const DAY = 86_400_000
const EARLIEST = Date.UTC(2026, 0, 1)
const TOKENS_MAX = 10_000_000_000

export type Billing = 'billed' | 'estimated' | 'unknown'
export type LocalRow = { branch: string; role: string; batch: number; batchAt: number; model: string; input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }
export type LocalBody = { source: 'local'; session: string; startedAt: number; endedAt: number; billing: 'estimated' | 'unknown'; rows: LocalRow[] }
export type GithubBody = { source: 'github'; workflow: 'review' | 'site-update'; job: 'team' | 'update'; runId: number; runAttempt: number; branch: string; pr: number | null; billing: Billing; costMicro: number; numTurns: number; durationMs: number; endedAt: number }
export type IngestBody = LocalBody | GithubBody

// The job that belongs to each workflow: a body naming another is refused.
export const JOBS = { review: 'team', 'site-update': 'update' } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ROLE = /^[a-z][a-z0-9-]{0,40}$/
const MODEL = /^[a-z0-9][a-z0-9.-]{0,63}(:fast)?$/

// A branch name we store and show: a short set of characters and git's own ref rules.
export const isBranch = (value: unknown): value is string => typeof value === 'string'
  && /^[A-Za-z0-9._/-]{1,200}$/.test(value)
  && !value.includes('..') && !value.includes('//') && !value.includes('@{')
  && !/^[-/]/.test(value) && !/(\/|\.lock)$/.test(value)

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, required: string[], optional: string[] = []) => {
  const keys = Object.keys(value)
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key))
}
const int = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const time = (value: unknown, now: number): value is number => int(value, EARLIEST, now + DAY)

const parseRow = (row: unknown, now: number): LocalRow | null => {
  if (!isObject(row) || !exactKeys(row, ['branch', 'role', 'batch', 'batchAt', 'model', 'input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'])) return null
  const { branch, role, batch, batchAt, model, input, output, cacheRead, cacheWrite5m, cacheWrite1h } = row
  if (!isBranch(branch) || typeof role !== 'string' || !ROLE.test(role) || typeof model !== 'string' || !MODEL.test(model)) return null
  if (!int(batch, 0, 10_000) || !time(batchAt, now)) return null
  const tokens = [input, output, cacheRead, cacheWrite5m, cacheWrite1h]
  if (!tokens.every((value) => int(value, 0, TOKENS_MAX))) return null
  return { branch, role, batch, batchAt, model, input: input as number, output: output as number, cacheRead: cacheRead as number, cacheWrite5m: cacheWrite5m as number, cacheWrite1h: cacheWrite1h as number }
}

const parseLocal = (body: Record<string, unknown>, now: number): LocalBody | null => {
  if (!exactKeys(body, ['v', 'source', 'session', 'startedAt', 'endedAt', 'billing', 'rows'])) return null
  const { session, startedAt, endedAt, billing, rows } = body
  if (typeof session !== 'string' || !UUID.test(session)) return null
  if (!time(startedAt, now) || !time(endedAt, now) || endedAt < startedAt) return null
  // A local session never knows it was billed (AC-8).
  if (billing !== 'estimated' && billing !== 'unknown') return null
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_ROWS) return null
  const parsed = rows.map((row) => parseRow(row, now))
  if (parsed.some((row) => row === null)) return null
  return { source: 'local', session, startedAt, endedAt, billing, rows: parsed as LocalRow[] }
}

const parseGithub = (body: Record<string, unknown>, now: number): GithubBody | null => {
  if (!exactKeys(body, ['v', 'source', 'workflow', 'job', 'runId', 'runAttempt', 'branch', 'billing', 'costMicro', 'numTurns', 'durationMs', 'endedAt'], ['pr'])) return null
  const { workflow, job, runId, runAttempt, branch, pr, billing, costMicro, numTurns, durationMs, endedAt } = body
  if (workflow !== 'review' && workflow !== 'site-update') return null
  if (job !== JOBS[workflow]) return null
  if (!int(runId, 1, 10_000_000_000_000) || !int(runAttempt, 1, 100) || !isBranch(branch)) return null
  if (pr !== undefined && !int(pr, 1, 1_000_000)) return null
  if (billing !== 'billed' && billing !== 'estimated' && billing !== 'unknown') return null
  if (!int(costMicro, 0, 1_000_000_000) || !int(numTurns, 0, 10_000) || !int(durationMs, 0, DAY) || !time(endedAt, now)) return null
  return { source: 'github', workflow, job: JOBS[workflow], runId, runAttempt, branch, pr: pr === undefined ? null : pr, billing, costMicro, numTurns, durationMs, endedAt }
}

export const parseIngest = (text: string, now = Date.now()): IngestBody | null => {
  let body: unknown
  try { body = JSON.parse(text) } catch { return null }
  if (!isObject(body) || body.v !== 1) return null
  if (body.source === 'local') return parseLocal(body, now)
  if (body.source === 'github') return parseGithub(body, now)
  return null
}

// The run key the rows of a body are stored under.
export const runKeyOf = (body: IngestBody) => (body.source === 'local' ? `local:${body.session}` : `github:${body.runId}:${body.runAttempt}:${body.job}`)
