// GET /api/ask/report: the assistant's public report card (aggregates only), shown
// live in the Building steven.wilssens.com write-up. Cached for ten minutes.
import type { Env } from '../../_lib/env'
import { assistantReport } from '../../_lib/ask/report'
import { D1AskStore } from '../../_lib/ask/store'
import { D1Store } from '../../_lib/mcp/store'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const report = await assistantReport(new D1AskStore(env.DB), new D1Store(env.DB), Date.now())
  return new Response(JSON.stringify(report), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', 'Access-Control-Allow-Origin': '*' } })
}
