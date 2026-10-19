// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { profile } from '../../src/resume'
import type { Env } from '../_lib/env'
import { context, fakeD1, type FakeD1 } from '../_lib/testing/d1'
import { onRequestGet } from './mcp'

const token = 'admin-secret'
const get = (query = '', auth: string | null = `Bearer ${token}`) => new Request(`https://steven.wilssens.com/api/mcp${query}`, { headers: auth ? { Authorization: auth } : {} })
const send = async (request: Request, db: FakeD1 = fakeD1(), env: Partial<Env> = { ADMIN_TOKEN: token, MCP_OWNER_KEY: 'owner-key' }) => {
  const { ctx } = context(request, { DB: db, ...env } as Env)
  return onRequestGet(ctx)
}

const now = Date.now()
const entry = (db: FakeD1, role: string, visibility: string) => db.sqlite.prepare("INSERT INTO dossier (created_at, updated_at, role, topic, title, body, visibility) VALUES (?, ?, ?, 'scope', 'T', 'B', ?)").run(now, now, role, visibility)
const proposal = (db: FakeD1, status: string, proposed: string, role = 'headline') => db.sqlite.prepare("INSERT INTO resume_proposals (created_at, updated_at, role, kind, current_text, proposed_text, rationale, status) VALUES (?, ?, ?, 'replace', 'old', ?, 'why', ?)").run(now, now, role, proposed, status)
const call = (db: FakeD1, tool: string, ts = now - 1000) => db.sqlite.prepare("INSERT INTO mcp_calls (ts, tool, query, role, hits, country, as_org) VALUES (?, ?, 'pm lead', null, 2, 'BE', 'ISP')").run(ts, tool)

afterEach(() => vi.restoreAllMocks())

describe('GET /api/mcp', () => {
  it('refuses without the admin token, with a wrong one, and when no admin token is configured', async () => {
    expect((await send(get('', null))).status).toBe(401)
    expect((await send(get('', 'Bearer owner-key'))).status).toBe(401)
    const unset = await send(get(), fakeD1(), { MCP_OWNER_KEY: 'owner-key' })
    expect(unset.status).toBe(401)
    expect(await unset.json()).toEqual({ error: 'unauthorized' })
  })

  it('shows the owner link, the dossier counts, the open proposals newest first and the public calls per tool', async () => {
    const db = fakeD1()
    entry(db, 'csx-data', 'public')
    entry(db, 'csx-data', 'private')
    entry(db, 'general', 'public')
    proposal(db, 'proposed', 'A new headline nobody wrote yet')
    proposal(db, 'rejected', 'Rejected headline')
    proposal(db, 'approved', 'Another headline still waiting')
    call(db, 'get_resume', now - 500)
    call(db, 'get_role')
    call(db, 'get_role')
    call(db, 'get_role', now - 40 * 86_400_000)
    const response = await send(get(), db)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const data = await response.json() as Record<string, any>
    expect(data.ownerUrl).toBe('https://steven.wilssens.com/mcp/owner-key')
    expect(data.publicUrl).toBe('https://steven.wilssens.com/mcp')
    expect(data.entries).toEqual({ total: 3, public: 2, roles: 2 })
    expect(data.proposals.map((p: { proposedText: string }) => p.proposedText)).toEqual(['Another headline still waiting', 'A new headline nobody wrote yet'])
    expect(data.publicCalls).toMatchObject({ days: 30, total: 3, byTool: [{ tool: 'get_role', calls: 2 }, { tool: 'get_resume', calls: 1 }] })
    expect(data.publicCalls.recent[0]).toEqual({ ts: now - 500, tool: 'get_resume', query: 'pm lead', country: 'BE', asOrg: 'ISP' })
  })

  it('has no owner link without an owner key, and clamps the period', async () => {
    const db = fakeD1()
    call(db, 'get_role', now - 40 * 86_400_000)
    const year = await (await send(get('?days=99999'), db, { ADMIN_TOKEN: token })).json() as Record<string, any>
    expect(year.ownerUrl).toBeNull()
    expect(year.publicCalls).toMatchObject({ days: 365, total: 1 })
    const day = await (await send(get('?days=-3'), db)).json() as Record<string, any>
    expect(day.publicCalls).toMatchObject({ days: 1, total: 0 })
  })

  it('marks an approved proposal the résumé already carries as applied', async () => {
    const db = fakeD1()
    proposal(db, 'approved', profile.resumeHeadline)
    const data = await (await send(get(), db)).json() as Record<string, any>
    expect(data.proposals[0]).toMatchObject({ status: 'applied', decisionNote: 'found live in the résumé data' })
  })

  it('still answers when that sync fails', async () => {
    const db = fakeD1()
    proposal(db, 'approved', profile.resumeHeadline)
    db.failOn = /WHERE status = \?/
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await send(get(), db)
    expect(response.status).toBe(200)
    expect(((await response.json()) as Record<string, any>).proposals[0].status).toBe('approved')
    expect(error).toHaveBeenCalledWith('proposal sync', expect.any(Error))
  })
})
