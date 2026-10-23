// WebMCP: the pages hand the browser a few tools, so an agent running in the
// visitor's browser (Chrome's early preview and the W3C Web Machine Learning
// draft, https://webmachinelearning.github.io/webmcp/) reads Steven's résumé
// data and asks the site assistant instead of scraping the page. The tools
// return the same facts as the pages, the PDF and the Markdown copies
// (src/resume.ts): nothing a visitor cannot see, and no state changes. The
// assistant's tool, ask_about_steven, is registered by src/ask/AskAssistant.tsx
// once the server says the assistant is on, and runs through the panel so the
// visitor sees what the agent asked and what was answered.
//
// The spec puts the API on document.modelContext and removes a tool through the
// AbortSignal given at registration; Chrome 146 to 149 had it on navigator with
// unregisterTool(). Both are handled; without either, nothing is registered.
import { formatPatentNumber, grantedPatents, justiaUrl, patentApplications } from './patents'
import { markdownPath, pageMeta, routes, siteUrl, type Page } from './pageMeta'
import { education, experiences, honors, impact, languages, news, profile, recommendationLinks, recommendations, selectedWork, skills } from './resume'

export type ToolInput = Record<string, unknown>
export type ModelContextTool = {
  name: string
  description: string
  inputSchema?: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean; consequentialHint?: boolean }
  execute: (input: ToolInput, options?: { signal?: AbortSignal }) => Promise<string> | string
}
export type ModelContext = {
  registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => Promise<void> | void
  unregisterTool?: (name: string) => void
}

/** The browser's WebMCP entry point, or null when this browser has none. */
export const modelContext = (): ModelContext | null => {
  const scope = globalThis as { document?: { modelContext?: ModelContext }; navigator?: { modelContext?: ModelContext } }
  const context = scope.document?.modelContext ?? scope.navigator?.modelContext
  return context && typeof context.registerTool === 'function' ? context : null
}

/** Registers one tool. The returned function removes it again. A browser without WebMCP registers nothing. */
export const registerTool = (tool: ModelContextTool): (() => void) => {
  const context = modelContext()
  if (!context) return () => {}
  const controller = new AbortController()
  try { void Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(() => {}) } catch { return () => {} }
  return () => {
    controller.abort()
    try { context.unregisterTool?.(tool.name) } catch { /* already gone */ }
  }
}

const text = (value: unknown) => JSON.stringify(value, null, 1)
const roleKeys = experiences.map((item) => item.key)
const pages = ['home', ...routes] as const
const patentShape = (item: typeof grantedPatents[number]) => ({ title: item.title, summary: item.summary, records: item.records.map((record) => ({ number: formatPatentNumber(record.number), date: record.date, filed: record.filed, url: justiaUrl(record.number) })) })

/** Reads one of the Markdown copies of the pages that the build writes next to the HTML. */
const readPage = async (page: Page, signal?: AbortSignal) => {
  const response = await fetch(markdownPath(page), { signal, headers: { Accept: 'text/markdown' } }).catch(() => null)
  return response?.ok ? response.text() : null
}

// What the pages know, in the order an agent should read it.
export const siteTools: ModelContextTool[] = [
  {
    name: 'about_steven',
    description: `Start here: who Steven Wilssens is, what he is looking for, where he is, his work authorization, citizenship, availability, work arrangement, employers and relocation, how to reach him, the key numbers with the role behind each, his skills, and the role keys and page names the other tools take. Steven's own words from ${siteUrl}.`,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: () => text({
      name: profile.name,
      headline: profile.headline,
      summary: profile.summary,
      lookingFor: profile.lookingFor,
      location: profile.location,
      workAuthorization: profile.workAuthorization,
      citizenship: profile.citizenship,
      availability: profile.availability,
      workArrangement: profile.workArrangement,
      employers: profile.employers,
      relocation: profile.relocation,
      teamSize: `Led teams of ${profile.teamSize}`,
      contact: { email: profile.email, linkedin: profile.linkedin, site: profile.site, resumePdf: `${siteUrl}${profile.resumePdf}` },
      keyNumbers: impact.map(({ value, label, backing }) => ({ value, label, backedByRole: backing ?? null })),
      skills,
      education: `${education.degree}, ${education.school} (${education.dates})`,
      languages,
      honors: honors.map(([title, issued]) => `${title} (${issued})`),
      roles: experiences.map((item) => ({ key: item.key, role: item.role, company: item.company, dates: item.dates })),
      pages: Object.fromEntries(pages.map((page) => [page, pageMeta[page].description])),
      tools: 'get_experience for a role in full, get_selected_work for the cases, get_recommendations, get_patents_and_press, read_site_page for any page as Markdown, ask_about_steven for a question in plain words.',
    }),
  },
  {
    name: 'get_experience',
    description: 'The résumé entries: every role with its summary and bullet points, newest first, or one role in full by its key. Same text as the Experience page and the PDF.',
    inputSchema: { type: 'object', properties: { role: { type: 'string', description: `Optional role key for one role. One of: ${roleKeys.join(', ')}`, enum: roleKeys } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: (input) => {
      const role = typeof input.role === 'string' ? input.role : ''
      if (role && !roleKeys.includes(role)) return `Unknown role "${role}". Use one of: ${roleKeys.join(', ')}`
      const roles = experiences.filter((item) => !role || item.key === role)
      return text({ roles, resumePdf: `${siteUrl}${profile.resumePdf}`, page: `${siteUrl}/experience` })
    },
  },
  {
    name: 'get_selected_work',
    description: 'Selected work: for each case the situation, what Steven did, what came of it and who said so (a colleague\'s recommendation or a public source), with the role it belongs to.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: () => text({ cases: selectedWork.map((item) => ({ key: item.key, title: item.title, period: item.period, role: item.role, context: item.context, work: item.work, outcome: item.outcome, source: item.source ?? null, link: item.link ? `${siteUrl}${item.link.href}` : null })), page: `${siteUrl}/work` }),
  },
  {
    name: 'get_recommendations',
    description: 'The LinkedIn recommendations on the site, in full, with each author\'s role and profile: what colleagues, reports and partners say about Steven.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: () => text({ recommendations: recommendations.map(([name, title, body]) => ({ name, title, linkedin: recommendationLinks[name] ?? null, text: body })), page: `${siteUrl}/recommendations` }),
  },
  {
    name: 'get_patents_and_press',
    description: 'Steven\'s granted US patents and published applications (spatial audio, streaming, device telemetry) with their Justia links, and the press coverage of his spatial audio work.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: () => text({ grantedPatents: grantedPatents.map(patentShape), publishedApplications: patentApplications.map(patentShape), press: news.map((item) => ({ title: item.title, publication: item.publication, url: item.url, summary: item.summary })), pages: { patents: `${siteUrl}/patents`, news: `${siteUrl}/news` } }),
  },
  {
    name: 'read_site_page',
    description: `Read one page of ${siteUrl} as Markdown: ${pages.join(', ')}. The building-* pages are Steven's write-ups on how he built wilssens.com, AI Breaker and this site.`,
    inputSchema: { type: 'object', properties: { page: { type: 'string', enum: [...pages], description: 'The page name' } }, required: ['page'], additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async (input, options) => {
      const page = typeof input.page === 'string' ? input.page : ''
      if (!(pages as readonly string[]).includes(page)) return `Unknown page "${page}". Use one of: ${pages.join(', ')}`
      const markdown = await readPage(page as Page, options?.signal)
      return markdown ?? `${siteUrl}${markdownPath(page as Page)} is not available right now.`
    },
  },
]

let stop: (() => void) | null = null

/** Registers the site's tools once per page load (the assistant adds ask_about_steven itself). Returns the function that removes them. */
export const startWebMcp = () => {
  if (stop) return stop
  const stops = siteTools.map(registerTool)
  stop = () => { for (const remove of stops) remove(); stop = null }
  return stop
}
