// GET /api/ask/admin?days=30: what the dashboard shows about the assistant: this
// month against the budget, questions and cost per day and outcome, votes, every
// question in the range with the visitor who asked it (the people who used it) and what
// produced its answer (the model, the versions, the sources it cited, Steven's rating),
// Steven's ratings in the range, the open questions it could not answer, and how many
// Steven has closed (admin token). GET /api/ask/admin?entry=<id>: one logged answer whole.
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/auth'
import { json } from '../../_lib/http'
import { budgetMicro, checkAfterMicro, DEFAULT_BUDGET_USD, humanCheck, MODEL } from '../../_lib/ask/agent'
import { sources } from '../../_lib/ask/prompt'
import { D1AskStore, dayOf, monthStart, type LogEntry, type Rating } from '../../_lib/ask/store'

// The log keeps 90 days and the card shows at most this many questions.
const LOG_DAYS = 90
const LOG_LIMIT = 2000
const ANSWER_CHARS = 1500
// Needs you counts the unrated answers of the last seven days, whatever the range.
const UNRATED_DAYS = 7

// A logged answer as the admin shows it: each cited source by its title and link from the
// site's own data (`titles`, read once per request; an id no longer in it as the id alone),
// and its rating.
const shown = (titles: ReturnType<typeof sources>, entry: LogEntry, rating: Rating | null) =>
  ({ ...entry, sources: (entry.sources ?? []).map((id) => titles.get(id) ?? { id, title: null, href: null }), rating })

const oneEntry = async (env: Env, param: string) => {
  const id = Number(param)
  if (!/^\d+$/.test(param) || !Number.isSafeInteger(id) || id < 1) return json({ error: 'invalid', field: 'entry' }, 400)
  try {
    const store = new D1AskStore(env.DB)
    const [entry, rating] = await Promise.all([store.entry(id), store.ratingFor(id)])
    return entry ? json({ entry: shown(sources(), entry, rating) }) : json({ error: 'not found' }, 404)
  } catch (error) {
    console.error('ask entry', error instanceof Error ? error.message : 'unknown error')
    return json({ error: 'unavailable' }, 503)
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401)
  const params = new URL(request.url).searchParams
  const entryParam = params.get('entry')
  if (entryParam !== null) return oneEntry(env, entryParam)
  const days = Math.min(Math.max(Number(params.get('days')) || 30, 1), 365)
  const now = Date.now()
  const store = new D1AskStore(env.DB)
  const sinceDay = dayOf(now - days * 86_400_000)
  const ninetyDays = now - 90 * 86_400_000
  const logged = Promise.all([
    store.log(now - Math.min(days, LOG_DAYS) * 86_400_000, LOG_LIMIT),
    store.ratings(sinceDay),
    store.unrated(now - UNRATED_DAYS * 86_400_000),
  ]).catch((err: unknown) => { console.error('ask log', err); return null })
  const [daily, votes, questions, resolved, monthRows, check, kept] = await Promise.all([store.daily(sinceDay), store.votes(sinceDay), store.questions(ninetyDays, 200), store.resolvedCounts(ninetyDays), store.daily(monthStart(now)), humanCheck(env, store, now, null), logged])
  const month = { questions: 0, answered: 0, gap: 0, off: 0, limited: 0, failed: 0, costMicro: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
  for (const row of monthRows) {
    month.questions += row.questions
    month[row.outcome] += row.questions
    month.costMicro += row.costMicro
    month.inputTokens += row.inputTokens
    month.outputTokens += row.outputTokens
    month.cacheReadTokens += row.cacheReadTokens
    month.cacheWriteTokens += row.cacheWriteTokens
  }
  const [log, ratings, unrated] = kept ?? [null, null, null]
  const ratingOf = new Map((ratings ?? []).filter((rating) => rating.logId !== null).map((rating) => [rating.logId, rating]))
  const titles = sources()
  return json({
    configured: Boolean(env.ANTHROPIC_API_KEY),
    mock: env.ASK_MOCK === '1',
    model: MODEL,
    budgetUsd: Number(env.ASK_BUDGET_USD) || DEFAULT_BUDGET_USD,
    budgetMicro: budgetMicro(env),
    humanCheck: Boolean(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY),
    // off: no keys; standby: nobody is asked; on: every question needs a Turnstile token, because of `why`.
    check: { state: check.state, why: check.why, lastHour: check.allHits, spentTodayMicro: check.spentTodayMicro, afterMicro: checkAfterMicro(env) },
    days,
    month,
    daily,
    votes,
    questions,
    resolved,
    // Answers can be long; the list needs enough to read, and ?entry= has the rest.
    log: log?.map((entry) => {
      const cut = Boolean(entry.answer && entry.answer.length > ANSWER_CHARS)
      return { ...shown(titles, entry, ratingOf.get(entry.id) ?? null), answer: cut ? `${entry.answer!.slice(0, ANSWER_CHARS)}…` : entry.answer, cut }
    }),
    logDays: Math.min(days, LOG_DAYS),
    logCapped: log ? log.length >= LOG_LIMIT : undefined,
    // Every rating whose answer's day is in the range, those past the 90-day log included.
    ratings: ratings ?? undefined,
    // The rateable answers of the last seven days without a rating (Needs you).
    unratedWeek: unrated ?? undefined,
  })
}
