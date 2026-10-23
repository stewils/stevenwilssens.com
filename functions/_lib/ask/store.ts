// Storage for the site assistant: the hourly limit, what it cost, votes, the
// questions it could not answer, the log of every question and Steven's ratings of
// the answers. D1 in production, memory in tests.
import { isRateable, type Criterion, type Scores } from './rating'

export { isRateable }
export type { Criterion, Scores }

export type Outcome = 'answered' | 'gap' | 'off' | 'limited' | 'failed'
export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type DailyRow = { day: string; outcome: Outcome; questions: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costMicro: number; msFirst: number; msTotal: number }
export type VoteRow = { day: string; helpful: number; unhelpful: number }
// Why a question was kept: the dossier did not cover it (gap), a job description
// named a requirement the record does not show (fit), the answer was voted down
// (unhelpful), or Steven rated the answer poor and added it to his questions (rated).
export type QuestionReason = 'gap' | 'unhelpful' | 'fit' | 'rated'
// How Steven closed it in an MCP session: with a dossier entry (answered) or by
// setting it aside (dismissed). Open questions have no resolution.
export type Resolution = 'answered' | 'dismissed'
export type SavedQuestion = { id: number; ts: number; reason: QuestionReason; page: string | null; question: string; answer: string | null; country: string | null; asOrg: string | null; resolvedAt?: number | null; resolution?: Resolution | null; entryId?: number | null }
export type QuestionInput = Omit<SavedQuestion, 'id' | 'resolvedAt' | 'resolution' | 'entryId'>

// One question as it was asked, for the people who used the assistant on /admin, with
// what produced the answer: the model that served it, whether a fallback did, the
// instruction and knowledge versions, and the source ids it cited (null before 0014).
export type LogEntry = { id: number; ts: number; visitor: string; kind: 'question' | 'fit'; page: string | null; question: string; answer: string | null; outcome: Outcome; country: string | null; asOrg: string | null; model: string | null; fallback: boolean | null; promptVersion: string | null; knowledgeVersion: string | null; sources: string[] | null }
type Produced = 'model' | 'fallback' | 'promptVersion' | 'knowledgeVersion' | 'sources'
export type LogInput = Omit<LogEntry, 'id' | Produced> & Partial<Pick<LogEntry, Produced>>

// Steven's rating of one logged answer (the rubric in specs/ask-ratings.md). Once the
// answer is pruned, logId, note and questionId are null and the rest stays.
export type Rating = Scores & { id: number; logId: number | null; day: string; model: string | null; fallback: boolean | null; promptVersion: string | null; knowledgeVersion: string | null; kind: LogEntry['kind']; outcome: Outcome; note: string | null; questionId: number | null; ratedAt: number }
export type RatingInput = Scores & { logId: number; note: string | null; ratedAt: number }


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
  // Every question with the visitor who asked it; entries older than keepMs go.
  logQuestion(entry: LogInput, keepMs: number): Promise<void>
  // What /privacy promises for everything older than `before`: the log and open questions
  // deleted, closed questions stripped to the question, ratings stripped to their scores.
  // Run on every save and periodically.
  prune(before: number): Promise<void>
  // The log since `since`, newest first.
  log(since: number, limit: number): Promise<LogEntry[]>
  // One logged answer, whole, or null when it is not kept.
  entry(id: number): Promise<LogEntry | null>
  // Every rating whose answer's day is `sinceDay` or later, pruned ones included.
  ratings(sinceDay: string): Promise<Rating[]>
  ratingFor(logId: number): Promise<Rating | null>
  // Saves or replaces the rating of one rateable answer, copying the model, versions, kind,
  // outcome and day from the log row; null when the row is not kept, cannot be rated, or
  // does not allow an n/a it was given.
  saveRating(input: RatingInput): Promise<Rating | null>
  // Links a question to a rating that has none yet and whose answer is kept; answers the
  // question the rating carries after it (an earlier one wins), null when its answer is gone.
  linkRatingQuestion(ratingId: number, questionId: number): Promise<number | null>
  // "Add to my questions": the question made from a rating, once. An open one for the same
  // answer is used again: left by a save whose link failed, or the gap question the answer
  // itself raised; one that lost a race with another save is dropped.
  addRatingQuestion(ratingId: number, q: QuestionInput, keepMs: number): Promise<number | null>
  // The rateable answers since `since` that have no rating, newest first.
  unrated(since: number): Promise<number[]>
}

export const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10)
export const monthStart = (ts: number) => `${dayOf(ts).slice(0, 7)}-01`

type LogDb = { id: number; ts: number; visitor: string; kind: LogEntry['kind']; page: string | null; question: string; answer: string | null; outcome: Outcome; country: string | null; as_org: string | null; model: string | null; fallback: number | null; prompt_version: string | null; knowledge_version: string | null; sources: string | null }
type RatingDb = { id: number; log_id: number | null; day: string; model: string | null; fallback: number | null; prompt_version: string | null; knowledge_version: string | null; kind: LogEntry['kind']; outcome: Outcome; accurate: Criterion; supported: Criterion; answers: Criterion; tone: Criterion; overall: number; note: string | null; question_id: number | null; rated_at: number }

const flag = (value: number | null) => (value === null ? null : value === 1)
// The stored source ids, or null when there are none or the column is not a list.
const sourceList = (text: string | null) => {
  if (!text) return null
  try {
    const ids: unknown = JSON.parse(text)
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : null
  } catch {
    return null
  }
}
const logFromRow = (row: LogDb): LogEntry => ({ id: row.id, ts: row.ts, visitor: row.visitor, kind: row.kind, page: row.page, question: row.question, answer: row.answer, outcome: row.outcome, country: row.country, asOrg: row.as_org, model: row.model, fallback: flag(row.fallback), promptVersion: row.prompt_version, knowledgeVersion: row.knowledge_version, sources: sourceList(row.sources) })
const ratingFromRow = (row: RatingDb): Rating => ({ id: row.id, logId: row.log_id, day: row.day, model: row.model, fallback: flag(row.fallback), promptVersion: row.prompt_version, knowledgeVersion: row.knowledge_version, kind: row.kind, outcome: row.outcome, accurate: row.accurate, supported: row.supported, answers: row.answers, tone: row.tone, overall: row.overall, note: row.note, questionId: row.question_id, ratedAt: row.rated_at })

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
    const row = await this.db.prepare('SELECT COUNT(*) AS n FROM ask_hits WHERE ts >= ?').bind(since).first<{ n: number }>()
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

  async logQuestion(e: LogInput, keepMs: number) {
    const fallback = e.fallback === undefined || e.fallback === null ? null : e.fallback ? 1 : 0
    await this.db.prepare('INSERT INTO ask_log (ts, visitor, kind, page, question, answer, outcome, country, as_org, model, fallback, prompt_version, knowledge_version, sources) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(e.ts, e.visitor, e.kind, e.page, e.question, e.answer, e.outcome, e.country, e.asOrg, e.model ?? null, fallback, e.promptVersion ?? null, e.knowledgeVersion ?? null, e.sources ? JSON.stringify(e.sources) : null).run()
    await this.prune(e.ts - keepMs)
  }

  async prune(before: number) {
    // Open questions expire; closed ones stay, since the report card counts them, but only
    // the question is left: not the assistant's answer, the page or where it came from.
    // A rating outlives its answer without anything the visitor wrote or a link back to it:
    // stripped in the same batch, before the log rows go, plus a sweep (by the answer's day,
    // which is all a rating keeps) for any whose row went another way.
    await this.db.batch([
      this.db.prepare('UPDATE ask_ratings SET log_id = NULL, note = NULL, question_id = NULL WHERE log_id IN (SELECT id FROM ask_log WHERE ts < ?)').bind(before),
      this.db.prepare('UPDATE ask_ratings SET log_id = NULL, note = NULL, question_id = NULL WHERE day < ? AND (log_id IS NOT NULL OR note IS NOT NULL OR question_id IS NOT NULL)').bind(dayOf(before)),
      this.db.prepare('DELETE FROM ask_log WHERE ts < ?').bind(before),
      this.db.prepare('DELETE FROM ask_questions WHERE ts < ? AND resolved_at IS NULL').bind(before),
      this.db.prepare('UPDATE ask_questions SET page = NULL, answer = NULL, country = NULL, as_org = NULL WHERE ts < ? AND resolved_at IS NOT NULL AND (page IS NOT NULL OR answer IS NOT NULL OR country IS NOT NULL OR as_org IS NOT NULL)').bind(before),
    ])
  }

  async log(since: number, limit: number) {
    const { results } = await this.db.prepare('SELECT * FROM ask_log WHERE ts >= ? ORDER BY ts DESC LIMIT ?').bind(since, limit).all<LogDb>()
    return results.map(logFromRow)
  }

  async entry(id: number) {
    const row = await this.db.prepare('SELECT * FROM ask_log WHERE id = ?').bind(id).first<LogDb>()
    return row ? logFromRow(row) : null
  }

  async ratings(sinceDay: string) {
    const { results } = await this.db.prepare('SELECT * FROM ask_ratings WHERE day >= ? ORDER BY day, id').bind(sinceDay).all<RatingDb>()
    return results.map(ratingFromRow)
  }

  async ratingFor(logId: number) {
    const row = await this.db.prepare('SELECT * FROM ask_ratings WHERE log_id = ?').bind(logId).first<RatingDb>()
    return row ? ratingFromRow(row) : null
  }

  async saveRating(r: RatingInput) {
    // One statement checks that the answer is kept and rateable and writes the rating, so it
    // cannot race with prune(); what the answer was comes from its row, never from the request.
    const row = await this.db.prepare(`INSERT INTO ask_ratings (log_id, day, model, fallback, prompt_version, knowledge_version, kind, outcome, accurate, supported, answers, tone, overall, note, rated_at)
      SELECT id, strftime('%Y-%m-%d', ts / 1000, 'unixepoch'), model, fallback, prompt_version, knowledge_version, kind, outcome, ?2, ?3, ?4, ?5, ?6, ?7, ?8
      FROM ask_log WHERE id = ?1 AND outcome IN ('answered', 'gap', 'off') AND kind IN ('question', 'fit') AND (?3 <> 'na' OR outcome = 'off') AND (?5 <> 'na' OR outcome = 'off')
      ON CONFLICT(log_id) DO UPDATE SET accurate = excluded.accurate, supported = excluded.supported, answers = excluded.answers, tone = excluded.tone, overall = excluded.overall, note = excluded.note, rated_at = excluded.rated_at
      RETURNING *`).bind(r.logId, r.accurate, r.supported, r.answers, r.tone, r.overall, r.note, r.ratedAt).first<RatingDb>()
    return row ? ratingFromRow(row) : null
  }

  async linkRatingQuestion(ratingId: number, questionId: number) {
    const row = await this.db.prepare('UPDATE ask_ratings SET question_id = COALESCE(question_id, ?1) WHERE id = ?2 AND log_id IS NOT NULL RETURNING question_id').bind(questionId, ratingId).first<{ question_id: number | null }>()
    return row?.question_id ?? null
  }

  async addRatingQuestion(ratingId: number, q: QuestionInput, keepMs: number) {
    const open = await this.db.prepare("SELECT id FROM ask_questions WHERE ts = ? AND reason IN (?, 'gap') AND question = ? AND resolved_at IS NULL ORDER BY id LIMIT 1").bind(q.ts, q.reason, q.question).first<{ id: number }>()
    const id = open?.id ?? (await this.saveQuestion(q, keepMs))
    const linked = await this.linkRatingQuestion(ratingId, id)
    if (linked !== id && !open) await this.db.prepare('DELETE FROM ask_questions WHERE id = ? AND resolved_at IS NULL').bind(id).run()
    return linked
  }

  async unrated(since: number) {
    const { results } = await this.db.prepare(`SELECT l.id AS id FROM ask_log l LEFT JOIN ask_ratings r ON r.log_id = l.id
      WHERE l.ts >= ? AND l.outcome IN ('answered', 'gap', 'off') AND l.kind IN ('question', 'fit') AND r.id IS NULL ORDER BY l.ts DESC LIMIT 2000`).bind(since).all<{ id: number }>()
    return results.map((row) => row.id)
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
  ratingRows: Rating[] = []
  private logIds = 0
  private ratingIds = 0

  async countHits(ipHash: string, since: number) { return this.hits.filter((hit) => hit.ipHash === ipHash && hit.ts >= since).length }
  async countAllHits(since: number) { return this.hits.filter((hit) => hit.ts >= since).length }
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
  async logQuestion(e: LogInput, keepMs: number) {
    // Ids are never reused (AUTOINCREMENT in D1), so an old rating cannot attach to a newer answer.
    this.entries.push({ ...e, id: ++this.logIds, model: e.model ?? null, fallback: e.fallback ?? null, promptVersion: e.promptVersion ?? null, knowledgeVersion: e.knowledgeVersion ?? null, sources: e.sources ?? null })
    await this.prune(e.ts - keepMs)
  }
  async prune(before: number) {
    const gone = new Set(this.entries.filter((item) => item.ts < before).map((item) => item.id))
    const cutoffDay = dayOf(before)
    this.ratingRows = this.ratingRows.map((rating) => ((rating.logId !== null && gone.has(rating.logId)) || rating.day < cutoffDay ? { ...rating, logId: null, note: null, questionId: null } : rating))
    this.entries = this.entries.filter((item) => item.ts >= before)
    this.saved = this.saved.filter((item) => item.ts >= before || item.resolvedAt)
      .map((item) => item.ts < before ? { ...item, page: null, answer: null, country: null, asOrg: null } : item)
  }
  async log(since: number, limit: number) { return this.entries.filter((e) => e.ts >= since).sort((a, b) => b.ts - a.ts).slice(0, limit) }
  async entry(id: number) { return this.entries.find((e) => e.id === id) ?? null }
  async ratings(sinceDay: string) { return this.ratingRows.filter((r) => r.day >= sinceDay).sort((a, b) => a.day.localeCompare(b.day) || a.id - b.id) }
  async ratingFor(logId: number) { return this.ratingRows.find((r) => r.logId === logId) ?? null }
  async saveRating(r: RatingInput) {
    const e = this.entries.find((item) => item.id === r.logId)
    if (!e || !isRateable(e) || ((r.supported === 'na' || r.tone === 'na') && e.outcome !== 'off')) return null
    const scores = { accurate: r.accurate, supported: r.supported, answers: r.answers, tone: r.tone, overall: r.overall, note: r.note, ratedAt: r.ratedAt }
    const index = this.ratingRows.findIndex((item) => item.logId === r.logId)
    if (index >= 0) return (this.ratingRows[index] = { ...this.ratingRows[index], ...scores })
    const rating: Rating = { id: ++this.ratingIds, logId: e.id, day: dayOf(e.ts), model: e.model, fallback: e.fallback, promptVersion: e.promptVersion, knowledgeVersion: e.knowledgeVersion, kind: e.kind, outcome: e.outcome, questionId: null, ...scores }
    this.ratingRows.push(rating)
    return rating
  }
  async linkRatingQuestion(ratingId: number, questionId: number) {
    const rating = this.ratingRows.find((r) => r.id === ratingId && r.logId !== null)
    if (!rating) return null
    const linked = rating.questionId ?? questionId
    this.ratingRows = this.ratingRows.map((r) => (r === rating ? { ...r, questionId: linked } : r))
    return linked
  }
  async addRatingQuestion(ratingId: number, q: QuestionInput, keepMs: number) {
    const open = this.saved.find((item) => item.ts === q.ts && (item.reason === q.reason || item.reason === 'gap') && item.question === q.question && !item.resolvedAt)
    const id = open?.id ?? (await this.saveQuestion(q, keepMs))
    const linked = await this.linkRatingQuestion(ratingId, id)
    if (linked !== id && !open) this.saved = this.saved.filter((item) => item.id !== id)
    return linked
  }
  async unrated(since: number) {
    const rated = new Set(this.ratingRows.map((r) => r.logId))
    return this.entries.filter((e) => e.ts >= since && isRateable(e) && !rated.has(e.id)).sort((a, b) => b.ts - a.ts).map((e) => e.id)
  }
}
