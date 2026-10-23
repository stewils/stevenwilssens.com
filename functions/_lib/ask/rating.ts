// Steven's rubric for the assistant's answers (specs/ask-ratings.md, "How better is
// measured"), shared by the rating route that checks a rating and the admin that shows
// and counts them. Pure, with no imports, so the admin bundle can take it whole.

export type Criterion = 'yes' | 'partly' | 'no' | 'na'
export type Scores = { accurate: Criterion; supported: Criterion; answers: Criterion; tone: Criterion; overall: number }

// Only answers the model gave can be rated: not a turned-away or failed question.
export const isRateable = (entry: { outcome: string; kind: string }) => (entry.outcome === 'answered' || entry.outcome === 'gap' || entry.outcome === 'off') && (entry.kind === 'question' || entry.kind === 'fit')

export type CriterionKey = 'accurate' | 'supported' | 'answers' | 'tone'
// Four criteria, each Yes / Partly / No; n/a only where `na` says, and only on an off-topic answer.
export const CRITERIA: { key: CriterionKey; label: string; question: string; na: boolean }[] = [
  { key: 'accurate', label: 'Accurate', question: 'Is every claim about Steven true and on the site or in the public dossier, with nothing invented or stretched (location, work authorization, availability, team size, dates)?', na: false },
  { key: 'supported', label: 'Supported', question: 'Are the cited sources the right ones, and does each claim rest on one? Does it say plainly when the record does not cover something?', na: true },
  { key: 'answers', label: 'Answers the question', question: 'Does it answer what was asked, early, instead of talking around it? For a fit check: are the covered, partly and not shown calls right? An off-topic reply: should it have declined?', na: false },
  { key: 'tone', label: 'Tone and length', question: 'Third person, candid, warm, not salesy; short enough to read on a phone; points to Steven for what only he can say?', na: true },
]
export const OVERALL: Record<number, string> = { 5: 'I am glad a recruiter read this', 4: 'Good, small things to polish', 3: 'Acceptable, not as the norm', 2: 'Misleading or unhelpful', 1: 'Wrong or harmful to me' }
export const NOTE_MAX = 1000

// Good is an overall 4 or 5 on an accurate answer; Accurate = No is a wrong answer whatever
// the score; poor (overall 1 or 2, or wrong) is what may go to Steven's questions.
export const isWrong = (scores: Pick<Scores, 'accurate'>) => scores.accurate === 'no'
export const isGood = (scores: Pick<Scores, 'accurate' | 'overall'>) => scores.overall >= 4 && !isWrong(scores)
export const isPoor = (scores: Pick<Scores, 'accurate' | 'overall'>) => scores.overall <= 2 || isWrong(scores)

/** The configured model, or its dated id (`claude-opus-5-5-20261001`); never a longer name that starts with it. */
export const isModel = (id: string, model: string) => id === model || (id.startsWith(`${model}-`) && /^\d{8}$/.test(id.slice(model.length + 1)))

export type RatingBody = Scores & { id: number; note: string | null; addToQuestions: boolean }
const KEYS = ['id', 'accurate', 'supported', 'answers', 'tone', 'overall', 'note', 'addToQuestions']
const ANSWERS: Criterion[] = ['yes', 'partly', 'no', 'na']

// A rating as POST /api/ask/rating takes it, checked strictly: exact sets, an integer 1 to 5, a
// note of at most 1,000 characters once control characters are gone and it is trimmed, no other
// key. A failure names the field, never what was sent. Whether n/a fits the answer is the route's
// call, from the logged row.
export const parseRating = (text: string): { ok: true; value: RatingBody } | { ok: false; field: string } => {
  let body: unknown
  try { body = JSON.parse(text) } catch { return { ok: false, field: 'body' } }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, field: 'body' }
  const raw = body as Record<string, unknown>
  if (Object.keys(raw).some((key) => !KEYS.includes(key))) return { ok: false, field: 'keys' }
  if (typeof raw.id !== 'number' || !Number.isSafeInteger(raw.id) || raw.id < 1) return { ok: false, field: 'id' }
  const scores: Partial<Scores> = {}
  for (const { key, na } of CRITERIA) {
    const value = raw[key]
    if (typeof value !== 'string' || !ANSWERS.includes(value as Criterion) || (value === 'na' && !na)) return { ok: false, field: key }
    scores[key] = value as Criterion
  }
  if (typeof raw.overall !== 'number' || !Number.isInteger(raw.overall) || raw.overall < 1 || raw.overall > 5) return { ok: false, field: 'overall' }
  let note: string | null = null
  if (raw.note !== undefined && raw.note !== null) {
    if (typeof raw.note !== 'string') return { ok: false, field: 'note' }
    // eslint-disable-next-line no-control-regex
    const clean = raw.note.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim()
    if (clean.length > NOTE_MAX) return { ok: false, field: 'note' }
    note = clean || null
  }
  if (raw.addToQuestions !== undefined && typeof raw.addToQuestions !== 'boolean') return { ok: false, field: 'addToQuestions' }
  return { ok: true, value: { id: raw.id, ...(scores as Omit<Scores, 'overall'>), overall: raw.overall, note, addToQuestions: raw.addToQuestions === true } }
}
