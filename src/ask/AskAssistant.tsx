// "Ask about Steven": a floating button on every page and a panel with the
// conversation, answered by functions/_lib/ask (Claude, over Steven's own notes).
// The panel docks beside the page on wide screens (the page moves over), overlays
// it on tablets and is a bottom sheet on phones. Answers stream in, show the
// sections they rest on as links, and take a thumbs up or down. The conversation
// follows the reader from page to page in this tab (sessionStorage) until
// "New conversation", and an open panel opens again on the next page.
//
// A second way in: paste a job description. It is sent as a user turn marked
// `kind: 'fit'`, and the answer comes back in a fixed shape (covered, partly
// covered, not shown on the site, what to ask Steven). Follow-up questions keep
// the posting in the conversation.
//
// Answers are model text: rendered with a small Markdown subset (src/ask/markdown.ts),
// links only to the site, the résumé, LinkedIn, Justia and Steven's email.
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import profileImage from '../assets/profile.jpg'
import { renderMarkdown } from './markdown'
import { pickSuggestions } from './suggestions'
import { waits } from './waits'
import { registerTool } from '../webmcp'
import './ask.css'

export type Source = { id: string; title: string; href: string | null }
export type Turn =
  | { role: 'user'; content: string; kind?: 'fit' }
  | { role: 'assistant'; content: string; sources: Source[]; id: number | null; sig: string; scope: 'in' | 'out'; error?: boolean; vote?: 'up' | 'down' }
type Mode = 'ask' | 'fit'
type Answer = Extract<Turn, { role: 'assistant' }>

const storeKey = 'sw-ask'
const openKey = 'sw-ask-open'
const maxQuestion = 1000
export const maxJobDescription = 8000
const maxTurns = 24
/** What the server accepts with a question (functions/_lib/ask/agent.ts: 12 turns, 30,000 characters): the newest exchanges that fit go with it, the oldest are left behind. */
const sentTurns = 11
const sentChars = 30_000
/** The exchanges to send with a new question: complete question-and-answer pairs (a failed answer and its question are left out), newest first until the server's limits are reached, in order. */
const conversation = (turns: Turn[], asked: Turn): Turn[] => {
  const kept: Turn[] = [asked]
  let chars = asked.content.length
  for (let i = turns.length - 1; i > 0; i--) {
    const answer = turns[i]
    const question = turns[i - 1]
    if (answer.role !== 'assistant' || question.role !== 'user') continue
    i-- // this pair is handled
    if (answer.error || !answer.content) continue
    if (kept.length + 2 > sentTurns || chars + question.content.length + answer.content.length > sentChars) break
    kept.unshift(question, answer)
    chars += question.content.length + answer.content.length
  }
  return kept
}
const tickTheBox = 'Tick the box below and your question goes through.'
export const fitChip = 'Check a job description against his record'

const storage = {
  get: (key: string) => { try { return sessionStorage.getItem(key) } catch { return null } },
  set: (key: string, value: string | null) => { try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value) } catch { /* storage unavailable */ } },
}


const Spark = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z" /><path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" /></svg>
const Close = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
const Plus = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
const Up = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 17.5 20H7" /></svg>
const Down = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 13V4h3v9zM17 13l-4 7c-1.5 0-2.5-1-2.5-2.5V14h-5a2 2 0 0 1-2-2.3l1-6A2 2 0 0 1 6.5 4H17" /></svg>
const CopyIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
const Clipboard = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6M9 11h6M9 15h4" /></svg>

const parseSse = (block: string): { event: string; data: Record<string, unknown> } | null => {
  const event = /^event: (.+)$/m.exec(block)?.[1]
  if (!event) return null
  try { return { event, data: JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? '{}') as Record<string, unknown> } } catch { return null }
}

const formatCount = (n: number) => n.toLocaleString('en-US')

declare global { interface Window { turnstile?: { render: (el: HTMLElement, options: Record<string, unknown>) => string; reset: (id: string) => void } } }

export default function AskAssistant({ page }: { page: string }) {
  const [ready, setReady] = useState(false)
  const [siteKey, setSiteKey] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('ask')
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [docked, setDocked] = useState(false)
  const [phone, setPhone] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const postingRef = useRef<HTMLTextAreaElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileToken = useRef('')
  const turnstileId = useRef('')
  const turnstileWaiters = useRef<((token: string) => void)[]>([])
  const turnstileInteractive = useRef(false) // Cloudflare has put the checkbox in front of the visitor
  const controller = useRef<AbortController | null>(null)
  const pending = useRef('')
  const paint = useRef(0)
  const loaded = useRef(false)
  const sendRef = useRef<(question: string) => Promise<Answer | null>>(async () => null)

  // Mount: is the assistant on, what was said earlier in this tab, and the screen size.
  useEffect(() => {
    fetch('/api/ask').then(async (response) => (response.ok ? response.json() : null)).then((status: { ready?: boolean; siteKey?: string | null } | null) => {
      if (status?.ready) { setReady(true); setSiteKey(status.siteKey ?? null) }
    }).catch(() => {})
    try { const saved = JSON.parse(storage.get(storeKey) ?? '[]') as Turn[]; if (Array.isArray(saved)) setTurns(saved.slice(-maxTurns)) } catch { /* ignore */ }
    loaded.current = true
    setSuggestions(pickSuggestions(page))
    const wide = window.matchMedia?.('(min-width: 1200px)')
    const small = window.matchMedia?.('(max-width: 759px)')
    const layout = () => { setDocked(Boolean(wide?.matches)); setPhone(Boolean(small?.matches)) }
    layout()
    wide?.addEventListener('change', layout)
    small?.addEventListener('change', layout)
    if (storage.get(openKey) === '1' && !small?.matches) setOpen(true)
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ question?: string; fit?: boolean }>).detail ?? {}
      if (detail.question) setDraft(detail.question)
      if (detail.fit) setMode('fit')
      setOpen(true)
    }
    window.addEventListener('sw-ask-open', onOpen)
    return () => { wide?.removeEventListener('change', layout); small?.removeEventListener('change', layout); window.removeEventListener('sw-ask-open', onOpen) }
  }, [page])

  // The page moves over when the panel docks; phones lock the page behind the sheet.
  useEffect(() => {
    document.documentElement.classList.toggle('ask-docked', open && docked)
    document.documentElement.classList.toggle('ask-sheet', open && phone)
    storage.set(openKey, open ? '1' : null)
    if (open && !phone) requestAnimationFrame(() => (mode === 'fit' ? postingRef.current : inputRef.current)?.focus())
    return () => { document.documentElement.classList.remove('ask-docked', 'ask-sheet') }
  }, [open, docked, phone, mode])

  useEffect(() => { if (loaded.current) storage.set(storeKey, JSON.stringify(turns.slice(-maxTurns))) }, [turns])

  // Escape closes; keep the newest words in view while an answer streams.
  useEffect(() => {
    if (!open) return
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); fabRef.current?.focus() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  useEffect(() => {
    const log = logRef.current
    if (!log) return
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 160
    if ((nearBottom || busy) && typeof log.scrollTo === 'function') log.scrollTo({ top: log.scrollHeight, behavior: 'auto' })
  }, [turns, busy])

  // Turnstile, only when the server asks for it: an invisible widget that hands us a token.
  // The first token takes a moment and each one is spent on one question, so a send
  // waits for the token instead of posting without one.
  const gotToken = (token: string) => { turnstileToken.current = token; const waiters = turnstileWaiters.current; turnstileWaiters.current = []; waiters.forEach((resolve) => resolve(token)) }
  const awaitToken = (ms: number) => turnstileToken.current || !turnstileId.current ? Promise.resolve(turnstileToken.current) : new Promise<string>((resolve) => {
    const timer = setTimeout(() => { turnstileWaiters.current = turnstileWaiters.current.filter((waiter) => waiter !== done); resolve('') }, ms)
    const done = (token: string) => { clearTimeout(timer); resolve(token) }
    turnstileWaiters.current.push(done)
  })
  const freshToken = () => { turnstileToken.current = ''; if (turnstileId.current && window.turnstile) window.turnstile.reset(turnstileId.current) }
  // The token for a send: a short wait normally, a long one once the visitor has a box to tick.
  const tokenForSend = async () => {
    let token = await awaitToken(waits.token)
    if (!token && turnstileInteractive.current) { setNotice(tickTheBox); token = await awaitToken(waits.interactive); setNotice('') }
    return token
  }
  // The server asks for the check only when the assistant looks under attack, so the
  // widget comes up when the status says so, or mid-conversation when an answer does.
  const ensureWidget = (key: string) => new Promise<void>((resolve) => {
    const mount = () => {
      if (window.turnstile && turnstileRef.current && !turnstileId.current) turnstileId.current = window.turnstile.render(turnstileRef.current, { sitekey: key, size: 'flexible', appearance: 'interaction-only', callback: gotToken, 'expired-callback': () => { turnstileToken.current = '' }, 'error-callback': () => { turnstileToken.current = '' }, 'timeout-callback': () => { turnstileToken.current = '' }, 'before-interactive-callback': () => { turnstileInteractive.current = true }, 'after-interactive-callback': () => { turnstileInteractive.current = false } })
      resolve()
    }
    if (window.turnstile) return mount()
    const existing = document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile/"]')
    const script = existing ?? Object.assign(document.createElement('script'), { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js', async: true })
    script.addEventListener('load', mount, { once: true })
    script.addEventListener('error', () => resolve(), { once: true })
    if (!existing) document.head.appendChild(script)
  })
  useEffect(() => { if (open && siteKey && !turnstileId.current) void ensureWidget(siteKey) }, [open, siteKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { setOpen(false); fabRef.current?.focus() }
  const reset = () => { controller.current?.abort(); setTurns([]); setNotice(''); setBusy(false); setMode('ask'); inputRef.current?.focus() }

  const flush = useCallback(() => {
    paint.current = 0
    const text = pending.current
    setTurns((current) => {
      const last = current[current.length - 1]
      if (!last || last.role !== 'assistant') return current
      return [...current.slice(0, -1), { ...last, content: text }]
    })
  }, [])

  // A question, or (kind 'fit') a pasted job description. Resolves to the answer once
  // it has streamed in, for the WebMCP tool below; null when busy or empty.
  const send = async (input: string, kind?: 'fit'): Promise<Answer | null> => {
    const text = input.trim().slice(0, kind === 'fit' ? maxJobDescription : maxQuestion)
    if (!text || busy) return null
    setNotice('')
    if (kind === 'fit') { setPosting(''); setMode('ask') } else { setDraft(''); if (inputRef.current) inputRef.current.style.height = '' }
    const history = turns.filter((turn) => turn.role === 'user' || !turn.error)
    const asked: Turn = kind === 'fit' ? { role: 'user', content: text, kind: 'fit' } : { role: 'user', content: text }
    const answer: Turn = { role: 'assistant', content: '', sources: [], id: null, sig: '', scope: 'in' }
    setTurns([...history, asked, answer])
    setBusy(true)
    pending.current = ''
    const abort = new AbortController()
    controller.current = abort
    let failed = ''
    const result = { ...answer }
    const post = async (token: string) => fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abort.signal,
      body: JSON.stringify({
        page,
        turnstileToken: token,
        messages: conversation(history, asked).map((turn) => turn.role === 'user' ? { role: 'user', content: turn.content, ...(turn.kind ? { kind: turn.kind } : {}) } : { role: 'assistant', content: turn.content, sources: turn.sources.map((source) => source.id), id: turn.id, sig: turn.sig }),
      }),
    })
    try {
      let response = await post(await tokenForSend())
      if (response.status === 403) {
        // The check is on and the token was missing, spent or stale: bring up the widget if
        // it is not there yet, or ask it for a new token, and try once more.
        const data = (await response.clone().json().catch(() => ({}))) as { error?: string; siteKey?: string }
        if (data.error === 'human' && (turnstileId.current || data.siteKey)) {
          if (turnstileId.current) freshToken()
          else { setSiteKey(data.siteKey!); await ensureWidget(data.siteKey!) }
          response = await post(await tokenForSend())
        }
      }
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { message?: string }
        failed = data.message ?? 'Something went wrong. Please try again.'
      } else {
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ''
        let done = false
        while (!done) {
          const chunk = await reader.read()
          if (chunk.done) break
          buffer += chunk.value
          let cut: number
          while ((cut = buffer.indexOf('\n\n')) >= 0) {
            const parsed = parseSse(buffer.slice(0, cut))
            buffer = buffer.slice(cut + 2)
            if (!parsed) continue
            const { event, data } = parsed
            if (event === 'meta') { result.scope = data.scope as 'in' | 'out'; result.sources = (data.sources as Source[]) ?? [] }
            else if (event === 'delta') { pending.current += String(data.text ?? ''); if (!paint.current) paint.current = requestAnimationFrame(flush) }
            else if (event === 'done') { result.id = (data.id as number | null) ?? null; result.sig = String(data.sig ?? ''); done = true }
            else if (event === 'error') { failed = String(data.message ?? ''); done = true }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') failed = 'Something went wrong. Please try again.'
    }
    if (paint.current) cancelAnimationFrame(paint.current)
    paint.current = 0
    result.content = pending.current
    if (!result.content && failed) { result.content = failed; result.error = true; result.sources = [] }
    setTurns((current) => {
      const base = current[current.length - 1]?.role === 'assistant' ? current.slice(0, -1) : current
      return result.content ? [...base, result] : base.slice(0, -1)
    })
    controller.current = null
    setBusy(false)
    freshToken() // the token is spent: have the next one ready
    return result
  }

  // WebMCP (src/webmcp.ts): an agent in the visitor's browser asks through this same
  // panel, so the visitor sees the question and the answer, the limits and the
  // human check apply as they do to a typed question, and the vote buttons work.
  useEffect(() => { sendRef.current = send })
  useEffect(() => {
    if (!ready) return
    return registerTool({
      name: 'ask_about_steven',
      description: 'Ask the "Ask about Steven" assistant a question in plain words: his roles, results, leadership, teams, patents, projects, what he is looking for, how to reach him. It answers from what Steven published and says when his notes do not cover something. One question per call; a follow-up continues the conversation. The exchange is shown to the visitor in the panel.',
      inputSchema: { type: 'object', properties: { question: { type: 'string', description: 'The question, under 1000 characters' } }, required: ['question'], additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const question = typeof input.question === 'string' ? input.question.trim() : ''
        if (!question) return 'Give a question to ask.'
        setOpen(true)
        const answer = await sendRef.current(question)
        if (!answer) return 'The assistant is answering another question right now. Ask again in a moment.'
        if (answer.error) return `The assistant could not answer: ${answer.content}`
        return JSON.stringify({
          answer: answer.content,
          scope: answer.scope === 'out' ? 'out of scope: the assistant only answers questions about Steven' : 'in scope',
          sources: answer.sources.map((source) => ({ title: source.title, href: source.href })),
        }, null, 1)
      },
    })
  }, [ready])

  const stop = () => { controller.current?.abort() }
  const submit = (event: FormEvent) => { event.preventDefault(); if (mode === 'fit') void send(posting, 'fit'); else void send(draft) }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft) }
  }
  // In the posting box Enter is a new line; Ctrl+Enter (Cmd+Enter) sends.
  const onPostingKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void send(posting, 'fit') }
  }
  const grow = (element: HTMLTextAreaElement) => { element.style.height = ''; element.style.height = `${Math.min(element.scrollHeight, 160)}px` }
  const startFit = () => { setMode('fit'); setNotice(''); requestAnimationFrame(() => postingRef.current?.focus()) }
  const stopFit = () => { setMode('ask'); requestAnimationFrame(() => inputRef.current?.focus()) }

  const vote = async (index: number, up: boolean) => {
    const answer = turns[index]
    const question = turns[index - 1]
    if (!answer || answer.role !== 'assistant' || !question || answer.error || answer.vote) return
    setTurns((current) => current.map((turn, i) => (i === index && turn.role === 'assistant' ? { ...turn, vote: up ? 'up' : 'down' } : turn)))
    await fetch('/api/ask/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ helpful: up, question: question.content, answer: answer.content, sources: answer.sources.map((source) => source.id), id: answer.id, sig: answer.sig, page }) }).catch(() => {})
  }
  const copy = (index: number, text: string) => { void navigator.clipboard?.writeText(text).then(() => { setCopied(index); setTimeout(() => setCopied(null), 1600) }) }

  const streaming = busy && turns[turns.length - 1]?.role === 'assistant'
  const waiting = streaming && !turns[turns.length - 1]?.content
  const remaining = maxQuestion - draft.length
  const postingLeft = maxJobDescription - posting.length

  return (
    <>
      {ready && (
        <button ref={fabRef} type="button" className={`ask-fab ${open ? 'is-hidden' : ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-controls="ask-panel">
          <Spark /><span>Ask about Steven</span>
        </button>
      )}
      <div className={`ask-backdrop ${open && !docked ? 'is-open' : ''}`} onClick={close} aria-hidden="true" />
      <section id="ask-panel" className={`ask-panel ${open ? 'is-open' : ''}`} role="dialog" aria-modal={open && !docked} aria-labelledby="ask-title" inert={!open}>
        <header className="ask-head">
          <img className="ask-avatar" src={profileImage} alt="" width={40} height={40} />
          <div className="ask-head-text">
            <h2 id="ask-title">Ask about Steven</h2>
            <p>Answers from his own notes. AI, so check what matters.</p>
          </div>
          {turns.length > 0 && <button type="button" className="ask-icon-btn" onClick={reset} title="New conversation" aria-label="New conversation"><Plus /></button>}
          <button type="button" className="ask-icon-btn" onClick={close} title="Close" aria-label="Close"><Close /></button>
        </header>

        <div className="ask-log" ref={logRef} aria-live="polite">
          {turns.length === 0 && (
            <div className="ask-welcome">
              <p className="ask-greeting">Hi. I know Steven's roles, results, patents, recommendations and what he is looking for. Ask me anything, or paste a job description and I'll say what his record covers, what it doesn't, and what to ask him. Your own AI assistant can read the same record through <a href="/mcp">steven.wilssens.com/mcp</a>.</p>
              <div className="ask-chips">
                <button type="button" className="ask-chip ask-chip-fit" style={{ '--i': 0 } as React.CSSProperties} onClick={startFit}><Clipboard />{fitChip}</button>
                {suggestions.map((text, index) => <button type="button" key={text} className="ask-chip" style={{ '--i': index + 1 } as React.CSSProperties} onClick={() => void send(text)}>{text}</button>)}
              </div>
            </div>
          )}
          {turns.map((turn, index) => turn.role === 'user'
            ? (
              <div className="ask-turn ask-turn-user" key={index}>
                {turn.kind === 'fit'
                  ? <div className="ask-bubble ask-bubble-jd"><span className="ask-jd-label">Job description · {formatCount(turn.content.length)} characters</span><span className="ask-jd-excerpt">{turn.content.length > 260 ? `${turn.content.slice(0, 260).trimEnd()}…` : turn.content}</span></div>
                  : <div className="ask-bubble">{turn.content}</div>}
              </div>
            )
            : (
              <div className={`ask-turn ask-turn-assistant ${turn.error ? 'is-error' : ''} ${turn.scope === 'out' ? 'is-out' : ''}`} key={index}>
                <div className="ask-answer">
                  {turn.content ? renderMarkdown(turn.content) : null}
                  {streaming && index === turns.length - 1 && turn.content && <span className="ask-caret" aria-hidden="true" />}
                  {waiting && index === turns.length - 1 && <span className="ask-typing" aria-label="Thinking"><i /><i /><i /></span>}
                </div>
                {!(streaming && index === turns.length - 1) && !turn.error && (
                  <div className="ask-meta">
                    {turn.sources.length > 0 && (
                      <div className="ask-sources" aria-label="Based on">
                        {turn.sources.map((source) => source.href ? <a key={source.id} href={source.href} target={source.href.startsWith('https://steven.wilssens.com') ? undefined : '_blank'} rel="noreferrer">{source.title}</a> : <span key={source.id}>{source.title}</span>)}
                      </div>
                    )}
                    <div className="ask-actions">
                      <button type="button" className="ask-mini" onClick={() => copy(index, turn.content)} aria-label="Copy answer" title="Copy"><CopyIcon />{copied === index && <span>Copied</span>}</button>
                      {turn.scope === 'in' && <>
                        <button type="button" className={`ask-mini ${turn.vote === 'up' ? 'is-on' : ''}`} onClick={() => void vote(index, true)} aria-label="Helpful" title="Helpful" aria-pressed={turn.vote === 'up'} disabled={Boolean(turn.vote)}><Up /></button>
                        <button type="button" className={`ask-mini ${turn.vote === 'down' ? 'is-on' : ''}`} onClick={() => void vote(index, false)} aria-label="Not helpful" title="Not helpful" aria-pressed={turn.vote === 'down'} disabled={Boolean(turn.vote)}><Down /></button>
                      </>}
                      {turn.vote && <span className="ask-thanks">Thanks</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>

        <form className="ask-compose" onSubmit={submit}>
          {notice && <p className="ask-notice" role="status">{notice}</p>}
          <div className="ask-turnstile" ref={turnstileRef} />
          {mode === 'fit' ? (
            <div className="ask-fit">
              <div className="ask-fit-head"><strong>Check a job description</strong><span>Covered, partly covered, not shown, and what to ask him.</span></div>
              <label className="ask-visually-hidden" htmlFor="ask-posting">Job description</label>
              <textarea id="ask-posting" ref={postingRef} rows={7} maxLength={maxJobDescription} placeholder="Paste the posting: title, responsibilities, requirements…" value={posting} onChange={(event) => setPosting(event.target.value)} onKeyDown={onPostingKeyDown} disabled={busy} />
              <div className="ask-fit-row">
                <button type="button" className="ask-ghost" onClick={stopFit}>Back to questions</button>
                <span className="ask-foot-text">{postingLeft < 800 ? <span className="ask-count">{formatCount(postingLeft)} left</span> : <span>Ctrl+Enter to send.</span>}</span>
                <button type="submit" className="ask-fit-send" disabled={busy || !posting.trim()}>Check fit</button>
              </div>
            </div>
          ) : (
            <>
              <div className={`ask-compose-row ${busy ? 'is-busy' : ''}`}>
                <label className="ask-visually-hidden" htmlFor="ask-input">Your question</label>
                <textarea id="ask-input" ref={inputRef} rows={1} maxLength={maxQuestion} placeholder="Ask about his work, teams, results…" enterKeyHint="send" value={draft} onChange={(event) => { setDraft(event.target.value); grow(event.target) }} onKeyDown={onKeyDown} disabled={busy} />
                {busy
                  ? <button type="button" className="ask-send is-stop" onClick={stop} aria-label="Stop" title="Stop"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" /></svg></button>
                  : <button type="submit" className="ask-send" aria-label="Send" title="Send" disabled={!draft.trim()}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg></button>}
              </div>
              <p className="ask-foot">{remaining < 120 ? <span className="ask-count">{remaining} left</span> : <span>Enter to send, Shift+Enter for a new line.</span>} <span><button type="button" className="ask-foot-link" onClick={startFit} disabled={busy}>Job description?</button> · <a href="mailto:steven@wilssens.com">Prefer email?</a></span></p>
            </>
          )}
        </form>
      </section>
    </>
  )
}
