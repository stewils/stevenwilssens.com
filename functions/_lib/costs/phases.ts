// Which phase of a feature each batch of agents belongs to (specs/dev-costs.md AC-18):
// worked out when the costs are read, per feature, over the batches of all its local
// sessions in the order they were started (a feature often spans several sessions: /clear
// starts a new one). A batch is the agents the lead started in one message.
//
// A team batch has at least one of the six team roles; a batch of built-in agents only is
// the lead's. A review batch has four or more distinct team roles. Before the build, a
// review batch starts review 1 (a /team-review of a branch built without /feature) and any
// other team batch is the spec (with the developer's feasibility pass beside security and
// the tester). The first lone senior-developer batch is the build. After the build or a
// review, a lone developer is fix N after review N; any other team batch starts review N+1
// after the build or a fix, and joins review N straight after review N (a re-review by one
// or two reviewers after a fix is the next round). Every batch gets exactly one phase.

export type PhaseKind = 'spec' | 'build' | 'review' | 'fix' | 'lead'
export type Phase = { kind: PhaseKind; round: number }
export type Batch = { key: string; at: number; roles: string[]; lead: boolean }

export const TEAM_ROLES = ['product-manager', 'senior-recruiter', 'ux-designer', 'senior-developer', 'security-engineer', 'senior-tester']
const DEVELOPER = 'senior-developer'
const REVIEW_FROM = 4

export const assignPhases = (batches: Batch[]): Map<string, Phase> => {
  const phases = new Map<string, Phase>()
  const ordered = [...batches].sort((a, b) => a.at - b.at || a.key.localeCompare(b.key))
  let built = false
  let review = 0
  let last: PhaseKind | null = null
  for (const batch of ordered) {
    const team = new Set(batch.roles.filter((role) => TEAM_ROLES.includes(role)))
    if (batch.lead || team.size === 0) { phases.set(batch.key, { kind: 'lead', round: 0 }); continue }
    const loneDeveloper = team.size === 1 && team.has(DEVELOPER)
    let phase: Phase
    if (!built && review === 0) {
      if (team.size >= REVIEW_FROM) { review = 1; phase = { kind: 'review', round: 1 } }
      else if (loneDeveloper) { built = true; phase = { kind: 'build', round: 0 } }
      else phase = { kind: 'spec', round: 0 }
    } else if (loneDeveloper) {
      // A second lone developer run before any review is more of the build.
      phase = review === 0 ? { kind: 'build', round: 0 } : { kind: 'fix', round: review }
    } else if (last === 'review') phase = { kind: 'review', round: review }
    else { review += 1; phase = { kind: 'review', round: review } }
    last = phase.kind
    phases.set(batch.key, phase)
  }
  return phases
}
