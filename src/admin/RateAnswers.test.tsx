import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Filter } from './askQuality'
import { cachedLoader, type LoadEntry } from './askEntries'
import { AnswerText, RateAnswers, RatingBadge, SourceList } from './RateAnswers'
import type { SaveResult } from './RatingForm'
import { makeAsk, makeLogEntry, makeRating, NOW, ts } from '../test/admin-fixtures'
import type { AskInfo, AskLogEntry, AskRating, RatingDraft } from './types'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const log = [
  makeLogEntry({ id: 1, ts: ts(17, 9), visitor: 'v1', question: 'Where is he based?', answer: 'In Belgium.' }),
  makeLogEntry({ id: 2, ts: ts(17, 10), visitor: 'v1', question: 'And his team?', answer: 'He led three teams.' }),
  makeLogEntry({ id: 3, ts: ts(18, 9), visitor: 'v2', question: 'Write me a poem', answer: 'I can only answer questions about Steven.', outcome: 'off', sources: [] }),
  makeLogEntry({ id: 4, ts: ts(18, 10), visitor: 'v3', question: 'Too many?', outcome: 'limited', answer: null }),
  makeLogEntry({ id: 5, ts: ts(19, 9), visitor: 'v4', question: 'When can he start?', rating: makeRating({ logId: 5, overall: 4 }) }),
]

// The queue as AssistantPage holds it: the filter outside, saves merged back into the data.
function Harness({ info, onRate, load = async () => null, initial = 'unrated', request = 0 }: { info: AskInfo; onRate?: (draft: RatingDraft) => Promise<SaveResult>; load?: LoadEntry; initial?: Filter; request?: number }) {
  const [filter, setFilter] = useState<Filter>(initial)
  const [data, setData] = useState(info)
  const rate = async (draft: RatingDraft): Promise<SaveResult> => {
    const result = onRate ? await onRate(draft) : { ok: true as const, rating: makeRating({ logId: draft.id, accurate: draft.accurate, supported: draft.supported, answers: draft.answers, tone: draft.tone, overall: draft.overall }) }
    if (result.ok) setData((current) => ({ ...current, log: current.log?.map((entry) => (entry.id === draft.id ? { ...entry, rating: result.rating } : entry)) }))
    return result
  }
  return <RateAnswers info={data} filter={filter} onFilter={setFilter} focusRequest={request} onRate={rate} load={load} />
}
const card = () => screen.getByRole('heading', { name: 'Rate answers' }).closest('section')!
const question = () => within(card()).getByRole('heading', { level: 3 })
const filterButton = (name: RegExp) => within(within(card()).getByRole('group', { name: 'Show' })).getByRole('button', { name })

describe('Rate answers', () => {
  it('is a section.card with data-part Rate answers, and opens on Not rated, newest first, with each filter\'s count', () => {
    render(<Harness info={makeAsk({ log })} />)
    expect(card()).toHaveClass('card')
    expect(card()).toHaveAttribute('data-part', 'Rate answers')
    expect(filterButton(/Not rated/)).toHaveAttribute('aria-pressed', 'true')
    expect(within(card()).getByRole('group', { name: 'Show' }).textContent).toBe('Not rated 3Rated 1All 4')
    expect(question()).toHaveTextContent('Write me a poem')
    expect(question()).not.toHaveClass('rate-fit')
    expect(question()).not.toHaveAttribute('title')
    expect(within(card()).getByText(/^1 of 3 ·/)).toBeInTheDocument()
  })

  it('Marked wrong is offered only when there is a wrong answer', () => {
    render(<Harness info={makeAsk({ log: [...log, makeLogEntry({ id: 6, ts: ts(19, 11), rating: makeRating({ logId: 6, accurate: 'no' }) })] })} />)
    expect(filterButton(/Marked wrong 1/)).toBeInTheDocument()
  })

  it('shows the context: the earlier questions, the whole answer, the sources by title, the model and the versions', async () => {
    const user = userEvent.setup()
    render(<Harness info={makeAsk({ log })} />)
    await user.click(within(card()).getByRole('button', { name: 'Skip' }))
    expect(question()).toHaveTextContent('And his team?')
    const earlier = within(card()).getByText('Earlier in this conversation (1)').closest('details')!
    expect(earlier).not.toHaveAttribute('open')
    expect(earlier).toHaveTextContent('Where is he based?')
    expect(within(card()).getByText('He led three teams.')).toBeInTheDocument()
    const source = within(card()).getByRole('link', { name: /Group PM, Microsoft/ })
    expect(source).toHaveAttribute('href', 'https://steven.wilssens.com/experience')
    expect(source).toHaveAttribute('target', '_blank')
    expect(source).toHaveAttribute('rel', 'noreferrer')
    expect(source).toHaveTextContent('(opens in a new tab)')
    expect(within(card()).getByText('opus-5-5 · a1b2c3d4')).toHaveAttribute('title', 'claude-opus-5-5')
    expect(within(card()).getByText('knowledge 5e4d3c2b')).toBeInTheDocument()
    expect(within(card()).getByText(/BE, Proximus/)).toBeInTheDocument()
  })

  it('Y Y Y Y 5 Enter saves and opens the next answer with focus on its question', async () => {
    const user = userEvent.setup()
    const onRate = vi.fn(async (draft: RatingDraft): Promise<SaveResult> => ({ ok: true, rating: makeRating({ logId: draft.id, overall: draft.overall }) }))
    render(<Harness info={makeAsk({ log: log.filter((entry) => entry.outcome !== 'off') })} onRate={onRate} />)
    expect(question()).toHaveTextContent('And his team?')
    question().focus()
    await user.keyboard('yyyy5{Enter}')
    expect(onRate).toHaveBeenCalledWith(expect.objectContaining({ id: 2, overall: 5 }))
    expect(question()).toHaveTextContent('Where is he based?')
    expect(question()).toHaveFocus()
    expect(within(card()).getByRole('status')).toHaveTextContent('Saved: good (5) for “And his team?”. 1 to go.')
    expect(filterButton(/Not rated/)).toHaveTextContent('Not rated 1')
  })

  it('a second Enter while saving sends one request', async () => {
    const user = userEvent.setup()
    let finish: (result: SaveResult) => void = () => {}
    const onRate = vi.fn(() => new Promise<SaveResult>((resolve) => { finish = resolve }))
    render(<Harness info={makeAsk({ log })} onRate={onRate} />)
    question().focus()
    await user.keyboard('yy')
    await user.keyboard('n')
    await user.keyboard('2{Enter}{Enter}')
    expect(onRate).toHaveBeenCalledTimes(1)
    await act(async () => finish({ ok: true, rating: makeRating({ logId: 3, overall: 2 }) }))
    expect(within(card()).getByRole('status')).toHaveTextContent('Saved: rated 2 for “Write me a poem”. 2 to go.')
  })

  it('the keys do nothing while focus is outside the card', async () => {
    const user = userEvent.setup()
    const onRate = vi.fn()
    render(<><button type="button">Elsewhere</button><Harness info={makeAsk({ log })} onRate={onRate} /></>)
    screen.getByRole('button', { name: 'Elsewhere' }).focus()
    await user.keyboard('yyyy5{Enter}')
    expect(onRate).not.toHaveBeenCalled()
    expect(within(card()).getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked).map((radio) => (radio as HTMLInputElement).value)).toEqual(['na', 'na'])
  })

  it('Skip and Previous move through the queue; Previous is absent on the first; the last says Save', async () => {
    const user = userEvent.setup()
    render(<Harness info={makeAsk({ log })} />)
    expect(within(card()).queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument()
    expect(within(card()).getByRole('button', { name: 'Save and next' })).toBeInTheDocument()
    await user.click(within(card()).getByRole('button', { name: 'Skip' }))
    await user.click(within(card()).getByRole('button', { name: 'Skip' }))
    expect(question()).toHaveTextContent('Where is he based?')
    expect(question()).toHaveFocus()
    expect(within(card()).getByRole('button', { name: 'Save' })).toBeInTheDocument()
    // Skip on the last one stays there.
    await user.click(within(card()).getByRole('button', { name: 'Skip' }))
    expect(question()).toHaveTextContent('Where is he based?')
    await user.click(within(card()).getByRole('button', { name: 'Previous' }))
    expect(question()).toHaveTextContent('And his team?')
    expect(question()).toHaveFocus()
  })

  it('a rated one says Save change and next, and keeps its place after the save', async () => {
    const user = userEvent.setup()
    render(<Harness info={makeAsk({ log: [...log, makeLogEntry({ id: 7, ts: ts(16, 9), question: 'Older one', rating: makeRating({ logId: 7, overall: 2 }) })] })} initial="rated" />)
    expect(question()).toHaveTextContent('When can he start?')
    expect(within(card()).getByText('good · 4')).toBeInTheDocument()
    await user.click(within(card()).getByRole('button', { name: 'Save change and next' }))
    expect(question()).toHaveTextContent('Older one')
    expect(within(card()).getByRole('status')).toHaveTextContent('Saved: good (4) for “When can he start?”. 3 to go.')
  })

  it('an empty queue says every answer is rated in the range\'s words, takes focus, and Show rated answers switches the filter', async () => {
    const user = userEvent.setup()
    const one = [makeLogEntry({ id: 9, ts: ts(19, 9), question: 'Only one' }), makeLogEntry({ id: 10, ts: ts(18, 9), rating: makeRating({ logId: 10 }) })]
    render(<Harness info={makeAsk({ log: one, logDays: 7 })} />)
    question().focus()
    await user.keyboard('yyyy5{Enter}')
    const empty = within(card()).getByText('Every answer from the last 7 days is rated.')
    expect(empty).toHaveFocus()
    expect(within(card()).getByRole('status')).toHaveTextContent('Nothing left to rate.')
    // The keys of the form that is gone do nothing.
    await user.keyboard('{Enter}')
    await user.click(within(card()).getByRole('button', { name: 'Show rated answers' }))
    expect(filterButton(/Rated 2/)).toHaveAttribute('aria-pressed', 'true')
    expect(question()).toHaveTextContent('Only one')
    expect(question()).toHaveFocus()
  })

  it('says so when nothing is rateable, when a filter is empty, and when the log could not be read', () => {
    render(<Harness info={makeAsk({ log: [log[3]], logDays: 1 })} />)
    expect(within(card()).getByText('No answers to rate in the last day.')).toBeInTheDocument()
    cleanup()
    render(<Harness info={makeAsk({ log: [log[0]] })} initial="rated" />)
    expect(within(card()).getByText('No answers here from the last 30 days.')).toBeInTheDocument()
    expect(within(card()).queryByRole('button', { name: 'Show rated answers' })).not.toBeInTheDocument()
    cleanup()
    render(<Harness info={makeAsk()} />)
    expect(within(card()).getByText('The log could not be read, so this card is empty.')).toBeInTheDocument()
    expect(within(card()).queryByRole('group', { name: 'Accurate' })).not.toBeInTheDocument()
  })

  it('while the whole answer loads, and when it cannot, the cut shows with a line saying so, and rating still saves', async () => {
    const user = userEvent.setup()
    let answer: (entry: AskLogEntry | null) => void = () => {}
    const load = vi.fn(() => new Promise<AskLogEntry | null>((resolve) => { answer = resolve }))
    const onRate = vi.fn(async (draft: RatingDraft): Promise<SaveResult> => ({ ok: true, rating: makeRating({ logId: draft.id }) }))
    render(<Harness info={makeAsk({ log: [makeLogEntry({ id: 11, answer: 'Cut answer…', cut: true })] })} load={load} onRate={onRate} />)
    expect(within(card()).getByText('Cut answer…')).toBeInTheDocument()
    expect(within(card()).getByText('Loading the whole answer…')).toBeInTheDocument()
    await act(async () => answer(null))
    expect(within(card()).getByText('Could not load the whole answer; this is its first 1,500 characters.')).toBeInTheDocument()
    question().focus()
    await user.keyboard('yyyy4{Enter}')
    expect(onRate).toHaveBeenCalledTimes(1)
  })

  it('shows the whole answer once it has loaded, and fetches the next one ahead', async () => {
    const load = vi.fn(async (id: number) => makeLogEntry({ id, answer: `The whole answer ${id}.` }))
    render(<Harness info={makeAsk({ log: [makeLogEntry({ id: 12, ts: ts(19, 9), answer: 'Cut…', cut: true }), makeLogEntry({ id: 13, ts: ts(18, 9), answer: 'Cut…', cut: true })] })} load={load} />)
    expect(await within(card()).findByText('The whole answer 12.')).toBeInTheDocument()
    expect(load).toHaveBeenCalledWith(13)
  })

  it('a fit check shows that only the first words are kept, and a source no longer in the data shows its id', async () => {
    const user = userEvent.setup()
    render(<Harness info={makeAsk({ log: [makeLogEntry({ id: 14, kind: 'fit', question: "Job description (1442 characters): Job description to check against Steven's record: Director…", sources: [{ id: 'site:old', title: null, href: null }], knowledgeVersion: null, page: null, country: null, asOrg: null }), makeLogEntry({ id: 15, ts: 1, kind: 'fit', question: 'A posting logged some other way' })] })} />)
    // The heading is the posting's first words; its length goes in the line under it.
    expect(question()).toHaveTextContent(/^Fit check: Director…$/)
    // Clamped to three lines on screen; the whole heading stays in its title and its text.
    expect(question()).toHaveClass('rate-fit')
    expect(question()).toHaveAttribute('title', 'Fit check: Director…')
    expect(question()).not.toHaveAttribute('aria-hidden')
    expect(within(card()).getByText('A job description of 1,442 characters; only the first words of a pasted job description are kept')).toBeInTheDocument()
    expect(within(card()).getByText('site:old · no longer in the data')).toBeInTheDocument()
    expect(within(card()).getByText('fit check')).toBeInTheDocument()
    expect(within(card()).queryByText(/^knowledge/)).not.toBeInTheDocument()
    await user.click(filterButton(/All/))
    expect(filterButton(/All/)).toHaveAttribute('aria-pressed', 'true')
    // Without the logged length the question is shown as it is.
    await user.click(within(card()).getByRole('button', { name: 'Skip' }))
    expect(question()).toHaveTextContent(/^Fit check: A posting logged some other way$/)
    expect(within(card()).getByText('only the first words of a pasted job description are kept')).toBeInTheDocument()
  })

  it('a focus request (Show them, Needs you) goes to the first question', () => {
    const { rerender } = render(<Harness info={makeAsk({ log })} request={0} />)
    expect(question()).not.toHaveFocus()
    rerender(<Harness info={makeAsk({ log })} request={1} />)
    expect(question()).toHaveFocus()
  })

  it('a stranger\'s markup renders as text: no img, no javascript: link, no off-site link', () => {
    const hostile = '<img src=x onerror=alert(1)> [x](javascript:alert(1)) [y](https://evil.example) https://evil.example/z'
    render(<Harness info={makeAsk({ log: [makeLogEntry({ id: 15, question: hostile, answer: hostile }), makeLogEntry({ id: 16, ts: ts(20, 9), visitor: 'v1', question: 'Next', answer: hostile })] })} />)
    expect(card().querySelector('img')).toBeNull()
    for (const link of card().querySelectorAll('a')) expect(link.getAttribute('href')).toMatch(/^https:\/\/steven\.wilssens\.com\//)
    expect(within(card()).getAllByText(/<img src=x onerror=alert\(1\)>/).length).toBeGreaterThan(0)
    // A saved note comes back only as the text of the note box.
    cleanup()
    render(<Harness initial="rated" info={makeAsk({ log: [makeLogEntry({ id: 17, rating: makeRating({ logId: 17, note: hostile }) })] })} />)
    expect(card().querySelector('img')).toBeNull()
    expect(within(card()).getByRole('textbox', { name: /Note/ })).toHaveValue(hostile)
    expect(card().querySelectorAll('a[href^="javascript:"], a[href*="evil.example"]')).toHaveLength(0)
  })

  it('marks its chip while unrated answers of the last seven days wait', () => {
    render(<Harness info={makeAsk({ log, unratedWeek: [1] })} />)
    expect(card()).toHaveAttribute('data-new')
    cleanup()
    render(<Harness info={makeAsk({ log, unratedWeek: [] })} />)
    expect(card()).not.toHaveAttribute('data-new')
  })
})

describe('the pieces under an answer', () => {
  it('a rating badge says good, the score, or wrong', () => {
    const badge = (rating: AskRating) => { const { container } = render(<RatingBadge rating={rating} />); const node = container.querySelector('.badge')!; return [node.className, node.textContent] }
    expect(badge(makeRating({ overall: 5 }))).toEqual(['badge', 'good · 5'])
    expect(badge(makeRating({ overall: 3 }))).toEqual(['badge warn', '3'])
    expect(badge(makeRating({ overall: 2 }))).toEqual(['badge error', '2'])
    expect(badge(makeRating({ overall: 5, accurate: 'no' }))).toEqual(['badge error', 'wrong'])
  })

  it('a source list says when nothing was cited, and links only to the site\'s own pages', () => {
    const { container, rerender } = render(<SourceList sources={[]} />)
    expect(container).toHaveTextContent('No source cited')
    rerender(<SourceList sources={[{ id: 'notes', title: "Steven's notes", href: null }, { id: 'x', title: 'Odd', href: 'javascript:alert(1)' }]} />)
    expect(container.querySelectorAll('a')).toHaveLength(0)
    expect(container).toHaveTextContent("Steven's notesOdd")
  })

  it('an answer with nothing kept says so', () => {
    render(<AnswerText entry={makeLogEntry({ answer: null })} load={async () => null} />)
    expect(screen.getByText('No answer was kept.')).toBeInTheDocument()
  })

  it('the loader fetches each answer once, and again after a failure', async () => {
    const fetchOne = vi.fn(async (id: number) => (id === 2 ? null : makeLogEntry({ id })))
    const load = cachedLoader(fetchOne)
    await load(1)
    await load(1)
    expect(fetchOne).toHaveBeenCalledTimes(1)
    expect(await load(2)).toBeNull()
    await load(2)
    expect(fetchOne).toHaveBeenCalledTimes(3)
    const failing = cachedLoader(async () => { throw new Error('offline') })
    expect(await failing(3)).toBeNull()
  })
})
