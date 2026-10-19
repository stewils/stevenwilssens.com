// The Team page's read state, worked out from the build-time manifest and the read ids in D1
// (GET /api/team). Pure, so it is tested on its own (team-state.test.ts) and shared by the
// page, the menu badge, Needs you and the Overview tile.
import { isUnreadable, type Role, type SectionId, type TeamManifest, type TeamReads, type TeamUpdate } from './team-types'

// An update is read when D1 says so; without a row, when it is older than the page's launch.
export const isRead = (update: TeamUpdate, reads: TeamReads) => (reads.read.includes(update.sha) ? true : reads.unread.includes(update.sha) ? false : update.beforeLaunch)

// The updates Steven has not seen, newest first. Nothing while the read state is not loaded
// (or failed), without a history, or when the launch is not in it.
export const unreadUpdates = (manifest: TeamManifest, reads: TeamReads | null): TeamUpdate[] => {
  if (!reads || !manifest.history || !manifest.launch) return []
  return manifest.history.updates.filter((update) => !isRead(update, reads))
}

export type Target = { section?: SectionId; role?: string; command?: string; step?: string }
export const touching = (updates: TeamUpdate[], target: Target) => updates.filter((update) =>
  (target.section === undefined || update.sections.includes(target.section))
  && (target.role === undefined || update.roles.includes(target.role))
  && (target.command === undefined || update.commands.includes(target.command))
  && (target.step === undefined || update.steps.includes(target.step)))

// "19 Oct", in Steven's own time zone.
export const shortDay = (iso: string | null) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'an unknown day')

// Cut on a code point, never inside an emoji.
export const cutLine = (text: string, max = 80) => {
  const points = Array.from(text)
  return points.length > max ? `${points.slice(0, max).join('')}…` : text
}

const prNote = (update: TeamUpdate) => (update.pr ? ` (PR #${update.pr})` : '')
// The line under a changed section's heading.
export const changedLine = (updates: TeamUpdate[]) => {
  const [latest] = updates
  if (!latest) return ''
  return updates.length === 1
    ? `Changed ${shortDay(latest.date)}: ${latest.summary}${prNote(latest)}`
    : `Changed in ${updates.length} updates you have not seen, the latest on ${shortDay(latest.date)}: ${latest.summary}${prNote(latest)}`
}

const withoutStop = (text: string) => text.replace(/[.!?]$/, '')
// The notice at the top of the page.
export const noticeLine = (updates: TeamUpdate[]) => {
  const [latest] = updates
  if (!latest) return ''
  return updates.length === 1
    ? `1 change you have not seen, ${shortDay(latest.date)}: ${withoutStop(latest.summary)}.`
    : `${updates.length} changes you have not seen. Latest, ${shortDay(latest.date)}: ${withoutStop(latest.summary)}.`
}

export const roles = (manifest: TeamManifest): Role[] => {
  const part = manifest.sections.roles
  return !part || isUnreadable(part) ? [] : part.items.filter((item): item is Role => !isUnreadable(item))
}

// The Overview tile: "6 roles · 2 commands · last change 19 Oct", plus " · 2 not seen".
export const tileLine = (manifest: TeamManifest, unread: number) => {
  const agents = roles(manifest).filter((role) => role.agent !== null).length
  const commandsPart = manifest.sections.commands
  const commands = !commandsPart || isUnreadable(commandsPart) ? 0 : commandsPart.items.length
  const latest = manifest.history?.updates[0]
  return [
    `${agents} ${agents === 1 ? 'role' : 'roles'}`,
    `${commands} ${commands === 1 ? 'command' : 'commands'}`,
    ...(latest ? [`last change ${shortDay(latest.date)}`] : []),
    ...(unread > 0 ? [`${unread} not seen`] : []),
  ].join(' · ')
}

// Links: the repository plus a validated part, or nothing.
const REPO = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/
const repoOf = (manifest: TeamManifest) => (REPO.test(manifest.repo) ? manifest.repo : null)
export const commitUrl = (manifest: TeamManifest, sha: string) => (repoOf(manifest) && /^[0-9a-f]{40}$/.test(sha) ? `${manifest.repo}/commit/${sha}` : null)
export const pullUrl = (manifest: TeamManifest, pr: number | null) => (repoOf(manifest) && pr !== null && Number.isSafeInteger(pr) && pr > 0 && pr < 1e7 ? `${manifest.repo}/pull/${pr}` : null)
export const fileUrl = (manifest: TeamManifest, path: string | null) => (repoOf(manifest) && path && manifest.commit && /^[0-9a-f]{40}$/.test(manifest.commit) && manifest.files.includes(path)
  ? `${manifest.repo}/blob/${manifest.commit}/${path.split('/').map(encodeURIComponent).join('/')}`
  : null)
