// The recruiter's-seat tools, the site-update tools and the analytics tool, through the MCP transport.
import { describe, expect, it } from 'vitest'
import type { GitHub, PullRequest, WorkflowRun } from '../github'
import { encodeUpdateRequest, previewUrl, resumeScoreFromBody, updateRequestFromBody } from '../github'
import { experiences, impact, profile } from '../../../src/resume'
import type { TrafficSummary } from '../traffic'
import { handleMcp } from './server'
import { MemoryStore } from './store'

const url = 'https://steven.wilssens.com/mcp/owner-key-123'
const report = { exists: true, score: 85, pages: 2, errors: 0, warnings: 3, matchesSite: true, findings: [{ severity: 'warn', id: 'keyword-a/b', message: 'Keyword missing: "a/b".' }], questions: [{ about: 'impact', question: 'Which role?' }] }
const pages: Record<string, string> = { '/index.md': '# Steven Wilssens\n\nPrincipal product leader for data and AI.', '/about.md': '# About', '/experience.md': '# Experience', '/work.md': '# Selected work', '/recommendations.md': '# Recommendations', '/resume-report.json': JSON.stringify(report) }
const now = Date.UTC(2026, 9, 17)

const pull = (number: number, title: string, branch: string, body: string, extra: Partial<PullRequest> = {}): PullRequest => ({
  number, title, url: `https://github.com/x/pull/${number}`, branch, draft: false, state: 'open', merged: false, createdAt: '2026-10-17T00:00:00Z', previewUrl: previewUrl(branch),
  mergeable: true, mergeableState: 'clean', resumeScore: resumeScoreFromBody(body), request: updateRequestFromBody(body), ...extra,
})
const pullSeven = pull(7, 'Team size', 'update/team-size-1', '**Instruction**\n\nSay the team was 10 to 20 PMs.\n\n**Resume score:** 90 → 90, unchanged\n<!-- resume-score before=90 after=90 -->')
// Pull request 9 was opened by a run whose resume scores worse than the one on main.
const pullNine = pull(9, 'Shorter bullets', 'update/shorter-bullets-2', '**Instruction**\n\nShorten.\n\n**Resume score:** 90 → 80, lower than on main\n<!-- resume-score before=90 after=80 -->')
// Pull request 11 carries two proposals and conflicts with main because 7 merged first.
const pullEleven = pull(11, 'Two bullets', 'update/two-bullets-3', `**Instruction**\n\nApply.\n\n**Resume score:** 90 → 92\n<!-- resume-score before=90 after=92 -->\n${encodeUpdateRequest({ title: 'Two bullets', instruction: 'Apply the proposals.', proposals: [1, 2], supersedes: null })}`, { mergeable: false, mergeableState: 'dirty' })

type Fake = { github: GitHub; calls: { dispatched: Record<string, unknown>[]; merged: number[]; closed: { number: number; comment: string }[] }; runs: WorkflowRun[]; pulls: PullRequest[] }
const fakeGitHub = (options: { mergeError?: string } = {}): Fake => {
  const calls: Fake['calls'] = { dispatched: [], merged: [], closed: [] }
  const runs: WorkflowRun[] = [{ id: 1, status: 'completed', conclusion: 'success', createdAt: '2026-10-17T00:00:00Z', url: 'https://github.com/x/runs/1', branch: 'update/team-size-1', title: 'Team size' }]
  const pulls: PullRequest[] = [pullSeven, pullNine, pullEleven]
  const github: GitHub = {
    repo: 'stewils/stevenwilssens.com',
    dispatch: async (workflow, ref, inputs) => {
      calls.dispatched.push({ workflow, ref, inputs })
      // The workflow names its run after the title, so the MCP server can find it.
      runs.unshift({ id: runs.length + 1, status: 'queued', conclusion: null, createdAt: new Date(now).toISOString(), url: `https://github.com/x/runs/${runs.length + 1}`, branch: 'main', title: inputs.title })
    },
    runs: async (_workflow, limit) => runs.slice(0, limit),
    run: async (id) => runs.find((run) => run.id === id) ?? null,
    pulls: async (state = 'open') => pulls.filter((item) => state === 'all' || item.state === state),
    pull: async (number) => pulls.find((item) => item.number === number) ?? null,
    merge: async (number) => { if (options.mergeError) throw new Error(options.mergeError); calls.merged.push(number); return { merged: true, message: 'Pull Request successfully merged', sha: 'abc' } },
    close: async (number, comment) => { calls.closed.push({ number, comment }); const item = pulls.find((p) => p.number === number)!; item.state = 'closed'; return { closed: true, branchDeleted: true } },
  }
  return { github, calls, runs, pulls }
}

const traffic: TrafficSummary = {
  days: 30, from: '2026-09-17', to: '2026-10-17',
  people: { visitors: 120, pageviews: 300, previousVisitors: 100, previousPageviews: 250, resumeDownloads: 12, contactClicks: 4, avgSecondsOnPage: 48, avgScrollPct: 61 },
  daily: [{ day: '2026-10-16', visitors: 5, pageviews: 9, crawlerRequests: 40, aiRequests: 22 }],
  topPages: [{ path: '/', views: 150, visitors: 100 }, { path: '/experience', views: 60, visitors: 50 }],
  referrers: [{ name: 'linkedin.com', visitors: 40 }], channels: [{ name: 'LinkedIn', visitors: 40, detail: '' }, { name: 'Direct', visitors: 70, detail: '' }],
  countries: [{ name: 'US', visitors: 90 }], organizations: [{ name: 'Microsoft', visitors: 8 }],
  crawlers: { requests: 900, bots: 14, byCategory: { search: 300, aiSearch: 100, aiTraining: 350, aiAssistant: 50, social: 40, seo: 30, other: 30 }, topBots: [{ bot: 'GPTBot', operator: 'OpenAI', category: 'ai-training', requests: 200, pages: 12, lastSeen: '2026-10-17' }], topPages: [{ path: '/', requests: 300, aiRequests: 150 }] },
  assistant: { questions: 20, answered: 15, gaps: 5, helpful: 6, unhelpful: 1 },
  publicMcp: { calls: 9, byTool: [{ tool: 'about_steven', calls: 9 }] },
}

const call = async (store: MemoryStore, name: string, args: Record<string, unknown> = {}, github: GitHub | null = null, mode: 'owner' | 'public' = 'owner') => {
  const request = new Request(mode === 'owner' ? url : 'https://steven.wilssens.com/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) })
  const response = await handleMcp({ request, store, github, mode, traffic: async () => traffic, sleep: async () => {}, fetchPage: async (path) => pages[path] ?? null, now })
  const body = await response.json() as { result?: { content: { text: string }[]; isError: boolean }; error?: { code: number } }
  if (!body.result) return { isError: true, text: '', json: null, code: body.error?.code }
  const text = body.result.content[0].text
  return { isError: body.result.isError, text, json: body.result.isError ? null : JSON.parse(text) as Record<string, unknown>, code: undefined }
}

describe('the recruiter\'s seat', () => {
  it('reviews the site, the resume report and the LinkedIn import together', async () => {
    const store = new MemoryStore()
    const before = await call(store, 'review_for_recruiters')
    expect(before.isError).toBe(false)
    const findings = before.json!.findings as { area: string }[]
    expect(findings.map((f) => f.area)).toContain('linkedin')
    expect(findings.map((f) => f.area)).toContain('resume:keyword-a/b')
    expect(findings.map((f) => f.area)).not.toContain('resume')
    expect((before.json!.questions as unknown[]).length).toBeGreaterThan(0)
    expect(before.json!.howToUse).toMatch(/request_site_update/)

    const imported = await call(store, 'save_linkedin_profile', { positions_csv: 'Company Name,Title,Description,Location,Started On,Finished On\nMicrosoft,Principal Group Product Manager,,Redmond,Dec 2024,Sep 2026\n', profile_csv: 'First Name,Last Name,Headline,Summary,Geo Location\nSteven,Wilssens,Product Leader,Short.,"Redmond, Washington"\n' })
    expect(imported.isError).toBe(false)
    expect((imported.json!.imported as { positions: string[] }).positions).toEqual(['Principal Group Product Manager · Microsoft · Dec 2024 - Sep 2026'])

    const compared = await call(store, 'compare_linkedin')
    expect(compared.isError).toBe(false)
    const fixes = compared.json!.fixes as { area: string; paste: string; why: string }[]
    expect(fixes.find((f) => f.area === 'headline')!.paste).toContain(profile.resumeHeadline)
    expect(fixes.some((f) => f.area === 'position:csx-data')).toBe(true)
    expect((compared.json!.recommendedTexts as { about: string }).about).toContain(profile.summary)

    const after = await call(store, 'review_for_recruiters')
    expect((after.json!.findings as { area: string }[]).some((f) => f.area === 'linkedin:headline')).toBe(true)
  })

  it('serves the resume report and refuses an empty LinkedIn import', async () => {
    const store = new MemoryStore()
    const resume = await call(store, 'check_resume')
    expect(resume.json!.score).toBe(85)
    expect(resume.json!.howTheResumeIsBuilt).toMatch(/resume:build/)
    expect((await call(store, 'compare_linkedin')).text).toMatch(/has not been imported/)
    expect((await call(store, 'save_linkedin_profile', { text: 'nothing useful here' })).isError).toBe(true)
    expect((await call(store, 'save_linkedin_profile', {})).isError).toBe(true)
  })

  it('parses the Save to PDF text through the tool', async () => {
    const store = new MemoryStore()
    const imported = await call(store, 'save_linkedin_profile', { text: 'Steven Wilssens\nProduct Leader\nSeattle, Washington\n\nExperience\n\nMicrosoft\nPrincipal Group Product Manager\nDecember 2024 - September 2026 (1 year 10 months)\n\nEducation\nKarel de Grote\n' })
    expect(imported.isError).toBe(false)
    expect((imported.json!.imported as { heuristic: boolean }).heuristic).toBe(true)
    expect(imported.json!.next).toMatch(/ask whether titles/)
  })
})

describe('site updates', () => {
  it('explains what to configure when there is no GitHub token', async () => {
    const store = new MemoryStore()
    const result = await call(store, 'request_site_update', { title: 'x', instruction: 'y' })
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/GITHUB_TOKEN/)
    expect((await call(store, 'site_update_status')).isError).toBe(true)
    expect((await call(store, 'wait_for_site_update')).isError).toBe(true)
    expect((await call(store, 'close_site_update', { number: 1, reason: 'x' })).isError).toBe(true)
  })

  it('starts the workflow, finds its run, reports runs and pull requests with previews, and merges only when confirmed', async () => {
    const store = new MemoryStore()
    const { github, calls } = fakeGitHub()
    const started = await call(store, 'request_site_update', { title: 'Team size on the Group PM role', instruction: 'Say the team was 10 to 20 PMs.' }, github)
    expect(started.isError).toBe(false)
    expect(calls.dispatched).toEqual([{ workflow: 'site-update.yml', ref: 'main', inputs: { title: 'Team size on the Group PM role', instruction: 'Say the team was 10 to 20 PMs.' } }])
    expect((started.json!.run as { id: number; title: string }).title).toBe('Team size on the Group PM role')
    expect(started.json!.next).toMatch(/wait_for_site_update \(run_id 2\)/)
    expect(started.json!.next).toMatch(/goes live only when he merges/)

    const status = await call(store, 'site_update_status', {}, github)
    const pulls = status.json!.pullRequests as { number: number; previewUrl: string; mergeTrouble: string | null; proposals: number[] }[]
    expect(pulls[0].previewUrl).toBe('https://update-team-size-1.stevenwilssens.pages.dev')
    expect(pulls[0].mergeTrouble).toBeNull()
    expect(pulls[2]).toMatchObject({ number: 11, proposals: [1, 2] })
    expect(pulls[2].mergeTrouble).toMatch(/conflicts with main/)
    expect(status.json!.warning).toMatch(/#9 lowers the resume score from 90 to 80/)
    expect(status.json!.tip).toMatch(/regenerates the same résumé file/)

    const refused = await call(store, 'merge_site_update', { number: 7, confirm: false }, github)
    expect(refused.isError).toBe(true)
    expect(calls.merged).toEqual([])
    const missing = await call(store, 'merge_site_update', { number: 8, confirm: true }, github)
    expect(missing.isError).toBe(true)
    const merged = await call(store, 'merge_site_update', { number: 7, confirm: true }, github)
    expect(merged.isError).toBe(false)
    expect(calls.merged).toEqual([7])
    expect(merged.json!.merged).toBe(true)
  })

  it('warns before merging a pull request that lowers the resume score, and merges once Steven accepts', async () => {
    const store = new MemoryStore()
    const { github, calls } = fakeGitHub()
    const warned = await call(store, 'merge_site_update', { number: 9, confirm: true }, github)
    expect(warned.isError).toBe(true)
    expect(warned.text).toMatch(/lowers the resume score from 90 to 80/)
    expect(warned.text).toMatch(/acceptLowerScore/)
    expect(calls.merged).toEqual([])
    const accepted = await call(store, 'merge_site_update', { number: 9, confirm: true, acceptLowerScore: true }, github)
    expect(accepted.isError).toBe(false)
    expect(calls.merged).toEqual([9])
  })

  it('carries several approved proposals in one update, writes the brief from them, and marks them applied on merge', async () => {
    const store = new MemoryStore()
    const bullet = experiences[1].points[0]
    await store.insertProposal({ role: experiences[1].key, field: 'point', kind: 'replace', currentText: bullet, proposedText: 'Led a PM organization of 12.', rationale: 'Exact number.', basedOn: '3' }, now)
    await store.insertProposal({ role: 'headline', field: null, kind: 'replace', currentText: profile.resumeHeadline, proposedText: 'Product leader for data and AI', rationale: 'Shorter.', basedOn: null }, now)
    await store.insertProposal({ role: 'skills', field: null, kind: 'add', currentText: null, proposedText: 'Spatial audio', rationale: 'Keyword.', basedOn: null }, now)
    await store.decideProposal(1, 'approved', 'Keep "organization".', now)
    await store.decideProposal(2, 'approved', null, now)
    const { github, calls, pulls } = fakeGitHub()

    expect((await call(store, 'request_site_update', { title: 'Batch', proposals: [1, 3] }, github)).text).toMatch(/proposal 3 is not approved yet/)
    expect((await call(store, 'request_site_update', { title: 'Batch', proposals: [1, 99] }, github)).text).toMatch(/no proposal with id 99/)
    expect((await call(store, 'request_site_update', { title: 'Batch' }, github)).text).toMatch(/Give an instruction/)
    const started = await call(store, 'request_site_update', { title: 'Batch', proposals: [1, 2], instruction: 'Also fix the typo on /about.' }, github)
    expect(started.isError).toBe(false)
    expect(started.json!.proposals).toEqual([1, 2])
    const inputs = calls.dispatched[0].inputs as Record<string, string>
    expect(inputs.proposals).toBe('1,2')
    expect(inputs.instruction).toMatch(/^Also fix the typo on \/about\.\n\nApply these approved résumé proposals/)
    expect(inputs.instruction).toContain(`Proposal #1: replace in the role "${experiences[1].role}" at ${experiences[1].company} (key ${experiences[1].key}), a bullet point.`)
    expect(inputs.instruction).toContain(`Current text: ${bullet}`)
    expect(inputs.instruction).toContain('New text: Led a PM organization of 12.')
    expect(inputs.instruction).toContain('Steven\'s note when approving: Keep "organization".')
    expect(inputs.instruction).toContain('Proposal #2: replace in the headline section.')

    // The workflow put the request into the pull request; merging it applies the proposals.
    pulls.push(pull(12, 'Batch', 'update/batch-4', `**Instruction**\n\nx\n\n**Resume score:** 90 → 90\n<!-- resume-score before=90 after=90 -->\n${encodeUpdateRequest({ title: 'Batch', instruction: inputs.instruction, proposals: [1, 2], supersedes: null })}`))
    const merged = await call(store, 'merge_site_update', { number: 12, confirm: true }, github)
    expect(merged.isError).toBe(false)
    expect(merged.json!.proposalsApplied).toEqual([1, 2])
    expect(merged.json!.next).toMatch(/Proposals #1, #2 are now applied/)
    expect(store.proposals.map((p) => [p.id, p.status, p.decisionNote])).toEqual([[1, 'applied', 'Keep "organization". · merged in #12'], [2, 'applied', 'merged in #12'], [3, 'proposed', null]])
    expect((await call(store, 'request_site_update', { title: 'Again', proposals: [1] }, github)).text).toMatch(/already applied/)
  })

  it('says why a pull request will not merge and redoes it on a fresh branch when asked', async () => {
    const store = new MemoryStore()
    const { github, calls, pulls } = fakeGitHub()
    const stuck = await call(store, 'merge_site_update', { number: 11, confirm: true }, github)
    expect(stuck.isError).toBe(true)
    expect(stuck.text).toMatch(/#11 conflicts with main/)
    expect(stuck.text).toMatch(/merged first/)
    expect(stuck.text).toMatch(/redo: true/)
    expect(calls.merged).toEqual([])

    const redone = await call(store, 'merge_site_update', { number: 11, confirm: true, redo: true }, github)
    expect(redone.isError).toBe(false)
    expect(redone.json!.redone).toBe(true)
    expect(calls.dispatched).toEqual([{ workflow: 'site-update.yml', ref: 'main', inputs: { title: 'Two bullets', instruction: 'Apply the proposals.', proposals: '1,2', supersedes: '11' } }])
    expect((redone.json!.run as { id: number }).id).toBe(2)
    expect(redone.json!.next).toMatch(/#11 is closed when the new pull request opens/)

    // GitHub refusing the merge outright gets the same explanation.
    const refusing = fakeGitHub({ mergeError: 'GitHub 405 on /pulls/7/merge: Pull Request is not mergeable' })
    const refused = await call(store, 'merge_site_update', { number: 7, confirm: true }, refusing.github)
    expect(refused.isError).toBe(true)
    expect(refused.text).toMatch(/#7 conflicts with main/)

    // request_site_update can redo as well, and a pull request from before the marker says what to do instead.
    const viaRequest = await call(store, 'request_site_update', { redo: 11 }, github)
    expect(viaRequest.isError).toBe(false)
    expect((viaRequest.json!.supersedes as { number: number }).number).toBe(11)
    pulls.push(pull(13, 'Old style', 'update/old-5', 'Just a description.'))
    expect((await call(store, 'request_site_update', { redo: 13 }, github)).text).toMatch(/predates the request marker/)
    pulls.find((p) => p.number === 7)!.merged = true
    expect((await call(store, 'request_site_update', { redo: 7 }, github)).text).toMatch(/already merged/)
  })

  it('closes a pull request with a reason and keeps its proposals approved', async () => {
    const store = new MemoryStore()
    await store.insertProposal({ role: 'skills', field: null, kind: 'add', currentText: null, proposedText: 'x', rationale: 'y', basedOn: null }, now)
    await store.decideProposal(1, 'approved', null, now)
    const { github, calls } = fakeGitHub()
    expect((await call(store, 'close_site_update', { number: 11 }, github)).text).toMatch(/reason is required/)
    const closed = await call(store, 'close_site_update', { number: 11, reason: 'Superseded by #12.' }, github)
    expect(closed.isError).toBe(false)
    expect(calls.closed).toEqual([{ number: 11, comment: 'Closed from the MCP server: Superseded by #12.' }])
    expect(closed.json!.proposals).toEqual([1, 2])
    expect(closed.json!.note).toMatch(/stay approved/)
    expect(store.proposals[0].status).toBe('approved')
    expect((await call(store, 'close_site_update', { number: 11, reason: 'again' }, github)).json!.alreadyClosed).toBe(true)
    expect((await call(store, 'close_site_update', { number: 99, reason: 'x' }, github)).isError).toBe(true)
  })

  it('waits for a run and comes back with its pull request, or says it is still running', async () => {
    const store = new MemoryStore()
    const { github, runs } = fakeGitHub()
    const done = await call(store, 'wait_for_site_update', { run_id: 1 }, github)
    expect(done.isError).toBe(false)
    expect(done.json!.done).toBe(true)
    expect((done.json!.pullRequest as { number: number }).number).toBe(7)
    expect(done.json!.next).toMatch(/Pull request https:\/\/github.com\/x\/pull\/7 is ready/)

    runs.unshift({ id: 5, status: 'in_progress', conclusion: null, createdAt: '2026-10-17T02:00:00Z', url: 'https://github.com/x/runs/5', branch: 'main', title: 'Slow one' })
    const waiting = await call(store, 'wait_for_site_update', { seconds: 5 }, github)
    expect(waiting.json!.done).toBe(false)
    expect((waiting.json!.run as { id: number }).id).toBe(5)
    expect(waiting.json!.next).toMatch(/Call wait_for_site_update again/)
    expect((await call(store, 'wait_for_site_update', { run_id: 404 }, github)).text).toMatch(/no run with id 404/)

    runs.unshift({ id: 6, status: 'completed', conclusion: 'failure', createdAt: '2026-10-17T03:00:00Z', url: 'https://github.com/x/runs/6', branch: 'update/broken-6', title: 'Broken' })
    const failed = await call(store, 'wait_for_site_update', { run_id: 6 }, github)
    expect(failed.json!.done).toBe(true)
    expect(failed.json!.pullRequest).toBeNull()
    expect(failed.json!.next).toMatch(/ended with "failure"/)
  })

  it('reads the markers the Site update workflow leaves in a pull request body', () => {
    expect(resumeScoreFromBody('<!-- resume-score before=90 after=85 -->')).toEqual({ before: 90, after: 85, lower: true })
    expect(resumeScoreFromBody('text\n<!-- resume-score before=unknown after=85 -->')).toEqual({ before: null, after: 85, lower: false })
    expect(resumeScoreFromBody('no marker')).toBeNull()
    expect(resumeScoreFromBody(null)).toBeNull()
    const request = { title: 'Dates', instruction: 'Change "Jan 2006 - Sep 2006" to "Jan 2005 - Jun 2007" — with an em dash, quotes and é.', proposals: [4, 5], supersedes: 12 }
    expect(updateRequestFromBody(`before\n${encodeUpdateRequest(request)}\nafter`)).toEqual(request)
    expect(updateRequestFromBody('**Instruction**\n\nShorten the bullets.\n\n**Resume score:** 90')).toEqual({ title: '', instruction: 'Shorten the bullets.', proposals: [], supersedes: null })
    expect(updateRequestFromBody('<!-- site-update-request bm90anNvbg== -->')).toBeNull()
    expect(updateRequestFromBody(null)).toBeNull()
  })

  it('names Pages previews the way Cloudflare does', () => {
    expect(previewUrl('update/Team-Size_1')).toBe('https://update-team-size-1.stevenwilssens.pages.dev')
    expect(previewUrl('a-very-long-branch-name-that-keeps-going-forever')).toBe('https://a-very-long-branch-name-that.stevenwilssens.pages.dev')
  })
})

describe('proposals and the résumé as deployed', () => {
  it('marks approved proposals the résumé already carries as applied when they are listed', async () => {
    const store = new MemoryStore()
    const live = experiences[0]
    await store.insertProposal({ role: live.key, field: 'point', kind: 'replace', currentText: 'Old wording.', proposedText: live.points[0], rationale: 'r', basedOn: null }, now)
    await store.insertProposal({ role: live.key, field: 'point', kind: 'replace', currentText: live.points[1], proposedText: 'Wording nobody applied yet.', rationale: 'r', basedOn: null }, now)
    await store.insertProposal({ role: live.key, field: 'dates', kind: 'replace', currentText: 'x', proposedText: live.dates, rationale: 'r', basedOn: null }, now)
    await store.insertProposal({ role: 'headline', field: null, kind: 'replace', currentText: 'x', proposedText: profile.resumeHeadline, rationale: 'r', basedOn: null }, now)
    await store.insertProposal({ role: 'achievements', field: null, kind: 'replace', currentText: 'x', proposedText: JSON.stringify({ value: impact[0].value, label: impact[0].label, backing: impact[0].backing }), rationale: 'r', basedOn: null }, now)
    for (const id of [1, 2, 3, 4]) await store.decideProposal(id, 'approved', null, now)
    // 5 is only proposed: never flipped, however live it is.
    const listed = await call(store, 'list_resume_proposals')
    expect(listed.json!.markedApplied).toEqual([1, 3, 4])
    expect(listed.json!.markedAppliedNote).toMatch(/3 approved proposals are live/)
    expect(store.proposals.map((p) => [p.id, p.status])).toEqual([[1, 'applied'], [2, 'approved'], [3, 'applied'], [4, 'applied'], [5, 'proposed']])
    expect(store.proposals[0].decisionNote).toBe('found live in the résumé data')
    expect((await call(store, 'list_resume_proposals')).json!.markedApplied).toBeUndefined()
  })

  it('proposes changes to the key achievements, insisting on the backing role', async () => {
    const store = new MemoryStore()
    const resume = await call(store, 'get_resume')
    const strip = resume.json!.keyAchievements as { value: string; label: string; backing: string | null; asProposalText: string }[]
    expect(strip[0]).toMatchObject({ value: impact[0].value, backing: impact[0].backing })
    expect(JSON.parse(strip[0].asProposalText)).toEqual({ value: impact[0].value, label: impact[0].label, backing: impact[0].backing })

    expect((await call(store, 'propose_resume_change', { role: 'achievements', kind: 'replace', current_text: 'not json', proposed_text: '{}', rationale: 'x' })).text).toMatch(/must be JSON/)
    expect((await call(store, 'propose_resume_change', { role: 'achievements', kind: 'replace', current_text: JSON.stringify({ value: '99%', label: 'nothing' }), proposed_text: strip[0].asProposalText, rationale: 'x' })).text).toMatch(/does not match a key achievement/)
    expect((await call(store, 'propose_resume_change', { role: 'achievements', kind: 'add', proposed_text: JSON.stringify({ value: '30%', label: 'lower infrastructure cost' }), rationale: 'x' })).text).toMatch(/needs "backing"/)
    expect((await call(store, 'propose_resume_change', { role: 'achievements', kind: 'add', proposed_text: JSON.stringify({ value: '30%', label: 'lower infrastructure cost', backing: 'ceo' }), rationale: 'x' })).text).toMatch(/"backing" must be the key of the role/)
    const added = await call(store, 'propose_resume_change', { role: 'achievements', kind: 'add', proposed_text: JSON.stringify({ value: '30%', label: 'lower infrastructure cost', backing: 'windows-devices-data' }), rationale: 'The budget bullet states it.' })
    expect(added.isError).toBe(false)
    expect(JSON.parse((added.json!.proposed as { proposedText: string }).proposedText)).toEqual({ value: '30%', label: 'lower infrastructure cost', backing: 'windows-devices-data' })
    const removed = await call(store, 'propose_resume_change', { role: 'achievements', kind: 'remove', current_text: JSON.stringify({ value: impact[0].value, label: impact[0].label }), rationale: 'Dated.' })
    expect(removed.isError).toBe(false)
    expect(JSON.parse((removed.json!.proposed as { currentText: string }).currentText).backing).toBe(impact[0].backing)
  })
})

describe('site analytics', () => {
  it('tells the owner how the site is doing, people apart from crawlers, and nothing to the public', async () => {
    const store = new MemoryStore()
    const result = await call(store, 'site_analytics', { days: 30 })
    expect(result.isError).toBe(false)
    const summary = result.json!.summary as string[]
    expect(summary[0]).toBe('People, last 30 days (2026-09-17 to 2026-10-17): 120 visitors (+20% vs the 30 days before), 300 pageviews, 12 résumé downloads, 4 contact clicks, about 48s on a page.')
    expect(summary[1]).toBe('Crawlers: 900 requests from 14 bots; 500 from AI (100 AI search, 350 training, 50 assistants fetching for a person), 300 search engines, 100 other.')
    expect(summary[2]).toBe('Top pages: / (150), /experience (60).')
    expect(summary[3]).toBe('Where people came from: LinkedIn 40, Direct 70.')
    expect(summary[4]).toBe('Busiest bots: GPTBot 200.')
    expect(summary[5]).toMatch(/^The site assistant: 20 questions, 15 answered, 5 it could not answer, 6 voted helpful and 1 not\. Public MCP server: 9 calls\.$/)
    expect((result.json!.people as { visitors: number }).visitors).toBe(120)
    expect((result.json!.daily as unknown[]).length).toBe(1)
    expect(result.json!.notes).toMatch(/UTC/)
    expect((await call(store, 'site_analytics', {}, null, 'public')).code).toBe(-32602)
  })
})
