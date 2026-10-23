// The development costs in D1 (migrations/0013_dev_costs.sql): the rows the ingest writes and
// the budgets Steven sets. Fixed SQL with bound parameters only. A write is an upsert on
// (run_key, branch, batch, role, model) that replaces every value, and only with figures at
// least as new as the stored ones, so a body sent twice, late or after a resumed session
// never adds up or puts back smaller totals. One body is one batch: all its rows or none.
import { runKeyOf, type IngestBody } from './ingest'

// At most this many rows written per UTC day (a large backfill finishes over several days).
export const DAILY_ROWS = 5000
export const MAX_BUDGETS = 500
// The admin reads every row; far more than years of Steven's pace.
const READ_LIMIT = 50_000

export type CostRow = {
  source: 'github' | 'local'; runKey: string; branch: string; pr: number | null; workflow: string | null; job: string | null; runId: number | null; runAttempt: number | null
  role: string; batch: number; batchAt: number; model: string; billing: 'billed' | 'estimated' | 'unknown'
  input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number
  reportedMicro: number | null; numTurns: number | null; durationMs: number | null; startedAt: number; endedAt: number
}

const columns = ['source', 'run_key', 'branch', 'pr', 'workflow', 'job', 'run_id', 'run_attempt', 'role', 'batch', 'batch_at', 'model', 'billing', 'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_5m_tokens', 'cache_write_1h_tokens', 'reported_micro', 'num_turns', 'duration_ms', 'started_at', 'ended_at', 'received_at']
const keyColumns = ['run_key', 'branch', 'batch', 'role', 'model']
const upsert = `INSERT INTO dev_cost_runs (${columns.join(', ')}) VALUES (${columns.map((_, index) => `?${index + 1}`).join(', ')})
  ON CONFLICT (${keyColumns.join(', ')}) DO UPDATE SET ${columns.filter((column) => !keyColumns.includes(column)).map((column) => `${column} = excluded.${column}`).join(', ')}
  WHERE excluded.ended_at >= dev_cost_runs.ended_at`

const dayStart = (now: number) => now - (now % 86_400_000)

// The rows a body stands for, in the columns' order.
export const rowsOf = (body: IngestBody, now: number): unknown[][] => {
  const runKey = runKeyOf(body)
  if (body.source === 'github') {
    const role = body.workflow === 'review' ? 'review-workflow' : 'site-update-workflow'
    return [['github', runKey, body.branch, body.pr, body.workflow, body.job, body.runId, body.runAttempt, role, 0, body.endedAt, 'reported', body.billing, 0, 0, 0, 0, 0, body.costMicro, body.numTurns, body.durationMs, Math.max(0, body.endedAt - body.durationMs), body.endedAt, now]]
  }
  return body.rows.map((row) => ['local', runKey, row.branch, null, null, null, null, null, row.role, row.batch, row.batchAt, row.model, body.billing, row.input, row.output, row.cacheRead, row.cacheWrite5m, row.cacheWrite1h, null, null, null, body.startedAt, body.endedAt, now])
}

export class CostStore {
  constructor(private db: D1Database) {}

  // 'limited' when the body would take the day past its cap: then nothing is written.
  async write(body: IngestBody, now = Date.now()): Promise<'written' | 'limited'> {
    const rows = rowsOf(body, now)
    const today = await this.db.prepare('SELECT COUNT(*) AS n FROM dev_cost_runs WHERE received_at >= ?1').bind(dayStart(now)).first<number>('n')
    if (Number(today) + rows.length > DAILY_ROWS) return 'limited'
    await this.db.batch(rows.map((values) => this.db.prepare(upsert).bind(...values)))
    return 'written'
  }

  // The newest rows when there are more than READ_LIMIT (read newest first, then put back in order).
  async rows(limit = READ_LIMIT): Promise<CostRow[]> {
    const { results } = await this.db.prepare(`SELECT source, run_key AS runKey, branch, pr, workflow, job, run_id AS runId, run_attempt AS runAttempt, role, batch, batch_at AS batchAt, model, billing,
      input_tokens AS input, output_tokens AS output, cache_read_tokens AS cacheRead, cache_write_5m_tokens AS cacheWrite5m, cache_write_1h_tokens AS cacheWrite1h,
      reported_micro AS reportedMicro, num_turns AS numTurns, duration_ms AS durationMs, started_at AS startedAt, ended_at AS endedAt
      FROM dev_cost_runs ORDER BY batch_at DESC, id DESC LIMIT ?1`).bind(limit).all<CostRow>()
    return results.reverse()
  }

  async budgets(): Promise<Map<string, number>> {
    const { results } = await this.db.prepare('SELECT branch, budget_micro AS micro FROM dev_cost_budgets ORDER BY branch LIMIT 1000').all<{ branch: string; micro: number }>()
    return new Map(results.map((row) => [row.branch, row.micro]))
  }

  // Sets or (micro null) removes a budget; 'full' when a new one would pass MAX_BUDGETS.
  async setBudget(branch: string, micro: number | null, now = Date.now()): Promise<'saved' | 'full'> {
    if (micro === null) {
      await this.db.prepare('DELETE FROM dev_cost_budgets WHERE branch = ?1').bind(branch).run()
      return 'saved'
    }
    const exists = await this.db.prepare('SELECT 1 AS n FROM dev_cost_budgets WHERE branch = ?1').bind(branch).first<number>('n')
    if (!exists) {
      const count = await this.db.prepare('SELECT COUNT(*) AS n FROM dev_cost_budgets').first<number>('n')
      if (Number(count) >= MAX_BUDGETS) return 'full'
    }
    await this.db.prepare('INSERT INTO dev_cost_budgets (branch, budget_micro, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT (branch) DO UPDATE SET budget_micro = excluded.budget_micro, updated_at = excluded.updated_at').bind(branch, micro, now).run()
    return 'saved'
  }
}
