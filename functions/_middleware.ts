import type { Env } from './_lib/env'
import { identifyCrawler, isCrawlTarget } from './_lib/crawlers'

const canonicalHost = 'steven.wilssens.com'
const productionPagesHost = 'stevenwilssens.pages.dev'
const retentionMs = 395 * 86_400_000 // 13 months, as stated on /privacy

// Send the production pages.dev address to the custom domain so there is one
// public URL. Preview deployments (<hash>.stevenwilssens.pages.dev) are left alone.
// Requests from crawlers are recorded after the response is sent, since crawlers
// rarely run the browser tracker.
export const onRequest: PagesFunction<Env> = async ({ request, env, next, waitUntil }) => {
  const url = new URL(request.url)
  if (url.hostname === productionPagesHost) {
    url.hostname = canonicalHost
    url.protocol = 'https:'
    return Response.redirect(url.toString(), 301)
  }
  const response = await next()

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
