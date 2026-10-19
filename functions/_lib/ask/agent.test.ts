import { describe, expect, it } from 'vitest'
import type { Env } from '../env'
import { MemoryStore } from '../mcp/store'
import { answerIsOurs, ask, askStatus, CHECK_AFTER_ALL_HITS, CHECK_AFTER_IP_HITS, costMicro, feedback, HEADER, humanCheck, ipHash, MAX_JD, missingRequirements, parseBody, redact, signAnswer, words, type StreamFactory } from './agent'
import { articlePages, articleText, dossierText, loadArticles, sources, systemPrompt } from './prompt'
import { dayOf, MemoryAskStore } from './store'

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
    expect(Object.keys(articles).sort()).toEqual(['site:article', 'site:building', 'site:juniortrackcycling', 'site:leo'])
    const prompt = systemPrompt([], articles)
    expect(prompt).toContain("# [site:building] Building steven.wilssens.com, his write-up in full (page https://steven.wilssens.com/building-this-site)")
    expect(prompt).toContain('Body of /building-this-site.md')
    expect(prompt).toContain('# [site:juniortrackcycling] Building juniortrackcycling.com, his write-up in full (page https://steven.wilssens.com/building-juniortrackcycling)')
    expect(prompt).toContain('Body of /building-juniortrackcycling.md')
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
    // Too much history is a different complaint from a long question: the panel never sends it, other clients might.
    const pair = [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a', sources: [], id: null, sig: 's' }]
    expect(parseBody({ messages: [...Array(6).fill(pair).flat(), { role: 'user', content: 'q' }] })).toBe('longConversation')
    expect(parseBody({ messages: [...Array(5).fill(pair).flat(), { role: 'user', content: 'q' }] })).toMatchObject({ page: 'home' })
    const heavy = [{ role: 'user', content: 'x'.repeat(8000), kind: 'fit' }, { role: 'assistant', content: 'y'.repeat(6000), sources: [], id: null, sig: 's' }]
    expect(parseBody({ messages: [...Array(3).fill(heavy).flat(), { role: 'user', content: 'q' }] })).toBe('longConversation')
    expect(words.longConversation).toContain('+ button')
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
    expect(redact('github_pat_11ABCDEFG0123456789_abcdefghij and ghp_abcdefghijklmnop and sk-ant-api03-abcdefgh')).toBe('[key] and [key] and [key]')
    expect(redact('AKIAIOSFODNN7EXAMPLE')).toBe('[key]')
    expect(redact('Authorization: Bearer abc.def-ghi_jkl')).toBe('Authorization: Bearer [key]')
    expect(redact('token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dozjgNryP4J3jVmNHl0w5N')).toBe('token [key]')
    expect(costMicro({ input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe(4_000_000)
    expect(costMicro({ input: 100, output: 50, cacheRead: 10_000, cacheWrite: 0 })).toBe(400 + 1000 + 2000)
    expect(HEADER.exec('[[in: role:csx-data, site:patents]]\n\nHello')?.[2]).toBe('role:csx-data, site:patents')
    expect(HEADER.exec('[[out]]')?.[1]).toBe('out')
  })

  it('reports whether it is on', async () => {
    const status = new Request(url, { headers: { 'CF-Connecting-IP': '203.0.113.9' } })
    expect(await (await askStatus(status, env, new MemoryAskStore(), now)).json()).toEqual({ ready: true, siteKey: null })
    expect(await (await askStatus(status, {} as Env, new MemoryAskStore(), now)).json()).toEqual({ ready: false, siteKey: null })
    // With keys the site key is handed out only while the check is on; a quiet day hands out nothing.
    const keyed = { ASK_MOCK: '1', TURNSTILE_SECRET_KEY: 's', TURNSTILE_SITE_KEY: 'k' } as Env
    const store = new MemoryAskStore()
    expect(await (await askStatus(status, keyed, store, now)).json()).toEqual({ ready: true, siteKey: null })
    for (let i = 0; i < CHECK_AFTER_IP_HITS; i++) await store.addHit(await ipHash(status, keyed), now - 60_000)
    expect(await (await askStatus(status, keyed, store, now)).json()).toEqual({ ready: true, siteKey: 'k' })
  })
})

describe('the human check', () => {
  const keyed = { ...env, TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_SITE_KEY: 'k' } as Env
  const question = { messages: [{ role: 'user', content: 'q' }] }
  // Turnstile's siteverify: `good` passes, anything else fails, and every call is counted.
  const siteverify = () => {
    const calls: string[] = []
    const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      const token = String((init!.body as FormData).get('response'))
      calls.push(token)
      return Response.json(token === 'good' ? { success: true, hostname: 'steven.wilssens.com' } : { success: false, 'error-codes': ['invalid-input-response'] })
    }
    return { calls, fetch }
  }
  const withFetch = async <T,>(fetch: typeof globalThis.fetch, run: () => Promise<T>) => { const real = globalThis.fetch; globalThis.fetch = fetch; try { return await run() } finally { globalThis.fetch = real } }

  it('asks nobody on a quiet day, even without a token', async () => {
    const verify = siteverify()
    const store = new MemoryAskStore()
    const d = { ...deps(scripted('[[in: site:about]]\n\nx'), store), env: keyed }
    const response = await withFetch(verify.fetch as typeof globalThis.fetch, () => ask(post(question), d))
    expect(response.status).toBe(200)
    expect(verify.calls).toEqual([])
    expect(await humanCheck(keyed, store, now, null)).toMatchObject({ state: 'standby', why: null })
  })

  it("switches on once the day's spend passes the threshold, and tells the panel which widget to show", async () => {
    const verify = siteverify()
    const store = new MemoryAskStore()
    await store.recordUsage(dayOf(now), 'answered', { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, 10_000_000, 0, 0)
    const d = { ...deps(scripted('[[in: site:about]]\n\nx'), store), env: keyed }
    const refused = await withFetch(verify.fetch as typeof globalThis.fetch, () => ask(post(question), d))
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: 'human', message: words.human, siteKey: 'k' })
    expect(verify.calls).toEqual([]) // an empty token is not sent to Cloudflare
    expect(store.hits).toHaveLength(0) // a refused question does not count against the hourly limit
    const bad = await withFetch(verify.fetch as typeof globalThis.fetch, () => ask(post({ ...question, turnstileToken: 'stale' }), d))
    expect(bad.status).toBe(403)
    const good = await withFetch(verify.fetch as typeof globalThis.fetch, () => ask(post({ ...question, turnstileToken: 'good' }), d))
    expect(good.status).toBe(200)
    expect(verify.calls).toEqual(['stale', 'good'])
    expect(await humanCheck(keyed, store, now, null)).toMatchObject({ state: 'on', why: 'spend' })
    // A lower threshold in the environment is respected.
    expect((await humanCheck({ ...keyed, ASK_CHECK_AFTER_USD: '50' } as Env, store, now, null)).state).toBe('standby')
  })

  it('switches on when one connection, or everyone together, asks too often in an hour', async () => {
    const store = new MemoryAskStore()
    const hash = await ipHash(post(question), keyed)
    for (let i = 0; i < CHECK_AFTER_IP_HITS; i++) await store.addHit(hash, now - 60_000)
    expect(await humanCheck(keyed, store, now, hash)).toMatchObject({ state: 'on', why: 'connection' })
    expect(await humanCheck(keyed, store, now, 'someone-else')).toMatchObject({ state: 'standby' })
    for (let i = 0; i < CHECK_AFTER_ALL_HITS; i++) await store.addHit(`ip-${i}`, now - 60_000)
    expect(await humanCheck(keyed, store, now, 'someone-else')).toMatchObject({ state: 'on', why: 'everyone' })
    // Last hour only.
    const old = new MemoryAskStore()
    for (let i = 0; i < CHECK_AFTER_ALL_HITS; i++) await old.addHit(`ip-${i}`, now - 2 * 3_600_000)
    expect((await humanCheck(keyed, old, now, null)).state).toBe('standby')
    // Without keys it is off whatever the traffic.
    expect(await humanCheck(env, store, now, hash)).toMatchObject({ state: 'off', why: null })
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
    const capture: StreamFactory = (system, context, messages, options) => { systems.push(system); return scripted('[[in: site:building]]\n\nThe loop.')(system, context, messages, options) }
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

  it('logs every question with the visitor code of the day, so /admin can count the people who asked', async () => {
    const store = new MemoryAskStore()
    const asked = (content: string, ip: string, headers: Record<string, string> = {}, at = url) => new Request(at, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, 'User-Agent': 'Firefox', ...headers }, body: JSON.stringify({ messages: [{ role: 'user', content }], page: 'experience' }) })
    const run = async (request: Request) => { await (await ask(request, deps(scripted('[[in: site:about]]\n\nHe did.'), store))).text() }
    await run(asked('What did he ship? Mail bob@corp.com', '203.0.113.9'))
    await run(asked('And before that?', '203.0.113.9'))
    await run(asked('Where is he based?', '198.51.100.7'))
    expect(store.entries).toHaveLength(3)
    expect(store.entries[0]).toMatchObject({ kind: 'question', page: 'experience', question: 'What did he ship? Mail [email]', answer: 'He did.', outcome: 'answered' })
    expect(store.entries[0].visitor).toMatch(/^[0-9a-f]{16}$/)
    expect(store.entries[1].visitor).toBe(store.entries[0].visitor)
    expect(store.entries[2].visitor).not.toBe(store.entries[0].visitor)
    // Nothing is logged for a browser that opted out, or on a preview deployment.
    await run(asked('q', '192.0.2.1', { 'Sec-GPC': '1' }))
    await run(asked('q', '192.0.2.1', { DNT: '1' }))
    await run(asked('q', '192.0.2.1', {}, 'https://branch.stevenwilssens.pages.dev/api/ask'))
    expect(store.entries).toHaveLength(3)
    expect(store.rows[0]).toMatchObject({ questions: 6 })
  })

  it('still answers when the log cannot be written', async () => {
    const store = new MemoryAskStore()
    store.logQuestion = async () => { throw new Error('D1_ERROR: no such table: ask_log') }
    const list = await events(await ask(post({ messages: [{ role: 'user', content: 'What did he ship?' }] }), deps(scripted('[[in: site:about]]\n\nHe did.'), store)))
    expect(answerOf(list)).toBe('He did.')
    expect(list[list.length - 1]).toMatchObject({ event: 'done', data: { scope: 'in' } })
    expect(store.rows[0]).toMatchObject({ outcome: 'answered' })
  })

  it('keeps no unanswered question and no voted-down answer under Global Privacy Control', async () => {
    const store = new MemoryAskStore()
    const request = new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', 'Sec-GPC': '1' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'How many people did he hire?' }] }) })
    const list = await events(await ask(request, deps(scripted('[[in: none]]\n\nNot shared here.'), store)))
    const done = list[list.length - 1]
    expect(done.data.id).toBeNull()
    expect(store.saved).toEqual([])
    expect(store.entries).toEqual([])
    expect(store.rows[0]).toMatchObject({ outcome: 'gap' })
    const vote = new Request(`${url}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', DNT: '1' }, body: JSON.stringify({ helpful: false, question: 'How many people did he hire?', answer: answerOf(list), sources: [], id: null, sig: done.data.sig, page: 'home' }) })
    expect(await (await feedback(vote, { env, store, now: () => now })).json()).toEqual({ ok: true })
    expect(store.voteRows).toEqual([{ day: dayOf(now), helpful: 0, unhelpful: 1 }])
    expect(store.saved).toEqual([])
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

describe('the fit check', () => {
  const posting = 'Director of Product Management, Data Platform\n\nRequirements:\n- Led a product management organization\n- Experimentation at scale\n- Hands-on SQL and Python\n- Consumer subscription products'

  it('accepts a long job description only when the turn says it is one', () => {
    const long = 'x'.repeat(3000)
    expect(parseBody({ messages: [{ role: 'user', content: long }] })).toBe('tooLong')
    expect(parseBody({ messages: [{ role: 'user', content: long, kind: 'fit' }] })).toMatchObject({ messages: [{ role: 'user', content: long, kind: 'fit' }] })
    expect(parseBody({ messages: [{ role: 'user', content: 'x'.repeat(MAX_JD + 1), kind: 'fit' }] })).toBe('tooLong')
    expect(parseBody({ messages: [{ role: 'user', content: 'short', kind: 'nonsense' }] })).toMatchObject({ messages: [{ role: 'user', content: 'short' }] })
  })

  it('compares the posting with the record and saves the requirements it does not show as questions for Steven', async () => {
    const store = new MemoryAskStore()
    const answer = "[[in: role:windows-devices-data, role:csx-data, site:recommendations, site:patents]]\n\n**Covered**\n- Led a product management organization: Steven led 10 to 20 PMs (Windows & Devices Data).\n**Partly covered**\n- None\n**Not shown on the site**\n- Hands-on SQL and Python\n- Consumer subscription products\n**Ask Steven**\n1. Which analytics did he build himself?"
    let seen: { content: unknown }[] = []
    let options: unknown
    const stream: StreamFactory = (system, context, messages, opts) => { seen = messages; options = opts; return scripted(answer)(system, context, messages, opts) }
    const list = await events(await ask(post({ messages: [{ role: 'user', content: posting, kind: 'fit' }], page: 'home' }), deps(stream, store)))
    // Up to six sources on a fit check, the posting is framed for the model, and the answer gets more room.
    expect((list[0].data.sources as unknown[]).length).toBe(4)
    expect(String(seen[0].content)).toMatch(/^Job description to check against Steven's record:\n\nDirector of Product Management/)
    expect(options).toEqual({ maxTokens: 2200 })
    expect(answerOf(list)).toContain('**Not shown on the site**')
    expect(store.saved.map((q) => [q.reason, q.question, q.answer, q.page])).toEqual([['fit', 'Hands-on SQL and Python', null, 'home'], ['fit', 'Consumer subscription products', null, 'home']])
    // The log keeps the size and the first words of the posting, not the posting.
    expect(store.entries[0]).toMatchObject({ kind: 'fit', outcome: 'answered' })
    expect(store.entries[0].question).toMatch(/^Job description \(\d+ characters\): Director of Product Management/)
    expect(store.entries[0].question.length).toBeLessThan(320)
    expect(store.rows[0]).toMatchObject({ outcome: 'answered', questions: 1 })
    const done = list[list.length - 1]
    expect(done.data.id).toBeNull()
    expect(await answerIsOurs(env, posting, { content: answerOf(list), sources: done.data.sources as string[], id: null, sig: done.data.sig as string })).toBe(true)
  })

  it('tells the reader when the text is not a posting, and counts a check with no match as a gap', async () => {
    const store = new MemoryAskStore()
    const list = await events(await ask(post({ messages: [{ role: 'user', content: 'Roses are red, violets are blue', kind: 'fit' }] }), deps(scripted('[[out]]'), store)))
    expect(answerOf(list)).toBe(words.notAPosting)
    expect(store.rows[0]).toMatchObject({ outcome: 'off' })
    const none = new MemoryAskStore()
    await events(await ask(post({ messages: [{ role: 'user', content: posting, kind: 'fit' }] }), deps(scripted('[[in: none]]\n\n**Covered**\n- None\n**Partly covered**\n- None\n**Not shown on the site**\n- Everything in the posting\n**Ask Steven**\n1. Anything.'), none)))
    expect(none.rows[0]).toMatchObject({ outcome: 'gap' })
    expect(none.saved.map((q) => q.question)).toEqual(['Everything in the posting'])
  })

  it('reads the requirements under "Not shown on the site" and nothing else', () => {
    expect(missingRequirements('**Covered**\n- A: fact\n**Partly covered**\n- B\n**Not shown on the site**\n- C: detail.\n- **D**\n- None\n**Ask Steven**\n1. Q')).toEqual(['C: detail', 'D'])
    expect(missingRequirements('**Covered**\n- A')).toEqual([])
    expect(missingRequirements('**Not shown on the site**\n- None\n**Ask Steven**\n1. Q')).toEqual([])
    expect(missingRequirements(`**Not shown on the site**\n${Array.from({ length: 12 }, (_, i) => `- Requirement ${i}`).join('\n')}`)).toHaveLength(8)
  })

  it('keeps only the size and the first words of a posting when a fit check is voted down', async () => {
    const store = new MemoryAskStore()
    const long = `${posting}\n${'More requirements. '.repeat(80)}`
    const sig = await signAnswer(env, long, 'a', [], null)
    expect((await feedback(post({ helpful: false, question: long, answer: 'a', sources: [], id: null, sig, page: 'home' }), { env, store, now: () => now })).status).toBe(200)
    expect(store.saved[0].question).toMatch(/^Job description \(\d+ characters\): Director of Product Management, Data Platform/)
    expect(store.saved[0].question.length).toBeLessThan(320)
  })
})

describe('the report card', () => {
  it('sums the whole life of the assistant and counts the gaps Steven closed', async () => {
    const { assistantReport } = await import('./report')
    const store = new MemoryAskStore()
    const dossier = new MemoryStore()
    await store.recordUsage('2026-10-01', 'answered', { input: 100, output: 50, cacheRead: 0, cacheWrite: 0 }, 3000, 800, 2000)
    await store.recordUsage('2026-10-02', 'answered', { input: 100, output: 50, cacheRead: 0, cacheWrite: 0 }, 3000, 1200, 2000)
    await store.recordUsage('2026-10-02', 'gap', { input: 100, output: 50, cacheRead: 0, cacheWrite: 0 }, 2000, 1000, 2000)
    await store.recordUsage('2026-10-03', 'off', { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 }, 100, 0, 100)
    await store.recordUsage('2026-10-03', 'limited', { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, 0, 0, 0)
    await store.recordUsage('2026-10-03', 'failed', { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, 0, 0, 0)
    await store.recordVote('2026-10-02', true)
    await store.recordVote('2026-10-02', false)
    const first = await store.saveQuestion({ ts: now, reason: 'gap', page: 'home', question: 'q1', answer: 'a', country: null, asOrg: null }, 86_400_000)
    await store.saveQuestion({ ts: now, reason: 'fit', page: 'home', question: 'req', answer: null, country: null, asOrg: null }, 86_400_000)
    await store.saveQuestion({ ts: now, reason: 'unhelpful', page: 'home', question: 'q3', answer: 'a', country: null, asOrg: null }, 86_400_000)
    store.saved[first - 1].resolvedAt = now
    store.saved[first - 1].resolution = 'answered'
    await dossier.insert({ role: 'general', topic: 'now', title: 't', body: 'b', visibility: 'public', tags: null }, now)
    await dossier.insert({ role: 'general', topic: 'now', title: 't', body: 'b', visibility: 'private', tags: null }, now)
    const report = await assistantReport(store, dossier, now)
    expect(report).toMatchObject({ since: '2026-10-01', questions: 4, answered: 2, gaps: 1, offTopic: 1, turnedAway: 1, gapsCovered: 1, gapsOpen: 1, helpful: 1, unhelpful: 1, costMicro: 8100, costPerAnswerMicro: 2700, msFirstAvg: 1000, publicNotes: 1, generatedAt: now })
    expect(await store.questions(0, 10)).toHaveLength(2)
    expect(await store.resolvedCounts(0)).toEqual({ answered: 1, dismissed: 0 })
  })
})
