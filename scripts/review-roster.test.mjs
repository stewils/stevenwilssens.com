// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fromArgs, ROLES, roleId, roster } from './review-roster.mjs'

const sha = 'a'.repeat(40)
const approved = (...roles) => ({ sha, roles: roles.map((role) => ({ role, verdict: 'APPROVE', summary: `${role} fine` })) })

describe('who reviews', () => {
  it.each([
    ['the MCP server', ['functions/_lib/mcp/plain.ts', 'functions/_lib/mcp/plain.test.ts'], ['senior-developer', 'security-engineer', 'senior-tester', 'product-manager']],
    ['a page', ['src/pages/About.tsx'], ['senior-developer', 'senior-tester', 'ux-designer', 'senior-recruiter', 'product-manager']],
    ['a résumé fact on a Site update', ['src/resume.ts', 'public/steven-wilssens-resume-2026.pdf', 'specs/team-size-38.md'], ['senior-developer', 'senior-tester', 'senior-recruiter', 'product-manager']],
    ['the words of a write-up refresh', ['src/articles/site/SiteArticle.tsx', 'src/articles/site/feed.json', 'specs/building-site-43.md'], ['senior-developer', 'senior-tester', 'senior-recruiter', 'product-manager']],
    ['only the numbers of a write-up', ['src/articles/site/feed.json'], ['senior-recruiter', 'product-manager']],
    ['a write-up diagram', ['src/articles/site/Diagrams.tsx'], ['senior-developer', 'senior-tester', 'ux-designer', 'senior-recruiter', 'product-manager']],
    ['the admin', ['src/admin/CostsPage.tsx'], ['senior-developer', 'security-engineer', 'senior-tester', 'ux-designer', 'product-manager']],
    ['only a test', ['functions/_lib/mcp/tools.test.ts'], ['senior-developer', 'senior-tester', 'product-manager']],
    ['only the README', ['README.md'], ['senior-developer']],
    ['an image', ['public/profile.jpg'], ['senior-developer', 'senior-tester', 'ux-designer', 'senior-recruiter', 'product-manager']],
    ['the résumé layout', ['scripts/resume.mjs'], ['senior-developer', 'security-engineer', 'senior-tester', 'ux-designer', 'senior-recruiter', 'product-manager']],
    ['the page shell', ['index.html'], ['senior-developer', 'security-engineer', 'senior-tester', 'ux-designer', 'product-manager']],
    ['a dependency', ['package.json', 'package-lock.json'], ['senior-developer', 'security-engineer', 'senior-tester', 'product-manager']],
    ['a migration', ['migrations/0014_x.sql'], ['senior-developer', 'security-engineer', 'senior-tester', 'product-manager']],
    ['the assistant', ['functions/_lib/ask/agent.ts'], ['senior-developer', 'security-engineer', 'senior-tester', 'senior-recruiter', 'product-manager']],
    ['a test fixture', ['functions/_lib/costs/fixtures/execution.json'], ['senior-developer', 'senior-tester', 'product-manager']],
  ])('%s', (_what, changed, run) => {
    expect(roster({ changed }).run).toEqual(run)
  })

  it.each([['"src/caf\\303\\251.tsx"'], ['CLAUDE.md'], ['.claude/agents/senior-tester.md'], ['.github/workflows/review.yml'], ['scripts/recruiter-check.mjs'], ['scripts/review-roster.mjs'], ['functions/_lib/review/score.ts']])('the full panel when %s changes', (path) => {
    const result = roster({ changed: ['README.md', path] })
    expect(result).toMatchObject({ full: true, run: ROLES, skipped: [] })
  })

  it('always has the PM on a Site update, and says why each other role is not on the panel', () => {
    const result = roster({ changed: ['README.md'], branch: 'update/foo-12' })
    expect(result.run).toEqual(['product-manager'])
    expect(result.skipped.map((entry) => entry.role)).toEqual(['senior-developer', 'security-engineer', 'senior-tester', 'ux-designer', 'senior-recruiter'])
    for (const entry of result.skipped) expect(entry).toMatchObject({ verdict: 'NOT_APPLICABLE', blockers: 0, majors: 0, summary: expect.stringMatching(/^Not on this panel: .+\.$/) })
  })
})

describe('approvals that carry over', () => {
  const changed = ['functions/_lib/mcp/plain.ts', 'functions/_lib/mcp/plain.test.ts', 'specs/x.md']

  it('keeps an approval when nothing in its part changed since, and runs the rest again', () => {
    const result = roster({ changed, previous: approved('senior-developer', 'Security engineer', 'senior-tester', 'product-manager'), since: ['functions/_lib/mcp/plain.test.ts'] })
    expect(result.run).toEqual(['senior-developer', 'senior-tester', 'product-manager'])
    expect(result.carried).toEqual([{ role: 'security-engineer', verdict: 'APPROVE', blockers: 0, majors: 0, summary: 'Approved on aaaaaaa; nothing it reviews changed since. Security engineer fine' }])
  })

  it('carries every approval on a re-run of the same commit, and runs only the ones that did not approve', () => {
    const previous = { sha, roles: [...approved('senior-developer', 'security-engineer', 'senior-tester').roles, { role: 'product-manager', verdict: 'NEEDS_STEVEN' }] }
    const result = roster({ changed, previous, since: [] })
    expect(result.run).toEqual(['product-manager'])
    expect(result.carried.map((entry) => entry.role)).toEqual(['senior-developer', 'security-engineer', 'senior-tester'])
  })

  it('carries nothing after a force push, without a previous review, or when the rules changed since', () => {
    const previous = approved(...ROLES)
    expect(roster({ changed, previous, since: null }).carried).toEqual([])
    expect(roster({ changed, previous: null, since: [] }).carried).toEqual([])
    expect(roster({ changed, previous: { ...previous, sha: 'not-a-sha' }, since: [] }).carried).toEqual([])
    expect(roster({ changed: [...changed, 'CLAUDE.md'], previous, since: ['CLAUDE.md'] }).carried).toEqual([])
  })
})

describe('role names', () => {
  it.each([
    ['Senior developer (code)', 'senior-developer'], ['security-engineer', 'security-engineer'], ['Tester', 'senior-tester'],
    ['Designer (UI)', 'ux-designer'], ['Senior recruiter', 'senior-recruiter'], ['Product manager', 'product-manager'], ['PM', 'product-manager'], ['the fact checker', null], [undefined, null],
  ])('%j is %j', (name, id) => {
    expect(roleId(name)).toBe(id)
  })
})

describe('its arguments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'roster-args-'))
  const file = (name, text) => { const path = join(dir, name); writeFileSync(path, text); return path }

  it('reads the files, the branch, the previous verdicts and the files since', () => {
    const changed = file('changed.txt', 'functions/api/costs.ts\r\nspecs/x.md\n\n')
    expect(fromArgs([changed, 'dev']).run).toEqual(['senior-developer', 'security-engineer', 'senior-tester', 'product-manager'])
    const previous = file('previous.json', JSON.stringify(approved('security-engineer')))
    expect(fromArgs([changed, 'dev', previous, file('since.txt', 'specs/x.md\n')]).carried.map((entry) => entry.role)).toEqual(['security-engineer'])
    expect(fromArgs([changed, 'dev', previous, '-']).carried).toEqual([])
    expect(fromArgs([changed, 'dev', previous]).carried).toEqual([])
  })

  it('reads unreadable verdicts, missing files and no arguments as none', () => {
    const changed = file('changed2.txt', 'src/resume.ts\n')
    expect(fromArgs([changed, '', file('bad.json', '{not json'), file('since2.txt', '')]).carried).toEqual([])
    expect(fromArgs([changed, '', join(dir, 'missing.json'), file('since3.txt', '')]).carried).toEqual([])
    expect(fromArgs([join(dir, 'missing.txt')]).run).toEqual(['senior-developer'])
    expect(fromArgs([]).run).toEqual(['senior-developer'])
  })
})

describe('on the command line', () => {
  const script = resolve(import.meta.dirname, 'review-roster.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'roster-'))
  const file = (name, text) => { const path = join(dir, name); writeFileSync(path, text); return path }
  const run = (...args) => JSON.parse(execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' }))

  it('reads the files, the branch, the previous verdicts and the files since', () => {
    const changed = file('changed.txt', 'functions/api/costs.ts\r\nspecs/x.md\n\n')
    expect(run(changed, 'dev').run).toEqual(['senior-developer', 'security-engineer', 'senior-tester', 'product-manager'])
    const previous = file('previous.json', JSON.stringify(approved('security-engineer')))
    expect(run(changed, 'dev', previous, file('since.txt', 'specs/x.md\n')).carried.map((entry) => entry.role)).toEqual(['security-engineer'])
    expect(run(changed, 'dev', previous, '-').carried).toEqual([])
  })

  it('reads unreadable verdicts and missing files as none', () => {
    const changed = file('changed2.txt', 'src/resume.ts\n')
    expect(run(changed, '', file('bad.json', '{not json'), file('since2.txt', '')).carried).toEqual([])
    expect(run(join(dir, 'missing.txt')).run).toEqual(['senior-developer'])
  })
})
