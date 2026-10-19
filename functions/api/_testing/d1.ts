// Test support for the Pages Functions: a D1 database backed by an in-memory SQLite
// (node:sqlite) with every migration applied, so the handlers run their real SQL.
// Not a route: it exports no onRequest handler. Only the tests import it.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

const migrations = fileURLToPath(new URL('../../../migrations', import.meta.url).href)

const value = (input: unknown): SQLInputValue => {
  if (input === undefined || input === null) return null
  if (typeof input === 'boolean') return input ? 1 : 0
  return input as SQLInputValue
}

export type FakeD1 = D1Database & { sqlite: DatabaseSync; queries: string[]; failOn?: RegExp }

export const fakeD1 = (): FakeD1 => {
  const sqlite = new DatabaseSync(':memory:')
  for (const file of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(join(migrations, file), 'utf8'))
  const queries: string[] = []
  const db = { sqlite, queries } as unknown as FakeD1

  const statement = (sql: string, params: unknown[] = []) => {
    const run = <T>(work: () => T): Promise<T> => {
      queries.push(sql)
      if (db.failOn?.test(sql)) return Promise.reject(new Error('D1_ERROR: forced failure'))
      try { return Promise.resolve(work()) } catch (error) { return Promise.reject(error) }
    }
    const prepared = () => sqlite.prepare(sql)
    const args = () => params.map(value)
    return {
      sql,
      bind: (...values: unknown[]) => statement(sql, values),
      all: () => run(() => ({ results: prepared().all(...args()).map((row) => ({ ...row })), success: true, meta: {} })),
      first: (column?: string) => run(() => {
        const row = prepared().get(...args()) as Record<string, unknown> | undefined
        if (!row) return null
        return column ? row[column] : { ...row }
      }),
      run: () => run(() => {
        const result = prepared().run(...args())
        return { results: [], success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }
      }),
    }
  }
  db.prepare = ((sql: string) => statement(sql)) as unknown as D1Database['prepare']
  db.batch = (async (statements: { all: () => Promise<unknown> }[]) => {
    const results = []
    for (const item of statements) results.push(await item.all())
    return results
  }) as unknown as D1Database['batch']
  return db
}

// The site's static files (env.ASSETS), answered from a map of path to body.
export const fakeAssets = (files: Record<string, string>, seen: string[] = []) => ({
  fetch: async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname
    seen.push(path)
    return path in files ? new Response(files[path]) : new Response('not found', { status: 404 })
  },
}) as unknown as Fetcher

// The context Pages hands a function. Everything the handler leaves to waitUntil is kept, so a test can await it.
export const context = <E>(request: Request, env: E, extra: { params?: Record<string, string>; next?: () => Promise<Response> } = {}) => {
  const pending: Promise<unknown>[] = []
  return {
    pending,
    settled: () => Promise.allSettled(pending),
    ctx: {
      request,
      env,
      params: extra.params ?? {},
      next: extra.next ?? (async () => new Response('page')),
      waitUntil: (promise: Promise<unknown>) => { pending.push(promise) },
      passThroughOnException: () => {},
      data: {},
      functionPath: '',
    } as unknown as EventContext<E, string, Record<string, unknown>>,
  }
}
