import { TrendChart } from './Charts'
import { DataTable, type Column } from './DataTable'
import { dayLabel, fillDays, formatDuration, formatNumber, formatTime, formatUsd, monthName, projectMonth } from './format'
import { askPeople, type Asker, type PeopleDay } from './askPeople'
import type { AskInfo, AskLogEntry, VisitorRow } from './types'

type Question = AskInfo['questions'][number]
const reasonLabel: Record<Question['reason'], string> = { gap: 'not covered', unhelpful: 'not helpful', fit: 'job requirement' }
const questionColumns: Column<Question>[] = [
  { key: 'ts', label: 'When', value: (row) => row.ts, render: (row) => formatTime(row.ts) },
  { key: 'reason', label: 'Why', value: (row) => reasonLabel[row.reason], render: (row) => <span className={`badge ${row.reason}`}>{reasonLabel[row.reason]}</span> },
  { key: 'question', label: 'Question', value: (row) => row.question, strong: true },
  { key: 'answer', label: 'What it answered', value: (row) => row.answer ?? '', className: 'muted' },
  { key: 'page', label: 'Page', value: (row) => row.page },
  { key: 'network', label: 'Network', value: (row) => [row.asOrg, row.country].filter(Boolean).join(', ') },
]

const outcomeLabel: Record<AskLogEntry['outcome'], string> = { answered: 'answered', gap: 'not covered', off: 'off topic', limited: 'turned away', failed: 'failed' }
const outcomeBadge: Record<AskLogEntry['outcome'], string> = { answered: '', gap: 'warn', off: 'info', limited: 'warn', failed: 'error' }
const askerColumns: Column<Asker>[] = [
  { key: 'ts', label: 'When', value: (row) => row.firstTs, render: (row) => formatTime(row.firstTs) },
  { key: 'count', label: 'Questions', value: (row) => row.entries.length, num: true },
  { key: 'asked', label: 'What they asked', value: (row) => row.entries.map((entry) => entry.question).join(' · '), strong: true, render: (row) => row.entries.length === 1 ? row.entries[0].question : <ol>{row.entries.map((entry) => <li key={entry.id}>{entry.question}</li>)}</ol> },
  { key: 'page', label: 'Page', value: (row) => row.pages },
  { key: 'network', label: 'Network', value: (row) => row.network },
]

// One person's conversation, and their visit that day when the traffic data has it.
function Conversation({ person, visit }: { person: Asker; visit?: VisitorRow }) {
  return (
    <>
      {visit && <p><b>Visit:</b> {visit.journey}{visit.referrer ? ` (from ${visit.referrer})` : ''}{visit.downloaded ? ' · downloaded the résumé' : ''}</p>}
      {person.entries.map((entry) => (
        <div key={entry.id}>
          <p><b>{formatTime(entry.ts)}{entry.page ? ` on ${entry.page}` : ''}:</b> {entry.question} <span className={`badge ${outcomeBadge[entry.outcome]}`}>{entry.kind === 'fit' ? 'fit check' : outcomeLabel[entry.outcome]}</span></p>
          {entry.answer && <p className="muted">{entry.answer}</p>}
        </div>
      ))}
    </>
  )
}

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
// questions and cost per day, votes, and the questions that wait for Steven (what the
// dossier could not answer, the job requirements his record does not show, the answers
// voted down), which he closes in an MCP session.
export function AssistantPage({ info, days, visitors }: { info: AskInfo; days: number; visitors?: VisitorRow[] }) {
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
  const resolved = info.resolved ?? { answered: 0, dismissed: 0 }
  const requirements = info.questions.filter((row) => row.reason === 'fit').length
  const { people, daily: peopleDaily } = askPeople(info.log ?? [])
  const logged = people.reduce((sum, person) => sum + person.entries.length, 0)
  const followedUp = people.filter((person) => person.entries.length > 1).length
  const fitChecks = people.filter((person) => person.fit > 0).length
  const visits = new Map((visitors ?? []).map((row) => [row.visitor, row]))
  // The log keeps 90 days, so a longer range shows those 90.
  const logDays = info.logDays ?? Math.min(days, 90)
  const period = logDays === 1 ? 'the last day' : `the last ${logDays} days`
  const peopleSeries = fillDays(peopleDaily, logDays, new Date(), (day): PeopleDay => ({ day, people: 0, questions: 0 }))
  return (
    <>
      <section className="card" data-part="People">
        <div className="card-head"><h2>People who asked</h2></div>
        <p className="note">Everyone who asked the assistant something in {period}{logDays < days && ' (the log keeps 90)'}, and what they asked. A person counts once a day, like a visitor on Traffic, so someone who comes back the next day counts again. Email addresses, phone numbers and keys are redacted, a job description pasted for a fit check is kept as its first words, and nothing is kept for browsers that send Global Privacy Control or Do Not Track. Open a row for the answers and, when the traffic data has it, the visit.{!info.log && <strong> The log could not be read, so this card is empty.</strong>}{info.logCapped && <strong> Only the latest {formatNumber(logged)} questions are shown.</strong>}</p>
        <div className="stats">
          <div className={people.length ? 'highlight' : ''}><span>People</span><strong>{formatNumber(people.length)}</strong><small>asked at least one question</small></div>
          <div><span>Questions</span><strong>{formatNumber(logged)}</strong><small>{people.length ? (logged / people.length).toFixed(1) : '0'} per person</small></div>
          <div><span>Asked a follow-up</span><strong>{formatNumber(followedUp)}</strong><small>{people.length ? Math.round((followedUp / people.length) * 100) : 0}% of the people</small></div>
          <div><span>Checked a job</span><strong>{formatNumber(fitChecks)}</strong><small>pasted a job description</small></div>
        </div>
        <div className="trends">
          <TrendChart title={`People per day (${logDays === 1 ? 'today' : `${logDays} days`})`} unit="people" points={peopleSeries.map((row) => ({ key: row.day, label: dayLabel(row.day), value: row.people, detail: `${formatNumber(row.people)} people · ${formatNumber(row.questions)} questions` }))} />
        </div>
        <DataTable columns={askerColumns} rows={people} rowKey={(row) => row.visitor} empty={info.log ? `Nobody asked the assistant anything in ${period}.` : 'No log to show.'} rowName={(row) => `${formatTime(row.firstTs)}: ${row.entries[0].question.slice(0, 60)}`} label="People who asked" expand={(row) => <Conversation person={row} visit={visits.get(row.visitor)} />} />
      </section>

      <section className="card" data-part="Use and cost">
        <div className="card-head"><h2>Use and cost</h2></div>
        <p className="note">Claude ({info.model}) answers from the résumé data and the public dossier entries, and compares pasted job descriptions with them.{!info.configured && !info.mock && <strong> Not live yet: set the ANTHROPIC_API_KEY secret and redeploy.</strong>}{info.mock && <strong> Mock mode (ASK_MOCK=1): canned answers, no API calls.</strong>}</p>
        <div className="stats" aria-label="This month">
          <div className={info.month.costMicro > info.budgetUsd * 800_000 ? 'highlight' : ''}><span>Spent this month</span><strong>{formatUsd(info.month.costMicro)}</strong><small>of a {formatUsd(info.budgetUsd * 1_000_000)} budget</small></div>
          <div><span>Questions this month</span><strong>{formatNumber(info.month.questions)}</strong><small>{formatNumber(info.month.answered)} answered · {formatNumber(info.month.gap)} gaps · {formatNumber(info.month.off)} off topic</small></div>
          <div><span>Turned away</span><strong>{formatNumber(info.month.limited)}</strong><small>limits, budget or human check</small></div>
          <div className={info.check?.state === 'on' ? 'highlight' : ''}><span>Human check</span><strong>{info.check ? { off: 'Off', standby: 'Standby', on: 'On' }[info.check.state] : info.humanCheck ? 'Ready' : 'Off'}</strong><small>{info.check?.state === 'on' ? { spend: `today's spend passed ${formatUsd(info.check.afterMicro)}`, connection: 'one connection asked too often', everyone: `${formatNumber(info.check.lastHour)} questions in the last hour` }[info.check.why ?? 'everyone'] : info.check?.state === 'standby' ? `nobody is asked; switches on at ${formatUsd(info.check.afterMicro)} a day or under load` : 'no Turnstile keys'}</small></div>
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

      <section className="card" data-part="Waiting for you">
        <div className="card-head"><h2>Questions waiting for you</h2></div>
        <p className="note">What the dossier could not answer, the requirements from pasted job descriptions that your record does not show, and answers readers voted down, from the last 90 days. Your career MCP tells you about them when a session starts; answer one there (answer_site_question) and it becomes a public note the assistant uses from the next question on, or set it aside (dismiss_site_question).</p>
        <div className="stats">
          <div className={info.questions.length ? 'highlight' : ''}><span>Waiting</span><strong>{formatNumber(info.questions.length)}</strong><small>{formatNumber(requirements)} {requirements === 1 ? 'is a job requirement' : 'are job requirements'}</small></div>
          <div><span>Answered by you</span><strong>{formatNumber(resolved.answered)}</strong><small>last 90 days, now public notes</small></div>
          <div><span>Set aside</span><strong>{formatNumber(resolved.dismissed)}</strong><small>duplicates, off topic, declined</small></div>
        </div>
        <DataTable columns={questionColumns} rows={info.questions} rowKey={(row) => String(row.id)} empty="Nothing waits: every question from the last 90 days has been answered or set aside." label="Questions waiting" />
      </section>
    </>
  )
}
