import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistantPage } from './AssistantPage'
import { makeAsk, makeStats, NOW, ts } from '../test/admin-fixtures'
import type { AskInfo, AskLogEntry } from './types'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const stat = (label: string) => screen.getByText(label).parentElement!
const month = (overrides: Partial<AskInfo['month']>) => ({ ...makeAsk().month, ...overrides })

describe('Ask about Steven page', () => {
  it("shows the month's use and cost against the budget", () => {
    render(<AssistantPage info={makeAsk()} days={7} />)
    expect(screen.getByText(/Claude \(claude-sonnet\) answers/)).toBeInTheDocument()
    expect(stat('Spent this month')).toHaveTextContent('$5.00of a $25.00 budget')
    expect(stat('Spent this month')).not.toHaveClass('highlight')
    expect(stat('Questions this month')).toHaveTextContent('24 answered · 4 gaps · 2 off topic')
    expect(stat('Human check')).toHaveTextContent('Standbynobody is asked; switches on at $1.00 a day or under load')
    expect(stat('Votes (7 days)')).toHaveTextContent('5 / 1')
    // (3600 + 1200) ms over 4 answered questions.
    expect(stat('Time to first word')).toHaveTextContent('1s')
    expect(stat('Cache')).toHaveTextContent('25%')
    // The budget month is UTC's: $5 over the UTC days so far, times October's 31 (19 days in
    // most time zones, 18 where local noon on the 19th is still the 18th in UTC).
    const pace = (5 * 31 / NOW.getUTCDate()).toFixed(2).replace('.', '\\.')
    expect(screen.getByText(new RegExp(`October: \\$5\\.00 of the \\$25\\.00 budget \\(20%\\) · month end ≈ \\$${pace} at this pace`))).toBeInTheDocument()
    expect(screen.queryByText(/the budget would run out/)).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Questions per day \(7 days\).*Latest 4, peak 4/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Cost per day \(7 days\).*Latest \$0\.40/ })).toBeInTheDocument()
  })

  it('warns when the budget is nearly spent and would run out', () => {
    const { container } = render(<AssistantPage info={makeAsk({ month: month({ costMicro: 21_000_000 }) })} days={30} />)
    expect(stat('Spent this month')).toHaveClass('highlight')
    expect(screen.getByText('· the budget would run out before the month ends')).toBeInTheDocument()
    expect(container.querySelector('.meter-proj')).not.toBeNull()
  })

  it('draws an empty meter before anything is spent', () => {
    const { container } = render(<AssistantPage info={makeAsk({ month: month({ costMicro: 0, cacheReadTokens: 0, inputTokens: 0 }), daily: [], votes: [] })} days={7} />)
    expect(container.querySelector('.meter-used')).toHaveStyle({ width: '0px' })
    expect(container.querySelector('.meter-proj')).toBeNull()
    expect(stat('Time to first word')).toHaveTextContent('—')
    expect(stat('Cache')).toHaveTextContent('0%')
    expect(stat('Votes (7 days)')).toHaveTextContent('0 / 0')
  })

  it('says why the human check is on', () => {
    const on = (why: 'spend' | 'connection' | 'everyone' | null) => makeAsk({ check: { state: 'on', why, lastHour: 31, spentTodayMicro: 2_000_000, afterMicro: 1_500_000 } })
    const { rerender } = render(<AssistantPage info={on('spend')} days={7} />)
    expect(stat('Human check')).toHaveClass('highlight')
    expect(stat('Human check')).toHaveTextContent("Ontoday's spend passed $1.50")
    rerender(<AssistantPage info={on('connection')} days={7} />)
    expect(stat('Human check')).toHaveTextContent('one connection asked too often')
    rerender(<AssistantPage info={on('everyone')} days={7} />)
    expect(stat('Human check')).toHaveTextContent('31 questions in the last hour')
    rerender(<AssistantPage info={on(null)} days={7} />)
    expect(stat('Human check')).toHaveTextContent('31 questions in the last hour')
  })

  it('falls back to the Turnstile keys when the server does not report the check', () => {
    const { rerender } = render(<AssistantPage info={makeAsk({ check: undefined })} days={7} />)
    expect(stat('Human check')).toHaveTextContent('Readyno Turnstile keys')
    rerender(<AssistantPage info={makeAsk({ check: undefined, humanCheck: false })} days={7} />)
    expect(stat('Human check')).toHaveTextContent('Offno Turnstile keys')
    rerender(<AssistantPage info={makeAsk({ check: { state: 'off', why: null, lastHour: 0, spentTodayMicro: 0, afterMicro: 0 } })} days={7} />)
    expect(stat('Human check')).toHaveTextContent('Offno Turnstile keys')
  })

  it('says when the assistant is not live, or runs on canned answers', () => {
    const { rerender } = render(<AssistantPage info={makeAsk({ configured: false })} days={7} />)
    expect(screen.getByText(/Not live yet: set the ANTHROPIC_API_KEY secret/)).toBeInTheDocument()
    rerender(<AssistantPage info={makeAsk({ configured: false, mock: true })} days={7} />)
    expect(screen.queryByText(/Not live yet/)).not.toBeInTheDocument()
    expect(screen.getByText(/Mock mode \(ASK_MOCK=1\)/)).toBeInTheDocument()
  })

  it('lists the questions waiting for Steven', () => {
    render(<AssistantPage info={makeAsk()} days={7} />)
    const waiting = stat('Waiting')
    expect(waiting).toHaveClass('highlight')
    expect(waiting).toHaveTextContent('21 is a job requirement')
    expect(stat('Answered by you')).toHaveTextContent('3')
    expect(stat('Set aside')).toHaveTextContent('1')
    const table = within(screen.getByRole('table', { name: 'Questions waiting' }))
    expect(table.getByText('not covered')).toHaveClass('badge', 'gap')
    expect(table.getByText('job requirement')).toHaveClass('badge', 'fit')
    expect(table.getByText('Google, US')).toBeInTheDocument()
    expect(table.getByText('The dossier does not say.')).toBeInTheDocument()
  })

  it('says when nothing waits', () => {
    const info = makeAsk({ questions: [{ id: 1, ts: 0, reason: 'unhelpful', page: null, question: 'q', answer: null, country: null, asOrg: null }] })
    const { rerender } = render(<AssistantPage info={info} days={7} />)
    expect(stat('Waiting')).toHaveTextContent('0 are job requirements')
    rerender(<AssistantPage info={{ ...makeAsk({ questions: [] }), resolved: undefined as unknown as AskInfo['resolved'] }} days={7} />)
    expect(stat('Waiting')).not.toHaveClass('highlight')
    expect(stat('Answered by you')).toHaveTextContent('0')
    expect(screen.getByText(/Nothing waits: every question/)).toBeInTheDocument()
  })

  describe('People who asked', () => {
    const asked = (label: string) => screen.getByText(label, { selector: '.stats span' }).parentElement!
    const entry = (id: number, visitor: string, at: number, extra: Partial<AskLogEntry> = {}): AskLogEntry => ({ id, ts: at, visitor, kind: 'question', page: 'home', question: `Question ${id}`, answer: `Answer ${id}`, outcome: 'answered', country: 'US', asOrg: 'Microsoft', ...extra })
    const log = [
      entry(3, 'v9', ts(18, 8), { question: 'Write me a poem', answer: null, outcome: 'off', page: null, asOrg: null, country: null }),
      entry(2, 'v1', ts(19, 10), { kind: 'fit', question: 'Job description (900 characters): Director…', outcome: 'gap', page: 'experience' }),
      entry(1, 'v1', ts(19, 9), { question: 'What did he ship?' }),
    ]

    it('counts the people, their questions, follow-ups and job checks, and lists what each asked', () => {
      render(<AssistantPage info={makeAsk({ log })} days={7} visitors={makeStats().visitors} />)
      expect(asked('People')).toHaveTextContent('2asked at least one question')
      expect(asked('People')).toHaveClass('highlight')
      expect(asked('Questions')).toHaveTextContent('31.5 per person')
      expect(asked('Asked a follow-up')).toHaveTextContent('150% of the people')
      expect(asked('Checked a job')).toHaveTextContent('1pasted a job description')
      expect(screen.getByRole('img', { name: /People per day \(7 days\)/ })).toBeInTheDocument()
      const table = screen.getByRole('table', { name: 'People who asked' })
      const rows = within(table).getAllByRole('row').slice(1)
      expect(rows[0]).toHaveTextContent('What did he ship?')
      expect(rows[0]).toHaveTextContent('Microsoft, US')
      expect(rows[0]).toHaveTextContent('home, experience')
      expect(within(rows[0]).getAllByRole('listitem')).toHaveLength(2)
      expect(rows[1]).toHaveTextContent('Write me a poem')
      // Opening a row shows the answers and the visit from the traffic data.
      fireEvent.click(rows[0])
      expect(screen.getByText(/\/ → \/work → \/about \(from linkedin\.com\) · downloaded the résumé/)).toBeInTheDocument()
      expect(screen.getByText('Answer 1')).toBeInTheDocument()
      expect(screen.getByText('fit check')).toBeInTheDocument()
      fireEvent.click(within(table).getAllByRole('row').find((row) => row.textContent?.includes('Write me a poem'))!)
      expect(screen.getByText('off topic')).toHaveClass('badge', 'info')
      expect(screen.queryByText(/^Visit:/)).not.toBeInTheDocument()
    })

    it('says when the API sends no log, and when nobody asked', () => {
      const { rerender } = render(<AssistantPage info={makeAsk()} days={7} />)
      expect(screen.getByText(/The deployed API does not send the log yet/)).toBeInTheDocument()
      expect(asked('People')).not.toHaveClass('highlight')
      expect(asked('Questions')).toHaveTextContent('00 per person')
      expect(asked('Asked a follow-up')).toHaveTextContent('00% of the people')
      rerender(<AssistantPage info={makeAsk({ log: [] })} days={7} />)
      expect(screen.queryByText(/does not send the log/)).not.toBeInTheDocument()
      expect(screen.getByText('Nobody asked the assistant anything in the last 7 days.')).toBeInTheDocument()
    })
  })
})
