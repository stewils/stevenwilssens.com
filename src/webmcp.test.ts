import { afterEach, describe, expect, it, vi } from 'vitest'
import { experiences, profile, recommendations } from './resume'
import { registerTool, siteTools, startWebMcp, type ModelContextTool } from './webmcp'

type Host = { modelContext?: unknown }

// A browser with WebMCP as the spec has it: registerTool with an AbortSignal that removes the tool.
const specContext = () => {
  const tools = new Map<string, ModelContextTool>()
  const register = vi.fn((tool: ModelContextTool, options?: { signal?: AbortSignal }) => {
    tools.set(tool.name, tool)
    options?.signal?.addEventListener('abort', () => tools.delete(tool.name))
  })
  return { tools, registerTool: register }
}
const tool = (name: string) => siteTools.find((item) => item.name === name)!
const run = async (name: string, input: Record<string, unknown> = {}) => JSON.parse(await tool(name).execute(input)) as Record<string, any>

afterEach(() => {
  delete (document as Host).modelContext
  delete (navigator as Host).modelContext
  vi.unstubAllGlobals()
})

describe('WebMCP', () => {
  it('registers nothing in a browser without it', () => {
    expect(() => startWebMcp()()).not.toThrow()
    expect(registerTool(tool('about_steven'))).toBeTypeOf('function')
  })

  it('registers the site tools on document.modelContext and removes them again', () => {
    const context = specContext()
    ;(document as Host).modelContext = context
    const stop = startWebMcp()
    expect([...context.tools.keys()]).toEqual(['about_steven', 'get_experience', 'get_selected_work', 'get_recommendations', 'get_patents_and_press', 'read_site_page'])
    expect(startWebMcp()).toBe(stop) // once per page load
    stop()
    expect(context.tools.size).toBe(0)
  })

  it('falls back to navigator.modelContext and its unregisterTool, as Chrome\'s early preview had it', () => {
    const tools = new Map<string, ModelContextTool>()
    const context = { registerTool: vi.fn((item: ModelContextTool) => { tools.set(item.name, item) }), unregisterTool: vi.fn((name: string) => { tools.delete(name) }) }
    ;(navigator as Host).modelContext = context
    const remove = registerTool(tool('about_steven'))
    expect(tools.has('about_steven')).toBe(true)
    remove()
    expect(context.unregisterTool).toHaveBeenCalledWith('about_steven')
    expect(tools.size).toBe(0)
  })

  it('only reads: every tool says so', () => {
    for (const item of siteTools) expect(item.annotations?.readOnlyHint, item.name).toBe(true)
  })

  it('about_steven answers from src/resume.ts: who, what he wants, how to reach him, and the keys the other tools take', async () => {
    const about = await run('about_steven')
    expect(about.name).toBe(profile.name)
    expect(about.headline).toBe(profile.headline)
    expect(about.lookingFor).toBe(profile.lookingFor)
    expect(about.workAuthorization).toBe(profile.workAuthorization)
    expect(about.contact).toEqual({ email: profile.email, linkedin: profile.linkedin, site: profile.site, resumePdf: `https://steven.wilssens.com${profile.resumePdf}` })
    expect(about.roles.map((role: { key: string }) => role.key)).toEqual(experiences.map((item) => item.key))
    expect(about.keyNumbers[0]).toEqual({ value: '250%+', label: 'growth in monthly active spatial-audio devices', backedByRole: 'spatial-audio-lead' })
    expect(Object.keys(about.pages)).toContain('building-this-site')
  })

  it('get_experience returns every role, or one by its key, and names the keys on a wrong one', async () => {
    expect((await run('get_experience')).roles).toEqual(experiences)
    const one = await run('get_experience', { role: 'csx-data' })
    expect(one.roles).toHaveLength(1)
    expect(one.roles[0].role).toBe('Principal Product Manager Lead - Windows Data')
    expect(await tool('get_experience').execute({ role: 'ceo' })).toMatch(/^Unknown role "ceo"\. Use one of: independent-ai-builder, /)
  })

  it('get_recommendations and get_patents_and_press carry the full text and the links', async () => {
    const recs = await run('get_recommendations')
    expect(recs.recommendations).toHaveLength(recommendations.length)
    expect(recs.recommendations[0]).toMatchObject({ name: 'Steve Rowe', linkedin: 'https://www.linkedin.com/in/steverowe/?skipRedirect=true' })
    const patents = await run('get_patents_and_press')
    expect(patents.grantedPatents[0].records[0]).toMatchObject({ number: 'US 12,436,860', url: 'https://patents.justia.com/patent/12436860' })
    expect(patents.press[0].publication).toBe('Alienware Arena')
    expect((await run('get_selected_work')).cases[0].title).toBe('Windows quality, measured from preview channels to retail')
  })

  it('read_site_page fetches the Markdown copy of a page and says when it is missing', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input) === '/about.md' ? new Response('# About\n\nAfter nearly 20 years') : new Response('nope', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await tool('read_site_page').execute({ page: 'about' })).toBe('# About\n\nAfter nearly 20 years')
    expect(await tool('read_site_page').execute({ page: 'home' })).toBe('https://steven.wilssens.com/index.md is not available right now.')
    expect(await tool('read_site_page').execute({ page: 'admin' })).toMatch(/^Unknown page "admin"\. Use one of: home, about, /)
    expect(fetchMock).toHaveBeenCalledWith('/about.md', expect.objectContaining({ headers: { Accept: 'text/markdown' } }))
  })
})
