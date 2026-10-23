// The assistant's public report card: the numbers a reader of the Building
// steven.wilssens.com write-up sees, straight from the database. Aggregates only
// (no questions, no visitors), over the assistant's whole life, so the page says
// how often it could answer with sources, how often it could not, how many of
// those gaps Steven has since covered, and what it cost. Reader votes and Steven's
// own ratings of the answers stay in the admin.
import type { DossierStore } from '../mcp/store'
import type { AskStore } from './store'

export type AssistantReport = {
  since: string | null              // the first day with a question (YYYY-MM-DD, UTC)
  questions: number                 // in-scope and off-topic questions answered
  answered: number                  // answered with at least one source
  gaps: number                      // in scope, but the dossier did not cover it
  gapsCovered: number               // gaps Steven has since answered with a public note
  gapsOpen: number                  // gaps and job requirements still waiting for him
  offTopic: number
  turnedAway: number                // limits, budget or the human check
  costMicro: number                 // total spend, micro-dollars
  costPerAnswerMicro: number | null // over answered and gap questions
  msFirstAvg: number | null         // average time to the first word, answered and gap questions
  publicNotes: number               // dossier entries the assistant may use
  generatedAt: number
}

export const assistantReport = async (store: AskStore, dossier: DossierStore, now: number): Promise<AssistantReport> => {
  const [totals, resolved, open, notes] = await Promise.all([store.totals(), store.resolvedCounts(0), store.questions(0, 1000), dossier.list({ visibility: 'public' })])
  const inScope = totals.answered + totals.gap
  return {
    since: totals.since,
    questions: totals.questions,
    answered: totals.answered,
    gaps: totals.gap,
    gapsCovered: resolved.answered,
    // A vote or Steven's own poor rating sends a question to him too, but it is not a gap the record has.
    gapsOpen: open.filter((question) => question.reason !== 'unhelpful' && question.reason !== 'rated').length,
    offTopic: totals.off,
    turnedAway: totals.limited,
    costMicro: totals.costMicro,
    costPerAnswerMicro: inScope ? Math.round(totals.costMicro / inScope) : null,
    msFirstAvg: inScope ? Math.round(totals.msFirst / inScope) : null,
    publicNotes: notes.length,
    generatedAt: now,
  }
}
