// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { context, fakeAssets, fakeD1 } from './d1'

describe('the fake D1 the function tests run on', () => {
  it('has every migration applied and answers like D1: all, first, run and batch', async () => {
    const db = fakeD1()
    const insert = await db.prepare('INSERT INTO ask_votes (day, helpful, unhelpful) VALUES (?, ?, ?)').bind('2026-10-18', true, false).run()
    expect(insert.meta).toMatchObject({ changes: 1 })
    expect(await db.prepare('SELECT helpful, unhelpful FROM ask_votes').first()).toEqual({ helpful: 1, unhelpful: 0 })
    expect(await db.prepare('SELECT helpful FROM ask_votes').first('helpful')).toBe(1)
    expect(await db.prepare('SELECT * FROM ask_votes WHERE day = ?').bind('1999-01-01').first()).toBeNull()
    expect(await db.prepare('SELECT day FROM ask_votes WHERE day = ?1 OR day IS ?2').bind('2026-10-18', null).all()).toMatchObject({ results: [{ day: '2026-10-18' }] })
    expect(() => db.prepare('SELECT day FROM ask_votes WHERE day = ?').bind(undefined)).toThrow('D1_TYPE_ERROR')
    const [a, b] = await db.batch([db.prepare('SELECT 1 AS n'), db.prepare('SELECT 2 AS n')])
    expect([a.results, b.results]).toEqual([[{ n: 1 }], [{ n: 2 }]])
    expect(db.queries).toContain('SELECT 1 AS n')
  })

  it('fails on purpose, and passes SQLite errors on as rejections', async () => {
    const db = fakeD1()
    db.failOn = /ask_votes/
    await expect(db.prepare('SELECT * FROM ask_votes').all()).rejects.toThrow('forced failure')
    await expect(db.prepare('SELECT * FROM no_such_table').all()).rejects.toThrow()
  })

  it('serves static files from a map and passes a default page through the context', async () => {
    const seen: string[] = []
    const assets = fakeAssets({ '/a.md': 'A' }, seen)
    expect(await (await assets.fetch('https://x.test/a.md')).text()).toBe('A')
    expect((await assets.fetch('https://x.test/b.md')).status).toBe(404)
    expect(seen).toEqual(['/a.md', '/b.md'])
    const { ctx, pending, settled } = context(new Request('https://x.test/'), {})
    expect(await (await ctx.next()).text()).toBe('page')
    ctx.passThroughOnException()
    ctx.waitUntil(Promise.resolve(1))
    expect(pending).toHaveLength(1)
    expect(await settled()).toEqual([{ status: 'fulfilled', value: 1 }])
  })
})
