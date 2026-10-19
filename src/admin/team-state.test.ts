import { describe, expect, it } from 'vitest'
import { makeTeamManifest, makeTeamReads, makeUpdate, sha } from '../test/admin-fixtures'
import { changedLine, commitUrl, cutLine, fileUrl, isRead, noticeLine, pullUrl, roles, shortDay, tileLine, touching, unreadUpdates } from './team-state'

const manifest = makeTeamManifest()
const updates = manifest.history!.updates

describe('what Steven has seen of the team', () => {
  it('with no D1 rows, an update from before the launch is read and the launch and later are unread', () => {
    expect(updates.map((update) => isRead(update, makeTeamReads()))).toEqual([false, false, true])
    expect(unreadUpdates(manifest, makeTeamReads()).map((update) => update.sha)).toEqual([sha('3'), sha('2')])
  })

  it('follows D1 when it has a row: read, or marked unread again, even before the launch', () => {
    const reads = makeTeamReads({ read: [sha('3')], unread: [sha('1')] })
    expect(unreadUpdates(manifest, reads).map((update) => update.sha)).toEqual([sha('2'), sha('1')])
  })

  it('counts nothing without the read state, without a history, or without the launch', () => {
    expect(unreadUpdates(manifest, null)).toEqual([])
    expect(unreadUpdates(makeTeamManifest({ history: null }), makeTeamReads())).toEqual([])
    expect(unreadUpdates(makeTeamManifest({ launch: null }), makeTeamReads())).toEqual([])
  })

  it('ignores ids in D1 that are no longer in the manifest', () => {
    expect(unreadUpdates(manifest, makeTeamReads({ unread: [sha('9')] }))).toHaveLength(2)
  })

  it('finds the updates that touched a section, a role, a command or a step', () => {
    expect(touching(updates, { section: 'flow' }).map((update) => update.sha)).toEqual([sha('3')])
    expect(touching(updates, { role: 'fact-checker' }).map((update) => update.sha)).toEqual([sha('2')])
    expect(touching(updates, { command: 'publish' }).map((update) => update.sha)).toEqual([sha('1')])
    expect(touching(updates, { step: 'draft' }).map((update) => update.sha)).toEqual([sha('3')])
    expect(touching(updates, {})).toHaveLength(3)
  })
})

describe('the lines the page and the overview show', () => {
  it('words a changed section for one update and for several, with the pull request when there is one', () => {
    expect(changedLine([updates[0]])).toBe('Changed 19 Oct: The panel reviews every draft (PR #41)')
    expect(changedLine([updates[1]])).toBe('Changed 18 Oct: The Team page shows the team')
    expect(changedLine(updates.slice(0, 2))).toBe('Changed in 2 updates you have not seen, the latest on 19 Oct: The panel reviews every draft (PR #41)')
    expect(changedLine([])).toBe('')
  })

  it('words the notice for one change and for several, with one full stop', () => {
    expect(noticeLine(updates.slice(0, 2))).toBe('2 changes you have not seen. Latest, 19 Oct: The panel reviews every draft.')
    expect(noticeLine([makeUpdate({ summary: 'Done.' })])).toBe('1 change you have not seen, 19 Oct: Done.')
    expect(noticeLine([])).toBe('')
  })

  it('writes the day, and says when it is not known', () => {
    expect(shortDay('2026-10-12T09:00:00.000Z')).toBe('12 Oct')
    expect(shortDay(null)).toBe('an unknown day')
    expect(shortDay('not a date')).toBe('an unknown day')
  })

  it('cuts a line at 80 code points with an ellipsis, and leaves a short one alone', () => {
    expect(cutLine('short')).toBe('short')
    expect(cutLine('x'.repeat(81))).toBe(`${'x'.repeat(80)}…`)
    expect(cutLine(`${'x'.repeat(79)}😀😀`)).toBe(`${'x'.repeat(79)}😀…`)
  })

  it('counts roles with an agent and commands for the tile, singular and plural', () => {
    expect(tileLine(manifest, 0)).toBe('2 roles · 1 command · last change 19 Oct')
    expect(tileLine(manifest, 3)).toBe('2 roles · 1 command · last change 19 Oct · 3 not seen')
    const sparse = makeTeamManifest({ history: { updates: [], older: 0, truncated: false }, sections: { roles: { unreadable: '.team/flow.md' }, commands: { unreadable: '.team/commands' } } })
    expect(tileLine(sparse, 0)).toBe('0 roles · 0 commands')
    const one = makeTeamManifest({ sections: { ...manifest.sections, roles: { file: null, items: [{ id: 'x', title: 'X', agent: 'x', owns: '', signsOff: '', description: '', headings: [], file: null }, { id: 'y', unreadable: '.team/agents/y.md' }] }, commands: { items: [] } } })
    expect(tileLine(one, 0)).toBe('1 role · 0 commands · last change 19 Oct')
    expect(roles(makeTeamManifest({ sections: {} }))).toEqual([])
  })
})

describe('links to GitHub', () => {
  it('builds commit, pull request and file links from the repository and validated parts', () => {
    expect(commitUrl(manifest, sha('3'))).toBe(`https://github.com/example/site/commit/${sha('3')}`)
    expect(pullUrl(manifest, 41)).toBe('https://github.com/example/site/pull/41')
    expect(fileUrl(manifest, '.team/agents/chief-editor.md')).toBe(`https://github.com/example/site/blob/${sha('c')}/.team/agents/chief-editor.md`)
  })

  it('encodes each part of a listed path', () => {
    const odd = makeTeamManifest({ files: ['.team/agents/$(touch pwned) #1.md'] })
    expect(fileUrl(odd, '.team/agents/$(touch pwned) #1.md')).toBe(`https://github.com/example/site/blob/${sha('c')}/.team/agents/%24(touch%20pwned)%20%231.md`)
  })

  it('gives no link for anything that does not validate', () => {
    expect(commitUrl(manifest, 'abc')).toBeNull()
    expect(commitUrl(manifest, sha('A'))).toBeNull()
    expect(pullUrl(manifest, null)).toBeNull()
    expect(pullUrl(manifest, 0)).toBeNull()
    expect(pullUrl(manifest, 1e7)).toBeNull()
    expect(pullUrl(manifest, 1.5)).toBeNull()
    expect(fileUrl(manifest, 'not/listed.md')).toBeNull()
    expect(fileUrl(manifest, null)).toBeNull()
    expect(fileUrl(makeTeamManifest({ commit: null }), '.team/flow.md')).toBeNull()
    const elsewhere = makeTeamManifest({ repo: 'javascript:alert(1)//github.com/a/b' })
    expect(commitUrl(elsewhere, sha('3'))).toBeNull()
    expect(pullUrl(elsewhere, 4)).toBeNull()
    expect(fileUrl(elsewhere, '.team/flow.md')).toBeNull()
  })
})
