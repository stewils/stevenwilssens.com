// What Steven has seen on the admin's Team page: per update (a commit's full SHA), read or
// unread, in D1 (migrations/0011_team_reads.sql). Fixed SQL with bound parameters only.
// Marking is an upsert and idempotent: `read` keeps the first time it was read, `unread`
// only flips a read row (or stores a new one), so repeating a request changes nothing.

export type TeamAction = 'read' | 'unread' | 'readAll'
export type TeamReadState = { read: string[]; unread: string[] }

const schema = `CREATE TABLE IF NOT EXISTS team_reads (id TEXT PRIMARY KEY CHECK (length(id) = 40 AND id NOT GLOB '*[^0-9a-f]*'),
  read INTEGER NOT NULL CHECK (read IN (0, 1)), at INTEGER NOT NULL)`
let ensured: Promise<unknown> | null = null

const markRead = `INSERT INTO team_reads (id, read, at) VALUES (?1, 1, ?2)
  ON CONFLICT(id) DO UPDATE SET read = 1, at = excluded.at WHERE team_reads.read = 0`
const markUnread = `INSERT INTO team_reads (id, read, at) VALUES (?1, 0, ?2)
  ON CONFLICT(id) DO UPDATE SET read = 0, at = excluded.at WHERE team_reads.read = 1`

export class TeamReads {
  constructor(private db: D1Database) {}

  // The table is created here too when the migration was not applied before the deploy.
  ensure() {
    ensured ??= this.db.prepare(schema).run().catch((error: unknown) => { ensured = null; throw error })
    return ensured
  }

  // The newest 1 000 rows, split into read and unread ids.
  async state(): Promise<TeamReadState> {
    await this.ensure()
    const { results } = await this.db.prepare('SELECT id, read FROM team_reads ORDER BY at DESC, id LIMIT 1000').all<{ id: string; read: number }>()
    return { read: results.filter((row) => row.read === 1).map((row) => row.id), unread: results.filter((row) => row.read === 0).map((row) => row.id) }
  }

  async mark(action: TeamAction, ids: string[], now = Date.now()) {
    await this.ensure()
    const sql = action === 'unread' ? markUnread : markRead
    await this.db.batch(ids.map((id) => this.db.prepare(sql).bind(id, now)))
  }
}

// For the tests: forget that the table was made, as a new isolate would.
export const resetTeamReads = () => { ensured = null }
