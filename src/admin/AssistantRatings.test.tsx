import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withRatings } from './askQuality'
import { AssistantPage } from './AssistantPage'
import type { SaveResult } from './RatingForm'
import { makeAsk, makeLogEntry, makeRating, NOW, ts } from '../test/admin-fixtures'
import type { AskInfo, AskRating, RatingDraft } from './types'

// The rating parts of the Ask about Steven page (specs/ask-ratings.md, AC-11, AC-15, AC-22, AC-25).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const log = [
  makeLogEntry({ id: 1, ts: ts(19, 9), visitor: 'v1', question: 'Where is he based?', answer: 'In **Belgium**.' }),
  makeLogEntry({ id: 2, ts: ts(19, 10), visitor: 'v1', question: 'And his team?', answer: 'He led three teams.', rating: makeRating({ logId: 2, overall: 3 }) }),
  makeLogEntry({ id: 3, ts: ts(19, 11), visitor: 'v1', question: 'Busy?', answer: null, outcome: 'limited' }),
  makeLogEntry({ id: 4, ts: ts(19, 12), visitor: 'v1', question: 'Broken?', answer: null, outcome: 'failed' }),
]
// The page as Admin gives it: saved ratings merged on top of the data.
function Page({ info, onRate, request }: { info: AskInfo; onRate: (draft: RatingDraft) => Promise<SaveResult>; request?: string }) {
  const [saved, setSaved] = useState(new Map<number, AskRating>())
  const rate = async (draft: RatingDraft) => {
    const result = await onRate(draft)
    if (result.ok) setSaved((current) => new Map(current).set(draft.id, result.rating))
    return result
  }
  return <AssistantPage info={withRatings(info, saved)} days={7} onRate={rate} onLoadEntry={async () => null} request={request} />
}
const ok = vi.fn(async (draft: RatingDraft): Promise<SaveResult> => ({ ok: true, rating: makeRating({ logId: draft.id, accurate: draft.accurate, overall: draft.overall }) }))
const people = () => screen.getByRole('table', { name: 'People who asked' })
const openPerson = async (user: ReturnType<typeof userEvent.setup>) => user.click(within(people()).getByRole('button', { name: /Open details for/ }))
const turnOf = (text: string) => [...people().querySelectorAll<HTMLElement>('.turn')].find((turn) => turn.textContent!.includes(text))!
const radio = (scope: HTMLElement, group: string, name: string | RegExp) => within(within(scope).getByRole('group', { name: group })).getByRole('radio', { name })

describe('rating on the Ask about Steven page', () => {
  it('the cards come in the order People who asked, Answer quality, Rate answers, Use and cost', () => {
    const { container } = render(<Page info={makeAsk({ log })} onRate={ok} />)
    expect([...container.querySelectorAll<HTMLElement>('[data-part]')].map((part) => part.dataset.part)).toEqual(['People', 'Answer quality', 'Rate answers', 'Use and cost', 'Waiting for you'])
  })

  it('People who asked: an opened conversation shows each answer whole, the sources by title, the model and the version', async () => {
    const user = userEvent.setup()
    render(<Page info={makeAsk({ log })} onRate={ok} />)
    await openPerson(user)
    const table = people()
    expect(within(table).getByText('Belgium').tagName).toBe('STRONG')
    expect(within(table).getAllByText('opus-5-5 · a1b2c3d4')).toHaveLength(2)
    expect(within(table).getAllByRole('link', { name: /Group PM, Microsoft/ })).toHaveLength(2)
    expect(within(table).getByText('3')).toHaveClass('badge', 'warn')
  })

  it('shows no rating control on a limited or failed answer', async () => {
    const user = userEvent.setup()
    render(<Page info={makeAsk({ log })} onRate={ok} />)
    await openPerson(user)
    expect(within(people()).getAllByRole('button', { name: /Rate this answer|Change rating/ })).toHaveLength(2)
    const busy = turnOf('Busy?')
    expect(within(busy).queryByRole('button', { name: /Rate this answer/ })).not.toBeInTheDocument()
  })

  it('Rate this answer opens the form; Save shows the badge in place and focuses Change rating, without reloading', async () => {
    const user = userEvent.setup()
    const onRate = vi.fn(ok)
    render(<Page info={makeAsk({ log })} onRate={onRate} />)
    await openPerson(user)
    const turn = turnOf('Where is he based?')
    const button = within(turn).getByRole('button', { name: 'Rate this answer' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    for (const group of ['Accurate', 'Supported', 'Answers the question', 'Tone and length']) await user.click(radio(turn, group, 'Yes'))
    await user.click(radio(turn, 'Overall', /^5/))
    await user.click(within(turn).getByRole('button', { name: 'Save' }))
    expect(onRate).toHaveBeenCalledTimes(1)
    expect(within(turn).queryByRole('group', { name: 'Accurate' })).not.toBeInTheDocument()
    expect(within(turn).getByText('good · 5')).toBeInTheDocument()
    expect(within(turn).getByRole('button', { name: 'Change rating' })).toHaveFocus()
  })

  it('a failed save says so and the form stays open with every choice', async () => {
    const user = userEvent.setup()
    render(<Page info={makeAsk({ log })} onRate={async () => ({ ok: false, reason: 'HTTP 500' })} />)
    await openPerson(user)
    const turn = turnOf('And his team?')
    await user.click(within(turn).getByRole('button', { name: 'Change rating' }))
    expect(radio(turn, 'Overall', /^3/)).toBeChecked()
    await user.click(within(turn).getByRole('button', { name: 'Save' }))
    expect(within(turn).getByText(/Could not save the rating \(HTTP 500\)/)).toBeInTheDocument()
    expect(radio(turn, 'Overall', /^3/)).toBeChecked()
  })

  it('Escape closes the form without saving and gives focus back', async () => {
    const user = userEvent.setup()
    const onRate = vi.fn(ok)
    render(<Page info={makeAsk({ log })} onRate={onRate} />)
    await openPerson(user)
    const turn = turnOf('Where is he based?')
    await user.click(within(turn).getByRole('button', { name: 'Rate this answer' }))
    await user.click(radio(turn, 'Accurate', 'No'))
    await user.keyboard('{Escape}')
    expect(within(turn).queryByRole('group', { name: 'Accurate' })).not.toBeInTheDocument()
    expect(within(turn).getByRole('button', { name: 'Rate this answer' })).toHaveFocus()
    expect(onRate).not.toHaveBeenCalled()
  })

  it('a stranger\'s markup renders as text in People: no img, no javascript: link, no off-site link', async () => {
    const user = userEvent.setup()
    const hostile = '<img src=x onerror=alert(1)> [x](javascript:alert(1)) [y](https://evil.example)'
    render(<Page info={makeAsk({ log: [makeLogEntry({ id: 9, question: hostile, answer: hostile, rating: makeRating({ logId: 9, note: hostile }) })] })} onRate={ok} />)
    await openPerson(user)
    const page = document.body
    expect(page.querySelector('img')).toBeNull()
    for (const link of page.querySelectorAll('a')) expect(link.getAttribute('href') ?? '').not.toMatch(/javascript:|evil\.example/)
    expect(within(people()).getAllByText(/<img src=x onerror=alert\(1\)>/).length).toBeGreaterThan(0)
  })

  it('Show them in Answer quality chooses Marked wrong and focuses the first question', async () => {
    const user = userEvent.setup()
    const wrongLog = [...log, makeLogEntry({ id: 5, ts: ts(18, 9), question: 'Is he in Seattle?', rating: makeRating({ logId: 5, accurate: 'no' }) })]
    render(<Page info={makeAsk({ log: wrongLog, ratings: wrongLog.flatMap((entry) => (entry.rating ? [entry.rating] : [])) })} onRate={ok} />)
    await user.click(screen.getByRole('button', { name: 'Show them' }))
    const queue = screen.getByRole('heading', { name: 'Rate answers' }).closest('section')!
    expect(within(within(queue).getByRole('group', { name: 'Show' })).getByRole('button', { name: /Marked wrong 1/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(queue).getByRole('heading', { level: 3 })).toHaveTextContent('Is he in Seattle?')
    expect(within(queue).getByRole('heading', { level: 3 })).toHaveFocus()
  })

  it('a Needs you link chooses its filter, and Nothing rated yet leads to the queue', async () => {
    const user = userEvent.setup()
    render(<Page info={makeAsk({ log: [log[0]], ratings: [] })} onRate={ok} request="unrated" />)
    const queue = screen.getByRole('heading', { name: 'Rate answers' }).closest('section')!
    expect(within(queue).getByRole('heading', { level: 3 })).toHaveFocus()
    await user.click(within(people()).getByRole('button', { name: /Open details for/ }))
    await user.click(screen.getByRole('button', { name: 'Rate answers' }))
    expect(within(queue).getByRole('heading', { level: 3 })).toHaveFocus()
  })

  it('Questions waiting for you shows reason rated as "you rated it poor"', () => {
    render(<Page info={makeAsk({ log: [], questions: [{ id: 30, ts: ts(19, 9), reason: 'rated', page: 'home', question: 'When can he start?', answer: 'In March.', country: null, asOrg: null }] })} onRate={ok} />)
    expect(within(screen.getByRole('table', { name: 'Questions waiting' })).getByText('you rated it poor')).toHaveClass('badge', 'unhelpful')
  })

  it('without a way to save, a save says so', async () => {
    const user = userEvent.setup()
    render(<AssistantPage info={makeAsk({ log: [log[0]] })} days={7} />)
    const queue = screen.getByRole('heading', { name: 'Rate answers' }).closest('section')!
    within(queue).getByRole('heading', { level: 3 }).focus()
    await user.keyboard('yyyy5{Enter}')
    expect(within(queue).getByRole('status')).toHaveTextContent('Could not save the rating (not signed in)')
  })
})
