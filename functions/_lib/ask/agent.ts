// "Ask about Steven": POST /api/ask streams an answer from Claude as Server-Sent
// Events (meta, delta…, done); POST /api/ask/feedback records a vote. Built the
// way the help assistant on wilssens.com is: the assistant knows only the
// system prompt in prompt.ts (cached for an hour), every reply starts with a
// hidden line that says whether it was in scope and which sections it used,
// off-topic questions get our own fixed answer, and in-scope questions the
// dossier could not answer are saved so Steven can fill the gap in an MCP
// session. A user turn marked `kind: 'fit'` is a pasted job description: the
// model compares it with the dossier (covered, partly covered, not shown, what
// to ask) and the requirements it could not match are saved the same way, as
// questions for Steven. Limits: 30 questions an hour per IP, short questions and
// history, a monthly budget from the API's own token counts, and a Turnstile
// human check that only switches on when the assistant looks under attack (many
// questions from one connection or from everyone in the last hour) or the day's
// spend has passed a threshold; a quiet day asks nobody to prove anything. Answers carry our signature so the browser can send the
// conversation back and vote on them without being able to forge an earlier answer.
import Anthropic from '@anthropic-ai/sdk'
import type { Env } from '../env'
import type { DossierStore } from '../mcp/store'
import { contact, jdPrefix, loadArticles, sources as allSources, systemPrompt, type Articles, type Source } from './prompt'
import { dayOf, monthStart, type AskStore, type Outcome, type Usage } from './store'
import { optedOut, visitorHash } from '../visitor'
import { PRICES } from '../prices'

export const MODEL = 'claude-opus-5-5'
/** Micro-dollars per token, from the one price table (functions/_lib/prices.ts); the prompt is cached with a 1-hour lifetime. */
const table = PRICES[MODEL]
export const PRICE = { input: table.input / 1_000_000, output: table.output / 1_000_000, cacheRead: table.cacheRead / 1_000_000, cacheWrite: table.cacheWrite1h / 1_000_000 }
export const DEFAULT_BUDGET_USD = 25
const PER_IP_PER_HOUR = 30
/** The human check switches on for the rest of the day once the day's spend passes this (ASK_CHECK_AFTER_USD)… */
export const DEFAULT_CHECK_AFTER_USD = 10
/** …or for the next hour when one connection asked this often… */
export const CHECK_AFTER_IP_HITS = 10
/** …or when everyone together asked this often: more than a quiet site sees, so likely a script. */
export const CHECK_AFTER_ALL_HITS = 60
const MAX_QUESTION = 1000
/** A pasted job description: long enough for a full posting, short enough to keep the cost of one check near a few cents. */
export const MAX_JD = 8000
const MAX_ANSWER = 6000
const MAX_TURNS = 12
const MAX_HISTORY_CHARS = 30_000
const MAX_TOKENS = 1500
const MAX_TOKENS_FIT = 2200
const MAX_SOURCES = 3
const MAX_SOURCES_FIT = 6
const MAX_FIT_GAPS = 8
const KEEP_MS = 90 * 86_400_000

export const words = {
  offTopic: "I can only answer questions about Steven's work: his roles, results, leadership, patents, projects and how to reach him. Ask me one of those, or email him at steven@wilssens.com.",
  notAPosting: "That does not read like a job description. Paste the posting itself (the role, the requirements, the responsibilities) and I'll compare it with Steven's record.",
  failed: 'Something went wrong on my side. Please try again, or email Steven at steven@wilssens.com.',
  tooLong: 'That question is too long for me. Could you shorten it?',
  longConversation: 'This conversation has grown too long for me. Start a new one with the + button and ask again.',
  busy: 'Too many questions from this connection in the last hour. Please try again later, or email steven@wilssens.com.',
  budget: "The assistant has reached this month's budget. You can still read everything on the site, or email Steven at steven@wilssens.com.",
  human: 'I could not confirm you are a person, so I did not answer. Please send your question again, or email Steven at steven@wilssens.com.',
  unavailable: 'The assistant is not available right now.',
}

export type Turn = { role: 'user'; content: string; kind?: 'fit' } | { role: 'assistant'; content: string; sources: string[]; id: number | null; sig: string }
export type AskBody = { messages: Turn[]; page: string; turnstileToken: string }

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')
const sourceIds = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && /^(role|site):[a-z0-9-]{1,40}$|^notes$/.test(id)).slice(0, MAX_SOURCES_FIT) : [])

/** The panel sends only the newest turns within MAX_TURNS and MAX_HISTORY_CHARS, so `longConversation` is a guard against other clients. */
export function parseBody(raw: unknown): AskBody | 'tooLong' | 'longConversation' | 'failed' {
  const body = (raw ?? {}) as Record<string, unknown>
  if (!Array.isArray(body.messages) || !body.messages.length) return 'tooLong'
  if (body.messages.length > MAX_TURNS) return 'longConversation'
  const messages: Turn[] = []
  let total = 0
  for (const [index, raw] of (body.messages as unknown[]).entries()) {
    const turn = (raw ?? {}) as Record<string, unknown>
    const role = index % 2 === 0 ? 'user' : 'assistant'
    if (turn.role !== role || typeof turn.content !== 'string') return 'failed'
    const content = turn.content.trim()
    const fit = role === 'user' && turn.kind === 'fit'
    if (!content || content.length > (role === 'assistant' ? MAX_ANSWER : fit ? MAX_JD : MAX_QUESTION)) return 'tooLong'
    total += content.length
    if (role === 'user') messages.push(fit ? { role, content, kind: 'fit' } : { role, content })
    else messages.push({ role, content, sources: sourceIds(turn.sources), id: Number.isInteger(turn.id) && (turn.id as number) > 0 ? turn.id as number : null, sig: str(turn.sig, 100) })
  }
  if (messages[messages.length - 1].role !== 'user') return 'tooLong'
  if (total > MAX_HISTORY_CHARS) return 'longConversation'
  const page = str(body.page, 40)
  return { messages, page: /^[a-z0-9-]{1,40}$/.test(page) ? page : 'home', turnstileToken: str(body.turnstileToken, 2048) }
}

// ---------------------------------------------------------------- signatures

const keyFor = (env: Env) => crypto.subtle.importKey('raw', new TextEncoder().encode(`ask-answer|${env.HASH_SALT ?? 'local'}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])

export async function signAnswer(env: Env, question: string, answer: string, sources: string[], id: number | null) {
  const data = JSON.stringify([question.trim(), answer.slice(0, MAX_ANSWER).trim(), sources, id])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await keyFor(env), new TextEncoder().encode(data)))
  return btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function answerIsOurs(env: Env, question: string, answer: { content: string; sources: string[]; id: number | null; sig: string }) {
  if (!answer.sig) return false
  const expected = await signAnswer(env, question, answer.content, answer.sources, answer.id)
  if (expected.length !== answer.sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ answer.sig.charCodeAt(i)
  return diff === 0
}

const historyIsOurs = async (env: Env, messages: Turn[]) => {
  for (let i = 1; i < messages.length; i += 2) {
    const answer = messages[i]
    if (answer.role !== 'assistant' || !(await answerIsOurs(env, messages[i - 1].content, answer))) return false
  }
  return true
}

/** What is saved for /admin: no email addresses, phone or card numbers, keys or tokens. */
export const redact = (text: string) => text
  .replace(/[^\s@<>()"']+@[^\s@<>()"']+\.[a-z]{2,}/gi, '[email]')
  .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [key]')
  .replace(/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, '[key]')
  .replace(/\b(?:github_pat_|gh[opsur]_|sk[-_]|xox[a-z]-)[A-Za-z0-9_-]{8,}/g, '[key]')
  .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[key]')
  .replace(/\bAIza[A-Za-z0-9_-]{30,}/g, '[key]')
  .replace(/\b(?:rk|pk|whsec)_(?:live|test)?_?[A-Za-z0-9]{10,}/g, '[key]')
  .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number]')

/** A job description is not kept; what /admin shows for a vote on a fit check is its size and its first words. */
export const describeQuestion = (question: string) => question.length > MAX_QUESTION ? `Job description (${question.length} characters): ${redact(question).slice(0, 240).trim()}…` : redact(question)

export const ipHash = async (request: Request, env: Env) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${request.headers.get('CF-Connecting-IP') ?? 'unknown'}|${env.HASH_SALT ?? ''}`))
  return [...new Uint8Array(digest).slice(0, 16)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const costMicro = (u: Usage) => Math.round(u.input * PRICE.input + u.output * PRICE.output + u.cacheRead * PRICE.cacheRead + u.cacheWrite * PRICE.cacheWrite)
export const budgetMicro = (env: Env) => Math.round((Number(env.ASK_BUDGET_USD) || DEFAULT_BUDGET_USD) * 1_000_000)
export const checkAfterMicro = (env: Env) => Math.round((Number(env.ASK_CHECK_AFTER_USD) || DEFAULT_CHECK_AFTER_USD) * 1_000_000)

/**
 * The human check: `off` without Turnstile keys, `standby` on a quiet day (nobody is
 * asked anything), `on` when the last hour or the day's spend says a script may be at work.
 * `why` names the signal for /admin.
 */
export type HumanCheck = { state: 'off' | 'standby' | 'on'; why: 'spend' | 'connection' | 'everyone' | null; ipHits: number; allHits: number; spentTodayMicro: number }
export async function humanCheck(env: Env, store: AskStore, now: number, ipHash: string | null): Promise<HumanCheck> {
  const hour = now - 3_600_000
  const [ipHits, allHits, spentTodayMicro] = await Promise.all([ipHash ? store.countHits(ipHash, hour) : Promise.resolve(0), store.countAllHits(hour), store.spentMicroSince(dayOf(now))])
  const why = spentTodayMicro >= checkAfterMicro(env) ? 'spend' : ipHits >= CHECK_AFTER_IP_HITS ? 'connection' : allHits >= CHECK_AFTER_ALL_HITS ? 'everyone' : null
  const keys = Boolean(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY)
  return { state: !keys ? 'off' : why ? 'on' : 'standby', why: keys ? why : null, ipHits, allHits, spentTodayMicro }
}

// ------------------------------------------------------------------ the model

export const HEADER = /^\s*\[\[\s*(in|out)\s*(?::\s*([^\]]*))?\]\]\s*/

/** The requirements a fit check filed under "Not shown on the site": each one becomes a question for Steven. */
export const missingRequirements = (answer: string): string[] => {
  const lines = answer.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((line) => /^\s*\*\*\s*not shown/i.test(line))
  if (start < 0) return []
  const found: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^\s*\*\*/.test(line)) break
    const match = /^\s*[-*•]\s+(.*\S)\s*$/.exec(line)
    if (!match) continue
    const text = match[1].replace(/\*\*/g, '').replace(/\s*[:.]\s*$/, '').trim()
    if (!text || /^none\b/i.test(text)) continue
    found.push(text.slice(0, 300))
  }
  return found.slice(0, MAX_FIT_GAPS)
}

// What the agent needs from a stream: text deltas, then the final message's usage and stop reason.
export type AnswerStream = { [Symbol.asyncIterator](): AsyncIterator<{ type: string; delta?: { type: string; text?: string } }>; finalMessage(): Promise<{ stop_reason: string | null; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } } | null>; abort(): void }
export type StreamOptions = { maxTokens: number }
export type StreamFactory = (system: string, context: string, messages: Anthropic.Beta.BetaMessageParam[], options: StreamOptions) => AnswerStream

// How the live assistant asks the model, besides the model, the prompt and the answer budget. The CI
// assistant check (functions/_lib/assistant-input.ts, scripts/assistant-check.mjs) asks the same way.
export const liveRequest = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', thinking: { type: 'adaptive' }, output_config: { effort: 'low' } } as const
export const answerTokens = { question: MAX_TOKENS, fit: MAX_TOKENS_FIT }
export const answerSources = { question: MAX_SOURCES, fit: MAX_SOURCES_FIT }

const claudeStream = (env: Env): StreamFactory => (system, context, messages, options) => {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, defaultHeaders: env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': env.ANTHROPIC_WORKSPACE_ID } : undefined })
  return client.beta.messages.stream({
    model: MODEL,
    max_tokens: options.maxTokens,
    betas: [...liveRequest.betas],
    fallbacks: liveRequest.fallbacks,
    thinking: liveRequest.thinking,
    output_config: liveRequest.output_config,
    system: [
      { type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } },
      { type: 'text', text: context },
    ],
    messages,
  }) as unknown as AnswerStream
}

/** ASK_MOCK=1 (local only): a canned answer streamed in pieces, no API call. */
export const mockStream: StreamFactory = (_system, _context, messages) => {
  const last = messages[messages.length - 1]
  const question = typeof last.content === 'string' ? last.content : ''
  const text = /\b(weather|recipe|poem|homework)\b/i.test(question)
    ? '[[out]]'
    : question.startsWith(jdPrefix)
      ? `[[in: role:windows-devices-data, role:csx-data, site:recommendations]]

**Covered**
- Led a product management organization: Steven led 10 to 20 product managers as Principal Group Product Manager, Windows & Devices Data.
- Experimentation at scale: he scaled experimentation adoption across Windows (Windows & Devices Data role).
**Partly covered**
- Owned a P&L: the dossier shows a multi-million-dollar infrastructure budget, not a revenue line.
**Not shown on the site**
- Hands-on SQL and Python
- Consumer subscription products
**Ask Steven**
1. How large was the budget he owned, and what did he cut and reinvest?
2. Which parts of the analytics work did he do hands-on?

The record covers the leadership and experimentation asks well; the hands-on and consumer-subscription asks are open.`
      : `[[in: role:windows-devices-data, site:recommendations]]

Steven most recently led the **Windows & Devices Data** PM team at Microsoft (Dec 2024 to Sep 2026): the data, insights, experimentation and ML products that Windows engineers and PMs use to decide what ships, built on telemetry from more than 1.6 billion devices.

- He owned the strategy and roadmap for the data platform and insights products.
- Several recommendations come from people who reported to him for years; see [Recommendations](https://steven.wilssens.com/recommendations).

For the full timeline, the [résumé PDF](https://steven.wilssens.com/steven-wilssens-resume-2026.pdf) has every role.`
  const pieces = text.match(/[\s\S]{1,10}/g) ?? []
  let aborted = false
  return {
    abort: () => { aborted = true },
    async *[Symbol.asyncIterator]() {
      for (const piece of pieces) {
        if (aborted) return
        await new Promise((resolve) => setTimeout(resolve, 25))
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: piece } }
      }
    },
    finalMessage: async () => ({ stop_reason: 'end_turn', usage: { input_tokens: 300, output_tokens: 140, cache_read_input_tokens: 9000, cache_creation_input_tokens: 0 } }),
  }
}

const sse = (event: string, data: unknown) => new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

const verifyTurnstile = async (secret: string, token: string, ip: string | null, host: string) => {
  if (!token) return false
  const form = new FormData()
  form.set('secret', secret)
  form.set('response', token)
  if (ip) form.set('remoteip', ip)
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form }).catch(() => null)
  const result = (await response?.json().catch(() => null)) as { success?: boolean; hostname?: string; 'error-codes'?: string[] } | null
  const ok = Boolean(result?.success) && (!result?.hostname || result.hostname === host)
  if (!ok) console.warn('turnstile', JSON.stringify({ codes: result?.['error-codes'] ?? null, hostname: result?.hostname ?? null, host }))
  return ok
}

/** `pages` reads one of the site's own static files by path (the Markdown copies of the Building write-ups); without it the assistant knows the write-ups only from the projects section. */
export type AskDeps = { env: Env; store: AskStore; dossier: DossierStore; waitUntil: (promise: Promise<unknown>) => void; pages?: (path: string) => Promise<string | null>; stream?: StreamFactory; now?: () => number }

/** The second system block: the page the reader is on, and for a pasted job description the fit-check format. The CI assistant check (functions/_lib/assistant-input.ts) sends the same. */
export const contextFor = (page: string, fit: boolean) => `The reader is on the ${page === 'home' ? 'home' : page} page of steven.wilssens.com.${fit ? ' The last message is a job description pasted for a fit check: follow the fit-check format.' : ''}`

// The write-ups change only with a deploy, which starts new isolates, so one read per isolate is enough.
let articleCache: Promise<Articles> | null = null
const articles = (pages: AskDeps['pages']): Promise<Articles> => {
  if (!pages) return Promise.resolve({})
  articleCache ??= loadArticles(pages).then((loaded) => {
    if (Object.keys(loaded).length < 3) articleCache = null // a page did not load: read again next time
    return loaded
  })
  return articleCache
}

/** GET /api/ask: whether the assistant is on, and the Turnstile site key while the human check is on (null on a quiet day; a later answer can still hand it over). */
export async function askStatus(request: Request, env: Env, store: AskStore, now = Date.now()) {
  const ready = Boolean(env.ANTHROPIC_API_KEY) || env.ASK_MOCK === '1'
  const check = ready && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY ? await humanCheck(env, store, now, await ipHash(request, env)) : null
  return json({ ready, siteKey: check?.state === 'on' ? env.TURNSTILE_SITE_KEY : null }, 200)
}

/** POST /api/ask: the answer as Server-Sent Events, or a JSON error { error, message }. */
export async function ask(request: Request, { env, store, dossier, waitUntil, pages, stream, now = Date.now }: AskDeps): Promise<Response> {
  const fail = (error: keyof typeof words, status: number) => json({ error, message: words[error] }, status)
  if (!env.ANTHROPIC_API_KEY && env.ASK_MOCK !== '1') return fail('unavailable', 503)
  const parsed = parseBody(await request.json().catch(() => null))
  if (typeof parsed === 'string') return fail(parsed, 400)
  if (!(await historyIsOurs(env, parsed.messages))) return fail('failed', 400)

  const started = now()
  const day = dayOf(started)
  const turnedAway = async (error: 'busy' | 'budget' | 'human', status: number, extra: Record<string, unknown> = {}) => {
    await store.recordUsage(day, 'limited', { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, 0, 0, 0).catch((err: unknown) => console.error('ask usage', err))
    return json({ error, message: words[error], ...extra }, status)
  }
  const hash = await ipHash(request, env)
  const check = await humanCheck(env, store, started, hash)
  if (check.ipHits >= PER_IP_PER_HOUR) return turnedAway('busy', 429)
  // The check is on: the token must verify. The answer carries the site key so a panel
  // that opened on a quiet day can bring up the widget now and send the question again.
  if (check.state === 'on' && !(await verifyTurnstile(env.TURNSTILE_SECRET_KEY!, parsed.turnstileToken, request.headers.get('CF-Connecting-IP'), new URL(request.url).host))) return turnedAway('human', 403, { siteKey: env.TURNSTILE_SITE_KEY })
  await store.addHit(hash, started)
  if (await store.spentMicroSince(monthStart(started)) >= budgetMicro(env)) return turnedAway('budget', 503)

  const titles = allSources()
  const [entries, writeUps] = await Promise.all([dossier.list({ visibility: 'public' }), articles(pages)])
  const system = systemPrompt(entries, writeUps)
  const last = parsed.messages[parsed.messages.length - 1] as Extract<Turn, { role: 'user' }>
  const fit = last.kind === 'fit'
  const context = contextFor(parsed.page, fit)
  const messages: Anthropic.Beta.BetaMessageParam[] = parsed.messages.map((turn) => turn.role === 'assistant'
    ? { role: 'assistant', content: `[[in: ${turn.sources.length ? turn.sources.join(', ') : 'none'}]]\n\n${turn.content}` }
    : { role: 'user', content: turn.kind === 'fit' ? `${jdPrefix}\n\n${turn.content}` : turn.content })
  const question = last.content
  const cf = ((request as Request & { cf?: IncomingRequestCfProperties }).cf ?? {}) as Partial<IncomingRequestCfProperties>
  const where = { page: parsed.page, country: (cf.country as string | undefined) ?? null, asOrg: (cf.asOrganization as string | undefined) ?? null }
  // Who asked what, for /admin: the analytics' visitor code for the day, so people are counted
  // like visitors. Not on preview deployments (they share the database) or when the browser opted out.
  // Under GPC or DNT nothing about the visitor is kept, not even an unanswered question (as /privacy says).
  const optOut = optedOut(request)
  // Without HASH_SALT the code would be a plain hash of the IP address, so nothing is logged.
  const visitor = optOut || !env.HASH_SALT || new URL(request.url).hostname.endsWith('.pages.dev') ? null
    : await visitorHash(env.HASH_SALT, day, request.headers.get('CF-Connecting-IP') ?? '', request.headers.get('User-Agent') ?? '')
  const logAs = async (outcome: Outcome, answer: string) => {
    if (!visitor) return
    const asked = fit ? `Job description (${question.length} characters): ${redact(question).slice(0, 240).trim()}…` : redact(question).slice(0, MAX_QUESTION)
    await store.logQuestion({ ts: started, visitor, kind: fit ? 'fit' : 'question', question: asked, answer: answer ? redact(answer).slice(0, MAX_ANSWER) : null, outcome, ...where }, KEEP_MS).catch((err: unknown) => console.error('ask log', err))
  }
  const makeStream = stream ?? (env.ASK_MOCK === '1' ? mockStream : claudeStream(env))
  const maxSources = fit ? MAX_SOURCES_FIT : MAX_SOURCES

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const send = (event: string, data: unknown) => writer.write(sse(event, data)).catch(() => {})

  const run = async () => {
    const state = { decided: false, scope: 'in' as 'in' | 'out', sources: [] as Source[], head: '', answer: '', failed: false }
    let firstAt = 0
    let usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
    const decide = async () => {
      state.decided = true
      const match = HEADER.exec(state.head)
      if (match) {
        state.scope = match[1] === 'out' ? 'out' : 'in'
        state.sources = (match[2] ?? '').split(',').map((id) => id.trim()).filter((id) => titles.has(id)).slice(0, maxSources).map((id) => titles.get(id)!)
      }
      if (state.scope === 'out') return
      await send('meta', { scope: 'in', sources: state.sources })
      const rest = match ? state.head.slice(match[0].length) : state.head.trimStart()
      if (rest) { firstAt ||= now(); state.answer += rest; await send('delta', { text: rest }) }
    }
    try {
      const answerStream = makeStream(system, context, messages, { maxTokens: fit ? MAX_TOKENS_FIT : MAX_TOKENS })
      for await (const event of answerStream) {
        if (event.type !== 'content_block_delta' || event.delta?.type !== 'text_delta' || typeof event.delta.text !== 'string') continue
        if (state.decided) {
          const text = state.answer ? event.delta.text : event.delta.text.trimStart()
          if (!text) continue
          firstAt ||= now()
          state.answer += text
          await send('delta', { text })
          continue
        }
        state.head += event.delta.text
        if (!state.head.includes('\n') && state.head.length < (fit ? 400 : 200)) continue
        await decide()
        if (state.scope === 'out') { answerStream.abort(); break }
      }
      const final = await answerStream.finalMessage().catch(() => null)
      if (final) usage = { input: final.usage.input_tokens, output: final.usage.output_tokens, cacheRead: final.usage.cache_read_input_tokens ?? 0, cacheWrite: final.usage.cache_creation_input_tokens ?? 0 }
      if (!state.decided) await decide()
      // A declined request (safety classifiers) gets the same answer as an off-topic one.
      if (final?.stop_reason === 'refusal' && !state.answer.trim()) state.scope = 'out'
      if (state.scope === 'out') {
        state.answer = fit ? words.notAPosting : words.offTopic
        await send('meta', { scope: 'out', sources: [] })
        await send('delta', { text: state.answer })
      }
      let id: number | null = null
      if (optOut) {
        // Nothing kept: the answer is not saved as a question for Steven either.
      } else if (state.scope === 'in' && fit) {
        // The requirements the record does not show are the questions Steven should answer next; the posting itself is not kept.
        for (const requirement of missingRequirements(state.answer)) await store.saveQuestion({ ts: started, reason: 'fit', question: requirement, answer: null, ...where }, KEEP_MS).catch(() => null)
      } else if (state.scope === 'in' && !state.sources.length && state.answer.trim()) {
        id = await store.saveQuestion({ ts: started, reason: 'gap', question: redact(question).slice(0, MAX_QUESTION), answer: redact(state.answer).slice(0, MAX_ANSWER), ...where }, KEEP_MS).catch(() => null)
      }
      const ids = state.scope === 'in' ? state.sources.map((source) => source.id) : []
      const sig = await signAnswer(env, question, state.answer, ids, id)
      await send('done', { id, sig, scope: state.scope, sources: ids })
    } catch (err) {
      console.error('ask', err)
      state.failed = true
      await send('error', { message: words.failed })
    } finally {
      const outcome: Outcome = state.failed ? 'failed' : state.scope === 'out' ? 'off' : state.sources.length ? 'answered' : 'gap'
      const done = now()
      await store.recordUsage(day, outcome, usage, costMicro(usage), (firstAt || done) - started, done - started).catch((err: unknown) => console.error('ask usage', err))
      await logAs(outcome, state.failed ? '' : state.answer)
      await writer.close().catch(() => {})
    }
  }
  waitUntil(run())
  return new Response(readable, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } })
}

/** POST /api/ask/feedback { helpful, question, answer, sources, id, sig, page }: a vote on one of our answers. */
export async function feedback(request: Request, { env, store, now = Date.now }: Pick<AskDeps, 'env' | 'store' | 'now'>): Promise<Response> {
  const hash = await ipHash(request, env)
  const started = now()
  if (await store.countHits(`${hash}:vote`, started - 3_600_000) >= 40) return json({ ok: false }, 429)
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  if (typeof body.helpful !== 'boolean') return json({ ok: false }, 400)
  const question = str(body.question, MAX_JD).trim()
  const answer = str(body.answer, MAX_ANSWER).trim()
  const sources = sourceIds(body.sources)
  const id = Number.isInteger(body.id) && (body.id as number) > 0 ? body.id as number : null
  if (!question || !answer || !(await answerIsOurs(env, question, { content: answer, sources, id, sig: str(body.sig, 100) }))) return json({ ok: false }, 400)
  await store.addHit(`${hash}:vote`, started)
  await store.recordVote(dayOf(started), body.helpful)
  if (!body.helpful && id === null && !optedOut(request)) {
    const page = str(body.page, 40)
    await store.saveQuestion({ ts: started, reason: 'unhelpful', page: /^[a-z0-9-]{1,40}$/.test(page) ? page : null, question: describeQuestion(question), answer: redact(answer), country: null, asOrg: null }, KEEP_MS)
  }
  return json({ ok: true })
}

export { contact }
