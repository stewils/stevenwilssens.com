// @vitest-environment node
// The numbers of a Building write-up after a refresh (scripts/building-feed.mjs): the live
// feed's numbers over the committed ones, so a number the feed does not send keeps its value,
// and nothing but a finite number under a plain key reaches the file.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { main, MAX_NUMBERS, mergeFeed, validAsOf } from './building-feed.mjs'

const root = resolve(import.meta.dirname, '..')
const aibreaker = JSON.parse(readFileSync(join(root, 'src/articles/aibreaker/feed.json'), 'utf8'))
const now = new Date('2026-10-19T12:00:00Z')
const tmp = () => mkdtempSync(join(tmpdir(), 'feed-'))

describe('the merge (AC-7)', () => {
  it('keeps the five numbers AI Breaker does not send', () => {
    const merged = mergeFeed(aibreaker, { project: 'aibreaker', asOf: '2026-10-19T11:00:00Z', numbers: { visitorCountries30d: 12 } }, { now })
    expect(merged.numbers).toEqual({ ...aibreaker.numbers, visitorCountries30d: 12 })
    for (const key of ['levels', 'settingsCovered', 'settingsDocumented', 'chatbotDomainsBlocked', 'clicksToUndo']) expect(merged.numbers[key], key).toBe(aibreaker.numbers[key])
    expect(merged).toEqual({ project: 'aibreaker', asOf: '2026-10-19T11:00:00Z', numbers: expect.any(Object) })
  })

  it('a number the live feed sends replaces the committed one', () => {
    expect(mergeFeed({ project: 'site', asOf: '2026-10-01', numbers: { countries: 30, pullRequestsMerged: 4 } }, { numbers: { countries: 31 } }, { now }).numbers).toEqual({ countries: 31, pullRequestsMerged: 4 })
  })

  it('asOf comes from the live feed when it is an ISO date not in the future', () => {
    const committed = { project: 'site', asOf: '2026-10-01T00:00:00Z', numbers: {} }
    expect(mergeFeed(committed, { asOf: '2026-10-19', numbers: {} }, { now }).asOf).toBe('2026-10-19')
    expect(mergeFeed(committed, { asOf: '2026-10-19T12:03:00.120Z', numbers: {} }, { now }).asOf).toBe('2026-10-19T12:03:00.120Z')
  })

  it.each([
    ['in the future', '2027-01-01T00:00:00Z'],
    ['malformed', 'yesterday'],
    ['an impossible date', '2026-13-45'],
    ['not a string', 20261019],
  ])('keeps the committed asOf for a date %s', (_name, asOf) => {
    expect(validAsOf(asOf, now)).toBe(false)
    expect(mergeFeed({ project: 'site', asOf: '2026-10-01', numbers: {} }, { asOf, numbers: {} }, { now }).asOf).toBe('2026-10-01')
  })

  it('a live answer without a numbers object gives null', () => {
    for (const live of [null, [], 'text', {}, { numbers: null }, { numbers: [1, 2] }, { numbers: 'x' }]) expect(mergeFeed(aibreaker, live, { now })).toBeNull()
  })

  it('a missing committed file (a new article) takes only valid live numbers, the project named by the step and the date', () => {
    expect(mergeFeed(null, { project: 'other', numbers: { visits: 3, bad: 'x' } }, { now, project: 'leo' })).toEqual({ project: 'leo', asOf: now.toISOString(), numbers: { visits: 3 } })
    expect(mergeFeed(null, { numbers: {} }, { now }).project).toBeNull()
  })

  it('keeps project, the committed levels and the prototype, and at most 32 numbers (T-8, C-6)', () => {
    const live = JSON.parse(`{"__proto__": {"x": 1}, "project": "other", "numbers": {"__proto__": {"x": 1}, "constructor": {"y": 2}, "levels": "<img src=x>", "${'k'.repeat(70)}": 5, "nan": null, "inf": 1e999, "obj": {"a": 1}, "list": [1], "flag": true, ${Array.from({ length: 40 }, (_, i) => `"n${i}": ${i}`).join(', ')}}}`)
    const merged = mergeFeed(aibreaker, live, { now })
    expect(merged.project).toBe('aibreaker')
    expect(merged.numbers.levels).toBe(4)
    expect({}.x).toBeUndefined()
    expect({}.y).toBeUndefined()
    expect(Object.getPrototypeOf(merged.numbers)).toBe(Object.prototype)
    expect(Object.keys(merged.numbers)).toHaveLength(MAX_NUMBERS)
    for (const value of Object.values(merged.numbers)) expect(Number.isFinite(value)).toBe(true)
    for (const key of ['__proto__', 'constructor', 'k'.repeat(70), 'nan', 'inf', 'obj', 'list', 'flag']) expect(Object.hasOwn(merged.numbers, key), key).toBe(false)
    // The committed six come first; the live ones fill up to the limit.
    expect(Object.keys(merged.numbers).slice(0, 6)).toEqual(Object.keys(aibreaker.numbers))
    expect(JSON.stringify(merged)).not.toContain('<img')
  })

  it('the 32 cap holds for names that Object.prototype has (constructor, toString, valueOf)', () => {
    const full = Object.fromEntries(Array.from({ length: MAX_NUMBERS }, (_, i) => [`n${i}`, i]))
    const merged = mergeFeed({ project: 'x', asOf: '2026-10-01', numbers: full }, { numbers: { constructor: 1, toString: 2, valueOf: 3, hasOwnProperty: 4, n0: 99 } }, { now })
    expect(Object.keys(merged.numbers)).toHaveLength(MAX_NUMBERS)
    expect(merged.numbers.n0).toBe(99)
    expect(Object.hasOwn(merged.numbers, 'constructor')).toBe(false)
  })

  it('drops what is not a number from the committed file too, and reads a committed file without numbers', () => {
    expect(mergeFeed({ project: 'x', asOf: '2026-10-01', numbers: { good: 1, bad: 'no' } }, { numbers: {} }, { now }).numbers).toEqual({ good: 1 })
    expect(mergeFeed({ project: 'x', asOf: 7 }, { numbers: { a: 1 } }, { now })).toEqual({ project: 'x', asOf: now.toISOString(), numbers: { a: 1 } })
  })
})

describe('the step (AC-7)', () => {
  it('writes the merged feed and exits 0', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'live.json'), JSON.stringify({ project: 'aibreaker', asOf: '2026-10-19T11:00:00Z', numbers: { visitorCountries30d: 12 } }))
    writeFileSync(join(dir, 'feed.json'), JSON.stringify(aibreaker))
    expect(main([join(dir, 'live.json'), join(dir, 'feed.json'), 'aibreaker'], { now })).toBe(0)
    const written = readFileSync(join(dir, 'feed.json'), 'utf8')
    expect(written.endsWith('}\n')).toBe(true)
    expect(JSON.parse(written).numbers).toEqual({ ...aibreaker.numbers, visitorCountries30d: 12 })
  })

  it('a live answer without a numbers object writes nothing and exits 1, the file byte-identical', () => {
    const dir = tmp()
    const before = readFileSync(join(root, 'src/articles/aibreaker/feed.json'), 'utf8')
    writeFileSync(join(dir, 'feed.json'), before)
    writeFileSync(join(dir, 'live.json'), '{"error":"down"}')
    const logged = []
    expect(main([join(dir, 'live.json'), join(dir, 'feed.json')], { now, log: (line) => logged.push(line) })).toBe(1)
    expect(readFileSync(join(dir, 'feed.json'), 'utf8')).toBe(before)
    expect(logged).toEqual(['The live feed has no numbers; the committed ones stay.'])
    writeFileSync(join(dir, 'live.json'), '<html>502</html>')
    expect(main([join(dir, 'live.json'), join(dir, 'feed.json')], { now, log: () => {} })).toBe(1)
    expect(main([join(dir, 'gone.json'), join(dir, 'feed.json')], { now, log: () => {} })).toBe(1)
    expect(main(undefined, { log: () => {} })).toBe(1)
  })

  it('creates the file for a new article, and reads an unreadable committed file as none', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'live.json'), JSON.stringify({ numbers: { visits: 3 } }))
    expect(main([join(dir, 'live.json'), join(dir, 'new.json'), 'leo'], { now })).toBe(0)
    expect(JSON.parse(readFileSync(join(dir, 'new.json'), 'utf8'))).toEqual({ project: 'leo', asOf: now.toISOString(), numbers: { visits: 3 } })
    writeFileSync(join(dir, 'broken.json'), 'not json')
    expect(main([join(dir, 'live.json'), join(dir, 'broken.json')], { now })).toBe(0)
    expect(JSON.parse(readFileSync(join(dir, 'broken.json'), 'utf8')).project).toBeNull()
  })

  it('runs as a command: exit 1 without numbers, the file untouched', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'live.json'), '{}')
    const run = spawnSync(process.execPath, [join(import.meta.dirname, 'building-feed.mjs'), join(dir, 'live.json'), join(dir, 'feed.json')], { encoding: 'utf8' })
    expect(run.status).toBe(1)
    expect(existsSync(join(dir, 'feed.json'))).toBe(false)
  })
})
