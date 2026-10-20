// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { assignPhases, type Batch } from './phases'

let at = 0
const batch = (key: string, roles: string[], lead = false): Batch => ({ key, at: (at += 1000), roles, lead })
const phasesOf = (batches: Batch[]) => {
  const phases = assignPhases(batches)
  return batches.map((item) => { const phase = phases.get(item.key)!; return phase.round ? `${phase.kind} ${phase.round}` : phase.kind })
}
const six = ['senior-developer', 'security-engineer', 'senior-tester', 'ux-designer', 'senior-recruiter', 'product-manager']

describe('the phase of each batch of a feature', () => {
  it('follows a /feature run over two sessions: spec, spec, build, review 1, fix 1, review 2, fix 2, review 3, and the lead', () => {
    const batches = [
      batch('s1#0', ['lead'], true),
      batch('s1#1', ['product-manager', 'senior-recruiter', 'ux-designer']),
      // The developer's feasibility pass beside security and the tester is spec, not the build.
      batch('s1#2', ['security-engineer', 'senior-tester', 'senior-developer']),
      // /clear: a new session; its first lone developer is still the first build.
      batch('s2#1', ['senior-developer']),
      // The developer in the review batch is the code reviewer: review, not fix.
      batch('s2#2', six),
      batch('s2#3', ['senior-developer']),
      batch('s2#4', ['senior-tester', 'security-engineer']),
      batch('s2#5', ['senior-developer']),
      batch('s2#6', ['senior-tester']),
    ]
    expect(phasesOf(batches)).toEqual(['lead', 'spec', 'spec', 'build', 'review 1', 'fix 1', 'review 2', 'fix 2', 'review 3'])
  })

  it('orders batches by when they started, whatever order they arrive in, and the same time by key', () => {
    const late = { key: 'b', at: 5000, roles: ['senior-developer'], lead: false }
    const early = { key: 'a', at: 1000, roles: ['product-manager'], lead: false }
    const tie = { key: 'c', at: 5000, roles: ['senior-developer'], lead: false }
    const phases = assignPhases([tie, late, early])
    expect([phases.get('a'), phases.get('b'), phases.get('c')]).toEqual([{ kind: 'spec', round: 0 }, { kind: 'build', round: 0 }, { kind: 'build', round: 0 }])
  })

  it('starts review 1 for a /team-review of a branch built without /feature, then fixes and reviews', () => {
    expect(phasesOf([batch('t#1', six), batch('t#2', ['senior-developer']), batch('t#3', ['senior-tester'])])).toEqual(['review 1', 'fix 1', 'review 2'])
  })

  it('keeps a smaller batch straight after a review in that review, and a second lone developer in its fix', () => {
    expect(phasesOf([batch('r#1', six), batch('r#2', ['ux-designer']), batch('r#3', ['senior-developer']), batch('r#4', ['senior-developer'])])).toEqual(['review 1', 'review 1', 'fix 1', 'fix 1'])
  })

  it('gives a batch of built-in agents alone to the lead, and a built-in agent in a team batch that batch’s phase', () => {
    expect(phasesOf([batch('e#1', ['explore']), batch('e#2', ['general-purpose', 'unknown-agent']), batch('e#3', ['senior-developer', 'explore']), batch('e#4', [...six, 'explore'])])).toEqual(['lead', 'lead', 'build', 'review 1'])
  })

  it('is all the lead’s without subagents', () => {
    expect(phasesOf([batch('n#0', ['lead'], true)])).toEqual(['lead'])
    expect(assignPhases([]).size).toBe(0)
  })
})
