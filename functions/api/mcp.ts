// GET /api/mcp: what the admin dashboard shows about the MCP server: the owner link,
// dossier counts, the résumé proposals waiting or approved, and the public server's
// use (calls per tool and the latest queries).
import type { Env } from '../_lib/env'
import { isAdmin } from '../_lib/auth'
import { D1Store } from '../_lib/mcp/store'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401)
  const url = new URL(request.url)
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 365)
  const origin = url.origin
  const store = new D1Store(env.DB)
  const now = Date.now()
  const [entries, proposals, calls] = await Promise.all([store.list({}), store.listProposals(), store.toolCalls(now - days * 86_400_000, 500)])
  const byTool = new Map<string, number>()
  for (const call of calls) byTool.set(call.tool, (byTool.get(call.tool) ?? 0) + 1)
  return json({
    ownerUrl: env.MCP_OWNER_KEY ? `${origin}/mcp/${env.MCP_OWNER_KEY}` : null,
    publicUrl: `${origin}/mcp`,
    entries: { total: entries.length, public: entries.filter((entry) => entry.visibility === 'public').length, roles: new Set(entries.map((entry) => entry.role)).size },
    // Newest first; rejected ones stay out of the dashboard.
    proposals: proposals.filter((proposal) => proposal.status !== 'rejected').reverse(),
    publicCalls: {
      days,
      total: calls.length,
      byTool: [...byTool.entries()].map(([tool, calls]) => ({ tool, calls })).sort((a, b) => b.calls - a.calls),
      recent: calls.slice(0, 50).map((call) => ({ ts: call.ts, tool: call.tool, query: call.query, country: call.country, asOrg: call.asOrg })),
    },
  })
}
