// The live numbers behind the Building write-ups (src/articles/*). Each project's site
// answers GET /api/building from its own database; this site serves them all at
// /api/building/<project> (functions/api/building/[project].ts), computing its own
// here, so an article shows today's figures over the ones written into the page at
// the last refresh (feed.json next to the article). Counts only, nothing about a person.
import sources from '../../src/articles/sources.json'
import type { GitHub } from './github'

export type Feed = { project: string; asOf: string; numbers: Record<string, number> }
export type Project = { name: string; repository: string; page: string | null; article: string | null; sources: string[]; feed: string | null }

const { _comment, ...rest } = sources
void _comment
export const projects: Record<string, Project> = rest

// The branch prefix of the Site update workflow (.github/workflows/site-update.yml).
export const updateBranchPrefix = 'update/'

export const siteFeed = async (db: D1Database, github: GitHub | null, now = Date.now()): Promise<Feed> => {
  const [countries, vitals, proposals] = await db.batch<{ n: number | null }>([
    db.prepare(`SELECT COUNT(DISTINCT country) AS n FROM events WHERE type = 'pageview' AND country IS NOT NULL AND country <> ''`),
    db.prepare(`SELECT ROUND(100.0 * SUM(metric_rating = 'good') / COUNT(*)) AS n FROM events WHERE type = 'vital' AND metric IS NOT NULL AND metric_rating IS NOT NULL`),
    db.prepare(`SELECT COUNT(*) AS n FROM resume_proposals WHERE status IN ('approved', 'applied')`),
  ])
  const numbers: Record<string, number> = {
    countries: countries.results[0]?.n ?? 0,
    vitalsGoodPercent: vitals.results[0]?.n ?? 0,
    proposalsApproved: proposals.results[0]?.n ?? 0,
  }
  // Pull requests opened by Claude Code from a conversation (the MCP server or a project's
  // check-in) and merged into the site. Needs the GitHub token the MCP server uses.
  if (github) {
    const merged = await github.mergedPulls(updateBranchPrefix).catch(() => null)
    if (merged != null) numbers.pullRequestsMerged = merged
  }
  return { project: 'site', asOf: new Date(now).toISOString(), numbers }
}

// Another project's feed, as its site answers it, in the shape the articles read.
export const projectFeed = async (key: string, project: Project, fetchImpl: typeof fetch = fetch): Promise<Feed> => {
  const response = await fetchImpl(project.feed!, { headers: { Accept: 'application/json', 'User-Agent': 'steven-wilssens-building' }, cf: { cacheTtl: 300, cacheEverything: true } } as RequestInit)
  if (!response.ok) throw new Error(`${project.name} answered ${response.status}`)
  const body = await response.json() as Partial<Feed>
  const numbers = Object.fromEntries(Object.entries(body.numbers ?? {}).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])))
  return { project: key, asOf: typeof body.asOf === 'string' ? body.asOf : new Date().toISOString(), numbers }
}
