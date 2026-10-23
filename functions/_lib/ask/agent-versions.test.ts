// @vitest-environment node
// What the assistant records about each answer for Steven's ratings (specs/ask-ratings.md,
// AC-2, AC-3, AC-5): the model that served it, whether a fallback did, the instruction and
// knowledge versions and the sources it cited, all in the log write after the answer.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../env'
import { MemoryStore } from '../mcp/store'
import { answerVersions, ask, MODEL, REQUEST, servingModel, words, type FinalMessage, type StreamEvent, type StreamFactory, type Versions } from './agent'
import { instructionVersion } from './prompt'
import { MemoryAskStore } from './store'

const env = { HASH_SALT: 'salt', ANTHROPIC_API_KEY: 'sk-test' } as unknown as Env
const url = 'https://steven.wilssens.com/api/ask'
const now = Date.UTC(2026, 9, 17, 12)
const finalOf = (overrides: Partial<FinalMessage> = {}): FinalMessage => ({ stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 }, ...overrides })
const text = (value: string): StreamEvent => ({ type: 'content_block_delta', delta: { type: 'text_delta', text: value } })
// A stream of the given events, then the final message (or a rejection, as after an abort).
const streamOf = (events: StreamEvent[], final: FinalMessage | null = finalOf(), order: string[] = []): StreamFactory => () => {
  order.push('stream')
  let aborted = false
  return {
    abort: () => { aborted = true },
    async *[Symbol.asyncIterator]() { for (const event of events) { if (aborted) return; if (event.type === 'content_block_delta') order.push('delta'); yield event } },
    finalMessage: async () => { if (!final || aborted) throw new Error('aborted'); return final },
  }
}
const post = (content = 'What did he ship?', headers: Record<string, string> = {}, kind?: 'fit') => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', ...headers }, body: JSON.stringify({ messages: [{ role: 'user', content, ...(kind ? { kind } : {}) }] }) })
const deps = (stream: StreamFactory | undefined, store = new MemoryAskStore(), extra: { env?: Env; versions?: Versions } = {}) => ({ env, store, dossier: new MemoryStore(), waitUntil: (promise: Promise<unknown>) => { void promise }, stream, now: () => now, ...extra })
const run = async (stream: StreamFactory | undefined, extra: { env?: Env; versions?: Versions; request?: Request } = {}) => {
  const store = new MemoryAskStore()
  await (await ask(extra.request ?? post(), deps(stream, store, extra))).text()
  return store
}
const answered = [text('[[in: site:about]]\n\nHe shipped Windows data.')]

afterEach(() => vi.restoreAllMocks())

describe('the model that served an answer', () => {
  it.each([
    ['a fallback_message iteration first', { start: MODEL, fallback: 'claude-y' }, finalOf({ model: MODEL, usage: { input_tokens: 1, output_tokens: 1, iterations: [{ type: 'message', model: MODEL }, { type: 'fallback_message', model: 'claude-sonnet-5' }] } }), { model: 'claude-sonnet-5', fallback: true }],
    ['then a fallback block', { start: MODEL, fallback: 'claude-sonnet-5' }, finalOf({ model: MODEL }), { model: 'claude-sonnet-5', fallback: true }],
    ['then the final message', { start: MODEL, fallback: null }, finalOf({ model: 'claude-sonnet-5' }), { model: 'claude-sonnet-5', fallback: true }],
    ['the final message on the requested model', { start: null, fallback: null }, finalOf({ model: MODEL }), { model: MODEL, fallback: false }],
    ['a dated id of the requested model is not a fallback', { start: null, fallback: null }, finalOf({ model: `${MODEL}-20261001` }), { model: `${MODEL}-20261001`, fallback: false }],
    ['then message_start, when there is no final message', { start: MODEL, fallback: null }, null, { model: MODEL, fallback: false }],
    ['then MODEL', { start: null, fallback: null }, finalOf(), { model: MODEL, fallback: false }],
    ['an id that is not a model id stores MODEL', { start: null, fallback: null }, finalOf({ model: '<b>x</b>' }), { model: MODEL, fallback: false }],
    ['a 65-character id stores MODEL', { start: null, fallback: null }, finalOf({ model: 'a'.repeat(65) }), { model: MODEL, fallback: false }],
    ['a bad fallback id stores MODEL and still counts as a fallback', { start: null, fallback: 'Not A Model' }, finalOf(), { model: MODEL, fallback: true }],
  ])('%s', (_, served, final, expected) => {
    expect(servingModel(served, final)).toEqual(expected)
  })
})

describe('what the log keeps about an answer', () => {
  it('logs the model a fallback block hands over to', async () => {
    const store = await run(streamOf([{ type: 'message_start', message: { model: MODEL } }, { type: 'content_block_start', content_block: { type: 'fallback', to: { model: 'claude-sonnet-5' } } }, ...answered], finalOf({ model: MODEL })))
    expect(store.entries[0]).toMatchObject({ model: 'claude-sonnet-5', fallback: true })
  })

  it('logs the model the final message reports, not the constant', async () => {
    const store = await run(streamOf(answered, finalOf({ model: 'claude-sonnet-5' })))
    expect(store.entries[0]).toMatchObject({ model: 'claude-sonnet-5', fallback: true })
  })

  it('logs a primary answer as no fallback, and ignores a content block that is not a fallback', async () => {
    const store = await run(streamOf([{ type: 'message_start', message: { model: MODEL } }, { type: 'content_block_start', content_block: { type: 'text' } }, ...answered], finalOf({ model: MODEL })))
    expect(store.entries[0]).toMatchObject({ model: MODEL, fallback: false })
  })

  it('an off-topic answer logs the message_start model, and no sources', async () => {
    const store = await run(streamOf([{ type: 'message_start', message: { model: 'claude-opus-5-5-20261001' } }, text('[[out]]\n\nRoses are red')], finalOf({ model: 'claude-other' })), { request: post('Write me a poem') })
    expect(store.entries[0]).toMatchObject({ outcome: 'off', model: 'claude-opus-5-5-20261001', fallback: false, sources: null, answer: expect.stringMatching(/^I can only answer questions about Steven/) })
  })

  it('logs MODEL when the response names no model, or one that is not a model id', async () => {
    const none = await run(streamOf(answered))
    expect(none.entries[0]).toMatchObject({ model: MODEL, fallback: false })
    const bad = await run(streamOf([{ type: 'message_start', message: { model: '<b>x</b>' } }, ...answered], null))
    expect(bad.entries[0]).toMatchObject({ model: MODEL, fallback: false })
  })

  it('an ASK_MOCK answer logs the model mock', async () => {
    const store = await run(undefined, { env: { HASH_SALT: 'salt', ASK_MOCK: '1' } as unknown as Env })
    expect(store.entries[0]).toMatchObject({ model: 'mock', fallback: false, outcome: 'answered' })
  })

  it('logs the instruction and the knowledge version with every answer, fit checks too', async () => {
    const question = await run(streamOf(answered))
    const fit = await run(streamOf([text('[[in: site:about]]\n\n**Covered**\n- Leading PMs: yes.')]), { request: post('Director of Product, data platform', {}, 'fit') })
    for (const store of [question, fit]) expect(store.entries[0]).toMatchObject({ promptVersion: expect.stringMatching(/^[0-9a-f]{8}$/), knowledgeVersion: expect.stringMatching(/^[0-9a-f]{8}$/) })
    expect(fit.entries[0].kind).toBe('fit')
    expect(fit.entries[0].promptVersion).toBe(question.entries[0].promptVersion)
    expect(question.entries[0].promptVersion).toBe(await instructionVersion(REQUEST, { offTopic: words.offTopic, notAPosting: words.notAPosting }))
    expect(await answerVersions([], {})).toEqual({ promptVersion: question.entries[0].promptVersion, knowledgeVersion: question.entries[0].knowledgeVersion })
  })

  it('stores the sources an in-scope answer cited, once each, and only ids that exist', async () => {
    const store = await run(streamOf([text('[[in: site:about, site:about, made:up, site:patents]]\n\nHe did.')]))
    expect(store.entries[0]).toMatchObject({ outcome: 'answered', sources: ['site:about', 'site:patents'] })
  })

  it('stores no sources for a gap or a failed stream', async () => {
    const gap = await run(streamOf([text('[[in: none]]\n\nSteven has not shared that here.')]))
    expect(gap.entries[0]).toMatchObject({ outcome: 'gap', sources: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing: StreamFactory = () => ({ abort: () => {}, async *[Symbol.asyncIterator]() { yield text('[[in: site:about]]\n\nHe'); throw new Error('network') }, finalMessage: async () => null })
    const failed = await run(failing)
    expect(failed.entries[0]).toMatchObject({ outcome: 'failed', sources: null, answer: null })
  })

  it('writes no row at all under GPC or DNT, on a preview deployment or without HASH_SALT', async () => {
    const versions = vi.fn(answerVersions)
    for (const request of [post('q', { 'Sec-GPC': '1' }), post('q', { DNT: '1' }), new Request('https://branch.stevenwilssens.pages.dev/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'q' }] }) })]) {
      expect((await run(streamOf(answered), { request, versions })).entries).toEqual([])
    }
    expect((await run(streamOf(answered), { env: { ANTHROPIC_API_KEY: 'sk' } as unknown as Env, versions })).entries).toEqual([])
    expect(versions).not.toHaveBeenCalled()
  })
})

describe('recording stays off the answer', () => {
  it('computes nothing new before the first token, and a versions call that never ends still lets the answer and done through', async () => {
    const order: string[] = []
    const versions: Versions = () => { order.push('versions'); return new Promise(() => {}) }
    const store = new MemoryAskStore()
    const logged = vi.spyOn(store, 'logQuestion')
    const response = await ask(post(), deps(streamOf(answered, finalOf(), order), store, { versions }))
    // Read until done: the stream stays open while the log write waits.
    const reader = response.body!.getReader()
    let seen = ''
    while (!seen.includes('event: done')) seen += new TextDecoder().decode((await reader.read()).value)
    await reader.cancel()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(seen).toContain('He shipped Windows data.')
    expect(order.indexOf('versions')).toBeGreaterThan(order.indexOf('delta'))
    expect(order[0]).toBe('stream')
    expect(logged).not.toHaveBeenCalled()
  })

  it('a versions call that fails keeps the log row, with no versions', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = new MemoryAskStore()
    const response = await ask(post(), deps(streamOf(answered), store, { versions: async () => { throw new Error('digest failed') } }))
    const textOf = await response.text()
    expect(textOf).toContain('event: done')
    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]).toMatchObject({ outcome: 'answered', answer: expect.stringContaining('He shipped'), promptVersion: null, knowledgeVersion: null })
    expect(store.rows[0]).toMatchObject({ outcome: 'answered' })
    expect(errors).toHaveBeenCalledWith('ask versions', expect.any(Error))
  })
})
