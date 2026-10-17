// A stateless MCP server over Streamable HTTP (JSON-RPC 2.0 by POST, JSON
// responses). Public mode answers recruiters' assistants; owner mode, unlocked by
// the secret in the URL path (/mcp/<key>) or a bearer token, runs the interview.
import type { Env } from '../env'
import { bearerToken, sameSecret, visitorHash } from '../auth'
import { D1Store, type DossierStore } from './store'
import { ownerInstructions, publicInstructions, siteUrl, ToolError, tools, type ToolContext } from './tools'

export const serverInfo = { name: 'steven-wilssens', title: 'Steven Wilssens: career dossier', version: '1.0.0' }
const protocolVersions = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']
const latestProtocol = '2025-06-18'
const publicCallsPerHour = 120

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
  env: Env
  store: DossierStore
  owner: boolean
  waitUntil: (promise: Promise<unknown>) => void
  now?: number
}

const cfInfo = (request: Request) => {
  const cf = ((request as Request & { cf?: IncomingRequestCfProperties }).cf ?? {}) as Partial<IncomingRequestCfProperties>
  return { country: (cf.country as string | undefined) ?? null, asOrg: (cf.asOrganization as string | undefined) ?? null }
}

const toolResult = (value: unknown, isError = false) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }], isError })

const callTool = async (params: Record<string, unknown> | undefined, ctx: ToolContext, waitUntil: McpRequest['waitUntil']) => {
  const name = typeof params?.name === 'string' ? params.name : ''
  const tool = tools.find((item) => item.name === name && (ctx.owner || !item.owner))
  if (!tool) throw Object.assign(new Error(`Unknown tool: ${name || '(none)'}`), { code: -32602 })
  const rawArgs = params?.arguments
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs as Record<string, unknown> : {}
  if (!ctx.owner) {
    const calls = await ctx.store.countQuestions(ctx.visitor, ctx.now - 3_600_000)
    if (calls >= publicCallsPerHour) return toolResult('Rate limit reached for this connection: try again in an hour, or email steven@wilssens.com.', true)
  }
  try {
    const value = await tool.run(args, ctx)
    if (!ctx.owner) {
      const hits = value && typeof value === 'object' && 'results' in value && Array.isArray((value as { results: unknown[] }).results) ? (value as { results: unknown[] }).results.length : null
      waitUntil(ctx.store.logQuestion({ ts: ctx.now, visitor: ctx.visitor, tool: tool.name, query: tool.logQuery?.(args) ?? null, role: typeof args.role === 'string' ? args.role.slice(0, 60) : null, hits, country: ctx.country, asOrg: ctx.asOrg }).catch((err: unknown) => console.error('mcp log failed', err)))
    }
    return toolResult(value)
  } catch (err) {
    if (err instanceof ToolError) return toolResult(err.message, true)
    throw err
  }
}

const handleMessage = async (message: JsonRpcRequest, ctx: ToolContext, waitUntil: McpRequest['waitUntil']): Promise<JsonRpcResponse | null> => {
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
      return { jsonrpc: '2.0', id, result: { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo, instructions: ctx.owner ? ownerInstructions : publicInstructions } }
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} }
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: tools.filter((tool) => ctx.owner || !tool.owner).map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema, annotations: { readOnlyHint: tool.readOnly, destructiveHint: tool.name === 'delete_entry', openWorldHint: false } })) } }
    case 'tools/call':
      try {
        return { jsonrpc: '2.0', id, result: await callTool(params, ctx, waitUntil) }
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

// The page a browser sees at /mcp.
const explainer = (owner: boolean, url: string) => `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Steven Wilssens: MCP server</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;color:#1d2a22}code{background:#eef3ef;padding:2px 5px;border-radius:4px;font-size:14px}h1{font-size:1.5rem}a{color:#1f6f4a}</style>
<h1>Steven Wilssens: MCP server${owner ? ' (owner mode)' : ''}</h1>
<p>This address is a <a href="https://modelcontextprotocol.io">Model Context Protocol</a> server, not a web page. Add it to an AI assistant and ask it anything a recruiter or hiring manager would ask about Steven's work: his roles at Microsoft, outcomes with numbers, decisions, leadership, patents and recommendations. The answers come from notes Steven wrote himself; the assistant is told to say so when something is not covered.</p>
<p><strong>Claude:</strong> Settings → Connectors → Add custom connector, name it <em>Steven Wilssens</em> and paste <code>${url}</code>. No sign-in is needed.<br>
<strong>Claude Code:</strong> <code>claude mcp add --transport http steven-wilssens ${url}</code></p>
${owner ? '<p><strong>This URL carries your owner key.</strong> Keep it private: it unlocks the interview tools that write to the dossier.</p>' : '<p>Questions asked through this server are logged without IP addresses so Steven can fill gaps in his notes. Messages left for him are read by him alone.</p>'}
<p>Prefer a web page? <a href="${siteUrl}">steven.wilssens.com</a> · <a href="${siteUrl}/llms-full.txt">llms-full.txt</a></p>
`

// Routes /mcp and /mcp/<segment>. A segment that is not the owner key is a 404.
export const resolveMode = (segment: string | undefined, request: Request, env: Env): 'public' | 'owner' | 'unknown' => {
  const key = env.MCP_OWNER_KEY ?? ''
  if (segment !== undefined && segment !== '') return key && sameSecret(segment, key) ? 'owner' : 'unknown'
  const bearer = bearerToken(request)
  return bearer && key && sameSecret(bearer, key) ? 'owner' : 'public'
}

export const handleMcp = async ({ request, env, store, owner, waitUntil, now = Date.now() }: McpRequest): Promise<Response> => {
  if (request.method === 'OPTIONS') return respond(null, 204)
  if (request.method === 'GET') {
    // A GET with Accept: text/event-stream asks for a server-to-client stream; this server never sends one.
    if ((request.headers.get('Accept') ?? '').includes('text/event-stream')) return respond('Method Not Allowed: this server does not open server-to-client streams.', 405, { Allow: 'POST, OPTIONS' })
    return respond(explainer(owner, new URL(request.url).toString()), 200, { 'Content-Type': 'text/html; charset=utf-8' })
  }
  if (request.method === 'DELETE') return respond(null, 405, { Allow: 'POST, OPTIONS' })
  if (request.method !== 'POST') return respond(null, 405, { Allow: 'POST, OPTIONS' })

  const body = await request.text()
  if (body.length > 200_000) return jsonResponse(error(null, -32600, 'Request too large'), 413)
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { return jsonResponse(error(null, -32700, 'Parse error'), 400) }

  const { country, asOrg } = cfInfo(request)
  const ctx: ToolContext = { store, owner, now, visitor: owner ? 'owner' : await visitorHash(request, env, now), country, asOrg }
  const messages = Array.isArray(parsed) ? parsed as JsonRpcRequest[] : [parsed as JsonRpcRequest]
  if (!messages.length) return jsonResponse(error(null, -32600, 'Invalid Request'), 400)
  const responses: JsonRpcResponse[] = []
  for (const message of messages) {
    const response = await handleMessage(message, ctx, waitUntil)
    if (response) responses.push(response)
  }
  if (!responses.length) return respond(null, 202)
  return jsonResponse(Array.isArray(parsed) ? responses : responses[0])
}

// The Pages Function entry used by functions/mcp.ts and functions/mcp/[[path]].ts.
export const onMcpRequest: PagesFunction<Env> = async ({ request, env, params, waitUntil }) => {
  const path = params.path
  const segments = Array.isArray(path) ? path : path ? [path] : []
  if (segments.length > 1) return new Response('Not found', { status: 404 })
  const mode = resolveMode(segments[0], request, env)
  if (mode === 'unknown') return new Response('Not found', { status: 404 })
  return handleMcp({ request, env, store: new D1Store(env.DB), owner: mode === 'owner', waitUntil })
}
