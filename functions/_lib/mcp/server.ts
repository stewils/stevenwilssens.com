// Steven's private MCP server over Streamable HTTP (JSON-RPC 2.0 by POST, JSON
// responses, stateless). It only answers with the owner key, in the URL path
// (/mcp/<key>, for Claude's connector settings) or as a bearer token (for
// Claude Code). Anything else is a 404. Recruiters never talk to this server;
// they will get an assistant on the site itself.
import type { Env } from '../env'
import { bearerToken, sameSecret } from '../auth'
import { D1Store, type DossierStore } from './store'
import { instructions, siteUrl, ToolError, tools, type ToolContext } from './tools'

export const serverInfo = { name: 'steven-wilssens', title: 'Steven Wilssens: career dossier', version: '2.0.0' }
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
  now?: number
}

const toolResult = (value: unknown, isError = false) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }], isError })

const callTool = async (params: Record<string, unknown> | undefined, ctx: ToolContext) => {
  const name = typeof params?.name === 'string' ? params.name : ''
  const tool = tools.find((item) => item.name === name)
  if (!tool) throw Object.assign(new Error(`Unknown tool: ${name || '(none)'}`), { code: -32602 })
  const rawArgs = params?.arguments
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs as Record<string, unknown> : {}
  try {
    return toolResult(await tool.run(args, ctx))
  } catch (err) {
    if (err instanceof ToolError) return toolResult(err.message, true)
    throw err
  }
}

const handleMessage = async (message: JsonRpcRequest, ctx: ToolContext): Promise<JsonRpcResponse | null> => {
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
      return { jsonrpc: '2.0', id, result: { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo, instructions } }
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} }
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema, annotations: { readOnlyHint: tool.readOnly, destructiveHint: tool.name === 'delete_entry', openWorldHint: false } })) } }
    case 'tools/call':
      try {
        return { jsonrpc: '2.0', id, result: await callTool(params, ctx) }
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

// What a browser sees when the owner opens the link.
const explainer = (url: string) => `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Steven Wilssens: private MCP server</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;color:#1d2a22}code{background:#eef3ef;padding:2px 5px;border-radius:4px;font-size:14px;overflow-wrap:anywhere}h1{font-size:1.5rem}a{color:#1f6f4a}</style>
<h1>Your private MCP server</h1>
<p>This address is a <a href="https://modelcontextprotocol.io">Model Context Protocol</a> server for one person: you. Add it to Claude and talk through your career; Claude reads what is already on <a href="${siteUrl}">steven.wilssens.com</a> and in the dossier, interviews you where there are gaps, saves what you say, and proposes résumé edits for you to approve or reject.</p>
<p><strong>Claude:</strong> Settings → Connectors → Add custom connector, name it <em>My career</em> and paste <code>${url}</code>. No sign-in step: the key in the address is the sign-in.<br>
<strong>Claude Code:</strong> <code>claude mcp add --transport http my-career ${url}</code></p>
<p><strong>Keep this link private.</strong> Anyone with it can read and change the dossier. Rotate it by setting a new <code>MCP_OWNER_KEY</code> secret.</p>
`

// /mcp/<segment> with the owner key, or /mcp with the key as a bearer token. Anything else: 'none'.
export const resolveOwner = (segment: string | undefined, request: Request, env: Env) => {
  const key = env.MCP_OWNER_KEY ?? ''
  if (!key) return false
  if (segment !== undefined && segment !== '') return sameSecret(segment, key)
  const bearer = bearerToken(request)
  return Boolean(bearer) && sameSecret(bearer, key)
}

export const handleMcp = async ({ request, store, fetchPage, now = Date.now() }: McpRequest): Promise<Response> => {
  if (request.method === 'OPTIONS') return respond(null, 204)
  if (request.method === 'GET') {
    // A GET with Accept: text/event-stream asks for a server-to-client stream; this server never sends one.
    if ((request.headers.get('Accept') ?? '').includes('text/event-stream')) return respond('Method Not Allowed: this server does not open server-to-client streams.', 405, { Allow: 'POST, OPTIONS' })
    return respond(explainer(new URL(request.url).toString()), 200, { 'Content-Type': 'text/html; charset=utf-8' })
  }
  if (request.method !== 'POST') return respond(null, 405, { Allow: 'POST, OPTIONS' })

  const body = await request.text()
  if (body.length > 200_000) return jsonResponse(error(null, -32600, 'Request too large'), 413)
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { return jsonResponse(error(null, -32700, 'Parse error'), 400) }

  const ctx: ToolContext = { store, now, fetchPage }
  const messages = Array.isArray(parsed) ? parsed as JsonRpcRequest[] : [parsed as JsonRpcRequest]
  if (!messages.length) return jsonResponse(error(null, -32600, 'Invalid Request'), 400)
  const responses: JsonRpcResponse[] = []
  for (const message of messages) {
    const response = await handleMessage(message, ctx)
    if (response) responses.push(response)
  }
  if (!responses.length) return respond(null, 202)
  return jsonResponse(Array.isArray(parsed) ? responses : responses[0])
}

// The Pages Function entry used by functions/mcp.ts and functions/mcp/[[path]].ts.
export const onMcpRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const path = params.path
  const segments = Array.isArray(path) ? path : path ? [path] : []
  if (segments.length > 1 || !resolveOwner(segments[0], request, env)) return new Response('Not found', { status: 404 })
  // The site's own static files (the Markdown page copies), served by Pages next to the functions.
  const fetchPage = async (pagePath: string) => {
    const response = await env.ASSETS.fetch(new URL(pagePath, request.url).toString())
    return response.ok ? response.text() : null
  }
  return handleMcp({ request, store: new D1Store(env.DB), fetchPage })
}
