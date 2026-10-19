// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './_lib/env'
import { context, fakeAssets, fakeD1, type FakeD1 } from './_lib/testing/d1'

const googlebot = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const browser = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const report = JSON.stringify({ score: 91, pdfHash: 'feedface', findings: [], questions: [] })

// The middleware remembers per isolate that it recorded the résumé, so each test loads a fresh copy.
let onRequest: typeof import('./_middleware').onRequest
beforeEach(async () => {
  vi.resetModules()
  onRequest = (await import('./_middleware')).onRequest
})
afterEach(() => vi.restoreAllMocks())

type Options = { userAgent?: string | null; cf?: Record<string, unknown>; status?: number; files?: Record<string, string> }
const visit = async (href: string, db: FakeD1, { userAgent = browser, cf, status = 200, files = { '/resume-report.json': report } }: Options = {}) => {
  const request = new Request(href, { headers: userAgent === null ? {} : { 'User-Agent': userAgent } })
  if (cf) Object.defineProperty(request, 'cf', { value: cf })
  const next = vi.fn(async () => new Response('page', { status }))
  const { ctx, settled } = context(request, { DB: db, ASSETS: fakeAssets(files) } as Env, { next })
  const response = await onRequest(ctx)
  await settled()
  return { response, next }
}
const crawls = (db: FakeD1) => db.sqlite.prepare('SELECT * FROM crawls').all().map((row) => ({ ...row }))
const scores = (db: FakeD1) => (db.sqlite.prepare('SELECT COUNT(*) AS n FROM resume_scores').get() as { n: number }).n

describe('the site middleware', () => {
  it('redirects the production pages.dev address and wilssens.net to steven.wilssens.com, without serving the page', async () => {
    const db = fakeD1()
    const pages = await visit('https://stevenwilssens.pages.dev/experience?x=1', db)
    expect(pages.response.status).toBe(301)
    expect(pages.response.headers.get('Location')).toBe('https://steven.wilssens.com/experience?x=1')
    expect(pages.next).not.toHaveBeenCalled()
    const old = await visit('http://steven.wilssens.net/blog/default.aspx', db)
    expect(old.response.headers.get('Location')).toBe('https://steven.wilssens.com/')
    expect(db.queries).toHaveLength(0)
  })

  it('serves a preview deployment as is, recording nothing', async () => {
    const db = fakeD1()
    const { response } = await visit('https://abc123.stevenwilssens.pages.dev/', db, { userAgent: googlebot })
    expect(await response.text()).toBe('page')
    expect(db.queries).toHaveLength(0)
  })

  it("records this deployment's résumé score on the first page it serves, once", async () => {
    const db = fakeD1()
    await visit('https://steven.wilssens.com/api/stats', db)
    expect(scores(db)).toBe(0)
    await visit('https://steven.wilssens.com/', db)
    expect(scores(db)).toBe(1)
    const seen = db.queries.length
    await visit('https://steven.wilssens.com/about', db)
    expect(db.queries.length).toBe(seen)
  })

  it('tries again on the next page when recording failed', async () => {
    const db = fakeD1()
    db.failOn = /resume_scores/
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await visit('https://steven.wilssens.com/', db)
    expect(error).toHaveBeenCalledWith('resume score record failed', expect.any(Error))
    db.failOn = undefined
    await visit('https://steven.wilssens.com/', db)
    expect(scores(db)).toBe(1)
  })

  it('logs a named crawler with its network and a request without a user agent, and not a browser, an asset or the API', async () => {
    const db = fakeD1()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await visit('https://steven.wilssens.com/experience', db, { userAgent: googlebot, status: 404, cf: { country: 'US', asn: 15169, asOrganization: 'Google LLC' } })
    await visit('https://steven.wilssens.com/', db)
    await visit('https://steven.wilssens.com/', db, { userAgent: null })
    await visit('https://steven.wilssens.com/assets/app.js', db, { userAgent: googlebot })
    await visit('https://steven.wilssens.com/api/stats', db, { userAgent: googlebot })
    expect(crawls(db)).toEqual([
      expect.objectContaining({ bot: 'Googlebot', category: 'search', path: '/experience', status: 404, user_agent: googlebot, country: 'US', asn: 15169, as_org: 'Google LLC' }),
      // A request without any user agent is a script, counted with the probes.
      expect.objectContaining({ bot: 'No user agent', category: 'other', path: '/', user_agent: null }),
    ])
  })

  it('keeps paths and user agents short, and now and then deletes crawls older than thirteen months', async () => {
    const db = fakeD1()
    db.sqlite.prepare("INSERT INTO crawls (ts, bot, category, path) VALUES (?, 'Old', 'other', '/')").run(Date.now() - 400 * 86_400_000)
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    await visit(`https://steven.wilssens.com/${'a'.repeat(400)}`, db, { userAgent: `${googlebot} ${'x'.repeat(400)}` })
    const rows = crawls(db)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ bot: 'Googlebot', country: null, asn: null, as_org: null })
    expect(String(rows[0].path)).toHaveLength(300)
    expect(String(rows[0].user_agent)).toHaveLength(300)
  })

  it('serves the page even when the crawl log fails', async () => {
    const db = fakeD1()
    db.failOn = /INSERT INTO crawls/
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { response } = await visit('https://steven.wilssens.com/', db, { userAgent: googlebot })
    expect(response.status).toBe(200)
    expect(error).toHaveBeenCalledWith('crawl log failed', expect.any(Error))
  })
})
