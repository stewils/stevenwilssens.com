import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AskAssistant from './AskAssistant'
import { waits } from './waits'
import { renderInline, safeHref } from './markdown'
import { openAsk } from './open'

const sseBody = (blocks: [string, unknown][]) => blocks.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')
const stream = (text: string) => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close() } }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })

const fetchMock = vi.fn()
beforeEach(() => {
  sessionStorage.clear()
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/ask' && (!init || init.method !== 'POST')) return Response.json({ ready: true, siteKey: null })
    if (url === '/api/ask' && init?.method === 'POST') {
      return stream(sseBody([
        ['meta', { scope: 'in', sources: [{ id: 'role:csx-data', title: 'Principal Product Manager Lead, Microsoft', href: 'https://steven.wilssens.com/experience' }] }],
        ['delta', { text: 'Steven built **data products** for Windows quality.\n\n- One\n- Two\n\nSee [his LinkedIn](https://www.linkedin.com/in/steven-wilssens-59495889/) or [evil](https://evil.example/x).' }],
        ['done', { id: null, sig: 'sig-1', scope: 'in', sources: ['role:csx-data'] }],
      ]))
    }
    if (url === '/api/ask/feedback') return Response.json({ ok: true })
    return new Response('not found', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(window, 'matchMedia', { writable: true, value: (query: string) => ({ matches: query.includes('1200') , media: query, addEventListener: () => {}, removeEventListener: () => {} }) })
  window.requestAnimationFrame = (callback: FrameRequestCallback) => { callback(0); return 1 }
  window.cancelAnimationFrame = () => {}
  Element.prototype.scrollTo = () => {}
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('AskAssistant', () => {
  it('shows the button once the server says it is on, opens with suggestions, and docks on wide screens', async () => {
    render(<AskAssistant page="patents" />)
    const fab = await screen.findByRole('button', { name: /ask about steven/i })
    expect(fetchMock).toHaveBeenCalledWith('/api/ask')
    await userEvent.click(fab)
    const dialog = screen.getByRole('dialog', { name: /ask about steven/i })
    expect(dialog.className).toContain('is-open')
    expect(document.documentElement.classList.contains('ask-docked')).toBe(true)
    expect(screen.getByRole('button', { name: 'What are his patents about?' })).toBeInTheDocument()
    expect(sessionStorage.getItem('sw-ask-open')).toBe('1')
  })

  it('stays hidden when the assistant is off', async () => {
    fetchMock.mockImplementation(async () => Response.json({ ready: false, siteKey: null }))
    render(<AskAssistant page="home" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /ask about steven/i })).not.toBeInTheDocument()
  })

  it('streams an answer, renders the safe markdown, shows the sources and takes a vote', async () => {
    render(<AskAssistant page="home" />)
    await userEvent.click(await screen.findByRole('button', { name: /ask about steven/i }))
    await userEvent.type(screen.getByLabelText('Your question'), 'What did he build?{enter}')
    await screen.findByText('data products')
    expect(screen.getByText('What did he build?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'his LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/in/steven-wilssens-59495889/')
    expect(screen.queryByRole('link', { name: 'evil' })).not.toBeInTheDocument()
    expect(screen.getByText(/or evil\./)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Principal Product Manager Lead, Microsoft' })).toHaveAttribute('href', 'https://steven.wilssens.com/experience')

    const body = JSON.parse((fetchMock.mock.calls.find((call) => call[1]?.method === 'POST')![1] as RequestInit).body as string) as { page: string; messages: unknown[] }
    expect(body.page).toBe('home')
    expect(body.messages).toEqual([{ role: 'user', content: 'What did he build?' }])

    await userEvent.click(screen.getByRole('button', { name: 'Helpful' }))
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[0] === '/api/ask/feedback')).toBe(true))
    const vote = JSON.parse((fetchMock.mock.calls.find((call) => call[0] === '/api/ask/feedback')![1] as RequestInit).body as string) as Record<string, unknown>
    expect(vote).toMatchObject({ helpful: true, question: 'What did he build?', sources: ['role:csx-data'], sig: 'sig-1' })
    expect(screen.getByText('Thanks')).toBeInTheDocument()

    // The conversation is kept for the next page, with the answer's signature.
    const saved = JSON.parse(sessionStorage.getItem('sw-ask') ?? '[]') as { role: string; sig?: string }[]
    expect(saved).toHaveLength(2)
    expect(saved[1].sig).toBe('sig-1')
  })

  it('shows the server\'s message when it turns the question away', async () => {
    fetchMock.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === 'POST' ? Response.json({ error: 'busy', message: 'Too many questions.' }, { status: 429 }) : Response.json({ ready: true, siteKey: null }))
    render(<AskAssistant page="home" />)
    await userEvent.click(await screen.findByRole('button', { name: /ask about steven/i }))
    await userEvent.type(screen.getByLabelText('Your question'), 'Hello{enter}')
    await screen.findByText('Too many questions.')
    expect(screen.queryByRole('button', { name: 'Helpful' })).not.toBeInTheDocument()
  })

  // A fake Turnstile: render() keeps the callback, the test hands out tokens when it likes.
  const fakeTurnstile = () => {
    const fake = { giveToken: null as ((token: string) => void) | null, showBox: null as (() => void) | null, resets: 0, rendered: 0 }
    const turnstile = { render: (_el: HTMLElement, options: Record<string, unknown>) => { fake.rendered++; fake.giveToken = options.callback as (token: string) => void; fake.showBox = options['before-interactive-callback'] as () => void; return 'w1' }, reset: () => { fake.resets++ } }
    Object.defineProperty(window, 'turnstile', { configurable: true, writable: true, value: turnstile })
    return fake
  }
  const humanCheckServer = (posted: string[], siteKeyAtStart: string | null) => async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method !== 'POST') return Response.json({ ready: true, siteKey: siteKeyAtStart })
    const token = (JSON.parse(init.body as string) as { turnstileToken: string }).turnstileToken
    posted.push(token)
    if (token !== 'token-2') return Response.json({ error: 'human', message: 'Not a person.', siteKey: 'site-key' }, { status: 403 })
    return stream(sseBody([['meta', { scope: 'in', sources: [] }], ['delta', { text: 'Answered.' }], ['done', { id: null, sig: 'sig-2' }]]))
  }

  it('waits for the human check\'s token before sending, and asks for a fresh one when the server rejects it', async () => {
    const fake = fakeTurnstile()
    const posted: string[] = []
    fetchMock.mockImplementation(humanCheckServer(posted, 'site-key'))
    render(<AskAssistant page="home" />)
    await userEvent.click(await screen.findByRole('button', { name: /ask about steven/i }))
    await waitFor(() => expect(fake.giveToken).not.toBeNull())
    await userEvent.type(screen.getByLabelText('Your question'), 'Hello{enter}')

    // Nothing is posted until the widget hands over its first token.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(posted).toEqual([])
    await act(async () => { fake.giveToken!('token-1') })
    await waitFor(() => expect(posted).toEqual(['token-1']))

    // The server rejected it: the widget is reset and the question goes again with the next token.
    await waitFor(() => expect(fake.resets).toBe(1))
    await act(async () => { fake.giveToken!('token-2') })
    await screen.findByText('Answered.')
    expect(posted).toEqual(['token-1', 'token-2'])
    expect(screen.queryByText('Not a person.')).not.toBeInTheDocument()
    expect(fake.resets).toBe(2) // spent: the next one is being prepared
    Reflect.deleteProperty(window, 'turnstile')
  })

  it('brings up the human check mid-conversation when the server starts asking for it', async () => {
    const fake = fakeTurnstile()
    const posted: string[] = []
    fetchMock.mockImplementation(humanCheckServer(posted, null)) // a quiet day when the panel opened
    render(<AskAssistant page="home" />)
    await userEvent.click(await screen.findByRole('button', { name: /ask about steven/i }))
    await userEvent.type(screen.getByLabelText('Your question'), 'Hello{enter}')

    // No widget yet, so the question goes straight out; the answer says the check is on now.
    await waitFor(() => expect(posted).toEqual(['']))
    await waitFor(() => expect(fake.rendered).toBe(1))
    await act(async () => { fake.giveToken!('token-2') })
    await screen.findByText('Answered.')
    expect(posted).toEqual(['', 'token-2'])
    expect(screen.queryByText('Not a person.')).not.toBeInTheDocument()
    Reflect.deleteProperty(window, 'turnstile')
  })

  it('tells the visitor to tick the box when Cloudflare puts one up, and keeps waiting for the token', async () => {
    const fake = fakeTurnstile()
    const posted: string[] = []
    const before = waits.token
    waits.token = 20
    try {
      fetchMock.mockImplementation(humanCheckServer(posted, 'site-key'))
      render(<AskAssistant page="home" />)
      await userEvent.click(await screen.findByRole('button', { name: /ask about steven/i }))
      await waitFor(() => expect(fake.showBox).not.toBeNull())
      act(() => fake.showBox!())
      await userEvent.type(screen.getByLabelText('Your question'), 'Hello{enter}')
      // The short wait passes with no token and the box is up: the panel says so and does not post.
      await screen.findByRole('status')
      expect(screen.getByRole('status')).toHaveTextContent('Tick the box below')
      expect(posted).toEqual([])
      await act(async () => { fake.giveToken!('token-2') })
      await screen.findByText('Answered.')
      expect(posted).toEqual(['token-2'])
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    } finally {
      waits.token = before
      Reflect.deleteProperty(window, 'turnstile')
    }
  })

  it('opens from anywhere on the site with a question typed in, and closes on Escape', async () => {
    render(<AskAssistant page="home" />)
    await screen.findByRole('button', { name: /ask about steven/i })
    openAsk('Is he a fit?')
    await waitFor(() => expect(screen.getByRole('dialog').className).toContain('is-open'))
    expect(screen.getByLabelText('Your question')).toHaveValue('Is he a fit?')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('dialog').className).not.toContain('is-open'))
  })

  it('gives a WebMCP agent ask_about_steven once the assistant is on, answers through the panel, and takes the tool away on unmount', async () => {
    type Tool = { name: string; execute: (input: Record<string, unknown>) => Promise<string> | string }
    const tools = new Map<string, Tool>()
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool: (tool: Tool, options?: { signal?: AbortSignal }) => { tools.set(tool.name, tool); options?.signal?.addEventListener('abort', () => tools.delete(tool.name)) } } })
    try {
      const view = render(<AskAssistant page="experience" />)
      await waitFor(() => expect(tools.has('ask_about_steven')).toBe(true))
      let reply = ''
      await act(async () => { reply = await tools.get('ask_about_steven')!.execute({ question: 'What did he build?' }) })
      const result = JSON.parse(reply) as { answer: string; scope: string; sources: { title: string; href: string }[] }
      expect(result.answer).toContain('Steven built **data products**')
      expect(result.scope).toBe('in scope')
      expect(result.sources).toEqual([{ title: 'Principal Product Manager Lead, Microsoft', href: 'https://steven.wilssens.com/experience' }])
      expect(screen.getByRole('dialog').className).toContain('is-open')
      expect(screen.getByText('What did he build?')).toBeInTheDocument()
      expect(screen.getByText('data products')).toBeInTheDocument()
      const body = JSON.parse((fetchMock.mock.calls.find((call) => call[1]?.method === 'POST')![1] as RequestInit).body as string) as { page: string }
      expect(body.page).toBe('experience')
      expect(await tools.get('ask_about_steven')!.execute({})).toBe('Give a question to ask.')
      view.unmount()
      expect(tools.has('ask_about_steven')).toBe(false)
    } finally {
      delete (document as { modelContext?: unknown }).modelContext
    }
  })

  it('does not offer ask_about_steven while the assistant is off', async () => {
    fetchMock.mockImplementation(async () => Response.json({ ready: false, siteKey: null }))
    const registerTool = vi.fn()
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool } })
    try {
      render(<AskAssistant page="home" />)
      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      expect(registerTool).not.toHaveBeenCalled()
    } finally {
      delete (document as { modelContext?: unknown }).modelContext
    }
  })
})

describe('markdown', () => {
  it('keeps links to Steven\'s places and drops the rest', () => {
    expect(safeHref('https://steven.wilssens.com/patents')).toBe('https://steven.wilssens.com/patents')
    expect(safeHref('/experience')).toBe('/experience')
    expect(safeHref('mailto:steven@wilssens.com')).toBe('mailto:steven@wilssens.com')
    expect(safeHref('mailto:other@example.com')).toBeNull()
    expect(safeHref('http://steven.wilssens.com/')).toBeNull()
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(renderInline('plain **bold** `code`', 'k')).toHaveLength(4)
  })
})
