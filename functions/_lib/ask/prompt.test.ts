// @vitest-environment node
// The two versions an answer is logged with (specs/ask-ratings.md, AC-4): the instruction
// version moves only with what is changed on purpose, the knowledge version with the facts.
import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../mcp/store'
import { REQUEST, words } from './agent'
import { instructionVersion, jdPrefix, knowledgeVersion, rules, shortHash } from './prompt'

const fixed = { offTopic: words.offTopic, notAPosting: words.notAPosting }
const base = () => instructionVersion(REQUEST, fixed)

describe('the versions of the assistant', () => {
  it('a short hash is 8 hex characters and stable', async () => {
    expect(await shortHash('x')).toMatch(/^[0-9a-f]{8}$/)
    expect(await shortHash('x')).toBe(await shortHash('x'))
    expect(await shortHash('x')).not.toBe(await shortHash('y'))
  })

  it('the instruction version stays the same when the dossier, the résumé or the write-ups change; the knowledge version does not', async () => {
    const dossier = new MemoryStore()
    await dossier.insert({ role: 'csx-data', topic: 'scope', title: 'Nine PMs', body: 'Steven led nine product managers.', visibility: 'public', tags: null }, 1)
    const entries = await dossier.list({ visibility: 'public' })
    const before = await knowledgeVersion([], {})
    expect(await knowledgeVersion(entries, {})).not.toBe(before)
    expect(await knowledgeVersion([], { 'site:building': 'A changed write-up.' })).not.toBe(before)
    expect(await knowledgeVersion([], {})).toBe(before)
    // The instruction version takes none of them as input, so none of them can move it.
    expect(await base()).toBe(await instructionVersion({ ...REQUEST }, { ...fixed }, { rules, jdPrefix }))
  })

  it('a private dossier entry changes neither version', async () => {
    const dossier = new MemoryStore()
    const before = await knowledgeVersion(await dossier.list({ visibility: 'public' }), {})
    await dossier.insert({ role: 'csx-data', topic: 'scope', title: 'Secret', body: 'Internal numbers.', visibility: 'private', tags: null }, 1)
    expect(await knowledgeVersion(await dossier.list({ visibility: 'public' }), {})).toBe(before)
    expect(await base()).toBe(await instructionVersion(REQUEST, fixed))
  })

  it.each([
    ['rules', () => instructionVersion(REQUEST, fixed, { rules: `${rules} Be brief.`, jdPrefix })],
    ['jdPrefix', () => instructionVersion(REQUEST, fixed, { rules, jdPrefix: 'Job posting:' })],
    ['words.offTopic', () => instructionVersion(REQUEST, { ...fixed, offTopic: 'Only Steven.' })],
    ['words.notAPosting', () => instructionVersion(REQUEST, { ...fixed, notAPosting: 'Not a posting.' })],
    ['max tokens', () => instructionVersion({ ...REQUEST, maxTokens: 1600 }, fixed)],
    ['effort', () => instructionVersion({ ...REQUEST, effort: 'medium' }, fixed)],
    ['thinking', () => instructionVersion({ ...REQUEST, thinking: 'disabled' }, fixed)],
    ['fallbacks', () => instructionVersion({ ...REQUEST, fallbacks: 'none' }, fixed)],
    ['source caps', () => instructionVersion({ ...REQUEST, maxSources: 4 }, fixed)],
  ])('changes when %s changes', async (_, changed) => {
    expect(await changed()).not.toBe(await base())
  })
})
