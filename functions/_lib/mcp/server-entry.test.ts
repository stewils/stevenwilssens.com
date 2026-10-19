// @vitest-environment node
// The Pages Function entry of the MCP server (onMcpRequest) on a real-SQL D1, and the
// JSON-RPC edges server.test.ts leaves out: client responses, malformed messages,
// tools that fail unexpectedly and a public log that cannot be written.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { context, fakeAssets, fakeD1, type FakeD1 } from '../../api/_testing/d1'
import type { Env } from '../env'
import { handleMcp, onMcpRequest, PUBLIC_CALLS_PER_HOUR } from './server'
import { MemoryStore } from './store'

afterEach(() => vi.restoreAllMocks())

const base = 'https://steven.wilssens.com'
const rpc = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.7', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })
const environment = (db: FakeD1, extra: Partial<Env> = {}) => ({ DB: db, ASSETS: fakeAssets({ '/about.md': '# About\n\nSteven.' }), MCP_OWNER_KEY: 'owner-key-123', HASH_SALT: 'salt', ...extra }) as Env
const invoke = async (request: Request, env: Env, path?: string | string[]) => {
  const { ctx } = context(request, env, { params: (path === undefined ? {} : { path }) as Record<string, string> })
  return onMcpRequest(ctx as unknown as Parameters<typeof onMcpRequest>[0])
}
type Rpc = { result?: { content: { text: string }[]; isError: boolean; tools?: unknown[] }; error?: { code: number; message: string; data?: string } }

describe('the MCP entry point', () => {
  it('answers 404 for a wrong key, a deeper path or a wrong bearer token', async () => {
    const env = environment(fakeD1())
    expect((await invoke(rpc('/mcp/wrong', { jsonrpc: '2.0', id: 1, method: 'ping' }), env, 'wrong')).status).toBe(404)
    expect((await invoke(rpc('/mcp/owner-key-123/x', { jsonrpc: '2.0', id: 1, method: 'ping' }), env, ['owner-key-123', 'x'])).status).toBe(404)
    expect((await invoke(rpc('/mcp', { jsonrpc: '2.0', id: 1, method: 'ping' }, { Authorization: 'Bearer nope' }), env)).status).toBe(404)
  })

  it('serves the owner the whole dossier, the site pages and the analytics', async () => {
    const db = fakeD1()
    db.sqlite.prepare("INSERT INTO dossier (created_at, updated_at, role, topic, title, body, visibility, tags) VALUES (1, 1, 'general', 'scope', 'Private note', 'Hidden', 'private', NULL)").run()
    const env = environment(db)
    const list = await (await invoke(rpc('/mcp/owner-key-123', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_entries', arguments: {} } }), env, 'owner-key-123')).json() as Rpc
    expect(list.result?.content[0].text).toContain('Private note')
    const page = await (await invoke(rpc('/mcp/owner-key-123', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'read_site_page', arguments: { page: 'about' } } }), env, ['owner-key-123'])).json() as Rpc
    expect(page.result?.content[0].text).toBe('# About\n\nSteven.')
    const missing = await (await invoke(rpc('/mcp/owner-key-123', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_site_page', arguments: { page: 'news' } } }), env, 'owner-key-123')).json() as Rpc
    expect(missing.result).toMatchObject({ isError: true })
    const analytics = await (await invoke(rpc('/mcp', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'site_analytics', arguments: { days: 7 } } }, { Authorization: 'Bearer owner-key-123' }), env)).json() as Rpc
    expect(JSON.parse(analytics.result!.content[0].text)).toMatchObject({ days: 7, people: { visitors: 0 } })
  })

  it('starts the GitHub client only for the owner with a token, on the default repository', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => new Response(String(input).includes('/runs') ? JSON.stringify({ workflow_runs: [] }) : '[]'))
    const env = environment(fakeD1(), { GITHUB_TOKEN: 'gh' })
    const status = await (await invoke(rpc('/mcp/owner-key-123', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'site_update_status', arguments: {} } }), env, 'owner-key-123')).json() as Rpc
    expect(JSON.parse(status.result!.content[0].text)).toMatchObject({ runs: [], pullRequests: [] })
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/repos/stewils/stevenwilssens.com/')
    const custom = environment(fakeD1(), { GITHUB_TOKEN: 'gh', GITHUB_REPO: 'me/fork' })
    await invoke(rpc('/mcp/owner-key-123', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'site_update_status', arguments: {} } }), custom, 'owner-key-123')
    expect(String(fetchSpy.mock.calls.at(-1)?.[0])).toContain('/repos/me/fork/')
    const none = await (await invoke(rpc('/mcp/owner-key-123', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'site_update_status', arguments: {} } }), environment(fakeD1()), 'owner-key-123')).json() as Rpc
    expect(none.result?.isError).toBe(true)
  })

  it('serves the public read-only, logs each call with the caller\'s place, and limits each connection per hour', async () => {
    const db = fakeD1()
    const env = environment(db)
    const request = rpc('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'about_steven', arguments: {} } })
    Object.defineProperty(request, 'cf', { value: { country: 'NL', asOrganization: 'Recruit BV' } })
    const answer = await (await invoke(request, env)).json() as Rpc
    expect(answer.result?.isError).toBe(false)
    expect(db.sqlite.prepare('SELECT tool, country, as_org FROM mcp_calls').all().map((row) => ({ ...row }))).toEqual([{ tool: 'about_steven', country: 'NL', as_org: 'Recruit BV' }])
    const owner = await (await invoke(rpc('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_entries', arguments: {} } }), env)).json() as Rpc
    expect(owner.error?.code).toBe(-32602)

    const hits = db.sqlite.prepare('SELECT ip_hash, COUNT(*) AS n FROM ask_hits GROUP BY ip_hash').all() as { ip_hash: string; n: number }[]
    expect(hits).toHaveLength(1)
    expect(hits[0].ip_hash).toMatch(/^[0-9a-f]{32}:mcp$/)
    const insert = db.sqlite.prepare('INSERT INTO ask_hits (ip_hash, ts) VALUES (?, ?)')
    for (let i = 0; i < PUBLIC_CALLS_PER_HOUR; i++) insert.run(hits[0].ip_hash, Date.now())
    const limited = await invoke(rpc('/mcp', { jsonrpc: '2.0', id: 1, method: 'ping' }), env)
    expect(limited.status).toBe(429)
    // Another connection is not limited, and nothing about the place is required.
    expect((await invoke(rpc('/mcp', { jsonrpc: '2.0', id: 1, method: 'ping' }, { 'CF-Connecting-IP': '203.0.113.1' }), env)).status).toBe(200)
  })
})

describe('JSON-RPC edges', () => {
  const send = (body: unknown, store = new MemoryStore(), mode: 'owner' | 'public' = 'owner') =>
    handleMcp({ request: rpc('/mcp', body), store, fetchPage: async () => null, mode, now: 1_760_000_000_000 })

  it('needs no answer to a client response, and rejects malformed messages', async () => {
    expect((await send({ jsonrpc: '2.0', id: 5, result: {} })).status).toBe(202)
    expect((await send({ jsonrpc: '2.0', id: 5, error: { code: 1, message: 'x' } })).status).toBe(202)
    const invalid = await (await send({ jsonrpc: '1.0', id: 5, method: 'ping' })).json() as { id: number; error: { code: number } }
    expect(invalid).toMatchObject({ id: 5, error: { code: -32600 } })
    const noMethod = await (await send({ jsonrpc: '2.0', id: 6 })).json() as { error: { code: number } }
    expect(noMethod.error.code).toBe(-32600)
    const batch = await (await send([7, 'x', { jsonrpc: '2.0', id: 8, method: 'ping' }])).json() as { id: number | null; error?: { code: number } }[]
    expect(batch.map((item) => item.error?.code ?? 'ok')).toEqual([-32600, -32600, 'ok'])
    const empty = await send([])
    expect(empty.status).toBe(400)
  })

  it('throws on a null message instead of answering Invalid Request (reported: server.ts reads message.id before checking the message)', async () => {
    await expect(send(null)).rejects.toThrow(TypeError)
    await expect(send([null])).rejects.toThrow(TypeError)
  })

  it('refuses an oversized request', async () => {
    const response = await send({ jsonrpc: '2.0', id: 1, method: 'ping', params: { padding: 'x'.repeat(200_001) } })
    expect(response.status).toBe(413)
  })

  it('answers the unadvertised list methods with nothing, and ignores unknown notifications', async () => {
    expect(await (await send({ jsonrpc: '2.0', id: 1, method: 'prompts/list' })).json()).toEqual({ jsonrpc: '2.0', id: 1, result: { prompts: [] } })
    expect(await (await send({ jsonrpc: '2.0', id: 2, method: 'resources/list' })).json()).toEqual({ jsonrpc: '2.0', id: 2, result: { resources: [] } })
    expect((await send({ jsonrpc: '2.0', id: null, method: 'notifications/cancelled' })).status).toBe(202)
  })

  it('names no tool when the call has none, and ignores arguments that are not an object', async () => {
    const none = await (await send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {} })).json() as Rpc
    expect(none.error?.message).toBe('Unknown tool: (none)')
    const listed = await (await send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_entries', arguments: ['x'] } })).json() as Rpc
    expect(listed.result?.isError).toBe(false)
  })

  it('reports an unexpected failure inside a tool as an internal error', async () => {
    const store = new MemoryStore()
    store.list = async () => { throw new Error('D1 is down') }
    const answer = await (await send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'about_steven', arguments: {} } }, store)).json() as Rpc
    expect(answer.error).toEqual({ code: -32603, message: 'Internal error', data: 'Error: D1 is down' })
  })

  it('still answers a public call when its log cannot be written, and shortens the logged query and role', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = new MemoryStore()
    store.logToolCall = async () => { throw new Error('log full') }
    const answer = await (await send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_dossier', arguments: { query: 'kubernetes' } } }, store, 'public')).json() as Rpc
    expect(answer.result?.isError).toBe(false)
    expect(logged).toHaveBeenCalledWith('mcp log', expect.any(Error))

    const kept = new MemoryStore()
    await send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_role', arguments: { role: `x${'y'.repeat(100)}`, other: '   ' } } }, kept, 'public')
    await send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_dossier', arguments: { query: '  many   spaces  ' } } }, kept, 'public')
    await send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'search_dossier', arguments: { query: '   ' } } }, kept, 'public')
    expect(kept.calls[0].role).toHaveLength(60)
    expect(kept.calls[1].query).toBe('many spaces')
    expect(kept.calls[2].query).toBeNull()
  })
})
