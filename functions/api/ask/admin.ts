// GET /api/ask/admin?days=30: what the dashboard shows about the assistant: this
// month against the budget, questions and cost per day and outcome, votes, the
// open questions it could not answer, and how many Steven has closed (admin token).
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/auth'
import { budgetMicro, DEFAULT_BUDGET_USD, MODEL } from '../../_lib/ask/agent'
import { D1AskStore, dayOf, monthStart } from '../../_lib/ask/store'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401)
  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get('days')) || 30, 1), 365)
  const now = Date.now()
  const store = new D1AskStore(env.DB)
  const sinceDay = dayOf(now - days * 86_400_000)
  const ninetyDays = now - 90 * 86_400_000
  const [daily, votes, questions, resolved, monthRows] = await Promise.all([store.daily(sinceDay), store.votes(sinceDay), store.questions(ninetyDays, 200), store.resolvedCounts(ninetyDays), store.daily(monthStart(now))])
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
  return json({
    configured: Boolean(env.ANTHROPIC_API_KEY),
    mock: env.ASK_MOCK === '1',
    model: MODEL,
    budgetUsd: Number(env.ASK_BUDGET_USD) || DEFAULT_BUDGET_USD,
    budgetMicro: budgetMicro(env),
    humanCheck: Boolean(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY),
    days,
    month,
    daily,
    votes,
    questions,
    resolved,
  })
}
