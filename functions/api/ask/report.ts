// GET /api/ask/report: the assistant's public report card (aggregates only), shown
// live in the Building steven.wilssens.com write-up. Cached for ten minutes in the
// browser and at Cloudflare's edge, so a flood of readers (or a bot) costs one set of
// database reads every ten minutes per location, not one per request.
import type { Env } from '../../_lib/env'
import { assistantReport } from '../../_lib/ask/report'
import { D1AskStore } from '../../_lib/ask/store'
import { D1Store } from '../../_lib/mcp/store'

export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default
  const key = new Request(new URL('/api/ask/report', request.url).toString(), { method: 'GET' })
  const cached = await cache?.match(key).catch(() => undefined)
  if (cached) return cached
  const report = await assistantReport(new D1AskStore(env.DB), new D1Store(env.DB), Date.now())
  const response = new Response(JSON.stringify(report), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', 'Access-Control-Allow-Origin': '*' } })
  if (cache) waitUntil(cache.put(key, response.clone()).catch(() => {}))
  return response
}
