// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { CostRow } from './store'
import { buildViews, lastDays, lastMonths, moneyOf, ownPulls, pullStateOf, reviewRounds, totalOf, zero, type PullInfo } from './views'

// Money worked out by hand: claude-opus-5-5 output is $20 per million tokens, so N output
// tokens are 20 * N micro-dollars (1,000 tokens = $0.02).
const NOW = Date.UTC(2026, 9, 19, 12)
const DAY = 86_400_000
let clock = NOW - 30 * DAY
const local = (extra: Partial<CostRow> = {}): CostRow => ({
  source: 'local', runKey: 'local:s1', branch: 'dev-costs', pr: null, workflow: null, job: null, runId: null, runAttempt: null,
  role: 'lead', batch: 0, batchAt: (clock += 1000), model: 'claude-opus-5-5', billing: 'estimated',
  input: 0, output: 1000, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, reportedMicro: null, numTurns: null, durationMs: null, startedAt: NOW - 40 * DAY, endedAt: NOW - DAY, ...extra,
})
const review = (runId: number, runAttempt: number, extra: Partial<CostRow> = {}): CostRow => ({
  ...local(), source: 'github', runKey: `github:${runId}:${runAttempt}:team`, pr: 61, workflow: 'review', job: 'team', runId, runAttempt, role: 'review-workflow', model: 'reported', billing: 'billed', output: 0, reportedMicro: 1_000_000, numTurns: 16, durationMs: 1000, ...extra,
})
const views = (rows: CostRow[], { budgets = new Map<string, number>(), pulls = [] as PullInfo[] | null, pullsCapped = false } = {}) => buildViews({ rows, budgets, pulls, pullsCapped, now: NOW, repo: 'stewils/stevenwilssens.com', pricesRead: '2026-10-19' })
const pull = (number: number, branch: string, extra: Partial<PullInfo> = {}): PullInfo => ({ number, branch, headRepo: 'stewils/stevenwilssens.com', state: 'open', merged: false, mergeCommit: null, supersedes: null, ...extra })

describe('review rounds', () => {
  it('numbers the Review rows of one pull request by run id and attempt, whatever order they came in', () => {
    const third = review(300, 1)
    const first = review(100, 1)
    const second = review(100, 2)
    const other = review(250, 1, { pr: 62 })
    const rounds = reviewRounds([third, first, second, other, local()])
    expect([rounds.get(first), rounds.get(second), rounds.get(third), rounds.get(other)]).toEqual([1, 2, 3, 1])
  })

  it('numbers thousands of shuffled rows of one pull request, rows of the same run sharing a round', () => {
    const rows = Array.from({ length: 20_000 }, (_, index) => review(1000 + ((index * 7919) % 5000), 1 + (index % 2)))
    const rounds = reviewRounds(rows)
    const byRun = new Map(rows.map((row) => [`${row.runId}:${row.runAttempt}`, rounds.get(row)]))
    expect(rows.every((row) => rounds.get(row) === byRun.get(`${row.runId}:${row.runAttempt}`))).toBe(true)
    expect(byRun.size).toBe(new Set(rounds.values()).size)
    expect(rounds.get(rows.find((row) => row.runId === 1000 && row.runAttempt === 1)!)).toBe(1)
    expect(Math.max(...rounds.values())).toBe(byRun.size)
  })

  it('gives each round its own line, and counts a Site update run as the spec and build, never a round', () => {
    const update: CostRow = { ...review(400, 1), runKey: 'github:400:1:update', branch: 'update/x-12', pr: null, workflow: 'site-update', job: 'update', role: 'site-update-workflow', reportedMicro: 2_000_000 }
    const answer = views([update, review(401, 1, { branch: 'update/x-12', pr: 70 }), review(402, 1, { branch: 'update/x-12', pr: 70 })])
    const [feature] = answer.features
    expect(feature.build.billed).toBe(2_000_000)
    expect(feature.review.billed).toBe(2_000_000)
    expect(feature.reviewRounds).toBe(2)
    expect(feature.phases.map((line) => [line.kind, line.round, line.pr])).toEqual([['site-update', 0, null], ['review-workflow', 1, 70], ['review-workflow', 2, 70]])
    expect(feature.waste.money.billed).toBe(1_000_000)
  })
})

describe('the features', () => {
  it('splits a /feature run by phase, and the phases add up to the total to the micro-dollar', () => {
    const rows = [
      local({ role: 'lead', output: 333 }),
      local({ batch: 1, role: 'product-manager', output: 1001 }), local({ batch: 1, role: 'ux-designer', output: 7 }),
      local({ batch: 2, role: 'senior-developer', output: 5000 }),
      ...['senior-developer', 'security-engineer', 'senior-tester', 'ux-designer', 'senior-recruiter', 'product-manager'].map((role) => local({ batch: 3, role, output: 100 })),
      local({ batch: 4, role: 'senior-developer', output: 2000 }),
      local({ runKey: 'local:s2', batch: 1, role: 'senior-tester', output: 50 }),
    ]
    const [feature] = views(rows).features
    expect([feature.spec.estimated, feature.build.estimated, feature.review.estimated, feature.fix.estimated, feature.lead.estimated]).toEqual([20_160, 100_000, 13_000, 40_000, 6_660])
    expect(totalOf(feature.total)).toBe(20_160 + 100_000 + 13_000 + 40_000 + 6_660)
    expect(feature.phases.map((line) => line.round ? `${line.kind} ${line.round}` : line.kind)).toEqual(['spec', 'build', 'review 1', 'fix 1', 'review 2', 'lead'])
    expect(feature.phases[0].roles).toEqual([{ role: 'product-manager', money: { billed: 0, estimated: 20_020, unknown: 0, unpriced: [] } }, { role: 'ux-designer', money: { billed: 0, estimated: 140, unknown: 0, unpriced: [] } }])
    expect([feature.reviewRounds, feature.fixRounds, feature.runs]).toEqual([2, 1, 2])
    expect(feature.tokensOut).toBe(333 + 1001 + 7 + 5000 + 600 + 2000 + 50)
    // A fix round and the review after the first are waste; the first review is not.
    expect(feature.waste).toMatchObject({ fixRounds: 1, moreReviews: 1, closed: false, redoneBy: null })
    expect(totalOf(feature.waste.money)).toBe(40_000 + 1000)
  })

  it('keeps unpriced tokens out of every total and names the model', () => {
    const [feature] = views([local({ model: 'claude-x-1', output: 1_200_000 }), local({ model: 'claude-x-1', output: 5, input: 5 }), local({ output: 1000 })]).features
    expect(totalOf(feature.total)).toBe(20_000)
    expect(feature.total.unpriced).toEqual([{ model: 'claude-x-1', tokens: 1_200_010 }])
    expect(moneyOf(local({ model: 'claude-x-1' }))).toEqual({ billed: 0, estimated: 0, unknown: 0, unpriced: [{ model: 'claude-x-1', tokens: 1000 }] })
  })

  it('keeps billed, estimated and unknown apart', () => {
    const [feature] = views([local({ billing: 'unknown', output: 1000 }), local({ output: 2000 }), review(1, 1)]).features
    expect(feature.total).toEqual({ billed: 1_000_000, estimated: 40_000, unknown: 20_000, unpriced: [] })
  })

  it('collects main, a detached HEAD and runs without a branch under No feature, last and without a budget', () => {
    const answer = views([local({ branch: 'main' }), local({ branch: 'HEAD' }), local({ branch: '' }), local({ branch: 'a' }), local({ branch: 'b', endedAt: NOW })], { budgets: new Map([['main', 1]]) })
    expect(answer.features.map((feature) => feature.branch)).toEqual(['b', 'a', null])
    expect(answer.features[2]).toMatchObject({ pull: null, budgetMicro: null })
    expect(totalOf(answer.features[2].total)).toBe(60_000)
  })

  it('lists a feature over its budget first; equal to it is not over', () => {
    const answer = views([local({ branch: 'equal', endedAt: NOW }), local({ branch: 'over', endedAt: NOW - 5 * DAY }), local({ branch: 'latest', endedAt: NOW })], { budgets: new Map([['equal', 20_000], ['over', 19_999]]) })
    expect(answer.features.map((feature) => [feature.branch, feature.budgetMicro])).toEqual([['over', 19_999], ['equal', 20_000], ['latest', null]])
  })
})

describe('pull request states', () => {
  it('reads merged, open, closed, redone and none from GitHub, and unknown without it', () => {
    const sha = 'b'.repeat(40)
    const pulls = [pull(57, 'merged', { state: 'closed', merged: true, mergeCommit: sha }), pull(58, 'open'), pull(55, 'closed', { state: 'closed' }), pull(54, 'redone', { state: 'closed' }), pull(56, 'update/redo', { supersedes: 54 }), pull(50, 'open', { state: 'closed' })]
    expect(pullStateOf('merged', pulls)).toEqual({ state: 'merged', number: 57, mergeCommit: sha, supersededBy: null })
    expect(pullStateOf('open', pulls)).toEqual({ state: 'open', number: 58, mergeCommit: null, supersededBy: null })
    expect(pullStateOf('closed', pulls)).toEqual({ state: 'closed', number: 55, mergeCommit: null, supersededBy: null })
    expect(pullStateOf('redone', pulls)).toEqual({ state: 'superseded', number: 54, mergeCommit: null, supersededBy: 56 })
    expect(pullStateOf('nothing', pulls).state).toBe('none')
    expect(pullStateOf('merged', null).state).toBe('unknown')
  })

  it('ignores a fork’s pull request with the same branch name, and its redo marker', () => {
    const fork = { headRepo: 'someone/stevenwilssens.com' }
    const pulls = [
      pull(10, 'dev-costs', { state: 'closed', merged: true }),
      // Newer, from a fork, closed without merging: would make the feature waste if it counted.
      pull(11, 'dev-costs', { ...fork, state: 'closed' }),
      pull(12, 'redo-me', { state: 'closed' }), pull(13, 'x', { ...fork, supersedes: 12 }),
      pull(14, 'gone', { headRepo: null, state: 'closed' }),
      pull(15, 'upper', { headRepo: 'Stewils/StevenWilssens.com' }),
    ]
    expect(ownPulls(pulls, 'stewils/stevenwilssens.com')!.map((item) => item.number)).toEqual([10, 12, 15])
    expect(ownPulls(pulls, null)).toBe(pulls)
    expect(ownPulls(null, 'stewils/stevenwilssens.com')).toBeNull()
    const answer = views([local({ branch: 'dev-costs' }), local({ branch: 'redo-me' }), local({ branch: 'gone' })], { pulls })
    const byBranch = Object.fromEntries(answer.features.map((feature) => [feature.branch, feature]))
    expect(byBranch['dev-costs'].pull).toMatchObject({ state: 'merged', number: 10 })
    expect(byBranch['dev-costs'].waste.closed).toBe(false)
    expect(byBranch['redo-me'].pull).toEqual({ state: 'closed', number: 12, mergeCommit: null, supersededBy: null })
    expect(byBranch.gone.pull?.state).toBe('none')
  })

  it('says unknown, not none, for a branch missing from a list cut at its page cap; a branch in it keeps its state', () => {
    const pulls = [pull(500, 'recent', { state: 'closed', merged: true })]
    expect(pullStateOf('old', pulls, true).state).toBe('unknown')
    expect(pullStateOf('old', pulls, false).state).toBe('none')
    expect(pullStateOf('recent', pulls, true).state).toBe('merged')
    const answer = views([local({ branch: 'old' }), local({ branch: 'recent' })], { pulls, pullsCapped: true })
    expect(answer.features.map((feature) => [feature.branch, feature.pull?.state]).sort()).toEqual([['old', 'unknown'], ['recent', 'merged']])
  })
})

describe('waste', () => {
  it('counts all of a closed or redone feature once, its fix rounds included, and never more than the total', () => {
    const rows = [
      local({ branch: 'closed', batch: 1, role: 'senior-developer' }), local({ branch: 'closed', batch: 2, role: 'senior-tester' }), local({ branch: 'closed', batch: 3, role: 'senior-developer' }),
      local({ branch: 'redone' }),
      local({ branch: 'fine', batch: 1, role: 'senior-developer' }), local({ branch: 'fine', batch: 2, role: 'senior-tester' }),
    ]
    const answer = views(rows, { pulls: [pull(1, 'closed', { state: 'closed' }), pull(2, 'redone', { state: 'closed' }), pull(3, 'update/r', { supersedes: 2 }), pull(4, 'fine', { state: 'closed', merged: true })] })
    const byBranch = Object.fromEntries(answer.features.map((feature) => [feature.branch, feature]))
    expect(totalOf(byBranch.closed.waste.money)).toBe(totalOf(byBranch.closed.total))
    expect(byBranch.closed.waste).toMatchObject({ closed: true, fixRounds: 1 })
    expect(byBranch.redone.waste).toMatchObject({ closed: true, redoneBy: 3 })
    // One review and no fix: no waste.
    expect(totalOf(byBranch.fine.waste.money)).toBe(0)
    expect(totalOf(answer.waste.closed)).toBe(80_000)
    expect(totalOf(answer.waste.fix)).toBe(0)
  })

  it('counts Review workflow rounds after the first on a pull request, not the first after a clean local review', () => {
    const rows = [local({ batch: 1, role: 'senior-developer' }), local({ batch: 2, role: 'senior-tester' }), review(10, 1), review(11, 1)]
    const answer = views(rows)
    expect(answer.waste.reviews).toEqual({ billed: 1_000_000, estimated: 0, unknown: 0, unpriced: [] })
    expect(answer.features[0].waste.moreReviews).toBe(1)
    expect(totalOf(answer.waste.fix)).toBe(0)
  })
})

describe('the months', () => {
  it('are the last 12 UTC months ending with this one, empty ones kept, by when the batch ran', () => {
    expect(lastMonths(NOW)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    const answer = views([
      // 23:30 UTC on 30 September is September, whatever the browser's time zone.
      local({ batchAt: Date.UTC(2026, 8, 30, 23, 30), billing: 'unknown' }),
      local({ batchAt: Date.UTC(2026, 9, 1, 0, 30) }),
      review(5, 1, { batchAt: Date.UTC(2026, 9, 2) }),
      local({ batchAt: Date.UTC(2024, 0, 1) }),
    ])
    const months = Object.fromEntries(answer.months.map((month) => [month.month, month]))
    expect(answer.months).toHaveLength(12)
    expect(months['2026-09'].money).toEqual({ billed: 0, estimated: 0, unknown: 20_000, unpriced: [] })
    expect(months['2026-10'].money).toEqual({ billed: 1_000_000, estimated: 20_000, unknown: 0, unpriced: [] })
    expect(months['2026-10'].features).toBe(1)
    expect(months['2026-08'].money).toEqual(zero())
    expect(answer.month).toBe('2026-10')
  })
})

describe('the roles', () => {
  it('lists every team role, the lead and both workflows always, other agents only with runs, largest first', () => {
    const quiet = views([local()])
    expect(quiet.roles.map((role) => role.role).sort()).toEqual(['lead', 'product-manager', 'review-workflow', 'security-engineer', 'senior-developer', 'senior-recruiter', 'senior-tester', 'site-update-workflow', 'ux-designer'])
    expect(quiet.roles[0]).toMatchObject({ role: 'lead', runs: 1, share: 1 })
    const answer = views([
      local({ branch: 'a', batch: 1, role: 'senior-developer', output: 3000 }), local({ branch: 'b', batch: 1, role: 'senior-developer', output: 1000 }),
      local({ branch: 'a', batch: 2, role: 'explore', output: 500 }), local({ branch: 'a', batch: 3, role: 'general-purpose', output: 500 }),
      review(1, 1, { branch: 'a', reportedMicro: 20_000 }),
    ])
    const developer = answer.roles.find((role) => role.role === 'senior-developer')!
    expect(answer.roles[0].role).toBe('senior-developer')
    expect(developer).toMatchObject({ kind: 'team', runs: 2, perFeatureMicro: 40_000 })
    expect(developer.byPhase.build.estimated).toBe(80_000)
    const other = answer.roles.find((role) => role.role === 'other-agents')!
    expect(other).toMatchObject({ kind: 'other', runs: 2 })
    expect(answer.roles.find((role) => role.role === 'review-workflow')).toMatchObject({ kind: 'workflow', runs: 1 })
    expect(answer.roles.reduce((all, role) => all + role.share, 0)).toBeCloseTo(1, 10)
    expect(answer.roles.find((role) => role.role === 'ux-designer')).toMatchObject({ runs: 0, share: 0, perFeatureMicro: 0 })
  })

  it('answers an empty database with the flag and empty views', () => {
    const answer = views([])
    expect(answer).toMatchObject({ empty: true, features: [], repo: 'stewils/stevenwilssens.com', pricesRead: '2026-10-19' })
    expect(answer.months.every((month) => totalOf(month.money) === 0)).toBe(true)
  })
})

describe('the days', () => {
  it('are the last 30 UTC days ending with today', () => {
    const days = lastDays(NOW)
    expect(days).toHaveLength(30)
    expect([days[0], days.at(-1)]).toEqual(['2026-09-20', '2026-10-19'])
    // Across a month and a year end.
    expect(lastDays(Date.UTC(2027, 0, 2), 3)).toEqual(['2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('split the spend by how it was paid, count features worked on and started, and total the started ones', () => {
    const at = (day: number, hour = 10) => Date.UTC(2026, 9, day, hour)
    const answer = views([
      // dev-costs starts on Oct 17 and goes on on Oct 18; resume-mail starts on Oct 18.
      local({ branch: 'dev-costs', batchAt: at(17) }),
      review(100, 1, { branch: 'dev-costs', batchAt: at(18) }),
      local({ branch: 'resume-mail', runKey: 'local:s2', batchAt: at(18, 23), billing: 'unknown' }),
      // main is no feature; a row older than 30 days counts in no day, though its feature still started then.
      local({ branch: 'main', runKey: 'local:s3', batchAt: at(19) }),
      local({ branch: 'old-idea', runKey: 'local:s4', batchAt: Date.UTC(2026, 7, 1) }),
    ])
    const days = Object.fromEntries(answer.days.map((day) => [day.day, day]))
    expect(answer.days).toHaveLength(30)
    expect(days['2026-10-17']).toEqual({ day: '2026-10-17', money: { billed: 0, estimated: 20_000, unknown: 0, unpriced: [] }, features: 1, started: 1, startedTotal: { billed: 1_000_000, estimated: 20_000, unknown: 0, unpriced: [] } })
    expect(days['2026-10-18']).toEqual({ day: '2026-10-18', money: { billed: 1_000_000, estimated: 0, unknown: 20_000, unpriced: [] }, features: 2, started: 1, startedTotal: { billed: 0, estimated: 0, unknown: 20_000, unpriced: [] } })
    expect(days['2026-10-19']).toMatchObject({ money: { billed: 0, estimated: 20_000, unknown: 0 }, features: 0, started: 0 })
    expect(answer.days.reduce((all, day) => all + day.started, 0)).toBe(2)
    expect(answer.features.find((feature) => feature.branch === 'dev-costs')!.firstRunAt).toBe(at(17))
  })
})
