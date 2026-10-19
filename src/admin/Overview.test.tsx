import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeAsk, makeMcp, makeResume, makeStats, makeTeamManifest, makeTeamReads, NOW, sha } from '../test/admin-fixtures'
import { computeNeeds, computeSummaries } from './needs'
import { Overview } from './Overview'
import type { AdminData, ResumeReport } from './types'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const full = (overrides: Partial<AdminData> = {}): AdminData => ({ days: 7, stats: makeStats(), mcp: makeMcp(), ask: makeAsk(), resume: makeResume(), ...overrides })
const show = (data: AdminData) => render(<Overview data={data} needs={computeNeeds(data, NOW)} summaries={computeSummaries(data)} />)
const kpi = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!
const withReport = (report: Partial<ResumeReport>) => makeResume({ report: { ...makeResume().report!, ...report } })

describe('Overview', () => {
  it('shows the headline numbers against the period before', () => {
    show(full())
    expect(kpi('Visitors')).toHaveTextContent('40same vs the 7 days before')
    expect(kpi('Pageviews')).toHaveTextContent('120+20% vs the 7 days before')
    expect(kpi('Résumé downloads')).toHaveTextContent('6new vs the 7 days before')
    expect(kpi('Contact clicks')).toHaveTextContent('3−25% vs the 7 days before')
    expect(kpi('Résumé ATS score')).toHaveTextContent('95of 100 · 1 warning · +5 vs before')
    expect(within(kpi('Résumé ATS score')).getByText('95')).toHaveClass('good')
    expect(kpi('Assistant this month')).toHaveTextContent('$5.0030 questions · $25.00 budget')
    expect(screen.getByRole('img', { name: /Last 7 days: visitors per day/ })).toBeInTheDocument()
  })

  it('links what needs Steven to the page it is on, and gives every page a tile', () => {
    show(full())
    const need = screen.getByRole('link', { name: /device type fails Core Web Vitals/ })
    expect(need).toHaveAttribute('href', '#speed')
    expect(need).toHaveTextContent('Page speed →')
    const tiles = screen.getByRole('heading', { name: 'Go to' }).closest('section')!
    expect(within(tiles).getAllByRole('link')).toHaveLength(10)
    expect(within(tiles).getByRole('link', { name: /Links/ })).toHaveTextContent('Every address for running the site')
    expect(within(tiles).getByRole('link', { name: /Traffic/ })).toHaveTextContent('40 visitors · 120 pageviews · 6 résumé downloads')
  })

  it('says nothing is waiting once every API answered and all is clear', () => {
    const data = full({ resume: makeResume({ report: null, history: [] }), mcp: makeMcp({ proposals: [] }), ask: makeAsk({ questions: [] }), stats: makeStats({ vitals: { metrics: [], pages: [], devices: [], culprits: [] }, crawlTotals: { requests: 0, bots: 0, search: 0, ai: 0, assistant: 0, other: 0, errors: 0, probes: 0 } }) })
    render(<Overview data={data} needs={[]} summaries={{}} />)
    expect(screen.getByText('Nothing is waiting for you.')).toBeInTheDocument()
    expect(kpi('Résumé ATS score')).toHaveTextContent('—no report in this deployment')
  })

  it('holds placeholders while the APIs answer', () => {
    const { container } = render(<Overview data={{ days: 1, stats: null, mcp: null, ask: null, resume: null }} needs={[]} summaries={{}} />)
    expect(screen.queryByText('Nothing is waiting for you.')).not.toBeInTheDocument()
    expect(container.querySelector('.needs .skeleton')).not.toBeNull()
    expect(container.querySelectorAll('.kpi-shimmer')).toHaveLength(6)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows a Team tile with the roles, commands and the last change, from the manifest, and how many are not seen', () => {
    const tile = () => within(screen.getByRole('heading', { name: 'Go to' }).closest('section')!).getByRole('link', { name: /^Team/ })
    const { unmount } = show(full({ team: { manifest: makeTeamManifest(), reads: makeTeamReads(), readsError: '' } }))
    expect(tile()).toHaveAttribute('href', '#team')
    expect(tile()).toHaveTextContent('2 roles · 1 command · last change 19 Oct · 2 not seen')
    expect(screen.getByRole('link', { name: /changes to your agent team you have not seen, the latest “The panel reviews every draft”/ })).toHaveAttribute('href', '#team')
    unmount()
    show(full({ team: { manifest: makeTeamManifest(), reads: makeTeamReads({ read: [sha('2'), sha('3')] }), readsError: '' } }))
    expect(tile()).toHaveTextContent('2 roles · 1 command · last change 19 Oct')
    expect(tile()).not.toHaveTextContent('not seen')
  })

  it('waits for the Team read state, but not forever when it failed', () => {
    const manifest = makeTeamManifest()
    const clear = { resume: makeResume({ report: null, history: [] }), mcp: makeMcp({ proposals: [] }), ask: makeAsk({ questions: [] }) }
    const { container, rerender } = render(<Overview data={full({ ...clear, team: { manifest, reads: null, readsError: '' } })} needs={[]} summaries={{}} />)
    expect(container.querySelector('.needs .skeleton')).not.toBeNull()
    rerender(<Overview data={full({ ...clear, team: { manifest, reads: null, readsError: 'HTTP 500' } })} needs={[]} summaries={{}} />)
    expect(screen.getByText('Nothing is waiting for you.')).toBeInTheDocument()
  })

  it('colors the score and words the warnings for older reports', () => {
    const { rerender } = show(full({ days: 1, resume: withReport({ score: 60, ats: undefined, warnings: 3, baseline: { source: 'main', score: 70, change: -10, lower: true, verdict: 'lower' } }) }))
    expect(within(kpi('Résumé ATS score')).getByText('60')).toHaveClass('bad')
    expect(kpi('Résumé ATS score')).toHaveTextContent('of 100 · 3 warnings · -10 vs before')
    expect(screen.getByRole('img', { name: /^Today: visitors per day/ })).toBeInTheDocument()
    const data = full({ resume: withReport({ score: 80, ats: undefined, warnings: undefined, baseline: { source: 'main', score: 80, change: 0, lower: false, verdict: 'unchanged' } }) })
    rerender(<Overview data={data} needs={[]} summaries={{}} />)
    expect(within(kpi('Résumé ATS score')).getByText('80').className).toBe('kpi-value ')
    expect(kpi('Résumé ATS score')).toHaveTextContent('of 100 · 0 warnings')
    expect(kpi('Résumé ATS score')).not.toHaveTextContent('vs before')
  })
})
