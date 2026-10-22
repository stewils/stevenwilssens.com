import { describe, expect, it } from 'vitest'
import { earlierTurns, lineStyle, newcombe, pct, points, queueCounts, queueOf, rangeText, summarize, tileText, verdict, verdictText, versionKey, versionLabel, versions, weekList, weekOf, weeklyContext, weeklyShares, wilson, withRatings, newerRatings } from './askQuality'
import { makeAsk, makeLogEntry, makeRating } from '../test/admin-fixtures'
import type { AskLogEntry, AskRating } from './types'

const MODEL = 'claude-opus-5-5'
const close = (range: { low: number; high: number } | null, low: number, high: number) => {
  expect(range).not.toBeNull()
  expect(range!.low).toBeCloseTo(low, 4)
  expect(range!.high).toBeCloseTo(high, 4)
}

describe('Wilson and Newcombe', () => {
  it('Wilson matches the published intervals', () => {
    close(wilson(81, 263), 0.2553, 0.3662)
    close(wilson(15, 148), 0.0624, 0.1605)
    close(wilson(0, 20), 0, 0.1611)
    close(wilson(1, 29), 0.0061, 0.1718)
    close(wilson(18, 25), 0.5242, 0.8572)
    close(wilson(17, 20), 0.6396, 0.9476)
    close(wilson(20, 20), 0.8389, 1)
    expect(wilson(0, 0)).toBeNull()
  })

  it('Newcombe matches the published differences', () => {
    close(newcombe(56, 70, 48, 80), 0.0524, 0.3339)
    close(newcombe(9, 10, 3, 10), 0.1705, 0.8090)
    close(newcombe(5, 56, 0, 29), -0.0381, 0.1926)
    close(newcombe(0, 10, 0, 20), -0.1611, 0.2775)
    close(newcombe(10, 10, 0, 20), 0.6791, 1)
    close(newcombe(18, 20, 12, 20), 0.0294, 0.5253)
    close(newcombe(17, 20, 12, 20), -0.0277, 0.4847)
    expect(newcombe(1, 2, 0, 0)).toBeNull()
  })

  it('formats shares as whole points with a real minus sign, never −0', () => {
    expect(points(0.725)).toBe(73)
    expect(points(-0.004)).toBe(0)
    expect(pct(0.72)).toBe('72%')
    expect(rangeText({ low: -0.0277, high: 0.4847 })).toBe('−3 to 48')
    expect(rangeText({ low: 0.52, high: 0.86 })).toBe('52 to 86')
  })
})

const rated = (n: number, good: number, overrides: Partial<AskRating> = {}, wrong = 0): AskRating[] => Array.from({ length: n }, (_, i) => makeRating({
  id: i + 1, logId: null, ...overrides,
  // The first `wrong` are marked not accurate; the next `good` (of the rest) are good.
  accurate: i < wrong ? 'no' : 'yes',
  overall: i >= wrong && i < wrong + good ? 5 : 3,
}))

describe('summing ratings', () => {
  it('counts good, wrong, the mean and the share Yes per criterion, leaving n/a out of the base', () => {
    const ratings = [makeRating({ overall: 5 }), makeRating({ overall: 4, supported: 'na', tone: 'partly' }), makeRating({ overall: 5, accurate: 'no' }), makeRating({ overall: 2, answers: 'no' })]
    const summary = summarize(ratings)
    expect(summary).toMatchObject({ rated: 4, good: 2, goodShare: 0.5, mean: 4, wrong: 1, wrongShare: 0.25 })
    expect(summary.criteria.supported).toMatchObject({ yes: 3, na: 1, base: 3, yesShare: 1 })
    expect(summary.criteria.tone).toMatchObject({ yes: 3, partly: 1, base: 4, partlyShare: 0.25 })
    expect(summary.criteria.answers).toMatchObject({ no: 1, yesShare: 0.75 })
    close(summary.range, wilson(2, 4)!.low, wilson(2, 4)!.high)
  })

  it('with nothing rated has no share, no range and no mean', () => {
    const summary = summarize([])
    expect(summary).toMatchObject({ rated: 0, goodShare: null, range: null, mean: null, wrongShare: null })
    expect(summary.criteria.accurate).toMatchObject({ base: 0, yesShare: null, partlyShare: null })
  })

  it('every n/a leaves a criterion with no share', () => {
    expect(summarize([makeRating({ supported: 'na' })]).criteria.supported).toMatchObject({ base: 0, yesShare: null })
  })
})

describe('versions', () => {
  it('groups by model and instruction version, never by knowledge version, and keeps fallback and mock apart', () => {
    const log = [
      makeLogEntry({ id: 1, ts: Date.UTC(2026, 9, 12), knowledgeVersion: 'k1' }),
      makeLogEntry({ id: 2, ts: Date.UTC(2026, 9, 14), knowledgeVersion: 'k2', outcome: 'gap' }),
      makeLogEntry({ id: 3, ts: Date.UTC(2026, 9, 15), fallback: true, model: 'claude-sonnet-5' }),
      makeLogEntry({ id: 4, ts: Date.UTC(2026, 9, 16), model: 'mock' }),
      makeLogEntry({ id: 5, ts: Date.UTC(2026, 9, 1), model: null, promptVersion: null, knowledgeVersion: null }),
      makeLogEntry({ id: 6, ts: Date.UTC(2026, 9, 18), promptVersion: '9f8e7d6c', outcome: 'limited' }),
    ]
    const ratings = [makeRating({ logId: 1, day: '2026-10-12', note: 'Older note', ratedAt: 1 }), makeRating({ logId: 2, day: '2026-10-14', note: 'Newer note', ratedAt: 2 }), makeRating({ logId: null, day: '2026-09-02', model: null, promptVersion: null })]
    const rows = versions(log, ratings)
    expect(rows.map((row) => row.label)).toEqual(['opus-5-5 · 9f8e7d6c', 'mock · a1b2c3d4', 'sonnet-5 · a1b2c3d4 · fallback', 'opus-5-5 · a1b2c3d4', 'Before versions'])
    const main = rows[3]
    expect(main).toMatchObject({ firstDay: '2026-10-12', lastDay: '2026-10-14', answers: 2, rateable: 2, answeredShare: 0.5, knowledge: 2, primary: true, fallback: false })
    expect(main.summary.rated).toBe(2)
    expect(main.notes).toEqual([{ ratedAt: 2, note: 'Newer note', question: log[1].question }, { ratedAt: 1, note: 'Older note', question: log[0].question }])
    expect(rows[0]).toMatchObject({ rateable: 0, answeredShare: null })
    expect(rows[1]).toMatchObject({ mock: true, primary: false })
    expect(rows[2]).toMatchObject({ fallback: true, primary: false })
    expect(rows[4]).toMatchObject({ before: true, primary: true, model: null, firstDay: '2026-09-02', lastDay: '2026-10-01' })
    expect(versionKey({})).toBe('before')
    expect(versionLabel({ model: 'claude-opus-5-5', promptVersion: 'a1b2c3d4' })).toBe('opus-5-5 · a1b2c3d4')
  })

  it('a note on a pruned answer has no question', () => {
    expect(versions([], [makeRating({ logId: null, note: 'Kept' })])[0].notes).toEqual([{ ratedAt: makeRating().ratedAt, note: 'Kept', question: null }])
    // A rating whose answer is not in the loaded log (the log stopped at its limit) has no question to show.
    expect(versions([], [makeRating({ logId: 5, note: 'Beyond the limit' })])[0].notes).toEqual([{ ratedAt: makeRating().ratedAt, note: 'Beyond the limit', question: null }])
  })
})

// Lists of answers for the verdict: a version with n ratings, `good` of them good and `wrong` marked wrong.
let nextId = 1000
const version = (promptVersion: string | null, day: string, n: number, good: number, wrong = 0, extra: Partial<AskLogEntry> = {}) => {
  const produced = { model: promptVersion ? MODEL : null, promptVersion, fallback: promptVersion ? false : null, ...extra }
  const log = [makeLogEntry({ id: nextId++, ts: Date.parse(`${day}T10:00:00Z`), ...produced })]
  return { log, ratings: rated(n, good, { day, model: produced.model ?? null, promptVersion: produced.promptVersion ?? null, fallback: produced.fallback ?? null }, wrong) }
}
const judge = (...parts: ReturnType<typeof version>[]) => verdict(versions(parts.flatMap((part) => part.log), parts.flatMap((part) => part.ratings)), MODEL)

describe('the verdict', () => {
  it.each([
    ['too early with 19 ratings on the new side', 19, 18, 20, 12, 'early'],
    ['too early with 19 ratings on the old side', 20, 18, 19, 12, 'early'],
    ['better at 20 each: 18 of 20 against 12 of 20', 20, 18, 20, 12, 'better'],
    ['no clear difference when the range reaches zero: 17 of 20 against 12 of 20', 20, 17, 20, 12, 'same'],
    ['no clear difference at 15 of 20 against 15 of 20', 20, 15, 20, 15, 'same'],
    ['worse by good share: 12 of 20 against 18 of 20', 20, 12, 20, 18, 'worse'],
  ])('%s', (_, nNow, goodNow, nBefore, goodBefore, kind) => {
    expect(judge(version('a1b2c3d4', '2026-10-15', nNow, goodNow), version('9f8e7d6c', '2026-10-01', nBefore, goodBefore)).kind).toBe(kind)
  })

  it('says it in one sentence that names both versions, both shares and the difference with its range', () => {
    const better = judge(version('a1b2c3d4', '2026-10-15', 20, 18), version('9f8e7d6c', '2026-10-01', 20, 12))
    expect(verdictText(better)).toBe('opus-5-5 · a1b2c3d4 is rated good 90% (18 of 20) against 60% (12 of 20) before; 30 points better (range 3 to 53).')
    expect(verdictText(judge(version('a1b2c3d4', '2026-10-15', 20, 17), version('9f8e7d6c', '2026-10-01', 20, 12)))).toContain('25 points better (range −3 to 48)')
    expect(verdictText(judge(version('a1b2c3d4', '2026-10-15', 20, 12), version('9f8e7d6c', '2026-10-01', 20, 18)))).toContain('30 points worse (range −53 to −3)')
    expect(verdictText(judge(version('a1b2c3d4', '2026-10-15', 20, 15), version('9f8e7d6c', '2026-10-01', 20, 15)))).toContain('the same share (range −26 to 26)')
    expect(verdictText(judge(version('a1b2c3d4', '2026-10-15', 12, 10), version('9f8e7d6c', '2026-10-01', 25, 12)))).toBe('opus-5-5 · a1b2c3d4 has 12 of 20 rated; opus-5-5 · 9f8e7d6c has 25 rated.')
  })

  it('is not better when the new wrong share is higher, and worse at exactly two more wrong answers of 20, in whole answers', () => {
    // 18 of 20 good against 12 of 20 would be better, but one wrong against none is higher.
    expect(judge(version('a1b2c3d4', '2026-10-15', 20, 18, 1), version('9f8e7d6c', '2026-10-01', 20, 12)).kind).toBe('same')
    // The same good share, 3 wrong against 1 (0.15 − 0.05 >= 0.1 is false in floating point).
    expect(judge(version('a1b2c3d4', '2026-10-15', 20, 15, 3), version('9f8e7d6c', '2026-10-01', 20, 15, 1)).kind).toBe('worse')
    expect(judge(version('a1b2c3d4', '2026-10-15', 20, 15, 2), version('9f8e7d6c', '2026-10-01', 20, 15, 1)).kind).toBe('same')
  })

  it('with one version only, it is the first version with ratings', () => {
    const result = judge(version('a1b2c3d4', '2026-10-15', 25, 20))
    expect(result.kind).toBe('first')
    expect(verdictText(result)).toBe('this is the first version with ratings.')
  })

  it('with no MODEL answer in the range there is no verdict, and no fallback or mock version becomes the version answering now', () => {
    const result = judge(version('a1b2c3d4', '2026-10-15', 20, 18, 0, { model: 'claude-sonnet-5', fallback: true }), version('b1b2c3d4', '2026-10-16', 20, 18, 0, { model: 'mock', fallback: false }), version('9f8e7d6c', '2026-10-01', 20, 12, 0, { model: 'claude-opus-5' }))
    expect(result).toEqual({ kind: 'none', model: MODEL })
    expect(verdictText(result)).toBe('no answer from opus-5-5 in this range.')
  })

  it('the version answering now is the newest MODEL answer; a fallback or mock version answering later the same week is left out', () => {
    const result = judge(version('a1b2c3d4', '2026-10-13', 20, 18), version('a1b2c3d4', '2026-10-15', 20, 2, 0, { model: 'claude-sonnet-5', fallback: true }), version('a1b2c3d4', '2026-10-16', 20, 2, 0, { model: 'mock' }), version('9f8e7d6c', '2026-10-01', 20, 12))
    expect(result.kind).toBe('better')
    if (result.kind !== 'better') return
    expect([result.now.label, result.before.label]).toEqual(['opus-5-5 · a1b2c3d4', 'opus-5-5 · 9f8e7d6c'])
  })

  it('a dated id counts as MODEL; a longer model name that starts with it does not', () => {
    const dated = judge(version('a1b2c3d4', '2026-10-15', 20, 18, 0, { model: `${MODEL}-20261001` }))
    expect(dated.kind).toBe('first')
    expect(verdict(versions(version('a1b2c3d4', '2026-10-15', 20, 18).log, []), 'claude-opus-5').kind).toBe('none')
  })

  it('the version before is the most recent other version with ratings: an older instruction version, else Before versions', () => {
    const withOlder = judge(version('a1b2c3d4', '2026-10-15', 20, 18), version('9f8e7d6c', '2026-10-08', 20, 12), version(null, '2026-10-01', 20, 10), version('77777777', '2026-10-10', 0, 0))
    expect(withOlder.kind !== 'none' && withOlder.kind !== 'first' && withOlder.before.label).toBe('opus-5-5 · 9f8e7d6c')
    const onlyBefore = judge(version('a1b2c3d4', '2026-10-15', 20, 18), version(null, '2026-10-01', 20, 12))
    expect(onlyBefore.kind !== 'none' && onlyBefore.kind !== 'first' && onlyBefore.before.label).toBe('Before versions')
  })

  it('a fallback or mock version with ratings is never the version before', () => {
    const result = judge(version('a1b2c3d4', '2026-10-15', 20, 18), version('a1b2c3d4', '2026-10-14', 20, 2, 0, { model: 'claude-sonnet-5', fallback: true }), version('b1b2c3d4', '2026-10-13', 20, 2, 0, { model: 'mock' }))
    expect(result.kind).toBe('first')
  })

  it("after MODEL changes, the previous primary model's newest rated version is the version before", () => {
    const result = verdict(versions(...[version('a1b2c3d4', '2026-10-15', 20, 18, 0, { model: 'claude-opus-6' }), version('9f8e7d6c', '2026-10-01', 20, 12)].reduce<[AskLogEntry[], AskRating[]]>((all, part) => [[...all[0], ...part.log], [...all[1], ...part.ratings]], [[], []])), 'claude-opus-6')
    expect(result.kind).toBe('better')
    if (result.kind !== 'better') return
    expect(result.before.label).toBe('opus-5-5 · 9f8e7d6c')
  })

  it('draws the verdict\'s two versions solid and dashed, and every other one dotted', () => {
    const parts = [version('a1b2c3d4', '2026-10-15', 20, 18), version('9f8e7d6c', '2026-10-08', 20, 12), version('a1b2c3d4', '2026-10-16', 3, 1, 0, { model: 'claude-sonnet-5', fallback: true })]
    const rows = versions(parts.flatMap((part) => part.log), parts.flatMap((part) => part.ratings))
    const result = verdict(rows, MODEL)
    expect(rows.map((row) => [row.label, lineStyle(row, result)])).toEqual([['sonnet-5 · a1b2c3d4 · fallback', 'other'], ['opus-5-5 · a1b2c3d4', 'now'], ['opus-5-5 · 9f8e7d6c', 'before']])
    expect(rows.map((row) => lineStyle(row, { kind: 'none', model: MODEL }))).toEqual(['other', 'other', 'other'])
    expect(lineStyle(rows[2], { kind: 'first', now: rows[1] })).toBe('other')
  })
})

describe('weeks', () => {
  it('start on Monday 00:00 UTC', () => {
    expect(weekOf('2026-10-18')).toBe('2026-10-12')
    expect(weekOf('2026-10-19')).toBe('2026-10-19')
    expect(weekOf('2026-10-25')).toBe('2026-10-19')
    // Sunday 23:59:59 UTC and Monday 00:00 UTC fall in different weeks: the day is UTC's.
    expect(weekOf(new Date(Date.UTC(2026, 9, 18, 23, 59, 59)).toISOString().slice(0, 10))).not.toBe(weekOf(new Date(Date.UTC(2026, 9, 19)).toISOString().slice(0, 10)))
    expect(weekList('2026-09-30', '2026-10-20')).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'])
  })

  it('a week without ratings for a version has no point, never a zero; a week under 5 ratings is thin', () => {
    const weeks = ['2026-10-05', '2026-10-12', '2026-10-19']
    const ratings = [...rated(6, 3, { day: '2026-10-06' }), ...rated(2, 2, { day: '2026-10-20' })]
    const shares = weeklyShares(ratings, weeks)
    expect(shares[0]).toMatchObject({ week: '2026-10-05', n: 6, good: 3, share: 0.5, thin: false })
    expect(shares[1]).toBeNull()
    expect(shares[2]).toMatchObject({ n: 2, share: 1, thin: true })
    close(shares[2]!.range, wilson(2, 2)!.low, 1)
  })

  it('beside them, the answered share and the reader votes per week', () => {
    const context = weeklyContext([{ day: '2026-10-13', outcome: 'answered', questions: 3, costMicro: 0, msFirst: 0, msTotal: 0 }, { day: '2026-10-14', outcome: 'gap', questions: 1, costMicro: 0, msFirst: 0, msTotal: 0 }, { day: '2026-10-14', outcome: 'off', questions: 5, costMicro: 0, msFirst: 0, msTotal: 0 }], [{ day: '2026-10-15', helpful: 3, unhelpful: 1 }], ['2026-10-05', '2026-10-12'])
    expect(context).toEqual([{ week: '2026-10-05', answered: 0, inScope: 0, answeredShare: null, helpful: 0, votes: 0 }, { week: '2026-10-12', answered: 3, inScope: 4, answeredShare: 0.75, helpful: 3, votes: 4 }])
  })
})

describe('the queue', () => {
  const log = [
    makeLogEntry({ id: 1, ts: 1, rating: makeRating({ logId: 1 }) }),
    makeLogEntry({ id: 2, ts: 2, rating: makeRating({ logId: 2, accurate: 'no' }) }),
    makeLogEntry({ id: 3, ts: 3 }),
    makeLogEntry({ id: 4, ts: 4, outcome: 'limited' }),
    makeLogEntry({ id: 5, ts: 5, outcome: 'failed' }),
    makeLogEntry({ id: 6, ts: 6, kind: 'fit', outcome: 'off' }),
  ]
  it('holds rateable answers only, newest first, filtered', () => {
    expect(queueOf(log, 'unrated').map((entry) => entry.id)).toEqual([6, 3])
    expect(queueOf(log, 'rated').map((entry) => entry.id)).toEqual([2, 1])
    expect(queueOf(log, 'wrong').map((entry) => entry.id)).toEqual([2])
    expect(queueOf(log, 'all').map((entry) => entry.id)).toEqual([6, 3, 2, 1])
    expect(queueCounts(log)).toEqual({ unrated: 2, rated: 2, wrong: 1, all: 4 })
  })

  it('finds the earlier turns of a conversation', () => {
    const turns = [makeLogEntry({ id: 1, ts: 1, visitor: 'a' }), makeLogEntry({ id: 2, ts: 2, visitor: 'b' }), makeLogEntry({ id: 3, ts: 3, visitor: 'a' })]
    expect(earlierTurns(turns, turns[2]).map((entry) => entry.id)).toEqual([1])
    expect(earlierTurns(turns, turns[0])).toEqual([])
  })
})

describe('saved ratings on top of the loaded page', () => {
  it('shows each in the log, the ratings and the unrated list at once', () => {
    const before = makeRating({ id: 1, logId: 3, overall: 2 })
    const info = makeAsk({ log: [makeLogEntry({ id: 3, rating: before }), makeLogEntry({ id: 4 })], ratings: [before, makeRating({ id: 9, logId: null })], unratedWeek: [4] })
    expect(withRatings(info, new Map())).toBe(info)
    const after = makeRating({ id: 1, logId: 3, overall: 5 })
    const fresh = makeRating({ id: 2, logId: 4, overall: 4 })
    const merged = withRatings(info, new Map([[3, after], [4, fresh]]))
    expect(merged.log!.map((entry) => entry.rating?.overall)).toEqual([5, 4])
    expect(merged.ratings!.map((rating) => rating.id)).toEqual([9, 1, 2])
    expect(merged.unratedWeek).toEqual([])
    expect(withRatings(makeAsk(), new Map([[3, after]]))).toMatchObject({ log: undefined, unratedWeek: undefined, ratings: [after] })
  })

  it('keeps a saved rating over a load that read the database before the save, until a load has it or a later one', () => {
    const saved = makeRating({ id: 1, logId: 3, overall: 5, ratedAt: 200 })
    const other = makeRating({ id: 5, logId: 99, overall: 1, ratedAt: 200 })
    const map = new Map([[3, saved], [99, other]])
    // Loaded before the save: the answer without a rating, or with an older one. An answer the page does not show is left out.
    expect([...newerRatings(makeAsk({ log: [makeLogEntry({ id: 3 })] }), map).values()]).toEqual([saved])
    expect([...newerRatings(makeAsk({ log: [makeLogEntry({ id: 3, rating: makeRating({ id: 1, logId: 3, overall: 2, ratedAt: 100 }) })] }), map).keys()]).toEqual([3])
    // Loaded after: the page has it (or a newer one) itself.
    expect(newerRatings(makeAsk({ log: [makeLogEntry({ id: 3, rating: saved })] }), map).size).toBe(0)
    expect(newerRatings(makeAsk({ log: [makeLogEntry({ id: 3, rating: makeRating({ id: 1, logId: 3, ratedAt: 300 }) })] }), map).size).toBe(0)
    expect(newerRatings(makeAsk(), map).size).toBe(0)
  })

  it('the overview tile adds the good share once there is a rating', () => {
    expect(tileText(undefined)).toBe('')
    expect(tileText([])).toBe('')
    expect(tileText([...rated(18, 18), ...rated(7, 0)])).toBe(' · 72% rated good (25)')
  })
})

