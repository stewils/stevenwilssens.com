// The MCP server's hands on the repository: it starts the "Site update" workflow
// (.github/workflows/site-update.yml), where Claude Code edits the site and the
// resume on a branch and opens a pull request, and it reads runs and pull requests
// back. Needs a GitHub token (GITHUB_TOKEN secret) with Actions: write, Contents:
// read and Pull requests: write on the repository.

export type WorkflowRun = { id: number; status: string; conclusion: string | null; createdAt: string; url: string; branch: string; title: string }
export type PullRequest = { number: number; title: string; url: string; branch: string; draft: boolean; createdAt: string; previewUrl: string; mergeable: boolean | null }

export type GitHub = {
  repo: string
  dispatch(workflow: string, ref: string, inputs: Record<string, string>): Promise<void>
  runs(workflow: string, limit: number): Promise<WorkflowRun[]>
  pulls(state?: 'open' | 'closed' | 'all'): Promise<PullRequest[]>
  pull(number: number): Promise<PullRequest | null>
  merge(number: number): Promise<{ merged: boolean; message: string; sha?: string }>
}

// Cloudflare Pages names a branch preview after the branch: lower-case, anything
// but letters, digits and dashes becomes a dash, cut to 28 characters.
export const previewUrl = (branch: string, project = 'stevenwilssens') => `https://${branch.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 28)}.${project}.pages.dev`

const shapePull = (pull: Record<string, unknown>): PullRequest => {
  const head = pull.head as { ref: string }
  return { number: pull.number as number, title: pull.title as string, url: pull.html_url as string, branch: head.ref, draft: Boolean(pull.draft), createdAt: pull.created_at as string, previewUrl: previewUrl(head.ref), mergeable: typeof pull.mergeable === 'boolean' ? pull.mergeable : null }
}

export const gitHubClient = (token: string, repo: string, fetchImpl: typeof fetch = fetch): GitHub => {
  const api = async (path: string, init: RequestInit = {}) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'steven-wilssens-mcp', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
    })
    if (response.status === 204) return null
    const text = await response.text()
    const body = text ? JSON.parse(text) as Record<string, unknown> : null
    if (!response.ok) throw new Error(`GitHub ${response.status} on ${path}: ${(body?.message as string) ?? text}`)
    return body
  }
  return {
    repo,
    dispatch: async (workflow, ref, inputs) => { await api(`/actions/workflows/${workflow}/dispatches`, { method: 'POST', body: JSON.stringify({ ref, inputs }) }) },
    runs: async (workflow, limit) => {
      const body = await api(`/actions/workflows/${workflow}/runs?per_page=${limit}`) as { workflow_runs: Record<string, unknown>[] }
      return body.workflow_runs.map((run) => ({ id: run.id as number, status: run.status as string, conclusion: (run.conclusion as string | null) ?? null, createdAt: run.created_at as string, url: run.html_url as string, branch: run.head_branch as string, title: (run.display_title as string) ?? (run.name as string) }))
    },
    pulls: async (state = 'open') => ((await api(`/pulls?state=${state}&per_page=20&sort=created&direction=desc`)) as unknown as Record<string, unknown>[]).map(shapePull),
    pull: async (number) => { try { return shapePull((await api(`/pulls/${number}`)) as Record<string, unknown>) } catch (error) { if (String(error).includes(' 404 ')) return null; throw error } },
    merge: async (number) => {
      const body = await api(`/pulls/${number}/merge`, { method: 'PUT', body: JSON.stringify({ merge_method: 'merge' }) }) as { merged: boolean; message: string; sha?: string }
      return { merged: body.merged, message: body.message, sha: body.sha }
    },
  }
}
