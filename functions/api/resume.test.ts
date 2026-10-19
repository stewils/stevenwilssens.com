// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../_lib/env'
import { context, fakeAssets, fakeD1, type FakeD1 } from '../_lib/testing/d1'
import { onRequestGet } from './resume'

const token = 'admin-secret'
const report = { score: 92, pdfHash: 'abc123', errors: 0, warnings: 1, pages: 2, bytes: 300_000, commit: 'deadbeef', commitMessage: 'Sharper headline', checkedAt: '2026-10-18T10:00:00Z', findings: [{ severity: 'warning', id: 'tense', message: 'Mixed tense', lens: 'ats' }, { severity: 'info', id: 'note', message: 'fyi' }], questions: [] }
const get = (auth: string | null = `Bearer ${token}`) => new Request('https://steven.wilssens.com/api/resume', { headers: auth ? { Authorization: auth } : {} })
const send = async (request: Request, files: Record<string, string>, db: FakeD1 = fakeD1(), env: Partial<Env> = { ADMIN_TOKEN: token }) => {
  const { ctx } = context(request, { DB: db, ASSETS: fakeAssets(files), ...env } as Env)
  return onRequestGet(ctx)
}

afterEach(() => vi.restoreAllMocks())

describe('GET /api/resume', () => {
  it('refuses without the admin token, with a wrong one, and when none is configured', async () => {
    const db = fakeD1()
    expect((await send(get(null), {}, db)).status).toBe(401)
    expect((await send(get('Bearer wrong'), {}, db)).status).toBe(401)
    expect((await send(get(), {}, db, {})).status).toBe(401)
    expect(db.queries).toHaveLength(0)
  })

  it("answers this deployment's report and records it in the history once", async () => {
    const db = fakeD1()
    const files = { '/resume-report.json': JSON.stringify(report) }
    const first = await send(get(), files, db)
    expect(first.status).toBe(200)
    expect(first.headers.get('Cache-Control')).toBe('no-store')
    const data = await first.json() as { report: { score: number }; history: { score: number; findings: unknown[] }[] }
    expect(data.report.score).toBe(92)
    expect(data.history).toHaveLength(1)
    expect(data.history[0]).toMatchObject({ score: 92 })
    const again = await (await send(get(), files, db)).json() as { history: unknown[] }
    expect(again.history).toHaveLength(1)
  })

  it('answers without a report when the deployment has none or it does not parse', async () => {
    expect(await (await send(get(), {})).json()).toEqual({ report: null, history: [] })
    expect(await (await send(get(), { '/resume-report.json': 'not json' })).json()).toEqual({ report: null, history: [] })
    const throwing = { fetch: async () => { throw new Error('assets down') } } as unknown as Fetcher
    const { ctx } = context(get(), { DB: fakeD1(), ASSETS: throwing, ADMIN_TOKEN: token } as Env)
    expect(await (await onRequestGet(ctx)).json()).toEqual({ report: null, history: [] })
  })

  it('still answers the history when recording fails', async () => {
    const db = fakeD1()
    db.failOn = /INSERT INTO resume_scores/
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await send(get(), { '/resume-report.json': JSON.stringify(report) }, db)
    expect(response.status).toBe(200)
    expect(((await response.json()) as { history: unknown[] }).history).toEqual([])
    expect(error).toHaveBeenCalledWith('resume score record failed', expect.any(Error))
  })
})
