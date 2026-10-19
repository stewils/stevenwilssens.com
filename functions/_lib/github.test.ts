// @vitest-environment node
// The MCP server's GitHub client, against a stubbed fetch: the requests it sends, the
// shapes it returns, and how it treats GitHub's refusals.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodeUpdateRequest, GitHubError, gitHubClient, previewUrl, resumeScoreFromBody, updateRequestFromBody } from './github'

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> }
type Reply = { status?: number; body?: unknown; text?: string }

// Answers each request with the first reply whose key the "METHOD path" starts with.
const fakeFetch = (replies: Record<string, Reply | Reply[]>) => {
  const calls: Call[] = []
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    const path = url.replace('https://api.github.com/repos/stewils/site', '')
    calls.push({ url, method, body: init.body ? JSON.parse(init.body as string) : undefined, headers: init.headers as Record<string, string> })
    const key = Object.keys(replies).find((prefix) => `${method} ${path}`.startsWith(prefix))
    if (!key) throw new Error(`unexpected ${method} ${path}`)
    const queue = replies[key]
    const reply = Array.isArray(queue) ? queue.shift()! : queue
    const status = reply.status ?? 200
    return new Response(status === 204 ? null : reply.text ?? (reply.body === undefined ? '' : JSON.stringify(reply.body)), { status })
  }) as unknown as typeof fetch
  return { calls, client: gitHubClient('tok3n', 'stewils/site', fetchImpl) }
}

const pullJson = (overrides: Record<string, unknown> = {}) => ({
  number: 12, title: 'Add the patents', html_url: 'https://github.com/stewils/site/pull/12', head: { ref: 'update/Add_Patents' }, draft: false,
  state: 'open', merged: false, merged_at: null, created_at: '2026-10-18T10:00:00Z', mergeable: true, mergeable_state: 'clean',
  body: `Done.\n<!-- resume-score before=90 after=85 -->\n${encodeUpdateRequest({ title: '', instruction: 'Add the patents', proposals: [3], supersedes: null })}`,
  ...overrides,
})
const runJson = (overrides: Record<string, unknown> = {}) => ({ id: 7, status: 'completed', conclusion: 'success', created_at: '2026-10-18T10:00:00Z', html_url: 'https://github.com/stewils/site/actions/runs/7', head_branch: 'main', display_title: 'Site update: patents', name: 'Site update', ...overrides })

afterEach(() => vi.restoreAllMocks())

describe('preview addresses', () => {
  it('follow how Cloudflare Pages names a branch', () => {
    expect(previewUrl('update/Add_Patents')).toBe('https://update-add-patents.stevenwilssens.pages.dev')
    expect(previewUrl('a-very-long-branch-name-that-goes-on-and-on', 'other')).toBe('https://a-very-long-branch-name-that.other.pages.dev')
  })
})

describe('the résumé score marker', () => {
  it('reads the score before and after, and whether it dropped', () => {
    expect(resumeScoreFromBody('x <!-- resume-score before=90 after=85 --> y')).toEqual({ before: 90, after: 85, lower: true })
    expect(resumeScoreFromBody('<!--resume-score before=80 after=85-->')).toEqual({ before: 80, after: 85, lower: false })
    expect(resumeScoreFromBody('<!-- resume-score before=unknown after=70 -->')).toEqual({ before: null, after: 70, lower: false })
    expect(resumeScoreFromBody('no marker')).toBeNull()
    expect(resumeScoreFromBody(null)).toBeNull()
    expect(resumeScoreFromBody(undefined)).toBeNull()
  })
})

describe('the update request marker', () => {
  it('survives quotes, dashes and accents', () => {
    const request = { title: 'Résumé — "patents"', instruction: 'Add the patents <b> & the press -->', proposals: [1, 2], supersedes: 9 }
    const marker = encodeUpdateRequest(request)
    expect(marker).toMatch(/^<!-- site-update-request [A-Za-z0-9+/=]+ -->$/)
    expect(updateRequestFromBody(`Body\n\n${marker}\n`)).toEqual(request)
  })

  it('keeps only whole proposal ids and a numeric superseded pull request', () => {
    const marker = (value: unknown) => `<!-- site-update-request ${btoa(JSON.stringify(value))} -->`
    expect(updateRequestFromBody(marker({ title: 't', instruction: 'i', proposals: [1, 'two', 2.5, 3], supersedes: '4' }))).toEqual({ title: 't', instruction: 'i', proposals: [1, 3], supersedes: null })
    expect(updateRequestFromBody(marker({ title: 't', instruction: 'i', proposals: 'none' }))).toEqual({ title: 't', instruction: 'i', proposals: [], supersedes: null })
  })

  it('treats an unreadable or incomplete marker as none', () => {
    expect(updateRequestFromBody('<!-- site-update-request !!!notbase64 -->')).toBeNull()
    expect(updateRequestFromBody(`<!-- site-update-request ${btoa('not json')} -->`)).toBeNull()
    expect(updateRequestFromBody(`<!-- site-update-request ${btoa(JSON.stringify({ title: 't' }))} -->`)).toBeNull()
    expect(updateRequestFromBody(null)).toBeNull()
    expect(updateRequestFromBody(undefined)).toBeNull()
  })

  it('reads the instruction of a pull request from before the marker', () => {
    const body = 'Summary\n\n**Instruction**\n\n  Add the patents to the about page.  \n\n**Resume score** 90'
    expect(updateRequestFromBody(body)).toEqual({ title: '', instruction: 'Add the patents to the about page.', proposals: [], supersedes: null })
  })
})

describe('the GitHub client', () => {
  it('starts a workflow with the token, the API version and a JSON body', async () => {
    const { calls, client } = fakeFetch({ 'POST /actions/workflows/site-update.yml/dispatches': { status: 204 } })
    expect(client.repo).toBe('stewils/site')
    await client.dispatch('site-update.yml', 'main', { instruction: 'x' })
    expect(calls[0]).toMatchObject({ url: 'https://api.github.com/repos/stewils/site/actions/workflows/site-update.yml/dispatches', method: 'POST', body: { ref: 'main', inputs: { instruction: 'x' } } })
    expect(calls[0].headers).toMatchObject({ Authorization: 'Bearer tok3n', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' })
  })

  it('lists a workflow\'s runs and reads one, null when it is gone', async () => {
    const { calls, client } = fakeFetch({
      'GET /actions/workflows/site-update.yml/runs': { body: { workflow_runs: [runJson(), runJson({ id: 8, conclusion: undefined, display_title: undefined, status: 'in_progress' })] } },
      'GET /actions/runs/7': { body: runJson() },
      'GET /actions/runs/404': { status: 404, body: { message: 'Not Found' } },
      'GET /actions/runs/500': { status: 500, body: { message: 'boom' } },
      'GET /actions/runs/502': { status: 502, text: '<html>Bad gateway</html>' },
    })
    const runs = await client.runs('site-update.yml', 5)
    expect(calls[0].url).toContain('?per_page=5')
    expect(calls[0].headers['Content-Type']).toBeUndefined()
    expect(runs).toEqual([
      { id: 7, status: 'completed', conclusion: 'success', createdAt: '2026-10-18T10:00:00Z', url: 'https://github.com/stewils/site/actions/runs/7', branch: 'main', title: 'Site update: patents' },
      { id: 8, status: 'in_progress', conclusion: null, createdAt: '2026-10-18T10:00:00Z', url: 'https://github.com/stewils/site/actions/runs/7', branch: 'main', title: 'Site update' },
    ])
    expect(await client.run(7)).toMatchObject({ id: 7 })
    expect(await client.run(404)).toBeNull()
    const error = await client.run(500).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(GitHubError)
    expect(error).toMatchObject({ status: 500, message: 'GitHub 500 on /actions/runs/500: boom' })
  })

  it('keeps the status and the text of a non-JSON error page, and refuses a non-JSON answer', async () => {
    const { client } = fakeFetch({ 'GET /actions/runs/502': { status: 502, text: '<html>Bad gateway</html>' }, 'GET /actions/runs/7': { text: 'not json' } })
    const error = await client.run(502).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(GitHubError)
    expect(error).toMatchObject({ status: 502, message: 'GitHub 502 on /actions/runs/502: <html>Bad gateway</html>' })
    await expect(client.run(7)).rejects.toMatchObject({ status: 200, message: 'GitHub 200 on /actions/runs/7: the answer is not JSON' })
  })

  it('shapes pull requests with their preview, score and request', async () => {
    const { calls, client } = fakeFetch({
      'GET /pulls?state=': { body: [pullJson(), pullJson({ number: 13, title: 'Old one', state: 'closed', merged: undefined, merged_at: '2026-10-18T11:00:00Z', draft: true, mergeable: null, mergeable_state: undefined, body: null })] },
      'GET /pulls/12': { body: pullJson() },
      'GET /pulls/99': { status: 404, body: { message: 'Not Found' } },
      'GET /pulls/500': { status: 502, body: { message: 'Bad gateway' } },
    })
    const pulls = await client.pulls()
    expect(calls[0].url).toContain('/pulls?state=open&per_page=20')
    expect(pulls[0]).toEqual({
      number: 12, title: 'Add the patents', url: 'https://github.com/stewils/site/pull/12', branch: 'update/Add_Patents', draft: false, state: 'open', merged: false,
      createdAt: '2026-10-18T10:00:00Z', previewUrl: 'https://update-add-patents.stevenwilssens.pages.dev', mergeable: true, mergeableState: 'clean',
      resumeScore: { before: 90, after: 85, lower: true }, request: { title: 'Add the patents', instruction: 'Add the patents', proposals: [3], supersedes: null },
    })
    expect(pulls[1]).toMatchObject({ number: 13, state: 'closed', merged: true, draft: true, mergeable: null, mergeableState: null, resumeScore: null, request: null })
    await client.pulls('all')
    expect(calls[1].url).toContain('state=all')
    expect(await client.pull(12)).toMatchObject({ number: 12 })
    expect(await client.pull(99)).toBeNull()
    await expect(client.pull(500)).rejects.toThrow('GitHub 502 on /pulls/500: Bad gateway')
  })

  it('counts the merged pull requests from branches with a prefix', async () => {
    const { client } = fakeFetch({
      'GET /pulls?state=closed': { body: [
        pullJson({ merged_at: '2026-10-01' }),
        pullJson({ merged_at: '2026-10-02', head: { ref: 'feature/x' } }),
        pullJson({ merged_at: null }),
        pullJson({ merged_at: '2026-10-03', head: undefined }),
        pullJson({ merged_at: '2026-10-04', head: { ref: 'update/other' } }),
      ] },
    })
    expect(await client.mergedPulls('update/')).toBe(2)
  })

  it('merges a pull request with a merge commit', async () => {
    const { calls, client } = fakeFetch({ 'PUT /pulls/12/merge': { body: { merged: true, message: 'Pull Request successfully merged', sha: 'abc' } } })
    expect(await client.merge(12)).toEqual({ merged: true, message: 'Pull Request successfully merged', sha: 'abc' })
    expect(calls[0].body).toEqual({ merge_method: 'merge' })
  })

  it('passes a refused merge on with GitHub\'s message', async () => {
    const { client } = fakeFetch({ 'PUT /pulls/12/merge': { status: 405, body: { message: 'Pull Request is not mergeable' } } })
    await expect(client.merge(12)).rejects.toMatchObject({ status: 405, message: 'GitHub 405 on /pulls/12/merge: Pull Request is not mergeable' })
  })

  it('closes a pull request with a comment and deletes its branch', async () => {
    const { calls, client } = fakeFetch({
      'GET /pulls/12': { body: pullJson() },
      'POST /issues/12/comments': { status: 201, body: { id: 1 } },
      'PATCH /pulls/12': { body: pullJson({ state: 'closed' }) },
      'DELETE /git/refs/heads/update/Add_Patents': { status: 204 },
    })
    expect(await client.close(12, 'Superseded by #13')).toEqual({ closed: true, branchDeleted: true })
    expect(calls.map((call) => `${call.method} ${call.url.split('/stewils/site')[1]}`)).toEqual(['GET /pulls/12', 'POST /issues/12/comments', 'PATCH /pulls/12', 'DELETE /git/refs/heads/update/Add_Patents'])
    expect(calls[1].body).toEqual({ body: 'Superseded by #13' })
    expect(calls[2].body).toEqual({ state: 'closed' })
  })

  it('still closes when the token may not delete the branch, and never deletes main', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const refused = fakeFetch({
      'GET /pulls/12': { body: pullJson() },
      'POST /issues/12/comments': { status: 201, body: {} },
      'PATCH /pulls/12': { body: {} },
      'DELETE /git/refs/heads/': { status: 403, body: { message: 'Resource not accessible by personal access token' } },
    })
    expect(await refused.client.close(12, 'No')).toEqual({ closed: true, branchDeleted: false })
    expect(error).toHaveBeenCalledWith('branch delete', expect.stringContaining('GitHub 403'))

    const main = fakeFetch({ 'GET /pulls/5': { body: pullJson({ number: 5, head: { ref: 'main' } }) }, 'POST /issues/5/comments': { body: {} }, 'PATCH /pulls/5': { body: {} } })
    expect(await main.client.close(5, 'No')).toEqual({ closed: true, branchDeleted: false })
    expect(main.calls.some((call) => call.method === 'DELETE')).toBe(false)
  })

  it('reports an error answer without a body by its status', async () => {
    const { client } = fakeFetch({ 'GET /pulls?state=': { status: 401, text: '' } })
    await expect(client.pulls()).rejects.toThrow('GitHub 401 on /pulls?state=open&per_page=20&sort=created&direction=desc: ')
  })

  it('uses the global fetch when none is given', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    await gitHubClient('t', 'o/r').dispatch('w.yml', 'main', {})
    expect(spy).toHaveBeenCalledWith('https://api.github.com/repos/o/r/actions/workflows/w.yml/dispatches', expect.objectContaining({ method: 'POST' }))
  })
})
