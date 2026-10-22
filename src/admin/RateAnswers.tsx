import { useEffect, useRef, useState } from 'react'
import { renderMarkdown, safeHref } from '../ask/markdown'
import { outcomeBadge, outcomeLabel, type LoadEntry } from './askEntries'
import { earlierTurns, isGood, isWrong, queueCounts, queueOf, versionLabel, type Filter } from './askQuality'
import { formatTime } from './format'
import { RatingForm, type RatingKeys, type SaveResult } from './RatingForm'
import type { AskInfo, AskLogEntry, AskRating, AskSource, RatingDraft } from './types'

// The Rate answers card (specs/ask-ratings.md, AC-25): one answer at a time with its context
// (the earlier questions of the conversation, the whole answer, the sources it cited) and the
// rubric beside it, newest first, Not rated by default. Also the pieces People who asked shows
// under each answer. Stored text is a stranger's: it renders as text, or through renderMarkdown,
// whose links pass safeHref.

export type RateAnswer = (draft: RatingDraft) => Promise<SaveResult>

export function VersionBadge({ entry }: { entry: AskLogEntry }) {
  return <span className="badge info version" title={entry.model ?? 'Logged before the versions were recorded'}>{versionLabel(entry)}</span>
}

export function RatingBadge({ rating }: { rating: AskRating }) {
  if (isWrong(rating)) return <span className="badge error">wrong</span>
  if (isGood(rating)) return <span className="badge">good · {rating.overall}</span>
  return <span className={`badge ${rating.overall === 3 ? 'warn' : 'error'}`}>{rating.overall}</span>
}

export function SourceList({ sources }: { sources?: AskSource[] }) {
  if (!sources?.length) return <p className="muted answer-sources">No source cited</p>
  return (
    <ul className="answer-sources">
      {sources.map((source) => {
        const href = source.href ? safeHref(source.href) : null
        return (
          <li key={source.id}>
            {!source.title ? <span className="muted">{source.id} · no longer in the data</span>
              : href ? <a href={href} target="_blank" rel="noreferrer">{source.title} ↗<span className="visually-hidden"> (opens in a new tab)</span></a>
                : source.title}
          </li>
        )
      })}
    </ul>
  )
}

/** The answer as the reader saw it, whole: the 1,500-character cut until the rest has loaded, and when it cannot. */
export function AnswerText({ entry, load }: { entry: AskLogEntry; load: LoadEntry }) {
  const [whole, setWhole] = useState<{ id: number; text: string | null } | null>(null)
  useEffect(() => {
    if (!entry.cut) return
    let gone = false
    void load(entry.id).then((found) => { if (!gone) setWhole({ id: entry.id, text: found?.answer ?? null }) })
    return () => { gone = true }
  }, [entry.id, entry.cut, load])
  const loaded = whole?.id === entry.id ? whole : null
  const text = loaded?.text ?? entry.answer
  return (
    <div className="answer-text">
      {text ? renderMarkdown(text) : <p className="muted">No answer was kept.</p>}
      {entry.cut && !loaded && <small className="muted">Loading the whole answer…</small>}
      {entry.cut && loaded && loaded.text === null && <small className="muted">Could not load the whole answer; this is its first 1,500 characters.</small>}
    </div>
  )
}

const FILTERS: [Filter, string][] = [['unrated', 'Not rated'], ['rated', 'Rated'], ['wrong', 'Marked wrong'], ['all', 'All']]
const saidOf = (rating: AskRating) => (isWrong(rating) ? 'wrong answer' : isGood(rating) ? `good (${rating.overall})` : `rated ${rating.overall}`)
const short = (text: string) => (text.length > 40 ? `${text.slice(0, 40).trimEnd()}…` : text)

export function RateAnswers({ info, filter, onFilter, focusRequest, onRate, load }: { info: AskInfo; filter: Filter; onFilter: (filter: Filter) => void; focusRequest: number; onRate: RateAnswer; load: LoadEntry }) {
  const log = info.log ?? []
  const list = queueOf(log, filter)
  const counts = queueCounts(log)
  // The answer shown, for the focus request it was chosen under: a new request (Show them, Needs you) starts at the top.
  const [chosen, setChosen] = useState<{ id: number | null; request: number }>({ id: null, request: focusRequest })
  const cursor = chosen.request === focusRequest ? chosen.id : null
  const setCursor = (id: number | null) => setChosen({ id, request: focusRequest })
  const [status, setStatus] = useState('')
  const [focusTick, setFocusTick] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const emptyLine = useRef<HTMLParagraphElement>(null)
  const keys = useRef<RatingKeys>(null)
  const index = Math.max(0, list.findIndex((entry) => entry.id === cursor))
  const entry = list[index] as AskLogEntry | undefined
  const next = list[index + 1]
  const logDays = info.logDays ?? 30
  const period = logDays === 1 ? 'the last day' : `the last ${logDays} days`

  // Focus follows the work: the next answer's question after a save, Skip or Previous, and the
  // queue's first question when Answer quality or Needs you asked for it.
  useEffect(() => { if (focusTick || focusRequest) (heading.current ?? emptyLine.current)?.focus() }, [focusTick, focusRequest])
  // The next answer's whole text, fetched ahead.
  useEffect(() => { if (next?.cut) void load(next.id) }, [next?.id, next?.cut, load])

  const move = (id: number | null) => { setCursor(id); setFocusTick((tick) => tick + 1) }
  const choose = (value: Filter) => { setCursor(null); setStatus(''); onFilter(value) }
  const save = async (draft: RatingDraft): Promise<SaveResult> => {
    const result = await onRate(draft)
    if (result.ok && entry) {
      const left = counts.unrated - (entry.rating ? 0 : 1)
      setStatus(`Saved: ${saidOf(result.rating)} for “${short(entry.question)}”. ${left === 0 ? 'Nothing left to rate.' : `${left} to go.`}`)
      move(next ? next.id : entry.id)
    }
    return result
  }

  if (!info.log) return <section className="card" data-part="Rate answers"><div className="card-head"><h2>Rate answers</h2></div><p className="note">Rate each answer as a recruiter read it. <strong>The log could not be read, so this card is empty.</strong></p></section>
  const unrated = (info.unratedWeek?.length ?? 0) > 0
  return (
    <section className="card rate-card" data-part="Rate answers" data-new={unrated ? '' : undefined} onKeyDown={(event) => keys.current?.onKey(event)}>
      <div className="card-head">
        <h2>Rate answers</h2>
        <div className="ranges rate-filters" role="group" aria-label="Show">
          {FILTERS.filter(([value]) => value !== 'wrong' || counts.wrong > 0).map(([value, label]) => (
            <button type="button" key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => choose(value)}>{label} {counts[value]}</button>
          ))}
        </div>
      </div>
      <p className="note">Rate each answer as a recruiter read it. In this card: Y, P or N answers the next criterion, 1 to 5 sets the overall score, Enter saves and opens the next. Skip leaves an answer for later.</p>
      {!entry ? (
        <div className="rate-empty">
          <p className="empty" tabIndex={-1} ref={emptyLine}>{counts.all === 0 ? `No answers to rate in ${period}.` : filter === 'unrated' ? `Every answer from ${period} is rated.` : `No answers here from ${period}.`}</p>
          {status && <p className="muted" role="status">{status}</p>}
          {counts.rated > 0 && filter !== 'rated' && <button type="button" className="ghost" onClick={() => { choose('rated'); setFocusTick((tick) => tick + 1) }}>Show rated answers</button>}
        </div>
      ) : (
        <div className="rate-grid">
          <article className="rate-answer" key={`answer-${entry.id}`}>
            <p className="muted rate-meta">{index + 1} of {list.length} · {formatTime(entry.ts)}{entry.page ? ` on /${entry.page}` : ''}{entry.country || entry.asOrg ? ` · ${[entry.country, entry.asOrg].filter(Boolean).join(', ')}` : ''}</p>
            <p className="rate-badges"><span className={`badge ${outcomeBadge[entry.outcome]}`}>{entry.kind === 'fit' ? 'fit check' : outcomeLabel[entry.outcome]}</span> <VersionBadge entry={entry} />{entry.rating && <> <RatingBadge rating={entry.rating} /></>}</p>
            <Earlier log={log} entry={entry} />
            <h3 tabIndex={-1} ref={heading}>{entry.kind === 'fit' ? `Fit check: ${entry.question}` : entry.question}</h3>
            {entry.kind === 'fit' && <small className="muted">only the first words of a pasted job description are kept</small>}
            <AnswerText entry={entry} load={load} />
            <h4>Sources</h4>
            <SourceList sources={entry.sources} />
            {entry.knowledgeVersion && <small className="muted">knowledge {entry.knowledgeVersion}</small>}
          </article>
          <RatingForm
            key={`form-${entry.id}`}
            entry={entry}
            keys={keys}
            status={status}
            onSave={save}
            saveLabel={entry.rating ? 'Save change and next' : next ? 'Save and next' : 'Save'}
            actions={<>
              <button type="button" className="ghost" onClick={() => { setStatus(''); move(next ? next.id : entry.id) }}>Skip</button>
              {index > 0 && <button type="button" className="ghost" onClick={() => { setStatus(''); move(list[index - 1].id) }}>Previous</button>}
            </>}
          />
        </div>
      )}
    </section>
  )
}

// The same visitor's earlier questions and answers that day, shut until opened.
function Earlier({ log, entry }: { log: AskLogEntry[]; entry: AskLogEntry }) {
  const turns = earlierTurns(log, entry)
  if (!turns.length) return null
  return (
    <details className="notes rate-earlier">
      <summary>Earlier in this conversation ({turns.length})</summary>
      <ol>
        {turns.map((turn) => <li key={turn.id}><strong>{turn.question}</strong>{turn.answer && <div className="muted">{renderMarkdown(turn.answer)}</div>}</li>)}
      </ol>
    </details>
  )
}
