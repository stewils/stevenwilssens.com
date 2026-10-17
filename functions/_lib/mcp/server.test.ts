import { describe, expect, it } from 'vitest'
import type { Env } from '../env'
import { handleMcp, resolveOwner } from './server'
import { MemoryStore } from './store'
import { recruiterLens, searchTerms, sitePages } from './tools'

const env = { MCP_OWNER_KEY: 'owner-key-123' } as unknown as Env
const url = 'https://steven.wilssens.com/mcp/owner-key-123'

const pages: Record<string, string> = { '/about.md': '# About\n\nAfter more than a decade at Microsoft...', '/llms-full.txt': '# Steven Wilssens\n\nEverything.' }
const send = (request: Request, store: MemoryStore, now = 1_760_000_000_000) => handleMcp({ request, store, fetchPage: async (path) => pages[path] ?? null, now })

const rpc = (body: unknown) => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) })
const call = async (store: MemoryStore, name: string, args: Record<string, unknown> = {}, id = 1) => {
  const response = await send(rpc({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }), store)
  const body = await response.json() as { result?: { content: { text: string }[]; isError: boolean }; error?: { code: number; message: string } }
  return { status: response.status, body, text: body.result?.content[0]?.text ?? '', isError: body.result?.isError }
}
const parse = (text: string) => JSON.parse(text) as Record<string, unknown>

describe('access', () => {
  it('opens only with the owner key, in the path or as a bearer token', () => {
    const plain = new Request(url)
    expect(resolveOwner('owner-key-123', plain, env)).toBe(true)
    expect(resolveOwner('wrong', plain, env)).toBe(false)
    expect(resolveOwner(undefined, plain, env)).toBe(false)
    expect(resolveOwner(undefined, new Request(url, { headers: { Authorization: 'Bearer owner-key-123' } }), env)).toBe(true)
    expect(resolveOwner('owner-key-123', plain, { ...env, MCP_OWNER_KEY: undefined } as Env)).toBe(false)
    expect(resolveOwner('owner-key-123', plain, { ...env, MCP_OWNER_KEY: '' } as Env)).toBe(false)
  })
})

describe('transport', () => {
  it('explains itself to a browser and refuses server-to-client streams', async () => {
    const store = new MemoryStore()
    const page = await send(new Request(url, { headers: { Accept: 'text/html' } }), store)
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('Add custom connector')
    expect(html).toContain('Keep this link private')
    const stream = await send(new Request(url, { headers: { Accept: 'text/event-stream' } }), store)
    expect(stream.status).toBe(405)
    expect((await send(new Request(url, { method: 'OPTIONS' }), store)).status).toBe(204)
    expect((await send(new Request(url, { method: 'DELETE' }), store)).status).toBe(405)
  })

  it('handles initialize, the initialized notification and ping', async () => {
    const store = new MemoryStore()
    const init = await send(rpc({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }), store)
    expect(init.status).toBe(200)
    const body = await init.json() as { result: { protocolVersion: string; instructions: string; capabilities: { tools: unknown } } }
    expect(body.result.protocolVersion).toBe('2025-03-26')
    expect(body.result.capabilities.tools).toBeTruthy()
    expect(body.result.instructions).toContain('Build on what is already there')
    expect(body.result.instructions).toContain('propose_resume_change')

    const notified = await send(rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }), store)
    expect(notified.status).toBe(202)

    const ping = await send(rpc({ jsonrpc: '2.0', id: 'p', method: 'ping' }), store)
    expect(await ping.json()).toEqual({ jsonrpc: '2.0', id: 'p', result: {} })
  })

  it('falls back to a known protocol version and rejects garbage', async () => {
    const store = new MemoryStore()
    const init = await send(rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }), store)
    expect(((await init.json()) as { result: { protocolVersion: string } }).result.protocolVersion).toBe('2025-06-18')
    const bad = await send(new Request(url, { method: 'POST', body: '{not json' }), store)
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as { error: { code: number } }).error.code).toBe(-32700)
    const unknown = await send(rpc({ jsonrpc: '2.0', id: 2, method: 'resources/read' }), store)
    expect(((await unknown.json()) as { error: { code: number } }).error.code).toBe(-32601)
    const noTool = await call(store, 'leave_message', { message: 'hi' })
    expect(noTool.body.error?.code).toBe(-32602)
  })

  it('answers a batch with a batch', async () => {
    const store = new MemoryStore()
    const response = await send(rpc([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'ping' }]), store)
    const body = await response.json() as { id: number }[]
    expect(body.map((item) => item.id)).toEqual([1, 2])
  })
})

describe('what is already there', () => {
  it('lists every tool with annotations', async () => {
    const response = await send(rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), new MemoryStore())
    const tools = ((await response.json()) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] } }).result.tools
    expect(tools.map((tool) => tool.name)).toEqual(['about_steven', 'read_site_page', 'get_role', 'search_dossier', 'get_recommendations', 'get_patents_and_press', 'interview_status', 'save_entry', 'update_entry', 'delete_entry', 'list_entries', 'export_dossier', 'get_resume', 'propose_resume_change', 'list_resume_proposals', 'review_resume_proposal', 'review_for_recruiters', 'check_resume', 'save_linkedin_profile', 'compare_linkedin', 'request_site_update', 'site_update_status', 'merge_site_update'])
    expect(tools.find((tool) => tool.name === 'save_entry')!.annotations.readOnlyHint).toBe(false)
    expect(tools.find((tool) => tool.name === 'get_role')!.annotations.readOnlyHint).toBe(true)
  })

  it('serves the résumé data, recommendations, patents and press', async () => {
    const store = new MemoryStore()
    const about = parse((await call(store, 'about_steven')).text)
    expect((about.roles as { key: string }[]).map((role) => role.key)).toContain('windows-devices-data')
    expect((about.contact as { email: string }).email).toBe('steven@wilssens.com')
    expect(about.sitePages).toEqual(sitePages)
    const role = parse((await call(store, 'get_role', { role: 'spatial-audio-lead' })).text)
    expect(role.role).toContain('Principal Product Manager Lead')
    expect(role.entries).toEqual([])
    const bad = await call(store, 'get_role', { role: 'ceo' })
    expect(bad.isError).toBe(true)
    expect(bad.text).toContain('unknown role')
    const proof = parse((await call(store, 'get_patents_and_press')).text)
    expect((proof.grantedPatents as unknown[]).length).toBeGreaterThan(5)
    const recs = parse((await call(store, 'get_recommendations')).text)
    expect((recs.recommendations as { linkedin: string }[])[0].linkedin).toContain('linkedin.com')
  })

  it('reads the published pages as Markdown', async () => {
    const store = new MemoryStore()
    expect(sitePages).toContain('building-wilssens')
    expect(sitePages).not.toContain('privacy')
    expect((await call(store, 'read_site_page', { page: 'about' })).text).toContain('# About')
    expect((await call(store, 'read_site_page', { page: 'llms-full' })).text).toContain('Everything')
    const missing = await call(store, 'read_site_page', { page: 'experience' })
    expect(missing.isError).toBe(true)
    expect(missing.text).toContain('/experience.md is not available')
    expect((await call(store, 'read_site_page', { page: 'admin' })).text).toContain('unknown page')
  })
})

describe('the dossier', () => {
  it('saves, searches, updates, exports and deletes entries', async () => {
    const store = new MemoryStore()
    const saved = await call(store, 'save_entry', { role: 'windows-devices-data', topic: 'scope', title: 'Led 9 PMs across experimentation and insights', body: 'Steven led a team of nine product managers covering experimentation, customer signals and ML insight products.', tags: 'resume, team size' })
    expect(saved.isError).toBe(false)
    const entry = (parse(saved.text).saved as { id: number; visibility: string })
    expect(entry.visibility).toBe('private')
    await call(store, 'save_entry', { role: 'windows-devices-data', topic: 'outcomes', title: 'Internal metric', body: 'Confidential numbers about experimentation volume.' })

    const found = parse((await call(store, 'search_dossier', { query: 'How big was his experimentation team?' })).text)
    expect(found.matchedTerms).toEqual(['big', 'experimentation', 'team'])
    expect((found.results as { id: number }[]).map((item) => item.id)).toEqual([entry.id, entry.id + 1])
    expect((parse((await call(store, 'search_dossier', { query: 'nine product managers', role: 'csx-data' })).text).results as unknown[])).toEqual([])

    const made = await call(store, 'update_entry', { id: entry.id, visibility: 'public' })
    expect((parse(made.text).updated as { visibility: string }).visibility).toBe('public')
    expect((parse((await call(store, 'get_role', { role: 'windows-devices-data' })).text).entries as unknown[]).length).toBe(2)
    expect(parse((await call(store, 'list_entries', { visibility: 'public' })).text).count).toBe(1)

    const markdown = (await call(store, 'export_dossier')).text
    expect(markdown).toContain('## Principal Group Product Manager - Windows & Devices Data, Microsoft')
    expect(markdown).toContain('### scope')
    expect(markdown).toContain('Confidential numbers')
    expect((await call(store, 'export_dossier', { visibility: 'public' })).text).not.toContain('Confidential numbers')

    const removed = await call(store, 'delete_entry', { id: entry.id })
    expect(parse(removed.text).deleted).toBe(entry.id)
    expect((await call(store, 'delete_entry', { id: 999 })).isError).toBe(true)
  })

  it('validates entry fields', async () => {
    const store = new MemoryStore()
    expect((await call(store, 'save_entry', { role: 'csx-data', topic: 'Not A Slug', title: 'x', body: 'y' })).text).toContain('topic must be')
    expect((await call(store, 'save_entry', { role: 'csx-data', topic: 'scope', title: 'x', body: 'y', visibility: 'secret' })).text).toContain('visibility must be')
    expect((await call(store, 'save_entry', { role: 'csx-data', topic: 'scope', title: '', body: 'y' })).text).toContain('title is required')
    expect((await call(store, 'update_entry', { id: 1 })).text).toContain('nothing to change')
  })

  it('tells the interviewer what is missing and what to ask next', async () => {
    const store = new MemoryStore()
    await call(store, 'save_entry', { role: 'windows-devices-data', topic: 'scope', title: 't', body: 'b' })
    const status = parse((await call(store, 'interview_status')).text)
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

  it('looks at each role the way a recruiter would, and brings in what the site assistant could not answer', async () => {
    const store = new MemoryStore()
    store.gaps.push({ question: 'How many people did he hire?', when: '2026-10-16', reason: 'gap' })
    const status = parse((await call(store, 'interview_status')).text)
    const roles = status.roles as { key: string; recruiterFlags: string[]; recruiterAngles: string[] }[]
    expect(roles.find((role) => role.key === 'azure-devops')!.recruiterFlags).toEqual(['Short stint: 6 months.'])
    expect(roles.find((role) => role.key === 'spatial-audio-senior')!.recruiterFlags).toContain('9 years in one role without a visible promotion.')
    expect(roles.find((role) => role.key === 'cosmos')!.recruiterFlags.some((flag) => flag.startsWith('Overlaps with'))).toBe(true)
    expect(roles.find((role) => role.key === 'spatial-audio-senior')!.recruiterFlags.some((flag) => flag.startsWith('Company change'))).toBe(true)
    expect(roles.find((role) => role.key === 'windows-devices-data')!.recruiterAngles.length).toBeGreaterThan(2)
    expect(roles.find((role) => role.key === 'general')!.recruiterAngles.some((angle) => angle.includes('Why leave Microsoft'))).toBe(true)
    expect(status.askedOnTheSite).toEqual([{ question: 'How many people did he hire?', when: '2026-10-16', reason: 'gap' }])
    expect(status.howToInterview).toContain('sceptical recruiter')
    expect(recruiterLens('general').flags).toEqual([])
  })
})

describe('the résumé', () => {
  it('proposes changes for Steven to approve or reject', async () => {
    const store = new MemoryStore()
    const resume = parse((await call(store, 'get_resume')).text)
    const roles = resume.roles as { key: string; points: string[] }[]
    const current = roles.find((role) => role.key === 'spatial-audio-lead')!.points[1]
    expect(current).toContain('250%')
    expect((resume.pages as Record<string, string>)['building-wilssens']).toBeTruthy()

    const missing = await call(store, 'propose_resume_change', { role: 'spatial-audio-lead', kind: 'replace', proposed_text: 'x', rationale: 'y' })
    expect(missing.text).toContain('current_text is required')

    const proposed = await call(store, 'propose_resume_change', { role: 'spatial-audio-lead', kind: 'replace', current_text: current, proposed_text: 'Grew monthly active spatial audio devices 250% in 18 months by shipping Dolby Atmos and DTS:X across Windows and Xbox.', rationale: 'Names the technologies, from entries 4 and 7.', based_on: '4,7' })
    const proposal = parse(proposed.text).proposed as { id: number; status: string }
    expect(proposal.status).toBe('proposed')

    const pending = parse((await call(store, 'list_resume_proposals', { status: 'proposed' })).text)
    expect(pending.count).toBe(1)

    const reviewed = parse((await call(store, 'review_resume_proposal', { id: proposal.id, decision: 'approve', note: 'Keep "1.5 years" rather than 18 months.' })).text)
    expect((reviewed.reviewed as { status: string; decisionNote: string }).status).toBe('approved')
    expect((reviewed.reviewed as { decisionNote: string }).decisionNote).toContain('1.5 years')
    expect(parse((await call(store, 'list_resume_proposals', { status: 'proposed' })).text).count).toBe(0)
    expect((await call(store, 'review_resume_proposal', { id: 42, decision: 'reject' })).text).toContain('no proposal')
    expect((await call(store, 'review_resume_proposal', { id: proposal.id, decision: 'maybe' })).text).toContain('decision must be')
  })

  it('proposes changes to the dates, title and other fields of a role, checking the current value', async () => {
    const store = new MemoryStore()
    const wrong = await call(store, 'propose_resume_change', { role: 'compuware', field: 'dates', kind: 'replace', current_text: 'Jan 2005 - Dec 2007', proposed_text: 'Jan 2005 - Jun 2007', rationale: 'Left mid-2007.' })
    expect(wrong.text).toContain('does not match the résumé')
    const badFormat = await call(store, 'propose_resume_change', { role: 'compuware', field: 'dates', kind: 'replace', current_text: 'Jan 2005 - Dec 2006', proposed_text: 'January 2005 to June 2007', rationale: 'x' })
    expect(badFormat.text).toContain('written like')
    const notAdd = await call(store, 'propose_resume_change', { role: 'compuware', field: 'dates', kind: 'add', proposed_text: 'Jan 2005 - Jun 2007', rationale: 'x' })
    expect(notAdd.text).toContain('can only be replaced')
    const dates = await call(store, 'propose_resume_change', { role: 'compuware', field: 'dates', kind: 'replace', current_text: 'Jan 2005 - Dec 2006', proposed_text: 'Jan 2005 - Jun 2007', rationale: 'Steven left Compuware in June 2007 (entry 12).', based_on: '12' })
    expect((parse(dates.text).proposed as { field: string; proposedText: string }).field).toBe('dates')
    const title = await call(store, 'propose_resume_change', { role: 'csx-data', field: 'title', kind: 'replace', current_text: 'Principal Product Manager Lead - CSX Data', proposed_text: 'Principal Product Manager Lead - Windows Customer Experience Data', rationale: 'Spell out CSX.' })
    expect((parse(title.text).proposed as { field: string }).field).toBe('title')
    const section = await call(store, 'propose_resume_change', { role: 'headline', kind: 'replace', current_text: 'x', proposed_text: 'y', rationale: 'z' })
    expect((parse(section.text).proposed as { field: string | null }).field).toBeNull()
    expect(parse((await call(store, 'list_resume_proposals')).text).count).toBe(3)
  })

  it('proposes adding, replacing and removing whole roles', async () => {
    const store = new MemoryStore()
    const entry = { role: 'Founder', company: 'wilssens.com', dates: 'Oct 2026 - Present', location: 'Seattle, Washington', summary: 'Building a family platform.', points: ['Shipped email and websites at the family domain.'] }
    expect((await call(store, 'propose_resume_change', { role: 'new-role', kind: 'add', proposed_text: 'not json', rationale: 'x' })).text).toContain('must be JSON')
    expect((await call(store, 'propose_resume_change', { role: 'new-role', kind: 'add', proposed_text: JSON.stringify({ ...entry, dates: 'since 2026' }), rationale: 'x' })).text).toContain('written like')
    expect((await call(store, 'propose_resume_change', { role: 'new-role', kind: 'add', proposed_text: JSON.stringify({ ...entry, points: [] }), rationale: 'x' })).text).toContain('non-empty array')
    expect((await call(store, 'propose_resume_change', { role: 'new-role', kind: 'replace', field: 'role', proposed_text: JSON.stringify(entry), rationale: 'x' })).text).toContain('to add a role')
    expect((await call(store, 'propose_resume_change', { role: 'cosmos', field: 'role', kind: 'add', proposed_text: JSON.stringify(entry), rationale: 'x' })).text).toContain('set role to "new-role"')

    const added = parse((await call(store, 'propose_resume_change', { role: 'new-role', kind: 'add', proposed_text: JSON.stringify(entry), rationale: 'Steven has been building wilssens.com since leaving Microsoft (entry 3).', based_on: '3' })).text)
    expect((added.proposed as { field: string; kind: string; currentText: string | null }).field).toBe('role')
    expect(JSON.parse((added.proposed as { proposedText: string }).proposedText)).toEqual(entry)
    expect(added.next).toContain('new role')

    const removed = parse((await call(store, 'propose_resume_change', { role: 'cosmos', field: 'role', kind: 'remove', rationale: 'A placement inside the Info Support years; one line is enough.' })).text)
    const removedProposal = removed.proposed as { kind: string; currentText: string; proposedText: string | null }
    expect(removedProposal.kind).toBe('remove')
    expect(JSON.parse(removedProposal.currentText).company).toBe('Cosmos')
    expect(removedProposal.proposedText).toBeNull()

    const replaced = parse((await call(store, 'propose_resume_change', { role: 'compuware', field: 'role', kind: 'replace', proposed_text: JSON.stringify({ ...entry, role: 'Lead Developer and Team Lead', company: 'Compuware', dates: 'Jan 2005 - Jun 2007' }), rationale: 'New dates and a sharper summary.' })).text)
    const replacedProposal = replaced.proposed as { currentText: string; proposedText: string }
    expect(JSON.parse(replacedProposal.currentText).dates).toBe('Jan 2005 - Dec 2006')
    expect(JSON.parse(replacedProposal.proposedText).dates).toBe('Jan 2005 - Jun 2007')
    expect(parse((await call(store, 'list_resume_proposals')).text).count).toBe(3)
  })
})

describe('searchTerms', () => {
  it('keeps the words that carry meaning', () => {
    expect(searchTerms('What did Steven ship for Xbox in 2019?')).toEqual(['ship', 'xbox', '2019'])
    expect(searchTerms('C# and .NET at Info Support')).toEqual(['c#', 'net', 'info', 'support'])
    expect(searchTerms('the and for')).toEqual([])
  })
})
