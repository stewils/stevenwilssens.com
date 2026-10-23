import { RankedList, ShareChart, TrendChart, type ShareSeries } from './Charts'
import { CRITERIA, isRateable, lineStyle, queueCounts, MIN_RATED, modelLabel, pct, rangeText, summarize, THIN, verdict, verdictBadge, verdictText, versions, weekLabel, weekList, weeklyContext, weeklyShares, type Version } from './askQuality'
import { DataTable, type Column } from './DataTable'
import { formatNumber, formatTime } from './format'
import type { AskInfo } from './types'

// The Answer quality card (specs/ask-ratings.md, AC-15 to AC-18): Steven's ratings read out.
// The verdict for the version answering now against the one before it, the numbers for the
// range, the share Yes per criterion, the good share per week per version, and beside it
// (never mixed in) the answered share and the reader votes, then one row per version. Every
// number comes from askQuality.ts; this file only lays them out.

const DAY = 86_400_000
const utcDay = (ts: number) => new Date(ts).toISOString().slice(0, 10)

const NOTE = 'Your ratings of the assistant’s answers. A version is the model that answered and the version of its instructions; new facts in the résumé or the dossier do not start a new version. Good means an overall 4 or 5; an answer marked not accurate counts as wrong whatever its score. Weeks with fewer than 5 ratings are drawn hollow and thin; the shaded band is the range the true share is likely in.'

export function AnswerQuality({ info, days, onShowWrong, onRateFirst }: { info: AskInfo; days: number; onShowWrong: () => void; onRateFirst: () => void }) {
  const head = <div className="card-head"><h2>Answer quality</h2></div>
  if (!info.log) return <section className="card" data-part="Answer quality">{head}<p className="note">{NOTE} <strong>The log could not be read, so this card is empty.</strong></p></section>
  const log = info.log
  const ratings = info.ratings ?? []
  const now = Date.now()
  const today = utcDay(now)
  const period = days === 1 ? 'the last day' : `the last ${days} days`
  const rateable = log.filter(isRateable).length
  // The queue's counts: only answers still in the log, which is kept 90 days whatever the range.
  const queue = queueCounts(log)
  const logDays = info.logDays ?? days
  const summary = summarize(ratings)
  const rows = versions(log, ratings)
  const result = verdict(rows, info.model)
  const weeks = weekList(utcDay(now - days * DAY), today)
  const labels = weeks.map(weekLabel)
  const series: ShareSeries[] = rows.filter((row) => row.ratings.length).map((row) => ({ key: row.key, label: row.label, style: lineStyle(row, result), points: weeklyShares(row.ratings, weeks) }))
  const context = weeklyContext(info.daily, info.votes, weeks)
  const counts = weeks.map((_, index) => series.reduce((sum, item) => sum + (item.points[index]?.n ?? 0), 0))
  const few = summary.rated > 0 && summary.rated < THIN
  const nowRated = result.kind === 'none' ? null : result.now.summary
  const badge = verdictBadge[result.kind]
  const answeredWeeks = context.filter((week) => week.answeredShare !== null)
  const votedWeeks = context.filter((week) => week.votes > 0)
  const votes = votedWeeks.reduce((sum, week) => ({ helpful: sum.helpful + week.helpful, total: sum.total + week.votes }), { helpful: 0, total: 0 })
  return (
    <section className="card" data-part="Answer quality">
      {head}
      <p className="note">{NOTE}{info.logCapped && <strong> Only the latest {formatNumber(log.length)} answers are counted.</strong>}</p>
      {summary.rated > 0 && (
        <p className="quality-verdict"><span className={`badge ${badge.tone}`}>{badge.word}</span><span className="visually-hidden">:</span> {verdictText(result)}</p>
      )}
      {summary.rated === 0 && rateable > 0 ? (
        <p className="quality-first">Nothing rated yet. Rate your first answer in <button type="button" className="link-button" onClick={onRateFirst}>Rate answers</button>: four questions and a score, about a minute.</p>
      ) : (
        <>
          <div className={`stats${few ? ' quality-few' : ''}`} aria-label={`Your ratings, ${period}`}>
            <div className={summary.rated >= MIN_RATED ? 'highlight' : ''}><span>Rated good</span><strong>{summary.goodShare === null ? '—' : pct(summary.goodShare)}</strong><small>{summary.range ? (few ? `only ${summary.rated} rated` : `${summary.good} of ${summary.rated} · range ${rangeText(summary.range)}%`) : 'no ratings'}</small></div>
            <div className={summary.wrong > 0 ? 'bad' : ''}><span>Wrong answers</span><strong>{summary.rated ? formatNumber(summary.wrong) : '—'}</strong><small>{summary.wrongShare === null ? 'no ratings' : few ? `only ${summary.rated} rated` : `${pct(summary.wrongShare)} of rated`}{queue.wrong > 0 && <> · <button type="button" className="link-button" onClick={onShowWrong}>Show them</button></>}</small></div>
            <div><span>Mean score</span><strong>{summary.mean === null ? '—' : <>{summary.mean.toFixed(1)}<small> /5</small></>}</strong><small>{few ? `only ${summary.rated} rated` : '1 to 5'}</small></div>
            <div><span>Rated</span><strong>{rateable ? `${formatNumber(queue.rated)} of ${formatNumber(rateable)}` : '—'}</strong><small>{rateable ? `${pct(queue.rated / rateable)} · ${formatNumber(queue.unrated)} wait in Rate answers${days > logDays ? ` · answers of the last ${logDays} days` : ''}` : 'nothing to rate'}</small></div>
          </div>
          {summary.rated > 0 && (
            <RankedList title="By criterion (share Yes)" format={(value) => `${value}%`} max={100} rows={CRITERIA.map(({ key, label }) => {
              const count = summary.criteria[key]
              return { name: label, visitors: count.yesShare === null ? 0 : Math.round(count.yesShare * 100), detail: [count.partly ? `${pct(count.partlyShare!)} partly` : null, count.na ? `${count.na} n/a` : null].filter(Boolean).join(' · ') || undefined }
            })} />
          )}
          <ShareChart
            title={`Rated good by week (${days === 1 ? 'today' : `${days} days`})`}
            weeks={weeks}
            labels={labels}
            series={series}
            counts={counts}
            readout={nowRated?.goodShare != null ? `Now ${pct(nowRated.goodShare)} good (${nowRated.good} of ${nowRated.rated})` : ''}
            label={`Rated good by week, ${days} days. ${rows.filter((row) => row.summary.rated).map((row) => `${row.label}: ${pct(row.summary.goodShare!)} of ${row.summary.rated} rated.`).join(' ')}`}
            empty={rateable ? 'Your scores appear here after your first rating.' : `No answers in ${period}.`}
          />
        </>
      )}
      <div className="trends">
        <TrendChart title="Answered with a source, by week" unit="answered share" per="week" empty={`No questions in ${period}.`} max={100} format={(value) => `${value}%`} readout={answeredWeeks.length ? `now ${pct(answeredWeeks[answeredWeeks.length - 1].answeredShare!)}` : ''} points={context.map((week) => ({ key: week.week, label: weekLabel(week.week), value: week.answeredShare === null ? null : Math.round(week.answeredShare * 100), detail: week.answeredShare === null ? 'No questions in scope' : `${week.answered} of ${week.inScope} answered with a source` }))} />
        {votedWeeks.length ? (
          <TrendChart title="Reader votes, by week" unit="helpful share" per="week" max={100} format={(value) => `${value}%`} readout={`${votes.helpful} helpful of ${votes.total}`} points={context.map((week) => ({ key: week.week, label: weekLabel(week.week), value: week.votes ? Math.round((week.helpful / week.votes) * 100) : null, detail: week.votes ? `${week.helpful} helpful of ${week.votes}` : 'No reader votes' }))} />
        ) : (
          <figure className="trend"><figcaption><span>Reader votes, by week</span></figcaption><p className="empty">No reader votes in this range</p></figure>
        )}
      </div>
      <h3>Versions</h3>
      <DataTable columns={versionColumns(today)} rows={rows} rowKey={(row) => row.key} label="Versions" empty={`No answers in ${period}.`} rowName={(row) => row.label} expand={(row) => <VersionNotes version={row} />} />
    </section>
  )
}

const versionColumns = (today: string): Column<Version>[] => [
  { key: 'version', label: 'Version', value: (row) => row.label, render: (row) => (
    <>
      <span className="version-label" title={row.model ?? undefined}>{row.before ? 'Before versions' : `${modelLabel(row.model!)} · ${row.promptVersion}`}</span>
      {row.fallback && <small className="muted version-line">fallback, not in the verdict</small>}
      {row.mock && <small className="muted version-line">mock, not in the verdict</small>}
      {row.knowledge > 1 && <small className="muted version-line">knowledge changed {row.knowledge - 1} {row.knowledge === 2 ? 'time' : 'times'}</small>}
    </>
  ) },
  { key: 'use', label: 'In use', value: (row) => row.firstDay, render: (row) => `${weekLabel(row.firstDay)} – ${row.lastDay === today ? 'today' : weekLabel(row.lastDay)}` },
  { key: 'answers', label: 'Answers', value: (row) => row.answers, num: true },
  { key: 'rated', label: 'Rated', value: (row) => row.summary.rated, num: true, render: (row) => (row.summary.rated ? formatNumber(row.summary.rated) : '—') },
  { key: 'good', label: 'Good', value: (row) => row.summary.goodShare ?? -1, num: true, render: (row) => (!row.summary.rated ? '—' : row.summary.rated < THIN ? <span className="muted">too few</span> : <>{pct(row.summary.goodShare!)}<small className="muted version-line">range {rangeText(row.summary.range!)}</small></>) },
  { key: 'mean', label: 'Mean', value: (row) => row.summary.mean ?? -1, num: true, render: (row) => (row.summary.mean === null ? '—' : row.summary.mean.toFixed(1)) },
  { key: 'wrong', label: 'Wrong', value: (row) => row.summary.wrong, num: true, render: (row) => (!row.summary.rated ? '—' : row.summary.wrong ? <span className="status-text poor">{row.summary.wrong}</span> : '0') },
  { key: 'answered', label: 'Answered', value: (row) => row.answeredShare ?? -1, num: true, render: (row) => (row.answeredShare === null ? '—' : pct(row.answeredShare)) },
]

function VersionNotes({ version }: { version: Version }) {
  if (!version.notes.length) return <p className="muted">No notes on this version’s answers.</p>
  return (
    <ul className="version-notes">
      {version.notes.map((note) => <li key={`${note.ratedAt}-${note.note}`}><small className="muted">{formatTime(note.ratedAt)}{note.question ? ` · “${note.question.slice(0, 80)}${note.question.length > 80 ? '…' : ''}”` : ''}</small><span>{note.note}</span></li>)}
    </ul>
  )
}
