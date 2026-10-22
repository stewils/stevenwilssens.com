import { describe, expect, it } from 'vitest'
import { say, speakPlainly, updateName } from './plain'

// What Steven must never hear. A preview link is the exception: it is a link, said as one.
const jargon = /pull request|\bPR\b|branch|\brun\b|workflow|merge|#\d/i
const spoken = (line: string) => line.replace(/https:\/\/\S+/g, '<link>')

describe('an update\'s name', () => {
  it.each([
    ['Foresight summary', 'Foresight summary update'],
    ['foresight summary update', 'Foresight summary update'],
    ['Team size on the Group PM role', 'Team size on the Group PM role update'],
    ['Fix #12: the HiPo honour.', 'Fix: the HiPo honour'],
    ['  New   summary and HiPo honour ', 'New summary and HiPo honour update'],
    ['Refresh the Building write-up about wilssens', 'Building wilssens write-up refresh'],
    ['PR 12', 'site update'],
    ['Pull request #7: headline', 'Headline update'],
    ['42', 'site update'],
    ['', 'site update'],
    [null, 'site update'],
    ['#42', 'site update'],
    ['[click me](https://evil.example) now', 'Click me now update'],
    ['<b>Bold</b> `code` *stars*', 'Bold code stars update'],
    ['Line one\nline two‮', 'Line one line two update'],
  ])('%j is %j', (title, name) => {
    expect(updateName(title)).toBe(name)
  })

  it('cuts a long title at a word, one without spaces at 60 characters, and a long Building refresh too', () => {
    expect(updateName('Rewrite the summary of the Windows and Devices Data role with the exact team numbers')).toBe('Rewrite the summary of the Windows and Devices Data role…')
    expect(updateName('x'.repeat(80))).toBe(`X${'x'.repeat(59)}…`)
    const refresh = updateName(`Refresh the Building write-up about [${'a'.repeat(40)}](https://evil.example/${'b'.repeat(40)})`)
    expect(refresh.length).toBeLessThanOrEqual(61)
    expect(refresh).not.toMatch(/[[\]()]|https?:/)
  })
})

describe('what Steven hears', () => {
  const name = 'Foresight summary update'
  const lines = [
    say.started(name, false), say.started(name, true), say.stillWorking(name), say.ready(name, 'https://preview.example', null), say.checksFailed(name), say.notReadyYet(name), say.clashes(name),
    say.alreadyLive(name), say.setAside(name), say.nothingToChange(name), say.notCarriedOut(name), say.notFound(name), say.failed(name), say.live(name, 0), say.live(name, 1), say.live(name, 3),
    say.notLiveYet(name), say.changedSince(name, 'https://preview.example'), say.redoing(name), say.remade(name, 'https://preview.example'), say.closed(name, 0), say.closed(name, 1), say.closed(name, 2), say.alreadyClosed(name),
    say.status({ ready: [], making: [], held: [], clashing: [], lowering: [] }),
    say.status({ ready: [name, 'Team size update'], making: ['Headline update', 'About update'], held: ['Skills update', 'Dates update'], clashing: ['Bullets update', 'Awards update'], lowering: [name, 'Skills update'] }),
  ]

  it('never names a pull request, a run, a branch, a workflow or a merge', () => {
    for (const line of lines) expect(spoken(line)).not.toMatch(jargon)
  })

  it('says the update by its name, with the preview last and a lower score before the question', () => {
    expect(say.ready(name, 'https://preview.example', null)).toBe('Your Foresight summary update is ready to check. Want it live? Preview: https://preview.example')
    expect(say.ready(name, 'https://preview.example', { before: 90, after: 85 })).toBe('Your Foresight summary update is ready to check. Before you say yes: this version of your résumé scores lower with job-application software (from 90 to 85 out of 100) than the one live today. Want it live? Preview: https://preview.example')
    expect(say.ready(name, 'https://preview.example', { before: null, after: 85 })).not.toContain('lower')
    expect(say.live(name, 1)).toMatch(/The change you approved is now marked done\.$/)
    expect(say.live(name, 3)).toMatch(/The 3 changes you approved are now marked done\.$/)
    expect(say.closed(name, 1)).toMatch(/The change you approved waits for the next update\.$/)
    expect(say.closed(name, 2)).toMatch(/The changes you approved wait for the next update\.$/)
    expect(say.checksFailed(name)).not.toMatch(/want it live/i)
    expect(say.notReadyYet(name)).not.toMatch(/want it live/i)
  })

  it('sums up several updates', () => {
    expect(say.status({ ready: [], making: [], held: [], clashing: [], lowering: [] })).toBe('Nothing is waiting: every update is live or set aside.')
    expect(say.status({ ready: [name], making: ['Headline update'], held: ['Skills update'], clashing: ['Bullets update'], lowering: [] })).toBe("Your Foresight summary update is ready to check. Your Headline update is still being made. Your Skills update is waiting for the team's checks to pass. Your Bullets update needs making again before going live.")
    expect(say.status({ ready: [name, 'Team size update', 'Skills update'], making: ['Headline update', 'About update'], held: ['A update', 'B update'], clashing: ['C update', 'D update'], lowering: [name, 'Skills update'] })).toBe("3 updates are ready to check: Foresight summary update, Team size update and Skills update. 2 updates are still being made. 2 updates are waiting for the team's checks to pass: A update and B update. 2 updates need making again before going live: C update and D update. Your Foresight summary update and your Skills update would make your résumé score lower with job-application software.")
  })

  it('tells the assistant how to speak', () => {
    expect(speakPlainly).toMatch(/Never mention pull request numbers, runs, branches, workflows or merges unless he asks/)
  })
})
