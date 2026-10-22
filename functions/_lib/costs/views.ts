// The five views of /admin#costs, worked out when they are read (GET /api/costs) from the
// stored rows, the budgets, the price table and the pull requests GitHub knows: per feature
// (by phase, with its budget and its pull request's state), per role, per UTC month, and the
// waste. Pure, so every rule is tested on its own (views.test.ts).
//
// Money is kept in integer micro-dollars and apart by how sure it is: billed (charged to the
// API key), estimated (the API price of tokens on the subscription) and unknown. A local row
// whose model has no price is never counted as zero: its tokens are listed as unpriced.
// Review workflow rounds are numbered per pull request by (run id, attempt); a Site update
// run is the spec and build of its branch. Waste (AC-19) is every local fix round, every
// review round after the first in the same place, and all of a feature whose pull request was
// closed without merging or redone, never counted twice.
import { costOf } from '../prices'
import { assignPhases, TEAM_ROLES, type PhaseKind } from './phases'
import type { CostRow } from './store'

export type Money = { billed: number; estimated: number; unknown: number; unpriced: { model: string; tokens: number }[] }
// headRepo: the repository the pull request's branch lives in (owner/name); a fork's can carry any branch name.
export type PullInfo = { number: number; state: 'open' | 'closed'; merged: boolean; mergeCommit: string | null; branch: string; headRepo: string | null; supersedes: number | null }
export type PullState = { state: 'open' | 'merged' | 'closed' | 'superseded' | 'none' | 'unknown'; number: number | null; mergeCommit: string | null; supersededBy: number | null }
export type LineKind = PhaseKind | 'site-update' | 'review-workflow'
export type PhaseLine = { kind: LineKind; round: number; pr: number | null; at: number; money: Money; roles: { role: string; money: Money }[] }
export type Feature = {
  branch: string | null; pull: PullState | null; runs: number; lastRunAt: number
  spec: Money; build: Money; review: Money; fix: Money; lead: Money; total: Money
  reviewRounds: number; fixRounds: number; budgetMicro: number | null; phases: PhaseLine[]; tokensIn: number; tokensOut: number
  waste: { money: Money; fixRounds: number; moreReviews: number; closed: boolean; redoneBy: number | null }
}
export type RoleKind = 'team' | 'lead' | 'workflow' | 'other'
export type RoleRow = { role: string; kind: RoleKind; runs: number; total: Money; share: number; perFeatureMicro: number; byPhase: Record<'spec' | 'build' | 'review' | 'fix' | 'lead', Money> }
export type MonthRow = { month: string; money: Money; features: number; wasteMicro: number }
export type CostsAnswer = {
  generatedAt: number; empty: boolean; month: string; repo: string | null; pricesRead: string
  features: Feature[]; roles: RoleRow[]; months: MonthRow[]; waste: { fix: Money; reviews: Money; closed: Money }
}

// Branches that are not a feature: their runs collect under "No feature".
const NO_FEATURE = new Set(['main', 'HEAD', ''])
export const featureOf = (branch: string) => (NO_FEATURE.has(branch) ? null : branch)
export const WORKFLOW_ROLES = ['review-workflow', 'site-update-workflow']

export const zero = (): Money => ({ billed: 0, estimated: 0, unknown: 0, unpriced: [] })
export const totalOf = (money: Money) => money.billed + money.estimated + money.unknown
export const add = (into: Money, from: Money) => {
  into.billed += from.billed
  into.estimated += from.estimated
  into.unknown += from.unknown
  for (const item of from.unpriced) {
    const known = into.unpriced.find((entry) => entry.model === item.model)
    if (known) known.tokens += item.tokens
    else into.unpriced.push({ ...item })
  }
  return into
}
const sum = (items: Money[]) => items.reduce((all, item) => add(all, item), zero())

// One row's money: a GitHub row's reported cost, or a local row's tokens at the table's price.
export const moneyOf = (row: CostRow): Money => {
  const money = zero()
  const tokens = { input: row.input, output: row.output, cacheRead: row.cacheRead, cacheWrite5m: row.cacheWrite5m, cacheWrite1h: row.cacheWrite1h }
  const micro = row.source === 'github' ? row.reportedMicro ?? 0 : costOf(row.model, tokens)
  if (micro === null) money.unpriced.push({ model: row.model, tokens: row.input + row.output + row.cacheRead + row.cacheWrite5m + row.cacheWrite1h })
  else money[row.billing] += micro
  return money
}

const UNKNOWN: PullState = { state: 'unknown', number: null, mergeCommit: null, supersededBy: null }

// Only the pull requests whose branch lives in this repository: a fork's pull request with
// the same branch name (or a redo marker in its body) never closes or redoes a feature.
export const ownPulls = (pulls: PullInfo[] | null, repo: string | null) =>
  pulls && repo ? pulls.filter((item) => item.headRepo?.toLowerCase() === repo.toLowerCase()) : pulls

// The pull request of a feature, from GitHub's list (null when GitHub could not be asked).
// The list is newest first, so a pull request found in it is the newest; when the list was
// cut at its page cap (`capped`), a branch not in it may still have an older one: unknown.
export const pullStateOf = (branch: string, pulls: PullInfo[] | null, capped = false): PullState => {
  if (!pulls) return { ...UNKNOWN }
  const pull = pulls.filter((item) => item.branch === branch).sort((a, b) => b.number - a.number)[0]
  if (!pull) return capped ? { ...UNKNOWN } : { state: 'none', number: null, mergeCommit: null, supersededBy: null }
  if (pull.merged) return { state: 'merged', number: pull.number, mergeCommit: pull.mergeCommit, supersededBy: null }
  if (pull.state === 'open') return { state: 'open', number: pull.number, mergeCommit: null, supersededBy: null }
  const redo = pulls.filter((item) => item.supersedes === pull.number && item.number !== pull.number).sort((a, b) => a.number - b.number)[0]
  return redo ? { state: 'superseded', number: pull.number, mergeCommit: null, supersededBy: redo.number } : { state: 'closed', number: pull.number, mergeCommit: null, supersededBy: null }
}

// Review workflow rounds of one pull request: by (run id, attempt), whatever order they came in.
export const reviewRounds = (rows: CostRow[]): Map<CostRow, number> => {
  const rounds = new Map<CostRow, number>()
  const byPull = new Map<string, CostRow[]>()
  for (const row of rows.filter((item) => item.workflow === 'review')) {
    const key = `${row.branch}#${row.pr ?? ''}`
    const group = byPull.get(key)
    if (group) group.push(row)
    else byPull.set(key, [row])
  }
  for (const group of byPull.values()) {
    // Each distinct run once, sorted, then a lookup per row: n log n, not a search per row.
    const runs = new Map<string, [number, number]>()
    for (const row of group) runs.set(`${row.runId}:${row.runAttempt}`, [Number(row.runId), Number(row.runAttempt)])
    const order = new Map([...runs.entries()].sort(([, a], [, b]) => a[0] - b[0] || a[1] - b[1]).map(([key], index) => [key, index + 1]))
    for (const row of group) rounds.set(row, order.get(`${row.runId}:${row.runAttempt}`)!)
  }
  return rounds
}

type Tagged = { row: CostRow; money: Money; line: LineKind; round: number; waste: 'fix' | 'reviews' | 'closed' | null }

// Every row of one feature with its phase line, round and waste reason.
const tagFeature = (rows: CostRow[], closed: boolean): Tagged[] => {
  const local = rows.filter((row) => row.source === 'local')
  const batchKey = (row: CostRow) => `${row.runKey}#${row.batch}`
  const batches = new Map<string, { key: string; at: number; roles: string[]; lead: boolean }>()
  for (const row of local) {
    const key = batchKey(row)
    const batch = batches.get(key) ?? { key, at: row.batchAt, roles: [], lead: row.batch === 0 }
    batch.at = Math.min(batch.at, row.batchAt)
    if (!batch.roles.includes(row.role)) batch.roles.push(row.role)
    batches.set(key, batch)
  }
  const phases = assignPhases([...batches.values()])
  const rounds = reviewRounds(rows)
  return rows.map((row) => {
    const money = moneyOf(row)
    let line: LineKind
    let round = 0
    if (row.source === 'github') {
      line = row.workflow === 'review' ? 'review-workflow' : 'site-update'
      round = rounds.get(row) ?? 0
    } else {
      // The lead's own rows are the lead's, in any batch.
      const phase = row.role === 'lead' ? { kind: 'lead' as const, round: 0 } : phases.get(batchKey(row))!
      line = phase.kind
      round = phase.round
    }
    const waste = closed ? 'closed' : line === 'fix' ? 'fix' : (line === 'review' || line === 'review-workflow') && round > 1 ? 'reviews' : null
    return { row, money, line, round, waste }
  })
}

const column = (line: LineKind): 'spec' | 'build' | 'review' | 'fix' | 'lead' => (line === 'site-update' ? 'build' : line === 'review-workflow' ? 'review' : line)

const lineKey = (tagged: Tagged) => `${tagged.line}#${tagged.round}#${tagged.line === 'review-workflow' ? tagged.row.pr ?? '' : ''}`

const phaseLines = (tagged: Tagged[]): PhaseLine[] => {
  const lines = new Map<string, PhaseLine>()
  for (const item of tagged) {
    const key = lineKey(item)
    const line = lines.get(key) ?? { kind: item.line, round: item.round, pr: item.line === 'review-workflow' ? item.row.pr : null, at: item.row.batchAt, money: zero(), roles: [] }
    line.at = Math.min(line.at, item.row.batchAt)
    add(line.money, item.money)
    const role = line.roles.find((entry) => entry.role === item.row.role)
    if (role) add(role.money, item.money)
    else line.roles.push({ role: item.row.role, money: add(zero(), item.money) })
    lines.set(key, line)
  }
  // In run order, the lead last.
  return [...lines.values()].sort((a, b) => Number(a.kind === 'lead') - Number(b.kind === 'lead') || a.at - b.at)
}

const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7)
export const lastMonths = (now: number, count = 12) => {
  const date = new Date(now)
  return Array.from({ length: count }, (_, index) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - (count - 1 - index), 1)).toISOString().slice(0, 7))
}

const roleKind = (role: string): RoleKind => (role === 'lead' ? 'lead' : TEAM_ROLES.includes(role) ? 'team' : WORKFLOW_ROLES.includes(role) ? 'workflow' : 'other')
const OTHER = 'other-agents'

// pullsCapped: GitHub's list stopped at its page cap, so it may not hold every pull request.
export const buildViews = ({ rows, budgets, pulls: allPulls, pullsCapped = false, now, repo, pricesRead }: { rows: CostRow[]; budgets: Map<string, number>; pulls: PullInfo[] | null; pullsCapped?: boolean; now: number; repo: string | null; pricesRead: string }): CostsAnswer => {
  const pulls = ownPulls(allPulls, repo)
  const byFeature = new Map<string | null, CostRow[]>()
  for (const row of rows) {
    const feature = featureOf(row.branch)
    const group = byFeature.get(feature)
    if (group) group.push(row)
    else byFeature.set(feature, [row])
  }

  const allTagged: (Tagged & { feature: string | null })[] = []
  const features: Feature[] = []
  for (const [branch, group] of byFeature) {
    const pull = branch === null ? null : pullStateOf(branch, pulls, pullsCapped)
    const closed = pull?.state === 'closed' || pull?.state === 'superseded'
    const tagged = tagFeature(group, closed)
    allTagged.push(...tagged.map((item) => ({ ...item, feature: branch })))
    const part = (name: 'spec' | 'build' | 'review' | 'fix' | 'lead') => sum(tagged.filter((item) => column(item.line) === name).map((item) => item.money))
    const lines = phaseLines(tagged)
    const fixRounds = new Set(tagged.filter((item) => item.line === 'fix').map((item) => item.round)).size
    const localReviews = new Set(tagged.filter((item) => item.line === 'review').map((item) => item.round)).size
    const workflowReviews = new Set(tagged.filter((item) => item.line === 'review-workflow').map(lineKey)).size
    const morePerPull = new Map<string, number>()
    for (const item of tagged.filter((entry) => entry.line === 'review-workflow')) morePerPull.set(String(item.row.pr), Math.max(morePerPull.get(String(item.row.pr)) ?? 0, item.round - 1))
    features.push({
      branch,
      pull,
      runs: new Set(group.map((row) => row.runKey)).size,
      lastRunAt: group.reduce((latest, row) => Math.max(latest, row.endedAt), -Infinity),
      spec: part('spec'), build: part('build'), review: part('review'), fix: part('fix'), lead: part('lead'),
      total: sum(tagged.map((item) => item.money)),
      reviewRounds: localReviews + workflowReviews,
      fixRounds,
      budgetMicro: branch === null ? null : budgets.get(branch) ?? null,
      phases: lines,
      tokensIn: group.reduce((all, row) => all + row.input + row.cacheRead + row.cacheWrite5m + row.cacheWrite1h, 0),
      tokensOut: group.reduce((all, row) => all + row.output, 0),
      waste: {
        money: sum(tagged.filter((item) => item.waste).map((item) => item.money)),
        fixRounds,
        moreReviews: Math.max(0, localReviews - 1) + [...morePerPull.values()].reduce((all, n) => all + n, 0),
        closed,
        redoneBy: pull?.supersededBy ?? null,
      },
    })
  }
  const over = (feature: Feature) => (feature.budgetMicro !== null && totalOf(feature.total) > feature.budgetMicro ? totalOf(feature.total) - feature.budgetMicro : -1)
  features.sort((a, b) => Number(a.branch === null) - Number(b.branch === null) || Number(over(b) >= 0) - Number(over(a) >= 0) || b.lastRunAt - a.lastRunAt)

  const grand = totalOf(sum(allTagged.map((item) => item.money)))
  const roleRows = new Map<string, { kind: RoleKind; runs: Set<string>; features: Set<string>; byPhase: RoleRow['byPhase'] }>()
  const blankPhases = () => ({ spec: zero(), build: zero(), review: zero(), fix: zero(), lead: zero() })
  for (const role of [...TEAM_ROLES, 'lead', ...WORKFLOW_ROLES]) roleRows.set(role, { kind: roleKind(role), runs: new Set(), features: new Set(), byPhase: blankPhases() })
  for (const item of allTagged) {
    const kind = roleKind(item.row.role)
    const name = kind === 'other' ? OTHER : item.row.role
    const entry = roleRows.get(name) ?? { kind, runs: new Set<string>(), features: new Set<string>(), byPhase: blankPhases() }
    entry.runs.add(`${item.row.runKey}#${item.row.branch}#${item.row.batch}`)
    entry.features.add(String(item.feature))
    add(entry.byPhase[column(item.line)], item.money)
    roleRows.set(name, entry)
  }
  const roles: RoleRow[] = [...roleRows.entries()].map(([role, entry]) => {
    const total = sum(Object.values(entry.byPhase))
    return { role, kind: entry.kind, runs: entry.runs.size, total, share: grand ? totalOf(total) / grand : 0, perFeatureMicro: entry.features.size ? Math.round(totalOf(total) / entry.features.size) : 0, byPhase: entry.byPhase }
  }).sort((a, b) => totalOf(b.total) - totalOf(a.total))

  const months: MonthRow[] = lastMonths(now).map((month) => {
    const inMonth = allTagged.filter((item) => monthOf(item.row.batchAt) === month)
    return {
      month,
      money: sum(inMonth.map((item) => item.money)),
      features: new Set(inMonth.map((item) => item.feature).filter((feature) => feature !== null)).size,
      wasteMicro: inMonth.filter((item) => item.waste).reduce((all, item) => all + totalOf(item.money), 0),
    }
  })

  const wasteOf = (reason: Tagged['waste']) => sum(allTagged.filter((item) => item.waste === reason).map((item) => item.money))
  return {
    generatedAt: now, empty: rows.length === 0, month: monthOf(now), repo, pricesRead,
    features, roles, months,
    waste: { fix: wasteOf('fix'), reviews: wasteOf('reviews'), closed: wasteOf('closed') },
  }
}
