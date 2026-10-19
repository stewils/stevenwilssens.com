// The MCP server's hands on the repository: it starts the "Site update" workflow
// (.github/workflows/site-update.yml), where Claude Code edits the site and the
// resume on a branch and opens a pull request, and it reads runs and pull requests
// back, merges them, closes them and waits for them. Needs a GitHub token (GITHUB_TOKEN
// secret) with Actions: write, Contents: write (to delete a closed pull request's branch;
// read is enough for everything else) and Pull requests: write on the repository.

export type WorkflowRun = { id: number; status: string; conclusion: string | null; createdAt: string; url: string; branch: string; title: string }
// The Site update workflow writes the resume score before and after its change into the
// pull request body (a hidden `<!-- resume-score before=90 after=85 -->` marker), so the
// MCP server can warn Steven before he merges something that lowers it.
export type ResumeScore = { before: number | null; after: number; lower: boolean }
// What the workflow was asked to do, written into the pull request body as a hidden
// `<!-- site-update-request <base64 JSON> -->` marker: the title and instruction (so the
// update can be redone on a fresh branch when it conflicts), the résumé proposals it
// carries (marked applied when it merges) and the pull request it supersedes.
export type UpdateRequest = { title: string; instruction: string; proposals: number[]; supersedes: number | null }
// mergeableState is GitHub's word for why a pull request can or cannot merge: clean,
// unstable (checks failing), behind (main moved on, still merges), blocked (branch
// protection), dirty (conflicts with main), unknown (still being computed), or null
// when it was not asked for (the list endpoint does not compute it).
export type PullRequest = { number: number; title: string; url: string; branch: string; draft: boolean; state: 'open' | 'closed'; merged: boolean; createdAt: string; previewUrl: string; mergeable: boolean | null; mergeableState: string | null; resumeScore: ResumeScore | null; request: UpdateRequest | null }
export type MergeResult = { merged: boolean; message: string; sha?: string }

export class GitHubError extends Error { constructor(message: string, public status: number) { super(message) } }

export type GitHub = {
  repo: string
  dispatch(workflow: string, ref: string, inputs: Record<string, string>): Promise<void>
  runs(workflow: string, limit: number): Promise<WorkflowRun[]>
  run(id: number): Promise<WorkflowRun | null>
  pulls(state?: 'open' | 'closed' | 'all'): Promise<PullRequest[]>
  pull(number: number): Promise<PullRequest | null>
  // How many closed pull requests from branches with this prefix were merged (the site's own Building feed).
  mergedPulls(branchPrefix: string): Promise<number>
  merge(number: number): Promise<MergeResult>
  // Closes a pull request with a comment saying why; the branch is deleted when the token may (best effort).
  close(number: number, comment: string): Promise<{ closed: boolean; branchDeleted: boolean }>
}

// Cloudflare Pages names a branch preview after the branch: lower-case, anything
// but letters, digits and dashes becomes a dash, cut to 28 characters.
export const previewUrl = (branch: string, project = 'stevenwilssens') => `https://${branch.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 28)}.${project}.pages.dev`

export const resumeScoreFromBody = (body: string | null | undefined): ResumeScore | null => {
  const match = /<!--\s*resume-score\s+before=(\d+|unknown)\s+after=(\d+)\s*-->/.exec(body ?? '')
  if (!match) return null
  const before = match[1] === 'unknown' ? null : Number(match[1])
  const after = Number(match[2])
  return { before, after, lower: before !== null && after < before }
}

// The request marker is base64 of UTF-8 JSON, so an instruction with quotes, dashes or
// accents never breaks the HTML comment it travels in.
export const encodeUpdateRequest = (request: UpdateRequest) => {
  const bytes = new TextEncoder().encode(JSON.stringify(request))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `<!-- site-update-request ${btoa(binary)} -->`
}
export const updateRequestFromBody = (body: string | null | undefined): UpdateRequest | null => {
  const match = /<!--\s*site-update-request\s+([A-Za-z0-9+/=]+)\s*-->/.exec(body ?? '')
  if (match) {
    try {
      const binary = atob(match[1])
      const text = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
      const parsed = JSON.parse(text) as Partial<UpdateRequest>
      if (typeof parsed.title === 'string' && typeof parsed.instruction === 'string') {
        return { title: parsed.title, instruction: parsed.instruction, proposals: Array.isArray(parsed.proposals) ? parsed.proposals.filter((id): id is number => Number.isInteger(id)) : [], supersedes: typeof parsed.supersedes === 'number' ? parsed.supersedes : null }
      }
    } catch { /* an unreadable marker is the same as none */ }
  }
  // Pull requests from before the marker: the instruction is the paragraph under **Instruction**.
  const legacy = /\*\*Instruction\*\*\s*\n\n([\s\S]*?)\n\n\*\*Resume score/.exec(body ?? '')
  return legacy ? { title: '', instruction: legacy[1].trim(), proposals: [], supersedes: null } : null
}

const shapePull = (pull: Record<string, unknown>): PullRequest => {
  const head = pull.head as { ref: string }
  const body = pull.body as string | null
  const request = updateRequestFromBody(body)
  return {
    number: pull.number as number, title: pull.title as string, url: pull.html_url as string, branch: head.ref, draft: Boolean(pull.draft),
    state: pull.state === 'closed' ? 'closed' : 'open', merged: Boolean(pull.merged ?? pull.merged_at), createdAt: pull.created_at as string, previewUrl: previewUrl(head.ref),
    mergeable: typeof pull.mergeable === 'boolean' ? pull.mergeable : null, mergeableState: typeof pull.mergeable_state === 'string' ? pull.mergeable_state : null,
    resumeScore: resumeScoreFromBody(body), request: request ? { ...request, title: request.title || (pull.title as string) } : null,
  }
}
const shapeRun = (run: Record<string, unknown>): WorkflowRun => ({ id: run.id as number, status: run.status as string, conclusion: (run.conclusion as string | null) ?? null, createdAt: run.created_at as string, url: run.html_url as string, branch: run.head_branch as string, title: (run.display_title as string) ?? (run.name as string) })

export const gitHubClient = (token: string, repo: string, fetchImpl: typeof fetch = fetch): GitHub => {
  const api = async (path: string, init: RequestInit = {}) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
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
    pulls: async (state = 'open') => ((await api(`/pulls?state=${state}&per_page=20&sort=created&direction=desc`)) as unknown as Record<string, unknown>[]).map(shapePull),
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
      const branch = (pull.head as { ref: string }).ref
      await api(`/issues/${number}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) })
      await api(`/pulls/${number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) })
      let branchDeleted = false
      if (branch !== 'main') {
        try { await api(`/git/refs/heads/${branch}`, { method: 'DELETE' }); branchDeleted = true } catch (error) { console.error('branch delete', String(error)) }
      }
      return { closed: true, branchDeleted }
    },
  }
}
