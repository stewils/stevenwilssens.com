import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WilssensArticle from './wilssens/WilssensArticle'
import AIBreakerArticle from './aibreaker/AIBreakerArticle'
import SiteArticle, { ReportCard } from './site/SiteArticle'
import { LoopDiagram, TeamFlowDiagram } from './site/Diagrams'
import JuniorTrackCyclingArticle from './juniortrackcycling/JuniorTrackCyclingArticle'
import LeoArticle from './leo/LeoArticle'
import { Stats } from './wilssens/Stats'
import sources from './sources.json'
import wilssensFeed from './wilssens/feed.json'
import siteFeed from './site/feed.json'
import aibreakerFeed from './aibreaker/feed.json'
import juniorFeed from './juniortrackcycling/feed.json'
import leoFeed from './leo/feed.json'

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
    expect(feedOf(JuniorTrackCyclingArticle)).toBeNull()
  })

  it('keeps every feed in the shape the pages read: a date and finite numbers', () => {
    for (const feed of [wilssensFeed, siteFeed, aibreakerFeed, juniorFeed, leoFeed] as { asOf: string; numbers: Record<string, unknown> }[]) {
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
      expect(image).toHaveAccessibleDescription(/Six reviews run in parallel.*at most three rounds\. When all approve, the pull request runs its own required checks on GitHub: main’s gates, the team review, which also tries the assistant when a change touches it, and the site checks\. Steven merges, and the site deploys\. The agents’ runs, on GitHub and in Steven’s own Claude Code sessions, are metered/)
      for (const label of ['Spec', 'My questions', 'Build', 'Six reviews, in parallel', 'tests, 90% a file', 'recruiter: not worse', 'PM: acceptance', 'all approve', 'Pull request', 'I merge', 'Deploy']) expect(within(image).getByText(label)).toBeInTheDocument()
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
      expect(image).toHaveAccessibleDescription(/A developer builds it with its tests\. A build that changes nothing stops there: the run fails and Steven is told, so no empty pull request is opened\. Six reviews/)
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
