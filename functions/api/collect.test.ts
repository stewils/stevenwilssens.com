// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../_lib/env'
import { context, fakeD1, type FakeD1 } from '../_lib/testing/d1'
import { onRequestPost } from './collect'

const browser = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const url = 'https://steven.wilssens.com/api/collect'

type Init = { body?: string; headers?: Record<string, string>; cf?: Record<string, unknown>; at?: string }
const post = (payload: unknown, { body, headers = {}, cf, at = url }: Init = {}) => {
  const request = new Request(at, { method: 'POST', headers: { 'User-Agent': browser, 'CF-Connecting-IP': '203.0.113.9', ...headers }, body: body ?? JSON.stringify(payload) })
  if (cf) Object.defineProperty(request, 'cf', { value: cf })
  return request
}
const send = async (request: Request, db: FakeD1 = fakeD1(), env: Partial<Env> = { HASH_SALT: 'salt' }) => {
  const { ctx, settled } = context(request, { DB: db, ...env } as Env)
  const response = await onRequestPost(ctx)
  await settled()
  return response
}
const rows = (db: FakeD1) => db.sqlite.prepare('SELECT * FROM events').all() as Record<string, unknown>[]

afterEach(() => vi.restoreAllMocks())

describe('POST /api/collect refuses', () => {
  it('a request from another site, but not one from this site', async () => {
    const db = fakeD1()
    expect((await send(post({ type: 'pageview' }, { headers: { Origin: 'https://evil.example' } }), db)).status).toBe(403)
    expect(rows(db)).toHaveLength(0)
    expect((await send(post({ type: 'pageview' }, { headers: { Origin: 'https://steven.wilssens.com' } }), db)).status).toBe(204)
    expect(rows(db)).toHaveLength(1)
  })

  it('refuses the opaque Origin "null" a sandboxed frame sends, and an Origin that is not an address, with a 403', async () => {
    const db = fakeD1()
    expect((await send(post({ type: 'pageview' }, { headers: { Origin: 'null' } }), db)).status).toBe(403)
    expect((await send(post({ type: 'pageview' }, { headers: { Origin: 'not a url' } }), db)).status).toBe(403)
    expect(rows(db)).toHaveLength(0)
  })

  it('to count preview deployments, bots and requests without a user agent', async () => {
    const db = fakeD1()
    expect((await send(post({ type: 'pageview' }, { at: 'https://abc123.stevenwilssens.pages.dev/api/collect' }), db)).status).toBe(204)
    expect((await send(post({ type: 'pageview' }, { headers: { 'User-Agent': 'Googlebot/2.1' } }), db)).status).toBe(204)
    expect((await send(post({ type: 'pageview' }, { headers: { 'User-Agent': '' } }), db)).status).toBe(204)
    expect(rows(db)).toHaveLength(0)
  })

  it('an oversized body, broken JSON and unknown event types', async () => {
    const db = fakeD1()
    expect((await send(post(null, { body: JSON.stringify({ type: 'pageview', title: 'x'.repeat(8_001) }) }), db)).status).toBe(413)
    expect((await send(post(null, { body: '{not json' }), db)).status).toBe(400)
    expect((await send(post({}), db)).status).toBe(400)
    expect((await send(post({ type: 'purchase' }), db)).status).toBe(400)
    expect((await send(post({ type: '__proto__' }), db)).status).toBe(400)
    expect(rows(db)).toHaveLength(0)
  })
})

describe('POST /api/collect records', () => {
  it('a pageview with its location, browser, referrer and campaign, trimmed to size', async () => {
    const db = fakeD1()
    const cf = { country: 'BE', region: 'Flanders', city: 'Ghent', postalCode: '9000', timezone: 'Europe/Brussels', latitude: '51.05', longitude: '3.72', asn: 13335, asOrganization: 'Example ISP', colo: 'BRU' }
    const response = await send(post({
      type: 'pageview', pageviewId: 'p'.repeat(60), path: '/experience', title: 'Experience', referrer: 'https://www.linkedin.com/in/x',
      utm: { source: 'linkedin', medium: 'social', campaign: 'launch', term: 'pm', content: 'post' },
      language: 'nl-BE', screen: '1920x1080', viewport: '1200x900',
    }, { cf }), db)
    expect(response.status).toBe(204)
    const [row] = rows(db)
    expect(row).toMatchObject({
      type: 'pageview', host: 'steven.wilssens.com', path: '/experience', title: 'Experience', referrer: 'https://www.linkedin.com/in/x', referrer_host: 'linkedin.com',
      utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'launch', utm_term: 'pm', utm_content: 'post',
      country: 'BE', region: 'Flanders', city: 'Ghent', postal_code: '9000', timezone: 'Europe/Brussels', latitude: 51.05, longitude: 3.72, asn: 13335, as_org: 'Example ISP', colo: 'BRU',
      browser: 'Chrome', os: 'Windows', device: 'desktop', language: 'nl-BE', screen: '1920x1080', viewport: '1200x900', metric: null, metric_value: null, metric_rating: null,
    })
    expect(row.pageview_id).toHaveLength(40)
    // The visitor is a daily hash, never the address itself.
    expect(row.visitor).toMatch(/^[0-9a-f]{16}$/)
    expect(JSON.stringify(row)).not.toContain('203.0.113.9')
  })

  it('no referrer host for a move within the site or an address that does not parse, and nulls for what is missing', async () => {
    const db = fakeD1()
    await send(post({ type: 'pageview', referrer: 'https://www.steven.wilssens.com/about' }), db)
    await send(post({ type: 'pageview', referrer: 'not a url', path: 42, title: '' }), db)
    const noAddress = post({ type: 'pageview' })
    noAddress.headers.delete('CF-Connecting-IP')
    await send(noAddress, db, {})
    const headerless = new Request(url, { method: 'POST', body: JSON.stringify({ type: 'pageview' }) })
    headerless.headers.delete('User-Agent')
    expect((await send(headerless, db)).status).toBe(204)
    expect(rows(db)).toHaveLength(3)
    const [inside, broken, bare] = rows(db)
    expect(inside.referrer_host).toBeNull()
    expect(broken).toMatchObject({ referrer: 'not a url', referrer_host: null, path: null, title: null })
    expect(bare).toMatchObject({ referrer: null, referrer_host: null, utm_source: null, country: null, latitude: null, longitude: null })
  })

  it('engagement, clamped to a day and to 100%', async () => {
    const db = fakeD1()
    await send(post({ type: 'engagement', pageviewId: 'pv1', durationMs: 999_999_999, scrollPct: 140.6 }), db)
    await send(post({ type: 'engagement', pageviewId: 'pv1', durationMs: -5, scrollPct: Number.NaN }), db)
    await send(post({ type: 'engagement', pageviewId: 'pv1', durationMs: '12', scrollPct: 55.4 }), db)
    expect(rows(db).map((row) => [row.duration_ms, row.scroll_pct])).toEqual([[86_400_000, 100], [0, null], [null, 55]])
  })

  it('a click with its label, target and context', async () => {
    const db = fakeD1()
    await send(post({ type: 'click', category: 'download', label: 'Resume PDF', target: '/steven-wilssens-resume-2026.pdf', context: 'header' }), db)
    expect(rows(db)[0]).toMatchObject({ type: 'click', category: 'download', label: 'Resume PDF', target: '/steven-wilssens-resume-2026.pdf', context: 'header' })
  })

  it('web vitals, keeping only known metrics and ratings and capping the value', async () => {
    const db = fakeD1()
    await send(post({ type: 'vital', metric: 'LCP', value: 1234.5, rating: 'good' }), db)
    await send(post({ type: 'vital', metric: 'FID', value: 9_999_999, rating: 'awful' }), db)
    await send(post({ type: 'vital', metric: 'CLS', value: 'fast' }), db)
    expect(rows(db).map((row) => [row.metric, row.metric_value, row.metric_rating])).toEqual([['LCP', 1234.5, 'good'], [null, 600_000, null], ['CLS', null, null]])
  })

  it('the same visitor all day from one address and browser, and a different one with another salt', async () => {
    const db = fakeD1()
    await send(post({ type: 'pageview' }), db)
    await send(post({ type: 'pageview' }), db)
    await send(post({ type: 'pageview' }), db, { HASH_SALT: 'other' })
    await send(post({ type: 'pageview' }, { headers: { 'CF-Connecting-IP': '198.51.100.1' } }), db)
    const [a, b, c, d] = rows(db).map((row) => row.visitor)
    expect(a).toBe(b)
    expect(c).not.toBe(a)
    expect(d).not.toBe(a)
  })

  it('and now and then deletes events older than thirteen months', async () => {
    const db = fakeD1()
    db.sqlite.prepare("INSERT INTO events (ts, type, visitor, host) VALUES (?, 'pageview', 'old', 'steven.wilssens.com')").run(Date.now() - 400 * 86_400_000)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await send(post({ type: 'pageview' }), db)
    expect(rows(db)).toHaveLength(2)
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    await send(post({ type: 'pageview' }), db)
    expect(rows(db).map((row) => row.visitor)).not.toContain('old')
    expect(rows(db)).toHaveLength(2)
  })

  it("and with them the assistant's questions older than 90 days", async () => {
    const db = fakeD1()
    const add = db.sqlite.prepare("INSERT INTO ask_log (ts, visitor, kind, question, outcome) VALUES (?, ?, 'question', 'q', 'answered')")
    add.run(Date.now() - 91 * 86_400_000, 'old')
    add.run(Date.now() - 89 * 86_400_000, 'kept')
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    await send(post({ type: 'pageview' }), db)
    expect((db.sqlite.prepare('SELECT visitor FROM ask_log').all() as { visitor: string }[]).map((row) => row.visitor)).toEqual(['kept'])
  })
})
