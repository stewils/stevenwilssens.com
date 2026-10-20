// The tools' refusals and less travelled paths, through the MCP transport: argument
// validation, proposals for every part of a role, the LinkedIn tools without data, and
// the site-update tools against a GitHub that is slow, conflicted, closed or refusing.
import { describe, expect, it } from 'vitest'
import { encodeUpdateRequest, previewUrl, resumeScoreFromBody, updateRequestFromBody, type GitHub, type PullRequest, type WorkflowRun } from '../github'
import { experiences, impact } from '../../../src/resume'
import { handleMcp } from './server'
import { MemoryStore } from './store'
import { recruiterLens } from './tools'

const now = Date.UTC(2026, 9, 17)
const latest = experiences[0]

type Result = { isError: boolean; text: string; json: Record<string, unknown> | null; code?: number }
const call = async (store: MemoryStore, name: string, args: Record<string, unknown> = {}, options: { github?: GitHub | null; pages?: Record<string, string>; mode?: 'owner' | 'public' } = {}): Promise<Result> => {
  const request = new Request('https://steven.wilssens.com/mcp/key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) })
  const response = await handleMcp({ request, store, github: options.github ?? null, mode: options.mode ?? 'owner', sleep: async () => {}, fetchPage: async (path) => options.pages?.[path] ?? null, now })
  const body = await response.json() as { result?: { content: { text: string }[]; isError: boolean }; error?: { code: number } }
  if (!body.result) return { isError: true, text: '', json: null, code: body.error?.code }
  const text = body.result.content[0].text
  return { isError: body.result.isError, text, json: body.result.isError || !text.startsWith('{') ? null : JSON.parse(text) as Record<string, unknown> }
}

const pull = (number: number, extra: Partial<PullRequest> = {}, body = ''): PullRequest => ({
  number, title: `PR ${number}`, url: `https://github.com/x/pull/${number}`, branch: `update/pr-${number}`, draft: false, state: 'open', merged: false, mergeCommit: null, createdAt: '2026-10-17T00:00:00Z',
  previewUrl: previewUrl(`update/pr-${number}`), mergeable: true, mergeableState: 'clean', resumeScore: resumeScoreFromBody(body), request: updateRequestFromBody(body), ...extra,
})
const run = (id: number, extra: Partial<WorkflowRun> = {}): WorkflowRun => ({ id, status: 'completed', conclusion: 'success', createdAt: new Date(now).toISOString(), url: `https://github.com/x/runs/${id}`, branch: 'main', title: `Run ${id}`, ...extra })

type Options = { runs?: WorkflowRun[]; pulls?: PullRequest[]; single?: (number: number, calls: number) => PullRequest | null; merge?: () => Promise<{ merged: boolean; message: string; sha?: string }>; branchDeleted?: boolean; findsRun?: boolean }
const fakeGitHub = (options: Options = {}) => {
  const calls = { dispatched: [] as Record<string, string>[], merged: [] as number[], closed: [] as number[], single: 0 }
  const runs = options.runs ?? []
  const pulls = options.pulls ?? []
  const github: GitHub = {
    repo: 'stewils/stevenwilssens.com',
    dispatch: async (_workflow, _ref, inputs) => { calls.dispatched.push(inputs); if (options.findsRun !== false) runs.unshift(run(100 + calls.dispatched.length, { status: 'queued', conclusion: null, title: inputs.title })) },
    runs: async (_workflow, limit) => runs.slice(0, limit),
    run: async (id) => runs.find((item) => item.id === id) ?? null,
    pulls: async (state = 'open') => pulls.filter((item) => state === 'all' || item.state === state),
    pull: async (number) => { calls.single++; return options.single ? options.single(number, calls.single) : pulls.find((item) => item.number === number) ?? null },
    merge: async (number) => { calls.merged.push(number); return options.merge ? options.merge() : { merged: true, message: 'merged', sha: 'abc' } },
    close: async (number) => { calls.closed.push(number); return { closed: true, branchDeleted: options.branchDeleted ?? true } },
    mergedPulls: async () => 0,
    allPulls: async () => pulls,
  }
  return { github, calls, runs, pulls }
}

describe('argument checks', () => {
  it('refuses wrong types, unknown roles, bad topics and visibilities', async () => {
    const store = new MemoryStore()
    expect((await call(store, 'save_entry', { role: 'general', topic: 'now', title: 5, body: 'b' })).text).toBe('title must be a string')
    expect((await call(store, 'save_entry', { role: 'general', topic: 'now', title: '   ', body: 'b' })).text).toBe('title is required')
    expect((await call(store, 'save_entry', { role: 'ceo', topic: 'now', title: 't', body: 'b' })).text).toMatch(/^unknown role "ceo"/)
    expect((await call(store, 'save_entry', { role: 'general', topic: 'Not a slug!', title: 't', body: 'b' })).text).toMatch(/^topic must be a short slug/)
    expect((await call(store, 'save_entry', { role: 'general', topic: 'now', title: 't', body: 'b', visibility: 'secret' })).text).toBe('visibility must be "public" or "private"')
    expect((await call(store, 'list_entries', { limit: 'many' })).isError).toBe(false)
    expect((await call(store, 'dismiss_site_question', { id: 'abc' })).text).toBe('id must be a number')
  })

  it('updates only what is given, and refuses an empty change or an unknown entry', async () => {
    const store = new MemoryStore()
    const saved = await store.insert({ role: 'general', topic: 'now', title: 'Old', body: 'Body', visibility: 'private', tags: 'a' }, 1)
    expect((await call(store, 'update_entry', { id: saved.id })).text).toBe('nothing to change')
    expect((await call(store, 'update_entry', { id: 99, title: 'x' })).text).toBe('no entry with id 99')
    const updated = await call(store, 'update_entry', { id: saved.id, role: latest.key, topic: 'scope', title: 'New', body: 'New body', visibility: 'public', tags: '' })
    expect(updated.json!.updated).toMatchObject({ role: latest.key, topic: 'scope', title: 'New', body: 'New body', visibility: 'public', tags: null })
  })

  it('dismisses only open questions', async () => {
    const store = new MemoryStore()
    store.gaps.push({ id: 3, question: 'Spam', when: '2026-10-16', reason: 'gap', page: null, answer: null })
    expect((await call(store, 'dismiss_site_question', { id: 4 })).text).toBe('no open question with id 4')
    expect((await call(store, 'dismiss_site_question', { id: 3 })).json).toEqual({ dismissed: { id: 3, question: 'Spam', reason: null } })
  })
})

describe('what is already there', () => {
  it('counts one waiting question in the singular, and topics outside the usual list', async () => {
    const store = new MemoryStore()
    store.gaps.push({ id: 1, question: 'q', when: '2026-10-16', reason: 'gap', page: null, answer: null })
    expect((await call(store, 'about_steven')).json!.waitingFromTheSite).toMatch(/^1 question from the site/)
    await store.insert({ role: latest.key, topic: 'hobbies', title: 't', body: 'b', visibility: 'private', tags: null }, 1)
    const status = await call(store, 'interview_status')
    const role = (status.json!.roles as { key: string; byTopic: Record<string, number> }[]).find((item) => item.key === latest.key)!
    expect(role.byTopic.hobbies).toBe(1)
  })

  it('exports roles with and without a company and dates', async () => {
    const store = new MemoryStore()
    await store.insert({ role: 'general', topic: 'now', title: 'Building', body: 'AI.', visibility: 'public', tags: null }, 1)
    await store.insert({ role: latest.key, topic: 'scope', title: 'Team', body: '12 PMs.', visibility: 'private', tags: null }, 1)
    const exported = await call(store, 'export_dossier')
    expect(exported.text).toContain('## Across roles')
    expect(exported.text).toContain(`## ${latest.role}, ${latest.company} (${latest.dates})`)
  })

  it('reads the recruiter lens of a role without dates, and of no role', () => {
    expect(recruiterLens('nobody')).toEqual({ flags: [], angles: [] })
    expect(recruiterLens('general').angles.length).toBeGreaterThan(0)
  })
})

describe('proposals', () => {
  const propose = (store: MemoryStore, args: Record<string, unknown>) => call(store, 'propose_resume_change', { rationale: 'why', ...args })

  it('refuses an unknown role, kind or field and the wrong kind for a field', async () => {
    const store = new MemoryStore()
    expect((await propose(store, { role: 'ceo', kind: 'replace' })).text).toMatch(/^unknown role "ceo"/)
    expect((await propose(store, { role: latest.key, kind: 'rewrite' })).text).toBe('kind must be replace, add or remove')
    expect((await propose(store, { role: latest.key, kind: 'replace', field: 'salary' })).text).toMatch(/^field must be one of/)
    expect((await propose(store, { role: 'new-role', kind: 'replace', field: 'role' })).text).toMatch(/^to add a role: role "new-role"/)
    expect((await propose(store, { role: latest.key, kind: 'add', field: 'role', proposed_text: '{}' })).text).toMatch(/^to add a role, set role to "new-role"/)
    expect((await propose(store, { role: latest.key, kind: 'add', field: 'title', proposed_text: 'x' })).text).toMatch(/^title can only be replaced/)
  })

  it('checks the current value of a field and the date format', async () => {
    const store = new MemoryStore()
    expect((await propose(store, { role: latest.key, kind: 'replace', field: 'dates', current_text: latest.dates, proposed_text: '2024 to 2026' })).text).toMatch(/^dates must be written like/)
    for (const [field, actual] of [['title', latest.role], ['company', latest.company], ['location', latest.location], ['summary', latest.summary]] as const) {
      expect((await propose(store, { role: latest.key, kind: 'replace', field, current_text: 'wrong', proposed_text: 'x' })).text).toBe(`current_text does not match the résumé: the ${field} of ${latest.role} is "${actual}"`)
    }
    const ok = await propose(store, { role: latest.key, kind: 'replace', field: 'location', current_text: latest.location, proposed_text: 'Seattle, WA' })
    expect(ok.json!.proposed).toMatchObject({ field: 'location', currentText: latest.location })
  })

  it('validates a whole role as JSON', async () => {
    const store = new MemoryStore()
    const add = (proposed_text: string) => propose(store, { role: 'new-role', kind: 'add', proposed_text })
    expect((await add('nope')).text).toMatch(/must be JSON/)
    expect((await add('[1]')).text).toMatch(/must be a JSON object/)
    expect((await add('{"role":"r","company":"c","dates":"Dec 2024 - Sep 2026","location":"l"}')).text).toBe('the role needs a non-empty "summary"')
    expect((await add('{"role":"r","company":"c","dates":"2024","location":"l","summary":"s"}')).text).toMatch(/^dates must be written like/)
    const removed = await propose(store, { role: latest.key, kind: 'remove', field: 'role' })
    expect(removed.json!.next).toMatch(/role to remove/)
    expect(JSON.parse((removed.json!.proposed as { currentText: string }).currentText)).toMatchObject({ role: latest.role })
  })

  it('refuses a key achievement that does not exist, has no backing, or is not JSON', async () => {
    const store = new MemoryStore()
    const live = { value: impact[0].value, label: impact[0].label, backing: impact[0].backing }
    expect((await propose(store, { role: 'achievements', kind: 'replace', current_text: '{"value":"1","label":"nothing"}', proposed_text: JSON.stringify(live) })).text).toMatch(/^current_text does not match a key achievement/)
    expect((await propose(store, { role: 'achievements', kind: 'add', proposed_text: '{"value":"1","label":"x"}' })).text).toMatch(/^a key achievement needs "backing"/)
    expect((await propose(store, { role: 'achievements', kind: 'add', proposed_text: 'oops' })).text).toMatch(/must be JSON/)
    const removed = await propose(store, { role: 'achievements', kind: 'remove', current_text: JSON.stringify({ value: live.value, label: live.label }) })
    expect(removed.isError).toBe(false)
  })

  it('lists by a known status only, and records decisions on known proposals', async () => {
    const store = new MemoryStore()
    expect((await call(store, 'list_resume_proposals', { status: 'pending' })).text).toBe('status must be proposed, approved, rejected or applied')
    expect((await call(store, 'review_resume_proposal', { id: 1, decision: 'maybe' })).text).toBe('decision must be approve, reject or applied')
    expect((await call(store, 'review_resume_proposal', { id: 9, decision: 'approve' })).text).toBe('no proposal with id 9')
    await store.insertProposal({ role: 'headline', field: null, kind: 'replace', currentText: 'a', proposedText: 'b', rationale: 'r', basedOn: null }, 1)
    expect((await call(store, 'review_resume_proposal', { id: 1, decision: 'applied' })).json!.reviewed).toMatchObject({ status: 'applied' })
    expect((await call(store, 'review_resume_proposal', { id: 1, decision: 'reject' })).json!.reviewed).toMatchObject({ status: 'rejected' })
  })

  it('names one proposal found live in the singular', async () => {
    const store = new MemoryStore()
    await store.insertProposal({ role: latest.key, field: 'title', kind: 'replace', currentText: 'x', proposedText: latest.role, rationale: 'r', basedOn: null }, 1)
    await store.decideProposal(1, 'approved', null, 2)
    expect((await call(store, 'list_resume_proposals')).json!.markedAppliedNote).toMatch(/^1 approved proposal is live/)
  })
})

describe('the résumé report and LinkedIn', () => {
  it('says when there is no report or an unreadable one', async () => {
    const store = new MemoryStore()
    expect((await call(store, 'check_resume')).text).toMatch(/^No resume report in this deployment yet/)
    expect((await call(store, 'check_resume', {}, { pages: { '/resume-report.json': '<html>' } })).text).toMatch(/^No resume report/)
  })

  it('refuses input with nothing recognisable, and a comparison before any import', async () => {
    const store = new MemoryStore()
    expect((await call(store, 'save_linkedin_profile', { text: 'hello' })).text).toMatch(/^Nothing recognisable/)
    expect((await call(store, 'compare_linkedin')).text).toMatch(/^LinkedIn has not been imported/)
  })

  it('imports CSV with a long About, and compares an import without headline or location', async () => {
    const store = new MemoryStore()
    const imported = await call(store, 'save_linkedin_profile', { profile_csv: `First Name,Last Name,Headline,Summary\nSteven,Wilssens,Leader,"${'a'.repeat(250)}"\n`, skills_csv: 'Name\nSQL\n', education_csv: 'School Name\nKdG\n', languages_csv: 'Name\nDutch\n' })
    expect((imported.json!.imported as { about: string }).about.endsWith('…')).toBe(true)
    const positionsOnly = new MemoryStore()
    await call(positionsOnly, 'save_linkedin_profile', { positions_csv: 'Company Name,Title,Started On,Finished On\nMicrosoft,PM,Jan 2020,\n' })
    const compared = await call(positionsOnly, 'compare_linkedin')
    expect(compared.json!.linkedin).toMatchObject({ headline: null, location: null })
  })
})

describe('site updates', () => {
  const approved = async (store: MemoryStore, status: 'proposed' | 'approved' | 'rejected' | 'applied', note: string | null = null) => {
    const proposal = await store.insertProposal({ role: 'headline', field: null, kind: 'replace', currentText: 'a', proposedText: 'b', rationale: 'r', basedOn: null }, 1)
    if (status !== 'proposed') await store.decideProposal(proposal.id, status, note, 2)
    return proposal.id
  }

  it('refuses proposals that are not approved, and an update with nothing to do', async () => {
    const store = new MemoryStore()
    const { github } = fakeGitHub()
    const proposed = await approved(store, 'proposed')
    const rejected = await approved(store, 'rejected')
    const applied = await approved(store, 'applied')
    const appliedNoNote = await approved(store, 'applied')
    store.proposals[appliedNoNote - 1].decisionNote = null
    expect((await call(store, 'request_site_update', { title: 't', proposals: [99] }, { github })).text).toBe('no proposal with id 99')
    expect((await call(store, 'request_site_update', { title: 't', proposals: [proposed] }, { github })).text).toMatch(/is not approved yet/)
    expect((await call(store, 'request_site_update', { title: 't', proposals: `${rejected}` }, { github })).text).toMatch(/was rejected/)
    expect((await call(store, 'request_site_update', { title: 't', proposals: applied }, { github })).text).toMatch(/is already applied \(null\)|is already applied \(on the site\)/)
    expect((await call(store, 'request_site_update', { title: 't', proposals: ['x'] }, { github })).text).toBe('proposals must be proposal ids')
    expect((await call(store, 'request_site_update', { title: 't' }, { github })).text).toMatch(/^Give an instruction/)
    expect((await call(store, 'request_site_update', { title: 't', instruction: 'x'.repeat(12_000), proposals: [] }, { github })).isError).toBe(false)
  })

  it('refuses a brief too long for one run', async () => {
    const store = new MemoryStore()
    for (let i = 0; i < 20; i++) {
      const p = await store.insertProposal({ role: 'headline', field: null, kind: 'replace', currentText: 'c'.repeat(4000), proposedText: 'p'.repeat(4000), rationale: 'r'.repeat(2000), basedOn: null }, 1)
      await store.decideProposal(p.id, 'approved', null, 2)
    }
    const { github } = fakeGitHub()
    expect((await call(store, 'request_site_update', { title: 't', proposals: store.proposals.map((p) => p.id) }, { github })).text).toMatch(/^The brief is too long/)
  })

  it('redoes a pull request: refuses an unknown, merged or unmarked one, and carries the old request', async () => {
    const store = new MemoryStore()
    const marked = pull(5, {}, encodeUpdateRequest({ title: 'Old title', instruction: 'Old instruction', proposals: [3], supersedes: null }))
    const { github, calls } = fakeGitHub({ pulls: [marked, pull(6, { merged: true, state: 'closed' }), pull(8)], findsRun: false })
    expect((await call(store, 'request_site_update', { redo: 4 }, { github })).text).toBe('no pull request #4')
    expect((await call(store, 'request_site_update', { redo: 6 }, { github })).text).toMatch(/already merged/)
    expect((await call(store, 'request_site_update', { redo: 8 }, { github })).text).toMatch(/predates the request marker/)
    const redone = await call(store, 'request_site_update', { redo: 5 }, { github })
    expect(redone.json).toMatchObject({ run: null, proposals: [3], supersedes: { number: 5 } })
    expect(redone.json!.next).not.toContain('run_id')
    expect(calls.dispatched[0]).toEqual({ title: 'Old title', instruction: 'Old instruction', proposals: '3', supersedes: '5' })
  })

  it('waits: refuses an unknown run, reports a failed run, a run without a pull request, and one still running', async () => {
    const store = new MemoryStore()
    expect((await call(store, 'wait_for_site_update', {}, { github: fakeGitHub().github })).text).toBe('no Site update run yet')
    expect((await call(store, 'wait_for_site_update', { run_id: 9 }, { github: fakeGitHub().github })).text).toBe('no run with id 9')
    const failed = fakeGitHub({ runs: [run(1, { conclusion: 'failure', branch: 'update/x' })] })
    expect((await call(store, 'wait_for_site_update', {}, { github: failed.github })).json).toMatchObject({ done: true, pullRequest: null, next: expect.stringContaining('ended with "failure"') })
    const nothing = fakeGitHub({ runs: [run(2, { branch: 'update/y' })] })
    expect((await call(store, 'wait_for_site_update', { run_id: 2 }, { github: nothing.github })).json!.next).toMatch(/^The run finished without a pull request/)
    const running = fakeGitHub({ runs: [run(3, { status: 'in_progress', conclusion: null })] })
    expect((await call(store, 'wait_for_site_update', { seconds: 5 }, { github: running.github })).json).toMatchObject({ done: false })
  })

  it('waits and reports a pull request that lowers the score and conflicts, falling back to the listed one', async () => {
    const store = new MemoryStore()
    const lowering = pull(12, { branch: 'update/z', mergeable: false, mergeableState: 'dirty' }, '<!-- resume-score before=90 after=80 -->')
    const { github } = fakeGitHub({ runs: [run(4, { branch: 'update/z' })], pulls: [lowering], single: () => null })
    const waited = await call(store, 'wait_for_site_update', {}, { github })
    expect(waited.json).toMatchObject({ done: true, warning: expect.stringContaining('#12 lowers the resume score from 90 to 80'), mergeTrouble: expect.stringContaining('conflicts with main') })
  })

  it('lists one open pull request without a tip, falling back to the listed one', async () => {
    const store = new MemoryStore()
    const { github } = fakeGitHub({ pulls: [pull(13, { mergeableState: 'blocked', mergeable: true })], single: () => null })
    const status = await call(store, 'site_update_status', {}, { github })
    expect(status.json).not.toHaveProperty('tip')
    expect(status.json!.conflicts).toEqual([expect.stringContaining('blocked by the repository')])
    expect((status.json!.pullRequests as { proposals: unknown[]; supersedes: unknown }[])[0]).toMatchObject({ proposals: [], supersedes: null })
  })

  it('merges only what exists and is open, and waits once for GitHub to compute mergeability', async () => {
    const store = new MemoryStore()
    expect((await call(store, 'merge_site_update', { number: 1, confirm: true }, { github: fakeGitHub().github })).text).toBe('no pull request #1')
    const closed = fakeGitHub({ pulls: [pull(2, { state: 'closed' }), pull(3, { state: 'closed', merged: true })] })
    expect((await call(store, 'merge_site_update', { number: 2, confirm: 'true' }, { github: closed.github })).text).toMatch(/^#2 is closed\. Redo it/)
    expect((await call(store, 'merge_site_update', { number: 3, confirm: true }, { github: closed.github })).text).toBe('#3 is already merged.')
    const unknown = pull(4, { mergeable: null, mergeableState: 'unknown' })
    const settling = fakeGitHub({ single: (_number, count) => (count === 1 ? unknown : { ...unknown, mergeable: true, mergeableState: 'clean' }) })
    const merged = await call(store, 'merge_site_update', { number: 4, confirm: true }, { github: settling.github })
    expect(merged.json).toMatchObject({ merged: true })
    expect(merged.json).not.toHaveProperty('proposalsApplied')
    expect(settling.calls.single).toBe(2)
    const gone = fakeGitHub({ single: (_number, count) => (count === 1 ? unknown : null) })
    expect((await call(store, 'merge_site_update', { number: 4, confirm: true }, { github: gone.github })).json).toMatchObject({ merged: true })
  })

  it('explains GitHub refusing the merge: a conflict, a moving branch, anything else, and a merge that did not happen', async () => {
    const store = new MemoryStore()
    const refusing = (message: string) => fakeGitHub({ pulls: [pull(5)], merge: () => Promise.reject(new Error(message)) }).github
    expect((await call(store, 'merge_site_update', { number: 5, confirm: true }, { github: refusing('GitHub 405: Pull Request is not mergeable') })).text).toMatch(/conflicts with main.*To redo it now, call merge_site_update again with redo: true\.$/)
    expect((await call(store, 'merge_site_update', { number: 5, confirm: true }, { github: refusing('GitHub 409: Head branch was modified') })).text).toMatch(/^GitHub says the branch changed while merging/)
    expect((await call(store, 'merge_site_update', { number: 5, confirm: true }, { github: refusing('GitHub 403: forbidden') })).text).toBe('GitHub refused the merge: GitHub 403: forbidden')
    const notMerged = fakeGitHub({ pulls: [pull(5, {}, encodeUpdateRequest({ title: 't', instruction: 'i', proposals: [1], supersedes: null }))], merge: async () => ({ merged: false, message: 'Base branch was modified' }) })
    const result = await call(store, 'merge_site_update', { number: 5, confirm: true }, { github: notMerged.github })
    expect(result.json).toMatchObject({ merged: false, message: 'Base branch was modified' })
    expect(result.json).not.toHaveProperty('proposalsApplied')
  })

  it('redoes a conflicted pull request only when it carries its request', async () => {
    const store = new MemoryStore()
    const old = fakeGitHub({ pulls: [pull(6, { mergeable: false, mergeableState: 'dirty' })] })
    expect((await call(store, 'merge_site_update', { number: 6, confirm: true, redo: true }, { github: old.github })).text).toMatch(/cannot be redone automatically/)
    const marked = fakeGitHub({ pulls: [pull(7, { mergeable: false }, encodeUpdateRequest({ title: 'Title', instruction: 'Do it', proposals: [], supersedes: null }))], findsRun: false })
    const redone = await call(store, 'merge_site_update', { number: 7, confirm: true, redo: 'true' }, { github: marked.github })
    expect(redone.json).toMatchObject({ merged: false, redone: true, run: null, supersedes: { number: 7 } })
    expect(marked.calls.dispatched[0]).toEqual({ title: 'Title', instruction: 'Do it', supersedes: '7' })
  })

  it('closes: refuses an unknown or merged pull request, and reports one already closed', async () => {
    const store = new MemoryStore()
    const { github, calls } = fakeGitHub({ pulls: [pull(1, { merged: true, state: 'closed' }), pull(2, { state: 'closed' }), pull(3)], branchDeleted: false })
    expect((await call(store, 'close_site_update', { number: 9, reason: 'x' }, { github })).text).toBe('no pull request #9')
    expect((await call(store, 'close_site_update', { number: 1, reason: 'x' }, { github })).text).toMatch(/already merged; it cannot be closed/)
    expect((await call(store, 'close_site_update', { number: 2, reason: 'x' }, { github })).json).toMatchObject({ closed: true, alreadyClosed: true })
    const closed = await call(store, 'close_site_update', { number: 3, reason: 'Superseded' }, { github })
    expect(closed.json).toMatchObject({ closed: true, branchDeleted: false, proposals: [] })
    expect(closed.json!.note).not.toMatch(/^Proposals/)
    expect(calls.closed).toEqual([3])
  })

  it('has no analytics on a server without a database', async () => {
    expect((await call(new MemoryStore(), 'site_analytics')).text).toBe('Analytics are not available on this server.')
  })
})
