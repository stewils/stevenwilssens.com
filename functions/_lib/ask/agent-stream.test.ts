// @vitest-environment node
// The assistant's streams: the request it sends Claude (the SDK is stubbed, nothing
// leaves the machine), the canned ASK_MOCK stream, and how a failing stream, a refusal,
// a lost final message and Turnstile's answers end up for the reader.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../env'
import { MemoryStore } from '../mcp/store'
import { answerIsOurs, ask, feedback, missingRequirements, MODEL, mockStream, parseBody, REQUEST, signAnswer, words, type AnswerStream, type StreamFactory } from './agent'
import { assistantReport } from './report'
import { instructionVersion, jdPrefix } from './prompt'
import { MemoryAskStore } from './store'
import { experiences, profile } from '../../../src/resume'

const sdk = vi.hoisted(() => ({ options: [] as unknown[], requests: [] as Record<string, unknown>[] }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor(options: unknown) { sdk.options.push(options) }
    beta = {
      messages: {
        stream: (request: Record<string, unknown>) => {
          sdk.requests.push(request)
          return {
            abort: () => {},
            async *[Symbol.asyncIterator]() {
              yield { type: 'message_start' }
              yield { type: 'content_block_delta', delta: { type: 'thinking_delta' } }
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '[[in: site:about]]\n\nFrom Claude.' } }
            },
            finalMessage: async () => ({ stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null, cache_creation_input_tokens: null } }),
          }
        },
      },
    }
  },
}))

const env = { HASH_SALT: 'salt', ANTHROPIC_API_KEY: 'sk-test' } as unknown as Env
const now = Date.UTC(2026, 9, 17, 12)
const post = (body: unknown) => new Request('https://steven.wilssens.com/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' }, body: JSON.stringify(body) })
type Event = { event: string; data: Record<string, unknown> }
const events = async (response: Response): Promise<Event[]> => (await response.text()).split('\n\n').filter(Boolean).map((block) => ({ event: /^event: (.+)$/m.exec(block)![1], data: JSON.parse(/^data: (.+)$/m.exec(block)![1]) as Record<string, unknown> }))
const answerOf = (list: Event[]) => list.filter((item) => item.event === 'delta').map((item) => item.data.text).join('')
const deps = (overrides: Partial<Parameters<typeof ask>[1]> = {}) => ({ env, store: new MemoryAskStore(), dossier: new MemoryStore(), waitUntil: (promise: Promise<unknown>) => { void promise }, now: () => now, ...overrides })
const question = (content = 'What did he do most recently?') => ({ messages: [{ role: 'user', content }] })

// A stream built from events, with a final message that can fail or carry any stop reason.
const streamOf = (parts: unknown[], final: () => Promise<unknown>, onAbort = () => {}): StreamFactory => () => ({
  abort: onAbort,
  async *[Symbol.asyncIterator]() { for (const part of parts) { if (part instanceof Error) throw part; yield part as { type: string } } },
  finalMessage: final as AnswerStream['finalMessage'],
})
const text = (value: string) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text: value } })

beforeEach(() => { sdk.options.length = 0; sdk.requests.length = 0 })
afterEach(() => vi.restoreAllMocks())

describe('the request to Claude', () => {
  it('sends the cached system prompt, the page context and the conversation to the configured model', async () => {
    const list = await events(await ask(post({ ...question(), page: 'about' }), deps()))
    expect(answerOf(list)).toBe('From Claude.')
    expect(sdk.options[0]).toEqual({ apiKey: 'sk-test', maxRetries: 1, defaultHeaders: undefined })
    const request = sdk.requests[0] as { model: string; max_tokens: number; system: { text: string; cache_control?: unknown }[]; messages: unknown[] }
    expect(request.model).toBe(MODEL)
    expect(request.max_tokens).toBe(1500)
    expect(request.system[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    expect(request.system[1].text).toBe('The reader is on the about page of steven.wilssens.com.')
    expect(request.messages).toEqual([{ role: 'user', content: 'What did he do most recently?' }])
  })

  it('names the workspace when the key was made outside one, and gives a fit check more room', async () => {
    await (await ask(post({ messages: [{ role: 'user', content: 'Director of Product', kind: 'fit' }] }), deps({ env: { ...env, ANTHROPIC_WORKSPACE_ID: 'wrk_1' } as Env }))).text()
    expect(sdk.options[0]).toMatchObject({ defaultHeaders: { 'anthropic-workspace-id': 'wrk_1' } })
    const request = sdk.requests[0] as { max_tokens: number; system: { text: string }[]; messages: { content: string }[] }
    expect(request.max_tokens).toBe(2200)
    expect(request.system[1].text).toContain('fit check')
    expect(request.messages[0].content.startsWith(jdPrefix)).toBe(true)
  })

  it('the version it logs is the hash of the settings it sent', async () => {
    const store = new MemoryAskStore()
    await (await ask(post(question()), deps({ store }))).text()
    const request = sdk.requests[0] as { max_tokens: number; fallbacks: string; thinking: { type: string }; output_config: { effort: string } }
    const sent = { ...REQUEST, maxTokens: request.max_tokens, fallbacks: request.fallbacks, thinking: request.thinking.type, effort: request.output_config.effort }
    expect(sent).toEqual(REQUEST)
    expect(store.entries[0]).toMatchObject({ model: MODEL, fallback: false, promptVersion: await instructionVersion(sent, { offTopic: words.offTopic, notAPosting: words.notAPosting }) })
  })

  it('the done event has the same keys as on main: no model, no version', async () => {
    const list = await events(await ask(post(question()), deps()))
    const done = list.find((item) => item.event === 'done')!
    expect(Object.keys(done.data).sort()).toEqual(['id', 'scope', 'sig', 'sources'])
    expect(list.map((item) => item.event)).toEqual(['meta', 'delta', 'done'])
  })
})

describe('the canned stream (ASK_MOCK=1)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0 }) as unknown as typeof setTimeout)
  })
  const mocked = { HASH_SALT: 'salt', ASK_MOCK: '1' } as unknown as Env

  it('answers in scope with sources, without an API key', async () => {
    const list = await events(await ask(post(question()), deps({ env: mocked })))
    expect(list[0]).toMatchObject({ event: 'meta', data: { scope: 'in' } })
    expect(answerOf(list)).toContain('Windows & Devices Data')
    expect(sdk.requests).toEqual([])
  })

  it('turns away an off-topic question and plays a fit check', async () => {
    expect(answerOf(await events(await ask(post(question('Write me a poem about the weather')), deps({ env: mocked }))))).toBe(words.offTopic)
    const store = new MemoryAskStore()
    const fit = await events(await ask(post({ messages: [{ role: 'user', content: 'Director of Product. Requirements: SQL.', kind: 'fit' }] }), deps({ env: mocked, store })))
    expect(answerOf(fit)).toContain('**Not shown on the site**')
    expect(store.saved.map((saved) => saved.question)).toEqual(['Hands-on SQL and Python', 'Consumer subscription products'])
  })

  it('stops yielding once aborted, and answers a non-text last message with the general answer', async () => {
    const stream = mockStream('', '', [{ role: 'user', content: [{ type: 'text', text: 'poem' }] }], { maxTokens: 10 })
    const seen: string[] = []
    for await (const event of stream) { seen.push(event.delta!.text!); if (seen.length === 2) stream.abort() }
    expect(seen).toHaveLength(2)
    expect(seen.join('')).toBe('[[in: role:windows-d')
    expect(await stream.finalMessage()).toMatchObject({ stop_reason: 'end_turn' })
  })
})

describe('when the stream misbehaves', () => {
  it('tells the reader something went wrong when the stream breaks, and counts a failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = new MemoryAskStore()
    const list = await events(await ask(post(question()), deps({ store, stream: streamOf([text('[[in: site:about]]\n\nHalf'), new Error('socket closed')], async () => null) })))
    expect(list.at(-1)).toEqual({ event: 'error', data: { message: words.failed } })
    expect(store.rows[0]).toMatchObject({ outcome: 'failed', costMicro: 0 })
    expect(error).toHaveBeenCalledWith('ask', expect.any(Error))
  })

  it('answers a refusal like an off-topic question', async () => {
    const store = new MemoryAskStore()
    const list = await events(await ask(post(question()), deps({ store, stream: streamOf([], async () => ({ stop_reason: 'refusal', usage: { input_tokens: 1, output_tokens: 0 } })) })))
    expect(list.map((item) => item.event)).toEqual(['meta', 'meta', 'delta', 'done'])
    expect(answerOf(list)).toBe(words.offTopic)
    expect(list.at(-1)!.data).toMatchObject({ scope: 'out', sources: [] })
    expect(store.rows[0]).toMatchObject({ outcome: 'off', inputTokens: 1 })
  })

  it('tells a reader whose fit check was not a posting so, and stops the stream early', async () => {
    const abort = vi.fn()
    const list = await events(await ask(post({ messages: [{ role: 'user', content: 'hello there', kind: 'fit' }] }), deps({ stream: streamOf([text('[[out]]\n'), text('never shown')], async () => null, abort) })))
    expect(answerOf(list)).toBe(words.notAPosting)
    expect(abort).toHaveBeenCalled()
  })

  it('answers without a header, skips empty pieces, and still records the question when the final message is lost', async () => {
    const store = new MemoryAskStore()
    const parts = [text('No header here, just an answer that runs on'), text('\n'), text('   '), text(' and on.'), { type: 'content_block_delta', delta: { type: 'text_delta' } }]
    const list = await events(await ask(post(question()), deps({ store, stream: streamOf(parts, () => Promise.reject(new Error('gone'))) })))
    expect(list[0]).toEqual({ event: 'meta', data: { scope: 'in', sources: [] } })
    expect(answerOf(list)).toBe('No header here, just an answer that runs on\n    and on.')
    expect(store.rows[0]).toMatchObject({ outcome: 'gap', inputTokens: 0 })
    expect(store.saved[0]).toMatchObject({ reason: 'gap' })
  })

  it('records nothing as a gap when the answer is empty, and survives a store that cannot save', async () => {
    const store = new MemoryAskStore()
    store.saveQuestion = () => Promise.reject(new Error('D1 down'))
    store.recordUsage = () => Promise.reject(new Error('D1 down'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const list = await events(await ask(post(question()), deps({ store, stream: streamOf([text('[[in: none]]')], async () => null) })))
    expect(list.at(-1)).toMatchObject({ event: 'done', data: { id: null, scope: 'in' } })
    const saved = await events(await ask(post(question()), deps({ store, stream: streamOf([text('[[in: none]]\n\nNot covered.')], async () => null) })))
    expect(saved.at(-1)).toMatchObject({ event: 'done', data: { id: null } })
    expect(error).toHaveBeenCalledWith('ask usage', expect.any(Error))
  })

  it('keeps the place the question came from with a gap', async () => {
    const store = new MemoryAskStore()
    const request = post(question())
    Object.defineProperty(request, 'cf', { value: { country: 'DE', asOrganization: 'Deutsche Telekom' } })
    await (await ask(request, deps({ store, stream: streamOf([text('[[in: none]]\n\nNot covered.')], async () => null) }))).text()
    expect(store.saved[0]).toMatchObject({ country: 'DE', asOrg: 'Deutsche Telekom', page: 'home' })
  })
})

describe('the human check with Turnstile', () => {
  const keyed = { ...env, TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_SITE_KEY: 'k', ASK_CHECK_AFTER_USD: '0.000001' } as Env
  const spent = async () => {
    const store = new MemoryAskStore()
    await store.recordUsage('2026-10-17', 'answered', { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, 5, 0, 0)
    return store
  }
  const asked = async (verify: typeof fetch) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(verify)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    return ask(post({ ...question(), turnstileToken: 'token' }), deps({ env: keyed, store: await spent(), stream: streamOf([text('[[in: site:about]]\n\nx')], async () => null) }))
  }

  it('passes a token Cloudflare confirms for this host, sending the connecting IP', async () => {
    let form: FormData | null = null
    const response = await asked((async (_url: unknown, init?: RequestInit) => { form = init!.body as FormData; return Response.json({ success: true }) }) as typeof fetch)
    expect(response.status).toBe(200)
    expect(form!.get('remoteip')).toBe('203.0.113.9')
  })

  it('refuses a token for another host, an unreachable Cloudflare and an unreadable answer', async () => {
    expect((await asked((async () => Response.json({ success: true, hostname: 'evil.example' })) as typeof fetch)).status).toBe(403)
    expect((await asked((async () => { throw new Error('offline') }) as typeof fetch)).status).toBe(403)
    expect((await asked((async () => new Response('<html>')) as typeof fetch)).status).toBe(403)
    expect(console.warn).toHaveBeenCalledWith('turnstile', expect.stringContaining('"hostname":null'))
  })

  it('leaves the IP out when the request has none', async () => {
    let form: FormData | null = null
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (_url: unknown, init?: RequestInit) => { form = init!.body as FormData; return Response.json({ success: true, hostname: 'steven.wilssens.com' }) }) as typeof fetch)
    const request = new Request('https://steven.wilssens.com/api/ask', { method: 'POST', body: JSON.stringify({ ...question(), turnstileToken: 'token' }) })
    const response = await ask(request, deps({ env: keyed, store: await spent(), stream: streamOf([text('[[in: site:about]]\n\nx')], async () => null) }))
    expect(response.status).toBe(200)
    expect(form!.has('remoteip')).toBe(false)
  })
})

describe('reading the conversation', () => {
  it('refuses a missing body, a missing turn and an empty question', () => {
    expect(parseBody(null)).toBe('tooLong')
    expect(parseBody({ messages: [null] })).toBe('failed')
    expect(parseBody({ messages: [{ role: 'user', content: '   ' }] })).toBe('tooLong')
    expect(parseBody({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b', sources: [], id: null, sig: 's' }] })).toBe('tooLong')
  })

  it('keeps only valid source ids and a positive whole answer id, and falls back to the home page', () => {
    const parsed = parseBody({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b', sources: 'site:about', id: 3, sig: 42 }, { role: 'user', content: 'c' }], page: 'Not A Page!' })
    expect(parsed).toMatchObject({ page: 'home', turnstileToken: '', messages: [{ role: 'user' }, { role: 'assistant', sources: [], id: 3, sig: '' }, { role: 'user' }] })
    const other = parseBody({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b', sources: ['site:about', 'evil', 7, 'notes'], id: -1, sig: 's' }, { role: 'user', content: 'c' }] })
    expect(other).toMatchObject({ messages: [{}, { sources: ['site:about', 'notes'], id: null }, {}] })
  })

  it('signs without a salt, and refuses an answer without a signature', async () => {
    const bare = {} as Env
    const sig = await signAnswer(bare, 'q', 'a', [], null)
    expect(await answerIsOurs(bare, 'q', { content: 'a', sources: [], id: null, sig })).toBe(true)
    expect(await answerIsOurs(bare, 'q', { content: 'a', sources: [], id: null, sig: '' })).toBe(false)
    expect(await answerIsOurs(bare, 'q', { content: 'a', sources: [], id: null, sig: 'short' })).toBe(false)
  })

  it('skips lines under "Not shown" that are not bullets', () => {
    expect(missingRequirements('**Not shown on the site**\nSome prose.\n\n- Go\n-  \n')).toEqual(['Go'])
  })

  it('answers a body that is not JSON with a 400', async () => {
    const response = await ask(new Request('https://steven.wilssens.com/api/ask', { method: 'POST', body: '{nope' }), deps({ stream: streamOf([], async () => null) }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'tooLong', message: words.tooLong })
  })

  it('replays an earlier answer without sources as "none" and drops leading blanks after the header', async () => {
    let seen: { content: unknown }[] = []
    const sig = await signAnswer(env, 'first', 'An answer.', [], null)
    const capture: StreamFactory = (system, context, messages, options) => { seen = messages as { content: unknown }[]; return streamOf([text('[[in: site:about]]\n'), text('   '), text('Next.')], async () => null)(system, context, messages, options) }
    const list = await events(await ask(post({ messages: [{ role: 'user', content: 'first' }, { role: 'assistant', content: 'An answer.', sources: [], id: null, sig }, { role: 'user', content: 'second' }] }), deps({ stream: capture })))
    expect(seen[1].content).toBe('[[in: none]]\n\nAn answer.')
    expect(answerOf(list)).toBe('Next.')
  })
})

describe('the Building write-ups in the prompt', () => {
  it('reads them again on the next question when one could not be read', async () => {
    const systems: string[] = []
    const capture: StreamFactory = (system, context, messages, options) => { systems.push(system); return streamOf([text('[[in: site:about]]\n\nx')], async () => null)(system, context, messages, options) }
    let up = false
    const pages = async (path: string) => { if (!up) throw new Error('not yet'); return `# ${path}\n\nWrite-up text for ${path}.` }
    await (await ask(post(question()), deps({ stream: capture, pages }))).text()
    up = true
    await (await ask(post(question()), deps({ stream: capture, pages }))).text()
    await (await ask(post(question()), deps({ stream: capture, pages: async () => null }))).text()
    expect(systems[0]).not.toContain('Write-up text for')
    expect(systems[1]).toContain('Write-up text for /building-this-site.md.')
    // Once every page loaded, the isolate keeps them.
    expect(systems[2]).toContain('Write-up text for /building-this-site.md.')
  })
})

describe('votes', () => {
  const vote = (body: unknown, store = new MemoryAskStore()) => feedback(typeof body === 'string' ? new Request('https://steven.wilssens.com/api/ask/feedback', { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.9' }, body }) : post(body), { env, store, now: () => now })

  it('refuses a body that is not JSON, and a connection that voted too often', async () => {
    expect((await vote('{nope')).status).toBe(400)
    const store = new MemoryAskStore()
    const sig = await signAnswer(env, 'q', 'a', [], null)
    for (let i = 0; i < 40; i++) expect((await vote({ helpful: true, question: 'q', answer: 'a', sources: [], id: null, sig }, store)).status).toBe(200)
    expect((await vote({ helpful: true, question: 'q', answer: 'a', sources: [], id: null, sig }, store)).status).toBe(429)
  })

  it('does not keep a down-voted answer that was already kept as a gap, and drops an odd page name', async () => {
    const store = new MemoryAskStore()
    const kept = await signAnswer(env, 'q', 'a', [], 7)
    expect((await vote({ helpful: false, question: 'q', answer: 'a', sources: [], id: 7, sig: kept }, store)).status).toBe(200)
    expect(store.saved).toEqual([])
    const sig = await signAnswer(env, 'q', 'a', [], null)
    expect((await vote({ helpful: false, question: 'q', answer: 'a', sources: [], id: null, sig, page: '../admin' }, store)).status).toBe(200)
    expect(store.saved[0]).toMatchObject({ page: null })
    expect((await vote({ helpful: true, question: '', answer: 'a', sources: [], id: null, sig }, store)).status).toBe(400)
  })
})

describe('the report card with nothing answered yet', () => {
  it('leaves the averages out instead of dividing by zero', async () => {
    const report = await assistantReport(new MemoryAskStore(), new MemoryStore(), now)
    expect(report).toMatchObject({ since: null, questions: 0, costPerAnswerMicro: null, msFirstAvg: null, publicNotes: 0 })
  })
})

// specs/mcp-prs-automation.md, AC-16: the canned answer (ASK_MOCK) states nothing about Steven that src/resume.ts does not.
describe('the ASK_MOCK answer', () => {
  // The mock streams a piece every 25 ms: fake timers, so reading a whole answer takes no real time.
  const answer = async (question: string) => {
    vi.useFakeTimers()
    try {
      const stream = mockStream('', '', [{ role: 'user', content: question }], { maxTokens: 10 })
      let finished = false
      const read = (async () => {
        let text = ''
        for await (const event of stream as unknown as AsyncIterable<{ delta?: { text?: string } }>) text += event.delta?.text ?? ''
        finished = true
        return text
      })()
      while (!finished) await vi.advanceTimersByTimeAsync(1000)
      return await read
    } finally { vi.useRealTimers() }
  }
  it('states no location, work arrangement, availability or team size other than profile\'s', async () => {
    for (const text of [await answer('What did Steven do last?'), await answer(`${jdPrefix}\nA VP of product.`)]) {
      expect(text.length).toBeGreaterThan(50)
      for (const match of text.matchAll(/(\d+) to (\d+) product managers/g)) expect(`${match[1]} to ${match[2]} product managers`).toBe(profile.teamSize)
      expect(text).not.toMatch(/\b(remote|hybrid|relocat\w*|on-site|onsite|available (now|from|in)|notice period|visa|green card|citizen)\b/i)
      for (const place of text.match(/\b(Seattle|Redmond|Bellevue|Belgium|Antwerp|Washington)\b/g) ?? []) expect(`${profile.location} ${profile.workArrangement}`).toContain(place)
    }
  })
  it('names the latest role with its dates as src/resume.ts has them', async () => {
    const text = await answer('What did Steven do last?')
    const role = experiences.find((item) => item.key === 'windows-devices-data')!
    expect(text).toContain(`(${role.dates.replace(' - ', ' to ')})`)
    expect(role.points.join(' ')).toMatch(/more than 1\.6 billion Windows devices/)
    expect(text).toMatch(/more than 1\.6 billion devices/)
  })
})
