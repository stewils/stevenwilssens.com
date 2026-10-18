// Steven's MCP server over Streamable HTTP (JSON-RPC 2.0 by POST, JSON responses,
// stateless). Two modes on one server:
// - owner: with the owner key in the URL path (/mcp/<key>, for Claude's connector
//   settings) or as a bearer token (for Claude Code). The private workspace: the
//   whole dossier, the interview, the résumé proposals, site updates.
// - public: /mcp without a key. Read-only, for recruiters, hiring managers and their
//   AI assistants: what Steven published (the résumé data, the pages, the
//   recommendations, the patents, the public notes) and a fit check. Writes are
//   refused by construction (publicView in store.ts), and every call is logged
//   (tool and query, no IP) so /admin shows whether anyone uses it.
// A wrong key is a 404, never a fallback to public.
import type { Env } from '../env'
import { bearerToken, sameSecret } from '../auth'
import { gitHubClient, type GitHub } from '../github'
import { ipHash } from '../ask/agent'
import { D1AskStore } from '../ask/store'
import { D1Store, publicView, ReadOnlyError, type DossierStore } from './store'
import { instructionsFor, publicToolNames, siteUrl, ToolError, tools, type Mode, type ToolContext } from './tools'

export const defaultRepo = 'stewils/stevenwilssens.com'

export const serverInfo = { name: 'steven-wilssens', title: 'Steven Wilssens: career dossier', version: '3.0.0' }
export const publicServerInfo = { name: 'steven-wilssens', title: 'Steven Wilssens: résumé and record', version: '3.0.0' }
const protocolVersions = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']
const latestProtocol = '2025-06-18'

type JsonRpcId = string | number | null
type JsonRpcRequest = { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> }
type JsonRpcResponse = { jsonrpc: '2.0'; id: JsonRpcId; result?: unknown; error?: { code: number; message: string; data?: unknown } }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
  'Access-Control-Max-Age': '86400',
}

const respond = (body: BodyInit | null, status: number, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'Cache-Control': 'no-store', ...corsHeaders, ...headers } })
const jsonResponse = (body: unknown, status = 200) => respond(JSON.stringify(body), status, { 'Content-Type': 'application/json' })
const error = (id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } })

export type McpRequest = {
  request: Request
  store: DossierStore
  fetchPage: ToolContext['fetchPage']
  mode?: Mode
  github?: GitHub | null
  now?: number
  // Where the caller is, for the public server's log (from request.cf in production).
  place?: { country: string | null; asOrg: string | null }
  // Public mode: resolves false when this caller has made too many requests in the last hour.
  limiter?: () => Promise<boolean>
}

/** Public calls per IP per hour, counted in ask_hits under a salted hash like the assistant's questions. */
export const PUBLIC_CALLS_PER_HOUR = 120

const toolResult = (value: unknown, isError = false) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }], isError })

const toolsFor = (mode: Mode) => mode === 'owner' ? tools : tools.filter((tool) => publicToolNames.includes(tool.name))

// What the public log keeps of a call: the first text argument, shortened.
const queryOf = (args: Record<string, unknown>) => {
  const text = Object.values(args).find((value): value is string => typeof value === 'string')
  return text ? text.replace(/\s+/g, ' ').trim().slice(0, 200) || null : null
}

const callTool = async (params: Record<string, unknown> | undefined, ctx: ToolContext, place: McpRequest['place']) => {
  const name = typeof params?.name === 'string' ? params.name : ''
  const tool = toolsFor(ctx.mode).find((item) => item.name === name)
  if (!tool) throw Object.assign(new Error(`Unknown tool: ${name || '(none)'}`), { code: -32602 })
  const rawArgs = params?.arguments
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs as Record<string, unknown> : {}
  let result: { content: { type: string; text: string }[]; isError: boolean }
  let hits: number | null = null
  try {
    const value = await tool.run(args, ctx)
    if (value && typeof value === 'object' && Array.isArray((value as { results?: unknown }).results)) hits = (value as { results: unknown[] }).results.length
    result = toolResult(value)
  } catch (err) {
    if (err instanceof ToolError || err instanceof ReadOnlyError) result = toolResult(err.message, true)
    else throw err
  }
  if (ctx.mode === 'public') {
    await ctx.store.logToolCall({ ts: ctx.now, tool: name, query: queryOf(args), role: typeof args.role === 'string' ? args.role.slice(0, 60) : null, hits, country: place?.country ?? null, asOrg: place?.asOrg ?? null }).catch((err: unknown) => console.error('mcp log', err))
  }
  return result
}

const handleMessage = async (message: JsonRpcRequest, ctx: ToolContext, place: McpRequest['place']): Promise<JsonRpcResponse | null> => {
  const id = message.id ?? null
  if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    // A response from the client (result/error without method) needs no answer.
    if (message && typeof message === 'object' && !('method' in message) && ('result' in message || 'error' in message)) return null
    return error(id, -32600, 'Invalid Request')
  }
  const isNotification = message.id === undefined || message.id === null
  const params = message.params
  switch (message.method) {
    case 'initialize': {
      const requested = typeof params?.protocolVersion === 'string' ? params.protocolVersion : ''
      const protocolVersion = protocolVersions.includes(requested) ? requested : latestProtocol
      return { jsonrpc: '2.0', id, result: { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: ctx.mode === 'owner' ? serverInfo : publicServerInfo, instructions: await instructionsFor(ctx) } }
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} }
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: toolsFor(ctx.mode).map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema, annotations: { readOnlyHint: tool.readOnly, destructiveHint: tool.name === 'delete_entry', openWorldHint: false } })) } }
    case 'tools/call':
      try {
        return { jsonrpc: '2.0', id, result: await callTool(params, ctx, place) }
      } catch (err) {
        const code = (err as { code?: number }).code ?? -32603
        return error(id, code, code === -32602 ? (err as Error).message : 'Internal error', code === -32602 ? undefined : String(err))
      }
    default:
      if (isNotification) return null
      // prompts/list and resources/list are not advertised, so a client asking is out of spec but harmless.
      if (message.method === 'prompts/list') return { jsonrpc: '2.0', id, result: { prompts: [] } }
      if (message.method === 'resources/list') return { jsonrpc: '2.0', id, result: { resources: [] } }
      return error(id, -32601, `Method not found: ${message.method}`)
  }
}

// The address is echoed into the explainer pages; URL serialisation already encodes < > and ",
// but escaping is what makes that a fact about this file rather than about the URL spec.
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

const page = (title: string, body: string) => `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;color:#1d2a22}code{background:#eef3ef;padding:2px 5px;border-radius:4px;font-size:14px;overflow-wrap:anywhere}h1{font-size:1.5rem}a{color:#1f6f4a}ul{padding-left:1.2rem}li{margin:.3rem 0}</style>
${body}`

// What a browser sees when the owner opens the private link.
const ownerExplainer = (url: string) => page('Steven Wilssens: private MCP server', `<meta name="robots" content="noindex">
<h1>Your private MCP server</h1>
<p>This address is a <a href="https://modelcontextprotocol.io">Model Context Protocol</a> server for one person: you. Add it to Claude and talk through your career; Claude reads what is already on <a href="${siteUrl}">steven.wilssens.com</a> and in the dossier, interviews you where there are gaps, saves what you say, answers the questions the site's assistant could not, and proposes résumé edits for you to approve or reject.</p>
<p><strong>Claude:</strong> Settings → Connectors → Add custom connector, name it <em>My career</em> and paste <code>${url}</code>. No sign-in step: the key in the address is the sign-in.<br>
<strong>Claude Code:</strong> <code>claude mcp add --transport http my-career ${url}</code></p>
<p><strong>Keep this link private.</strong> Anyone with it can read and change the dossier. Rotate it by setting a new <code>MCP_OWNER_KEY</code> secret.</p>
`)

// What a recruiter (or their assistant's browser) sees at /mcp.
export const publicExplainer = (url: string) => page('Steven Wilssens: MCP server for AI assistants', `<link rel="canonical" href="${url}">
<meta name="description" content="A read-only Model Context Protocol server with Steven Wilssens's résumé, roles, recommendations, patents and a fit check, for recruiters' AI assistants.">
<h1>Steven Wilssens, as an MCP server</h1>
<p>This address is a read-only <a href="https://modelcontextprotocol.io">Model Context Protocol</a> server. Connect it to your AI assistant and it can read <a href="${siteUrl}">steven.wilssens.com</a> as tools: the résumé, every role, the recommendations, the patents and press, the notes Steven published, and a fit check that compares a job description with his record, requirement by requirement. It knows nothing Steven has not published, and it cannot change anything.</p>
<p><strong>Claude:</strong> Settings → Connectors → Add custom connector, paste <code>${url}</code>. No sign-in.<br>
<strong>Claude Code:</strong> <code>claude mcp add --transport http steven-wilssens ${url}</code><br>
<strong>Other clients:</strong> Streamable HTTP, JSON-RPC 2.0 by POST to this address.</p>
<p>Tools: <code>about_steven</code>, <code>get_resume</code>, <code>get_role</code>, <code>read_site_page</code>, <code>get_recommendations</code>, <code>get_patents_and_press</code>, <code>search_dossier</code> (his public notes), <code>check_fit</code>.</p>
<p>Calls are logged by tool name and query so Steven can see what assistants ask; no IP address is kept. Prefer a conversation? The site has the same assistant built in, and Steven reads <a href="mailto:steven@wilssens.com">steven@wilssens.com</a>.</p>
`)

// 'owner' with the owner key (/mcp/<key>, or a bearer token on /mcp), 'public' for a
// bare /mcp, and null for a wrong key or an unknown path.
export const resolveMode = (segment: string | undefined, request: Request, env: Env): Mode | null => {
  const key = env.MCP_OWNER_KEY ?? ''
  if (segment !== undefined && segment !== '') return key && sameSecret(segment, key) ? 'owner' : null
  const bearer = bearerToken(request)
  if (bearer) return key && sameSecret(bearer, key) ? 'owner' : null
  return 'public'
}

export const handleMcp = async ({ request, store, fetchPage, mode = 'owner', github = null, now = Date.now(), place, limiter }: McpRequest): Promise<Response> => {
  if (request.method === 'OPTIONS') return respond(null, 204)
  if (request.method === 'GET') {
    // A GET with Accept: text/event-stream asks for a server-to-client stream; this server never sends one.
    if ((request.headers.get('Accept') ?? '').includes('text/event-stream')) return respond('Method Not Allowed: this server does not open server-to-client streams.', 405, { Allow: 'POST, OPTIONS' })
    const url = escapeHtml(new URL(request.url).toString())
    return respond(mode === 'owner' ? ownerExplainer(url) : publicExplainer(url), 200, { 'Content-Type': 'text/html; charset=utf-8', ...(mode === 'public' ? { 'Cache-Control': 'public, max-age=3600' } : {}) })
  }
  if (request.method !== 'POST') return respond(null, 405, { Allow: 'POST, OPTIONS' })
  // The public server has no model behind it, so a flood costs requests and log rows, not money;
  // the limit keeps one caller from filling the log or the request quota on their own.
  if (mode === 'public' && limiter && !(await limiter())) return jsonResponse(error(null, -32000, 'Too many requests from this connection; try again in an hour.'), 429)

  const body = await request.text()
  if (body.length > 200_000) return jsonResponse(error(null, -32600, 'Request too large'), 413)
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { return jsonResponse(error(null, -32700, 'Parse error'), 400) }

  const ctx: ToolContext = { store: mode === 'owner' ? store : publicView(store), now, fetchPage, github: mode === 'owner' ? github : null, mode }
  const messages = Array.isArray(parsed) ? parsed as JsonRpcRequest[] : [parsed as JsonRpcRequest]
  if (!messages.length) return jsonResponse(error(null, -32600, 'Invalid Request'), 400)
  const responses: JsonRpcResponse[] = []
  for (const message of messages) {
    const response = await handleMessage(message, ctx, place)
    if (response) responses.push(response)
  }
  if (!responses.length) return respond(null, 202)
  return jsonResponse(Array.isArray(parsed) ? responses : responses[0])
}

// The Pages Function entry used by functions/mcp.ts and functions/mcp/[[path]].ts.
export const onMcpRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const path = params.path
  const segments = Array.isArray(path) ? path : path ? [path] : []
  const mode = segments.length > 1 ? null : resolveMode(segments[0], request, env)
  if (!mode) return new Response('Not found', { status: 404 })
  // The site's own static files (the Markdown page copies), served by Pages next to the functions.
  const fetchPage = async (pagePath: string) => {
    const response = await env.ASSETS.fetch(new URL(pagePath, request.url).toString())
    return response.ok ? response.text() : null
  }
  const github = mode === 'owner' && env.GITHUB_TOKEN ? gitHubClient(env.GITHUB_TOKEN, env.GITHUB_REPO || defaultRepo) : null
  const cf = (request.cf ?? {}) as Partial<IncomingRequestCfProperties>
  const limiter = async () => {
    const hits = new D1AskStore(env.DB)
    const key = `${await ipHash(request, env)}:mcp`
    const now = Date.now()
    if (await hits.countHits(key, now - 3_600_000) >= PUBLIC_CALLS_PER_HOUR) return false
    await hits.addHit(key, now)
    return true
  }
  return handleMcp({ request, store: new D1Store(env.DB), fetchPage, mode, github, limiter, place: { country: (cf.country as string | undefined) ?? null, asOrg: (cf.asOrganization as string | undefined) ?? null } })
}
