// GET /api/building/<project>: the live numbers a Building write-up shows in its header
// (src/articles/<project>, listed in src/articles/sources.json). This site's own come from
// its database; another project's are fetched from that project's site. Public: counts only.
import type { Env } from '../../_lib/env'
import { gitHubClient } from '../../_lib/github'
import { projectFeed, projects, siteFeed } from '../../_lib/building'

const defaultRepo = 'stewils/stevenwilssens.com'

const json = (data: unknown, status = 200, cache = status === 200 ? 'public, max-age=300' : 'no-store') => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } })

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const key = String(params.project ?? '')
  const project = projects[key]
  if (!project?.feed) return json({ error: 'unknown project' }, 404)
  try {
    if (project.feed === 'own') {
      const github = env.GITHUB_TOKEN ? gitHubClient(env.GITHUB_TOKEN, env.GITHUB_REPO || defaultRepo) : null
      return json(await siteFeed(env.DB, github))
    }
    return json(await projectFeed(key, project))
  } catch (error) {
    // A project's site that is down, or that does not answer /api/building yet, must not
    // break the write-up: the page keeps the figures from its last refresh (feed.json), so
    // this is an answer without numbers, not an error, and it is not cached.
    console.error('building feed failed', key, error)
    return json({ project: key, asOf: null, numbers: {}, unavailable: `the ${project.name} numbers are not available right now` }, 200, 'no-store')
  }
}
