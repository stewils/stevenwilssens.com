import type { Env } from './_lib/env'
import { identifyCrawler, isCrawlTarget } from './_lib/crawlers'
import { redirectTarget } from './_lib/hosts'
import { ResumeScores } from './_lib/resume-scores'

const retentionMs = 395 * 86_400_000 // 13 months, as stated on /privacy

// A deploy brings a new resume report (/resume-report.json, written by the build with
// the resume's score). The first page request each isolate serves records it, so the
// score history on /admin grows with every update without a deploy hook or a secret.
let resumeRecorded = false

// Every other address of the site (the production pages.dev host, anything under
// wilssens.net) redirects to its one public address; see _lib/hosts.ts.
// Requests from crawlers are recorded after the response is sent, since crawlers
// rarely run the browser tracker.
export const onRequest: PagesFunction<Env> = async ({ request, env, next, waitUntil }) => {
  const url = new URL(request.url)
  const target = redirectTarget(url)
  if (target) return Response.redirect(target, 301)
  const response = await next()

  if (!resumeRecorded && !url.hostname.endsWith('.pages.dev') && !url.pathname.startsWith('/api/')) {
    resumeRecorded = true
    waitUntil(ResumeScores.currentReport(env.ASSETS, request.url).then((report) => new ResumeScores(env.DB).record(report))
      .catch((error: unknown) => { resumeRecorded = false; console.error('resume score record failed', error) }))
  }

  // Preview deployments share this database; only production and local dev count.
  const userAgent = request.headers.get('User-Agent') ?? ''
  const crawler = url.hostname.endsWith('.pages.dev') || !isCrawlTarget(url.pathname) ? null : identifyCrawler(userAgent)
  if (crawler) {
    const cf = (request.cf ?? {}) as IncomingRequestCfProperties
    const now = Date.now()
    waitUntil(env.DB.prepare('INSERT INTO crawls (ts, bot, operator, category, path, status, user_agent, country, asn, as_org) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(now, crawler.name, crawler.operator, crawler.category, url.pathname.slice(0, 300), response.status, userAgent.slice(0, 300) || null, cf.country ?? null, cf.asn ?? null, cf.asOrganization ?? null)
      .run()
      .then(() => Math.random() < 0.02 ? env.DB.prepare('DELETE FROM crawls WHERE ts < ?').bind(now - retentionMs).run() : null)
      .catch((error: unknown) => console.error('crawl log failed', error)))
  }
  return response
}
