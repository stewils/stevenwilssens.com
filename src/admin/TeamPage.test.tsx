import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { makeTeamManifest, makeTeamReads, makeUpdate, NOW, sha } from '../test/admin-fixtures'
import { computeNeeds, computeSummaries } from './needs'
import { Overview } from './Overview'
import { TeamPage, type TeamAction } from './TeamPage'
import type { Flow, TeamManifest, TeamReads } from './team-types'

// The Team page against fixture manifests (made-up roles, jobs and steps) and a fake onPost.
// Fake timers for the 5-second seen rule; document.visibilityState spied as in Admin.test.tsx.
let post: Mock<(action: TeamAction, ids: string[]) => Promise<boolean>>
let visibility: DocumentVisibilityState
const setVisibility = (state: DocumentVisibilityState) => act(() => { visibility = state; document.dispatchEvent(new Event('visibilitychange')) })
const wait = (ms: number) => act(async () => { vi.advanceTimersByTime(ms) })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(NOW)
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }))
  HTMLElement.prototype.scrollIntoView = vi.fn()
  post = vi.fn(async () => true)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const show = ({ manifest = makeTeamManifest(), reads = makeTeamReads() as TeamReads | null, readsError = '' } = {}) =>
  render(<TeamPage manifest={manifest} reads={reads} readsError={readsError} onPost={post} />)
const part = (name: string) => document.querySelector<HTMLElement>(`[data-part="${name}"]`)!
const rows = () => within(part('What changed')).getAllByRole('listitem').filter((item) => item.matches('.team-update'))
const head = () => part('What changed').querySelector<HTMLElement>('.team-head')!
const unreadIds = [sha('3'), sha('2')]

describe('the Team page, from the manifest', () => {
  it('shows the Flow, What changed, Roles, Gates, Commands and Site update parts with what the manifest says', () => {
    show()
    expect([...document.querySelectorAll('[data-part]')].map((el) => (el as HTMLElement).dataset.part)).toEqual(['Flow', 'What changed', 'Roles', 'Gates', 'Commands', 'Site update'])
    expect(within(part('Roles')).getByRole('heading', { name: /Chief editor/ })).toBeInTheDocument()
    expect(within(part('Roles')).getByText('chief-editor')).toHaveClass('team-mono')
    expect(part('Roles')).toHaveTextContent('Owns: the draftSigns off on: the draft')
    expect(part('Gates')).toHaveTextContent('proof')
    expect(part('Gates')).toHaveTextContent('panel The panel after proof')
    expect(part('Gates')).toHaveTextContent('Protection on main requires proof and panel.')
    expect(within(part('Gates')).getByText('stop')).toHaveClass('badge')
    expect(part('Commands')).toHaveTextContent('/publish <the ask>Run the editors on an ask.')
    expect(part('Site update')).toHaveTextContent('Let the editor write')
    expect(within(part('Site update')).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Draft first.', 'Then the panel.'])
    expect(within(part('Site update')).getByText('Edit')).toHaveClass('badge')
    expect(within(part('Flow')).getByText('The steps in words')).toBeInTheDocument()
    expect(within(part('Flow')).getByText('Intake').closest('li')).toHaveTextContent('Intake (lead). Restate the ask.')
  })

  it('says where a part could not be read, and shows the rest', () => {
    const manifest = makeTeamManifest({
      flow: { unreadable: '.team/flow.md' },
      sections: { roles: { file: null, items: [{ id: 'x', unreadable: '.team/agents/x.md' }] }, checks: { unreadable: '.ci/panel.yml' }, commands: { items: [{ id: 'y', unreadable: '.team/commands/y.md' }] }, siteUpdate: { unreadable: '.ci/site.yml' } },
    })
    show({ manifest })
    expect(part('Flow')).toHaveTextContent('Could not read the flow from .team/flow.md at build time; the diagram is back after the next build.')
    expect(part('Roles')).toHaveTextContent('This part could not be read from .team/agents/x.md')
    expect(part('Gates')).toHaveTextContent('This part could not be read from .ci/panel.yml')
    expect(part('Commands')).toHaveTextContent('This part could not be read from .team/commands/y.md')
    expect(part('Site update')).toHaveTextContent('This part could not be read from .ci/site.yml')
    expect(rows()).toHaveLength(3)
  })

  it('names a missing part generically when the manifest has nothing at all for it', () => {
    show({ manifest: makeTeamManifest({ flow: null, sections: { roles: { unreadable: '.team/flow.md' }, commands: { unreadable: '.team' } } }) })
    expect(part('Flow')).toHaveTextContent('Could not read the flow from the team file')
    expect(part('Gates')).toHaveTextContent('This part could not be read from the Review workflow')
    expect(part('Site update')).toHaveTextContent('This part could not be read from the Site update workflow')
    expect(part('Commands')).toHaveTextContent('This part could not be read from .team')
    cleanup()
    show({ manifest: makeTeamManifest({ sections: {} }) })
    expect(part('Roles')).toHaveTextContent('This part could not be read from the team file')
    expect(part('Commands')).toHaveTextContent('This part could not be read from the commands')
  })

  it('says when the history is not in this build, and when there is none yet', () => {
    show({ manifest: makeTeamManifest({ history: null }) })
    expect(part('What changed')).toHaveTextContent('The history of changes is not in this build.')
    expect(screen.queryByText(/changes? you have not seen/)).not.toBeInTheDocument()
    cleanup()
    show({ manifest: makeTeamManifest({ history: { updates: [], older: 0, truncated: false } }) })
    expect(part('What changed')).toHaveTextContent('No changes recorded yet. Every change to the agents, the team flow, the commands, the Review workflow, the gates or the Site update team step will show up here.')
  })

  it('says how many older changes are not listed', () => {
    show({ manifest: makeTeamManifest({ history: { ...makeTeamManifest().history!, older: 4, truncated: true } }) })
    expect(part('What changed')).toHaveTextContent('4 older changes are not listed, to keep this page small.')
    cleanup()
    show({ manifest: makeTeamManifest({ history: { ...makeTeamManifest().history!, older: 1 } }) })
    expect(part('What changed')).toHaveTextContent('1 older change is not listed.')
  })

  it('clamps a long description with Read more', () => {
    show()
    const card = within(part('Roles')).getByRole('heading', { name: /Fact checker/ }).closest('article')!
    const more = within(card).getByRole('button', { name: 'Read more' })
    expect(card.querySelector('.team-desc')).toHaveClass('clamped')
    fireEvent.click(more)
    expect(more).toHaveTextContent('Read less')
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(card.querySelector('.team-desc')).not.toHaveClass('clamped')
  })
})

describe('the seen rule: 5 seconds of the page in front of Steven', () => {
  it('does not post at 4.9 s, and posts one readAll with every unread id at 5 s', async () => {
    show()
    await wait(4900)
    expect(post).not.toHaveBeenCalled()
    await wait(100)
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('readAll', unreadIds)
  })

  it('does not count time while the tab is hidden', async () => {
    show()
    await wait(3000)
    setVisibility('hidden')
    await wait(60_000)
    expect(post).not.toHaveBeenCalled()
    setVisibility('visible')
    await wait(1999)
    expect(post).not.toHaveBeenCalled()
    await wait(1)
    expect(post).toHaveBeenCalledTimes(1)
    // More visibility changes after that do nothing.
    setVisibility('hidden')
    setVisibility('visible')
    await wait(10_000)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('posts nothing for a page opened in a background tab until it has been visible for 5 s', async () => {
    visibility = 'hidden'
    show()
    await wait(30_000)
    expect(post).not.toHaveBeenCalled()
    setVisibility('visible')
    setVisibility('visible')
    await wait(5000)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('starts over when Steven leaves the page before 5 s', async () => {
    const { unmount } = show()
    await wait(4000)
    unmount()
    await wait(10_000)
    expect(post).not.toHaveBeenCalled()
    show()
    await wait(4000)
    expect(post).not.toHaveBeenCalled()
    await wait(1000)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('posts nothing on scrolling, and nothing when nothing is unread', async () => {
    show({ reads: makeTeamReads({ read: unreadIds }) })
    fireEvent.scroll(window)
    await wait(30_000)
    expect(post).not.toHaveBeenCalled()
    expect(head()).toHaveTextContent('All seen')
  })

  it('waits for the read state before the clock starts', async () => {
    const { rerender } = show({ reads: null })
    expect(head().querySelector('.shimmer')).not.toBeNull()
    expect(document.querySelector('[data-new]')).toBeNull()
    await wait(10_000)
    expect(post).not.toHaveBeenCalled()
    rerender(<TeamPage manifest={makeTeamManifest()} reads={makeTeamReads()} readsError="" onPost={post} />)
    expect(head()).toHaveTextContent('2 not seen')
    await wait(5000)
    expect(post).toHaveBeenCalledWith('readAll', unreadIds)
  })

  it('then says Marked as seen with Undo in a polite live region, and keeps the markers for the visit', async () => {
    const manifest = makeTeamManifest()
    const { rerender } = show({ manifest })
    await wait(5000)
    expect(head()).toHaveAttribute('aria-live', 'polite')
    expect(head()).toHaveTextContent('Marked as seen')
    expect(within(head()).getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    // The server now has them read; the page keeps what was unread when the visit started.
    rerender(<TeamPage manifest={manifest} reads={makeTeamReads({ read: unreadIds })} readsError="" onPost={post} />)
    expect(part('Flow')).toHaveAttribute('data-new')
    expect(rows()[0]).toHaveClass('unread')
    expect(screen.getByText(/2 changes you have not seen/)).toBeInTheDocument()
  })

  it('Undo posts unread for exactly the ids it marked and keeps focus on the control', async () => {
    show()
    await wait(5000)
    const undo = within(head()).getByRole('button', { name: 'Undo' })
    undo.focus()
    await act(async () => { fireEvent.click(undo) })
    expect(post).toHaveBeenLastCalledWith('unread', unreadIds)
    expect(document.activeElement).toBe(undo)
    expect(undo).toHaveTextContent('Undone')
    expect(undo).toHaveAttribute('aria-disabled', 'true')
    expect(head()).toHaveTextContent('2 not seen')
    // Undone stays undone: the clock does not start again in this visit.
    fireEvent.click(undo)
    await wait(30_000)
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('says so when Undo could not be saved, and offers it again', async () => {
    show()
    await wait(5000)
    post.mockResolvedValueOnce(false)
    await act(async () => { fireEvent.click(within(head()).getByRole('button', { name: 'Undo' })) })
    expect(head()).toHaveTextContent('Could not mark them as unread; they stay seen.')
    await act(async () => { fireEvent.click(within(head()).getByRole('button', { name: 'Undo' })) })
    expect(head()).toHaveTextContent('2 not seen')
  })

  it('keeps everything unread when saving fails, says it will try again, and the next visit does', async () => {
    post.mockResolvedValueOnce(false)
    const { unmount } = show()
    await wait(5000)
    expect(part('What changed')).toHaveTextContent('Could not record that you have seen this; it will be tried again on your next visit.')
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    expect(head()).toHaveTextContent('2 not seen')
    expect(part('Flow')).toHaveAttribute('data-new')
    unmount()
    show()
    await wait(5000)
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('offers Mark as unread on read rows only, keeping focus on it', async () => {
    show()
    expect(within(rows()[0]).queryByRole('button', { name: /Mark as/ })).not.toBeInTheDocument()
    const button = within(rows()[2]).getByRole('button', { name: 'Mark as unread' })
    button.focus()
    await act(async () => { fireEvent.click(button) })
    expect(post).toHaveBeenCalledWith('unread', [sha('1')])
    expect(document.activeElement).toBe(button)
    expect(button).toHaveTextContent('Marked as unread')
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('says when Mark as unread was not saved', async () => {
    post.mockResolvedValueOnce(false)
    show()
    await act(async () => { fireEvent.click(within(rows()[2]).getByRole('button', { name: 'Mark as unread' })) })
    expect(rows()[2]).toHaveTextContent('Not saved; try again.')
    expect(within(rows()[2]).getByRole('button', { name: 'Mark as unread' })).toBeInTheDocument()
  })

  it('has no "Mark all as read" and no "Mark as seen" control', () => {
    show()
    expect(screen.queryByRole('button', { name: /mark all|mark as seen|mark as read/i })).not.toBeInTheDocument()
  })

  it('keeps nothing about read state in localStorage or sessionStorage', async () => {
    localStorage.clear()
    sessionStorage.clear()
    show()
    await wait(5000)
    await act(async () => { fireEvent.click(within(head()).getByRole('button', { name: 'Undo' })) })
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})

describe('what is new, marked', () => {
  it('marks an unread row with a hidden "Not seen:", New and a bold summary; a read row has none and stays listed', () => {
    show()
    const [fresh, , old] = rows()
    expect(within(fresh).getByText('Not seen:')).toHaveClass('visually-hidden')
    expect(within(fresh).getByText('New')).toHaveClass('badge', 'new')
    expect(within(fresh).getByText('The panel reviews every draft').tagName).toBe('STRONG')
    expect(fresh.querySelector('.team-dot')).toHaveAttribute('aria-hidden', 'true')
    expect(within(old).queryByText('Not seen:')).not.toBeInTheDocument()
    expect(within(old).queryByText('New')).not.toBeInTheDocument()
    expect(within(old).getByText('The editors review every change').tagName).toBe('P')
  })

  it('shows 5 changes, then Show all / Show fewer, keeping focus on the button', () => {
    const updates = Array.from({ length: 7 }, (_, index) => makeUpdate({ sha: String(index).repeat(40), summary: `Change ${index}`, beforeLaunch: true }))
    show({ manifest: makeTeamManifest({ history: { updates, older: 0, truncated: false } }) })
    expect(rows()).toHaveLength(5)
    const more = screen.getByRole('button', { name: 'Show all 7 changes' })
    more.focus()
    fireEvent.click(more)
    expect(rows()).toHaveLength(7)
    expect(more).toHaveTextContent('Show fewer')
    expect(document.activeElement).toBe(more)
    fireEvent.click(more)
    expect(rows()).toHaveLength(5)
  })

  it('marks a changed section: data-new, New in its heading and the line that says what changed', () => {
    show()
    const flow = part('Flow')
    expect(flow).toHaveAttribute('data-new')
    expect(flow).toHaveClass('is-new')
    expect(within(flow).getByRole('heading', { level: 2 })).toHaveTextContent('How a change gets to main New')
    expect(flow).toHaveAccessibleDescription('Changed 19 Oct: The panel reviews every draft (PR #41)')
    expect(part('What changed')).toHaveAttribute('data-new')
    expect(part('Commands')).not.toHaveAttribute('data-new')
    expect(part('Site update')).not.toHaveAttribute('data-new')
  })

  it('names the latest of two updates and says how many', () => {
    const manifest = makeTeamManifest()
    manifest.history!.updates[1] = { ...manifest.history!.updates[1], sections: ['roles', 'checks'] }
    show({ manifest })
    expect(part('Gates')).toHaveAccessibleDescription('Changed in 2 updates you have not seen, the latest on 19 Oct: The panel reviews every draft (PR #41)')
  })

  it('marks only the role card that changed', () => {
    show()
    const cards = within(part('Roles')).getAllByRole('article')
    expect(cards.map((card) => card.hasAttribute('data-new'))).toEqual([false, false, true])
    expect(within(cards[2]).getByRole('heading')).toHaveTextContent('Fact checker New')
  })

  it('marks the Site update part when an unread update touched it', () => {
    const manifest = makeTeamManifest()
    manifest.history!.updates[0] = { ...manifest.history!.updates[0], sections: ['siteUpdate'], steps: [] }
    show({ manifest })
    expect(part('Site update')).toHaveAttribute('data-new')
    expect(part('Site update')).toHaveTextContent('Changed 19 Oct: The panel reviews every draft (PR #41)')
    expect(within(part('Site update')).getByRole('link', { name: 'Open the workflow ↗' })).toHaveAttribute('href', `https://github.com/example/site/blob/${sha('c')}/.ci/site.yml`)
  })

  it('has no highlight on the next visit once its last update is read, and keeps it while another unread one touches it', () => {
    const manifest = makeTeamManifest()
    show({ manifest, reads: makeTeamReads({ read: [sha('3')] }) })
    expect(part('Flow')).not.toHaveAttribute('data-new')
    expect(part('Roles')).toHaveAttribute('data-new')
    cleanup()
    show({ manifest, reads: makeTeamReads({ read: unreadIds }) })
    expect(document.querySelector('[data-new]')).toBeNull()
    expect(screen.queryByText('New')).not.toBeInTheDocument()
    expect(head()).toHaveTextContent('All seen')
  })

  it('marks the changed step in the diagram', () => {
    show()
    const marked = [...part('Flow').querySelectorAll('.fd-node[data-changed]')]
    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveTextContent('Draft: drafts/slug.md')
  })

  it('names what each change touched as chips that go to the section', () => {
    const manifest = makeTeamManifest()
    manifest.history!.updates[0] = { ...manifest.history!.updates[0], removedSteps: ['Old step'], sections: ['flow', 'checks', 'siteUpdate'] }
    manifest.history!.updates.push(makeUpdate({ sha: sha('0'), summary: 'Every step', sections: ['flow', 'roles', 'commands'], steps: ['intake', 'draft', 'questions', 'publish'], beforeLaunch: true }), makeUpdate({ sha: sha('4'), summary: 'Unknown parts', sections: ['flow', 'roles'], roles: ['gone'], commands: [], steps: ['gone'], beforeLaunch: true }))
    show({ manifest })
    const chips = (row: HTMLElement) => [...row.querySelectorAll('.team-chip')].map((chip) => chip.textContent)
    const [first, second, third, fourth, fifth] = rows()
    expect(chips(first)).toEqual(['Flow: Draft', 'Gates', 'Site update', 'Removed: Old step'])
    expect(chips(second)).toEqual(['Roles: Fact checker'])
    expect(chips(third)).toEqual(['Commands: /publish'])
    expect(chips(fourth)).toEqual(['Flow: 4 steps', 'Roles', 'Commands'])
    expect(chips(fifth)).toEqual(['Flow: gone', 'Roles: gone'])
    const gates = within(first).getByRole('button', { name: 'Gates' })
    fireEvent.click(gates)
    const heading = within(part('Gates')).getByRole('heading', { level: 2 })
    expect(document.activeElement).toBe(heading)
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('scrolls without motion when Steven prefers less of it', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query }))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'See what changed ↓' }))
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
  })

  it('names a command it no longer has by its id, and lists commands it cannot read', () => {
    const manifest = makeTeamManifest({ sections: { ...makeTeamManifest().sections, commands: { unreadable: '.team/commands' } } })
    show({ manifest })
    expect(rows()[2].querySelector('.team-chip')).toHaveTextContent('Commands: /publish')
  })
})

describe('the notice at the top', () => {
  it('says how many changes are not seen and the latest, and See what changed moves focus to What changed', () => {
    show()
    expect(screen.getByText('2 changes you have not seen. Latest, 19 Oct: The panel reviews every draft.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'See what changed ↓' }))
    expect(document.activeElement).toBe(within(part('What changed')).getByRole('heading', { level: 2 }))
  })

  it('words one change, and is not there when all are read', () => {
    show({ reads: makeTeamReads({ read: [sha('3')] }) })
    expect(screen.getByText('1 change you have not seen, 18 Oct: The Team page shows the team.')).toBeInTheDocument()
    cleanup()
    show({ reads: makeTeamReads({ read: unreadIds }) })
    expect(screen.queryByRole('button', { name: 'See what changed ↓' })).not.toBeInTheDocument()
  })
})

describe('when the read state cannot be loaded', () => {
  it('shows the sections and the history, says Seen state unavailable, marks nothing and starts no clock', async () => {
    show({ reads: null, readsError: 'HTTP 500' })
    expect(head()).toHaveTextContent('Seen state unavailable')
    expect(rows()).toHaveLength(3)
    expect(document.querySelector('[data-new]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark as unread' })).not.toBeInTheDocument()
    await wait(30_000)
    expect(post).not.toHaveBeenCalled()
  })
})

describe('text from commits is only ever text', () => {
  it('renders summaries and labels literally in the history, notice, section marker, diagram and Needs you', () => {
    const evil = '<img src=x onerror=alert(1)> [x](javascript:alert(1))'
    const base = makeTeamManifest()
    const flow = base.flow as Flow
    const manifest: TeamManifest = makeTeamManifest({
      flow: { ...flow, diagram: { nodes: flow.diagram!.nodes.map((node) => (node.id === 'draft' ? { ...node, label: evil } : node)) } },
      history: { updates: [makeUpdate({ summary: evil })], older: 0, truncated: false },
      launch: sha('3'),
    })
    const { container } = show({ manifest })
    expect(rows()[0]).toHaveTextContent(evil)
    expect(screen.getByText(`1 change you have not seen, 19 Oct: ${evil}.`)).toBeInTheDocument()
    expect(part('Flow')).toHaveAccessibleDescription(`Changed 19 Oct: ${evil} (PR #41)`)
    expect(part('Flow').querySelector('.fd-node[data-changed]')).toHaveTextContent(evil)
    const data = { days: 7, stats: null, mcp: null, ask: null, resume: null, team: { manifest, reads: makeTeamReads(), readsError: '' } }
    const overview = render(<Overview data={data} needs={computeNeeds(data, NOW)} summaries={computeSummaries(data)} />)
    expect(overview.container).toHaveTextContent(evil.slice(0, 50))
    for (const root of [container, overview.container]) {
      expect(root.querySelector('img')).toBeNull()
      expect(root.querySelector('a[href^="javascript:"]')).toBeNull()
    }
  })

  it('links only to the repository: a commit, a pull request or a listed file, in a new tab without the opener', () => {
    const manifest = makeTeamManifest()
    manifest.history!.updates.push(makeUpdate({ sha: 'not-a-sha', pr: null, summary: 'Odd', beforeLaunch: true }))
    const { container } = show({ manifest })
    const links = [...container.querySelectorAll('a[href]')]
    expect(links.length).toBeGreaterThan(5)
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\/github\.com\/example\/site\/(commit\/[0-9a-f]{40}|pull\/\d+|blob\/[0-9a-f]{40}\/[^?#]+)$/)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    expect(within(rows()[0]).getByRole('link', { name: 'PR #41 ↗' })).toHaveAttribute('href', 'https://github.com/example/site/pull/41')
    expect(within(rows()[1]).getByRole('link', { name: '2222222 ↗' })).toHaveAttribute('href', `https://github.com/example/site/commit/${sha('2')}`)
    // An id that is not a commit is shown, never linked.
    expect(within(rows()[3]).queryByRole('link')).not.toBeInTheDocument()
    expect(rows()[3]).toHaveTextContent('not-a-s ↗')
  })

  it('shows a file the manifest does not list without a link', () => {
    show({ manifest: makeTeamManifest({ files: [] }) })
    expect(within(part('Roles')).queryByRole('link')).not.toBeInTheDocument()
    expect(within(part('Roles')).getAllByText('Open the brief ↗')).toHaveLength(2)
  })

  it('gives the date its full time on hover, and none when the date is unknown', () => {
    const manifest = makeTeamManifest()
    manifest.history!.updates[2] = { ...manifest.history!.updates[2], date: null }
    show({ manifest })
    expect(rows()[0].querySelector('.team-date')).toHaveAttribute('title')
    expect(rows()[2].querySelector('.team-date')).not.toHaveAttribute('title')
    expect(rows()[2]).toHaveTextContent('an unknown day')
  })
})
