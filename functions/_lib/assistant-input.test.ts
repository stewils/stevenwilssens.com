// The assistant check's input (job A): built from this tree's own prompt code, with the public
// notes read by one GET, and nothing written anywhere.
import { describe, expect, it } from 'vitest'
import { profile } from '../../src/resume'
import { assistantInput, NOTES_URL, NotReady, readNotes, SCHEMA } from './assistant-input'
import { answerSources, answerTokens, contextFor, liveRequest, MODEL, words } from './ask/agent'
import { articlePages, jdPrefix, loadArticles, systemPrompt } from './ask/prompt'

const note = { id: 7, role: 'general', topic: 'now', title: 'Looking for', body: 'A product leadership role in Seattle.' }
const notesFetch = (body: unknown, status = 200) => {
  const calls: { url: string; method: string }[] = []
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET' })
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  }) as typeof fetch
  return { fetchImpl, calls }
}
const pages: Record<string, string> = Object.fromEntries(articlePages.map(({ path }, index) => [path, `# Write-up ${index}\n\nWhat was built ${index}.`]))
const readPage = async (path: string) => pages[path] ?? null

describe('the assistant input', () => {
  it("is the branch's own systemPrompt, MODEL and contexts, never a copy", async () => {
    const { fetchImpl, calls } = notesFetch({ notes: [note] })
    const input = await assistantInput({ readPage, fetchImpl })
    const entries = await readNotes(NOTES_URL, notesFetch({ notes: [note] }).fetchImpl)
    expect(input.system).toBe(systemPrompt(entries, await loadArticles(readPage)))
    expect(input.system).toContain('A product leadership role in Seattle.')
    expect(input).toMatchObject({ schema: SCHEMA, model: MODEL, jdPrefix, notes: 1, articles: articlePages.length, contexts: { question: contextFor('home', false), fit: contextFor('home', true) } })
    expect(input.contexts.fit).toMatch(/fit-check format/)
    expect(input.profile.workArrangement).toBe('Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating.')
    expect(input.profile).toEqual({ location: profile.location, workArrangement: profile.workArrangement, workAuthorization: profile.workAuthorization, availability: profile.availability, teamSize: profile.teamSize })
    expect(calls).toEqual([{ url: NOTES_URL, method: 'GET' }])
    // The live request and how the site shows an answer, from the same code the assistant runs.
    expect(input.request).toEqual({ ...liveRequest, maxTokens: answerTokens })
    expect(input.render).toMatchObject({ maxSources: answerSources, offTopic: words.offTopic, notAPosting: words.notAPosting })
    expect(input.render.sources['site:about']).toBeTruthy()
  })

  it('reads the notes from the given address, and keeps only well-formed notes, as public entries', async () => {
    const { fetchImpl, calls } = notesFetch({ notes: [note, { id: 'x', role: 'general' }, null, { ...note, id: 8, body: 5 }] })
    const entries = await readNotes('https://example.test/api/notes', fetchImpl)
    expect(entries).toEqual([{ ...note, createdAt: 0, updatedAt: 0, visibility: 'public', tags: null }])
    expect(calls).toEqual([{ url: 'https://example.test/api/notes', method: 'GET' }])
  })

  it('does not run when the notes cannot be read: never a check without them', async () => {
    await expect(readNotes(NOTES_URL, notesFetch({ error: 'gone' }, 404).fetchImpl)).rejects.toThrow(/answered 404/)
    await expect(readNotes(NOTES_URL, notesFetch('not json').fetchImpl)).rejects.toThrow(/not a list of notes/)
    await expect(readNotes(NOTES_URL, notesFetch({ entries: [] }).fetchImpl)).rejects.toThrow(NotReady)
    const offline = (async () => { throw new Error('offline') }) as typeof fetch
    await expect(readNotes(NOTES_URL, offline)).rejects.toThrow(/could not be read.*offline/)
    await expect(assistantInput({ readPage, fetchImpl: offline })).rejects.toThrow(NotReady)
  })

  it('counts the write-ups the build had', async () => {
    const input = await assistantInput({ readPage: async () => null, fetchImpl: notesFetch({ notes: [] }).fetchImpl })
    expect(input).toMatchObject({ notes: 0, articles: 0 })
  })
})
