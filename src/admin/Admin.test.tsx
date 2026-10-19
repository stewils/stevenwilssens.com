import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import Admin from './Admin'
import { makeAsk, makeMcp, makeResume, makeStats, makeTeamReads, NOW, sha } from '../test/admin-fixtures'

// The dashboard against a fake admin API: /api/stats, /api/ask/admin, /api/mcp and
// /api/resume and /api/team answer with the shapes the Pages Functions write.
type Answer = { status?: number; body?: unknown } | Error | 'pending'
type Routes = Partial<Record<'stats' | 'ask' | 'mcp' | 'resume' | 'team', Answer>>
const routeOf = (url: string) => (url.startsWith('/api/stats') ? 'stats' : url.startsWith('/api/ask/admin') ? 'ask' : url.startsWith('/api/mcp') ? 'mcp' : url.startsWith('/api/team') ? 'team' : 'resume')
const bodies = { stats: makeStats, ask: makeAsk, mcp: makeMcp, resume: makeResume, team: makeTeamReads }

let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>
const serve = (routes: Routes = {}) => {
  fetchMock = vi.fn((url: string): Promise<Response> => {
    const route = routeOf(url)
    const answer = routes[route] ?? { body: bodies[route]() }
    if (answer === 'pending') return new Promise<Response>(() => {})
    if (answer instanceof Error) return Promise.reject(answer)
    const status = answer.status ?? 200
    return Promise.resolve(new Response(JSON.stringify(answer.body ?? {}), { status, headers: { 'Content-Type': 'application/json' } }))
  })
  vi.stubGlobal('fetch', fetchMock)
}
const urls = () => fetchMock.mock.calls.map(([url]) => url as string)

const go = (hash: string) => act(() => {
  location.hash = hash
  dispatchEvent(new HashChangeEvent('hashchange'))
})
const heading = () => screen.getByRole('heading', { level: 1 })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(NOW)
  localStorage.clear()
  localStorage.setItem('sw-admin-token', 'secret')
  history.replaceState(null, '', '/admin')
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }))
  Element.prototype.scrollTo = vi.fn()
  serve()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete document.documentElement.dataset.theme
})

describe('signing in', () => {
  it('asks for the token, keeps it, stops tracking this browser and loads the dashboard', async () => {
    localStorage.clear()
    render(<Admin />)
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Admin token'), { target: { value: '  secret  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(localStorage.getItem('sw-admin-token')).toBe('secret')
    expect(localStorage.getItem('sw-analytics-ignore')).toBe('1')
    expect(await screen.findByText('40', { selector: 'dd' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/stats\?days=30&tz=-?\d+&r=0$/), { headers: { Authorization: 'Bearer secret' } })
    expect(urls()).toEqual(expect.arrayContaining(['/api/ask/admin?days=30&r=0', '/api/mcp?r=0', '/api/resume?r=0']))
    expect(screen.getByRole('checkbox', { name: "Don't track this browser" })).toBeChecked()
  })

  it('goes back to the sign-in when the token is not accepted', async () => {
    serve({ mcp: { status: 401 } })
    render(<Admin />)
    expect(await screen.findByText('That token was not accepted.')).toBeInTheDocument()
    expect(localStorage.getItem('sw-admin-token')).toBeNull()
  })

  it('signs out', async () => {
    render(<Admin />)
    await screen.findByText('40', { selector: 'dd' })
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText('That token was not accepted.')).not.toBeInTheDocument()
    expect(localStorage.getItem('sw-admin-token')).toBeNull()
  })
})

describe('the dashboard', () => {
  it('opens on the overview with the badges of what needs Steven', async () => {
    render(<Admin />)
    expect(heading()).toHaveTextContent('Overview')
    expect(document.title).toBe('Overview · Admin · steven.wilssens.com')
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled()
    await screen.findByText('40', { selector: 'dd' })
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
    const menu = within(screen.getByRole('navigation', { name: 'Admin pages' }))
    expect(menu.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(menu.getByRole('link', { name: /Page speed/ })).toHaveTextContent('Page speed1')
    expect(menu.getByRole('link', { name: /Crawlers/ })).toHaveTextContent('Crawlers2')
    expect(screen.getByText('Updated 2 min ago')).toBeInTheDocument()
  })

  it('shows 99+ when more than 99 things wait on a page', async () => {
    serve({ stats: { body: makeStats({ crawlTotals: { ...makeStats().crawlTotals, errors: 150 } }) } })
    render(<Admin />)
    await screen.findByText('40', { selector: 'dd' })
    expect(within(screen.getByRole('navigation', { name: 'Admin pages' })).getByText('99+')).toBeInTheDocument()
  })

  it('moves between pages with the URL hash', async () => {
    render(<Admin />)
    await screen.findByText('40', { selector: 'dd' })
    const expectations: [string, string, () => HTMLElement][] = [
      ['traffic', 'Traffic', () => screen.getByRole('table', { name: 'Visitors' })],
      ['sources', 'Sources', () => screen.getByRole('heading', { name: 'Your tracking links' })],
      ['audience', 'Audience', () => screen.getByRole('heading', { name: 'Visitors by organization' })],
      ['crawlers', 'Crawlers', () => screen.getByRole('table', { name: 'Crawlers' })],
      ['speed', 'Page speed', () => screen.getByRole('heading', { name: 'Core Web Vitals' })],
      ['resume', 'Résumé', () => screen.getByRole('table', { name: 'Résumé proposals' })],
      ['assistant', 'Ask about Steven', () => screen.getByRole('table', { name: 'Questions waiting' })],
      ['mcp', 'Career MCP', () => screen.getByRole('heading', { name: 'Your career MCP' })],
      ['team', 'Team', () => screen.getByRole('heading', { name: /How a change gets to main/ })],
      ['links', 'Links', () => screen.getByRole('heading', { name: 'Cloudflare' })],
      ['nowhere', 'Overview', () => screen.getByRole('heading', { name: 'Needs you' })],
    ]
    for (const [hash, title, find] of expectations) {
      go(hash)
      expect(heading()).toHaveTextContent(title)
      expect(find()).toBeInTheDocument()
      expect(document.title).toBe(`${title} · Admin · steven.wilssens.com`)
    }
    // The pages without a time range hide the range switch.
    go('mcp')
    expect(screen.queryByRole('group', { name: 'Time range' })).not.toBeInTheDocument()
    expect(Element.prototype.scrollTo).toHaveBeenCalledWith({ top: 0 })
    // The section bar lists the parts of the page that are shown.
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
    go('traffic')
    expect(within(screen.getByRole('navigation', { name: 'On this page' })).getAllByRole('button').map((chip) => chip.textContent)).toEqual(['Visitors', 'Who visited', 'Pages', 'Clicks', 'Activity'])
  })

  it('shows a placeholder on each page until its API answers', () => {
    serve({ stats: 'pending', ask: 'pending', mcp: 'pending', resume: 'pending' })
    render(<Admin />)
    const waits: [string, string][] = [
      ['traffic', 'Loading visitor data…'], ['sources', 'Loading visitor data…'], ['audience', 'Loading visitor data…'], ['crawlers', 'Loading crawler data…'],
      ['speed', 'Loading page speed data…'], ['resume', 'Loading the résumé report…'], ['assistant', "Loading the assistant's numbers…"], ['mcp', 'Loading the MCP details…'],
    ]
    for (const [hash, text] of waits) {
      go(hash)
      expect(screen.getByRole('status')).toHaveTextContent(text)
    }
    go('links')
    expect(screen.getByRole('heading', { name: 'GitHub' })).toBeInTheDocument()
  })

  it('says which API failed', async () => {
    serve({ stats: { status: 500 }, ask: new Error('offline'), mcp: 'pending', resume: new TypeError('x') })
    // A rejection that is not an Error.
    const rejectWith = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((url: string) => (url.startsWith('/api/resume') ? Promise.reject('nope') : rejectWith(url)))
    render(<Admin />)
    const alerts = await screen.findAllByRole('alert')
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(3))
    expect(alerts[0]).toHaveTextContent('Could not load visitor data (HTTP 500).')
    expect(screen.getByText('Could not load the assistant (offline).')).toBeInTheDocument()
    expect(screen.getByText('Could not load the résumé (Request failed).')).toBeInTheDocument()
  })

  it('reloads for another time range and on refresh, ignoring answers that came too late', async () => {
    let late: (response: Response) => void = () => {}
    const answer = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((url: string) => (url === '/api/ask/admin?days=30&r=0' ? new Promise((resolve) => { late = resolve }) : answer(url)))
    render(<Admin />)
    await screen.findByText('40', { selector: 'dd' })
    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(urls()).toContain('/api/ask/admin?days=7&r=0'))
    await act(async () => { late(new Response(JSON.stringify(makeAsk({ model: 'too-late' })))) })
    expect(urls().some((url) => url.startsWith('/api/stats?days=7'))).toBe(true)
    go('assistant')
    expect(await screen.findByText(/Claude \(claude-sonnet\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(urls()).toContain('/api/mcp?r=1'))
  })

  it('ignores an error that arrives after the range changed', async () => {
    let fail: (error: Error) => void = () => {}
    const answer = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((url: string) => (url.startsWith('/api/ask/admin?days=30') ? new Promise((_, reject) => { fail = reject }) : answer(url)))
    render(<Admin />)
    await screen.findByText('40', { selector: 'dd' })
    fireEvent.click(screen.getByRole('button', { name: '90 days' }))
    await act(async () => { fail(new Error('too late')) })
    expect(screen.queryByText(/too late/)).not.toBeInTheDocument()
  })

  it('ignores an answer whose body arrives after the range changed', async () => {
    let release: () => void = () => {}
    const answer = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((url: string) => {
      if (!url.startsWith('/api/ask/admin?days=30')) return answer(url)
      const response = new Response('{}')
      const json = new Promise((resolve) => { release = () => resolve(makeAsk({ model: 'too-late' })) })
      vi.spyOn(response, 'json').mockReturnValue(json)
      return Promise.resolve(response)
    })
    render(<Admin />)
    await screen.findByText('40', { selector: 'dd' })
    fireEvent.click(screen.getByRole('button', { name: '1 year' }))
    await waitFor(() => expect(urls()).toContain('/api/ask/admin?days=365&r=0'))
    await act(async () => { release() })
    go('assistant')
    expect(await screen.findByText(/Claude \(claude-sonnet\)/)).toBeInTheDocument()
    expect(screen.queryByText(/too-late/)).not.toBeInTheDocument()
  })

  it('keeps counting how long ago the numbers were fetched, and fetches stale ones again when the tab is looked at', async () => {
    render(<Admin />)
    await screen.findByText('Updated 2 min ago')
    act(() => { vi.advanceTimersByTime(4 * 60_000) })
    expect(screen.getByText('Updated 6 min ago')).toBeInTheDocument()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(urls()).not.toContain('/api/mcp?r=1')
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(urls()).toContain('/api/mcp?r=1'))
  })

  it('does not fetch again for numbers that are still fresh', async () => {
    render(<Admin />)
    await screen.findByText('Updated 2 min ago')
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(urls()).not.toContain('/api/mcp?r=1')
  })
})

describe('the Team page', () => {
  const menu = () => within(screen.getByRole('navigation', { name: 'Admin pages' }))
  const teamPosts = () => fetchMock.mock.calls.filter(([url, init]) => url === '/api/team' && (init as RequestInit | undefined)?.method === 'POST')

  it('lists Team after Career MCP and before Links and opens it at #team', async () => {
    render(<Admin />)
    await screen.findByText('40', { selector: 'dd' })
    const titles = menu().getAllByRole('link').map((link) => link.querySelector('.lbl')!.textContent)
    expect(titles.slice(titles.indexOf('Career MCP'), titles.indexOf('Links') + 1)).toEqual(['Career MCP', 'Team', 'Links'])
    expect(menu().getByRole('link', { name: /^Team/ })).toHaveAttribute('href', '#team')
    go('team')
    expect(heading()).toHaveTextContent('Team')
    expect(document.title).toBe('Team · Admin · steven.wilssens.com')
    expect(screen.getByText(/^The agents that write, build and review every change/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Time range' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /How a change gets to main/ })).toBeInTheDocument()
    expect(urls()).toContain('/api/team?r=0')
  })

  it('leaves #assistant with the same parts and copy', async () => {
    render(<Admin />)
    await screen.findByText('40', { selector: 'dd' })
    go('assistant')
    expect(heading()).toHaveTextContent('Ask about Steven')
    const parts = [...document.querySelectorAll<HTMLElement>('.page [data-part]')]
    expect(parts.map((part) => part.dataset.part)).toEqual(['Use and cost', 'Waiting for you'])
    expect(parts.map((part) => part.querySelector('h2')!.textContent)).toEqual(['Use and cost', 'Questions waiting for you'])
  })

  it('shows the number not seen on the menu item, named "Team, N not seen"', async () => {
    render(<Admin />)
    await screen.findByText('40', { selector: 'dd' })
    await waitFor(() => expect(menu().getByRole('link', { name: 'Team, 2 not seen' })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /changes to your agent team you have not seen, the latest/ })).toHaveAttribute('href', '#team')
  })

  it('says when what Steven has seen could not be loaded, and the other pages keep working', async () => {
    serve({ team: { status: 500 } })
    render(<Admin />)
    expect(await screen.findByText('Could not load what you have seen on the Team page (HTTP 500).')).toBeInTheDocument()
    expect(await screen.findByText('40', { selector: 'dd' })).toBeInTheDocument()
    expect(menu().getByRole('link', { name: 'Team' })).toBeInTheDocument()
    go('team')
    expect(screen.getByText('Seen state unavailable')).toBeInTheDocument()
    go('mcp')
    expect(screen.getByRole('heading', { name: 'Your career MCP' })).toBeInTheDocument()
  })

  it('records the changes as seen after 5 seconds on the page, and the badge and the need go', async () => {
    render(<Admin />)
    await screen.findByText('40', { selector: 'dd' })
    await waitFor(() => expect(menu().getByRole('link', { name: 'Team, 2 not seen' })).toBeInTheDocument())
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(NOW)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    go('team')
    fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url === '/api/team' ? makeTeamReads({ read: [sha('2'), sha('3')] }) : {}), { status: 200 })))
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(teamPosts()).toHaveLength(1)
    const [, init] = teamPosts()[0] as [string, RequestInit]
    expect(init.headers).toEqual({ Authorization: 'Bearer secret', 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body as string)).toEqual({ action: 'readAll', ids: [sha('3'), sha('2')] })
    expect(screen.getByText('Marked as seen')).toBeInTheDocument()
    expect(menu().getByRole('link', { name: 'Team' })).not.toHaveTextContent(/\d/)
    go('overview')
    expect(screen.queryByText(/your agent team you have not seen/)).not.toBeInTheDocument()
  })

  it('keeps everything unread when saving fails, and signs out when the token is refused', async () => {
    render(<Admin />)
    await screen.findByText('40', { selector: 'dd' })
    await waitFor(() => expect(menu().getByRole('link', { name: 'Team, 2 not seen' })).toBeInTheDocument())
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(NOW)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    fetchMock.mockImplementation(() => Promise.resolve(new Response('{}', { status: 500 })))
    go('team')
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(screen.getByText('Could not record that you have seen this; it will be tried again on your next visit.')).toBeInTheDocument()
    expect(menu().getByRole('link', { name: 'Team, 2 not seen' })).toBeInTheDocument()
    go('overview')
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')))
    go('team')
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(teamPosts()).toHaveLength(2)
    expect(screen.getByText(/it will be tried again on your next visit/)).toBeInTheDocument()
    go('overview')
    fetchMock.mockImplementation(() => Promise.resolve(new Response('{}', { status: 401 })))
    go('team')
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(screen.getByText('That token was not accepted.')).toBeInTheDocument()
  })
})

describe('preferences', () => {
  it('switches the theme and remembers anything but dark', async () => {
    render(<Admin />)
    expect(document.documentElement.dataset.theme).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('sw-admin-theme')).toBe('light')
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(localStorage.getItem('sw-admin-theme')).toBeNull()
    await screen.findByText('40', { selector: 'dd' })
  })

  it('starts with the theme picked before, and ignores one it does not know', async () => {
    localStorage.setItem('sw-admin-theme', 'system')
    const { unmount } = render(<Admin />)
    expect(document.documentElement.dataset.theme).toBe('system')
    await screen.findByText('40', { selector: 'dd' })
    unmount()
    localStorage.setItem('sw-admin-theme', 'neon')
    render(<Admin />)
    expect(document.documentElement.dataset.theme).toBe('dark')
    await screen.findByText('40', { selector: 'dd' })
  })

  it('turns tracking of this browser on and off', async () => {
    render(<Admin />)
    const box = screen.getByRole('checkbox', { name: "Don't track this browser" })
    expect(box).not.toBeChecked()
    fireEvent.click(box)
    expect(localStorage.getItem('sw-analytics-ignore')).toBe('1')
    fireEvent.click(box)
    expect(localStorage.getItem('sw-analytics-ignore')).toBeNull()
    await screen.findByText('40', { selector: 'dd' })
  })

  it('still works when the browser keeps no storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied') })
    render(<Admin />)
    fireEvent.change(screen.getByLabelText('Admin token'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(heading()).toHaveTextContent('Overview')
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
