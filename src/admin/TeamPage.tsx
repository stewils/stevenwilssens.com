import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FlowDiagram } from './FlowDiagram'
import { formatTime } from './format'
import { Shimmer } from './Skeleton'
import { changedLine, commitUrl, fileUrl, noticeLine, pullUrl, roles as rolesOf, shortDay, touching, unreadUpdates, type Target } from './team-state'
import { isUnreadable, type SectionId, type TeamManifest, type TeamReads, type TeamUpdate } from './team-types'

// The agent team that builds the site, read from the repository at each build (the
// manifest), and every change to it, like mail: what Steven has not seen is marked New here,
// in the menu and in Needs you, until this page has been in front of him for 5 seconds
// (visible time only; leaving the page starts over). Then it is recorded as seen on the
// server, with Undo; each change in the history can be marked unread again. The markers
// stay for the rest of the visit: they come from what was unread when the visit started.
//
// Everything about the team is manifest text, shown as React text only; links are the
// repository plus a validated commit, pull request or listed file (team-state.ts).

export type TeamAction = 'read' | 'unread' | 'readAll'
type Props = { manifest: TeamManifest; reads: TeamReads | null; readsError: string; onPost: (action: TeamAction, ids: string[]) => Promise<boolean> }

export const SEEN_AFTER_MS = 5000
const SHOWN = 5
const sectionLabel: Record<SectionId, string> = { flow: 'Flow', roles: 'Roles', checks: 'Gates', commands: 'Commands', siteUpdate: 'Site update', rules: 'Rules' }
const headingId = (section: SectionId | 'changes') => `team-h-${section}`

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const goTo = (section: SectionId | 'changes') => {
  const heading = document.getElementById(headingId(section))
  heading?.closest('section')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
  heading?.focus({ preventScroll: true })
}

function ExtLink({ href, children }: { href: string | null; children: ReactNode }) {
  return href ? <a className="team-link" href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span className="team-link">{children}</span>
}

const Unreadable = ({ path }: { path: string }) => <p className="empty">This part could not be read from {path} at build time; it is back after the next build.</p>

// One card of the page; marked New while an update Steven has not seen touched it.
function Part({ id, part, title, changed = [], flag = false, head, children }: { id: SectionId | 'changes'; part: string; title: string; changed?: TeamUpdate[]; flag?: boolean; head?: ReactNode; children: ReactNode }) {
  const isNew = changed.length > 0
  const marked = isNew || flag
  return (
    <section className={`card team-part${marked ? ' is-new' : ''}`} data-part={part} data-new={marked ? '' : undefined} aria-labelledby={headingId(id)} aria-describedby={isNew ? `team-changed-${id}` : undefined}>
      <div className="card-head">
        <h2 id={headingId(id)} tabIndex={-1}>{title}{isNew && <> <span className="badge new">New</span></>}</h2>
        {head}
      </div>
      {isNew && <p className="team-changed" id={`team-changed-${id}`}>{changedLine(changed)}</p>}
      {children}
    </section>
  )
}

type Seen = 'waiting' | 'marked' | 'failed' | 'undone' | 'undo-failed'

// Counts the time the page is visible; at 5 seconds, calls back once.
function useSeenTimer(active: boolean, onSeen: () => void) {
  const callback = useRef(onSeen)
  useEffect(() => { callback.current = onSeen })
  useEffect(() => {
    if (!active) return
    let elapsed = 0
    let startedAt = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let done = false
    const start = () => {
      if (done || timer !== undefined) return
      startedAt = Date.now()
      timer = setTimeout(() => { timer = undefined; done = true; callback.current() }, Math.max(0, SEEN_AFTER_MS - elapsed))
    }
    const pause = () => {
      if (timer === undefined) return
      clearTimeout(timer)
      timer = undefined
      elapsed += Date.now() - startedAt
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : pause())
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility); if (timer !== undefined) clearTimeout(timer) }
  }, [active])
}

export function TeamPage({ manifest, reads, readsError, onPost }: Props) {
  // What was unread when this visit's read state arrived: the markers of this visit.
  const [visit, setVisit] = useState<TeamUpdate[] | null>(() => (reads ? unreadUpdates(manifest, reads) : null))
  if (visit === null && reads) setVisit(unreadUpdates(manifest, reads))
  const unread = visit ?? []
  const ids = unread.map((update) => update.sha)
  const [seen, setSeen] = useState<Seen>('waiting')
  const [rowState, setRowState] = useState<Record<string, 'unread' | 'failed'>>({})
  const [showAll, setShowAll] = useState(false)

  useSeenTimer(visit !== null && ids.length > 0 && seen === 'waiting', () => {
    void onPost('readAll', ids).then((ok) => setSeen(ok ? 'marked' : 'failed'))
  })
  const undo = () => { void onPost('unread', ids).then((ok) => setSeen(ok ? 'undone' : 'undo-failed')) }
  const markUnread = (sha: string) => { void onPost('unread', [sha]).then((ok) => setRowState((state) => ({ ...state, [sha]: ok ? 'unread' : 'failed' }))) }

  const isUnread = (update: TeamUpdate) => ids.includes(update.sha)
  const changedFor = (target: Target) => touching(unread, target)
  const flow = manifest.flow
  const { roles, checks, commands, siteUpdate, rules } = manifest.sections
  const roleTitle = (id: string) => rolesOf(manifest).find((role) => role.id === id)?.title ?? id
  const commandName = (id: string) => (commands && !isUnreadable(commands) ? commands.items.find((item) => item.id === id && !isUnreadable(item)) as { name: string } | undefined : undefined)?.name ?? id
  const stepTitle = (id: string) => (flow && !isUnreadable(flow) ? flow.steps.find((step) => step.id === id)?.title : undefined) ?? id
  const changedSteps = new Set(unread.flatMap((update) => update.steps))
  const history = manifest.history
  const updates = history?.updates ?? []
  const shown = showAll ? updates : updates.slice(0, SHOWN)

  // The status, then the Undo button in a fixed place, so focus stays on it when it is used.
  const status = reads === null && !readsError
    ? <Shimmer className="team-shimmer" />
    : readsError
      ? <span className="team-muted">Seen state unavailable</span>
      : seen === 'marked'
        ? <span>Marked as seen</span>
        : seen === 'undo-failed'
          ? <span>Could not mark them as unread; they stay seen.</span>
          : ids.length > 0
            ? <span className="badge new">{ids.length} not seen</span>
            : <span className="team-muted">All seen</span>
  const head = (
    <>
      {status}
      {(seen === 'marked' || seen === 'undo-failed' || seen === 'undone') && (
        <button type="button" className="ghost" aria-disabled={seen === 'undone' ? 'true' : undefined} onClick={seen === 'undone' ? undefined : undo}>{seen === 'undone' ? 'Undone' : 'Undo'}</button>
      )}
    </>
  )

  const chips = (update: TeamUpdate) => {
    const list: { key: string; label: string; section: SectionId }[] = []
    for (const section of update.sections) {
      if (section === 'roles' && update.roles.length) update.roles.forEach((role) => list.push({ key: `role-${role}`, label: `Roles: ${roleTitle(role)}`, section }))
      else if (section === 'commands' && update.commands.length) update.commands.forEach((command) => list.push({ key: `command-${command}`, label: `Commands: /${commandName(command)}`, section }))
      else if (section === 'flow' && update.steps.length > 3) list.push({ key: 'flow', label: `Flow: ${update.steps.length} steps`, section })
      else if (section === 'flow' && update.steps.length) update.steps.forEach((step) => list.push({ key: `step-${step}`, label: `Flow: ${stepTitle(step)}`, section }))
      else list.push({ key: section, label: sectionLabel[section] ?? 'Team', section })
    }
    return list
  }

  return (
    <>
      {unread.length > 0 && (
        <p className="team-notice">
          <span className="badge new">New</span>
          <span>{noticeLine(unread)}</span>
          <button type="button" className="team-jump" onClick={() => goTo('changes')}>See what changed ↓</button>
        </p>
      )}

      <Part id="flow" part="Flow" title="How a change gets to main" changed={changedFor({ section: 'flow' })}>
        {!flow || isUnreadable(flow)
          ? <p className="empty">Could not read the flow from {flow ? flow.unreadable : 'the team file'} at build time; the diagram is back after the next build.</p>
          : <>
            <FlowDiagram flow={flow} changed={changedSteps} labelledBy={headingId('flow')} />
            <details className="team-words">
              <summary>The steps in words</summary>
              <ol>
                {flow.steps.map((step) => <li key={step.n} value={step.n}><strong>{step.title}</strong>{step.who && ` (${step.who})`}{step.text && `. ${step.text}`}</li>)}
              </ol>
            </details>
            <p className="team-open"><ExtLink href={fileUrl(manifest, flow.file)}>Open the flow ↗</ExtLink></p>
          </>}
      </Part>

      <Part id="changes" part="What changed" title="What changed" flag={unread.length > 0} head={<span className="team-head" aria-live="polite">{head}</span>}>
        <p className="note">Every change to the agents, the team flow, the commands, the Review workflow, the gates, the Site update team step or the team's rules, newest first. A change counts as seen once this page has been in front of you for 5 seconds, on any device.</p>
        {seen === 'failed' && <p className="team-muted team-retry">Could not record that you have seen this; it will be tried again on your next visit.</p>}
        {!history
          ? <p className="empty">The history of changes is not in this build.</p>
          : !updates.length
            ? <p className="empty">No changes recorded yet. Every change to the agents, the team flow, the commands, the Review workflow, the gates, the Site update team step or the team's rules will show up here.</p>
            : <>
              <ol className="team-updates">
                {shown.map((update) => {
                  const fresh = isUnread(update)
                  const time = update.date ? Date.parse(update.date) : NaN
                  const row = rowState[update.sha]
                  return (
                    <li key={update.sha} className={`team-update${fresh ? ' unread' : ''}`}>
                      <div className="team-update-meta">
                        {fresh && <span className="team-dot" aria-hidden="true" />}
                        <span className="team-date" title={Number.isNaN(time) ? undefined : formatTime(time)}>{shortDay(update.date)}</span>
                        {fresh && <><span className="visually-hidden">Not seen: </span><span className="badge new">New</span></>}
                      </div>
                      <p className="team-summary">{fresh ? <strong>{update.summary}</strong> : update.summary}</p>
                      <div className="team-chips">
                        <span className="team-muted">Changed:</span>
                        {chips(update).map((chip) => <button type="button" key={chip.key} className="team-chip" onClick={() => goTo(chip.section)}>{chip.label}</button>)}
                        {update.removedSteps.map((title) => <span key={`removed-${title}`} className="team-chip removed">Removed: {title}</span>)}
                      </div>
                      <div className="team-row-tools">
                        {update.pr !== null && pullUrl(manifest, update.pr)
                          ? <ExtLink href={pullUrl(manifest, update.pr)}>PR #{update.pr} ↗</ExtLink>
                          : <ExtLink href={commitUrl(manifest, update.sha)}>{update.sha.slice(0, 7)} ↗</ExtLink>}
                        {!fresh && reads && (
                          row === 'unread'
                            ? <button type="button" className="ghost" aria-disabled="true">Marked as unread</button>
                            : <button type="button" className="ghost" onClick={() => markUnread(update.sha)}>Mark as unread</button>
                        )}
                        {row === 'failed' && <span className="team-muted">Not saved; try again.</span>}
                      </div>
                    </li>
                  )
                })}
              </ol>
              {updates.length > SHOWN && <button type="button" className="ghost team-more" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Show fewer' : `Show all ${updates.length} changes`}</button>}
              {history.older > 0 && <p className="note team-older">{history.older} older {history.older === 1 ? 'change is' : 'changes are'} not listed{history.truncated ? ', to keep this page small' : ''}.</p>}
            </>}
      </Part>

      <Part id="roles" part="Roles" title="The roles" changed={changedFor({ section: 'roles' })}>
        {!roles || isUnreadable(roles) ? <Unreadable path={roles ? roles.unreadable : 'the team file'} /> : <>
          <p className="note">One agent per role, from .claude/agents and the table in .claude/team.md. The lead is the session or the CI job that runs the flow.</p>
          <div className="grid team-cards">
            {roles.items.map((role) => {
              if (isUnreadable(role)) return <article key={role.id} className="team-card"><Unreadable path={role.unreadable} /></article>
              const isNew = changedFor({ role: role.id }).length > 0
              return (
                <article key={role.id} className={`team-card${isNew ? ' is-new' : ''}`} data-new={isNew ? '' : undefined}>
                  <h3>{role.title}{isNew && <> <span className="badge new">New</span></>}</h3>
                  {role.agent && <code className="team-mono">{role.agent}</code>}
                  {role.owns && <p className="team-field"><span>Owns:</span> {role.owns}</p>}
                  {role.signsOff && <p className="team-field"><span>Signs off on:</span> {role.signsOff}</p>}
                  {role.description && <Description text={role.description} />}
                  {role.file && <p className="team-open"><ExtLink href={fileUrl(manifest, role.file)}>Open the brief ↗</ExtLink></p>}
                </article>
              )
            })}
          </div>
        </>}
      </Part>

      <Part id="checks" part="Gates" title="What must pass before a merge" changed={changedFor({ section: 'checks' })}>
        {!checks || isUnreadable(checks) ? <Unreadable path={checks ? checks.unreadable : 'the Review workflow'} /> : <>
          <p className="note">From the Review workflow and the team's rules.{checks.protection && ` ${checks.protection}`}</p>
          <ul className="team-jobs">
            {checks.jobs.map((job) => (
              <li key={job.key}>
                <p><code className="team-mono">{job.key}</code>{job.name && ` ${job.name}`}{job.needs.length > 0 && <span className="team-muted"> after {job.needs.join(', ')}</span>}</p>
                {job.steps.length > 0 && <ol>{job.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>}
              </li>
            ))}
          </ul>
          {checks.levels.length > 0 && <>
            <h3>Findings:</h3>
            <ul className="team-levels">{checks.levels.map((level) => <li key={level.level}><span className="badge">{level.level}</span> {level.meaning}</li>)}</ul>
          </>}
          {checks.scripts.length > 0 && <>
            <h3>The checkers</h3>
            <ul className="team-scripts">{checks.scripts.map((path) => <li key={path}><ExtLink href={fileUrl(manifest, path)}><code className="team-mono">{path}</code> ↗</ExtLink></li>)}</ul>
          </>}
          <p className="team-open"><ExtLink href={fileUrl(manifest, checks.file)}>Open the workflow ↗</ExtLink></p>
        </>}
      </Part>

      <Part id="commands" part="Commands" title="Commands" changed={changedFor({ section: 'commands' })}>
        {!commands || isUnreadable(commands) ? <Unreadable path={commands ? commands.unreadable : 'the commands'} /> : (
          <div className="grid team-cards">
            {commands.items.map((command) => isUnreadable(command)
              ? <article key={command.id} className="team-card"><Unreadable path={command.unreadable} /></article>
              : (
                <article key={command.id} className="team-card">
                  <code className="team-mono">/{command.name}{command.hint && ` ${command.hint}`}</code>
                  <Description text={command.description} />
                  <p className="team-open"><ExtLink href={fileUrl(manifest, command.file)}>Open the command ↗</ExtLink></p>
                </article>
              ))}
          </div>
        )}
      </Part>

      <Part id="siteUpdate" part="Site update" title="When the MCP or a refresh asks" changed={changedFor({ section: 'siteUpdate' })}>
        {!siteUpdate || isUnreadable(siteUpdate) ? <Unreadable path={siteUpdate ? siteUpdate.unreadable : 'the Site update workflow'} /> : <>
          <p className="note">The step of the Site update workflow where the team writes the spec and builds, on GitHub. Only a change to this step counts as a change to your team.</p>
          {siteUpdate.steps.map((step) => (
            <div key={step.name} className="team-site-step">
              <code className="team-mono">{step.name}</code>
              {step.lines.length > 0 && <ol>{step.lines.map((line, index) => <li key={index}>{line}</li>)}</ol>}
              {step.tools.length > 0 && <p className="team-tools"><span className="team-muted">Allowed tools:</span> {step.tools.map((tool, index) => <span key={index} className="badge">{tool}</span>)}</p>}
            </div>
          ))}
          <p className="team-open"><ExtLink href={fileUrl(manifest, siteUpdate.file)}>Open the workflow ↗</ExtLink></p>
        </>}
      </Part>

      {rules && (
        <Part id="rules" part="Rules" title="The team's rules" changed={changedFor({ section: 'rules' })}>
          {isUnreadable(rules) ? <Unreadable path={rules.unreadable} /> : <>
            <p className="note">The section “{rules.heading}” of {rules.file}, which every agent works by. Only a change to this section counts as a change to your team.</p>
            <details className="team-words">
              <summary>The rules in words</summary>
              {rules.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </details>
            <p className="team-open"><ExtLink href={fileUrl(manifest, rules.file)}>Open {rules.file} ↗</ExtLink></p>
          </>}
        </Part>
      )}
    </>
  )
}

// A description clamped to four lines, with Read more past that.
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 240
  return (
    <>
      <p className={`team-desc${long && !open ? ' clamped' : ''}`}>{text}</p>
      {long && <button type="button" className="team-more-text" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'Read less' : 'Read more'}</button>}
    </>
  )
}
