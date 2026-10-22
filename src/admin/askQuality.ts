// How Steven tells whether the assistant gets better (specs/ask-ratings.md, "How better is
// measured"): his ratings summed into a good share with its 95% range (Wilson), versions
// (the model and the instruction version) compared with Newcombe's range of the difference,
// a verdict for the version answering now, the weeks for the chart, and the queue of answers
// to rate. Pure, so the cards, Needs you and the overview tile all read the same numbers.
import { CRITERIA, isGood, isModel, isRateable, isWrong, type CriterionKey } from '../../functions/_lib/ask/rating'
import type { AskInfo, AskLogEntry, AskRating } from './types'

export { CRITERIA, isPoor, OVERALL, NOTE_MAX } from '../../functions/_lib/ask/rating'
export { isGood, isRateable, isWrong }

// A verdict needs this many primary-served ratings on each side; a week under THIN is not a firm reading.
export const MIN_RATED = 20
export const THIN = 5
const Z = 1.959964
const DAY = 86_400_000

export type Range = { low: number; high: number }

/** Wilson's 95% range of a share k of n; null with nothing to rest on. */
export const wilson = (k: number, n: number, z = Z): Range | null => {
  if (n <= 0) return null
  const p = k / n
  const z2 = z * z
  const denominator = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denominator
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) }
}

/** The difference of two shares, k1/n1 − k2/n2, with its 95% range (Newcombe 1998, method 10, from the two Wilson ranges). */
export const newcombe = (k1: number, n1: number, k2: number, n2: number): (Range & { diff: number }) | null => {
  const a = wilson(k1, n1)
  const b = wilson(k2, n2)
  if (!a || !b) return null
  const p1 = k1 / n1
  const p2 = k2 / n2
  const diff = p1 - p2
  return { diff, low: diff - Math.sqrt((p1 - a.low) ** 2 + (b.high - p2) ** 2), high: diff + Math.sqrt((a.high - p1) ** 2 + (p2 - b.low) ** 2) }
}

/** A share as whole percentage points, never −0. */
export const points = (share: number) => {
  const value = Math.round(share * 100)
  return value === 0 ? 0 : value
}
/** "72%"; signed numbers with a real minus sign ("−3"). */
export const pct = (share: number) => `${points(share)}%`
export const signed = (value: number) => (value < 0 ? `−${Math.abs(value)}` : String(value))
export const rangeText = (range: Range) => `${signed(points(range.low))} to ${signed(points(range.high))}`

export type CriterionCount = { yes: number; partly: number; no: number; na: number; base: number; yesShare: number | null; partlyShare: number | null }
export type Summary = { rated: number; good: number; goodShare: number | null; range: Range | null; mean: number | null; wrong: number; wrongShare: number | null; criteria: Record<CriterionKey, CriterionCount> }

/** The numbers of a set of ratings: n/a is left out of a criterion's share and counted beside it. */
export const summarize = (ratings: AskRating[]): Summary => {
  const rated = ratings.length
  const good = ratings.filter(isGood).length
  const wrong = ratings.filter(isWrong).length
  const criteria = {} as Record<CriterionKey, CriterionCount>
  for (const { key } of CRITERIA) {
    const count = { yes: 0, partly: 0, no: 0, na: 0 }
    for (const rating of ratings) count[rating[key]]++
    const base = rated - count.na
    criteria[key] = { ...count, base, yesShare: base ? count.yes / base : null, partlyShare: base ? count.partly / base : null }
  }
  return { rated, good, goodShare: rated ? good / rated : null, range: wilson(good, rated), mean: rated ? ratings.reduce((sum, rating) => sum + rating.overall, 0) / rated : null, wrong, wrongShare: rated ? wrong / rated : null, criteria }
}

// ------------------------------------------------------------------ versions

/** A version is the model and the instruction version; how it was served (a fallback, the mock) keeps it apart. Before the versions were recorded: Before versions. */
type Produced = { model?: string | null; promptVersion?: string | null; fallback?: boolean | null }
export const versionKey = ({ model, promptVersion, fallback }: Produced) => (model && promptVersion ? `${model}|${promptVersion}|${fallback ? 'fallback' : 'primary'}` : 'before')
export const modelLabel = (model: string) => model.replace(/^claude-/, '')
export const versionLabel = (version: Produced) => (versionKey(version) === 'before' ? 'Before versions' : `${modelLabel(version.model!)} · ${version.promptVersion}${version.fallback ? ' · fallback' : ''}`)

export type Note = { ratedAt: number; note: string; question: string | null }
export type Version = {
  key: string; label: string; model: string | null; promptVersion: string | null; fallback: boolean; mock: boolean; before: boolean
  // Only primary-served answers (not a fallback, not the canned mock) enter the verdict.
  primary: boolean
  firstDay: string; lastDay: string; lastAt: number
  answers: number; rateable: number; answeredShare: number | null; knowledge: number
  ratings: AskRating[]; summary: Summary; notes: Note[]
}

const utcDay = (ts: number) => new Date(ts).toISOString().slice(0, 10)
const dayStart = (day: string) => Date.parse(`${day}T00:00:00Z`)

/** One row per version from the log and the ratings: newest first day first, Before versions last. */
export const versions = (log: AskLogEntry[], ratings: AskRating[]): Version[] => {
  type Work = { entries: AskLogEntry[]; ratings: AskRating[]; sample: Produced }
  const groups = new Map<string, Work>()
  const groupOf = (sample: Produced) => {
    const key = versionKey(sample)
    let group = groups.get(key)
    if (!group) { group = { entries: [], ratings: [], sample }; groups.set(key, group) }
    return group
  }
  for (const entry of log) groupOf(entry).entries.push(entry)
  for (const rating of ratings) groupOf(rating).ratings.push(rating)
  const questionOf = new Map(log.map((entry) => [entry.id, entry.question]))
  const rows = [...groups].map(([key, { entries, ratings: rated, sample }]): Version => {
    const days = [...entries.map((entry) => utcDay(entry.ts)), ...rated.map((rating) => rating.day)].sort()
    const answered = entries.filter((entry) => entry.outcome === 'answered').length
    const inScope = answered + entries.filter((entry) => entry.outcome === 'gap').length
    const before = key === 'before'
    const fallback = !before && Boolean(sample.fallback)
    const mock = !before && sample.model === 'mock'
    return {
      key, label: versionLabel(sample), model: before ? null : sample.model!, promptVersion: before ? null : sample.promptVersion!, fallback, mock, before,
      primary: !fallback && !mock,
      firstDay: days[0], lastDay: days[days.length - 1],
      lastAt: Math.max(...entries.map((entry) => entry.ts), ...rated.map((rating) => dayStart(rating.day))),
      answers: entries.length,
      rateable: entries.filter(isRateable).length,
      answeredShare: inScope ? answered / inScope : null,
      knowledge: new Set(entries.map((entry) => entry.knowledgeVersion).filter(Boolean)).size,
      ratings: rated,
      summary: summarize(rated),
      notes: rated.filter((rating) => rating.note).sort((a, b) => b.ratedAt - a.ratedAt).map((rating) => ({ ratedAt: rating.ratedAt, note: rating.note!, question: rating.logId === null ? null : (questionOf.get(rating.logId) ?? null) })),
    }
  })
  return rows.sort((a, b) => Number(a.before) - Number(b.before) || b.firstDay.localeCompare(a.firstDay) || b.lastAt - a.lastAt)
}

// ------------------------------------------------------------------ the verdict

export type Verdict =
  | { kind: 'none'; model: string }
  | { kind: 'first'; now: Version }
  | { kind: 'early'; now: Version; before: Version }
  | { kind: 'better' | 'worse' | 'same'; now: Version; before: Version; difference: Range & { diff: number } }

/**
 * The version answering now (the newest primary-served answer from MODEL, or its dated id)
 * against the version before it (of the other primary-served versions with ratings, the one
 * answered last, whatever its model; Before versions included). Fallback-served and mock
 * versions never enter it. The wrong-answer thresholds are compared in whole answers.
 */
export const verdict = (rows: Version[], model: string, min = MIN_RATED): Verdict => {
  const newest = (list: Version[]) => [...list].sort((a, b) => b.lastAt - a.lastAt)[0]
  const now = newest(rows.filter((row) => row.primary && !row.before && isModel(row.model!, model)))
  if (!now) return { kind: 'none', model }
  const before = newest(rows.filter((row) => row !== now && row.primary && row.summary.rated > 0))
  if (!before) return { kind: 'first', now }
  const n = now.summary
  const o = before.summary
  if (n.rated < min || o.rated < min) return { kind: 'early', now, before }
  const difference = newcombe(n.good, n.rated, o.good, o.rated)!
  // "Higher by at least two answers' worth" and "not higher", in whole numbers (3/20 − 1/20 >= 2/20 is false in floating point).
  const worseByWrong = n.wrong * o.rated - o.wrong * n.rated >= 2 * o.rated
  const wrongNotHigher = n.wrong * o.rated <= o.wrong * n.rated
  const kind = difference.high < 0 || worseByWrong ? 'worse' : difference.low > 0 && wrongNotHigher ? 'better' : 'same'
  return { kind, now, before, difference }
}

export const verdictBadge: Record<Verdict['kind'], { word: string; tone: string }> = {
  better: { word: 'Better', tone: '' },
  worse: { word: 'Worse', tone: 'error' },
  same: { word: 'No clear difference', tone: 'info' },
  early: { word: 'Too early to tell', tone: 'info' },
  first: { word: 'Too early to tell', tone: 'info' },
  none: { word: 'No verdict', tone: 'info' },
}

const share = (summary: Summary) => `${pct(summary.goodShare!)} (${summary.good} of ${summary.rated})`
const ratedOf = (version: Version, min: number) => (version.summary.rated < min ? `${version.summary.rated} of ${min} rated` : `${version.summary.rated} rated`)

/** The sentence after the badge word. */
export const verdictText = (result: Verdict, min = MIN_RATED) => {
  switch (result.kind) {
    case 'none': return `no answer from ${modelLabel(result.model)} in this range.`
    case 'first': return 'this is the first version with ratings.'
    case 'early': return `${result.now.label} has ${ratedOf(result.now, min)}; ${result.before.label} has ${ratedOf(result.before, min)}.`
    default: {
      const value = points(result.difference.diff)
      const change = value === 0 ? 'the same share' : `${Math.abs(value)} points ${value > 0 ? 'better' : 'worse'}`
      return `${result.now.label} is rated good ${share(result.now.summary)} against ${share(result.before.summary)} before; ${change} (range ${rangeText(result.difference)}).`
    }
  }
}

/** How each version is drawn: the verdict's two versions solid and dashed, every other one dotted. */
export const lineStyle = (version: Version, result: Verdict): 'now' | 'before' | 'other' =>
  result.kind !== 'none' && result.now === version ? 'now' : (result.kind === 'early' || result.kind === 'better' || result.kind === 'worse' || result.kind === 'same') && result.before === version ? 'before' : 'other'

// ------------------------------------------------------------------ weeks

/** The Monday (00:00 UTC) of a day's week. */
export const weekOf = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}
/** A week by its Monday, day before month: "13 Oct". */
export const weekLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
/** Every week from the one with `sinceDay` to the one with `untilDay`. */
export const weekList = (sinceDay: string, untilDay: string) => {
  const weeks: string[] = []
  for (let at = dayStart(weekOf(sinceDay)); at <= dayStart(untilDay); at += 7 * DAY) weeks.push(utcDay(at))
  return weeks
}

export type WeekPoint = { week: string; n: number; good: number; share: number; range: Range; thin: boolean }
/** A version's good share per week; a week without ratings has no point (never a zero). */
export const weeklyShares = (ratings: AskRating[], weeks: string[]): (WeekPoint | null)[] => weeks.map((week) => {
  const inWeek = ratings.filter((rating) => weekOf(rating.day) === week)
  if (!inWeek.length) return null
  const good = inWeek.filter(isGood).length
  return { week, n: inWeek.length, good, share: good / inWeek.length, range: wilson(good, inWeek.length)!, thin: inWeek.length < THIN }
})

export type WeekContext = { week: string; answered: number; inScope: number; answeredShare: number | null; helpful: number; votes: number }
/** Beside Steven's scores, never mixed in: the answered share and the reader votes per week. */
export const weeklyContext = (daily: AskInfo['daily'], votes: AskInfo['votes'], weeks: string[]): WeekContext[] => weeks.map((week) => {
  const days = daily.filter((row) => weekOf(row.day) === week)
  const answered = days.filter((row) => row.outcome === 'answered').reduce((sum, row) => sum + row.questions, 0)
  const inScope = answered + days.filter((row) => row.outcome === 'gap').reduce((sum, row) => sum + row.questions, 0)
  const voted = votes.filter((row) => weekOf(row.day) === week)
  const helpful = voted.reduce((sum, row) => sum + row.helpful, 0)
  return { week, answered, inScope, answeredShare: inScope ? answered / inScope : null, helpful, votes: helpful + voted.reduce((sum, row) => sum + row.unhelpful, 0) }
})

// ------------------------------------------------------------------ the queue

export type Filter = 'unrated' | 'rated' | 'wrong' | 'all'
const matches: Record<Filter, (entry: AskLogEntry) => boolean> = {
  unrated: (entry) => !entry.rating,
  rated: (entry) => Boolean(entry.rating),
  wrong: (entry) => Boolean(entry.rating && isWrong(entry.rating)),
  all: () => true,
}
/** The rateable answers in a filter, newest first. */
export const queueOf = (log: AskLogEntry[], filter: Filter) => log.filter((entry) => isRateable(entry) && matches[filter](entry)).sort((a, b) => b.ts - a.ts)
export const queueCounts = (log: AskLogEntry[]): Record<Filter, number> => ({ unrated: queueOf(log, 'unrated').length, rated: queueOf(log, 'rated').length, wrong: queueOf(log, 'wrong').length, all: queueOf(log, 'all').length })
/** The same visitor's earlier questions that day: the conversation an answer belongs to. */
export const earlierTurns = (log: AskLogEntry[], entry: AskLogEntry) => log.filter((item) => item.visitor === entry.visitor && item.ts < entry.ts).sort((a, b) => a.ts - b.ts)

/** The page's data with the ratings Steven saved since it loaded, so every card, Needs you and the tile show them at once. */
export const withRatings = (info: AskInfo, saved: Map<number, AskRating>): AskInfo => {
  if (!saved.size) return info
  const ratings = (info.ratings ?? []).filter((rating) => rating.logId === null || !saved.has(rating.logId))
  return {
    ...info,
    log: info.log?.map((entry) => (saved.has(entry.id) ? { ...entry, rating: saved.get(entry.id)! } : entry)),
    ratings: [...ratings, ...saved.values()],
    unratedWeek: info.unratedWeek?.filter((id) => !saved.has(id)),
  }
}

/** "· 72% rated good (25)" for the overview tile, once there is a rating. */
export const tileText = (ratings: AskRating[] | undefined) => {
  const summary = summarize(ratings ?? [])
  return summary.rated ? ` · ${pct(summary.goodShare!)} rated good (${summary.rated})` : ''
}
