import { useEffect, useId, useImperativeHandle, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref } from 'react'
import { CRITERIA, isPoor, NOTE_MAX, OVERALL } from './askQuality'
import type { AskLogEntry, AskRating, Criterion, RatingDraft } from './types'

// Steven's rubric for one answer (specs/ask-ratings.md): four criteria, each Yes / Partly / No
// (n/a, chosen for him, on Supported and Tone and length when the answer was off topic), an
// overall score 1 to 5, a note, and on a poor rating "Add to my questions". Native radio groups,
// so Tab reaches each group once and the arrows choose. Used inline in People who asked and in
// the Rate answers queue, whose card sends its shortcut keys here through `keys`.

export type SaveResult = { ok: true; rating: AskRating } | { ok: false; reason: string }
// What the queue's card calls with the keys pressed inside it.
export type RatingKeys = { onKey: (event: ReactKeyboardEvent) => void }
type Key = (typeof CRITERIA)[number]['key']
type Values = Record<Key, Criterion | null> & { overall: number | null; note: string; add: boolean }
const OPTIONS: [Criterion, string][] = [['yes', 'Yes'], ['partly', 'Partly'], ['no', 'No']]
const NA: [Criterion, string] = ['na', 'n/a']
// Poor so far: overall 1 or 2, or not accurate (isPoor, before every answer is in).
const poorNow = (values: Values) => values.accurate === 'no' || (values.overall !== null && isPoor({ accurate: 'yes', overall: values.overall }))
const names = (list: string[]) => (list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`)

const start = (entry: AskLogEntry): Values => {
  const rating = entry.rating
  const off = entry.outcome === 'off'
  return { accurate: rating?.accurate ?? null, supported: rating?.supported ?? (off ? 'na' : null), answers: rating?.answers ?? null, tone: rating?.tone ?? (off ? 'na' : null), overall: rating?.overall ?? null, note: rating?.note ?? '', add: false }
}

export function RatingForm({ entry, onSave, saveLabel, onCancel, actions, status, keys }: { entry: AskLogEntry; onSave: (draft: RatingDraft) => Promise<SaveResult>; saveLabel: string; onCancel?: () => void; actions?: ReactNode; status?: string; keys?: Ref<RatingKeys> }) {
  const id = useId()
  const form = useRef<HTMLFormElement>(null)
  const saveButton = useRef<HTMLButtonElement>(null)
  const [values, setValues] = useState<Values>(() => start(entry))
  const [missing, setMissing] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [error, setError] = useState('')
  const off = entry.outcome === 'off'
  const poor = poorNow(values)

  const update = (patch: Partial<Values>) => {
    const next = { ...values, ...patch }
    // The box goes with a rating that stops being poor.
    if (!poorNow(next)) next.add = false
    setValues(next)
    if (missing.length) setMissing((list) => list.filter((key) => next[key as Key | 'overall'] === null))
  }
  const focusGroup = (key: string) => {
    const group = form.current?.querySelector<HTMLElement>(`fieldset[data-key="${key}"]`)
    ;(group?.querySelector<HTMLInputElement>('input:checked') ?? group?.querySelector<HTMLInputElement>('input'))?.focus()
  }
  // A shortcut moves focus once its choice is drawn, so focus lands on the option it checked
  // (an arrow key then moves from there) and never on an unchecked one in a group with a choice.
  const focusNext = useRef<string | null>(null)
  useEffect(() => {
    if (focusNext.current === null) return
    focusGroup(focusNext.current)
    focusNext.current = null
  }, [values])

  const save = async () => {
    if (busy.current) return
    const now = values
    const open = [...CRITERIA.map((criterion) => criterion.key), 'overall'].filter((key) => now[key as Key | 'overall'] === null)
    if (open.length) {
      setMissing(open)
      focusGroup(open[0])
      return
    }
    busy.current = true
    setSaving(true)
    setError('')
    const result = await onSave({ id: entry.id, accurate: now.accurate!, supported: now.supported!, answers: now.answers!, tone: now.tone!, overall: now.overall!, note: now.note.trim() || null, addToQuestions: now.add })
    busy.current = false
    // The form may be gone: the queue moved on to the next answer.
    if (!form.current) return
    setSaving(false)
    if (!result.ok) {
      setError(`Could not save the rating (${result.reason}). Your choices are still here; press Save again.`)
      saveButton.current?.focus()
    }
  }

  // The queue's keys (active only while focus is in its card, never in the note): Y, P and N answer
  // the criterion that has focus or else the first one still open, then move on; A answers n/a
  // where it is offered; 1 to 5 set Overall; Enter saves (Ctrl or Cmd+Enter in the note).
  const onKey = (event: ReactKeyboardEvent) => {
    const target = event.target as HTMLElement
    const inNote = target.tagName === 'TEXTAREA'
    if (event.key === 'Enter') {
      if (inNote ? !(event.ctrlKey || event.metaKey) : Boolean(target.closest('button, a, summary'))) return
      event.preventDefault()
      void save()
      return
    }
    if (inNote || event.ctrlKey || event.metaKey || event.altKey) return
    const key = event.key.toLowerCase()
    if (/^[1-5]$/.test(key)) { event.preventDefault(); focusNext.current = 'overall'; update({ overall: Number(key) }); return }
    const answer = ({ y: 'yes', p: 'partly', n: 'no', a: 'na' } as Record<string, Criterion>)[key]
    if (!answer) return
    const focused = target.closest<HTMLElement>('fieldset[data-key]')?.dataset.key
    const criterion = CRITERIA.find((item) => item.key === focused) ?? CRITERIA.find((item) => values[item.key] === null)
    if (!criterion || (answer === 'na' && !(criterion.na && off))) return
    event.preventDefault()
    const open = (item: (typeof CRITERIA)[number]) => item !== criterion && values[item.key] === null
    const after = CRITERIA.slice(CRITERIA.indexOf(criterion) + 1).find(open) ?? CRITERIA.find(open)
    focusNext.current = after ? after.key : 'overall'
    update({ [criterion.key]: answer })
  }
  useImperativeHandle(keys, () => ({ onKey }))

  const submit = (event: FormEvent) => { event.preventDefault(); void save() }
  const missingNames = missing.map((key) => (key === 'overall' ? 'Overall' : CRITERIA.find((item) => item.key === key)!.label))
  const noteLength = values.note.length
  return (
    <form ref={form} className="rubric" onSubmit={submit} onKeyDown={(event) => { if (event.key === 'Escape' && onCancel) { event.preventDefault(); onCancel() } }} noValidate>
      {CRITERIA.map((criterion) => {
        const options = criterion.na && off ? [...OPTIONS, NA] : OPTIONS
        return (
          <fieldset key={criterion.key} data-key={criterion.key} className="rubric-group" aria-describedby={`${id}-${criterion.key}`} aria-invalid={missing.includes(criterion.key) || undefined} title={criterion.question}>
            <legend>{criterion.label}</legend>
            <span id={`${id}-${criterion.key}`} className="visually-hidden">{criterion.question}</span>
            <div className={`seg seg-${options.length}`}>
              {options.map(([value, text]) => (
                <label key={value} className={values[criterion.key] === value ? 'on' : undefined}>
                  <input type="radio" name={`${id}-${criterion.key}`} value={value} checked={values[criterion.key] === value} onChange={() => update({ [criterion.key]: value })} />{text}
                </label>
              ))}
            </div>
          </fieldset>
        )
      })}
      <fieldset data-key="overall" className="rubric-group" aria-describedby={`${id}-overall`} aria-invalid={missing.includes('overall') || undefined}>
        <legend>Overall</legend>
        <span id={`${id}-overall`} className="visually-hidden">From 1, wrong or harmful to you, to 5, you are glad a recruiter read this. Good is 4 or 5.</span>
        <div className="seg seg-5">
          {[1, 2, 3, 4, 5].map((score) => (
            <label key={score} className={values.overall === score ? 'on' : undefined}>
              <input type="radio" name={`${id}-overall`} value={score} checked={values.overall === score} onChange={() => update({ overall: score })} />{score}<span className="visually-hidden">, {OVERALL[score].toLowerCase()}</span>
            </label>
          ))}
        </div>
        {values.overall !== null && <small className="muted rubric-anchor">{values.overall}: {OVERALL[values.overall]}</small>}
        {values.accurate === 'no' && <small className="status-text poor rubric-anchor">Counts as a wrong answer whatever the overall score.</small>}
      </fieldset>
      <div className="rubric-note">
        <label htmlFor={`${id}-note`}>Note (optional)</label>
        <textarea id={`${id}-note`} value={values.note} maxLength={NOTE_MAX} rows={Math.min(8, Math.max(2, values.note.split('\n').length))} onChange={(event) => update({ note: event.target.value })} />
        <small className="muted" aria-live={noteLength >= 900 ? 'polite' : 'off'}>{noteLength.toLocaleString('en-US')} of 1,000</small>
      </div>
      {poor && <label className="rubric-add"><input type="checkbox" checked={values.add} onChange={(event) => update({ add: event.target.checked })} /> Add to my questions (it waits for your answer in Claude)</label>}
      <div className="rubric-actions">
        <button ref={saveButton} type="submit" className="primary" aria-disabled={saving || undefined}>{saveLabel}</button>
        {actions}
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
      </div>
      {missing.length > 0 && <p className="error" role="alert">Answer {names(missingNames)} to save.</p>}
      <p className={`rubric-status${error ? ' status-text poor' : ''}`} role="status">{error || (saving ? 'Saving…' : status ?? '')}</p>
    </form>
  )
}
