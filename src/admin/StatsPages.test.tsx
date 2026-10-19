import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudiencePage } from './AudiencePage'
import { CrawlersPage } from './CrawlersPage'
import { makeStats, NOW } from '../test/admin-fixtures'
import { LinksPage } from './LinksPage'
import { SourcesPage } from './SourcesPage'
import { SpeedPage } from './SpeedPage'
import { TrafficPage } from './TrafficPage'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const card = (name: string) => screen.getByRole('heading', { level: 2, name }).closest('section')!

describe('Traffic page', () => {
  it('summarizes the visitors against the period before', () => {
    render(<TrafficPage stats={makeStats()} />)
    const summary = within(screen.getByLabelText('Summary'))
    expect(summary.getByText('Visitors').parentElement).toHaveTextContent('Visitors40same vs the 7 days before')
    expect(summary.getByText('Pageviews').parentElement).toHaveTextContent('3.0 per visitor · +20% vs the 7 days before')
    expect(summary.getByText('1m 35s')).toBeInTheDocument()
    expect(summary.getByText('62%')).toBeInTheDocument()
    expect(summary.getByText('35%')).toBeInTheDocument()
    expect(summary.getByText('Résumé downloads').parentElement).toHaveTextContent('by 5 visitors · new vs the 7 days before')
    expect(summary.getByText('Contact clicks').parentElement).toHaveTextContent('−25% vs the 7 days before')
    expect(screen.getByRole('img', { name: /Visitors per day: visitors per day\. Latest 8, peak 10\./ })).toBeInTheDocument()
    expect(screen.getByText('Peak 21')).toBeInTheDocument()
  })

  it('shows zero pageviews per visitor on an empty range', () => {
    render(<TrafficPage stats={makeStats({ totals: { pageviews: 0, visitors: 0, avgDurationMs: null, avgScrollPct: null, bounceRate: null, downloads: 0, downloaders: 0, contactClicks: 0 }, visitors: [], pages: [], clicks: [], recent: [] })} />)
    expect(screen.getByText(/^0 per visitor/)).toBeInTheDocument()
    expect(screen.getByText('No visitors in this range yet')).toBeInTheDocument()
    expect(screen.getByText('No pageviews yet')).toBeInTheDocument()
    expect(screen.getByText('No clicks yet')).toBeInTheDocument()
    expect(screen.getByText('Nothing recorded yet')).toBeInTheDocument()
  })

  it("lists who visited and opens a visitor's journey", () => {
    render(<TrafficPage stats={makeStats()} />)
    const visitors = within(screen.getByRole('table', { name: 'Visitors' }))
    expect(visitors.getByText('Microsoft')).toBeInTheDocument()
    expect(visitors.getByText('Seattle, Washington, US')).toBeInTheDocument()
    expect(visitors.getAllByText('Unknown', { selector: 'td' })).toHaveLength(2)
    expect(visitors.getByText('· linkedin.com')).toBeInTheDocument()
    expect(visitors.getByText('Downloaded')).toBeInTheDocument()
    expect(visitors.getByText('3m 0s')).toBeInTheDocument()
    fireEvent.click(visitors.getByText('Microsoft').closest('tr')!)
    expect(screen.getByText('/ → /work → /about')).toBeInTheDocument()
    expect(screen.getByText('Résumé PDF', { selector: 'p' })).toBeInTheDocument()
    fireEvent.click(visitors.getByText('Direct').closest('tr')!)
    expect(screen.getByText('nothing')).toBeInTheDocument()
  })

  it('lists the pages, the clicks and the activity log', () => {
    render(<TrafficPage stats={makeStats()} />)
    const pages = within(screen.getByRole('table', { name: 'Pages' }))
    expect(pages.getByText('/work').closest('tr')).toHaveTextContent('/work2512——')
    const clicks = within(screen.getByRole('table', { name: 'Clicks' }))
    expect(clicks.getByText('download')).toHaveClass('badge', 'download')
    expect(clicks.getByText('Email Steven').closest('tr')).toHaveTextContent('—')
    const log = within(screen.getByRole('table', { name: 'Activity log' }))
    expect(log.getByText('1m 5s · 80% scrolled')).toBeInTheDocument()
    expect(log.getByText('from google.com')).toBeInTheDocument()
    expect(log.getAllByText('engagement')).toHaveLength(1)
    // A click without a category still sorts and shows.
    fireEvent.click(log.getByRole('button', { name: 'Event' }))
    expect(log.getAllByRole('row')).toHaveLength(6)
  })
})

describe('Sources page', () => {
  it('ranks the channels and referrers', () => {
    render(<SourcesPage stats={makeStats()} />)
    expect(within(card('Channels')).getByText('Social')).toBeInTheDocument()
    const referrers = card('Referrers and campaigns')
    expect(within(referrers).getByText('linkedin.com')).toBeInTheDocument()
    expect(within(referrers).getAllByText('No data yet')).toHaveLength(2)
  })

  it('copies a tracking link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<SourcesPage stats={makeStats()} />)
    const linkedIn = screen.getByText('https://steven.wilssens.com/?ref=linkedin').closest('li')!
    await act(async () => { fireEvent.click(within(linkedIn).getByRole('button', { name: 'Copy' })) })
    expect(writeText).toHaveBeenCalledWith('https://steven.wilssens.com/?ref=linkedin')
    expect(within(linkedIn).getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(2)
  })

  it('does nothing when the browser has no clipboard', () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    render(<SourcesPage stats={makeStats()} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0])
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3)
  })
})

describe('Audience page', () => {
  it('ranks organizations, places, devices, languages and screens', () => {
    render(<AudiencePage stats={makeStats()} />)
    expect(within(card('Organizations')).getByText('Microsoft')).toBeInTheDocument()
    expect(within(card('Places')).getByText('Belgium')).toBeInTheDocument()
    expect(within(card('Devices and browsers')).getByText('Windows')).toBeInTheDocument()
    expect(within(card('Languages and screens')).getByText('1920x1080')).toBeInTheDocument()
  })
})

describe('Links page', () => {
  it('links every address for running the site, opening in a new tab', () => {
    render(<LinksPage />)
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['The site', 'Cloudflare', 'GitHub', 'Profiles', 'Outside checks'])
    const pdf = screen.getByRole('link', { name: /Résumé PDF/ })
    expect(pdf).toHaveAttribute('href', 'https://steven.wilssens.com/steven-wilssens-resume-2026.pdf')
    expect(pdf).toHaveAttribute('target', '_blank')
    expect(within(pdf).getByText('steven.wilssens.com/steven-wilssens-resume-2026.pdf')).toBeInTheDocument()
  })
})

describe('Crawlers page', () => {
  it('shows the totals, the trend and the tables', () => {
    render(<CrawlersPage stats={makeStats()} />)
    expect(screen.getByText('from 4 crawlers')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Crawler requests per day/ })).toBeInTheDocument()
    const bots = within(screen.getByRole('table', { name: 'Crawlers' }))
    expect(bots.getByText('AI assistant')).toHaveClass('badge', 'ai-assistant')
    expect(bots.getByText('ChatGPT-User').closest('tr')).toHaveTextContent('Unknown +2 more')
    expect(bots.getByText('Googlebot').closest('tr')).not.toHaveTextContent('more')
    const pages = within(screen.getByRole('table', { name: 'Most crawled pages' }))
    expect(pages.getByText('· 404')).toBeInTheDocument()
    expect(pages.getAllByRole('row')).toHaveLength(3)
    const hits = within(screen.getByRole('table', { name: 'Latest crawls' }))
    expect(hits.getByText('200')).toBeInTheDocument()
    expect(hits.getByText('Search engine')).toBeInTheDocument()
  })

  it('says when no crawler came by', () => {
    render(<CrawlersPage stats={makeStats({ crawlTotals: { requests: 0, bots: 0, search: 0, ai: 0, assistant: 0, other: 0, errors: 0, probes: 0 } })} />)
    expect(screen.getByText('No crawler requests in this range yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('Page speed page', () => {
  it('rates each device type and each metric in the order Google lists them', () => {
    const { container } = render(<SpeedPage vitals={makeStats().vitals} />)
    expect(screen.getByText('✓ Passes')).toBeInTheDocument()
    expect(screen.getByText('✕ Fails')).toBeInTheDocument()
    expect(screen.getByText('Not enough data')).toBeInTheDocument()
    expect(screen.getByText('LCP 4.20s · INP — · CLS —')).toBeInTheDocument()
    expect([...container.querySelectorAll('.vital')].map((vital) => vital.firstChild!.firstChild!.textContent!.trim())).toEqual(['LCP', 'CLS', 'TTFB'])
    expect(screen.getByText('✓ Good')).toBeInTheDocument()
    expect(screen.getByText('! Needs work')).toBeInTheDocument()
    expect(screen.getByText('✕ Poor')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '90% good, 5% needs work, 5% poor' })).toBeInTheDocument()
  })

  it('lists the pages and the elements to fix', () => {
    render(<SpeedPage vitals={makeStats().vitals} />)
    const pages = within(screen.getByRole('table', { name: 'Web vitals by page' }))
    expect(pages.getByText('1.80s')).toHaveClass('status-text', 'good')
    expect(pages.getByText('0.30')).toHaveClass('poor')
    expect(pages.getByText('120ms')).toHaveClass('good')
    expect(pages.getAllByText('—')).toHaveLength(2)
    const culprits = within(screen.getByRole('table', { name: 'Slow elements' }))
    expect(culprits.getByText('4.50s')).toHaveClass('poor')
    expect(culprits.getByText('img.hero')).toBeInTheDocument()
  })

  it('says when nothing was measured yet', () => {
    render(<SpeedPage vitals={{ metrics: [], pages: [], devices: [], culprits: [] }} />)
    expect(screen.getByText('No measurements yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
