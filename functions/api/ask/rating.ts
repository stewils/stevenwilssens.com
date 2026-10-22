// POST /api/ask/rating: Steven's rating of one of the assistant's logged answers (admin
// token), { id, accurate, supported, answers, tone, overall, note?, addToQuestions? }; answers
// { rating }. One rating per answer: saving again replaces it. What the answer was (its model,
// versions, kind, outcome and day) is copied from the log row on the server, never taken from
// the body. A poor rating with addToQuestions sends the logged question to Steven's questions
// (reason "rated"), built from the stored row and carrying the answer's time, so it expires
// with the answer; the note never goes with it. The token only from the Authorization header,
// no CORS header, no cookie; a refusal names the field and echoes nothing.
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/auth'
import { KEEP_MS } from '../../_lib/ask/agent'
import { isPoor, parseRating } from '../../_lib/ask/rating'
import { D1AskStore, isRateable } from '../../_lib/ask/store'
import { isJson, json, readCapped } from '../../_lib/http'

const MAX_BODY = 16 * 1024

const invalid = (field: string) => json({ error: 'invalid', field }, 400)
const tooLarge = () => json({ error: 'too large' }, 413)

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401)
  if (!isJson(request)) return json({ error: 'unsupported media type' }, 415)
  const text = await readCapped(request, MAX_BODY)
  if (text === null) return tooLarge()
  const parsed = parseRating(text)
  if (!parsed.ok) return invalid(parsed.field)
  const body = parsed.value
  try {
    const store = new D1AskStore(env.DB)
    // Read first only to name the field; the write checks every condition again itself.
    const entry = await store.entry(body.id)
    if (!entry || !isRateable(entry)) return invalid('id')
    if (entry.outcome !== 'off' && body.supported === 'na') return invalid('supported')
    if (entry.outcome !== 'off' && body.tone === 'na') return invalid('tone')
    let rating = await store.saveRating({ logId: body.id, accurate: body.accurate, supported: body.supported, answers: body.answers, tone: body.tone, overall: body.overall, note: body.note, ratedAt: Date.now() })
    // Pruned between the read and the write.
    if (!rating) return invalid('id')
    if (body.addToQuestions && isPoor(rating) && rating.questionId === null) {
      const questionId = await store.addRatingQuestion(rating.id, { ts: entry.ts, reason: 'rated', page: entry.page, question: entry.question, answer: entry.answer, country: null, asOrg: null }, KEEP_MS)
      rating = { ...rating, questionId }
    }
    return json({ rating })
  } catch (error) {
    console.error('ask rating', error instanceof Error ? error.message : 'unknown error')
    return json({ error: 'unavailable' }, 503)
  }
}
