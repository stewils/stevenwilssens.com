import { TrendChart } from './Charts'
import { DataTable, type Column } from './DataTable'
import { dayLabel, fillDays, formatDuration, formatNumber, formatTime, formatUsd, monthName, projectMonth } from './format'
import type { AskInfo } from './types'

type Question = AskInfo['questions'][number]
const questionColumns: Column<Question>[] = [
  { key: 'ts', label: 'When', value: (row) => row.ts, render: (row) => formatTime(row.ts) },
  { key: 'reason', label: 'Why', value: (row) => (row.reason === 'gap' ? 'not covered' : 'not helpful'), render: (row) => <span className={`badge ${row.reason}`}>{row.reason === 'gap' ? 'not covered' : 'not helpful'}</span> },
  { key: 'question', label: 'Question', value: (row) => row.question, strong: true },
  { key: 'answer', label: 'What it answered', value: (row) => row.answer, className: 'muted' },
  { key: 'page', label: 'Page', value: (row) => row.page },
  { key: 'network', label: 'Network', value: (row) => [row.asOrg, row.country].filter(Boolean).join(', ') },
]

type Day = { day: string; questions: number; costMicro: number; off: number; gap: number }

// The month's spend against the budget, and where the month ends at this pace.
function BudgetMeter({ spent, budgetUsd, now = new Date() }: { spent: number; budgetUsd: number; now?: Date }) {
  const budget = budgetUsd * 1_000_000
  const projected = projectMonth(spent, now)
  const scale = Math.max(budget, projected, spent, 1)
  const at = (value: number) => `${Math.min(100, (value / scale) * 100)}%`
  const over = projected > budget
  return (
    <div className="meter">
      <span className="meter-label">Budget this month</span>
      <div className="meter-track" role="img" aria-label={`${formatUsd(spent)} of ${formatUsd(budget)} spent; about ${formatUsd(projected)} by month end at this pace`}>
        <div className="meter-room" style={{ width: at(budget) }} />
        {projected > spent && <div className="meter-proj" style={{ width: at(projected) }} />}
        <div className="meter-used" style={{ width: spent ? `max(2px, ${at(spent)})` : 0 }} />
      </div>
      <p className="meter-text">
        {monthName(now)}: {formatUsd(spent)} of the {formatUsd(budget)} budget ({Math.round((spent / budget) * 100)}%) · month end ≈ {formatUsd(projected)} at this pace
        {over && <> <strong className="meter-over">· the budget would run out before the month ends</strong></>}
      </p>
    </div>
  )
}

// "Ask about Steven", the assistant on the site: this month against its budget,
// questions and cost per day, votes, and the questions it could not answer (the gaps
// to fill in the next MCP session).
export function AssistantPage({ info, days }: { info: AskInfo; days: number }) {
  const perDay = new Map<string, Day>()
  for (const row of info.daily) {
    const entry = perDay.get(row.day) ?? { day: row.day, questions: 0, costMicro: 0, off: 0, gap: 0 }
    entry.questions += row.questions; entry.costMicro += row.costMicro
    if (row.outcome === 'off') entry.off += row.questions
    if (row.outcome === 'gap') entry.gap += row.questions
    perDay.set(row.day, entry)
  }
  const answered = info.daily.filter((row) => row.outcome === 'answered' || row.outcome === 'gap')
  const asked = answered.reduce((sum, row) => sum + row.questions, 0)
  const avgFirst = asked ? answered.reduce((sum, row) => sum + row.msFirst, 0) / asked : null
  const votes = info.votes.reduce((sum, row) => ({ helpful: sum.helpful + row.helpful, unhelpful: sum.unhelpful + row.unhelpful }), { helpful: 0, unhelpful: 0 })
  const series = fillDays([...perDay.values()], days, new Date(), (day): Day => ({ day, questions: 0, costMicro: 0, off: 0, gap: 0 }))
  const cacheShare = info.month.cacheReadTokens + info.month.inputTokens ? Math.round((info.month.cacheReadTokens / (info.month.cacheReadTokens + info.month.inputTokens)) * 100) : 0
  return (
    <>
      <section className="card" data-part="Use and cost">
        <div className="card-head"><h2>Use and cost</h2></div>
        <p className="note">Claude ({info.model}) answers from the résumé data and the public dossier entries.{!info.configured && !info.mock && <strong> Not live yet: set the ANTHROPIC_API_KEY secret and redeploy.</strong>}{info.mock && <strong> Mock mode (ASK_MOCK=1): canned answers, no API calls.</strong>}</p>
        <div className="stats" aria-label="This month">
          <div className={info.month.costMicro > info.budgetUsd * 800_000 ? 'highlight' : ''}><span>Spent this month</span><strong>{formatUsd(info.month.costMicro)}</strong><small>of a {formatUsd(info.budgetUsd * 1_000_000)} budget</small></div>
          <div><span>Questions this month</span><strong>{formatNumber(info.month.questions)}</strong><small>{formatNumber(info.month.answered)} answered · {formatNumber(info.month.gap)} gaps · {formatNumber(info.month.off)} off topic</small></div>
          <div><span>Turned away</span><strong>{formatNumber(info.month.limited)}</strong><small>limits, budget or human check</small></div>
          <div><span>Votes ({days} days)</span><strong>{votes.helpful} / {votes.unhelpful}</strong><small>helpful / not helpful</small></div>
          <div><span>Time to first word</span><strong>{avgFirst === null ? '—' : formatDuration(avgFirst)}</strong><small>average, last {days} days</small></div>
          <div><span>Cache</span><strong>{cacheShare}%</strong><small>of input tokens read from cache</small></div>
        </div>
        <BudgetMeter spent={info.month.costMicro} budgetUsd={info.budgetUsd} />
        <div className="trends">
          <TrendChart title={`Questions per day (${days} days)`} unit="questions" points={series.map((row) => ({ key: row.day, label: dayLabel(row.day), value: row.questions, detail: `${formatNumber(row.questions)} questions · ${row.gap} gaps · ${row.off} off topic` }))} />
          <TrendChart title={`Cost per day (${days} days)`} unit="spent" format={formatUsd} points={series.map((row) => ({ key: row.day, label: dayLabel(row.day), value: row.costMicro, detail: `${formatUsd(row.costMicro)} · ${formatNumber(row.questions)} questions` }))} />
        </div>
      </section>

      <section className="card" data-part="Unanswered">
        <div className="card-head"><h2>Questions the dossier could not answer</h2></div>
        <p className="note">The last 90 days. Cover them in your next MCP session and they resolve themselves: the interview gets the same list.</p>
        <DataTable columns={questionColumns} rows={info.questions} rowKey={(row) => String(row.id)} empty="None in the last 90 days." label="Unanswered questions" />
      </section>
    </>
  )
}
