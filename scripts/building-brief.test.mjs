// The brief the Site update workflow gives Claude Code (scripts/building-brief.mjs).
import { describe, expect, it } from 'vitest'
import { brief } from './building-brief.mjs'

const today = new Date(Date.UTC(2026, 9, 18, 12))

describe('the Site update brief', () => {
  it('passes a request through as given', () => {
    const result = brief({ event: 'workflow_dispatch', title: ' Team size ', instruction: 'Say the team was 10 to 20 PMs.\n', payload: null, today })
    expect(result).toMatchObject({ title: 'Team size', instruction: 'Say the team was 10 to 20 PMs.', project: '', origin: 'a request made through the MCP server' })
  })

  it('carries the pull request a run redoes, as a number only, from the input or the payload', () => {
    expect(brief({ event: 'workflow_dispatch', title: 't', instruction: 'i', supersedes: '61', payload: null, today }).supersedes).toBe('61')
    expect(brief({ event: 'workflow_dispatch', title: 't', instruction: 'i', supersedes: '61; rm -rf /', payload: null, today }).supersedes).toBe('')
    expect(brief({ event: 'workflow_dispatch', title: 't', instruction: 'i', payload: null, today }).supersedes).toBe('')
    expect(brief({ event: 'repository_dispatch', payload: { project: 'site', sha: 'abcdef1', supersedes: 59 }, today }).supersedes).toBe('59')
    expect(brief({ event: 'repository_dispatch', payload: { project: 'site', sha: 'abcdef1', supersedes: '0' }, today }).supersedes).toBe('')
  })

  it('refuses a request without a title or an instruction', () => {
    expect(brief({ event: 'workflow_dispatch', title: 'x', instruction: ' ', payload: null, today }).skip).toMatch(/both needed/)
  })

  it('writes the refresh brief after a check-in on a project with a write-up', () => {
    const result = brief({ event: 'repository_dispatch', payload: { project: 'wilssens', sha: 'abcdef1234567', before: '1234567abcdef', subject: 'Help assistant: cost by who asked\n\nMore detail.', compare: 'https://github.com/stewils/wilssens.com/compare/1234567...abcdef1' }, today })
    expect(result.skip).toBeUndefined()
    expect(result.title).toBe('Building wilssens.com: Help assistant: cost by who asked')
    expect(result.project).toBe('wilssens')
    expect(result.repository).toBe('stewils/wilssens.com')
    expect(result.ref).toBe('abcdef1234567')
    expect(result.before).toBe('1234567abcdef')
    expect(result.sources).toBe('CLAUDE.md README.md docs')
    expect(result.origin).toBe('a check-in on stewils/wilssens.com (https://github.com/stewils/wilssens.com/compare/1234567...abcdef1)')
    expect(result.instruction).toContain('src/articles/wilssens/WilssensArticle.tsx')
    expect(result.instruction).toContain('sources/wilssens/CLAUDE.md')
    expect(result.instruction).toContain('src/articles/wilssens/feed.json')
    expect(result.instruction).toContain('18 October 2026')
    expect(result.instruction).toContain('Leave out anything private')
    expect(result.instruction).toContain('Do not touch src/resume.ts')
  })

  it('treats a first push (no commit before) as the whole files', () => {
    const result = brief({ event: 'repository_dispatch', payload: { project: 'aibreaker', sha: 'abcdef1', before: '0000000000000000000000000000000000000000', subject: '' }, today })
    expect(result.before).toBe('')
    expect(result.title).toBe('Building AI Breaker: refresh after a check-in')
    expect(result.instruction).toContain('the whole files when there was no push before')
  })

  it('keeps the title short', () => {
    const result = brief({ event: 'repository_dispatch', payload: { project: 'site', sha: 'abcdef1', subject: 'A very long commit subject that goes on and on about what changed in the admin dashboard and more' }, today })
    expect(result.title.length).toBeLessThanOrEqual(72)
    expect(result.title.endsWith('…')).toBe(true)
  })

  it('skips a project without a write-up, an unknown project and a payload without a commit', () => {
    const noArticle = { later: { name: 'Later', repository: 'stewils/later', page: null, article: null, sources: ['CLAUDE.md'], feed: null } }
    expect(brief({ event: 'repository_dispatch', payload: { project: 'later', sha: 'abcdef1' }, today, projects: noArticle }).skip).toMatch(/no Building write-up yet/)
    expect(brief({ event: 'repository_dispatch', payload: { project: 'nope', sha: 'abcdef1' }, today }).skip).toMatch(/Unknown project/)
    expect(brief({ event: 'repository_dispatch', payload: { project: 'wilssens' }, today }).skip).toMatch(/no commit/)
  })
})
