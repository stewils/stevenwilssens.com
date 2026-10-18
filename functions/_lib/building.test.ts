// The live numbers behind the Building write-ups: this site's own from its database and
// the GitHub pull requests, another project's from its site, in one shape.
import { describe, expect, it } from 'vitest'
import type { GitHub } from './github'
import { projectFeed, projects, siteFeed, updateBranchPrefix } from './building'

// A D1 stand-in: batch() answers each statement with the rows given for it, in order.
const fakeDb = (rows: Record<string, unknown>[][], seen: string[] = []) => ({
  prepare: (sql: string) => { seen.push(sql); return { sql } },
  batch: async (statements: { sql: string }[]) => statements.map((_, index) => ({ results: rows[index] ?? [] })),
}) as unknown as D1Database

const fakeGitHub = (merged: number | Error): GitHub => ({
  repo: 'stewils/stevenwilssens.com',
  dispatch: async () => undefined,
  runs: async () => [],
  pulls: async () => [],
  pull: async () => null,
  mergedPulls: async (prefix) => { expect(prefix).toBe(updateBranchPrefix); if (merged instanceof Error) throw merged; return merged },
  merge: async () => ({ merged: false, message: '' }),
})

describe('the projects', () => {
  it('lists each write-up with its repository, sources and feed, without the comment', () => {
    expect(Object.keys(projects)).toEqual(['wilssens', 'aibreaker', 'site', 'juniortrackcycling', 'leo'])
    expect(projects.site).toMatchObject({ repository: 'stewils/stevenwilssens.com', page: 'building-this-site', article: 'src/articles/site/SiteArticle.tsx', feed: 'own' })
    expect(projects.wilssens.sources[0]).toBe('CLAUDE.md')
    expect(projects.juniortrackcycling).toMatchObject({ page: 'building-juniortrackcycling', article: 'src/articles/juniortrackcycling/JuniorTrackCyclingArticle.tsx', feed: null })
    expect(projects.leo).toMatchObject({ repository: 'stewils/leo-wilssens', page: 'building-leo', feed: null })
    for (const project of Object.values(projects)) expect(project.sources[0]).toBe('CLAUDE.md')
  })
})

describe('this site\'s feed', () => {
  it('counts countries, good vitals, approved proposals and merged pull requests', async () => {
    const seen: string[] = []
    const feed = await siteFeed(fakeDb([[{ n: 12 }], [{ n: 98 }], [{ n: 21 }]], seen), fakeGitHub(7), Date.UTC(2026, 9, 18))
    expect(feed).toEqual({ project: 'site', asOf: '2026-10-18T00:00:00.000Z', numbers: { countries: 12, vitalsGoodPercent: 98, proposalsApproved: 21, pullRequestsMerged: 7 } })
    expect(seen[0]).toContain("type = 'pageview'")
    expect(seen[1]).toContain("type = 'vital'")
    expect(seen[2]).toContain("status IN ('approved', 'applied')")
  })

  it('leaves the pull requests out without GitHub, or when GitHub fails', async () => {
    expect((await siteFeed(fakeDb([[{ n: 1 }], [{ n: null }], [{ n: 0 }]]), null)).numbers).toEqual({ countries: 1, vitalsGoodPercent: 0, proposalsApproved: 0 })
    expect((await siteFeed(fakeDb([[{ n: 1 }], [{ n: 50 }], [{ n: 2 }]]), fakeGitHub(new Error('GitHub 403')))).numbers).toEqual({ countries: 1, vitalsGoodPercent: 50, proposalsApproved: 2 })
  })
})

describe('a project\'s feed', () => {
  it('reads the project\'s site and keeps only finite numbers', async () => {
    const calls: string[] = []
    const fetchImpl = (async (url: string) => { calls.push(url); return new Response(JSON.stringify({ asOf: '2026-10-18T10:00:00Z', numbers: { mailboxes: 4, sitesLive: 6, helpCostThisMonth: 1.5, note: 'text', broken: null } })) }) as unknown as typeof fetch
    expect(await projectFeed('wilssens', projects.wilssens, fetchImpl)).toEqual({ project: 'wilssens', asOf: '2026-10-18T10:00:00Z', numbers: { mailboxes: 4, sitesLive: 6, helpCostThisMonth: 1.5 } })
    expect(calls).toEqual(['https://www.wilssens.com/api/building'])
  })

  it('fails plainly when the site does not answer', async () => {
    const fetchImpl = (async () => new Response('down', { status: 503 })) as unknown as typeof fetch
    await expect(projectFeed('aibreaker', projects.aibreaker, fetchImpl)).rejects.toThrow('AI Breaker answered 503')
  })
})
