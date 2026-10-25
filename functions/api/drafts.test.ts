// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { Env } from '../_lib/env'
import { context, fakeD1, type FakeD1 } from '../_lib/testing/d1'
import { onRequestGet } from './drafts'

// GET /api/drafts on an in-memory D1 with every migration applied (0015_admin_drafts.sql included).
const admin = 'admin-secret'
const url = 'https://steven.wilssens.com/api/drafts'
const env = (db: FakeD1, extra: Partial<Env> = {}) => ({ DB: db, ADMIN_TOKEN: admin, ...extra }) as Env
const read = (db: FakeD1, at = url, headers: Record<string, string> = { Authorization: `Bearer ${admin}` }, extra?: Partial<Env>) => onRequestGet(context(new Request(at, { headers }), env(db, extra)).ctx)
const add = (db: FakeD1, slug: string, updatedAt: number, body = `# ${slug}\n\nText.`) =>
  db.sqlite.prepare('INSERT INTO admin_drafts (slug, title, summary, body, updated_at) VALUES (?, ?, ?, ?, ?)').run(slug, `Title of ${slug}`, `About ${slug}`, body, updatedAt)

describe('GET /api/drafts', () => {
  it('answers 401 without the admin token, a wrong one, or with no admin token set, before reading D1', async () => {
    const db = fakeD1()
    add(db, 'secret-draft', 1)
    for (const headers of [{}, { Authorization: 'Bearer wrong' }, { Authorization: `Basic ${admin}x` }, { Cookie: `token=${admin}` }] as Record<string, string>[]) {
      const response = await read(db, `${url}?slug=secret-draft`, headers)
      expect(response.status).toBe(401)
      expect(await response.text()).not.toContain('Text.')
    }
    expect((await read(db, url, { Authorization: 'Bearer ' }, { ADMIN_TOKEN: '' })).status).toBe(401)
  })

  it('lists the drafts newest first without their text, and not cached', async () => {
    const db = fakeD1()
    add(db, 'older', 100)
    add(db, 'newer', 200)
    const response = await read(db)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ drafts: [{ slug: 'newer', title: 'Title of newer', summary: 'About newer', updatedAt: 200 }, { slug: 'older', title: 'Title of older', summary: 'About older', updatedAt: 100 }] })
  })

  it('answers one draft with its body, and 404 for a missing or malformed slug', async () => {
    const db = fakeD1()
    add(db, 'agent-costs', 300, '## The loop\n\nIt cost **a lot**.')
    expect(await (await read(db, `${url}?slug=agent-costs`)).json()).toEqual({ slug: 'agent-costs', title: 'Title of agent-costs', summary: 'About agent-costs', updatedAt: 300, body: '## The loop\n\nIt cost **a lot**.' })
    for (const slug of ['missing', 'Agent-Costs', '../etc', '', 'a'.repeat(81)]) expect((await read(db, `${url}?slug=${encodeURIComponent(slug)}`)).status).toBe(404)
  })

  it('says it could not read when D1 fails, naming no detail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = { prepare: () => { throw new TypeError('D1 is down: SELECT secret') } } as unknown as FakeD1
    const response = await read(broken)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'could not read the drafts' })
    expect(console.error).toHaveBeenCalledWith('drafts read failed:', 'TypeError')
    const odd = { prepare: () => { throw 'not an error' } } as unknown as FakeD1
    expect((await read(odd, `${url}?slug=agent-costs`)).status).toBe(500)
    expect(console.error).toHaveBeenLastCalledWith('drafts read failed:', 'unknown error')
  })
})
