import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AskAssistant, { fitChip, maxJobDescription } from './AskAssistant'
import { renderMarkdown } from './markdown'
import { openAsk } from './open'
import { waits } from './waits'

// The visitor's side of the assistant beyond the happy path: phones, the job-description
// check, stopping an answer, failures, out-of-scope answers, copying and starting over.

const sseBody = (blocks: [string, unknown][]) => blocks.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')
const stream = (...chunks: string[]) => new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close() } }), { status: 200 })
const answer = (text: string, meta: Record<string, unknown> = { scope: 'in', sources: [] }) => stream(sseBody([['meta', meta], ['delta', { text }], ['done', { id: 7, sig: 'sig' }]]))

type Reply = (body: Record<string, unknown>, init: RequestInit) => Response | Promise<Response>
const fetchMock = vi.fn()
const server = (reply: Reply, status: Record<string, unknown> = { ready: true, siteKey: null }) => fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url === '/api/ask' && init?.method === 'POST') return reply(JSON.parse(init.body as string) as Record<string, unknown>, init)
  if (url === '/api/ask') return Response.json(status)
  if (url === '/api/ask/feedback') return Response.json({ ok: true })
  return new Response('', { status: 404 })
})
const posts = () => fetchMock.mock.calls.filter((call) => call[1]?.method === 'POST' && call[0] === '/api/ask').map((call) => JSON.parse((call[1] as RequestInit).body as string) as { messages: Record<string, unknown>[] })

let media: Record<string, boolean> = {}
const mediaListeners = new Map<string, () => void>()
beforeEach(() => {
  sessionStorage.clear()
  fetchMock.mockReset()
  server(() => answer('An answer.'))
  vi.stubGlobal('fetch', fetchMock)
  media = { '1200': true }
  mediaListeners.clear()
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: (query: string) => ({ get matches() { return Object.entries(media).some(([part, on]) => on && query.includes(part)) }, media: query, addEventListener: (_type: string, listener: () => void) => mediaListeners.set(query, listener), removeEventListener: () => mediaListeners.delete(query) }) })
  window.requestAnimationFrame = (callback: FrameRequestCallback) => { callback(0); return 1 }
  window.cancelAnimationFrame = () => {}
  Element.prototype.scrollTo = () => {}
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'turnstile')
  document.head.querySelectorAll('script').forEach((script) => script.remove())
})

const openPanel = async (page = 'home') => {
  const view = render(<AskAssistant page={page} />)
  await userEvent.click(await screen.findByRole('button', { name: /ask about steven/i }))
  return view
}
const ask = async (question: string) => userEvent.type(screen.getByLabelText('Your question'), `${question}{enter}`)

describe('AskAssistant on different screens', () => {
  it('opens again on the next page when it was left open, but not on a phone', async () => {
    sessionStorage.setItem('sw-ask-open', '1')
    render(<AskAssistant page="home" />)
    expect(screen.getByRole('dialog').className).toContain('is-open')
    cleanup()

    media = { '759': true }
    render(<AskAssistant page="home" />)
    expect(screen.getByRole('dialog').className).not.toContain('is-open')
  })

  it('is a bottom sheet on phones and an overlay with a backdrop on tablets, and follows the window as it changes', async () => {
    media = { '759': true }
    await openPanel()
    expect(document.documentElement.classList.contains('ask-sheet')).toBe(true)
    expect(document.documentElement.classList.contains('ask-docked')).toBe(false)
    media = {}
    act(() => mediaListeners.forEach((listener) => listener()))
    expect(document.documentElement.classList.contains('ask-sheet')).toBe(false)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    // The backdrop closes it, and focus goes back to the button.
    fireEvent.click(document.querySelector('.ask-backdrop')!)
    expect(screen.getByRole('dialog').className).not.toContain('is-open')
    expect(screen.getByRole('button', { name: /ask about steven/i })).toHaveFocus()
  })

  it('closes with the close button and leaves Escape alone when it is closed', async () => {
    await openPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(sessionStorage.getItem('sw-ask-open')).toBeNull()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog').className).not.toContain('is-open')
  })

  it('starts fresh when the saved conversation is not a list or not JSON, or storage is blocked', async () => {
    sessionStorage.setItem('sw-ask', '{"role":"user"}')
    render(<AskAssistant page="home" />)
    expect(await screen.findByText(fitChip)).toBeInTheDocument()
    cleanup()
    sessionStorage.setItem('sw-ask', 'not json')
    render(<AskAssistant page="home" />)
    expect(await screen.findByText(fitChip)).toBeInTheDocument()
    cleanup()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    await openPanel()
    await ask('Hello')
    expect(await screen.findByText('An answer.')).toBeInTheDocument()
  })

  it('stays hidden when the status check fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<AskAssistant page="home" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /ask about steven/i })).not.toBeInTheDocument()
    cleanup()
    fetchMock.mockResolvedValue(new Response('', { status: 500 }))
    render(<AskAssistant page="home" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('button', { name: /ask about steven/i })).not.toBeInTheDocument()
  })
})

describe('asking', () => {
  it('sends a suggestion with one click, and keeps Shift+Enter for a new line', async () => {
    await openPanel('patents')
    await userEvent.click(screen.getByRole('button', { name: 'What are his patents about?' }))
    expect(await screen.findByText('An answer.')).toBeInTheDocument()
    expect(posts()[0].messages).toEqual([{ role: 'user', content: 'What are his patents about?' }])

    const input = screen.getByLabelText('Your question')
    await userEvent.type(input, 'Line one{Shift>}{Enter}{/Shift}line two')
    expect(input).toHaveValue('Line one\nline two')
    expect(posts()).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(posts()).toHaveLength(2))
  })

  it('counts down the characters left near the limit, and does not send an empty question', async () => {
    await openPanel()
    const input = screen.getByLabelText('Your question')
    expect(screen.getByText(/Enter to send, Shift\+Enter/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'x'.repeat(950) } })
    expect(screen.getByText('50 left')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(posts()).toHaveLength(0)
  })

  it('shows the thinking dots, then the answer as it streams, and lets the visitor stop it', async () => {
    let push: (text: string) => void = () => {}
    server((_body, init) => new Response(new ReadableStream({
      start(controller) {
        push = (text) => controller.enqueue(new TextEncoder().encode(text))
        init.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')))
      },
    })))
    await openPanel()
    await ask('Tell me everything')
    expect(await screen.findByLabelText('Thinking')).toBeInTheDocument()
    expect(screen.getByLabelText('Your question')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Job description?' })).toBeDisabled()
    await act(async () => { push(sseBody([['meta', { scope: 'in', sources: [] }], ['delta', { text: 'Partly ' }]])) })
    expect(await screen.findByText(/Partly/)).toBeInTheDocument()
    expect(document.querySelector('.ask-caret')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Helpful' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument())
    // What had arrived stays, and is not marked as an error.
    expect(screen.getByText('Partly')).toBeInTheDocument()
    expect(document.querySelector('.is-error')).toBeNull()
  })

  it('drops a stopped answer that had not started', async () => {
    server((_body, init) => new Promise<Response>((_resolve, reject) => { init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))) }))
    await openPanel()
    await ask('Hello')
    await userEvent.click(await screen.findByRole('button', { name: 'Stop' }))
    await waitFor(() => expect(screen.queryByText('Hello')).not.toBeInTheDocument())
    expect(screen.getByText(fitChip)).toBeInTheDocument()
  })

  it('says something went wrong when the network fails, and leaves the failed answer out of the next question', async () => {
    let calls = 0
    server(() => { calls++; if (calls === 1) throw new TypeError('offline'); return answer('Second time lucky.') })
    await openPanel()
    await ask('First')
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(document.querySelector('.is-error')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy answer' })).not.toBeInTheDocument()
    await ask('Second')
    expect(await screen.findByText('Second time lucky.')).toBeInTheDocument()
    expect(posts()[1].messages).toEqual([{ role: 'user', content: 'Second' }])
    // The failed answer is gone from the panel, the question stays.
    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument()
  })

  it('shows the message of an error event, and a generic one for an error without a body', async () => {
    server(() => stream(sseBody([['meta', { scope: 'in', sources: [] }], ['error', { message: 'The assistant is resting.' }]])))
    await openPanel()
    await ask('Hello')
    expect(await screen.findByText('The assistant is resting.')).toBeInTheDocument()
    server(() => new Response('not json', { status: 500 }))
    await ask('Again')
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })

  it('reads an answer that arrives in odd pieces, skipping blocks it does not understand', async () => {
    const body = sseBody([['meta', { scope: 'in' }], ['delta', { text: 'Hello ' }], ['delta', {}], ['delta', { text: 'there.' }], ['done', {}]])
    const middle = Math.floor(body.length / 2)
    server(() => stream(': comment\n\n', 'event: delta\ndata: {broken\n\n', body.slice(0, middle), body.slice(middle)))
    await openPanel()
    await ask('Hi')
    expect(await screen.findByText('Hello there.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Helpful' })).toBeInTheDocument()
  })

  it('shows sources as links, outside ones in a new tab, and ones without a page as plain text', async () => {
    server(() => answer('Sourced.', { scope: 'in', sources: [{ id: 'a', title: 'Experience', href: 'https://steven.wilssens.com/experience' }, { id: 'b', title: 'LinkedIn', href: 'https://www.linkedin.com/in/x' }, { id: 'c', title: 'A note', href: null }] }))
    await openPanel()
    await ask('Where from?')
    await screen.findByText('Sourced.')
    expect(screen.getByRole('link', { name: 'Experience' })).not.toHaveAttribute('target')
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('target', '_blank')
    expect(screen.getByText('A note').tagName).toBe('SPAN')
  })

  it('offers no vote on an out-of-scope answer', async () => {
    server(() => answer('I only answer questions about Steven.', { scope: 'out', sources: [] }))
    await openPanel()
    await ask('Weather?')
    await screen.findByText('I only answer questions about Steven.')
    expect(document.querySelector('.is-out')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Helpful' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy answer' })).toBeInTheDocument()
  })

  it('takes a thumbs down once, even when the feedback cannot be sent', async () => {
    await openPanel()
    await ask('Hello')
    await screen.findByText('An answer.')
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await userEvent.click(screen.getByRole('button', { name: 'Not helpful' }))
    expect(screen.getByRole('button', { name: 'Not helpful' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Helpful' })).toBeDisabled()
    expect(screen.getByText('Thanks')).toBeInTheDocument()
  })

  it('does not take a vote on an answer without its question', async () => {
    sessionStorage.setItem('sw-ask', JSON.stringify([{ role: 'assistant', content: 'Orphan answer.', sources: [], id: null, sig: '', scope: 'in' }]))
    await openPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Helpful' }))
    expect(fetchMock.mock.calls.some((call) => call[0] === '/api/ask/feedback')).toBe(false)
  })

  // Real timers until the answer is on screen (userEvent and the stream need them), then
  // plain fake timers: the click is synchronous, and the clipboard's promise and the 1.6 s
  // of the label run only when advanceTimersByTimeAsync moves the clock, inside act.
  const withClipboard = async (clipboard: unknown, body: () => Promise<void>) => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
    try {
      await openPanel()
      await ask('Hello')
      await screen.findByText('An answer.')
      vi.useFakeTimers()
      await body()
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard')
      vi.useRealTimers()
    }
  }
  const pass = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
  // Click, then let the clipboard's promise settle without moving the clock.
  const copyAnswer = async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy answer' })); await pass(0) }

  it('copies an answer and says so for a moment', async () => {
    const writeText = vi.fn(async () => {})
    await withClipboard({ writeText }, async () => {
      await copyAnswer()
      expect(writeText).toHaveBeenCalledWith('An answer.')
      expect(screen.getByText('Copied')).toBeInTheDocument()
      await pass(1599)
      expect(screen.getByText('Copied')).toBeInTheDocument()
      await pass(1)
      expect(screen.queryByText('Copied')).not.toBeInTheDocument()
    })
  })

  it('keeps "Copied" for the full moment after a second click', async () => {
    await withClipboard({ writeText: vi.fn(async () => {}) }, async () => {
      await copyAnswer()
      expect(screen.getByText('Copied')).toBeInTheDocument()
      await pass(1000)
      await copyAnswer()
      await pass(1000) // the first click's timer would have cleared it by now
      expect(screen.getByText('Copied')).toBeInTheDocument()
      await pass(600)
      expect(screen.queryByText('Copied')).not.toBeInTheDocument()
    })
  })

  it('says the copy failed when the browser refuses the clipboard', async () => {
    const writeText = vi.fn(async () => { throw new Error('denied') })
    await withClipboard({ writeText }, async () => {
      await copyAnswer()
      expect(writeText).toHaveBeenCalledWith('An answer.')
      expect(screen.getByText('Copy failed')).toBeInTheDocument()
      expect(screen.queryByText('Copied')).not.toBeInTheDocument()
      await pass(1600)
      expect(screen.queryByText('Copy failed')).not.toBeInTheDocument()
    })
  })

  it('says the copy failed when the browser has no clipboard (no secure context)', async () => {
    await withClipboard(undefined, async () => {
      await copyAnswer()
      expect(screen.getByText('Copy failed')).toBeInTheDocument()
      await pass(1600)
      expect(screen.queryByText('Copy failed')).not.toBeInTheDocument()
    })
  })

  it('says the copy failed when the clipboard has no writeText', async () => {
    await withClipboard({}, async () => {
      await copyAnswer()
      expect(screen.getByText('Copy failed')).toBeInTheDocument()
      expect(screen.queryByText('Copied')).not.toBeInTheDocument()
    })
  })

  it('starts a new conversation', async () => {
    await openPanel()
    await ask('Hello')
    await screen.findByText('An answer.')
    await userEvent.click(screen.getByRole('button', { name: 'New conversation' }))
    expect(screen.queryByText('An answer.')).not.toBeInTheDocument()
    expect(screen.getByText(fitChip)).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('sw-ask')!)).toEqual([])
  })
})

describe('checking a job description', () => {
  const posting = 'Principal Product Manager, Data Platform. '.repeat(10)

  it('takes a pasted posting, sends it marked as fit, and shows it as a short excerpt', async () => {
    server(() => answer('**Covered:** data products.'))
    await openPanel()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(fitChip) }))
    const box = screen.getByLabelText('Job description')
    expect(screen.getByRole('button', { name: 'Check fit' })).toBeDisabled()
    fireEvent.change(box, { target: { value: posting } })
    expect(screen.getByText('Ctrl+Enter to send.')).toBeInTheDocument()
    fireEvent.keyDown(box, { key: 'Enter' }) // a new line, not a send
    expect(posts()).toHaveLength(0)
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true })
    expect(await screen.findByText('Covered:')).toBeInTheDocument()
    expect(posts()[0].messages).toEqual([{ role: 'user', content: posting.trim(), kind: 'fit' }])
    expect(screen.getByText(`Job description · ${posting.trim().length} characters`)).toBeInTheDocument()
    expect(screen.getByText(/…$/)).toBeInTheDocument()
    // Back on questions, and a follow-up keeps the posting in the conversation.
    expect(screen.getByLabelText('Your question')).toBeInTheDocument()
    await ask('And leadership?')
    await waitFor(() => expect(posts()).toHaveLength(2))
    expect(posts()[1].messages[0]).toMatchObject({ kind: 'fit' })
  })

  it('sends with the Check fit button, shows a short posting in full, and counts down near the limit', async () => {
    await openPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Job description?' }))
    const box = screen.getByLabelText('Job description')
    fireEvent.change(box, { target: { value: 'x'.repeat(maxJobDescription - 100) } })
    expect(screen.getByText('100 left')).toBeInTheDocument()
    fireEvent.change(box, { target: { value: 'Head of data products' } })
    await userEvent.click(screen.getByRole('button', { name: 'Check fit' }))
    expect(await screen.findByText('An answer.')).toBeInTheDocument()
    expect(screen.getByText('Head of data products')).toBeInTheDocument()
  })

  it('goes back to questions without sending', async () => {
    await openPanel()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(fitChip) }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to questions' }))
    expect(screen.getByLabelText('Your question')).toHaveFocus()
    expect(posts()).toHaveLength(0)
  })

  it('opens straight on the check from elsewhere on the site', async () => {
    render(<AskAssistant page="home" />)
    await screen.findByRole('button', { name: /ask about steven/i })
    act(() => openAsk(undefined, { fit: true }))
    expect(screen.getByLabelText('Job description')).toBeInTheDocument()
    act(() => { window.dispatchEvent(new CustomEvent('sw-ask-open')) })
    expect(screen.getByRole('dialog').className).toContain('is-open')
  })
})

describe('the human check', () => {
  it('loads the Turnstile script when the server asks for the check, and mounts the widget once it is in', async () => {
    const render_ = vi.fn(() => 'w1')
    server(() => answer('Fine.'), { ready: true, siteKey: 'site-key' })
    await openPanel()
    const script = document.head.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile/"]')!
    expect(script).not.toBeNull()
    Object.defineProperty(window, 'turnstile', { configurable: true, writable: true, value: { render: render_, reset: vi.fn() } })
    script.dispatchEvent(new Event('load'))
    expect(render_).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ sitekey: 'site-key', appearance: 'interaction-only' }))
    // The widget's other callbacks clear the token or the interactive flag.
    const options = (render_.mock.calls[0] as unknown as [HTMLElement, Record<string, () => void>])[1]
    for (const name of ['expired-callback', 'error-callback', 'timeout-callback', 'before-interactive-callback', 'after-interactive-callback']) options[name]?.()
  })

  it('reuses a script already on the page, and goes on without the check when it fails to load', async () => {
    const existing = Object.assign(document.createElement('script'), { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js' })
    document.head.appendChild(existing)
    const before = waits.token
    waits.token = 10
    try {
      server(() => answer('Without a check.'), { ready: true, siteKey: 'site-key' })
      await openPanel()
      expect(document.head.querySelectorAll('script')).toHaveLength(1)
      existing.dispatchEvent(new Event('error'))
      await ask('Hello')
      expect(await screen.findByText('Without a check.')).toBeInTheDocument()
      expect(posts()[0]).toMatchObject({ turnstileToken: '' })
    } finally {
      waits.token = before
    }
  })

  it('shows the refusal when the server still wants a person and gives no way to prove it', async () => {
    server(() => Response.json({ error: 'human', message: 'Please try again later.' }, { status: 403 }))
    await openPanel()
    await ask('Hello')
    expect(await screen.findByText('Please try again later.')).toBeInTheDocument()
    expect(posts()).toHaveLength(1)
  })
})

describe('ask_about_steven for an agent in the browser', () => {
  type Tool = { name: string; execute: (input: Record<string, unknown>) => Promise<string> | string }
  const withTool = async (run: (tool: Tool) => Promise<void>) => {
    const tools = new Map<string, Tool>()
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool: (tool: Tool) => { tools.set(tool.name, tool) } } })
    try {
      render(<AskAssistant page="home" />)
      await waitFor(() => expect(tools.has('ask_about_steven')).toBe(true))
      await run(tools.get('ask_about_steven')!)
    } finally {
      Reflect.deleteProperty(document, 'modelContext')
    }
  }

  it('says when the assistant could not answer, and marks an out-of-scope answer', async () => {
    await withTool(async (tool) => {
      server(() => Response.json({ message: 'Too many questions.' }, { status: 429 }))
      let reply = ''
      await act(async () => { reply = await tool.execute({ question: 'Hi' }) })
      expect(reply).toBe('The assistant could not answer: Too many questions.')
      server(() => answer('Only about Steven.', { scope: 'out', sources: [] }))
      await act(async () => { reply = await tool.execute({ question: 'Weather?' }) })
      expect(JSON.parse(reply)).toMatchObject({ scope: 'out of scope: the assistant only answers questions about Steven' })
      expect(await tool.execute({ question: '   ' })).toBe('Give a question to ask.')
      expect(await tool.execute({ question: 3 })).toBe('Give a question to ask.')
    })
  })

  it('asks the agent to wait while another answer is streaming', async () => {
    await withTool(async (tool) => {
      let finish: () => void = () => {}
      server(() => new Promise<Response>((resolve) => { finish = () => resolve(answer('Done.')) }))
      await userEvent.type(screen.getByLabelText('Your question'), 'First{enter}')
      await screen.findByRole('button', { name: 'Stop' })
      let reply = ''
      await act(async () => { reply = await tool.execute({ question: 'Second' }) })
      expect(reply).toBe('The assistant is answering another question right now. Ask again in a moment.')
      await act(async () => { finish() })
      expect(await screen.findByText('Done.')).toBeInTheDocument()
    })
  })
})

describe('markdown in answers', () => {
  const html = (markdown: string) => { const { container, unmount } = render(<div>{renderMarkdown(markdown)}</div>); const out = container.innerHTML; unmount(); return out }

  it('renders numbered lists, headings as text, continuation lines and Windows line ends', () => {
    expect(html('## Summary\r\n1. One\r\n2) Two\r\n   still two\r\nAfter')).toBe('<div><p>Summary</p><ol><li>One</li><li>Two still two</li></ol><p>After</p></div>')
    expect(html('- a\n* b\n• c')).toBe('<div><ul><li>a</li><li>b</li><li>c</li></ul></div>')
    expect(html('- a\n1. b')).toBe('<div><ul><li>a</li></ul><ol><li>b</li></ol></div>')
    expect(html('Para\n  indented under a paragraph')).toBe('<div><p>Para indented under a paragraph</p></div>')
  })

  it('links bare addresses only to Steven\'s places, and mail and site links open in place', () => {
    expect(html('See https://steven.wilssens.com/work.')).toBe('<div><p>See <a href="https://steven.wilssens.com/work" rel="noreferrer">steven.wilssens.com/work</a>.</p></div>')
    expect(html('Or https://patents.justia.com/patent/1')).toContain('target="_blank"')
    expect(html('Not https://evil.example/x')).toBe('<div><p>Not https://evil.example/x</p></div>')
    expect(html('[Email](mailto:steven@wilssens.com) [Work](/work)')).toBe('<div><p><a href="mailto:steven@wilssens.com" rel="noreferrer">Email</a> <a href="/work" rel="noreferrer">Work</a></p></div>')
    expect(html('[Bad](not a url)')).toContain('[Bad](not a url)')
    expect(html('[Bad](notaurl)')).toBe('<div><p>Bad</p></div>')
  })
})
