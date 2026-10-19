// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../../_lib/env'
import { context, fakeD1, type FakeD1 } from '../_testing/d1'
import { onRequestGet } from './[project]'

const get = (project: string | undefined, db: FakeD1 = fakeD1(), env: Partial<Env> = {}) => {
  const { ctx } = context(new Request(`https://steven.wilssens.com/api/building/${project ?? ''}`), { DB: db, ...env } as Env, { params: project === undefined ? {} : { project } })
  return onRequestGet(ctx)
}
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('GET /api/building/<project>', () => {
  it('is a 404 for a project that is not listed, has no live numbers, or is not named', async () => {
    for (const key of ['nope', 'juniortrackcycling', '__proto__', 'constructor', undefined]) {
      const response = await get(key)
      expect(response.status).toBe(404)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(await response.json()).toEqual({ error: 'unknown project' })
    }
  })

  it("counts this site's own numbers from its database, without GitHub when there is no token", async () => {
    const db = fakeD1()
    db.sqlite.exec(`INSERT INTO events (ts, type, visitor, country) VALUES (1, 'pageview', 'a', 'BE'), (2, 'pageview', 'b', 'NL'), (3, 'pageview', 'c', '')`)
    db.sqlite.exec(`INSERT INTO events (ts, type, visitor, metric, metric_value, metric_rating) VALUES (1, 'vital', 'a', 'LCP', 1, 'good'), (2, 'vital', 'a', 'LCP', 9, 'poor')`)
    db.sqlite.exec(`INSERT INTO resume_proposals (created_at, updated_at, role, kind, rationale, status) VALUES (1, 1, 'headline', 'replace', 'r', 'approved'), (1, 1, 'summary', 'replace', 'r', 'proposed')`)
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const response = await get('site', db)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
    const feed = await response.json() as { project: string; numbers: Record<string, number> }
    expect(feed).toMatchObject({ project: 'site', numbers: { countries: 2, vitalsGoodPercent: 50, proposalsApproved: 1 } })
    expect(feed.numbers.pullRequestsMerged).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('adds the merged site-update pull requests when the GitHub token is set, from the default repository or the one configured', async () => {
    const pulls = [{ merged_at: '2026-10-01', head: { ref: 'update/x' } }, { merged_at: '2026-10-02', head: { ref: 'update/y' } }, { merged_at: null, head: { ref: 'update/z' } }, { merged_at: '2026-10-03', head: { ref: 'feature' } }]
    const fetch = vi.fn(async (_input: RequestInfo | URL) => jsonResponse(pulls))
    vi.stubGlobal('fetch', fetch)
    const response = await get('site', fakeD1(), { GITHUB_TOKEN: 'ghp_test' })
    expect(response.status).toBe(200)
    expect(((await response.json()) as { numbers: Record<string, number> }).numbers.pullRequestsMerged).toBe(2)
    expect(String(fetch.mock.calls[0][0])).toBe('https://api.github.com/repos/stewils/stevenwilssens.com/pulls?state=closed&per_page=100&sort=created&direction=desc')
    await get('site', fakeD1(), { GITHUB_TOKEN: 'ghp_test', GITHUB_REPO: 'someone/fork' })
    expect(String(fetch.mock.calls[1][0])).toContain('/repos/someone/fork/')
  })

  it('leaves the pull requests out when GitHub fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Bad credentials' }, 401)))
    const response = await get('site', fakeD1(), { GITHUB_TOKEN: 'ghp_bad' })
    expect(response.status).toBe(200)
    expect(((await response.json()) as { numbers: Record<string, number> }).numbers.pullRequestsMerged).toBeUndefined()
  })

  it("reads another project's numbers from its site, keeping only finite numbers", async () => {
    const fetch = vi.fn(async (_input: string) => jsonResponse({ asOf: '2026-10-18T00:00:00Z', numbers: { sites: 12, broken: 'x', inf: null } }))
    vi.stubGlobal('fetch', fetch)
    const response = await get('wilssens')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ project: 'wilssens', asOf: '2026-10-18T00:00:00Z', numbers: { sites: 12 } })
    expect(fetch.mock.calls[0][0]).toBe('https://www.wilssens.com/api/building')
  })

  it('answers without numbers, uncached, when the project site is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'boom' }, 502)))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await get('aibreaker')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ project: 'aibreaker', asOf: null, numbers: {}, unavailable: 'the AI Breaker numbers are not available right now' })
    expect(error).toHaveBeenCalledWith('building feed failed', 'aibreaker', expect.any(Error))
  })

  it("answers without numbers when this site's database fails", async () => {
    const db = fakeD1()
    db.failOn = /events/
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await get('site', db)
    expect(await response.json()).toMatchObject({ project: 'site', asOf: null, numbers: {} })
  })
})
