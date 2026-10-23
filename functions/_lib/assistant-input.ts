// What the site's assistant reads, built by this tree's own code for the Review workflow's
// assistant check (specs/mcp-prs-flow.md, AC-9): the system prompt from systemPrompt (the
// dossier text, the write-ups) with Steven's public notes, the model, the second system block
// for a question and for a pasted job description, and the profile facts the check holds the
// answers to. Built once from the pull request's code and once from main's (job A, which has
// no secret), then handed as data to main's harness (scripts/assistant-check.mjs, job B).
// Nothing here writes anywhere: the notes come from the live site's read-only /api/notes.
import { profile } from '../../src/resume'
import { answerSources, answerTokens, contextFor, liveRequest, MODEL, words } from './ask/agent'
import { jdPrefix, loadArticles, sources, systemPrompt } from './ask/prompt'
import type { DossierEntry } from './mcp/store'

export const SCHEMA = 'assistant-input/1'
export const NOTES_URL = 'https://steven.wilssens.com/api/notes'

export type AssistantInput = {
  schema: typeof SCHEMA
  model: string
  system: string
  contexts: { question: string; fit: string }
  jdPrefix: string
  profile: { location: string; workArrangement: string; workAuthorization: string; availability: string; teamSize: string }
  notes: number
  articles: number
  // How the live assistant asks (the answer budget per kind, thinking, effort, the fallback beta) and shows an
  // answer (the sources its hidden first line names, by title; the fixed text for an out-of-scope one).
  request: typeof liveRequest & { maxTokens: typeof answerTokens }
  render: { sources: Record<string, string>; maxSources: typeof answerSources; offTopic: string; notAPosting: string }
}

/** The check did not run: the input cannot be built as the live assistant has it. */
export class NotReady extends Error {}

const isNote = (value: unknown): value is Pick<DossierEntry, 'id' | 'role' | 'topic' | 'title' | 'body'> => {
  const note = value as Record<string, unknown> | null
  return Boolean(note) && Number.isInteger(note!.id) && ['role', 'topic', 'title', 'body'].every((key) => typeof note![key] === 'string')
}

/** Steven's public notes as the live assistant reads them, by one GET of the public endpoint. */
export const readNotes = async (url: string, fetchImpl: typeof fetch = fetch): Promise<DossierEntry[]> => {
  let response: Response
  try { response = await fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json' } }) } catch (error) {
    throw new NotReady(`The public notes could not be read from ${url}: ${String(error)}`)
  }
  if (!response.ok) throw new NotReady(`The public notes could not be read from ${url}: it answered ${response.status}.`)
  const body = await response.json().catch(() => null) as { notes?: unknown } | null
  if (!body || !Array.isArray(body.notes)) throw new NotReady(`The public notes from ${url} are not a list of notes.`)
  return body.notes.filter(isNote).map(({ id, role, topic, title, body: text }) => ({ id, role, topic, title, body: text, createdAt: 0, updatedAt: 0, visibility: 'public' as const, tags: null }))
}

/** The assistant's input from this tree's code: `readPage` reads the build's Markdown copies of the write-ups (dist/). */
export const assistantInput = async ({ readPage, notesUrl = NOTES_URL, fetchImpl = fetch }: { readPage: (path: string) => Promise<string | null>; notesUrl?: string; fetchImpl?: typeof fetch }): Promise<AssistantInput> => {
  const entries = await readNotes(notesUrl, fetchImpl)
  const articles = await loadArticles(readPage)
  return {
    schema: SCHEMA,
    model: MODEL,
    system: systemPrompt(entries, articles),
    contexts: { question: contextFor('home', false), fit: contextFor('home', true) },
    jdPrefix,
    profile: { location: profile.location, workArrangement: profile.workArrangement, workAuthorization: profile.workAuthorization, availability: profile.availability, teamSize: profile.teamSize },
    notes: entries.length,
    articles: Object.keys(articles).length,
    request: { ...liveRequest, maxTokens: answerTokens },
    render: { sources: Object.fromEntries([...sources()].map(([id, source]) => [id, source.title])), maxSources: answerSources, offTopic: words.offTopic, notAPosting: words.notAPosting },
  }
}
