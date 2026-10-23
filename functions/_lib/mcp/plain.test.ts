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
    ['Line one\nline two\u202e', 'Line one line two update'],
    ['C1\u0085 and word\u2060 joiner', 'C1 and word joiner update'],
    // The name is Steven's own words: "merge" in his title stays.
    ['Merge the two Microsoft roles', 'Merge the two Microsoft roles update'],
    // A Building refresh's pull request: the project and what changed, never the merge commit's branch.
    ['Building steven.wilssens.com: Merge mcp-plain-english: your MCP talks t…', 'steven.wilssens.com write-up: your MCP talks t…'],
    ['Building wilssens.com: Merge pull request #74 from stewils/fix-costs-token-test', 'wilssens.com write-up: refresh after a check-in'],
    ['Building leo.wilssens.com: Merge dev-costs', 'leo.wilssens.com write-up: refresh after a check-in'],
    ['Building leo.wilssens.com: New level 4', 'leo.wilssens.com write-up: New level 4'],
    // Project names with a space, and git's own merge subjects.
    ['Building AI Breaker: Merge pull request #12 from stewils/levels', 'AI Breaker write-up: refresh after a check-in'],
    ["Building Junior Track Cycling: Merge branch 'main' into gearing: the new gear table", 'Junior Track Cycling write-up: the new gear table'],
    ["Building AI Breaker: Merge remote-tracking branch 'origin/main'", 'AI Breaker write-up: refresh after a check-in'],
    ["Building Junior Track Cycling: Merge branch 'fix' of github.com:stewils/jtc into main", 'Junior Track Cycling write-up: refresh after a check-in'],
    ['Building AI Breaker: Merge pull request #5 from stewils/new_level', 'AI Breaker write-up: refresh after a check-in'],
    ['Building wilssens.com: redo of #61', 'wilssens.com write-up: refresh after a check-in'],
    // Only a project with a write-up is read as a refresh: Steven's own "Building …:" title stays his.
    ['Building trust: the Cosmos story', 'Building trust: the Cosmos story update'],
  ])('%j is %j', (title, name) => {
    expect(updateName(title)).toBe(name)
  })

  it('cuts a long title at a word, one without spaces at 60 characters, and a long Building refresh too', () => {
    // " update" is added after the cut, so it is never the part cut off.
    expect(updateName('Rewrite the summary of the Windows and Devices Data role with the exact team numbers')).toBe('Rewrite the summary of the Windows and Devices Data… update')
    expect(updateName('Team sizes, Azure DevOps context and Cosmos start date and more')).toBe('Team sizes, Azure DevOps context and Cosmos start… update')
    expect(updateName('x'.repeat(80))).toBe(`X${'x'.repeat(51)}… update`)
    expect(updateName('x'.repeat(80))).toHaveLength(60)
    expect(updateName(`Fix ${'y'.repeat(80)}`)).toHaveLength(60)
    // A Building refresh title is up to 72 characters (scripts/building-brief.mjs); its name is still 60 at most.
    const long = updateName(`Building steven.wilssens.com: ${'word '.repeat(9)}end`)
    expect(long.length).toBeLessThanOrEqual(60)
    expect(long).toMatch(/^steven\.wilssens\.com write-up: word .*…$/)
    const refresh = updateName(`Refresh the Building write-up about [${'a'.repeat(40)}](https://evil.example/${'b'.repeat(40)})`)
    expect(refresh.length).toBeLessThanOrEqual(60)
    expect(refresh).not.toMatch(/[[\]()]|https?:/)
  })
})

describe('what Steven hears', () => {
  const name = 'Foresight summary update'
  const lines = [
    say.started(name, false), say.started(name, true), say.stillWorking(name), say.ready(name, 'https://preview.example', null), say.checking(name, 'https://preview.example'), say.checksFailed(name, []), say.checksFailed(name, ['team', 'gates']), say.checksFailed(name, ['check', 'other']), say.notReadyYet(name), say.clashes(name),
    say.alreadyLive(name), say.setAside(name), say.nothingToChange(name), say.notCarriedOut(name), say.notFound(name), say.failed(name), say.live(name, 0), say.live(name, 1), say.live(name, 3),
    say.notLiveYet(name), say.changedSince(name, 'https://preview.example'), say.redoing(name), say.remade(name, 'https://preview.example'), say.closed(name, 0), say.closed(name, 1), say.closed(name, 2), say.alreadyClosed(name),
    say.status({ ready: [], checking: [], making: [], held: [], clashing: [], lowering: [] }),
    say.status({ ready: [], checking: [], making: [], held: [], waiting: [name], clashing: [], lowering: [] }),
    say.status({ ready: [name, 'Team size update'], checking: ['Photo update', 'Links update'], making: ['Headline update', 'About update'], held: ['Skills update', 'Dates update'], clashing: ['Bullets update', 'Awards update'], lowering: [name, 'Skills update'] }),
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
    expect(say.checksFailed(name, [])).toBe("Your Foresight summary update isn't ready to go live: the team's checks haven't passed.")
    expect(say.checksFailed(name, ['team', 'gates'])).toBe("Your Foresight summary update isn't ready to go live: the team's review and the résumé score check haven't passed. The team may have a question for you.")
    expect(say.checksFailed(name, ['check'])).toBe("Your Foresight summary update isn't ready to go live: the site checks haven't passed.")
    expect(say.checksFailed(name, ['deploy', 'lint'])).toBe("Your Foresight summary update isn't ready to go live: the preview and another check haven't passed.")
    expect(say.checking(name, 'https://preview.example')).toBe("Your Foresight summary update is ready to look at while the team finishes checking it; I'll tell you when it can go live. Preview: https://preview.example")
    expect(say.checksFailed(name, ['team'])).not.toMatch(/want it live/i)
    expect(say.notReadyYet(name)).not.toMatch(/want it live/i)
  })

  it('sums up several updates', () => {
    expect(say.status({ ready: [], checking: [], making: [], held: [], clashing: [], lowering: [] })).toBe('Nothing is waiting: every update is live or set aside.')
    expect(say.status({ ready: [name], checking: ['Photo update'], making: ['Headline update'], held: ['Skills update'], clashing: ['Bullets update'], lowering: [] })).toBe("Your Foresight summary update is ready to check. Your Photo update is ready to look at while the team finishes checking it. Your Headline update is still being made. Your Skills update is held back: the team's checks haven't passed. Your Bullets update needs to be made again before it can go live.")
    expect(say.status({ ready: [name, 'Team size update', 'Skills update'], checking: ['E update', 'F update'], making: ['Headline update', 'About update'], held: ['A update', 'B update'], clashing: ['C update', 'D update'], lowering: [name, 'Skills update'] })).toBe("3 updates are ready to check: Foresight summary update, Team size update and Skills update. 2 updates are ready to look at while the team finishes checking: E update and F update. 2 updates are still being made. 2 updates are held back: the team's checks haven't passed (A update and B update). 2 updates need to be made again before they can go live: C update and D update. Your Foresight summary update and your Skills update would make your résumé score lower with job-application software.")
  })

  it('says an update the branch rules hold, with no check failed, is not ready yet rather than failed', () => {
    expect(say.status({ ready: [], checking: [], making: [], held: [], waiting: [name], clashing: [], lowering: [] })).toBe("Your Foresight summary update isn't ready to go live yet: it waits for the team's checks to pass.")
    expect(say.status({ ready: [], checking: [], making: [], held: ['A update'], waiting: ['B update', 'C update'], clashing: [], lowering: [] })).toBe("Your A update is held back: the team's checks haven't passed. 2 updates aren't ready to go live yet: they wait for the team's checks to pass (B update and C update).")
  })

  it('tells the assistant how to speak', () => {
    expect(speakPlainly).toMatch(/Never mention pull request numbers, runs, branches, workflows or merges unless he asks/)
  })
})
