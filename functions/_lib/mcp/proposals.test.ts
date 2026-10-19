import { describe, expect, it } from 'vitest'
import type { Proposal } from './store'
import { briefFor, isApplied, parseAchievement, type ResumeData } from './proposals'

const resume: ResumeData = {
  experiences: [
    { key: 'group-pm', role: 'Group PM', company: 'Microsoft', dates: 'Dec 2024 - Sep 2026', location: 'Redmond', summary: 'Led the data org.', points: ['Led 12 PMs.', 'Owned the budget.'] },
    { key: 'founder', role: 'Founder', company: 'wilssens.com', dates: 'Oct 2026 - Present', location: 'Seattle', summary: 'Building.', points: ['Shipped it.'] },
  ],
  profile: { resumeHeadline: 'Product leader', headline: 'Product leader who builds', summary: 'Twenty years.' },
  skills: ['Experimentation', 'Data platforms'],
  education: { degree: 'BSc', school: 'KdG', dates: '2000 - 2004' },
  impact: [{ value: '250%+', label: 'growth', backing: 'group-pm' }],
}
let next = 1
const proposal = (p: Partial<Proposal>): Proposal => ({ id: next++, createdAt: 0, updatedAt: 0, role: 'group-pm', field: 'point', kind: 'replace', currentText: null, proposedText: null, rationale: 'why', basedOn: null, status: 'approved', decisionNote: null, ...p })

describe('isApplied', () => {
  it('sees a bullet, a field, a section and an achievement that the résumé now carries', () => {
    expect(isApplied(proposal({ currentText: 'Led a dozen PMs.', proposedText: 'Led 12 PMs.' }), resume)).toBe(true)
    expect(isApplied(proposal({ currentText: 'Led 12 PMs.', proposedText: 'Led 13 PMs.' }), resume)).toBe(false)
    expect(isApplied(proposal({ kind: 'add', proposedText: '  Owned   the budget. ' }), resume)).toBe(true)
    expect(isApplied(proposal({ kind: 'remove', currentText: 'Ran the review.' }), resume)).toBe(true)
    expect(isApplied(proposal({ kind: 'remove', currentText: 'Owned the budget.' }), resume)).toBe(false)
    // Curly quotes and dashes on the site, straight ones in the proposal: the same wording.
    expect(isApplied(proposal({ currentText: 'x', proposedText: 'Steven\'s "data" team – 2024' }), { ...resume, experiences: [{ ...resume.experiences[0], points: ['Steven’s “data” team - 2024'] }] })).toBe(true)
    // Proposals from before the field column: a title or summary change with field null still counts.
    expect(isApplied(proposal({ field: null, currentText: 'PM', proposedText: 'Group PM' }), resume)).toBe(true)
    expect(isApplied(proposal({ field: null, currentText: 'x', proposedText: 'Led the data org.' }), resume)).toBe(true)
    expect(isApplied(proposal({ field: null, currentText: 'x', proposedText: 'Led 12 PMs.' }), resume)).toBe(true)
    expect(isApplied(proposal({ field: null, kind: 'add', proposedText: 'Group PM' }), resume)).toBe(false)
    expect(isApplied(proposal({ field: 'dates', currentText: 'x', proposedText: 'Dec 2024 - Sep 2026' }), resume)).toBe(true)
    expect(isApplied(proposal({ field: 'title', currentText: 'x', proposedText: 'Principal Group PM' }), resume)).toBe(false)
    expect(isApplied(proposal({ role: 'headline', field: null, proposedText: 'Product leader who builds' }), resume)).toBe(true)
    expect(isApplied(proposal({ role: 'summary', field: null, proposedText: 'Twenty years.' }), resume)).toBe(true)
    expect(isApplied(proposal({ role: 'skills', field: null, kind: 'add', proposedText: 'Data platforms' }), resume)).toBe(true)
    expect(isApplied(proposal({ role: 'skills', field: null, kind: 'remove', currentText: 'Experimentation' }), resume)).toBe(false)
    expect(isApplied(proposal({ role: 'education', field: null, proposedText: 'BSc, KdG (2000 - 2004)' }), resume)).toBe(true)
    expect(isApplied(proposal({ role: 'achievements', field: null, proposedText: JSON.stringify({ value: '250%+', label: 'growth', backing: 'group-pm' }) }), resume)).toBe(true)
    expect(isApplied(proposal({ role: 'achievements', field: null, proposedText: JSON.stringify({ value: '250%+', label: 'growth', backing: 'founder' }) }), resume)).toBe(false)
    expect(isApplied(proposal({ role: 'achievements', field: null, kind: 'remove', currentText: JSON.stringify({ value: '15%', label: 'adoption' }) }), resume)).toBe(true)
    expect(isApplied(proposal({ role: 'achievements', field: null, kind: 'remove', currentText: 'not json' }), resume)).toBe(false)
  })

  it('sees whole roles added, replaced and removed', () => {
    const founder = { role: 'Founder', company: 'wilssens.com', dates: 'Oct 2026 - Present', location: 'Seattle', summary: 'Building.', points: ['Shipped it.'] }
    expect(isApplied(proposal({ role: 'new-role', field: 'role', kind: 'add', proposedText: JSON.stringify(founder) }), resume)).toBe(true)
    expect(isApplied(proposal({ role: 'new-role', field: 'role', kind: 'add', proposedText: JSON.stringify({ ...founder, points: ['Shipped it.', 'And more.'] }) }), resume)).toBe(false)
    expect(isApplied(proposal({ role: 'founder', field: 'role', kind: 'replace', proposedText: JSON.stringify(founder) }), resume)).toBe(true)
    expect(isApplied(proposal({ role: 'cosmos', field: 'role', kind: 'remove', currentText: '{}' }), resume)).toBe(true)
    expect(isApplied(proposal({ role: 'founder', field: 'role', kind: 'remove', currentText: '{}' }), resume)).toBe(false)
    expect(isApplied(proposal({ role: 'cosmos', currentText: 'x', proposedText: 'y' }), resume)).toBe(false)
  })
})

describe('parseAchievement', () => {
  it('reads value, label and backing and refuses what is not one', () => {
    expect(parseAchievement('{"value": " 30% ", "label": "lower cost", "backing": "group-pm"}', ['group-pm'])).toEqual({ value: '30%', label: 'lower cost', backing: 'group-pm' })
    expect(parseAchievement('{"value": "30%", "label": "lower cost"}', ['group-pm']).backing).toBeNull()
    expect(() => parseAchievement('nope', [])).toThrow(/must be JSON/)
    expect(() => parseAchievement('[]', [])).toThrow(/JSON object/)
    expect(() => parseAchievement('{"value": "30%"}', [])).toThrow(/needs a non-empty "label"/)
    expect(() => parseAchievement('{"value": "30%", "label": "x", "backing": "ceo"}', ['group-pm'])).toThrow(/one of: group-pm/)
  })
})

describe('briefFor', () => {
  it('writes each proposal with its exact texts and the note Steven left', () => {
    const brief = briefFor([
      proposal({ id: 12, currentText: 'Led a dozen PMs.', proposedText: 'Led 12 PMs.', decisionNote: 'Keep the number.' }),
      proposal({ id: 13, role: 'skills', field: null, kind: 'remove', currentText: 'Buzzword' }),
    ])
    expect(brief).toContain('Apply these approved résumé proposals exactly as written')
    expect(brief).toContain('Proposal #12: replace in')
    expect(brief).toContain('  Current text: Led a dozen PMs.\n  New text: Led 12 PMs.\n  Why: why\n  Steven\'s note when approving: Keep the number.')
    expect(brief).toContain('Proposal #13: remove in the skills section.\n  Current text: Buzzword\n  Remove it.')
  })
})
