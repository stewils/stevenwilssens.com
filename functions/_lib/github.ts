// The MCP server's hands on the repository: it starts the "Site update" workflow
// (.github/workflows/site-update.yml), where Claude Code edits the site and the
// resume on a branch and opens a pull request, and it reads runs and pull requests
// back, merges them, closes them and waits for them. Needs a GitHub token (GITHUB_TOKEN
// secret) with Actions: write, Contents: write (to delete a closed pull request's branch and
// to send a write-up refresh again; read is enough for everything else), Pull requests: write
// and Checks: read (the reason a run made no change, from its annotations; without it the MCP
// points to the run instead). It acts as Steven: closing and reopening a pull request (recheck)
// starts its checks as him.
import sources from '../../src/articles/sources.json'

// branch is GitHub's head_branch: the branch the workflow ran from, `main` for every run the
// MCP dispatches. number is the run number, which the workflow puts at the end of the branch
// it pushes (update/<slug>-<number>); that is how a run's pull request is found.
// event is what started it: workflow_dispatch (a request) or repository_dispatch (a Building refresh).
export type WorkflowRun = { id: number; number: number | null; event: string | null; status: string; conclusion: string | null; createdAt: string; url: string; branch: string; title: string }
// Where a failed run stopped, from the jobs API (never from log text): the first failed step
// of the update job, whether it is the no-change step, and that step's reason (its error
// annotation without the fixed sentence; null when it is not there or cannot be read), and
// whether GitHub refused the annotations (403: the token lacks Checks: read).
export type RunFailure = { step: string; noChange: boolean; reason: string | null; refused?: boolean; job?: string }
// The Site update workflow's step that fails a run Claude made no change in
// (scripts/site-update-outcome.mjs), and the sentence its error annotation starts with.
// Keep both in step with .github/workflows/site-update.yml (github.test.ts reads it).
export const noChangeStep = 'Stop when no change was made'
export const noChangeSentence = 'Claude made no change to the site for this request.'
export const updateJob = 'update'
// The Site update workflow's jobs a run can fail in, in their order (the brief only skips).
export const runJobs = ['preflight', updateJob, 'publish']
// The Site update workflow writes the resume score before and after its change into the
// pull request body (a hidden `<!-- resume-score before=90 after=85 -->` marker), so the
// MCP server can warn Steven before he merges something that lowers it.
export type ResumeScore = { before: number | null; after: number; lower: boolean }
// What the workflow was asked to do, written into the pull request body as a hidden
// `<!-- site-update-request <base64 JSON> -->` marker: the title and instruction (so the
// update can be redone on a fresh branch when it conflicts), the résumé proposals it
// carries (marked applied when it merges) and the pull request it supersedes; for a Building
// write-up refresh, the project (a key of src/articles/sources.json) and the project's commit it
// was made from, so a redo sends the refresh again rather than a request without its sources.
// Keep the keys in step with the `jq` in site-update.yml's "Open the pull request".
export type UpdateRequest = { title: string; instruction: string; proposals: number[]; supersedes: number | null; project?: string | null; sourceSha?: string | null }
export const updateRequestKeys = ['title', 'instruction', 'proposals', 'supersedes', 'project', 'sourceSha'] as const
const projects = Object.keys(sources).filter((key) => key !== '_comment')
// The checks branch protection on main requires: review.yml's jobs gates and team, site-check.yml's check.
export const requiredChecks = ['gates', 'team', 'check'] as const
// Which required checks each workflow reports, for a run that waits for approval.
export const checksOfWorkflow: Record<string, string[]> = { Review: ['gates', 'team'], 'Site checks': ['check'] }
// A required check on the pull request's head commit, as the pull request counts it (its newest run).
// step: the first failed step of a failed check, when GitHub said which.
export type CheckState = { name: string; status: string; conclusion: string | null; startedAt: string | null; url: string | null; step?: string | null }
// One reviewer's latest verdict, from the Review workflow's sign-off comment.
export type TeamVerdict = { role: string; verdict: string; summary: string }
// What holds a pull request, from its own data: GitHub's merge state, the required checks on
// its head commit (a missing one never started on it), the runs waiting for approval, its
// labels, and the team's verdicts with the comment they are in (stale when for another commit).
export type PullStatus = {
  headSha: string
  mergeState: string | null
  checks: CheckState[]
  waiting: string[]
  labels: string[]
  verdicts: { sha: string; url: string | null; roles: TeamVerdict[]; stale: boolean } | null
}
// mergeableState is GitHub's word for why a pull request can or cannot merge: clean,
// unstable (checks failing), behind (main moved on, still merges), blocked (branch
// protection), dirty (conflicts with main), unknown (still being computed), or null
// when it was not asked for (the list endpoint does not compute it). headRepo is the
// repository the branch lives in (owner/name): a fork's pull request can carry any branch name.
export type PullRequest = { number: number; title: string; url: string; branch: string; headRepo: string | null; draft: boolean; state: 'open' | 'closed'; merged: boolean; createdAt: string; previewUrl: string; mergeable: boolean | null; mergeableState: string | null; resumeScore: ResumeScore | null; request: UpdateRequest | null }
export type MergeResult = { merged: boolean; message: string; sha?: string }

export class GitHubError extends Error { constructor(message: string, public status: number) { super(message) } }

export type GitHub = {
  repo: string
  dispatch(workflow: string, ref: string, inputs: Record<string, string>): Promise<void>
  runs(workflow: string, limit: number): Promise<WorkflowRun[]>
  run(id: number): Promise<WorkflowRun | null>
  // Where a failed run stopped; null when no step of the update job failed (a cancellation, a failed setup).
  runFailure(runId: number): Promise<RunFailure | null>
  // The newest pull requests first, 20 unless a larger page (at most 100) is asked for.
  pulls(state?: 'open' | 'closed' | 'all', limit?: number): Promise<PullRequest[]>
  pull(number: number): Promise<PullRequest | null>
  // How many closed pull requests from branches with this prefix were merged (the site's own Building feed).
  mergedPulls(branchPrefix: string): Promise<number>
  merge(number: number): Promise<MergeResult>
  // Closes a pull request with a comment saying why; the branch is deleted when the token may (best effort).
  close(number: number, comment: string): Promise<{ closed: boolean; branchDeleted: boolean }>
  // What holds an open pull request (see PullStatus): one GraphQL query, the runs waiting for approval, the failed steps.
  status(number: number): Promise<PullStatus>
  // Closes and reopens a pull request, without a comment or a commit: its pull_request checks start again, as the token's owner.
  reopen(number: number): Promise<void>
  // Sends a repository_dispatch event to this repository (a write-up refresh, again).
  repositoryDispatch(eventType: string, payload: Record<string, unknown>): Promise<void>
  // The commit a branch of another repository is at (a project's main), or null when it cannot be read.
  headOf(repository: string, branch: string): Promise<string | null>
}

// Cloudflare Pages names a branch preview after the branch: lower-case, anything
// but letters, digits and dashes becomes a dash, cut to 28 characters.
// Whether two owner/name strings are the same repository: GitHub reads both parts case-insensitively.
export const sameRepo = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b) && a!.toLowerCase() === b!.toLowerCase()

export const previewUrl = (branch: string, project = 'stevenwilssens') => `https://${branch.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 28)}.${project}.pages.dev`

// The workflow writes its own markers at the very end of the body, after the instruction and
// the spec's open questions it copies in. A marker planted in that copied text comes earlier,
// so every marker parser takes the last match, never the first.
const lastMatch = (pattern: RegExp, body: string | null | undefined) => [...(body ?? '').matchAll(pattern)].at(-1) ?? null

export const resumeScoreFromBody = (body: string | null | undefined): ResumeScore | null => {
  const match = lastMatch(/<!--\s*resume-score\s+before=(\d+|unknown)\s+after=(\d+)\s*-->/g, body)
  if (!match) return null
  const before = match[1] === 'unknown' ? null : Number(match[1])
  const after = Number(match[2])
  return { before, after, lower: before !== null && after < before }
}

// The request marker is base64 of UTF-8 JSON, so an instruction with quotes, dashes or
// accents never breaks the HTML comment it travels in.
const encodeMarker = (value: unknown) => {
  let binary = ''
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) binary += String.fromCharCode(byte)
  return btoa(binary)
}
export const encodeUpdateRequest = (request: UpdateRequest) => `<!-- site-update-request ${encodeMarker(request)} -->`
// base64 of UTF-8 JSON back to a value; throws on anything else.
const decodeMarker = (base64: string): unknown => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))))

export const updateRequestFromBody = (body: string | null | undefined): UpdateRequest | null => {
  const match = lastMatch(/<!--\s*site-update-request\s+([A-Za-z0-9+/=]+)\s*-->/g, body)
  if (match) {
    try {
      const parsed = decodeMarker(match[1]) as Partial<UpdateRequest>
      if (typeof parsed.title === 'string' && typeof parsed.instruction === 'string') {
        // A refresh's project and commit, only when they are a known project and a commit id; a marker without them reads as before.
        const project = typeof parsed.project === 'string' && projects.includes(parsed.project) ? parsed.project : null
        const sourceSha = project && typeof parsed.sourceSha === 'string' && /^[0-9a-f]{7,40}$/.test(parsed.sourceSha) ? parsed.sourceSha : null
        return { title: parsed.title, instruction: parsed.instruction, proposals: Array.isArray(parsed.proposals) ? parsed.proposals.filter((id): id is number => Number.isInteger(id)) : [], supersedes: typeof parsed.supersedes === 'number' ? parsed.supersedes : null, ...(project ? { project, sourceSha } : {}) }
      }
    } catch { /* an unreadable marker is the same as none */ }
  }
  // Pull requests from before the marker: the instruction is the paragraph under **Instruction**.
  const legacy = /\*\*Instruction\*\*\s*\n\n([\s\S]*?)\n\n\*\*Resume score/.exec(body ?? '')
  return legacy ? { title: '', instruction: legacy[1].trim(), proposals: [], supersedes: null } : null
}

// The Review workflow posts the team's sign-off table as the built-in token's bot and puts
// the verdicts in it as a hidden `<!-- team-verdicts <base64 JSON {sha, roles}> -->` marker
// (review.yml, "Post the sign-offs"). Only that bot's comments are read, and of those the last
// marker that reads: anyone can comment on a public pull request, so a marker in anyone else's
// comment, the owner's and the site bot's included, is never the team's.
export const reviewBots = ['github-actions', 'github-actions[bot]']
export const verdicts = ['APPROVE', 'CHANGES_REQUESTED', 'NEEDS_STEVEN', 'NOT_APPLICABLE']
export type PullComment = { author: string | null; url: string | null; body: string }
export const encodeTeamVerdicts = (value: { sha: string; roles: TeamVerdict[] }) => `<!-- team-verdicts ${encodeMarker(value)} -->`
export const teamVerdictsFrom = (comments: PullComment[], headSha: string): PullStatus['verdicts'] => {
  let found: PullStatus['verdicts'] = null
  for (const comment of comments) {
    if (!comment.author || !reviewBots.includes(comment.author)) continue
    const match = lastMatch(/<!--\s*team-verdicts\s+([A-Za-z0-9+/=]+)\s*-->/g, comment.body)
    if (!match) continue
    try {
      const parsed = decodeMarker(match[1]) as { sha?: unknown; roles?: unknown }
      if (typeof parsed.sha !== 'string' || !/^[0-9a-f]{40}$/.test(parsed.sha) || !Array.isArray(parsed.roles)) continue
      const roles = (parsed.roles as Record<string, unknown>[]).filter((role) => role && typeof role.role === 'string' && typeof role.verdict === 'string' && verdicts.includes(role.verdict))
        .map((role) => ({ role: (role.role as string).slice(0, 80), verdict: role.verdict as string, summary: typeof role.summary === 'string' ? role.summary.slice(0, 600) : '' }))
      found = { sha: parsed.sha, url: comment.url, roles, stale: parsed.sha !== headSha }
    } catch { /* an unreadable marker is the same as none */ }
  }
  return found
}

// The pull request's status in one query: what branch protection reads (the head commit's check
// rollup), GitHub's merge state, the labels and the last 100 comments for the team's verdicts.
const statusQuery = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      headRefOid
      mergeStateStatus
      labels(first: 50) { nodes { name } }
      comments(last: 100) { nodes { author { login } url body } }
      commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) { nodes { __typename ... on CheckRun { name status conclusion startedAt detailsUrl databaseId } } } } } } }
    }
  }
}`
type CheckRunNode = { __typename?: string; name?: string; status?: string; conclusion?: string | null; startedAt?: string | null; detailsUrl?: string | null; databaseId?: number | null }
type StatusData = { repository?: { pullRequest?: {
  headRefOid: string
  mergeStateStatus?: string | null
  labels?: { nodes?: { name: string }[] }
  comments?: { nodes?: { author?: { login?: string } | null; url?: string; body?: string }[] }
  commits?: { nodes?: { commit?: { statusCheckRollup?: { contexts?: { nodes?: CheckRunNode[] } } | null } }[] }
} | null } | null }
export const failedConclusions = ['failure', 'timed_out', 'cancelled', 'startup_failure', 'action_required', 'stale']

const shapePull = (pull: Record<string, unknown>): PullRequest => {
  const head = pull.head as { ref: string; repo?: { full_name?: string } | null }
  const body = pull.body as string | null
  const request = updateRequestFromBody(body)
  return {
    number: pull.number as number, title: pull.title as string, url: pull.html_url as string, branch: head.ref, headRepo: typeof head.repo?.full_name === 'string' ? head.repo.full_name : null, draft: Boolean(pull.draft),
    state: pull.state === 'closed' ? 'closed' : 'open', merged: Boolean(pull.merged ?? pull.merged_at), createdAt: pull.created_at as string, previewUrl: previewUrl(head.ref),
    mergeable: typeof pull.mergeable === 'boolean' ? pull.mergeable : null, mergeableState: typeof pull.mergeable_state === 'string' ? pull.mergeable_state : null,
    resumeScore: resumeScoreFromBody(body), request: request ? { ...request, title: request.title || (pull.title as string) } : null,
  }
}
const shapeRun = (run: Record<string, unknown>): WorkflowRun => ({ id: run.id as number, number: typeof run.run_number === 'number' ? run.run_number : null, event: typeof run.event === 'string' ? run.event : null, status: run.status as string, conclusion: (run.conclusion as string | null) ?? null, createdAt: run.created_at as string, url: run.html_url as string, branch: run.head_branch as string, title: (run.display_title as string) ?? (run.name as string) })

export const gitHubClient = (token: string, repo: string, fetchImpl: typeof fetch = fetch): GitHub => {
  // A path under this repository (/pulls/1), or an absolute address on GitHub's API (another repository, GraphQL):
  // the token goes to api.github.com and nowhere else.
  const api = async (path: string, init: RequestInit = {}) => {
    if (!path.startsWith('/') && !path.startsWith('https://api.github.com/')) throw new GitHubError(`refused to send the token to ${path.slice(0, 80)}`, 400)
    const response = await fetchImpl(path.startsWith('https://') ? path : `https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'steven-wilssens-mcp', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
    })
    if (response.status === 204) return null
    const text = await response.text()
    // An error page from a proxy (a 502 in HTML) is not JSON: keep the status and the text.
    let body: Record<string, unknown> | null = null
    try { body = text ? JSON.parse(text) as Record<string, unknown> : null } catch {
      throw new GitHubError(`GitHub ${response.status} on ${path}: ${response.ok ? 'the answer is not JSON' : text.slice(0, 200)}`, response.status)
    }
    if (!response.ok) throw new GitHubError(`GitHub ${response.status} on ${path}: ${(body?.message as string) ?? text}`, response.status)
    return body
  }
  const notFound = (error: unknown) => error instanceof GitHubError && error.status === 404
  return {
    repo,
    dispatch: async (workflow, ref, inputs) => { await api(`/actions/workflows/${workflow}/dispatches`, { method: 'POST', body: JSON.stringify({ ref, inputs }) }) },
    runs: async (workflow, limit) => {
      const body = await api(`/actions/workflows/${workflow}/runs?per_page=${limit}`) as { workflow_runs: Record<string, unknown>[] }
      return body.workflow_runs.map(shapeRun)
    },
    run: async (id) => { try { return shapeRun((await api(`/actions/runs/${id}`)) as Record<string, unknown>) } catch (error) { if (notFound(error)) return null; throw error } },
    runFailure: async (runId) => {
      const body = await api(`/actions/runs/${runId}/jobs?per_page=100`) as { jobs?: { id: number; name: string; steps?: { name: string; conclusion: string | null }[] }[] }
      // The first job, in the workflow's order, with a failed step: the bot not set up (preflight), the change
      // itself (update), or the push and the pull request (publish).
      let job: { id: number; name: string } | null = null
      let failed: { name: string } | null = null
      for (const name of runJobs) {
        const item = (body.jobs ?? []).find((candidate) => candidate.name === name)
        const step = item?.steps?.find((candidate) => candidate.conclusion === 'failure')
        if (item && step) { job = item; failed = step; break }
      }
      if (!job || !failed) return null
      const noChange = job.name === updateJob && failed.name === noChangeStep
      // A job is a check run: its annotations carry the step's ::error:: line. Checks: read is needed for them.
      let reason: string | null = null
      let refused = false
      try {
        const annotations = await api(`/check-runs/${job.id}/annotations?per_page=50`) as unknown as { message?: string; annotation_level?: string }[]
        const errors = annotations.filter((item) => item.annotation_level === 'failure' && typeof item.message === 'string')
        const line = noChange ? errors.find((item) => item.message!.startsWith(noChangeSentence)) : errors[0]
        if (line) reason = (noChange ? line.message!.slice(noChangeSentence.length) : line.message!).trim() || null
      } catch (error) {
        if (!(error instanceof GitHubError) || (error.status !== 403 && error.status !== 404)) throw error
        refused = error.status === 403
      }
      return { step: failed.name, noChange, reason, refused, job: job.name }
    },
    pulls: async (state = 'open', limit = 20) => ((await api(`/pulls?state=${state}&per_page=${Math.min(Math.max(limit, 1), 100)}&sort=created&direction=desc`)) as unknown as Record<string, unknown>[]).map(shapePull),
    pull: async (number) => { try { return shapePull((await api(`/pulls/${number}`)) as Record<string, unknown>) } catch (error) { if (notFound(error)) return null; throw error } },
    mergedPulls: async (branchPrefix) => {
      const closed = (await api(`/pulls?state=closed&per_page=100&sort=created&direction=desc`)) as unknown as Record<string, unknown>[]
      return closed.filter((pull) => pull.merged_at && String((pull.head as Record<string, unknown>)?.ref ?? '').startsWith(branchPrefix)).length
    },
    merge: async (number) => {
      const body = await api(`/pulls/${number}/merge`, { method: 'PUT', body: JSON.stringify({ merge_method: 'merge' }) }) as { merged: boolean; message: string; sha?: string }
      return { merged: body.merged, message: body.message, sha: body.sha }
    },
    close: async (number, comment) => {
      const pull = (await api(`/pulls/${number}`)) as Record<string, unknown>
      const head = pull.head as { ref: string; repo?: { full_name?: string } | null }
      const branch = head.ref
      await api(`/issues/${number}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) })
      await api(`/pulls/${number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) })
      let branchDeleted = false
      // Only a branch of this repository: a fork's pull request names a branch of the fork, and this repository may have one of the same name.
      if (branch !== 'main' && sameRepo(head.repo?.full_name, repo)) {
        try { await api(`/git/refs/heads/${branch}`, { method: 'DELETE' }); branchDeleted = true } catch (error) { console.error('branch delete', String(error)) }
      }
      return { closed: true, branchDeleted }
    },
    status: async (number) => {
      const [owner, name] = repo.split('/')
      const answer = await api('https://api.github.com/graphql', { method: 'POST', body: JSON.stringify({ query: statusQuery, variables: { owner, name, number } }) }) as { data?: StatusData; errors?: { message?: string }[] }
      const pull = answer?.data?.repository?.pullRequest
      if (!pull) throw new GitHubError(`GitHub could not read #${number}: ${answer?.errors?.[0]?.message ?? 'no pull request'}`, 404)
      const headSha = pull.headRefOid
      const contexts = (pull.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts?.nodes ?? []).filter((node) => node.__typename === 'CheckRun')
      // Each required check as the pull request counts it: its newest run on the head commit. A queued run has not
      // started yet, so it is newer than any run that has; only the first failed check is asked where it stopped
      // (one request more, not one per check: the MCP server counts its requests).
      const checks: CheckState[] = []
      let stepRead = false
      for (const check of requiredChecks) {
        const newest = contexts.filter((node) => node.name === check).sort((a, b) => String(b.startedAt ?? '9999').localeCompare(String(a.startedAt ?? '9999')))[0]
        if (!newest) continue
        const state: CheckState = { name: check, status: String(newest.status ?? '').toLowerCase(), conclusion: newest.conclusion ? newest.conclusion.toLowerCase() : null, startedAt: newest.startedAt ?? null, url: newest.detailsUrl ?? null }
        // Where a failed check stopped: an Actions check run is its job, whose steps say which failed.
        if (state.conclusion && failedConclusions.includes(state.conclusion) && newest.databaseId && !stepRead) {
          stepRead = true
          try {
            const job = await api(`/actions/jobs/${newest.databaseId}`) as { steps?: { name: string; conclusion: string | null }[] }
            state.step = job.steps?.find((step) => step.conclusion === 'failure')?.name ?? null
          } catch { state.step = null }
        }
        checks.push(state)
      }
      // A check waits for approval only when no run of it exists on the head commit: a run held at action_required
      // puts no check run there, and an old held run stays held after a recheck started a new one.
      const absent = requiredChecks.filter((check) => !checks.some((state) => state.name === check))
      const runs = absent.length ? await api(`/actions/runs?head_sha=${headSha}&status=action_required&per_page=20`) as { workflow_runs?: { name?: string }[] } : null
      const waiting = [...new Set((runs?.workflow_runs ?? []).flatMap((run) => checksOfWorkflow[run.name ?? ''] ?? (run.name ? [run.name] : [])))].filter((name) => !checks.some((state) => state.name === name))
      const prefix = `https://github.com/${repo}/pull/${number}`.toLowerCase()
      const comments = (pull.comments?.nodes ?? []).map((node) => ({ author: node.author?.login ?? null, url: typeof node.url === 'string' && node.url.toLowerCase().startsWith(prefix) ? node.url : null, body: node.body ?? '' }))
      return { headSha, mergeState: pull.mergeStateStatus ? pull.mergeStateStatus.toLowerCase() : null, checks, waiting, labels: (pull.labels?.nodes ?? []).map((label) => label.name), verdicts: teamVerdictsFrom(comments, headSha) }
    },
    reopen: async (number) => {
      await api(`/pulls/${number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) })
      await api(`/pulls/${number}`, { method: 'PATCH', body: JSON.stringify({ state: 'open' }) })
    },
    repositoryDispatch: async (eventType, payload) => { await api('/dispatches', { method: 'POST', body: JSON.stringify({ event_type: eventType, client_payload: payload }) }) },
    headOf: async (repository, branch) => {
      // owner/name and a branch as GitHub spells them; nothing that could climb out of the path.
      if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(repository) || !/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(branch) || `${repository}/${branch}`.includes('..')) return null
      try {
        const commit = await api(`https://api.github.com/repos/${repository}/commits/${branch}`) as { sha?: string }
        return typeof commit?.sha === 'string' && /^[0-9a-f]{40}$/.test(commit.sha) ? commit.sha : null
      } catch (error) { console.error('head of', repository, String(error)); return null }
    },
  }
}
