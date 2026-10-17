import { describe, expect, it } from 'vitest'
import type { Env } from '../env'
import { handleMcp, resolveMode } from './server'
import { MemoryStore } from './store'
import { searchTerms } from './tools'

const env = { MCP_OWNER_KEY: 'owner-key-123', HASH_SALT: 'salt' } as unknown as Env
const url = 'https://steven.wilssens.com/mcp'

type Call = { request: Request; store: MemoryStore; owner?: boolean; now?: number }
const send = ({ request, store, owner = false, now = 1_760_000_000_000 }: Call) => handleMcp({ request, env, store, owner, waitUntil: (promise) => { void promise }, now })

const rpc = (body: unknown, headers: Record<string, string> = {}) => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'CF-Connecting-IP': '203.0.113.7', ...headers }, body: JSON.stringify(body) })
const call = async (store: MemoryStore, owner: boolean, name: string, args: Record<string, unknown> = {}, id = 1) => {
  const response = await send({ request: rpc({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }), store, owner })
  const body = await response.json() as { result?: { content: { text: string }[]; isError: boolean }; error?: { code: number; message: string } }
  return { status: response.status, body, text: body.result?.content[0]?.text ?? '', isError: body.result?.isError }
}
const parse = (text: string) => JSON.parse(text) as Record<string, unknown>

describe('mode', () => {
  it('is public without a key, owner with the key in the path or as a bearer, unknown otherwise', () => {
    const plain = new Request(url)
    expect(resolveMode(undefined, plain, env)).toBe('public')
    expect(resolveMode('owner-key-123', plain, env)).toBe('owner')
    expect(resolveMode('wrong', plain, env)).toBe('unknown')
    expect(resolveMode(undefined, new Request(url, { headers: { Authorization: 'Bearer owner-key-123' } }), env)).toBe('owner')
    expect(resolveMode('owner-key-123', plain, { ...env, MCP_OWNER_KEY: undefined } as Env)).toBe('unknown')
  })
})

describe('transport', () => {
  it('explains itself to a browser and refuses server-to-client streams', async () => {
    const store = new MemoryStore()
    const page = await send({ request: new Request(url, { headers: { Accept: 'text/html' } }), store })
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('Add custom connector')
    const stream = await send({ request: new Request(url, { headers: { Accept: 'text/event-stream' } }), store })
    expect(stream.status).toBe(405)
    expect((await send({ request: new Request(url, { method: 'OPTIONS' }), store })).status).toBe(204)
  })

  it('handles initialize, the initialized notification and ping', async () => {
    const store = new MemoryStore()
    const init = await send({ request: rpc({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }), store })
    expect(init.status).toBe(200)
    const body = await init.json() as { result: { protocolVersion: string; instructions: string; capabilities: { tools: unknown } } }
    expect(body.result.protocolVersion).toBe('2025-03-26')
    expect(body.result.capabilities.tools).toBeTruthy()
    expect(body.result.instructions).toContain('recruiters')
    expect(body.result.instructions).not.toContain('owner, is connected')

    const notified = await send({ request: rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }), store })
    expect(notified.status).toBe(202)

    const ping = await send({ request: rpc({ jsonrpc: '2.0', id: 'p', method: 'ping' }), store })
    expect(await ping.json()).toEqual({ jsonrpc: '2.0', id: 'p', result: {} })
  })

  it('falls back to a known protocol version and rejects garbage', async () => {
    const store = new MemoryStore()
    const init = await send({ request: rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }), store })
    expect(((await init.json()) as { result: { protocolVersion: string } }).result.protocolVersion).toBe('2025-06-18')
    const bad = await send({ request: new Request(url, { method: 'POST', body: '{not json' }), store })
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as { error: { code: number } }).error.code).toBe(-32700)
    const unknown = await send({ request: rpc({ jsonrpc: '2.0', id: 2, method: 'resources/read' }), store })
    expect(((await unknown.json()) as { error: { code: number } }).error.code).toBe(-32601)
  })

  it('answers a batch with a batch', async () => {
    const store = new MemoryStore()
    const response = await send({ request: rpc([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'ping' }]), store })
    const body = await response.json() as { id: number }[]
    expect(body.map((item) => item.id)).toEqual([1, 2])
  })
})

describe('tools', () => {
  it('lists only public tools in public mode and all tools for the owner', async () => {
    const store = new MemoryStore()
    const list = async (owner: boolean) => {
      const response = await send({ request: rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), store, owner })
      return ((await response.json()) as { result: { tools: { name: string }[] } }).result.tools.map((tool) => tool.name)
    }
    const publicTools = await list(false)
    expect(publicTools).toEqual(['about_steven', 'get_role', 'search_experience', 'get_recommendations', 'get_patents_and_press', 'leave_message'])
    const ownerTools = await list(true)
    expect(ownerTools).toEqual(expect.arrayContaining([...publicTools, 'interview_status', 'save_entry', 'update_entry', 'delete_entry', 'list_entries', 'export_dossier', 'recent_activity', 'get_resume', 'propose_resume_change', 'list_resume_proposals', 'review_resume_proposal']))
  })

  it('refuses owner tools in public mode', async () => {
    const store = new MemoryStore()
    const result = await call(store, false, 'save_entry', { role: 'csx-data', topic: 'scope', title: 'x', body: 'y' })
    expect(result.body.error?.code).toBe(-32602)
    expect(store.entries).toHaveLength(0)
  })

  it('serves the résumé data to anyone', async () => {
    const store = new MemoryStore()
    const about = parse((await call(store, false, 'about_steven')).text)
    expect((about.roles as { key: string }[]).map((role) => role.key)).toContain('windows-devices-data')
    expect((about.contact as { email: string }).email).toBe('steven@wilssens.com')
    const role = parse((await call(store, false, 'get_role', { role: 'spatial-audio-lead' })).text)
    expect(role.role).toContain('Principal Product Manager Lead')
    expect(role.note).toContain('has not covered')
    const bad = await call(store, false, 'get_role', { role: 'ceo' })
    expect(bad.isError).toBe(true)
    expect(bad.text).toContain('unknown role')
    const proof = parse((await call(store, false, 'get_patents_and_press')).text)
    expect((proof.grantedPatents as unknown[]).length).toBeGreaterThan(5)
    const recs = parse((await call(store, false, 'get_recommendations')).text)
    expect((recs.recommendations as { linkedin: string }[])[0].linkedin).toContain('linkedin.com')
  })

  it('saves entries in owner mode and shows recruiters only the public ones', async () => {
    const store = new MemoryStore()
    const saved = await call(store, true, 'save_entry', { role: 'windows-devices-data', topic: 'scope', title: 'Led 9 PMs across experimentation and insights', body: 'Steven led a team of nine product managers covering experimentation, customer signals and ML insight products.', tags: 'resume, team size' })
    expect(saved.isError).toBe(false)
    const entry = (parse(saved.text).saved as { id: number; visibility: string })
    expect(entry.visibility).toBe('private')
    await call(store, true, 'save_entry', { role: 'windows-devices-data', topic: 'outcomes', title: 'Internal metric', body: 'Confidential numbers about experimentation volume.', visibility: 'private' })

    const hidden = parse((await call(store, false, 'search_experience', { query: 'How big was his experimentation team?' })).text)
    expect(hidden.results).toEqual([])
    expect(hidden.note).toContain('has not covered')

    const made = await call(store, true, 'update_entry', { id: entry.id, visibility: 'public' })
    expect((parse(made.text).updated as { visibility: string }).visibility).toBe('public')

    const found = parse((await call(store, false, 'search_experience', { query: 'How big was his experimentation team?' })).text)
    expect((found.results as { id: number }[]).map((item) => item.id)).toEqual([entry.id])
    expect(found.matchedTerms).toEqual(['big', 'experimentation', 'team'])
    expect((found.results as Record<string, unknown>[])[0]).not.toHaveProperty('visibility')

    const forOwner = parse((await call(store, true, 'get_role', { role: 'windows-devices-data' })).text)
    expect((forOwner.entries as unknown[]).length).toBe(2)
    const forPublic = parse((await call(store, false, 'get_role', { role: 'windows-devices-data' })).text)
    expect((forPublic.entries as unknown[]).length).toBe(1)

    const markdown = (await call(store, true, 'export_dossier')).text
    expect(markdown).toContain('## Principal Group Product Manager - Windows & Devices Data, Microsoft')
    expect(markdown).toContain('### scope')
    expect(markdown).toContain('Confidential numbers')
    expect((await call(store, true, 'export_dossier', { visibility: 'public' })).text).not.toContain('Confidential numbers')

    const removed = await call(store, true, 'delete_entry', { id: entry.id })
    expect(parse(removed.text).deleted).toBe(entry.id)
    expect((await call(store, true, 'delete_entry', { id: 999 })).isError).toBe(true)
  })

  it('validates entry fields', async () => {
    const store = new MemoryStore()
    expect((await call(store, true, 'save_entry', { role: 'csx-data', topic: 'Not A Slug', title: 'x', body: 'y' })).text).toContain('topic must be')
    expect((await call(store, true, 'save_entry', { role: 'csx-data', topic: 'scope', title: 'x', body: 'y', visibility: 'secret' })).text).toContain('visibility must be')
    expect((await call(store, true, 'save_entry', { role: 'csx-data', topic: 'scope', title: '', body: 'y' })).text).toContain('title is required')
    expect((await call(store, true, 'update_entry', { id: 1 })).text).toContain('nothing to change')
  })

  it('tells the interviewer what is missing and what to ask next', async () => {
    const store = new MemoryStore()
    await call(store, true, 'save_entry', { role: 'windows-devices-data', topic: 'scope', title: 't', body: 'b' })
    const status = parse((await call(store, true, 'interview_status')).text)
    const roles = status.roles as { key: string; missingTopics: string[]; entries: number }[]
    const latest = roles.find((role) => role.key === 'windows-devices-data')!
    expect(latest.entries).toBe(1)
    expect(latest.missingTopics).not.toContain('scope')
    expect(latest.missingTopics).toContain('outcomes')
    const next = status.suggestedNext as { role: string; topic: string; question: string }[]
    expect(next[0]).toMatchObject({ role: 'windows-devices-data', topic: 'outcomes' })
    expect(next[0].question).toContain('résumé')
    expect(next.some((item) => item.role === 'general')).toBe(true)
  })

  it('logs public calls, counts search hits, and surfaces them to the owner', async () => {
    const store = new MemoryStore()
    await call(store, false, 'about_steven')
    await call(store, false, 'search_experience', { query: 'spatial audio growth' })
    await call(store, true, 'list_entries')
    expect(store.questions.map((q) => q.tool)).toEqual(['about_steven', 'search_experience'])
    expect(store.questions[1]).toMatchObject({ query: 'spatial audio growth', hits: 0 })
    expect(store.questions[0].visitor).toMatch(/^[0-9a-f]{16}$/)
    const activity = parse((await call(store, true, 'recent_activity', { days: 7 })).text)
    expect(activity.unanswered).toEqual(['spatial audio growth'])
  })

  it('rate limits a public connection and keeps messages to five an hour', async () => {
    // The visitor hash is deterministic for the same IP, agent, salt and day, so one real call reveals it.
    const store = new MemoryStore()
    await call(store, false, 'about_steven')
    const visitor = store.questions[0].visitor
    for (let i = 0; i < 119; i++) store.questions.push({ ts: 1_760_000_000_000 - 1000, visitor, tool: 'about_steven', query: null, role: null, hits: null, country: null, asOrg: null })
    const limited = await call(store, false, 'about_steven')
    expect(limited.isError).toBe(true)
    expect(limited.text).toContain('Rate limit')

    const fresh = new MemoryStore()
    for (let i = 0; i < 5; i++) expect((await call(fresh, false, 'leave_message', { message: `hello ${i}`, name: 'A recruiter' })).isError).toBe(false)
    expect(fresh.messages).toHaveLength(5)
    expect((await call(fresh, false, 'leave_message', { message: 'one more' })).text).toContain('Too many messages')
    expect((await call(fresh, false, 'leave_message', { name: 'no text' })).text).toContain('message is required')
  })

  it('proposes résumé changes for the owner to approve or reject', async () => {
    const store = new MemoryStore()
    const resume = parse((await call(store, true, 'get_resume')).text)
    const roles = resume.roles as { key: string; points: string[] }[]
    const current = roles.find((role) => role.key === 'spatial-audio-lead')!.points[1]
    expect(current).toContain('250%')

    const missing = await call(store, true, 'propose_resume_change', { role: 'spatial-audio-lead', kind: 'replace', proposed_text: 'x', rationale: 'y' })
    expect(missing.text).toContain('current_text is required')

    const proposed = await call(store, true, 'propose_resume_change', { role: 'spatial-audio-lead', kind: 'replace', current_text: current, proposed_text: 'Grew monthly active spatial audio devices 250% in 18 months by shipping Dolby Atmos and DTS:X across Windows and Xbox.', rationale: 'Names the technologies, from entries 4 and 7.', based_on: '4,7' })
    const proposal = parse(proposed.text).proposed as { id: number; status: string }
    expect(proposal.status).toBe('proposed')

    const pending = parse((await call(store, true, 'list_resume_proposals', { status: 'proposed' })).text)
    expect(pending.count).toBe(1)

    const reviewed = parse((await call(store, true, 'review_resume_proposal', { id: proposal.id, decision: 'approve', note: 'Keep "1.5 years" rather than 18 months.' })).text)
    expect((reviewed.reviewed as { status: string; decisionNote: string }).status).toBe('approved')
    expect((reviewed.reviewed as { decisionNote: string }).decisionNote).toContain('1.5 years')
    expect(parse((await call(store, true, 'list_resume_proposals', { status: 'proposed' })).text).count).toBe(0)
    expect((await call(store, true, 'review_resume_proposal', { id: 42, decision: 'reject' })).text).toContain('no proposal')
    expect((await call(store, true, 'review_resume_proposal', { id: proposal.id, decision: 'maybe' })).text).toContain('decision must be')

    // Recruiters never see the résumé tools.
    expect((await call(store, false, 'list_resume_proposals')).body.error?.code).toBe(-32602)
  })

  it('tells the owner how to wrap up with résumé proposals', async () => {
    const store = new MemoryStore()
    const init = await send({ request: rpc({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18' } }), store, owner: true })
    const instructions = ((await init.json()) as { result: { instructions: string } }).result.instructions
    expect(instructions).toContain('interview_status first')
    expect(instructions).toContain('propose_resume_change')
    expect(instructions).toContain('review_resume_proposal')
  })
})

describe('searchTerms', () => {
  it('keeps the words that carry meaning', () => {
    expect(searchTerms('What did Steven ship for Xbox in 2019?')).toEqual(['ship', 'xbox', '2019'])
    expect(searchTerms('C# and .NET at Info Support')).toEqual(['c#', 'net', 'info', 'support'])
    expect(searchTerms('the and for')).toEqual([])
  })
})
