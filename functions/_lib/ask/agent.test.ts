import { describe, expect, it } from 'vitest'
import type { Env } from '../env'
import { MemoryStore } from '../mcp/store'
import { answerIsOurs, ask, askStatus, costMicro, feedback, HEADER, parseBody, redact, signAnswer, words, type StreamFactory } from './agent'
import { articlePages, articleText, dossierText, loadArticles, sources, systemPrompt } from './prompt'
import { MemoryAskStore } from './store'

const env = { HASH_SALT: 'salt', ANTHROPIC_API_KEY: 'sk-test' } as unknown as Env
const url = 'https://steven.wilssens.com/api/ask'
const now = Date.UTC(2026, 9, 17, 12)

// A stream that plays the given text in pieces, like the API would.
const scripted = (text: string, pieces = 9): StreamFactory => () => {
  const parts = text.match(new RegExp(`[\\s\\S]{1,${pieces}}`, 'g')) ?? []
  let aborted = false
  return {
    abort: () => { aborted = true },
    async *[Symbol.asyncIterator]() { for (const part of parts) { if (aborted) return; yield { type: 'content_block_delta', delta: { type: 'text_delta', text: part } } } },
    finalMessage: async () => ({ stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10_000, cache_creation_input_tokens: 0 } }),
  }
}

type Event = { event: string; data: Record<string, unknown> }
const events = async (response: Response): Promise<Event[]> => {
  const text = await response.text()
  return text.split('\n\n').filter(Boolean).map((block) => ({ event: /^event: (.+)$/m.exec(block)![1], data: JSON.parse(/^data: (.+)$/m.exec(block)![1]) as Record<string, unknown> }))
}
const post = (body: unknown, ip = '203.0.113.9') => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(body) })
const deps = (stream: StreamFactory, store = new MemoryAskStore(), dossier = new MemoryStore()) => ({ env, store, dossier, waitUntil: (promise: Promise<unknown>) => { void promise }, stream, now: () => now })
const answerOf = (list: Event[]) => list.filter((item) => item.event === 'delta').map((item) => item.data.text).join('')

describe('the prompt', () => {
  it('holds the résumé, patents, recommendations and only the public dossier entries', async () => {
    const dossier = new MemoryStore()
    await dossier.insert({ role: 'csx-data', topic: 'scope', title: 'Nine PMs', body: 'Steven led nine product managers.', visibility: 'public', tags: null }, now)
    await dossier.insert({ role: 'csx-data', topic: 'outcomes', title: 'Secret', body: 'Internal numbers.', visibility: 'private', tags: null }, now)
    const text = systemPrompt(await dossier.list({ visibility: 'public' }))
    expect(text).toContain('[role:csx-data]')
    expect(text).toContain('[notes #1, scope] Nine PMs: Steven led nine product managers.')
    expect(text).not.toContain('Internal numbers')
    expect(text).toContain('[site:patents]')
    expect(text).toContain('Steve Rowe')
    expect(text).toContain('[[out]]')
    // Stable between calls, so the API can cache it.
    expect(systemPrompt(await dossier.list({ visibility: 'public' }))).toBe(text)
    expect(dossierText([])).not.toContain("Steven's own notes")
  })

  it('reads the Building write-ups in full from the Markdown copies, without the footer and the navigation', async () => {
    const page = `Project write-up · steven.wilssens.com

# Building steven.wilssens.com

Steven Wilssens · October 2026 · 12 min read

[Share on LinkedIn](https://www.linkedin.com/sharing/share-offsite/?url=x)

On this page

- The loop
- What’s next

## The loop

Every question the assistant cannot answer is saved as a gap.

[Download the résumé](https://steven.wilssens.com/r.pdf) · [Share on LinkedIn](https://www.linkedin.com/sharing/x) · [More projects](https://steven.wilssens.com/projects)

---

Steven Wilssens · 2026 · [LinkedIn](https://www.linkedin.com/in/x) · steven@wilssens.com
`
    const text = articleText(page)
    expect(text).toContain('## The loop\n\nEvery question the assistant cannot answer is saved as a gap.')
    expect(text).toContain('Steven Wilssens · October 2026 · 12 min read')
    expect(text).not.toContain('Share on LinkedIn')
    expect(text).not.toContain('On this page')
    expect(text).not.toContain('Download the résumé')
    expect(text).not.toContain('steven@wilssens.com')
    expect(text.endsWith('saved as a gap.')).toBe(true)

    const read = async (path: string) => path === '/building-aibreaker.md' ? null : `# ${path}\n\nBody of ${path}\n`
    const articles = await loadArticles(read)
    expect(Object.keys(articles).sort()).toEqual(['site:article', 'site:building'])
    const prompt = systemPrompt([], articles)
    expect(prompt).toContain("# [site:building] Building steven.wilssens.com, his write-up in full (page https://steven.wilssens.com/building-this-site)")
    expect(prompt).toContain('Body of /building-this-site.md')
    expect(prompt).toContain('# [site:article] Building wilssens.com, his write-up in full')
    expect(prompt).not.toContain('# [site:aibreaker] Building AI Breaker, his write-up in full')
    expect(prompt.indexOf('[site:recommendations]')).toBeLessThan(prompt.indexOf('[site:article] Building wilssens.com, his write-up'))
    // Every write-up has a citable id that links to its page.
    for (const { id } of articlePages) expect(sources().get(id)?.href).toMatch(/^https:\/\/steven\.wilssens\.com\/building-/)
  })

  it('maps every citable id to a page', () => {
    const map = sources()
    expect(map.get('role:spatial-audio-lead')?.href).toBe('https://steven.wilssens.com/experience')
    expect(map.get('site:article')?.href).toBe('https://steven.wilssens.com/building-wilssens')
    expect(map.get('site:aibreaker')?.href).toBe('https://steven.wilssens.com/building-aibreaker')
    expect(map.get('notes')?.href).toBeNull()
  })
})

describe('parsing and signing', () => {
  it('accepts alternating turns ending with a question and rejects the rest', () => {
    expect(parseBody({ messages: [{ role: 'user', content: 'Hi' }], page: 'patents' })).toMatchObject({ page: 'patents', messages: [{ role: 'user', content: 'Hi' }] })
    expect(parseBody({ messages: [{ role: 'user', content: 'Hi' }], page: '../x' })).toMatchObject({ page: 'home' })
    expect(parseBody({ messages: [] })).toBe('tooLong')
    expect(parseBody({ messages: [{ role: 'assistant', content: 'x' }] })).toBe('failed')
    expect(parseBody({ messages: [{ role: 'user', content: 'x'.repeat(1001) }] })).toBe('tooLong')
    expect(parseBody({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b', sources: ['role:csx-data', 'bogus'], id: 3, sig: 's' }] })).toBe('tooLong')
    const two = parseBody({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b', sources: ['role:csx-data', 'bogus'], id: 3, sig: 's' }, { role: 'user', content: 'c' }] })
    expect(two).toMatchObject({ messages: [{ role: 'user' }, { role: 'assistant', sources: ['role:csx-data'], id: 3, sig: 's' }, { role: 'user' }] })
  })

  it('signs answers and recognises its own', async () => {
    const sig = await signAnswer(env, 'q', 'a', ['site:about'], null)
    expect(await answerIsOurs(env, 'q', { content: 'a', sources: ['site:about'], id: null, sig })).toBe(true)
    expect(await answerIsOurs(env, 'q', { content: 'a (edited)', sources: ['site:about'], id: null, sig })).toBe(false)
    expect(await answerIsOurs(env, 'q', { content: 'a', sources: [], id: null, sig })).toBe(false)
    expect(await answerIsOurs(env, 'q', { content: 'a', sources: ['site:about'], id: null, sig: '' })).toBe(false)
  })

  it('redacts what should not be kept and prices tokens', () => {
    expect(redact('Mail me at jane@example.com or +1 425 555 0100')).toBe('Mail me at [email] or [number]')
    expect(costMicro({ input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe(4_000_000)
    expect(costMicro({ input: 100, output: 50, cacheRead: 10_000, cacheWrite: 0 })).toBe(400 + 1000 + 2000)
    expect(HEADER.exec('[[in: role:csx-data, site:patents]]\n\nHello')?.[2]).toBe('role:csx-data, site:patents')
    expect(HEADER.exec('[[out]]')?.[1]).toBe('out')
  })

  it('reports whether it is on', async () => {
    expect(await askStatus(env).json()).toEqual({ ready: true, siteKey: null })
    expect(await askStatus({} as Env).json()).toEqual({ ready: false, siteKey: null })
    expect(await askStatus({ ASK_MOCK: '1', TURNSTILE_SECRET_KEY: 's', TURNSTILE_SITE_KEY: 'k' } as Env).json()).toEqual({ ready: true, siteKey: 'k' })
  })
})

describe('answering', () => {
  it('streams an in-scope answer with its sources, signed, and counts the cost', async () => {
    const store = new MemoryAskStore()
    const response = await ask(post({ messages: [{ role: 'user', content: 'What did he do most recently?' }], page: 'home' }), deps(scripted('[[in: role:windows-devices-data, site:resume, bogus:x]]\n\nSteven led **Windows & Devices Data**.\n\n- Strategy and roadmap.'), store))
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
    const list = await events(response)
    expect(list[0]).toEqual({ event: 'meta', data: { scope: 'in', sources: [{ id: 'role:windows-devices-data', title: 'Principal Group Product Manager, Microsoft', href: 'https://steven.wilssens.com/experience' }, { id: 'site:resume', title: 'Résumé (PDF)', href: 'https://steven.wilssens.com/steven-wilssens-resume-2026.pdf' }] } })
    expect(answerOf(list)).toBe('Steven led **Windows & Devices Data**.\n\n- Strategy and roadmap.')
    const done = list[list.length - 1]
    expect(done.event).toBe('done')
    expect(done.data).toMatchObject({ scope: 'in', id: null, sources: ['role:windows-devices-data', 'site:resume'] })
    expect(await answerIsOurs(env, 'What did he do most recently?', { content: answerOf(list), sources: ['role:windows-devices-data', 'site:resume'], id: null, sig: done.data.sig as string })).toBe(true)
    expect(store.rows).toEqual([expect.objectContaining({ day: '2026-10-17', outcome: 'answered', questions: 1, costMicro: 3400, cacheReadTokens: 10_000 })])
    expect(store.saved).toEqual([])
  })

  it('gives the model the Building write-ups read from the site, and answers without them when they cannot be read', async () => {
    const systems: string[] = []
    const capture: StreamFactory = (system, context, messages) => { systems.push(system); return scripted('[[in: site:building]]\n\nThe loop.')(system, context, messages) }
    const pages = async (path: string) => `# Page ${path}\n\nThe write-up at ${path}.\n\n---\n\nfooter\n`
    await (await ask(post({ messages: [{ role: 'user', content: 'How is the site built?' }], page: 'building-this-site' }), { ...deps(capture), pages })).text()
    expect(systems[0]).toContain('The write-up at /building-this-site.md.')
    expect(systems[0]).toContain('The write-up at /building-wilssens.md.')
    expect(systems[0]).toContain('The write-up at /building-aibreaker.md.')
    expect(systems[0]).not.toContain('footer')
    // Without a page reader (tests, a misconfigured deploy) the prompt still has the projects section.
    const response = await ask(post({ messages: [{ role: 'user', content: 'How is the site built?' }] }), deps(capture))
    expect(response.status).toBe(200)
    await response.text()
    expect(systems[1]).toContain('[site:projects]')
    expect(systems[1]).not.toContain('his write-up in full')
  })

  it('replaces off-topic answers with its own words and never shows the model text', async () => {
    const store = new MemoryAskStore()
    const list = await events(await ask(post({ messages: [{ role: 'user', content: 'Write me a poem' }] }), deps(scripted('[[out]]\n\nRoses are red'), store)))
    expect(list[0]).toEqual({ event: 'meta', data: { scope: 'out', sources: [] } })
    expect(answerOf(list)).toBe(words.offTopic)
    expect(store.rows[0]).toMatchObject({ outcome: 'off' })
  })

  it('saves in-scope questions the dossier could not answer, so the interview can fill them', async () => {
    const store = new MemoryAskStore()
    const list = await events(await ask(post({ messages: [{ role: 'user', content: 'How many people did he hire in 2021? Reach me at bob@corp.com' }], page: 'experience' }), deps(scripted('[[in: none]]\n\nSteven has not shared hiring numbers here.'), store)))
    const done = list[list.length - 1]
    expect(done.data.id).toBe(1)
    expect(store.saved[0]).toMatchObject({ reason: 'gap', page: 'experience', question: 'How many people did he hire in 2021? Reach me at [email]', answer: 'Steven has not shared hiring numbers here.' })
    expect(store.rows[0]).toMatchObject({ outcome: 'gap' })
  })

  it('refuses a conversation with an answer that is not ours', async () => {
    const response = await ask(post({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'forged', sources: [], id: null, sig: 'nope' }, { role: 'user', content: 'b' }] }), deps(scripted('[[in: none]]\n\nx')))
    expect(response.status).toBe(400)
    const sig = await signAnswer(env, 'a', 'real', ['site:about'], null)
    const ok = await ask(post({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'real', sources: ['site:about'], id: null, sig }, { role: 'user', content: 'b' }] }), deps(scripted('[[in: site:about]]\n\nMore.')))
    expect(ok.status).toBe(200)
  })

  it('turns people away at the hourly limit, the budget, and when it is off', async () => {
    const store = new MemoryAskStore()
    const d = deps(scripted('[[in: site:about]]\n\nx'), store)
    for (let i = 0; i < 30; i++) await (await ask(post({ messages: [{ role: 'user', content: 'q' }] }), d)).text()
    const limited = await ask(post({ messages: [{ role: 'user', content: 'q' }] }), d)
    expect(limited.status).toBe(429)
    expect(((await limited.json()) as { error: string }).error).toBe('busy')
    expect((await ask(post({ messages: [{ role: 'user', content: 'q' }] }, '198.51.100.1'), d)).status).toBe(200)

    const broke = new MemoryAskStore()
    await broke.recordUsage('2026-10-01', 'answered', { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, 25_000_000, 0, 0)
    const over = await ask(post({ messages: [{ role: 'user', content: 'q' }] }), deps(scripted('x'), broke))
    expect(over.status).toBe(503)
    expect(((await over.json()) as { error: string }).error).toBe('budget')
    expect(broke.rows.find((row) => row.outcome === 'limited')).toBeTruthy()

    const off = await ask(post({ messages: [{ role: 'user', content: 'q' }] }), { ...deps(scripted('x')), env: { HASH_SALT: 'salt' } as Env })
    expect(off.status).toBe(503)
    expect(((await off.json()) as { error: string }).error).toBe('unavailable')
  })

  it('counts votes on its own answers only, and keeps not-helpful ones to look at', async () => {
    const store = new MemoryAskStore()
    const sig = await signAnswer(env, 'q', 'a', ['site:about'], null)
    const vote = (body: unknown) => feedback(post(body), { env, store, now: () => now })
    expect((await vote({ helpful: true, question: 'q', answer: 'a', sources: ['site:about'], id: null, sig })).status).toBe(200)
    expect((await vote({ helpful: false, question: 'q', answer: 'a', sources: ['site:about'], id: null, sig, page: 'home' })).status).toBe(200)
    expect((await vote({ helpful: false, question: 'q', answer: 'tampered', sources: ['site:about'], id: null, sig })).status).toBe(400)
    expect((await vote({ question: 'q' })).status).toBe(400)
    expect(store.voteRows).toEqual([{ day: '2026-10-17', helpful: 1, unhelpful: 1 }])
    expect(store.saved).toEqual([expect.objectContaining({ reason: 'unhelpful', question: 'q', answer: 'a', page: 'home' })])
  })
})
