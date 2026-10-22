import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnswerQuality } from './AnswerQuality'
import { weekLabel } from './askQuality'
import { makeAsk, makeLogEntry, makeRating, NOW } from '../test/admin-fixtures'
import type { AskInfo, AskLogEntry, AskRating } from './types'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const MODEL = 'claude-opus-5-5'
let nextId = 1
// A version with n ratings on `day`, the first `good` of them good, `wrong` of the rest marked wrong.
const version = (promptVersion: string | null, day: string, n: number, good: number, wrong = 0, extra: Partial<AskLogEntry> = {}) => {
  const produced = { model: promptVersion ? MODEL : null, promptVersion, fallback: promptVersion ? false : null, ...extra }
  const log: AskLogEntry[] = []
  const ratings: AskRating[] = []
  for (let i = 0; i < n; i++) {
    const id = nextId++
    const rating = makeRating({ id, logId: id, day, ...produced, overall: i < good ? 5 : 3, accurate: i >= good && i < good + wrong ? 'no' : 'yes', note: i === 0 ? `Note on ${promptVersion}` : null, ratedAt: Date.parse(`${day}T12:00:00Z`) + i })
    log.push(makeLogEntry({ id, ts: Date.parse(`${day}T10:00:00Z`) + i, ...produced, rating }))
    ratings.push(rating)
  }
  return { log, ratings }
}
const infoOf = (parts: ReturnType<typeof version>[], overrides: Partial<AskInfo> = {}) => makeAsk({ model: MODEL, log: parts.flatMap((part) => part.log), ratings: parts.flatMap((part) => part.ratings), ...overrides })
const show = (info: AskInfo, days = 30, handlers = { onShowWrong: vi.fn(), onRateFirst: vi.fn() }) => {
  render(<AnswerQuality info={info} days={days} {...handlers} />)
  return handlers
}
const card = () => screen.getByRole('heading', { name: 'Answer quality' }).closest('section')!
const tile = (label: string) => within(card()).getByText(label, { selector: '.stats span' }).parentElement!

describe('Answer quality', () => {
  it('shows rated out of rateable, the good share with its range and count, the mean score, wrong answers and share Yes per criterion', () => {
    const rated = version('a1b2c3d4', '2026-10-14', 25, 18, 1)
    const unrated = makeLogEntry({ id: 999, ts: Date.parse('2026-10-15T10:00:00Z') })
    show(makeAsk({ model: MODEL, log: [...rated.log, unrated], ratings: rated.ratings }))
    expect(card()).toHaveAttribute('data-part', 'Answer quality')
    expect(tile('Rated good')).toHaveTextContent('72%18 of 25 · range 52 to 86%')
    expect(tile('Rated good')).toHaveClass('highlight')
    expect(tile('Wrong answers')).toHaveTextContent('14% of rated · Show them')
    expect(tile('Wrong answers')).toHaveClass('bad')
    expect(tile('Mean score')).toHaveTextContent('4.4 /51 to 5')
    expect(tile('Rated')).toHaveTextContent('25 of 2696% · 1 wait in Rate answers')
    const criteria = within(card()).getByRole('heading', { name: 'By criterion (share Yes)' }).parentElement!
    expect(within(criteria).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Accurate · 0% partly96%', 'Supported · 0% partly100%', 'Answers the question · 0% partly100%', 'Tone and length · 0% partly100%'])
    expect(card().textContent).not.toMatch(/NaN|Infinity|0 to 100%/)
  })

  it('the verdict line names both versions, both shares with their counts and the difference with its range, the badge word first', () => {
    show(infoOf([version('a1b2c3d4', '2026-10-15', 20, 18), version('9f8e7d6c', '2026-10-01', 20, 12)]))
    const line = card().querySelector('.quality-verdict')!
    expect(line.textContent).toBe('Better: opus-5-5 · a1b2c3d4 is rated good 90% (18 of 20) against 60% (12 of 20) before; 30 points better (range 3 to 53).')
    expect(within(line as HTMLElement).getByText('Better')).toHaveClass('badge')
    expect(screen.getByText('Now 90% good (18 of 20)')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Rated good by week, 30 days. opus-5-5 · a1b2c3d4: 90% of 20 rated. opus-5-5 · 9f8e7d6c: 60% of 20 rated.' })).toBeInTheDocument()
  })

  it.each([
    ['Worse', [version('a1b2c3d4', '2026-10-15', 20, 12), version('9f8e7d6c', '2026-10-01', 20, 18)], 'error'],
    ['No clear difference', [version('a1b2c3d4', '2026-10-15', 20, 15), version('9f8e7d6c', '2026-10-01', 20, 15)], 'info'],
    ['Too early to tell', [version('a1b2c3d4', '2026-10-15', 12, 10), version('9f8e7d6c', '2026-10-01', 20, 15)], 'info'],
    ['No verdict', [version('a1b2c3d4', '2026-10-15', 20, 12, 0, { model: 'claude-sonnet-5', fallback: true })], 'info'],
  ])('says %s with its badge', (word, parts, tone) => {
    show(infoOf(parts))
    const badge = within(card().querySelector('.quality-verdict') as HTMLElement).getByText(word)
    expect(badge).toHaveClass('badge', tone)
  })

  it('with no MODEL answer, the line reads as the decision rule', () => {
    show(infoOf([version('a1b2c3d4', '2026-10-15', 3, 2, 0, { model: 'mock' })]))
    expect(card().querySelector('.quality-verdict')!.textContent).toBe('No verdict: no answer from opus-5-5 in this range.')
  })

  it('with answers but no rating it says how to rate the first one, and shows no 0%', async () => {
    const user = userEvent.setup()
    const handlers = show(makeAsk({ model: MODEL, log: [makeLogEntry({ id: 1, ts: Date.parse('2026-10-15T10:00:00Z') })], ratings: [] }))
    expect(within(card()).getByText(/Nothing rated yet/)).toHaveTextContent('Nothing rated yet. Rate your first answer in Rate answers: four questions and a score, about a minute.')
    // No share of nothing: no tiles and no score chart (the 0% left is the answered chart's axis).
    expect(card().querySelector('.stats')).toBeNull()
    expect(card().querySelector('.share-chart')).toBeNull()
    expect(within(card()).queryByText('Rated good')).not.toBeInTheDocument()
    expect(card().querySelector('.quality-verdict')).toBeNull()
    await user.click(within(card()).getByRole('button', { name: 'Rate answers' }))
    expect(handlers.onRateFirst).toHaveBeenCalled()
    // The version table still has the answers.
    const table = within(card()).getByRole('table', { name: 'Versions' })
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('opus-5-5 · a1b2c3d4')
  })

  it('with nothing rateable it shows dashes and no verdict', () => {
    show(makeAsk({ model: MODEL, log: [makeLogEntry({ outcome: 'limited' })], ratings: [] }), 7)
    expect(card().querySelector('.quality-verdict')).toBeNull()
    expect(tile('Rated good')).toHaveTextContent('—no ratings')
    expect(tile('Wrong answers')).toHaveTextContent('—no ratings')
    expect(tile('Mean score')).toHaveTextContent('—1 to 5')
    expect(tile('Rated')).toHaveTextContent('—nothing to rate')
    expect(within(card()).getByText('No answers in the last 7 days.')).toBeInTheDocument()
    expect(card().textContent).not.toMatch(/NaN|Infinity|0 to 100%/)
  })

  it('under 5 ratings every value is muted and says only N rated', () => {
    show(infoOf([version('a1b2c3d4', '2026-10-15', 3, 2)]))
    expect(card().querySelector('.stats')).toHaveClass('quality-few')
    expect(tile('Rated good')).toHaveTextContent('only 3 rated')
    expect(tile('Wrong answers')).toHaveTextContent('only 3 rated')
    expect(tile('Mean score')).toHaveTextContent('only 3 rated')
    expect(tile('Rated good')).not.toHaveClass('highlight')
    expect(tile('Wrong answers')).not.toHaveClass('bad')
  })

  it('n/a answers are left out of a criterion\'s share and counted beside it', () => {
    const off = makeLogEntry({ id: 50, outcome: 'off', ts: Date.parse('2026-10-15T10:00:00Z') })
    const ratings = [makeRating({ id: 50, logId: 50, outcome: 'off', supported: 'na', tone: 'na' }), makeRating({ id: 51, logId: null, supported: 'partly', tone: 'na' })]
    show(makeAsk({ model: MODEL, log: [off], ratings }))
    const criteria = within(card()).getByRole('heading', { name: 'By criterion (share Yes)' }).parentElement!
    expect(within(criteria).getByText('Supported').closest('li')).toHaveTextContent('Supported · 100% partly · 1 n/a0%')
    expect(within(criteria).getByText('Tone and length').closest('li')).toHaveTextContent('Tone and length · 2 n/a0%')
  })

  it('Show them asks for the wrong answers', async () => {
    const user = userEvent.setup()
    const handlers = show(infoOf([version('a1b2c3d4', '2026-10-15', 6, 2, 2)]))
    await user.click(within(tile('Wrong answers')).getByRole('button', { name: 'Show them' }))
    expect(handlers.onShowWrong).toHaveBeenCalled()
  })

  it('one Versions row per version, newest first, Before versions last; a row opens to the notes on its answers', async () => {
    const user = userEvent.setup()
    const fallback = version('a1b2c3d4', '2026-10-16', 2, 2, 0, { model: 'claude-sonnet-5', fallback: true })
    const mock = version('b1b2c3d4', '2026-10-16', 1, 0, 0, { model: 'mock' })
    const current = version('a1b2c3d4', '2026-10-15', 20, 18)
    current.log.push(makeLogEntry({ id: 9000, ts: NOW.getTime(), knowledgeVersion: 'other', outcome: 'gap', ...{ model: MODEL, promptVersion: 'a1b2c3d4', fallback: false } }))
    current.log.push(makeLogEntry({ id: 9001, ts: NOW.getTime(), knowledgeVersion: 'third', ...{ model: MODEL, promptVersion: 'a1b2c3d4', fallback: false } }))
    show(infoOf([current, version('9f8e7d6c', '2026-10-01', 20, 12, 2), version(null, '2026-09-25', 1, 0), fallback, mock]))
    const table = within(card()).getByRole('table', { name: 'Versions' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.querySelector('.version-label')!.textContent)).toEqual(['sonnet-5 · a1b2c3d4', 'mock · b1b2c3d4', 'opus-5-5 · a1b2c3d4', 'opus-5-5 · 9f8e7d6c', 'Before versions'])
    expect(rows[0]).toHaveTextContent('fallback, not in the verdict')
    expect(rows[1]).toHaveTextContent('mock, not in the verdict')
    expect(rows[2]).toHaveTextContent('knowledge changed 2 times')
    expect(rows[2].querySelector('.version-label')).toHaveAttribute('title', MODEL)
    expect([...rows[2].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(['▸opus-5-5 · a1b2c3d4knowledge changed 2 times', '15 Oct – today', '22', '20', '90%range 70 to 97', '4.8', '0', '95%'])
    expect([...rows[3].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(['▸opus-5-5 · 9f8e7d6c', '1 Oct – 1 Oct', '20', '20', '60%range 39 to 78', '4.2', '2', '100%'])
    expect(rows[3].querySelector('.status-text.poor')).toHaveTextContent('2')
    expect(rows[0]).toHaveTextContent('too few')
    expect([...rows[4].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(['▸Before versions', '25 Sept – 25 Sept', '1', '1', 'too few', '3.0', '0', '100%'])
    await user.click(within(rows[3]).getByRole('button', { name: /Open details for opus-5-5 · 9f8e7d6c/ }))
    expect(within(table).getByText('Note on 9f8e7d6c')).toBeInTheDocument()
    expect(within(table).getByText(/“Has he led managers of managers\?”/)).toBeInTheDocument()
    await user.click(within(rows[1]).getByRole('button', { name: /Open details for mock/ }))
    expect(within(table).getByText('Note on b1b2c3d4')).toBeInTheDocument()
    await user.click(within(rows[0]).getByRole('button', { name: /Open details for sonnet/ }))
    expect(within(table).getByText('Note on a1b2c3d4')).toBeInTheDocument()
  })

  it('a version with no notes says so, a long question is cut at 80 characters, and an empty version has dashes', async () => {
    const user = userEvent.setup()
    const long = 'Q'.repeat(100)
    const parts = version('a1b2c3d4', '2026-10-15', 1, 1)
    parts.log[0].question = long
    const quiet = makeLogEntry({ id: 7000, ts: Date.parse('2026-10-16T10:00:00Z'), promptVersion: '12345678' })
    show(makeAsk({ model: MODEL, log: [...parts.log, quiet], ratings: parts.ratings }))
    const table = within(card()).getByRole('table', { name: 'Versions' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect([...rows[0].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(['▸opus-5-5 · 12345678', '16 Oct – 16 Oct', '1', '—', '—', '—', '—', '100%'])
    await user.click(within(rows[0]).getByRole('button', { name: /Open details/ }))
    expect(within(table).getByText('No notes on this version’s answers.')).toBeInTheDocument()
    await user.click(within(rows[1]).getByRole('button', { name: /Open details/ }))
    expect(within(table).getByText(`· “${'Q'.repeat(80)}…”`, { exact: false })).toBeInTheDocument()
  })

  it('beside it the answered share and reader votes per week, and No reader votes in this range', () => {
    show(infoOf([version('a1b2c3d4', '2026-10-15', 3, 2)], { daily: [{ day: '2026-10-13', outcome: 'answered', questions: 3, costMicro: 0, msFirst: 0, msTotal: 0 }, { day: '2026-10-14', outcome: 'gap', questions: 1, costMicro: 0, msFirst: 0, msTotal: 0 }], votes: [{ day: '2026-10-14', helpful: 3, unhelpful: 1 }] }))
    expect(screen.getByRole('img', { name: 'Answered with a source, by week: answered share per week. Latest 75%, peak 75%.' })).toBeInTheDocument()
    expect(screen.getByText('now 75%')).toBeInTheDocument()
    expect(screen.getByText('3 helpful of 4')).toBeInTheDocument()
    cleanup()
    show(infoOf([version('a1b2c3d4', '2026-10-15', 3, 2)], { daily: [], votes: [] }))
    expect(screen.getByText('No reader votes in this range')).toBeInTheDocument()
  })

  it('says when the log could not be read or stopped at its limit, and reads today as a one-day range', () => {
    show(makeAsk(), 7)
    expect(within(card()).getByText(/The log could not be read, so this card is empty/)).toBeInTheDocument()
    expect(within(card()).queryByRole('table')).not.toBeInTheDocument()
    cleanup()
    show(infoOf([version('a1b2c3d4', '2026-10-15', 3, 2)], { logCapped: true }), 1)
    expect(within(card()).getByText(/Only the latest 3 answers are counted/)).toBeInTheDocument()
    expect(within(card()).getByText(/Rated good by week \(today\)/)).toBeInTheDocument()
  })

  it('labels a week by its Monday, day before month', () => {
    expect(weekLabel('2026-10-12')).toBe('12 Oct')
  })
})
