// Storage for the site assistant: the hourly limit, what it cost, votes, and the
// questions it could not answer. D1 in production, memory in tests.

export type Outcome = 'answered' | 'gap' | 'off' | 'limited' | 'failed'
export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type DailyRow = { day: string; outcome: Outcome; questions: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costMicro: number; msFirst: number; msTotal: number }
export type VoteRow = { day: string; helpful: number; unhelpful: number }
// Why a question was kept: the dossier did not cover it (gap), a job description
// named a requirement the record does not show (fit), or the answer was voted down.
export type QuestionReason = 'gap' | 'unhelpful' | 'fit'
// How Steven closed it in an MCP session: with a dossier entry (answered) or by
// setting it aside (dismissed). Open questions have no resolution.
export type Resolution = 'answered' | 'dismissed'
export type SavedQuestion = { id: number; ts: number; reason: QuestionReason; page: string | null; question: string; answer: string | null; country: string | null; asOrg: string | null; resolvedAt?: number | null; resolution?: Resolution | null; entryId?: number | null }
export type QuestionInput = Omit<SavedQuestion, 'id' | 'resolvedAt' | 'resolution' | 'entryId'>

// One question as it was asked, for the people who used the assistant on /admin.
export type LogEntry = { id: number; ts: number; visitor: string; kind: 'question' | 'fit'; page: string | null; question: string; answer: string | null; outcome: Outcome; country: string | null; asOrg: string | null }
export type LogInput = Omit<LogEntry, 'id'>

// The public report card: everything since the assistant went live.
export type ReportTotals = { since: string | null; questions: number; answered: number; gap: number; off: number; limited: number; costMicro: number; msFirst: number }

export interface AskStore {
  countHits(ipHash: string, since: number): Promise<number>
  // Questions from everyone since `since`: the signal that the site is under load or attack.
  countAllHits(since: number): Promise<number>
  addHit(ipHash: string, now: number): Promise<void>
  spentMicroSince(day: string): Promise<number>
  recordUsage(day: string, outcome: Outcome, usage: Usage, costMicro: number, msFirst: number, msTotal: number): Promise<void>
  recordVote(day: string, helpful: boolean): Promise<void>
  saveQuestion(q: QuestionInput, keepMs: number): Promise<number>
  daily(sinceDay: string): Promise<DailyRow[]>
  votes(sinceDay: string): Promise<VoteRow[]>
  // Open questions (not yet answered or dismissed), newest first.
  questions(since: number, limit: number): Promise<SavedQuestion[]>
  // How many questions Steven closed since `since`, by resolution.
  resolvedCounts(since: number): Promise<{ answered: number; dismissed: number }>
  // Totals over the assistant's whole life, for the public report card.
  totals(): Promise<ReportTotals>
  allVotes(): Promise<{ helpful: number; unhelpful: number }>
  // Every question with the visitor who asked it; entries older than keepMs go.
  logQuestion(entry: LogInput, keepMs: number): Promise<void>
  // What /privacy promises for everything older than `before`: the log and open questions
  // deleted, closed questions stripped to the question. Run on every save and periodically.
  prune(before: number): Promise<void>
  // The log since `since`, newest first.
  log(since: number, limit: number): Promise<LogEntry[]>
}

export const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10)
export const monthStart = (ts: number) => `${dayOf(ts).slice(0, 7)}-01`

type LogDb = { id: number; ts: number; visitor: string; kind: LogEntry['kind']; page: string | null; question: string; answer: string | null; outcome: Outcome; country: string | null; as_org: string | null }

type DailyDb = { day: string; outcome: Outcome; questions: number; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number; cost_micro: number; ms_first: number; ms_total: number }
type QuestionDb = { id: number; ts: number; reason: QuestionReason; page: string | null; question: string; answer: string | null; country: string | null; as_org: string | null; resolved_at: number | null; resolution: Resolution | null; entry_id: number | null }
export const questionFromRow = (row: QuestionDb): SavedQuestion => ({ id: row.id, ts: row.ts, reason: row.reason, page: row.page, question: row.question, answer: row.answer, country: row.country, asOrg: row.as_org, resolvedAt: row.resolved_at ?? null, resolution: row.resolution ?? null, entryId: row.entry_id ?? null })

export class D1AskStore implements AskStore {
  constructor(private db: D1Database) {}

  async countHits(ipHash: string, since: number) {
    const row = await this.db.prepare('SELECT COUNT(*) AS n FROM ask_hits WHERE ip_hash = ? AND ts >= ?').bind(ipHash, since).first<{ n: number }>()
    return row?.n ?? 0
  }

  async countAllHits(since: number) {
    // Reads of /api/notes are counted for their own limit only, never toward the assistant's human check.
    const row = await this.db.prepare("SELECT COUNT(*) AS n FROM ask_hits WHERE ts >= ? AND ip_hash NOT LIKE '%:notes'").bind(since).first<{ n: number }>()
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

  async saveQuestion(q: QuestionInput, keepMs: number) {
    const row = await this.db.prepare('INSERT INTO ask_questions (ts, reason, page, question, answer, country, as_org) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id')
      .bind(q.ts, q.reason, q.page, q.question, q.answer, q.country, q.asOrg).first<{ id: number }>()
    await this.prune(q.ts - keepMs)
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
    const { results } = await this.db.prepare('SELECT * FROM ask_questions WHERE ts >= ? AND resolved_at IS NULL ORDER BY ts DESC LIMIT ?').bind(since, limit).all<QuestionDb>()
    return results.map(questionFromRow)
  }

  async resolvedCounts(since: number) {
    const { results } = await this.db.prepare('SELECT resolution, COUNT(*) AS n FROM ask_questions WHERE resolved_at >= ? GROUP BY resolution').bind(since).all<{ resolution: Resolution; n: number }>()
    const counts = { answered: 0, dismissed: 0 }
    for (const row of results) if (row.resolution in counts) counts[row.resolution] = row.n
    return counts
  }

  async totals() {
    const { results } = await this.db.prepare('SELECT outcome, SUM(questions) AS questions, SUM(cost_micro) AS cost_micro, SUM(ms_first) AS ms_first, MIN(day) AS since FROM ask_daily GROUP BY outcome').all<{ outcome: Outcome; questions: number; cost_micro: number; ms_first: number; since: string }>()
    return sumTotals(results.map((row) => ({ outcome: row.outcome, questions: row.questions, costMicro: row.cost_micro, msFirst: row.ms_first, since: row.since })))
  }

  async allVotes() {
    const row = await this.db.prepare('SELECT COALESCE(SUM(helpful), 0) AS helpful, COALESCE(SUM(unhelpful), 0) AS unhelpful FROM ask_votes').first<{ helpful: number; unhelpful: number }>()
    return { helpful: row?.helpful ?? 0, unhelpful: row?.unhelpful ?? 0 }
  }

  async logQuestion(e: LogInput, keepMs: number) {
    await this.db.prepare('INSERT INTO ask_log (ts, visitor, kind, page, question, answer, outcome, country, as_org) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(e.ts, e.visitor, e.kind, e.page, e.question, e.answer, e.outcome, e.country, e.asOrg).run()
    await this.prune(e.ts - keepMs)
  }

  async prune(before: number) {
    // Open questions expire; closed ones stay, since the report card counts them, but only
    // the question is left: not the assistant's answer, the page or where it came from.
    await this.db.batch([
      this.db.prepare('DELETE FROM ask_log WHERE ts < ?').bind(before),
      this.db.prepare('DELETE FROM ask_questions WHERE ts < ? AND resolved_at IS NULL').bind(before),
      this.db.prepare('UPDATE ask_questions SET page = NULL, answer = NULL, country = NULL, as_org = NULL WHERE ts < ? AND resolved_at IS NOT NULL AND (page IS NOT NULL OR answer IS NOT NULL OR country IS NOT NULL OR as_org IS NOT NULL)').bind(before),
    ])
  }

  async log(since: number, limit: number) {
    const { results } = await this.db.prepare('SELECT * FROM ask_log WHERE ts >= ? ORDER BY ts DESC LIMIT ?').bind(since, limit).all<LogDb>()
    return results.map((row) => ({ id: row.id, ts: row.ts, visitor: row.visitor, kind: row.kind, page: row.page, question: row.question, answer: row.answer, outcome: row.outcome, country: row.country, asOrg: row.as_org }))
  }
}

// Per-outcome sums into one report line. Time to first word is only summed for answers (answered and gap).
export const sumTotals = (rows: { outcome: Outcome; questions: number; costMicro: number; msFirst: number; since: string }[]): ReportTotals => {
  const totals: ReportTotals = { since: null, questions: 0, answered: 0, gap: 0, off: 0, limited: 0, costMicro: 0, msFirst: 0 }
  for (const row of rows) {
    if (!totals.since || row.since < totals.since) totals.since = row.since
    totals.costMicro += row.costMicro
    if (row.outcome === 'failed') continue
    if (row.outcome === 'limited') { totals.limited += row.questions; continue }
    totals.questions += row.questions
    totals[row.outcome] += row.questions
    if (row.outcome !== 'off') totals.msFirst += row.msFirst
  }
  return totals
}

export class MemoryAskStore implements AskStore {
  hits: { ipHash: string; ts: number }[] = []
  rows: DailyRow[] = []
  voteRows: VoteRow[] = []
  saved: SavedQuestion[] = []
  entries: LogEntry[] = []

  async countHits(ipHash: string, since: number) { return this.hits.filter((hit) => hit.ipHash === ipHash && hit.ts >= since).length }
  async countAllHits(since: number) { return this.hits.filter((hit) => hit.ts >= since && !hit.ipHash.endsWith(':notes')).length }
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

  async saveQuestion(q: QuestionInput, keepMs: number) {
    const id = (this.saved[this.saved.length - 1]?.id ?? 0) + 1
    this.saved.push({ id, ...q, resolvedAt: null, resolution: null, entryId: null })
    await this.prune(q.ts - keepMs)
    return id
  }

  async daily(sinceDay: string) { return this.rows.filter((row) => row.day >= sinceDay) }
  async votes(sinceDay: string) { return this.voteRows.filter((row) => row.day >= sinceDay) }
  async questions(since: number, limit: number) { return this.saved.filter((q) => q.ts >= since && !q.resolvedAt).sort((a, b) => b.ts - a.ts).slice(0, limit) }
  async resolvedCounts(since: number) {
    const closed = this.saved.filter((q) => (q.resolvedAt ?? 0) >= since)
    return { answered: closed.filter((q) => q.resolution === 'answered').length, dismissed: closed.filter((q) => q.resolution === 'dismissed').length }
  }
  async totals() { return sumTotals(this.rows.map((row) => ({ outcome: row.outcome, questions: row.questions, costMicro: row.costMicro, msFirst: row.msFirst, since: row.day }))) }
  async allVotes() { return this.voteRows.reduce((sum, row) => ({ helpful: sum.helpful + row.helpful, unhelpful: sum.unhelpful + row.unhelpful }), { helpful: 0, unhelpful: 0 }) }
  async logQuestion(e: LogInput, keepMs: number) {
    this.entries.push({ id: this.entries.length + 1, ...e })
    await this.prune(e.ts - keepMs)
  }
  async prune(before: number) {
    this.entries = this.entries.filter((item) => item.ts >= before)
    this.saved = this.saved.filter((item) => item.ts >= before || item.resolvedAt)
      .map((item) => item.ts < before ? { ...item, page: null, answer: null, country: null, asOrg: null } : item)
  }
  async log(since: number, limit: number) { return this.entries.filter((e) => e.ts >= since).sort((a, b) => b.ts - a.ts).slice(0, limit) }
}
