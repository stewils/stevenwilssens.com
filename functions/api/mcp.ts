// GET /api/mcp: what the admin dashboard shows about the MCP server: the public
// and owner URLs, dossier counts, and what recruiters' assistants asked recently.
import type { Env } from '../_lib/env'
import { isAdmin } from '../_lib/auth'
import { D1Store } from '../_lib/mcp/store'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401)
  const origin = new URL(request.url).origin
  const store = new D1Store(env.DB)
  const since = Date.now() - 30 * 86_400_000
  const [entries, questions, messages, proposals] = await Promise.all([store.list({}), store.recentQuestions(since, 100), store.recentMessages(since, 50), store.listProposals()])
  return json({
    publicUrl: `${origin}/mcp`,
    ownerUrl: env.MCP_OWNER_KEY ? `${origin}/mcp/${env.MCP_OWNER_KEY}` : null,
    entries: { total: entries.length, public: entries.filter((entry) => entry.visibility === 'public').length, roles: new Set(entries.map((entry) => entry.role)).size },
    questions,
    messages,
    // Newest first; rejected ones stay out of the dashboard.
    proposals: proposals.filter((proposal) => proposal.status !== 'rejected').reverse(),
  })
}
