import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WilssensArticle from './wilssens/WilssensArticle'
import AIBreakerArticle from './aibreaker/AIBreakerArticle'
import SiteArticle, { ReportCard } from './site/SiteArticle'
import { LoopDiagram, TeamFlowDiagram } from './site/Diagrams'
import JuniorTrackCyclingArticle from './juniortrackcycling/JuniorTrackCyclingArticle'
import LeoArticle from './leo/LeoArticle'
import WattFightersArticle from './wattfighters/WattFightersArticle'
import { Stats } from './wilssens/Stats'
import sources from './sources.json'
import wilssensFeed from './wilssens/feed.json'
import siteFeed from './site/feed.json'
import aibreakerFeed from './aibreaker/feed.json'
import juniorFeed from './juniortrackcycling/feed.json'
import leoFeed from './leo/feed.json'
import wattFeed from './wattfighters/feed.json'

const report = { since: '2026-10-01', questions: 1234, answered: 30, gaps: 10, gapsCovered: 4, gapsOpen: 6, costMicro: 1_250_000, costPerAnswerMicro: 41_667, publicNotes: 3 }
const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => String(input) === '/api/ask/report' ? Response.json(report) : new Response('', { status: 404 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const articles = [
  ['building-wilssens', WilssensArticle, 'Building wilssens.com'],
  ['building-aibreaker', AIBreakerArticle, 'Building AI Breaker'],
  ['building-this-site', SiteArticle, 'Building steven.wilssens.com'],
  ['building-juniortrackcycling', JuniorTrackCyclingArticle, 'Building juniortrackcycling.com'],
  ['building-leo', LeoArticle, 'Building leo.wilssens.com'],
  ['building-wattfighters', WattFightersArticle, 'Building Watt Fighters'],
] as const

describe('the Building write-ups', () => {
  it.each(articles)('%s reads as a complete article: title, headline numbers, contents that point at real sections, diagrams with a name', (_page, Article, title) => {
    const { container } = render(<Article />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
    expect(screen.getByRole('link', { name: /Projects/ })).toHaveAttribute('href', '/projects')
    for (const link of container.querySelectorAll<HTMLAnchorElement>('[data-toc]')) expect(container.querySelector(`#${CSS.escape(link.dataset.toc!)}`), link.dataset.toc).not.toBeNull()
    for (const svg of container.querySelectorAll('.wx-diagram svg[role="img"]')) expect(svg.getAttribute('aria-label')).toBeTruthy()
    for (const image of container.querySelectorAll('img')) expect(image).toHaveAttribute('alt')
    const stats = container.querySelector('.wx-stats')
    if (stats) expect(stats.querySelectorAll('[data-stat]').length).toBeGreaterThan(0)
  })

  it.each(articles)('%s offers a LinkedIn share, and the assistant where the write-up has a button for it', async (_page, Article) => {
    const opened = vi.fn()
    window.addEventListener('sw-ask-open', opened)
    render(<Article />)
    const buttons = screen.queryAllByRole('button', { name: /^Ask (the assistant about my work|about Steven)$/ })
    for (const button of buttons) await userEvent.click(button)
    expect(opened).toHaveBeenCalledTimes(buttons.length)
    expect(screen.getAllByRole('link', { name: /Share on LinkedIn/ })[0].getAttribute('href')).toMatch(/^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=https%3A%2F%2Fsteven\.wilssens\.com%2Fbuilding-/)
    window.removeEventListener('sw-ask-open', opened)
  })

  it('asks the live feed for today\'s numbers only where the project has one', () => {
    const feedOf = (Article: () => React.JSX.Element) => { const { container, unmount } = render(<Article />); const feed = container.querySelector('.wx-stats')?.getAttribute('data-feed') ?? null; unmount(); return feed }
    expect(feedOf(WilssensArticle)).toBe('/api/building/wilssens')
    expect(feedOf(SiteArticle)).toBe('/api/building/site')
    expect(feedOf(LeoArticle)).toBeNull()
    expect(feedOf(WattFightersArticle)).toBeNull()
    expect(feedOf(JuniorTrackCyclingArticle)).toBeNull()
  })

  it('keeps every feed in the shape the pages read: a date and finite numbers', () => {
    for (const feed of [wilssensFeed, siteFeed, aibreakerFeed, juniorFeed, leoFeed, wattFeed] as { asOf: string; numbers: Record<string, unknown> }[]) {
      expect(Date.parse(feed.asOf)).not.toBeNaN()
      for (const [key, value] of Object.entries(feed.numbers)) expect(Number.isFinite(value), key).toBe(true)
    }
  })

  it('keeps development costs out of this site’s feed: the same four numbers, no cost figure', () => {
    expect(Object.keys(siteFeed.numbers).sort()).toEqual(['countries', 'proposalsApproved', 'pullRequestsMerged', 'vitalsGoodPercent'])
    expect(JSON.stringify(siteFeed)).not.toMatch(/cost|budget|token|usd/i)
  })

  it('lists every project the refresh loop watches', () => {
    expect(Object.keys(sources).filter((key) => !key.startsWith('_'))).toEqual(['wilssens', 'aibreaker', 'site', 'juniortrackcycling', 'leo'])
  })
})

describe('Stats', () => {
  it('shows each figure with its prefix and decimals, zero for one missing from the feed', () => {
    const { container } = render(<Stats project="demo" feed={{ asOf: '2026-10-19', numbers: { cost: 1.5 } }} items={[['cost', '$', 2, 'spent'], ['missing', '', 0, 'not counted yet']]} />)
    expect(container.querySelector('.wx-stats')).toHaveAttribute('data-feed', '/api/building/demo')
    expect(screen.getByText('spent').previousElementSibling).toHaveTextContent('$1.50')
    expect(screen.getByText('not counted yet').previousElementSibling).toHaveTextContent('0')
  })
})

describe('the assistant\'s report card on /building-this-site', () => {
  it('shows a sentence until the numbers load, then the live report', async () => {
    render(<ReportCard />)
    expect(screen.getByText(/The numbers load here from the site’s own database/)).toBeInTheDocument()
    const card = await screen.findByRole('figure', { name: 'The assistant’s report card' })
    expect(fetchMock).toHaveBeenCalledWith('/api/ask/report')
    expect(within(card).getByText('1,234')).toBeInTheDocument()
    expect(within(card).getByText('questions since 1 October 2026')).toBeInTheDocument()
    expect(within(card).getByText('75%')).toBeInTheDocument()
    expect(within(card).getByText('times my notes had no answer')).toBeInTheDocument()
    expect(within(card).getByText(/questions from readers I answered since, as public notes · 6 waiting/)).toBeInTheDocument()
    expect(within(card).getByText('$0.04')).toBeInTheDocument()
    expect(within(card).getByText('per answer · $1.25 in all')).toBeInTheDocument()
  })

  it('shows no vote and no score of Steven\'s, only the numbers about the answers', async () => {
    const { container } = render(<ReportCard />)
    expect(container.textContent).not.toMatch(/vote/i)
    const card = await screen.findByRole('figure', { name: 'The assistant’s report card' })
    expect(card.textContent).not.toMatch(/vote|helpful|rated|score/i)
    expect(card.querySelectorAll('.wx-report-grid > div')).toHaveLength(5)
  })

  it('/building-this-site says Steven reads and rates the answers, marks the wrong ones and compares versions, without a score', () => {
    const { container } = render(<SiteArticle />)
    const said = screen.getByText(/where I also read and rate the answers myself, mark the wrong ones and compare the model and instruction versions/)
    expect(said.textContent).not.toMatch(/vote|\d+ ?%|\d\/5/i)
    // The ratings are not what the card below shows.
    expect(said).toHaveTextContent('Those ratings stay private; the counts below are public, straight from the database.')
    expect(container.querySelector('.wx-report-wait')!.textContent).not.toMatch(/vote/i)
  })

  it('reads well on a first day: singular words, no share and no cost per answer yet', async () => {
    fetchMock.mockImplementation(async () => Response.json({ ...report, since: null, questions: 1, answered: 0, gaps: 1, gapsCovered: 1, costPerAnswerMicro: null }))
    render(<ReportCard />)
    const card = await screen.findByRole('figure')
    expect(within(card).getByText('questions')).toBeInTheDocument()
    expect(within(card).getByText('time my notes had no answer')).toBeInTheDocument()
    expect(within(card).getByText(/^question from readers/)).toBeInTheDocument()
    expect(within(card).getAllByText('—')).toHaveLength(1)
    fetchMock.mockImplementation(async () => Response.json({ ...report, answered: 0, gaps: 0 }))
    cleanup()
    render(<ReportCard />)
    expect(await screen.findAllByText('—')).toHaveLength(1)
  })

  it('keeps the sentence when the report fails, is not a report, or fetch is missing', async () => {
    fetchMock.mockImplementation(async () => new Response('', { status: 500 }))
    render(<ReportCard />)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
    cleanup()

    fetchMock.mockImplementation(async () => Response.json({ questions: 'many' }))
    render(<ReportCard />)
    await Promise.resolve()
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
    cleanup()

    fetchMock.mockRejectedValue(new Error('offline'))
    render(<ReportCard />)
    await Promise.resolve()
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
    cleanup()

    vi.stubGlobal('fetch', undefined)
    render(<ReportCard />)
    expect(screen.getByText(/The numbers load here/)).toBeInTheDocument()
  })

  it('ignores a report that arrives after the reader left', async () => {
    let answer: (response: Response) => void = () => {}
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { answer = resolve }))
    const view = render(<ReportCard />)
    view.unmount()
    answer(Response.json(report))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('the team diagram on /building-this-site', () => {
  it('still says the merge is mine: "I read the preview and merge", the loop diagram and the assistant\'s line about it (specs/mcp-prs-flow.md, AC-12)', async () => {
    render(<SiteArticle />)
    expect(document.getElementById('loop')!.closest('section')!.textContent).toContain('I read the preview and merge, from the same conversation if I like.')
    expect(screen.getByText(/the required checks on the pull request; I answer the questions and decide the merge\./)).toBeInTheDocument()
    cleanup()
    render(<LoopDiagram />)
    const loop = screen.getByRole('img', { name: /after Steven merges it, a change on the site/ })
    for (const label of ['I merge the pull request', 'after the preview', 'Claude Code edits', 'on a branch, under checks']) expect(within(loop).getByText(label)).toBeInTheDocument()
    const prompt = Object.values(import.meta.glob<string>('../../functions/_lib/ask/prompt.ts', { query: '?raw', import: 'default', eager: true }))[0]
    expect(prompt).toContain('through the same scored gate and tests he works under, and he reads the preview and merges.')
  })

  it('draws the flow across and stacked, each an image with its name and a description of every step', () => {
    render(<TeamFlowDiagram />)
    const images = screen.getAllByRole('img', { name: 'How a change reaches the site: a team of AI agents, and Steven deciding' })
    expect(images.map((image) => image.getAttribute('class'))).toEqual(['wx-flow-wide', 'wx-flow-tall'])
    for (const image of images) {
      expect(image).toHaveAccessibleDescription(/The reviews run in parallel, by fresh agents that did not write the code, and only for the parts the change touches.*a change to the rules or the team gets every role but the recruiter, who reviews only changes to the résumé and the site\. Changes go back to the developer for at most three rounds, and only the reviewers who asked, or whose part the fix touched, review again\. When all approve, the pull request runs its own required checks on GitHub: main’s gates, the team review, which also tries the assistant when a change touches it, and the site checks\. Steven merges, and the site deploys\. The agents’ runs, on GitHub and in Steven’s own Claude Code sessions, are metered/)
      for (const label of ['Spec', 'My questions', 'Build', 'Reviews, for the parts it touches', 'fresh agents; approvals carry over', 'tests, 90% a file', 'recruiter: not worse', 'PM: acceptance', 'all approve', 'Pull request', 'I merge', 'Deploy']) expect(within(image).getByText(label)).toBeInTheDocument()
    }
  })

  it('the Pull request box reads its own checks and the assistant tested in CI, across and stacked, each line within its box (specs/mcp-prs-flow.md, AC-12)', () => {
    render(<TeamFlowDiagram />)
    for (const image of screen.getAllByRole('img', { name: /a team of AI agents, and Steven deciding/ })) {
      const box = within(image).getByText('Pull request').parentElement!
      const lines = [...box.querySelectorAll('text')].map((text) => text.textContent)
      expect(lines).toEqual(['Pull request', 'its own checks: gates, team review,', 'site checks, assistant tested in CI'])
      // 11.5px text averages about 6.5px a character: the 272px box (276px stacked) holds about 40.
      for (const line of lines.slice(1)) expect(line!.length).toBeLessThanOrEqual(38)
      expect(within(image).getByText('I merge')).toBeInTheDocument()
      expect(image.textContent).not.toMatch(/GitHub App|workflow_dispatch|check run|token/i)
    }
  })

  it('the flow diagram shows the stop when nothing changed, across and stacked', () => {
    render(<TeamFlowDiagram />)
    for (const image of screen.getAllByRole('img', { name: /a team of AI agents, and Steven deciding/ })) {
      expect(image).toHaveAccessibleDescription(/A developer builds it with its tests\. A build that changes nothing stops there: the run fails and Steven is told, so no empty pull request is opened\. The reviews run in parallel/)
      for (const label of ['Nothing changed', 'the run fails', 'and I am told', 'Fix and review again,', 'at most three rounds']) expect(within(image).getByText(label)).toBeInTheDocument()
      // The stop is drawn in the stop colour, never the accent that marks where Steven decides.
      const box = within(image).getByText('Nothing changed').parentElement!.querySelector('rect')!
      expect(box).toHaveAttribute('stroke', 'var(--d-bad)')
      // Placed right after Build, so the scroll-in stagger shows it after Build.
      const parts = [...image.querySelectorAll('g[data-part]')].map((part) => part.querySelector('text')?.textContent)
      expect(parts.indexOf('Nothing changed')).toBe(parts.indexOf('Build') + 1)
    }
  })

  it('the pull request item says a run that changes nothing fails and tells Steven, and the paragraph after it is unchanged', () => {
    render(<SiteArticle />)
    const loop = document.getElementById('loop')!.closest('section')!
    const item = within(loop).getByText('Change the site, through a pull request.').closest('li')!
    expect(item.textContent).toContain('Questions only I can answer go into the spec and the pull request. A run that changes nothing fails and tells me so, instead of opening a pull request with nothing in it.')
    expect(item.textContent).not.toMatch(/\d/)
    const paragraph = within(loop).getByText(/^The agent never pushes to production\./)
    expect(paragraph.textContent).toBe('The agent never pushes to production. It has a short list of allowed tools, a turn limit, and the instructions I follow myself: never invent a number, leave a question in a comment when a fact is missing. Of the first six runs, two failed and made nothing and four opened pull requests; the header counts how many are merged by now. The failures cost minutes and showed me where the instructions were vague. The team reviewed its own setup first and found real problems: a pull request could rewrite the rules of its own review, the screenshots showed the dark theme for “light”, and the review would have refused the bot that opens the site’s pull requests. All three were fixed in the same pull request.')
  })

  it('sits in the loop section, with the step it explains', () => {
    render(<SiteArticle />)
    const loop = document.getElementById('loop')!.closest('section')!
    expect(within(loop).getByText('Put every change past a team.')).toBeInTheDocument()
    expect(within(loop).getByText(/it does five things/)).toBeInTheDocument()
    const images = within(loop).getAllByRole('img', { name: /a team of AI agents, and Steven deciding/ })
    expect(images).toHaveLength(2)
    // It fits a phone without swiping, so its caption drops the swipe hint.
    expect(images[0].closest('figure')).toHaveClass('wx-diagram--fits')
  })

  it('says the loop is metered per change, with a budget, in one sentence without a number, a price or "every"', () => {
    render(<SiteArticle />)
    const step = within(document.getElementById('loop')!.closest('section')!).getByText('Put every change past a team.').closest('li')!
    const sentence = step.textContent!.match(/[^.]*metered[^.]*\./)![0].trim()
    expect(sentence).toBe('The agents’ runs, on GitHub and in my own Claude Code sessions, are metered against the change they belong to, and in my sessions against the role that ran them; a change can have a budget, and the rounds that had to be redone are counted, so I can see which kind of change is worth the full team.')
    expect(sentence).not.toMatch(/\d|\$|\bevery\b|\ball\b|monthly/i)
    // The role is claimed only for Steven's own sessions: GitHub runs are not split by role.
    expect(sentence).toMatch(/in my sessions against the role/)
    expect(sentence.match(/role/g)).toHaveLength(1)
  })

  it('draws the metered layer in both drawings, inside the picture, with the same words in the description', () => {
    render(<TeamFlowDiagram />)
    const [wide, tall] = screen.getAllByRole('img', { name: /a team of AI agents, and Steven deciding/ })
    const label = 'Metered: runs count against their change, and a change can have a budget'
    expect(within(wide).getByText(label)).toBeInTheDocument()
    expect([...tall.querySelectorAll('text')].map((text) => text.textContent).join(' ')).toContain(label)
    for (const image of [wide, tall]) {
      // The description speaks of Steven in the third person throughout, the metered sentence included.
      expect(image).toHaveAccessibleDescription(/The agents’ runs, on GitHub and in Steven’s own Claude Code sessions, are metered against the change they belong to, and in his sessions against the role that ran them; a change can have a budget, and the rounds that had to be redone are counted, so he can see which kind of change is worth the full team\.$/)
      expect(image.querySelector('desc')!.textContent).not.toMatch(/\b(my|I|me)\b/)
      const height = Number(image.getAttribute('viewBox')!.split(' ')[3])
      const texts = [...image.querySelectorAll('text')].map((text) => Number(text.getAttribute('y')))
      const rects = [...image.querySelectorAll('rect')].map((rect) => Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')))
      expect(Math.max(...texts, ...rects)).toBeLessThanOrEqual(height)
      expect([...image.querySelectorAll('text')].filter((text) => /Metered|budget/.test(text.textContent!)).every((text) => !/\d/.test(text.textContent!))).toBe(true)
    }
    // On a phone the label breaks after the comma, each line within 44 characters.
    const lines = [...tall.querySelectorAll('text')].map((text) => text.textContent!).filter((text) => /Metered|can have a budget/.test(text))
    expect(lines).toEqual(['Metered: runs count against their change,', 'and a change can have a budget'])
    expect(lines.every((line) => line.length <= 44)).toBe(true)
  })

  it('says that changes to the team reach Steven in his admin as unread updates, with no number typed in', () => {
    render(<SiteArticle />)
    const step = within(document.getElementById('loop')!.closest('section')!).getByText('Put every change past a team.').closest('li')!
    const sentence = step.textContent!.match(/[^.]*unread updates[^.]*\./)![0].trim()
    expect(sentence).toBe('Changes to the agent team itself reach me in my admin as unread updates until I have seen them.')
    expect(sentence).not.toMatch(/\d/)
  })

  it('says the private MCP merges exactly the version I previewed or nothing, not while checks run, and after a failed check only with my yes (specs/building-steven-wi-49.md, AC-2, AC-4, AC-5)', () => {
    render(<SiteArticle />)
    const step = within(document.getElementById('loop')!.closest('section')!).getByText('Put every change past a team.').closest('li')!
    const text = step.textContent!
    const match = text.match(/from the same conversation if I like\.\s+([^.]*\.)/)
    expect(match).not.toBeNull()
    const sentence = match![1]
    expect(sentence).toMatch(/^My private MCP merges/)
    for (const said of [/exactly the version I previewed/, /or nothing/, /still running/, /failed check only with my explicit yes/]) expect(sentence).toMatch(said)
    expect(sentence).not.toMatch(/\d|https?:|merge_site_update|updateName|\bsay\b|acceptFailingChecks|acceptLowerScore|\bconfirm\b|recheck|\bsha\b|commit|\bhead\b|MCP tool|check run|branch|redo|conflict|\/mcp\/|\bgates\b|ADMIN_TOKEN|token|\bkey\b|pull request/i)
    // About failed checks the stop is Steven's to overrule, so no absolute word and no claim that GitHub enforces it.
    expect(sentence).not.toMatch(/cannot|safely|guaranteed|GitHub/i)
    expect(sentence.match(/never/g)).toHaveLength(1)
    expect(sentence).toMatch(/never while the checks are still running,/)
    // "MCP" only as "private MCP", never a bare one a reader could take for the public read-only server.
    expect(sentence.match(/MCP/g)).toHaveLength((sentence.match(/private MCP/g) ?? []).length)
    expect(text).not.toMatch(/\d/)
    // Main's bullet was 175 words (its text content split on spaces); the refresh may add 30.
    expect(sentence.trim().split(/\s+/).length).toBeLessThanOrEqual(30)
    expect(text.trim().split(/\s+/).length).toBeLessThanOrEqual(175 + 30)
  })
})

describe('the assistant section on /building-this-site', () => {
  it('the assistant section says the dashboard counts the people who asked, kept 90 days, nothing kept when the browser asks not to be tracked', () => {
    render(<SiteArticle />)
    const section = document.getElementById('assistant')!.closest('section')!
    const list = section.querySelector('ul')!
    // Exactly one paragraph between the list and the report card (shown here while it loads).
    const after = [...section.children].slice([...section.children].indexOf(list) + 1)
    const card = after.findIndex((element) => element.matches('.wx-report-wait, .wx-report'))
    expect(card).toBe(1)
    expect(after.slice(0, card).map((element) => element.tagName)).toEqual(['P'])
    const paragraph = after[0] as HTMLElement
    const text = paragraph.textContent!
    expect(text).toMatch(/\bI\b|\bmy\b/)
    for (const said of [/different people/, /once a day/, /what each/, /90[ -]days?/, /Questions, cost and the unanswered questions/, /straight from the database/]) expect(text).toMatch(said)
    expect(text).not.toMatch(/vote/i)
    expect(text).toMatch(/I measured what I shipped at Microsoft; the assistant gets the same treatment, including the numbers that do not flatter it\.$/)
    const link = within(paragraph).getByRole('link', { name: /asks not to be tracked/ })
    expect(link).toHaveAttribute('href', '/privacy')
    expect(text).not.toMatch(/ask_log|ask_questions|ask_hits|HASH_SALT|ASK_BUDGET|visitor\.ts|migration|USD|\$/)
    expect(text).not.toMatch(/anonymous|unique people|deleted/i)
    expect(text.match(/\d+/g)).toEqual(['90'])
    // Main's paragraph was 44 words; the refresh may add about 40, and the ratings sentence about 20.
    expect(text.trim().split(/\s+/).length).toBeLessThanOrEqual(44 + 45 + 20)
  })
})

describe('Keeping it working, on /building-wattfighters', () => {
  const section = (container: HTMLElement, id: string) => container.querySelector<HTMLElement>(`section[aria-labelledby="${id}"]`)!
  const headings = (container: HTMLElement) => [...container.querySelectorAll('.wx-body h2.wx-h2')].map((h) => [h.id, h.textContent])

  it('adds sections 10 to 12 after What the AI got wrong, renumbers the rest, and lists them all in the contents', () => {
    const { container } = render(<WattFightersArticle />)
    expect(headings(container).slice(8)).toEqual([
      ['wrong', '09What the AI got wrong, and how it was caught'],
      ['fixing', '10Keeping it working: from a problem to a fix'],
      ['alone', '11When a fix may go live on its own'],
      ['alerts', '12The alerts, and the bell'],
      ['estimate', '13The estimate, and its limits'],
      ['practices', '14Best practices'],
      ['next', '15What’s next'],
    ])
    const toc = [...container.querySelectorAll<HTMLAnchorElement>('[data-toc]')]
    expect(toc.map((link) => link.dataset.toc)).toEqual(headings(container).map(([id]) => id))
    expect(toc.slice(9, 12).map((link) => [link.getAttribute('href'), link.textContent])).toEqual([['#fixing', 'Keeping it working'], ['#alone', 'When a fix may go live on its own'], ['#alerts', 'The alerts, and the bell']])
  })

  it('adds the leadership bullet, word for word, linking to the first new section', () => {
    const { container } = render(<WattFightersArticle />)
    const brief = container.querySelector('.wx-brief')!
    const items = brief.querySelectorAll('li')
    expect(items).toHaveLength(4)
    expect(items[3]).toHaveTextContent('Safe speed needs rules for when a machine may ship. The rules are built: a fix goes live on its own only when a test shows the problem, every test passes, many players have it, and it touches no protected part. Until I switch off the Stop switch, every fix still waits for me. Keeping it working')
    expect(within(items[3] as HTMLElement).getByRole('link', { name: 'Keeping it working' })).toHaveAttribute('href', '#fixing')
    expect(container.querySelector('#fixing')).not.toBeNull()
  })

  it('starts every step of the three sections with Built or Planned, and marks the built ones exactly', () => {
    const { container } = render(<WattFightersArticle />)
    const steps = ['fixing', 'alone', 'alerts'].flatMap((id) => [...section(container, id).querySelectorAll<HTMLElement>('.wx-points > li')])
    // The protected parts are one list under a step that is already marked Built.
    const protectedParts = steps.filter((li) => li.textContent!.endsWith(';') || li.textContent!.endsWith('(tests not counted).'))
    expect(protectedParts.map((li) => li.textContent)).toEqual(['the databases’ migrations;', 'sign-in and accounts;', 'payments and anything that charges money;', 'secrets and settings files, and the list of packages;', 'Leo’s games, the deploy script, and the fixer itself;', 'any change bigger than 10 files or 300 lines (tests not counted).'])
    const marked = steps.filter((li) => !protectedParts.includes(li))
    for (const li of marked) expect(li.firstElementChild?.tagName, li.textContent!).toBe('STRONG')
    for (const li of marked) expect(li.firstElementChild!.textContent, li.textContent!).toMatch(/^(Built|Planned)\.$/)
    const built = marked.filter((li) => li.firstElementChild!.textContent === 'Built.').map((li) => li.textContent!)
    const builtSteps = [
      'My own marks. In debug mode I mark a moment in a race and write on the admin page what went wrong. The note goes to the fixer.',
      'The game. It catches every error',
      'The server. It reports every error and checks itself every 5 minutes',
      'Players’ messages. Claude decides',
      'A problem counts once 3 different people have hit it.',
      'A bug players write about is loud at 20% in the hour or 10% in the day. That is a switch, off to begin with.',
      'The fixer is a Claude Code session that starts every 5 minutes, in a clean copy of the code. It writes a failing test first, then the fix, and every test must pass.',
      'The fix waits for me as a pull request on GitHub. I release it with “Release it” on the admin page, or by merging the pull request. Either way every test runs before it goes live.',
      'Releases go out at most once an hour, bundled, and every test runs.',
      'Every mark gets a GitHub issue. It is commented when a fix is ready and closed when the fix is live.',
      'After a release, 2 hours of watching.',
      'No failing test, no fix.',
      'The protected parts.',
      'A fix waits for me as a pull request on GitHub, with Claude’s summary, the test that showed the problem, the size of the change and my own words. I release it on the admin page or by merging the pull request.',
      'When a fix goes live, is sent back or is left, the fixer closes its pull request and says why. A fix that touches a protected part gets a comment on its pull request: read it before you release it.',
      'A loud problem’s fix that touches no protected part sends me an email, and goes live after one hour unless I tap “Let me check it first”. A Stop switch keeps every fix waiting for me, and it is on to begin with.',
      'A fix the fixer can’t make sends me an email saying why.',
      'When the problem is loud, that email is marked urgent.',
      'After a release, the server watches the problems it fixed for 2 hours',
      'Emails go to support@wattfighters.com when a fix is ready, when it can’t be made, when it is live, and when it fails to go live.',
      'An email also says how many players have it and what share that is',
      'The buttons in an email (“Release it”, “Let me check it first”) are links that work once and for 24 hours.',
      'Bundles. Fixes go live together, never two releases within an hour',
      'A fix that would join a bundle with less than 15 minutes left waits for the next one',
    ]
    expect(built).toHaveLength(builtSteps.length)
    builtSteps.forEach((step, i) => expect(built[i].startsWith(`Built. ${step}`), built[i]).toBe(true))
    // What is still planned says so: only the texts, and the same sentence in the game’s server list.
    const planned = marked.filter((li) => li.firstElementChild!.textContent === 'Planned.').map((li) => li.textContent!)
    expect(planned).toEqual(['Planned. A text message goes out only for a loud problem: at most one an hour per problem and 6 a day in all, with one link. Replying CHECK stops the hour. The texts are written into the code; they start when the text message service is set up.'])
    const server = built.find((text) => text.startsWith('Built. The server.'))!
    expect(server).toContain('A check for 1 in 20 race messages slower than 250 ms is still planned, because the game doesn’t time those messages yet.')
    expect(server).not.toContain('1 in 20 answers slower than 2 seconds, 1 in 20 race')
    expect(built.find((text) => text.startsWith('Built. The game.'))).toContain('The Windows and Android apps catch their own crashes too; that reaches players with their next app builds.')
    expect(section(container, 'alone')).toHaveTextContent('They are on the admin page’s QOS tab, with the problems, the fixes and the server’s health.')
    expect(section(container, 'alone')).not.toHaveTextContent('the switches arrive with the features they control')
    expect(section(container, 'fixing').querySelector(':scope > p')!.textContent).toContain('Almost all of it runs today. Each step still says which: Built runs today, Planned is written down and not built.')
    expect(section(container, 'alerts').querySelector(':scope > p:last-of-type')!.textContent).toMatch(/^Built\. The bell, for players\./)
    for (const id of ['fixing', 'alone', 'alerts']) expect(container.querySelector(`#${id}`)!.textContent).not.toMatch(/Built|Planned/)
  })

  it('keeps every number of the ask', () => {
    const { container } = render(<WattFightersArticle />)
    const text = ['fixing', 'alone', 'alerts'].map((id) => section(container, id).textContent).join(' ')
    for (const phrase of [
      'checks itself every 5 minutes', 'Both windows slide every 5 minutes', 'starts every 5 minutes', 'once 3 different people', '5% of the people playing in the last hour', '10% of everyone who played in the last 24 hours', 'at least 5 people have it',
      'loud at 20% in the hour or 10% in the day', 'off to begin with', 'under 10 frames a second for 10 seconds', 'frozen over 5 seconds', 'more than 2% errors on a route', '1 in 20 answers slower than 2 seconds',
      '1 in 20 race messages slower than 250 ms', 'more than 5% of online riders dropped', 'checks from outside every minute', 'bigger than 10 files or 300 lines (tests not counted)', 'goes live after one hour', 'for 2 hours',
      'less than 15 minutes left', 'at least 15 minutes to stop it', 'work once and for 24 hours', 'at most one an hour per problem and 6 a day in all', 'pops up for 8 seconds', '4 riders (2%)', '14:05',
    ]) expect(text, phrase).toContain(phrase)
  })

  it('draws the three diagrams twice, across and stacked, each with its own title, description and marks', () => {
    const { container } = render(<WattFightersArticle />)
    const figures = ['fixing', 'alone', 'alerts'].map((id) => section(container, id).querySelector('figure')!)
    const ids = new Set<string>()
    for (const [figure, title] of figures.map((figure, i) => [figure, ['From a problem to a fix', 'Who decides', 'The hour'][i]] as const)) {
      expect(figure).toHaveClass('wx-diagram--fits')
      const svgs = [...figure.querySelectorAll<SVGElement>('svg[role="img"]')]
      expect(svgs.map((svg) => svg.getAttribute('class'))).toEqual(['wx-flow-wide', 'wx-flow-tall'])
      for (const svg of svgs) {
        expect(svg.querySelector('title')).toHaveTextContent(title)
        const desc = svg.querySelector('desc')!
        expect(svg.getAttribute('aria-describedby')).toBe(desc.id)
        expect(desc.textContent).toMatch(/\(built\)/)
        if (title !== 'From a problem to a fix') expect(desc.textContent).toMatch(/\(planned/)
        else expect(desc.textContent).not.toMatch(/planned/)
        ids.add(desc.id)
        for (const marker of svg.querySelectorAll('marker')) ids.add(marker.id)
        // Every marked part says it in words, and only planned parts are dashed.
        for (const part of svg.querySelectorAll('[data-status]')) {
          const word = part.getAttribute('data-status') === 'built' ? 'Built' : 'Planned'
          if (part.querySelector('text')) expect(part.textContent).toContain(word)
          for (const shape of part.querySelectorAll(':scope > rect, :scope > path')) expect(shape.hasAttribute('stroke-dasharray')).toBe(word === 'Planned')
        }
        for (const node of svg.querySelectorAll('[font-size]')) expect(Number(node.getAttribute('font-size'))).toBeGreaterThanOrEqual(11)
        expect(svg.innerHTML).not.toMatch(/d-warn/)
      }
      // The legend: words carry the meaning, the swatches are decoration.
      const legend = figure.querySelector('.wx-legend')!
      expect(legend).toHaveTextContent('Built, working today')
      expect(legend).toHaveTextContent('Planned, written down, not built')
      for (const swatch of legend.querySelectorAll('svg')) expect(swatch).toHaveAttribute('aria-hidden', 'true')
    }
    expect(ids.size).toBe(8)
    const [flow, decide, hour] = figures
    expect([...flow.querySelector('.wx-flow-wide')!.querySelectorAll('[data-status]')].map((part) => [part.querySelector('text')!.textContent, part.getAttribute('data-status')])).toEqual([
      ['My marks in races', 'built'], ['Game errors and crashes', 'built'], ['Server errors and health', 'built'], ['Players’ messages', 'built'],
      ['Count', 'built'], ['The fixer', 'built'], ['The decision', 'built'], ['Loud: live in an hour', 'built'], ['The release', 'built'], ['Watching for 2 hours', 'built'], ['Problem gone', 'built'], ['New loud problem', 'built'],
    ])
    expect(decide.querySelector('.wx-flow-wide')!.textContent).toMatch(/Touches a protected part.*Built.*always waits for me/)
    expect([...decide.querySelector('.wx-flow-wide')!.querySelectorAll('[data-status]')].map((part) => part.getAttribute('data-status'))).toEqual(['built', 'built', 'built', 'built', 'built', 'planned'])
    expect([...hour.querySelector('.wx-flow-wide')!.querySelectorAll('g[data-status]')].map((part) => [part.querySelector('text')!.textContent, part.getAttribute('data-status')])).toEqual([
      ['Built · “Let me check it first” stops it at any time', 'built'], ['Problem turns loud', 'built'], ['Fix ready', 'built'], ['Email', 'built'], ['Other fixes join', 'built'], ['15 minutes left', 'built'], ['Goes live', 'built'], ['Watching', 'built'], ['Text', 'planned'], ['One bundle, at most one release an hour', 'built'],
    ])
    // The stacked hour keeps the text message as its one dashed step.
    expect([...hour.querySelector('.wx-flow-tall')!.querySelectorAll('g[data-status="planned"]')].map((part) => part.querySelector('text')!.textContent)).toEqual(['Text message'])
  })

  it('says a waiting fix is released with “Release it” or a merged pull request, in both drawings of both diagrams', () => {
    const { container } = render(<WattFightersArticle />)
    const [flow, decide] = ['fixing', 'alone'].map((id) => section(container, id).querySelector('figure')!)
    const built = (svg: SVGElement, title: string) => [...svg.querySelectorAll<SVGGElement>('g[data-status="built"]')].find((part) => part.querySelector('text')!.textContent === title)!
    for (const [figure, title] of [[flow, 'The decision'], [decide, 'Fix ready']] as const) {
      for (const svg of figure.querySelectorAll<SVGElement>('svg[role="img"]')) {
        const box = built(svg, title)
        expect([...box.querySelectorAll('text')].map((text) => text.textContent)).toEqual(expect.arrayContaining(['Built', 'waits for my “Release it”', 'or a merge']))
        expect(svg.querySelector('desc')!.textContent).toContain('waits for my Release it or a merged pull request')
      }
    }
    // The loud pill sits inside the taller decision box, below its last line.
    for (const svg of flow.querySelectorAll<SVGElement>('svg[role="img"]')) {
      const box = built(svg, 'The decision')
      const frame = box.querySelector('rect')!
      const lastLine = [...box.querySelectorAll('text')].at(-1)!
      const pill = [...svg.querySelectorAll<SVGGElement>('g[data-status="built"]')].find((part) => part.querySelector('text')!.textContent === 'Loud: live in an hour')!.querySelector('rect')!
      const [top, height] = [Number(frame.getAttribute('y')), Number(frame.getAttribute('height'))]
      const pillTop = Number(pill.getAttribute('y'))
      expect(pillTop).toBeGreaterThan(Number(lastLine.getAttribute('y')))
      expect(pillTop + Number(pill.getAttribute('height'))).toBeLessThanOrEqual(top + height)
    }
  })

  it('says in the captions and the drawings that the Stop switch keeps every fix waiting', () => {
    const { container } = render(<WattFightersArticle />)
    expect(section(container, 'fixing').querySelector('figcaption')).toHaveTextContent('While the Stop switch is on, every fix waits for my “Release it”.')
    expect(container.textContent).not.toMatch(/Today every fix waits/)
    for (const id of ['fixing', 'alone']) for (const svg of section(container, id).querySelectorAll('svg[role="img"]')) expect(svg.textContent).toMatch(/While the Stop switch is on,\s*every fix waits for my “Release it”\./)
    expect(section(container, 'alone').querySelector('desc')!.textContent).toContain('while the Stop switch is on, every fix waits for me')
  })

  it('marks every switch Built, the Stop switch first', () => {
    const { container } = render(<WattFightersArticle />)
    const table = section(container, 'alone').querySelector('.wx-table-wrap > table.wx-table')!
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Switch', 'Starts', 'Can it change'])
    expect([...table.querySelectorAll('tbody tr')].map((row) => [...row.children].map((cell) => cell.textContent))).toEqual([
      ['Built. Stop: every fix waits for me', 'On', 'Yes'],
      ['Built. A second Claude check of every fix', 'Off', 'Yes'],
      ['Built. Players’ bugs to the fixer', 'Off', 'Yes'],
      ['Built. A loud problem needs 5 people', 'On', 'Yes'],
      ['Built. A problem counts from 3 people', 'On', 'Yes'],
      ['Built. Go back to the old version on a new loud problem', 'On', 'Yes'],
      ['Built. Protected parts wait for review', 'On', 'No, it can’t be switched off'],
      ['Built. At most one release an hour', 'On', 'No, it can’t be switched off'],
    ])
    for (const cell of table.querySelectorAll('tbody td')) expect(cell.getAttribute('data-label')).toBe(table.querySelectorAll('thead th')[(cell as HTMLTableCellElement).cellIndex].textContent)
    expect(section(container, 'alone')).toHaveTextContent('each change is logged and emailed. They are on the admin page’s QOS tab, with the problems, the fixes and the server’s health.')
  })

  it('names no laptop, no repository and no phone number, anywhere on the page, the diagrams included', () => {
    const { container } = render(<WattFightersArticle />)
    expect(container.textContent).not.toMatch(/laptop|repositor|\brepo\b/i)
    expect(container.textContent).not.toMatch(/\+?\d[\d ().-]{8,}\d/)
    expect(container.textContent!.match(/[\w.+-]+@[\w-]+\.[\w.]+/g)).toEqual(['support@wattfighters.com'])
  })
})
