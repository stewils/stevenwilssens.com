// The recruiter's-seat tools and the site-update tools, through the MCP transport.
import { describe, expect, it } from 'vitest'
import type { GitHub } from '../github'
import { previewUrl } from '../github'
import { profile } from '../../../src/resume'
import { handleMcp } from './server'
import { MemoryStore } from './store'

const url = 'https://steven.wilssens.com/mcp/owner-key-123'
const report = { exists: true, score: 85, pages: 2, errors: 0, warnings: 3, matchesSite: true, findings: [{ severity: 'warn', id: 'keyword-a/b', message: 'Keyword missing: "a/b".' }], questions: [{ about: 'impact', question: 'Which role?' }] }
const pages: Record<string, string> = { '/index.md': '# Steven Wilssens\n\nPrincipal product leader for data and AI.', '/about.md': '# About', '/experience.md': '# Experience', '/work.md': '# Selected work', '/recommendations.md': '# Recommendations', '/resume-report.json': JSON.stringify(report) }

const fakeGitHub = () => {
  const calls: { dispatched: Record<string, unknown>[]; merged: number[] } = { dispatched: [], merged: [] }
  const github: GitHub = {
    repo: 'stewils/stevenwilssens.com',
    dispatch: async (workflow, ref, inputs) => { calls.dispatched.push({ workflow, ref, inputs }) },
    runs: async () => [{ id: 1, status: 'completed', conclusion: 'success', createdAt: '2026-10-17T00:00:00Z', url: 'https://github.com/x/runs/1', branch: 'update/team-size-1', title: 'Team size' }],
    pulls: async () => [{ number: 7, title: 'Team size', url: 'https://github.com/x/pull/7', branch: 'update/team-size-1', draft: false, createdAt: '2026-10-17T00:00:00Z', previewUrl: previewUrl('update/team-size-1'), mergeable: true }],
    pull: async (number) => number === 7 ? { number: 7, title: 'Team size', url: 'https://github.com/x/pull/7', branch: 'update/team-size-1', draft: false, createdAt: '2026-10-17T00:00:00Z', previewUrl: previewUrl('update/team-size-1'), mergeable: true } : null,
    merge: async (number) => { calls.merged.push(number); return { merged: true, message: 'Pull Request successfully merged', sha: 'abc' } },
  }
  return { github, calls }
}

const call = async (store: MemoryStore, name: string, args: Record<string, unknown> = {}, github: GitHub | null = null) => {
  const request = new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) })
  const response = await handleMcp({ request, store, github, fetchPage: async (path) => pages[path] ?? null, now: Date.UTC(2026, 9, 17) })
  const body = await response.json() as { result: { content: { text: string }[]; isError: boolean } }
  const text = body.result.content[0].text
  return { isError: body.result.isError, text, json: body.result.isError ? null : JSON.parse(text) as Record<string, unknown> }
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
  })

  it('starts the workflow, reports runs and pull requests with previews, and merges only when confirmed', async () => {
    const store = new MemoryStore()
    const { github, calls } = fakeGitHub()
    const started = await call(store, 'request_site_update', { title: 'Team size on the Group PM role', instruction: 'Say the team was 10 to 20 PMs.' }, github)
    expect(started.isError).toBe(false)
    expect(calls.dispatched).toEqual([{ workflow: 'site-update.yml', ref: 'main', inputs: { title: 'Team size on the Group PM role', instruction: 'Say the team was 10 to 20 PMs.' } }])
    expect(started.json!.next).toMatch(/goes live only when he merges/)

    const status = await call(store, 'site_update_status', {}, github)
    expect((status.json!.pullRequests as { previewUrl: string }[])[0].previewUrl).toBe('https://update-team-size-1.stevenwilssens.pages.dev')

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

  it('names Pages previews the way Cloudflare does', () => {
    expect(previewUrl('update/Team-Size_1')).toBe('https://update-team-size-1.stevenwilssens.pages.dev')
    expect(previewUrl('a-very-long-branch-name-that-keeps-going-forever')).toBe('https://a-very-long-branch-name-that.stevenwilssens.pages.dev')
  })
})
