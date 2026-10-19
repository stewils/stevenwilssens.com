// Résumé proposals beyond the store: the key achievements as a proposal target, the
// check that tells whether an approved proposal is already live in the résumé data
// (so merged changes flip to "applied" without anyone naming them), and the brief a
// site update carries when it applies several proposals at once.
import { education, experiences, impact, profile, skills, type Impact } from '../../../src/resume'
import type { DossierStore, Proposal } from './store'

export const achievementsSection = 'achievements'
export type Achievement = { value: string; label: string; backing: string | null }

const roleKeysNow = experiences.map((item) => item.key)

// A key achievement in a proposal: JSON with the same shape as an entry of `impact` in src/resume.ts.
export const parseAchievement = (text: string, roleKeys = roleKeysNow): Achievement => {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error(`for "${achievementsSection}", the text must be JSON: {"value": "250%+", "label": "growth in monthly active spatial-audio devices", "backing": "spatial-audio-lead"}`) }
  const value = parsed as Record<string, unknown>
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('an achievement must be a JSON object with "value", "label" and "backing"')
  for (const key of ['value', 'label'] as const) if (typeof value[key] !== 'string' || !(value[key] as string).trim()) throw new Error(`an achievement needs a non-empty "${key}"`)
  const backing = typeof value.backing === 'string' && value.backing.trim() ? value.backing.trim() : null
  if (backing && !roleKeys.includes(backing)) throw new Error(`"backing" must be the key of the role whose bullets explain the number; one of: ${roleKeys.join(', ')}`)
  return { value: (value.value as string).trim(), label: (value.label as string).trim(), backing }
}
export const achievementOf = (item: Impact): Achievement => ({ value: item.value, label: item.label, backing: item.backing ?? null })
const sameAchievement = (a: Achievement, b: Achievement) => a.value === b.value && a.label === b.label

// The résumé data a proposal is checked against; the deployed src/resume.ts by default, anything in tests.
export type ResumeData = { experiences: typeof experiences; profile: { resumeHeadline: string; headline: string; summary: string }; skills: readonly string[]; education: typeof education; impact: Impact[] }
export const liveResume = (): ResumeData => ({ experiences, profile, skills, education, impact })

// Whitespace, curly quotes and long dashes do not make a different wording.
const norm = (text: string | null | undefined) => (text ?? '').replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()
const parseJson = (text: string | null) => { try { return text ? JSON.parse(text) as Record<string, unknown> : null } catch { return null } }
const sameRole = (a: Record<string, unknown> | null, b: Record<string, unknown> | null) => !!a && !!b && ['role', 'company', 'dates', 'location', 'summary'].every((key) => norm(a[key] as string) === norm(b[key] as string)) && JSON.stringify((a.points as string[] | undefined)?.map(norm)) === JSON.stringify((b.points as string[] | undefined)?.map(norm))

// True when what the proposal asked for is what the résumé says now. Conservative: an
// edit that was applied with different wording stays "approved" and is listed as such.
export const isApplied = (p: Proposal, resume: ResumeData = liveResume()): boolean => {
  const proposed = norm(p.proposedText), current = norm(p.currentText)
  const item = resume.experiences.find((entry) => entry.key === p.role)
  if (p.field === 'role') {
    // A whole role: removed when its key is gone, added or replaced when an entry matches the JSON.
    const wanted = parseJson(p.proposedText)
    if (p.kind === 'remove') return !item
    if (p.kind === 'add') return resume.experiences.some((entry) => sameRole({ ...entry } as unknown as Record<string, unknown>, wanted))
    return !!item && sameRole({ ...item } as unknown as Record<string, unknown>, wanted)
  }
  if (item) {
    const points = item.points.map(norm)
    const pointApplied = () => (p.kind === 'remove' ? !points.includes(current) : points.includes(proposed) && (p.kind === 'add' || !points.includes(current) || current === proposed))
    // Proposals from before the field column (field null) could change a bullet, the title or the summary alike.
    if (p.field === null) return pointApplied() || (p.kind === 'replace' && [item.role, item.summary].map(norm).includes(proposed))
    if (p.field === 'point') return pointApplied()
    const actual = p.field === 'title' ? item.role : p.field === 'company' ? item.company : p.field === 'dates' ? item.dates : p.field === 'location' ? item.location : item.summary
    return norm(actual) === proposed
  }
  switch (p.role) {
    case 'headline': return norm(resume.profile.resumeHeadline) === proposed || norm(resume.profile.headline) === proposed
    case 'summary': return norm(resume.profile.summary) === proposed
    case 'skills': {
      const list = resume.skills.map(norm)
      if (p.kind === 'remove') return !list.includes(current)
      return list.includes(proposed) || norm(resume.skills.join('\n')) === proposed
    }
    case 'education': {
      const text = norm(`${resume.education.degree}, ${resume.education.school} (${resume.education.dates})`)
      return text === proposed || norm(JSON.stringify(resume.education)) === proposed
    }
    case achievementsSection: {
      const live = resume.impact.map(achievementOf)
      const wanted = parseJson(p.proposedText), was = parseJson(p.currentText)
      if (p.kind === 'remove') return !!was && !live.some((entry) => sameAchievement(entry, was as unknown as Achievement))
      return !!wanted && live.some((entry) => sameAchievement(entry, wanted as unknown as Achievement) && (!wanted.backing || entry.backing === wanted.backing))
    }
    default: return false
  }
}

// Marks every approved proposal the résumé already carries as applied. Returns the ones it flipped.
export const syncProposals = async (store: DossierStore, now: number, resume: ResumeData = liveResume()) => {
  const approved = await store.listProposals('approved')
  const live = approved.filter((proposal) => isApplied(proposal, resume))
  if (!live.length) return []
  return store.applyProposals(live.map((proposal) => proposal.id), 'found live in the résumé data', now)
}

// Where a proposal lands, in words, for the brief and for Claude.
export const describeTarget = (p: Proposal) => {
  const item = experiences.find((entry) => entry.key === p.role)
  if (p.role === 'new-role') return 'a new role (append to the experiences in src/resume.ts in date order)'
  if (item) return `the role "${item.role}" at ${item.company} (key ${item.key}), ${p.field === 'point' || !p.field ? 'a bullet point' : p.field === 'role' ? 'the whole entry' : `its ${p.field}`}`
  if (p.role === achievementsSection) return 'the key achievements (impact in src/resume.ts; value, label and the backing role)'
  return `the ${p.role} section`
}

// The part of a site update's instruction that applies approved proposals: each one
// with its exact current and proposed text, so Claude Code changes nothing else.
export const briefFor = (proposals: Proposal[]) => {
  const lines = ['Apply these approved résumé proposals exactly as written, in src/resume.ts. They are tracked by id and marked applied when this pull request merges; change nothing beyond them unless the instruction above says so.']
  for (const p of proposals) {
    lines.push('', `Proposal #${p.id}: ${p.kind} in ${describeTarget(p)}.`)
    if (p.currentText) lines.push(`  Current text: ${p.currentText}`)
    if (p.proposedText) lines.push(`  ${p.kind === 'remove' ? 'Remove' : 'New text'}: ${p.proposedText}`)
    if (p.kind === 'remove' && !p.proposedText) lines.push('  Remove it.')
    lines.push(`  Why: ${p.rationale}`)
    if (p.decisionNote) lines.push(`  Steven's note when approving: ${p.decisionNote}`)
  }
  return lines.join('\n')
}
