import { describe, expect, it } from 'vitest'
import { say, speakPlainly, updateName } from './plain'

const jargon = /pull request|\bPR\b|branch|\brun\b|workflow|merge|#\d/i

describe('an update\'s name', () => {
  it.each([
    ['Foresight summary', 'Foresight summary update'],
    ['foresight summary update', 'Foresight summary update'],
    ['Team size on the Group PM role', 'Team size on the Group PM role'],
    ['Fix #12: the HiPo honour.', 'Fix: the HiPo honour'],
    ['  New   summary and HiPo honour ', 'New summary and HiPo honour'],
    ['Refresh the Building write-up about wilssens', 'Building wilssens write-up refresh'],
    ['', 'site update'],
    [null, 'site update'],
    ['#42', 'site update'],
  ])('%j is %j', (title, name) => {
    expect(updateName(title)).toBe(name)
  })

  it('cuts a long title at a word, and one without spaces at 60 characters', () => {
    const long = updateName('Rewrite the summary of the Windows and Devices Data role with the exact team numbers')
    expect(long).toBe('Rewrite the summary of the Windows and Devices Data role…')
    expect(updateName('x'.repeat(80))).toBe(`X${'x'.repeat(59)}…`)
  })
})

describe('what Steven hears', () => {
  const name = 'Foresight summary update'
  const lines = [
    say.started(name, false), say.started(name, true), say.stillWorking(name), say.ready(name, 'https://preview', null), say.alreadyLive(name), say.setAside(name),
    say.nothingToChange(name), say.notCarriedOut(name), say.notFound(name), say.failed(name), say.live(name, 0), say.live(name, 1), say.live(name, 3),
    say.notLiveYet(name), say.redoing(name), say.closed(name, 0), say.closed(name, 1), say.closed(name, 2), say.alreadyClosed(name),
    say.status([], [], []), say.status([name], [], []), say.status([name, 'Team size update', 'Skills update'], ['Headline update', 'About update'], [name, 'Skills update']),
  ]

  it('never names a pull request, a run, a branch, a workflow or a merge', () => {
    for (const line of lines) expect(line).not.toMatch(jargon)
  })

  it('says the update by its name, with the preview and a lower score when there is one', () => {
    expect(say.ready(name, 'https://preview', null)).toBe('Your Foresight summary update is ready to check: https://preview. Want it live?')
    expect(say.ready(name, 'https://preview', { before: 90, after: 85 })).toContain('(90 → 85 out of 100)')
    expect(say.ready(name, 'https://preview', { before: null, after: 85 })).not.toContain('lower')
    expect(say.live(name, 1)).toMatch(/The change you approved is now marked done\.$/)
    expect(say.closed(name, 2)).toMatch(/The changes you approved wait for the next update\.$/)
  })

  it('sums up several updates', () => {
    expect(say.status([], [], [])).toBe('Nothing is waiting: every update is live or set aside.')
    expect(say.status([name], [], [])).toBe('Your Foresight summary update is ready to check.')
    expect(say.status([name, 'Team size update', 'Skills update'], ['Headline update', 'About update'], [name, 'Skills update'])).toBe('3 updates are ready to check: Foresight summary update, Team size update and Skills update. 2 updates are still being made. Your Foresight summary update and your Skills update would make your résumé score lower with job-application software.')
  })

  it('tells the assistant how to speak', () => {
    expect(speakPlainly).toMatch(/Never mention pull request numbers, runs, branches, workflows or merges unless he asks/)
  })
})
