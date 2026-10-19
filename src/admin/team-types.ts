// The Team page's data: the manifest scripts/team-manifest.mjs generates at build time from
// the orchestration files (served as `virtual:team-manifest`, admin bundle only), and the
// read state GET/POST /api/team keeps in D1 (functions/api/team.ts).

export type Unreadable = { unreadable: string }
export type SectionId = 'flow' | 'roles' | 'checks' | 'commands' | 'siteUpdate' | 'rules'

export type FlowStep = { n: number; id: string; title: string; who: string | null; text: string; people: string[]; checks: string[] }
export type DiagramEdge = { to: string; label: string | null }
export type DiagramNode = {
  id: string
  label: string
  shape: 'start' | 'box' | 'decision' | 'group'
  members: { label: string; via: string | null }[]
  steps: number[]
  lane: 'you' | 'team'
  gate: boolean
  next: DiagramEdge[]
  loop: DiagramEdge | null
}
export type Flow = { file: string; steps: FlowStep[]; diagram: { nodes: DiagramNode[] } | null }

export type Role = { id: string; title: string; agent: string | null; owns: string; signsOff: string; description: string; headings: string[]; file: string | null }
export type Command = { id: string; name: string; description: string; hint: string; file: string }
export type Job = { key: string; name: string | null; needs: string[]; steps: string[] }
export type Checks = { file: string; jobs: Job[]; levels: { level: string; meaning: string }[]; scripts: string[]; protection: string | null }
export type SiteUpdate = { file: string; steps: { name: string; lines: string[]; tools: string[] }[] }
// The team's section of CLAUDE.md, as paragraphs of text.
export type Rules = { file: string; heading: string; paragraphs: string[] }

export type TeamUpdate = {
  sha: string
  date: string | null
  summary: string
  pr: number | null
  sections: SectionId[]
  roles: string[]
  commands: string[]
  steps: string[]
  removedSteps: string[]
  beforeLaunch: boolean
}

export type TeamManifest = {
  schema: string
  repo: string
  commit: string | null
  generatedAt: string
  launch: string | null
  files: string[]
  flow: Flow | Unreadable | null
  sections: {
    roles?: { file: string | null; items: (Role | ({ id: string } & Unreadable))[] } | Unreadable
    checks?: Checks | Unreadable
    commands?: { items: (Command | ({ id: string } & Unreadable))[] } | Unreadable
    siteUpdate?: SiteUpdate | Unreadable
    rules?: Rules | Unreadable
  }
  history: { updates: TeamUpdate[]; older: number; truncated: boolean } | null
  problems: { path: string; error: string; message: string }[]
}

// Rows of team_reads: update ids (commit SHAs) marked read, and marked unread.
export type TeamReads = { read: string[]; unread: string[] }

export const isUnreadable = (part: unknown): part is Unreadable => Boolean(part) && typeof (part as Unreadable).unreadable === 'string'
