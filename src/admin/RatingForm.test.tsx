import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RatingForm, type RatingKeys, type SaveResult } from './RatingForm'
import { makeLogEntry, makeRating } from '../test/admin-fixtures'
import type { AskLogEntry, RatingDraft } from './types'

afterEach(cleanup)

const saved = (draft: RatingDraft): SaveResult => ({ ok: true, rating: makeRating({ logId: draft.id, accurate: draft.accurate, overall: draft.overall }) })
const group = (name: string) => screen.getByRole('group', { name })
const pick = (name: string, option: string | RegExp) => within(group(name)).getByRole('radio', { name: option })
const show = (entry: AskLogEntry = makeLogEntry(), onSave = vi.fn(async (draft: RatingDraft) => saved(draft)), extra: Partial<Parameters<typeof RatingForm>[0]> = {}) => {
  render(<RatingForm entry={entry} onSave={onSave} saveLabel="Save" {...extra} />)
  return onSave
}
// The queue's card sends its keys to the form; here a wrapper does.
function WithKeys({ entry, onSave }: { entry: AskLogEntry; onSave: (draft: RatingDraft) => Promise<SaveResult> }) {
  const keys = useRef<RatingKeys>(null)
  return <div data-testid="card" onKeyDown={(event) => keys.current?.onKey(event)}><button type="button">Outside the form</button><RatingForm entry={entry} onSave={onSave} saveLabel="Save and next" keys={keys} /></div>
}

describe('the rubric', () => {
  it('each criterion and the score are a group a screen reader names, with the rubric\'s question as its description', () => {
    show()
    for (const name of ['Accurate', 'Supported', 'Answers the question', 'Tone and length', 'Overall']) expect(group(name)).toBeInTheDocument()
    expect(group('Accurate')).toHaveAccessibleDescription(/Is every claim about Steven true/)
    expect(group('Accurate')).toHaveAttribute('title', expect.stringContaining('work authorization'))
    expect(group('Overall')).toHaveAccessibleDescription(/Good is 4 or 5/)
    expect(pick('Overall', '4, good, small things to polish')).toBeInTheDocument()
    expect(within(group('Accurate')).getAllByRole('radio').map((radio) => radio.parentElement!.textContent)).toEqual(['Yes', 'Partly', 'No'])
  })

  it('Tab reaches each group once and arrow keys choose within it', async () => {
    const user = userEvent.setup()
    show()
    await user.tab()
    expect(pick('Accurate', 'Yes')).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(pick('Accurate', 'Partly')).toBeChecked()
    await user.tab()
    expect(pick('Supported', 'Yes')).toHaveFocus()
    await user.tab()
    await user.tab()
    await user.tab()
    expect(pick('Overall', /^1/)).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Note (optional)' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
  })

  it('with answers missing nothing is sent, the first missing group is aria-invalid, the alert names them and focus moves there', async () => {
    const user = userEvent.setup()
    const onSave = show()
    await user.click(pick('Accurate', 'Yes'))
    await user.click(pick('Answers the question', 'Yes'))
    await user.click(pick('Tone and length', 'Yes'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(group('Supported')).toHaveAttribute('aria-invalid', 'true')
    expect(group('Overall')).toHaveAttribute('aria-invalid', 'true')
    expect(group('Accurate')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('alert')).toHaveTextContent('Answer Supported and Overall to save.')
    expect(pick('Supported', 'Yes')).toHaveFocus()
    // Answering one takes it off the list.
    await user.click(pick('Supported', 'Partly'))
    expect(group('Supported')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('alert')).toHaveTextContent('Answer Overall to save.')
    await user.click(pick('Overall', /^4/))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ id: 1, accurate: 'yes', supported: 'partly', answers: 'yes', tone: 'yes', overall: 4, note: null, addToQuestions: false })
  })

  it('names three or more missing answers in one line', async () => {
    const user = userEvent.setup()
    show()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Answer Accurate, Supported, Answers the question, Tone and length and Overall to save.')
  })

  it('Accurate No shows the wrong-answer line', async () => {
    const user = userEvent.setup()
    show()
    expect(screen.queryByText('Counts as a wrong answer whatever the overall score.')).not.toBeInTheDocument()
    await user.click(pick('Accurate', 'No'))
    expect(screen.getByText('Counts as a wrong answer whatever the overall score.')).toHaveClass('status-text', 'poor')
  })

  it('an off-topic answer has n/a chosen for Supported and Tone and length, and none on the other two', () => {
    show(makeLogEntry({ outcome: 'off' }))
    expect(pick('Supported', 'n/a')).toBeChecked()
    expect(pick('Tone and length', 'n/a')).toBeChecked()
    expect(within(group('Accurate')).queryByRole('radio', { name: 'n/a' })).not.toBeInTheDocument()
    expect(within(group('Answers the question')).queryByRole('radio', { name: 'n/a' })).not.toBeInTheDocument()
    cleanup()
    show()
    expect(within(group('Supported')).queryByRole('radio', { name: 'n/a' })).not.toBeInTheDocument()
  })

  it('starts from the saved rating and its note, and shows the chosen anchor', () => {
    show(makeLogEntry({ rating: makeRating({ accurate: 'partly', overall: 3, note: 'Too long.' }) }))
    expect(pick('Accurate', 'Partly')).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Note (optional)' })).toHaveValue('Too long.')
    expect(screen.getByText('3: Acceptable, not as the norm')).toBeInTheDocument()
  })

  it('the box shows only while the rating is poor, unticked, and is cleared when the rating stops being poor', async () => {
    const user = userEvent.setup()
    const onSave = show()
    const box = () => screen.queryByRole('checkbox', { name: /Add to my questions/ })
    for (const name of ['Accurate', 'Supported', 'Answers the question', 'Tone and length']) await user.click(pick(name, 'Yes'))
    await user.click(pick('Overall', /^3/))
    expect(box()).not.toBeInTheDocument()
    await user.click(pick('Overall', /^2/))
    expect(box()).not.toBeChecked()
    await user.click(box()!)
    await user.click(pick('Overall', /^4/))
    expect(box()).not.toBeInTheDocument()
    await user.click(pick('Accurate', 'No'))
    expect(box()).not.toBeChecked()
    await user.click(box()!)
    await user.type(screen.getByRole('textbox', { name: 'Note (optional)' }), '  Wrong start date.  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ accurate: 'no', overall: 4, addToQuestions: true, note: 'Wrong start date.' }))
  })

  it('counts the note against 1,000 characters and reads it out only near the end', async () => {
    const user = userEvent.setup()
    show()
    const note = screen.getByRole('textbox', { name: 'Note (optional)' })
    expect(note).toHaveAttribute('maxLength', '1000')
    expect(screen.getByText('0 of 1,000')).toHaveAttribute('aria-live', 'off')
    await user.click(note)
    await user.paste('x'.repeat(950))
    expect(screen.getByText('950 of 1,000')).toHaveAttribute('aria-live', 'polite')
    await user.type(note, '{Enter}{Enter}{Enter}')
    expect(note).toHaveAttribute('rows', '4')
  })

  it('a failed save says so and keeps every choice and the note, with focus on Save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(async (): Promise<SaveResult> => ({ ok: false, reason: 'HTTP 500' }))
    show(makeLogEntry(), onSave)
    for (const name of ['Accurate', 'Supported', 'Answers the question', 'Tone and length']) await user.click(pick(name, 'Partly'))
    await user.click(pick('Overall', /^3/))
    await user.type(screen.getByRole('textbox', { name: 'Note (optional)' }), 'Vague')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('status')).toHaveTextContent('Could not save the rating (HTTP 500). Your choices are still here; press Save again.')
    expect(pick('Accurate', 'Partly')).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Note (optional)' })).toHaveValue('Vague')
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
  })

  it('says it is saving, and a second save while saving sends nothing', async () => {
    const user = userEvent.setup()
    let finish: (result: SaveResult) => void = () => {}
    const onSave = vi.fn(() => new Promise<SaveResult>((resolve) => { finish = resolve }))
    show(makeLogEntry({ rating: makeRating() }), onSave)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('status')).toHaveTextContent('Saving…')
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    finish({ ok: true, rating: makeRating() })
    await vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(''))
  })

  it('Escape closes it without saving through Cancel, and Cancel does too', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onSave = show(makeLogEntry(), undefined, { onCancel })
    await user.click(pick('Accurate', 'Yes'))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows the status it is given', () => {
    show(makeLogEntry(), undefined, { status: 'Saved: good (5) for “Earlier”.' })
    expect(screen.getByRole('status')).toHaveTextContent('Saved: good (5) for “Earlier”.')
  })
})

describe('the rubric by keyboard in the queue', () => {
  it('Y Y Y Y 5 Enter rates a good answer without Tab', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(async (draft: RatingDraft) => saved(draft))
    render(<WithKeys entry={makeLogEntry()} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'Outside the form' }))
    await user.keyboard('y')
    expect(pick('Accurate', 'Yes')).toBeChecked()
    expect(pick('Supported', 'Yes')).toHaveFocus()
    await user.keyboard('yyy5')
    expect(pick('Overall', /^5/)).toBeChecked()
    // Focus follows the option the shortcut checked, so an arrow key moves from there.
    expect(pick('Overall', /^5/)).toHaveFocus()
    await user.keyboard('3')
    expect(pick('Overall', /^3/)).toHaveFocus()
    await user.keyboard('5{Enter}')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ accurate: 'yes', supported: 'yes', answers: 'yes', tone: 'yes', overall: 5 }))
  })

  it('Y / P / N answer the criterion that has focus, else the first one still open, and move to the next', async () => {
    const user = userEvent.setup()
    render(<WithKeys entry={makeLogEntry()} onSave={async (draft) => saved(draft)} />)
    pick('Answers the question', 'Yes').focus()
    await user.keyboard('n')
    expect(pick('Answers the question', 'No')).toBeChecked()
    expect(pick('Tone and length', 'Yes')).toHaveFocus()
    await user.keyboard('p')
    expect(pick('Tone and length', 'Partly')).toBeChecked()
    // The next open one wraps round to the first.
    expect(pick('Accurate', 'Yes')).toHaveFocus()
    screen.getByRole('button', { name: 'Outside the form' }).focus()
    await user.keyboard('y')
    expect(pick('Accurate', 'Yes')).toBeChecked()
    expect(pick('Supported', 'Yes')).toHaveFocus()
    await user.keyboard('y')
    expect(pick('Overall', /^1/)).toHaveFocus()
    // Moving on to a group that has a choice lands on that choice.
    await user.keyboard('4')
    pick('Tone and length', 'Partly').focus()
    await user.keyboard('y')
    expect(pick('Overall', /^4/)).toHaveFocus()
  })

  it('A answers n/a only where it is offered and does nothing elsewhere', async () => {
    const user = userEvent.setup()
    render(<WithKeys entry={makeLogEntry({ outcome: 'off' })} onSave={async (draft) => saved(draft)} />)
    pick('Supported', 'Yes').focus()
    await user.keyboard('y')
    expect(pick('Supported', 'Yes')).toBeChecked()
    pick('Supported', 'Yes').focus()
    await user.keyboard('a')
    expect(pick('Supported', 'n/a')).toBeChecked()
    pick('Accurate', 'Yes').focus()
    await user.keyboard('a')
    expect(within(group('Accurate')).getAllByRole('radio').some((radio) => (radio as HTMLInputElement).checked)).toBe(false)
    cleanup()
    render(<WithKeys entry={makeLogEntry()} onSave={async (draft) => saved(draft)} />)
    pick('Supported', 'Yes').focus()
    await user.keyboard('a')
    expect(within(group('Supported')).getAllByRole('radio').some((radio) => (radio as HTMLInputElement).checked)).toBe(false)
  })

  it('Enter in the note writes a new line; Ctrl+Enter and Cmd+Enter save; other keys there are just text', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(async (draft: RatingDraft) => saved(draft))
    render(<WithKeys entry={makeLogEntry({ rating: makeRating() })} onSave={onSave} />)
    const note = screen.getByRole('textbox', { name: 'Note (optional)' })
    await user.click(note)
    await user.keyboard('ny5{Enter}')
    expect(onSave).not.toHaveBeenCalled()
    expect(note).toHaveValue('ny5\n')
    expect(pick('Accurate', 'Yes')).toBeChecked()
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onSave).toHaveBeenCalledTimes(1)
    await user.keyboard('{Meta>}{Enter}{/Meta}')
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('Enter on a button does what the button does, and Ctrl with a letter is left alone', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(async (draft: RatingDraft) => saved(draft))
    render(<WithKeys entry={makeLogEntry()} onSave={onSave} />)
    screen.getByRole('button', { name: 'Outside the form' }).focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{Control>}y{/Control}')
    await user.keyboard('x')
    expect(onSave).not.toHaveBeenCalled()
    expect(within(group('Accurate')).getAllByRole('radio').some((radio) => (radio as HTMLInputElement).checked)).toBe(false)
  })
})
