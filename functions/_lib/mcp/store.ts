// Storage for the career dossier. The D1 store is used in production; the memory
// store backs the tests and documents the same behaviour without SQL.

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

export type Question = { ts: number; visitor: string | null; tool: string; query: string | null; role: string | null; hits: number | null; country: string | null; asOrg: string | null }
export type ProposalStatus = 'proposed' | 'approved' | 'rejected' | 'applied'
export type Proposal = { id: number; createdAt: number; updatedAt: number; role: string; kind: 'replace' | 'add' | 'remove'; currentText: string | null; proposedText: string | null; rationale: string; basedOn: string | null; status: ProposalStatus; decisionNote: string | null }
export type ProposalInput = Omit<Proposal, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'decisionNote'>
export type Message = { id: number; ts: number; name: string | null; company: string | null; contact: string | null; message: string; country: string | null; asOrg: string | null }

export interface DossierStore {
  list(filter: EntryFilter): Promise<DossierEntry[]>
  get(id: number): Promise<DossierEntry | null>
  insert(input: EntryInput, now: number): Promise<DossierEntry>
  update(id: number, patch: Partial<EntryInput>, now: number): Promise<DossierEntry | null>
  remove(id: number): Promise<boolean>
  // Ranks entries by how many of the terms appear in them (title matches count double).
  search(terms: string[], filter: EntryFilter, limit: number): Promise<DossierEntry[]>
  logQuestion(question: Question): Promise<void>
  countQuestions(visitor: string, since: number): Promise<number>
  recentQuestions(since: number, limit: number): Promise<Question[]>
  addMessage(message: Omit<Message, 'id'>): Promise<number>
  countMessages(visitor: string, since: number): Promise<number>
  recentMessages(since: number, limit: number): Promise<Message[]>
  listProposals(status?: ProposalStatus): Promise<Proposal[]>
  insertProposal(input: ProposalInput, now: number): Promise<Proposal>
  decideProposal(id: number, status: ProposalStatus, note: string | null, now: number): Promise<Proposal | null>
}

type ProposalRow = { id: number; created_at: number; updated_at: number; role: string; kind: Proposal['kind']; current_text: string | null; proposed_text: string | null; rationale: string; based_on: string | null; status: ProposalStatus; decision_note: string | null }
const proposalFromRow = (row: ProposalRow): Proposal => ({ id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, role: row.role, kind: row.kind, currentText: row.current_text, proposedText: row.proposed_text, rationale: row.rationale, basedOn: row.based_on, status: row.status, decisionNote: row.decision_note })

type Row = { id: number; created_at: number; updated_at: number; role: string; topic: string; title: string; body: string; visibility: Visibility; tags: string | null }
const fromRow = (row: Row): DossierEntry => ({ id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, role: row.role, topic: row.topic, title: row.title, body: row.body, visibility: row.visibility, tags: row.tags })

const filterSql = (filter: EntryFilter) => {
  const where: string[] = []
  const params: unknown[] = []
  if (filter.role) { where.push('role = ?'); params.push(filter.role) }
  if (filter.topic) { where.push('topic = ?'); params.push(filter.topic) }
  if (filter.visibility) { where.push('visibility = ?'); params.push(filter.visibility) }
  return { where, params }
}

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

  async logQuestion(q: Question) {
    await this.db.prepare('INSERT INTO dossier_questions (ts, visitor, tool, query, role, hits, country, as_org) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(q.ts, q.visitor, q.tool, q.query, q.role, q.hits, q.country, q.asOrg).run()
  }

  async countQuestions(visitor: string, since: number) {
    const row = await this.db.prepare('SELECT COUNT(*) AS n FROM dossier_questions WHERE visitor = ? AND ts >= ?').bind(visitor, since).first<{ n: number }>()
    return row?.n ?? 0
  }

  async recentQuestions(since: number, limit: number) {
    const { results } = await this.db.prepare('SELECT ts, visitor, tool, query, role, hits, country, as_org AS asOrg FROM dossier_questions WHERE ts >= ? ORDER BY ts DESC LIMIT ?').bind(since, limit).all<Question>()
    return results
  }

  async addMessage(m: Omit<Message, 'id'>) {
    const row = await this.db.prepare('INSERT INTO dossier_messages (ts, name, company, contact, message, country, as_org) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id')
      .bind(m.ts, m.name, m.company, m.contact, m.message, m.country, m.asOrg).first<{ id: number }>()
    return row!.id
  }

  async countMessages(visitor: string, since: number) {
    const row = await this.db.prepare("SELECT COUNT(*) AS n FROM dossier_questions WHERE visitor = ? AND tool = 'leave_message' AND ts >= ?").bind(visitor, since).first<{ n: number }>()
    return row?.n ?? 0
  }

  async recentMessages(since: number, limit: number) {
    const { results } = await this.db.prepare('SELECT id, ts, name, company, contact, message, country, as_org AS asOrg FROM dossier_messages WHERE ts >= ? ORDER BY ts DESC LIMIT ?').bind(since, limit).all<Message>()
    return results
  }

  async listProposals(status?: ProposalStatus) {
    const { results } = status
      ? await this.db.prepare('SELECT * FROM resume_proposals WHERE status = ? ORDER BY id').bind(status).all<ProposalRow>()
      : await this.db.prepare('SELECT * FROM resume_proposals ORDER BY id').all<ProposalRow>()
    return results.map(proposalFromRow)
  }

  async insertProposal(input: ProposalInput, now: number) {
    const row = await this.db.prepare('INSERT INTO resume_proposals (created_at, updated_at, role, kind, current_text, proposed_text, rationale, based_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *')
      .bind(now, now, input.role, input.kind, input.currentText, input.proposedText, input.rationale, input.basedOn).first<ProposalRow>()
    return proposalFromRow(row!)
  }

  async decideProposal(id: number, status: ProposalStatus, note: string | null, now: number) {
    const row = await this.db.prepare('UPDATE resume_proposals SET status = ?, decision_note = ?, updated_at = ? WHERE id = ? RETURNING *').bind(status, note, now, id).first<ProposalRow>()
    return row ? proposalFromRow(row) : null
  }
}

export class MemoryStore implements DossierStore {
  entries: DossierEntry[] = []
  questions: Question[] = []
  messages: Message[] = []
  proposals: Proposal[] = []
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

  async logQuestion(question: Question) { this.questions.push(question) }
  async countQuestions(visitor: string, since: number) { return this.questions.filter((q) => q.visitor === visitor && q.ts >= since).length }
  async recentQuestions(since: number, limit: number) { return this.questions.filter((q) => q.ts >= since).sort((a, b) => b.ts - a.ts).slice(0, limit) }
  async addMessage(message: Omit<Message, 'id'>) { const id = this.messages.length + 1; this.messages.push({ id, ...message }); return id }
  async countMessages(visitor: string, since: number) { return this.questions.filter((q) => q.visitor === visitor && q.tool === 'leave_message' && q.ts >= since).length }
  async recentMessages(since: number, limit: number) { return this.messages.filter((m) => m.ts >= since).sort((a, b) => b.ts - a.ts).slice(0, limit) }
  async listProposals(status?: ProposalStatus) { return this.proposals.filter((p) => !status || p.status === status) }
  async insertProposal(input: ProposalInput, now: number) { const proposal: Proposal = { id: this.proposals.length + 1, createdAt: now, updatedAt: now, status: 'proposed', decisionNote: null, ...input }; this.proposals.push(proposal); return proposal }
  async decideProposal(id: number, status: ProposalStatus, note: string | null, now: number) {
    const proposal = this.proposals.find((p) => p.id === id)
    if (!proposal) return null
    Object.assign(proposal, { status, decisionNote: note, updatedAt: now })
    return proposal
  }
}
