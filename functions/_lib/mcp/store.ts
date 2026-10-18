// Storage for the career dossier. The D1 store is used in production; the memory
// store backs the tests and documents the same behaviour without SQL.
import { questionFromRow, type Resolution, type SavedQuestion } from '../ask/store'

export type Visibility = 'public' | 'private'

export type DossierEntry = {
  id: number
  createdAt: number
  updatedAt: number
  role: string
  topic: string
  title: string
  body: string
  visibility: Visibility
  tags: string | null
}

export type EntryInput = Omit<DossierEntry, 'id' | 'createdAt' | 'updatedAt'>
export type EntryFilter = { role?: string; topic?: string; visibility?: Visibility }

export type ProposalStatus = 'proposed' | 'approved' | 'rejected' | 'applied'
// field: for a role, which part changes (title | company | dates | location | summary | point); null for the headline, summary, skills and education sections.
export type Proposal = { id: number; createdAt: number; updatedAt: number; role: string; field: string | null; kind: 'replace' | 'add' | 'remove'; currentText: string | null; proposedText: string | null; rationale: string; basedOn: string | null; status: ProposalStatus; decisionNote: string | null }
export type ProposalInput = Omit<Proposal, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'decisionNote'>

// A question from the site that waits for Steven: what the assistant could not answer
// (gap), a requirement a pasted job description named that the record does not show
// (fit), or an answer a reader voted down (unhelpful).
export type AskGap = { id: number; question: string; when: string; reason: SavedQuestion['reason']; page: string | null; answer: string | null }
// One call to the public MCP server, kept so /admin shows whether anyone uses it. No IP, no visitor.
export type ToolCall = { ts: number; tool: string; query: string | null; role: string | null; hits: number | null; country: string | null; asOrg: string | null }
export type ToolCallRow = ToolCall & { id: number }

export interface DossierStore {
  list(filter: EntryFilter): Promise<DossierEntry[]>
  get(id: number): Promise<DossierEntry | null>
  insert(input: EntryInput, now: number): Promise<DossierEntry>
  update(id: number, patch: Partial<EntryInput>, now: number): Promise<DossierEntry | null>
  remove(id: number): Promise<boolean>
  // Ranks entries by how many of the terms appear in them (title matches count double).
  search(terms: string[], filter: EntryFilter, limit: number): Promise<DossierEntry[]>
  listProposals(status?: ProposalStatus): Promise<Proposal[]>
  insertProposal(input: ProposalInput, now: number): Promise<Proposal>
  decideProposal(id: number, status: ProposalStatus, note: string | null, now: number): Promise<Proposal | null>
  // Open questions from the site assistant (ask_questions, not yet answered or dismissed), newest first.
  askGaps(limit: number): Promise<AskGap[]>
  getAskGap(id: number): Promise<AskGap | null>
  // Closes a question: answered with a dossier entry, or dismissed. False when there is no open question with that id.
  resolveAskGap(id: number, resolution: Resolution, entryId: number | null, now: number): Promise<boolean>
  // Steven's LinkedIn profile as last imported through save_linkedin_profile (one row, parsed profile as JSON).
  getLinkedIn(): Promise<LinkedInRecord | null>
  saveLinkedIn(json: string, source: string, now: number): Promise<void>
  // The public server's use.
  logToolCall(call: ToolCall): Promise<void>
  toolCalls(since: number, limit: number): Promise<ToolCallRow[]>
}
export type LinkedInRecord = { json: string; source: string; importedAt: number }

type ProposalRow = { id: number; created_at: number; updated_at: number; role: string; field: string | null; kind: Proposal['kind']; current_text: string | null; proposed_text: string | null; rationale: string; based_on: string | null; status: ProposalStatus; decision_note: string | null }
const proposalFromRow = (row: ProposalRow): Proposal => ({ id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, role: row.role, field: row.field ?? null, kind: row.kind, currentText: row.current_text, proposedText: row.proposed_text, rationale: row.rationale, basedOn: row.based_on, status: row.status, decisionNote: row.decision_note })

type Row = { id: number; created_at: number; updated_at: number; role: string; topic: string; title: string; body: string; visibility: Visibility; tags: string | null }
const fromRow = (row: Row): DossierEntry => ({ id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, role: row.role, topic: row.topic, title: row.title, body: row.body, visibility: row.visibility, tags: row.tags })

export const gapFromQuestion = (q: SavedQuestion): AskGap => ({ id: q.id, question: q.question, when: new Date(q.ts).toISOString().slice(0, 10), reason: q.reason, page: q.page, answer: q.answer })

const filterSql = (filter: EntryFilter) => {
  const where: string[] = []
  const params: unknown[] = []
  if (filter.role) { where.push('role = ?'); params.push(filter.role) }
  if (filter.topic) { where.push('topic = ?'); params.push(filter.topic) }
  if (filter.visibility) { where.push('visibility = ?'); params.push(filter.visibility) }
  return { where, params }
}

type QuestionDb = Parameters<typeof questionFromRow>[0]
type ToolCallDb = { id: number; ts: number; tool: string; query: string | null; role: string | null; hits: number | null; country: string | null; as_org: string | null }
const toolCallRetentionMs = 90 * 86_400_000

export class D1Store implements DossierStore {
  constructor(private db: D1Database) {}

  async list(filter: EntryFilter) {
    const { where, params } = filterSql(filter)
    const sql = `SELECT * FROM dossier${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY role, topic, id`
    const { results } = await this.db.prepare(sql).bind(...params).all<Row>()
    return results.map(fromRow)
  }

  async get(id: number) {
    const row = await this.db.prepare('SELECT * FROM dossier WHERE id = ?').bind(id).first<Row>()
    return row ? fromRow(row) : null
  }

  async insert(input: EntryInput, now: number) {
    const row = await this.db.prepare('INSERT INTO dossier (created_at, updated_at, role, topic, title, body, visibility, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *')
      .bind(now, now, input.role, input.topic, input.title, input.body, input.visibility, input.tags).first<Row>()
    return fromRow(row!)
  }

  async update(id: number, patch: Partial<EntryInput>, now: number) {
    const current = await this.get(id)
    if (!current) return null
    const next = { ...current, ...patch }
    const row = await this.db.prepare('UPDATE dossier SET updated_at = ?, role = ?, topic = ?, title = ?, body = ?, visibility = ?, tags = ? WHERE id = ? RETURNING *')
      .bind(now, next.role, next.topic, next.title, next.body, next.visibility, next.tags, id).first<Row>()
    return row ? fromRow(row) : null
  }

  async remove(id: number) {
    const result = await this.db.prepare('DELETE FROM dossier WHERE id = ?').bind(id).run()
    return (result.meta.changes ?? 0) > 0
  }

  async search(terms: string[], filter: EntryFilter, limit: number) {
    if (!terms.length) return []
    const { where, params } = filterSql(filter)
    // instr() on lower-cased text: a plain substring test, so "experiment" also finds "experimentation".
    const score = terms.map(() => "(instr(lower(title), ?) > 0) * 2 + (instr(lower(body || ' ' || coalesce(tags, '')), ?) > 0)").join(' + ')
    const scoreParams = terms.flatMap((term) => [term, term])
    const sql = `SELECT * FROM (SELECT *, ${score} AS score FROM dossier${where.length ? ` WHERE ${where.join(' AND ')}` : ''}) WHERE score > 0 ORDER BY score DESC, updated_at DESC LIMIT ?`
    const { results } = await this.db.prepare(sql).bind(...scoreParams, ...params, limit).all<Row>()
    return results.map(fromRow)
  }

  async listProposals(status?: ProposalStatus) {
    const { results } = status
      ? await this.db.prepare('SELECT * FROM resume_proposals WHERE status = ? ORDER BY id').bind(status).all<ProposalRow>()
      : await this.db.prepare('SELECT * FROM resume_proposals ORDER BY id').all<ProposalRow>()
    return results.map(proposalFromRow)
  }

  async insertProposal(input: ProposalInput, now: number) {
    const row = await this.db.prepare('INSERT INTO resume_proposals (created_at, updated_at, role, field, kind, current_text, proposed_text, rationale, based_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *')
      .bind(now, now, input.role, input.field, input.kind, input.currentText, input.proposedText, input.rationale, input.basedOn).first<ProposalRow>()
    return proposalFromRow(row!)
  }

  async decideProposal(id: number, status: ProposalStatus, note: string | null, now: number) {
    const row = await this.db.prepare('UPDATE resume_proposals SET status = ?, decision_note = ?, updated_at = ? WHERE id = ? RETURNING *').bind(status, note, now, id).first<ProposalRow>()
    return row ? proposalFromRow(row) : null
  }

  async askGaps(limit: number) {
    const { results } = await this.db.prepare('SELECT * FROM ask_questions WHERE resolved_at IS NULL ORDER BY ts DESC LIMIT ?').bind(limit).all<QuestionDb>()
    return results.map((row) => gapFromQuestion(questionFromRow(row)))
  }

  async getAskGap(id: number) {
    const row = await this.db.prepare('SELECT * FROM ask_questions WHERE id = ? AND resolved_at IS NULL').bind(id).first<QuestionDb>()
    return row ? gapFromQuestion(questionFromRow(row)) : null
  }

  async resolveAskGap(id: number, resolution: Resolution, entryId: number | null, now: number) {
    const result = await this.db.prepare('UPDATE ask_questions SET resolved_at = ?, resolution = ?, entry_id = ? WHERE id = ? AND resolved_at IS NULL').bind(now, resolution, entryId, id).run()
    return (result.meta.changes ?? 0) > 0
  }

  async getLinkedIn() {
    const row = await this.db.prepare('SELECT json, source, imported_at FROM linkedin_profile WHERE id = 1').first<{ json: string; source: string; imported_at: number }>()
    return row ? { json: row.json, source: row.source, importedAt: row.imported_at } : null
  }

  async saveLinkedIn(json: string, source: string, now: number) {
    await this.db.prepare('INSERT INTO linkedin_profile (id, imported_at, source, json) VALUES (1, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET imported_at = excluded.imported_at, source = excluded.source, json = excluded.json').bind(now, source, json).run()
  }

  async logToolCall(call: ToolCall) {
    await this.db.prepare('INSERT INTO mcp_calls (ts, tool, query, role, hits, country, as_org) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(call.ts, call.tool, call.query, call.role, call.hits, call.country, call.asOrg).run()
    if (Math.random() < 0.05) await this.db.prepare('DELETE FROM mcp_calls WHERE ts < ?').bind(call.ts - toolCallRetentionMs).run()
  }

  async toolCalls(since: number, limit: number) {
    const { results } = await this.db.prepare('SELECT * FROM mcp_calls WHERE ts >= ? ORDER BY ts DESC LIMIT ?').bind(since, limit).all<ToolCallDb>()
    return results.map((row) => ({ id: row.id, ts: row.ts, tool: row.tool, query: row.query, role: row.role, hits: row.hits, country: row.country, asOrg: row.as_org }))
  }
}

export class MemoryStore implements DossierStore {
  entries: DossierEntry[] = []
  proposals: Proposal[] = []
  gaps: (AskGap & { resolvedAt?: number | null; resolution?: Resolution | null; entryId?: number | null })[] = []
  calls: ToolCallRow[] = []
  private nextId = 1

  private matches = (entry: DossierEntry, filter: EntryFilter) =>
    (!filter.role || entry.role === filter.role) && (!filter.topic || entry.topic === filter.topic) && (!filter.visibility || entry.visibility === filter.visibility)

  async list(filter: EntryFilter) {
    return this.entries.filter((entry) => this.matches(entry, filter)).sort((a, b) => a.role.localeCompare(b.role) || a.topic.localeCompare(b.topic) || a.id - b.id)
  }

  async get(id: number) { return this.entries.find((entry) => entry.id === id) ?? null }

  async insert(input: EntryInput, now: number) {
    const entry: DossierEntry = { id: this.nextId++, createdAt: now, updatedAt: now, ...input }
    this.entries.push(entry)
    return entry
  }

  async update(id: number, patch: Partial<EntryInput>, now: number) {
    const index = this.entries.findIndex((entry) => entry.id === id)
    if (index < 0) return null
    this.entries[index] = { ...this.entries[index], ...patch, updatedAt: now }
    return this.entries[index]
  }

  async remove(id: number) {
    const before = this.entries.length
    this.entries = this.entries.filter((entry) => entry.id !== id)
    return this.entries.length < before
  }

  async search(terms: string[], filter: EntryFilter, limit: number) {
    if (!terms.length) return []
    const scored = this.entries.filter((entry) => this.matches(entry, filter)).map((entry) => {
      const title = entry.title.toLowerCase()
      const rest = `${entry.body} ${entry.tags ?? ''}`.toLowerCase()
      const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 2 : 0) + (rest.includes(term) ? 1 : 0), 0)
      return { entry, score }
    }).filter((item) => item.score > 0)
    return scored.sort((a, b) => b.score - a.score || b.entry.updatedAt - a.entry.updatedAt).slice(0, limit).map((item) => item.entry)
  }

  async listProposals(status?: ProposalStatus) { return this.proposals.filter((p) => !status || p.status === status) }
  async insertProposal(input: ProposalInput, now: number) { const proposal: Proposal = { id: this.proposals.length + 1, createdAt: now, updatedAt: now, status: 'proposed', decisionNote: null, ...input }; this.proposals.push(proposal); return proposal }
  async decideProposal(id: number, status: ProposalStatus, note: string | null, now: number) {
    const proposal = this.proposals.find((p) => p.id === id)
    if (!proposal) return null
    Object.assign(proposal, { status, decisionNote: note, updatedAt: now })
    return proposal
  }
  private shapeGap = ({ id, question, when, reason, page, answer }: AskGap): AskGap => ({ id, question, when, reason, page, answer })
  async askGaps(limit: number) { return this.gaps.filter((gap) => !gap.resolvedAt).slice(0, limit).map(this.shapeGap) }
  async getAskGap(id: number) { const gap = this.gaps.find((item) => item.id === id && !item.resolvedAt); return gap ? this.shapeGap(gap) : null }
  async resolveAskGap(id: number, resolution: Resolution, entryId: number | null, now: number) {
    const gap = this.gaps.find((item) => item.id === id && !item.resolvedAt)
    if (!gap) return false
    Object.assign(gap, { resolvedAt: now, resolution, entryId })
    return true
  }
  linkedin: LinkedInRecord | null = null
  async getLinkedIn() { return this.linkedin }
  async saveLinkedIn(json: string, source: string, now: number) { this.linkedin = { json, source, importedAt: now } }
  async logToolCall(call: ToolCall) { this.calls.push({ id: this.calls.length + 1, ...call }) }
  async toolCalls(since: number, limit: number) { return this.calls.filter((call) => call.ts >= since).sort((a, b) => b.ts - a.ts).slice(0, limit) }
}

// The dossier as the public server sees it: public entries only, and nothing can be
// changed. Writes are refused rather than hidden, so a tool that reaches one by
// mistake fails loudly.
export class ReadOnlyError extends Error { constructor() { super('This server is read-only: it serves what Steven published and nothing else.') } }
export const publicView = (store: DossierStore): DossierStore => {
  const refuse = () => Promise.reject(new ReadOnlyError())
  return {
    list: (filter) => store.list({ ...filter, visibility: 'public' }),
    get: async (id) => { const entry = await store.get(id); return entry?.visibility === 'public' ? entry : null },
    search: (terms, filter, limit) => store.search(terms, { ...filter, visibility: 'public' }, limit),
    insert: refuse, update: refuse, remove: refuse,
    listProposals: async () => [], insertProposal: refuse, decideProposal: refuse,
    askGaps: async () => [], getAskGap: async () => null, resolveAskGap: refuse,
    getLinkedIn: async () => null, saveLinkedIn: refuse,
    logToolCall: (call) => store.logToolCall(call),
    toolCalls: async () => [],
  }
}
