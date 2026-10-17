// Storage for the site assistant: the hourly limit, what it cost, votes, and the
// questions it could not answer. D1 in production, memory in tests.

export type Outcome = 'answered' | 'gap' | 'off' | 'limited' | 'failed'
export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type DailyRow = { day: string; outcome: Outcome; questions: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costMicro: number; msFirst: number; msTotal: number }
export type VoteRow = { day: string; helpful: number; unhelpful: number }
export type SavedQuestion = { id: number; ts: number; reason: 'gap' | 'unhelpful'; page: string | null; question: string; answer: string | null; country: string | null; asOrg: string | null }

export interface AskStore {
  countHits(ipHash: string, since: number): Promise<number>
  addHit(ipHash: string, now: number): Promise<void>
  spentMicroSince(day: string): Promise<number>
  recordUsage(day: string, outcome: Outcome, usage: Usage, costMicro: number, msFirst: number, msTotal: number): Promise<void>
  recordVote(day: string, helpful: boolean): Promise<void>
  saveQuestion(q: Omit<SavedQuestion, 'id'>, keepMs: number): Promise<number>
  daily(sinceDay: string): Promise<DailyRow[]>
  votes(sinceDay: string): Promise<VoteRow[]>
  questions(since: number, limit: number): Promise<SavedQuestion[]>
}

export const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10)
export const monthStart = (ts: number) => `${dayOf(ts).slice(0, 7)}-01`

type DailyDb = { day: string; outcome: Outcome; questions: number; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number; cost_micro: number; ms_first: number; ms_total: number }
type QuestionDb = { id: number; ts: number; reason: 'gap' | 'unhelpful'; page: string | null; question: string; answer: string | null; country: string | null; as_org: string | null }

export class D1AskStore implements AskStore {
  constructor(private db: D1Database) {}

  async countHits(ipHash: string, since: number) {
    const row = await this.db.prepare('SELECT COUNT(*) AS n FROM ask_hits WHERE ip_hash = ? AND ts >= ?').bind(ipHash, since).first<{ n: number }>()
    return row?.n ?? 0
  }

  async addHit(ipHash: string, now: number) {
    await this.db.batch([
      this.db.prepare('INSERT INTO ask_hits (ip_hash, ts) VALUES (?, ?)').bind(ipHash, now),
      this.db.prepare('DELETE FROM ask_hits WHERE ts < ?').bind(now - 86_400_000),
    ])
  }

  async spentMicroSince(day: string) {
    const row = await this.db.prepare('SELECT COALESCE(SUM(cost_micro), 0) AS n FROM ask_daily WHERE day >= ?').bind(day).first<{ n: number }>()
    return row?.n ?? 0
  }

  async recordUsage(day: string, outcome: Outcome, u: Usage, costMicro: number, msFirst: number, msTotal: number) {
    await this.db.prepare(`INSERT INTO ask_daily (day, outcome, questions, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_micro, ms_first, ms_total)
      VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      ON CONFLICT(day, outcome) DO UPDATE SET questions = questions + 1, input_tokens = input_tokens + ?3, output_tokens = output_tokens + ?4,
        cache_read_tokens = cache_read_tokens + ?5, cache_write_tokens = cache_write_tokens + ?6, cost_micro = cost_micro + ?7, ms_first = ms_first + ?8, ms_total = ms_total + ?9`)
      .bind(day, outcome, u.input, u.output, u.cacheRead, u.cacheWrite, costMicro, Math.round(msFirst), Math.round(msTotal)).run()
  }

  async recordVote(day: string, helpful: boolean) {
    await this.db.prepare(`INSERT INTO ask_votes (day, helpful, unhelpful) VALUES (?1, ?2, ?3)
      ON CONFLICT(day) DO UPDATE SET helpful = helpful + ?2, unhelpful = unhelpful + ?3`).bind(day, helpful ? 1 : 0, helpful ? 0 : 1).run()
  }

  async saveQuestion(q: Omit<SavedQuestion, 'id'>, keepMs: number) {
    const row = await this.db.prepare('INSERT INTO ask_questions (ts, reason, page, question, answer, country, as_org) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id')
      .bind(q.ts, q.reason, q.page, q.question, q.answer, q.country, q.asOrg).first<{ id: number }>()
    await this.db.prepare('DELETE FROM ask_questions WHERE ts < ?').bind(q.ts - keepMs).run()
    return row!.id
  }

  async daily(sinceDay: string) {
    const { results } = await this.db.prepare('SELECT * FROM ask_daily WHERE day >= ? ORDER BY day').bind(sinceDay).all<DailyDb>()
    return results.map((row) => ({ day: row.day, outcome: row.outcome, questions: row.questions, inputTokens: row.input_tokens, outputTokens: row.output_tokens, cacheReadTokens: row.cache_read_tokens, cacheWriteTokens: row.cache_write_tokens, costMicro: row.cost_micro, msFirst: row.ms_first, msTotal: row.ms_total }))
  }

  async votes(sinceDay: string) {
    const { results } = await this.db.prepare('SELECT * FROM ask_votes WHERE day >= ? ORDER BY day').bind(sinceDay).all<VoteRow>()
    return results
  }

  async questions(since: number, limit: number) {
    const { results } = await this.db.prepare('SELECT * FROM ask_questions WHERE ts >= ? ORDER BY ts DESC LIMIT ?').bind(since, limit).all<QuestionDb>()
    return results.map((row) => ({ id: row.id, ts: row.ts, reason: row.reason, page: row.page, question: row.question, answer: row.answer, country: row.country, asOrg: row.as_org }))
  }
}

export class MemoryAskStore implements AskStore {
  hits: { ipHash: string; ts: number }[] = []
  rows: DailyRow[] = []
  voteRows: VoteRow[] = []
  saved: SavedQuestion[] = []

  async countHits(ipHash: string, since: number) { return this.hits.filter((hit) => hit.ipHash === ipHash && hit.ts >= since).length }
  async addHit(ipHash: string, now: number) { this.hits.push({ ipHash, ts: now }) }
  async spentMicroSince(day: string) { return this.rows.filter((row) => row.day >= day).reduce((sum, row) => sum + row.costMicro, 0) }

  async recordUsage(day: string, outcome: Outcome, u: Usage, costMicro: number, msFirst: number, msTotal: number) {
    let row = this.rows.find((item) => item.day === day && item.outcome === outcome)
    if (!row) { row = { day, outcome, questions: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costMicro: 0, msFirst: 0, msTotal: 0 }; this.rows.push(row) }
    row.questions++; row.inputTokens += u.input; row.outputTokens += u.output; row.cacheReadTokens += u.cacheRead; row.cacheWriteTokens += u.cacheWrite; row.costMicro += costMicro; row.msFirst += Math.round(msFirst); row.msTotal += Math.round(msTotal)
  }

  async recordVote(day: string, helpful: boolean) {
    let row = this.voteRows.find((item) => item.day === day)
    if (!row) { row = { day, helpful: 0, unhelpful: 0 }; this.voteRows.push(row) }
    if (helpful) row.helpful++; else row.unhelpful++
  }

  async saveQuestion(q: Omit<SavedQuestion, 'id'>, keepMs: number) {
    const id = this.saved.length + 1
    this.saved.push({ id, ...q })
    this.saved = this.saved.filter((item) => item.ts >= q.ts - keepMs)
    return id
  }

  async daily(sinceDay: string) { return this.rows.filter((row) => row.day >= sinceDay) }
  async votes(sinceDay: string) { return this.voteRows.filter((row) => row.day >= sinceDay) }
  async questions(since: number, limit: number) { return this.saved.filter((q) => q.ts >= since).sort((a, b) => b.ts - a.ts).slice(0, limit) }
}
