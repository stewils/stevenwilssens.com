// The MCP tools: Steven's private workspace for talking through his career. They
// read what is already published (the résumé data, the site's pages, patents,
// recommendations), keep the dossier of facts and stories growing, and turn new
// material into résumé proposals he approves or rejects.
import { education, experiences, honors, languages, news, recommendationLinks, recommendations } from '../../../src/resume'
import { grantedPatents, patentApplications } from '../../../src/patents'
import { markdownPath, pageMeta, routes, type Page } from '../../../src/pageMeta'
import type { DossierEntry, DossierStore, Proposal, ProposalStatus, Visibility } from './store'

export const siteUrl = 'https://steven.wilssens.com'
const contact = { email: 'steven@wilssens.com', linkedin: 'https://www.linkedin.com/in/steven-wilssens-59495889/', site: siteUrl, resumePdf: `${siteUrl}/steven-wilssens-resume-2026.pdf` }

export const generalRole = 'general'
export const roleKeys = [...experiences.map((item) => item.key), generalRole]
export const resumeSections = ['headline', 'summary', 'skills', 'education']
const proposalRoles = [...experiences.map((item) => item.key), ...resumeSections]
export const roleTopics = ['scope', 'outcomes', 'decisions', 'challenges', 'lessons', 'people', 'skills', 'story', 'transition']
export const generalTopics = ['philosophy', 'looking-for', 'strengths', 'now', 'background', 'story']
// The site's pages as Markdown (written by scripts/prerender.mjs), plus everything in one file.
export const sitePages: string[] = ['home', ...routes.filter((route) => route !== 'privacy'), 'llms-full']

// The questions the interviewer falls back on for a topic nobody has covered yet.
const roleQuestions: Record<string, string> = {
  scope: 'What exactly did you own in this role? Team size (PMs, engineers, data scientists), budget, surfaces, who you reported to, and who your customers were.',
  outcomes: 'What are the two or three results from this role you would put on a résumé, with numbers? How were they measured?',
  decisions: 'What was the hardest call you made in this role, what were the alternatives, and what happened?',
  challenges: 'What went wrong or was harder than expected here, and how did you handle it?',
  lessons: 'What would you do differently, and what did this role teach you that you still use?',
  people: 'Who did you hire, grow or promote here? How did the team change under you?',
  skills: 'Which skills, tools, technologies and methods did this role use day to day? Think of the keywords a job post would match.',
  story: 'Tell one story from this role that shows how you work.',
  transition: 'Why did you move into this role, and why did you leave it?',
}
const generalQuestions: Record<string, string> = {
  philosophy: 'How do you lead PM teams? What do you believe about product work that not everyone agrees with?',
  'looking-for': 'What roles are you looking for now: level, scope, company types, locations, remote or not? What would make you say no?',
  strengths: 'What do colleagues consistently say you are great at, and what do you say about your weaknesses?',
  now: 'What are you building in AI right now, and what have you learned from it?',
  background: 'Education, languages, the move from Belgium to Redmond, and anything personal you are happy to share with recruiters.',
  story: 'Which story do you want every recruiter to hear about you?',
}

// What a sceptical recruiter or hiring manager would push on, per role: written
// angles plus what the dates themselves raise (short stints, long plateaus,
// overlaps, the time since the last role).
const recruiterAngles: Record<string, string[]> = {
  'windows-devices-data': [
    'Group PM for under two years: what did you inherit, what did you change, and what shipped because of you rather than the team you took over?',
    'Scope in numbers: how many PMs, engineers and data scientists, which products, what budget, who were the customers and how many used it?',
    'The role ended in September 2026: your decision or a reorg? How do you tell that story in one minute?',
    'Experimentation and ML insights are easy to claim: which decision in Windows went differently because of your products, with the evidence?',
  ],
  'csx-data': [
    'Nearly five years with the same title: how did the scope grow, and why no promotion earlier? What would your manager say?',
    '"Data-supported decisions on quality": name three decisions, who made them, and what the data showed. Where did the data fail to change a decision?',
    'How did you measure your own team\'s impact, and what number would you defend in a reference check?',
  ],
  'azure-devops': [
    'Five months: a recruiter will assume it did not work out. What happened, what did you deliver, and why did you move on?',
    '"Increased market penetration": by how much, measured how, and how much of that was yours?',
  ],
  'spatial-audio-lead': [
    '250% growth in monthly active devices: from what base, measured how, and how much came from Xbox shipping it by default rather than your choices?',
    'Which bets failed (xCloud audio, broadcast, casting) and what did you stop? Why leave media for Azure DevOps?',
  ],
  'spatial-audio-principal': [
    'Four months before the Lead title: was this a staged promotion or a reorg? What changed in what you owned?',
    'Dolby Access v3 and DTS Sound Unbound: what did Microsoft get from those partnerships in revenue or adoption?',
  ],
  'spatial-audio-senior': [
    'Nine years as a Senior PM: the first question will be why promotion took that long. What were you shipping year by year, what held it back, and what did you learn?',
    'The patents: which ones shipped in products people used, and which were defensive?',
  ],
  compuware: ['Lead of about 15 developers at 25: what did you actually decide, hire and ship? What from this period still shows in how you lead?'],
  cosmos: ['The dates overlap with Info Support (2001 to 2004) and Compuware (2005): get the timeline straight before a recruiter does.'],
  'info-support': ['Developer and trainer: what did you teach, to whom, and does any of it matter for a product leadership role today?'],
  general: [
    'The one-line pitch: who you are, what you want, why now. Say it without the word "passionate".',
    'Why leave Microsoft after almost 18 years, and why is this the moment? What have you built since September 2026?',
    'Level and scope you are actually a fit for: Director, Senior Director, VP? What evidence supports that, and what would make a hiring manager say "too narrow" (Windows only, Microsoft only)?',
    'Weaknesses a reference would mention unprompted. What did you get wrong as a manager and change?',
    'Remote, hybrid, relocation, start date, and compensation expectations (keep the numbers private).',
  ],
}

const monthIndex: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
// "Dec 2024 - Sep 2026" -> months, start and end as serial month numbers
const span = (dates: string) => {
  const parts = dates.split(/\s*-\s*/).map((part) => {
    const match = /^([A-Za-z]{3})\w*\s+(\d{4})$/.exec(part.trim())
    return match ? Number(match[2]) * 12 + monthIndex[match[1].toLowerCase()] : null
  })
  if (parts.length !== 2 || parts[0] === null || parts[1] === null) return null
  return { start: parts[0], end: parts[1], months: parts[1] - parts[0] + 1 }
}

// What the dates alone would make a recruiter ask, plus the written angles.
export const recruiterLens = (key: string) => {
  const flags: string[] = []
  const index = experiences.findIndex((item) => item.key === key)
  const item = experiences[index]
  if (item) {
    const mine = span(item.dates)
    if (mine) {
      if (mine.months < 12) flags.push(`Short stint: ${mine.months} months.`)
      if (mine.months >= 60 && !/Lead|Group/.test(item.role)) flags.push(`${Math.round(mine.months / 12)} years in one role without a visible promotion.`)
      const previous = experiences[index + 1]
      const before = previous ? span(previous.dates) : null
      if (before && before.end > mine.start) flags.push(`Overlaps with ${previous.role} at ${previous.company} (${previous.dates}).`)
      if (before && mine.start - before.end > 2) flags.push(`${mine.start - before.end - 1} months unaccounted for before this role.`)
      if (previous && previous.company !== item.company) flags.push(`Company change from ${previous.company}.`)
    }
  }
  return { flags, angles: recruiterAngles[key] ?? [] }
}

export type ToolContext = {
  store: DossierStore
  now: number
  // Reads one of the site's own static files (a Markdown page copy) by path, or null when it is not there.
  fetchPage: (path: string) => Promise<string | null>
}

type Args = Record<string, unknown>
type JsonSchema = { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean }

export type Tool = {
  name: string
  description: string
  inputSchema: JsonSchema
  readOnly: boolean
  run: (args: Args, ctx: ToolContext) => Promise<unknown>
}

export class ToolError extends Error {}

const str = (args: Args, key: string, max: number, required = false) => {
  const value = args[key]
  if (value === undefined || value === null || value === '') {
    if (required) throw new ToolError(`${key} is required`)
    return null
  }
  if (typeof value !== 'string') throw new ToolError(`${key} must be a string`)
  const trimmed = value.trim()
  if (!trimmed && required) throw new ToolError(`${key} is required`)
  return trimmed.slice(0, max) || null
}
const int = (args: Args, key: string, fallback: number, min: number, max: number) => {
  const value = args[key]
  if (value === undefined || value === null) return fallback
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) throw new ToolError(`${key} must be a number`)
  return Math.min(Math.max(Math.round(n), min), max)
}
const roleArg = (args: Args, required: boolean) => {
  const role = str(args, 'role', 60, required)
  if (role && !roleKeys.includes(role)) throw new ToolError(`unknown role "${role}". Use one of: ${roleKeys.join(', ')}`)
  return role
}
const topicArg = (args: Args, required: boolean) => {
  const topic = str(args, 'topic', 40, required)?.toLowerCase() ?? null
  if (topic && !/^[a-z][a-z0-9-]*$/.test(topic)) throw new ToolError('topic must be a short slug such as "outcomes" or "looking-for"')
  return topic
}
const visibilityArg = (args: Args, required: boolean): Visibility | null => {
  const value = str(args, 'visibility', 10, required)?.toLowerCase() ?? null
  if (value && value !== 'public' && value !== 'private') throw new ToolError('visibility must be "public" or "private"')
  return value as Visibility | null
}

// "What did Steven ship for Xbox?" -> ['ship', 'xbox']
const stopWords = new Set(['the', 'and', 'for', 'with', 'what', 'did', 'does', 'how', 'was', 'were', 'his', 'her', 'has', 'have', 'had', 'about', 'that', 'this', 'from', 'into', 'you', 'your', 'are', 'can', 'tell', 'steven', 'wilssens', 'microsoft', 'role', 'work', 'worked', 'experience', 'any', 'all', 'who', 'when', 'where', 'why', 'which'])
export const searchTerms = (query: string) => {
  const words = query.toLowerCase().split(/[^\p{L}\p{N}+#.]+/u).map((word) => word.replace(/^[.]+|[.]+$/g, ''))
  const terms = words.filter((word) => (word.length >= 3 || /[\d#+]/.test(word)) && !stopWords.has(word))
  return [...new Set(terms)].slice(0, 8)
}

const shapeEntry = (entry: DossierEntry) => ({ id: entry.id, role: entry.role, topic: entry.topic, title: entry.title, body: entry.body, visibility: entry.visibility, tags: entry.tags, updated: new Date(entry.updatedAt).toISOString().slice(0, 10) })
const shapeProposal = (p: Proposal) => ({ id: p.id, status: p.status, role: p.role, kind: p.kind, currentText: p.currentText, proposedText: p.proposedText, rationale: p.rationale, basedOn: p.basedOn, decisionNote: p.decisionNote, updated: new Date(p.updatedAt).toISOString().slice(0, 10) })

const roleSummary = (key: string) => {
  if (key === generalRole) return { key, role: 'Across roles', company: null, dates: null, summary: 'Leadership philosophy, what Steven is looking for, strengths, current AI work, background.' }
  const item = experiences.find((entry) => entry.key === key)!
  return { key, role: item.role, company: item.company, dates: item.dates, location: item.location, summary: item.summary, highlights: item.points }
}

export const tools: Tool[] = [
  // What is already there.
  {
    name: 'about_steven',
    description: 'Start here: the headline, contact details, timeline with the role keys the other tools take, and how much of the dossier each role has.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    run: async (_args, ctx) => {
      const entries = await ctx.store.list({})
      const count = (key: string) => entries.filter((entry) => entry.role === key).length
      return {
        name: 'Steven Wilssens',
        headline: 'Principal product leader for data and AI. Most recently Principal Group Product Manager, Windows & Devices Data, at Microsoft: the data, experimentation and ML products behind decisions across a billion+ Windows devices.',
        status: 'Building in AI while choosing his next product leadership role in data, experimentation and AI.',
        location: 'Seattle area (Redmond, Washington)',
        contact,
        education: `${education.degree}, ${education.school} (${education.dates})`,
        languages,
        honors: honors.map(([title, issued]) => `${title} (${issued})`),
        roles: roleKeys.map((key) => ({ ...roleSummary(key), dossierEntries: count(key) })),
        sitePages,
        dossier: { entries: entries.length, public: entries.filter((entry) => entry.visibility === 'public').length },
      }
    },
  },
  {
    name: 'read_site_page',
    description: 'Read one of the published pages of steven.wilssens.com as Markdown: home, about, experience, recommendations, patents, honors, news, projects, building-wilssens (the write-up on building wilssens.com), or llms-full for every page in one go. What is here, Steven has already said publicly; build on it rather than asking again.',
    inputSchema: { type: 'object', properties: { page: { type: 'string', enum: sitePages } }, required: ['page'], additionalProperties: false },
    readOnly: true,
    run: async (args, ctx) => {
      const page = str(args, 'page', 40, true)!
      if (!sitePages.includes(page)) throw new ToolError(`unknown page "${page}". Use one of: ${sitePages.join(', ')}`)
      const path = page === 'llms-full' ? '/llms-full.txt' : markdownPath(page as Page)
      const text = await ctx.fetchPage(path)
      if (text === null) throw new ToolError(`${path} is not available right now`)
      return text
    },
  },
  {
    name: 'get_role',
    description: 'Everything on one role: the résumé entry plus every dossier entry recorded for it (scope, outcomes, decisions, lessons, stories). Read it before asking about that role.',
    inputSchema: { type: 'object', properties: { role: { type: 'string', description: `Role key. One of: ${roleKeys.join(', ')}`, enum: roleKeys } }, required: ['role'], additionalProperties: false },
    readOnly: true,
    run: async (args, ctx) => {
      const role = roleArg(args, true)!
      const entries = await ctx.store.list({ role })
      return { ...roleSummary(role), entries: entries.map(shapeEntry) }
    },
  },
  {
    name: 'search_dossier',
    description: 'Find dossier entries by keywords or a question, across all roles or within one. Use it to check whether something has been recorded before asking about it.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Keywords or a question, e.g. "experimentation team size" or "why he left Azure DevOps"' }, role: { type: 'string', description: 'Optional role key to narrow the search', enum: roleKeys } }, required: ['query'], additionalProperties: false },
    readOnly: true,
    run: async (args, ctx) => {
      const query = str(args, 'query', 500, true)!
      const role = roleArg(args, false)
      const terms = searchTerms(query)
      const entries = await ctx.store.search(terms, role ? { role } : {}, 12)
      return { query, matchedTerms: terms, results: entries.map(shapeEntry) }
    },
  },
  {
    name: 'get_recommendations',
    description: 'The eight LinkedIn recommendations on the site, in full, with the author\'s role: what colleagues, reports and partners say about Steven.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    run: async () => ({ recommendations: recommendations.map(([name, title, text]) => ({ name, title, linkedin: recommendationLinks[name], text })) }),
  },
  {
    name: 'get_patents_and_press',
    description: 'Steven\'s granted US patents and published applications (spatial audio, streaming, device telemetry), and the press coverage of his spatial audio work.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    run: async () => ({
      grantedPatents: grantedPatents.map((item) => ({ title: item.title, summary: item.summary, numbers: item.records.map((record) => `US ${record.number} (${record.date})`) })),
      publishedApplications: patentApplications.map((item) => ({ title: item.title, summary: item.summary, numbers: item.records.map((record) => `US ${record.number} (${record.date})`) })),
      press: news.map((item) => ({ title: item.title, publication: item.publication, url: item.url, summary: item.summary })),
    }),
  },

  // The dossier.
  {
    name: 'interview_status',
    description: 'How well each role is covered in the dossier, which topics are still empty, and suggested next questions. Call it at the start of an interview session.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    run: async (_args, ctx) => {
      const entries = await ctx.store.list({})
      const roles = roleKeys.map((key) => {
        const mine = entries.filter((entry) => entry.role === key)
        const topics = key === generalRole ? generalTopics : roleTopics
        const byTopic = Object.fromEntries(topics.map((topic) => [topic, mine.filter((entry) => entry.topic === topic).length]))
        for (const entry of mine) if (!(entry.topic in byTopic)) byTopic[entry.topic] = (byTopic[entry.topic] ?? 0) + 1
        const lens = recruiterLens(key)
        return { ...roleSummary(key), entries: mine.length, public: mine.filter((entry) => entry.visibility === 'public').length, byTopic, missingTopics: topics.filter((topic) => !byTopic[topic]), recruiterFlags: lens.flags, recruiterAngles: lens.angles }
      })
      const gaps = await ctx.store.askGaps(20)
      // Most recent roles first, general topics woven in after the two latest roles,
      // taking one missing topic per role in turn so no single role fills the list.
      const order = [roleKeys[0], roleKeys[1], generalRole, ...roleKeys.slice(2, -1)]
      const suggested: { role: string; topic: string; question: string }[] = []
      for (let round = 0; suggested.length < 6 && round < 10; round++) {
        for (const key of order) {
          const topic = roles.find((item) => item.key === key)!.missingTopics[round]
          if (topic && suggested.length < 6) suggested.push({ role: key, topic, question: (key === generalRole ? generalQuestions : roleQuestions)[topic] })
        }
      }
      return {
        totals: { entries: entries.length, public: entries.filter((entry) => entry.visibility === 'public').length, private: entries.filter((entry) => entry.visibility === 'private').length },
        roles,
        suggestedNext: suggested,
        // What visitors asked the site assistant that the public dossier could not answer: the most valuable questions to cover.
        askedOnTheSite: gaps,
        topics: { roles: roleTopics, general: generalTopics },
        howToInterview: 'Think like a sceptical recruiter: for each role use recruiterFlags and recruiterAngles, ask for evidence behind every claim, and record which concern an answer settles.',
      }
    },
  },
  {
    name: 'save_entry',
    description: 'Save one fact or story. Body: compact third-person prose ("Steven ...") keeping his numbers and phrasing; a short first-person quote is fine. One entry per fact. Default visibility is private; public means the recruiter-facing assistant on his site may use it later.',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: roleKeys, description: 'Role key, or "general" for cross-cutting facts' },
        topic: { type: 'string', description: `Slug. Roles: ${roleTopics.join(', ')}. General: ${generalTopics.join(', ')}. Others allowed.` },
        title: { type: 'string', description: 'Résumé-style headline, under 120 characters' },
        body: { type: 'string', description: 'The fact or story, usually 1 to 6 sentences' },
        visibility: { type: 'string', enum: ['public', 'private'], description: 'Default private' },
        tags: { type: 'string', description: 'Comma-separated keywords; include "resume" for résumé-grade facts' },
      },
      required: ['role', 'topic', 'title', 'body'],
      additionalProperties: false,
    },
    readOnly: false,
    run: async (args, ctx) => {
      const entry = await ctx.store.insert({ role: roleArg(args, true)!, topic: topicArg(args, true)!, title: str(args, 'title', 160, true)!, body: str(args, 'body', 6000, true)!, visibility: visibilityArg(args, false) ?? 'private', tags: str(args, 'tags', 300) }, ctx.now)
      return { saved: shapeEntry(entry) }
    },
  },
  {
    name: 'update_entry',
    description: 'Change an entry: fix wording, move it to another role or topic, or make it public or private. Only the fields given change.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer' }, role: { type: 'string', enum: roleKeys }, topic: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, visibility: { type: 'string', enum: ['public', 'private'] }, tags: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    readOnly: false,
    run: async (args, ctx) => {
      const id = int(args, 'id', 0, 1, Number.MAX_SAFE_INTEGER)
      const patch: Record<string, unknown> = {}
      const role = roleArg(args, false); if (role) patch.role = role
      const topic = topicArg(args, false); if (topic) patch.topic = topic
      const title = str(args, 'title', 160); if (title) patch.title = title
      const body = str(args, 'body', 6000); if (body) patch.body = body
      const visibility = visibilityArg(args, false); if (visibility) patch.visibility = visibility
      if ('tags' in args) patch.tags = str(args, 'tags', 300)
      if (!Object.keys(patch).length) throw new ToolError('nothing to change')
      const entry = await ctx.store.update(id, patch, ctx.now)
      if (!entry) throw new ToolError(`no entry with id ${id}`)
      return { updated: shapeEntry(entry) }
    },
  },
  {
    name: 'delete_entry',
    description: 'Delete an entry for good.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'], additionalProperties: false },
    readOnly: false,
    run: async (args, ctx) => {
      const id = int(args, 'id', 0, 1, Number.MAX_SAFE_INTEGER)
      if (!await ctx.store.remove(id)) throw new ToolError(`no entry with id ${id}`)
      return { deleted: id }
    },
  },
  {
    name: 'list_entries',
    description: 'List dossier entries, optionally filtered by role, topic or visibility.',
    inputSchema: { type: 'object', properties: { role: { type: 'string', enum: roleKeys }, topic: { type: 'string' }, visibility: { type: 'string', enum: ['public', 'private'] } }, additionalProperties: false },
    readOnly: true,
    run: async (args, ctx) => {
      const filter = { role: roleArg(args, false) ?? undefined, topic: topicArg(args, false) ?? undefined, visibility: visibilityArg(args, false) ?? undefined }
      const entries = await ctx.store.list(filter)
      return { count: entries.length, entries: entries.map(shapeEntry) }
    },
  },
  {
    name: 'export_dossier',
    description: 'The whole dossier as Markdown grouped by role and topic, for résumé writing and interview prep. visibility "public" exports only what a recruiter-facing assistant may use.',
    inputSchema: { type: 'object', properties: { visibility: { type: 'string', enum: ['public', 'private'], description: 'Omit for everything' } }, additionalProperties: false },
    readOnly: true,
    run: async (args, ctx) => {
      const visibility = visibilityArg(args, false)
      const entries = await ctx.store.list(visibility ? { visibility } : {})
      const lines = [`# Steven Wilssens: career dossier${visibility ? ` (${visibility} entries)` : ''}`, '', `Exported ${new Date(ctx.now).toISOString().slice(0, 10)}. ${entries.length} entries.`]
      for (const key of roleKeys) {
        const mine = entries.filter((entry) => entry.role === key)
        if (!mine.length) continue
        const summary = roleSummary(key)
        lines.push('', `## ${summary.role}${summary.company ? `, ${summary.company}` : ''}${summary.dates ? ` (${summary.dates})` : ''}`)
        for (const topic of [...new Set(mine.map((entry) => entry.topic))]) {
          lines.push('', `### ${topic}`)
          for (const entry of mine.filter((entry) => entry.topic === topic)) lines.push('', `**${entry.title}** [#${entry.id}, ${entry.visibility}${entry.tags ? `, ${entry.tags}` : ''}]`, '', entry.body)
        }
      }
      return lines.join('\n')
    },
  },

  // The résumé.
  {
    name: 'get_resume',
    description: 'The résumé as it stands today: the role entries (summary and bullet points), headline, education and honors, exactly as published on steven.wilssens.com/experience. Compare against the dossier before proposing changes.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    run: async () => ({
      headline: 'Principal product leader for data and AI.',
      summary: 'Most recently I led Windows & Devices Data product management at Microsoft: the data, experimentation and ML products behind decisions across a billion+ Windows devices. Now building in AI while choosing my next leadership role.',
      roles: experiences.map((item) => ({ key: item.key, role: item.role, company: item.company, dates: item.dates, location: item.location, summary: item.summary, points: item.points })),
      education: `${education.degree}, ${education.school} (${education.dates})`,
      languages,
      honors: honors.map(([title, issued]) => `${title} (${issued})`),
      pdf: contact.resumePdf,
      pages: Object.fromEntries(sitePages.filter((page) => page !== 'llms-full').map((page) => [page, pageMeta[page as Page].description])),
      note: 'The PDF is exported from a résumé builder and mirrors these entries. Propose changes with propose_resume_change; Steven applies approved ones to src/resume.ts and the PDF himself.',
    }),
  },
  {
    name: 'propose_resume_change',
    description: 'Propose one concrete résumé edit for Steven to approve or reject: replace a bullet or summary with stronger wording, add a bullet, or remove one. Quote the current text exactly and give the full proposed text. One proposal per change.',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: proposalRoles, description: 'The role key the change belongs to, or headline | summary | skills | education' },
        kind: { type: 'string', enum: ['replace', 'add', 'remove'] },
        current_text: { type: 'string', description: 'The exact current wording (required for replace and remove)' },
        proposed_text: { type: 'string', description: 'The new wording (required for replace and add)' },
        rationale: { type: 'string', description: 'Why this is better: the fact or number from the dossier it adds, what it sharpens' },
        based_on: { type: 'string', description: 'Dossier entry ids this draws on, comma-separated' },
      },
      required: ['role', 'kind', 'rationale'],
      additionalProperties: false,
    },
    readOnly: false,
    run: async (args, ctx) => {
      const role = str(args, 'role', 60, true)!
      if (!proposalRoles.includes(role)) throw new ToolError(`unknown role "${role}". Use one of: ${proposalRoles.join(', ')}`)
      const kind = str(args, 'kind', 10, true)!.toLowerCase() as Proposal['kind']
      if (!['replace', 'add', 'remove'].includes(kind)) throw new ToolError('kind must be replace, add or remove')
      const currentText = str(args, 'current_text', 2000, kind !== 'add')
      const proposedText = str(args, 'proposed_text', 2000, kind !== 'remove')
      const proposal = await ctx.store.insertProposal({ role, kind, currentText, proposedText, rationale: str(args, 'rationale', 2000, true)!, basedOn: str(args, 'based_on', 200) }, ctx.now)
      return { proposed: shapeProposal(proposal), next: 'Show Steven the current and proposed text side by side and ask: approve or reject? Then call review_resume_proposal.' }
    },
  },
  {
    name: 'list_resume_proposals',
    description: 'Résumé proposals and their status: proposed (awaiting Steven), approved (to be applied to the site and PDF), rejected, applied.',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['proposed', 'approved', 'rejected', 'applied'], description: 'Omit for all' } }, additionalProperties: false },
    readOnly: true,
    run: async (args, ctx) => {
      const status = str(args, 'status', 10)?.toLowerCase() as ProposalStatus | undefined
      if (status && !['proposed', 'approved', 'rejected', 'applied'].includes(status)) throw new ToolError('status must be proposed, approved, rejected or applied')
      const proposals = await ctx.store.listProposals(status)
      return { count: proposals.length, proposals: proposals.map(shapeProposal) }
    },
  },
  {
    name: 'review_resume_proposal',
    description: 'Record Steven\'s decision on a résumé proposal: approve or reject, with an optional note (for example a tweak to the wording). "applied" marks an approved change as done in the site and PDF.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' }, decision: { type: 'string', enum: ['approve', 'reject', 'applied'] }, note: { type: 'string' } }, required: ['id', 'decision'], additionalProperties: false },
    readOnly: false,
    run: async (args, ctx) => {
      const id = int(args, 'id', 0, 1, Number.MAX_SAFE_INTEGER)
      const decision = str(args, 'decision', 10, true)!.toLowerCase()
      const status: ProposalStatus | null = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : decision === 'applied' ? 'applied' : null
      if (!status) throw new ToolError('decision must be approve, reject or applied')
      const proposal = await ctx.store.decideProposal(id, status, str(args, 'note', 1000), ctx.now)
      if (!proposal) throw new ToolError(`no proposal with id ${id}`)
      return { reviewed: shapeProposal(proposal) }
    },
  },
]

export const instructions = `Steven Wilssens is connected. This server is his private workspace for talking through his career; nobody else can reach it. Help him recall, sharpen and structure what he did, and keep the dossier (the facts and stories behind his résumé and his site) growing.
Build on what is already there. Before asking about a role, read what exists: get_role (the résumé entry plus the dossier entries for it), read_site_page for the published pages (about, experience, projects, the Building wilssens.com write-up), get_recommendations and get_patents_and_press for what others have said and what is on record, search_dossier to check whether a fact was recorded before. Do not ask him what the site already answers; ask what it does not.
A session can be: an interview (call interview_status: it shows the gaps, what the site's visitors asked that the dossier could not answer, and per role what a recruiter would push on); thinking out loud about one role or theme; preparing for a specific interview or job description; or drafting résumé or LinkedIn wording.
Interview like a sceptical recruiter and hiring manager, not a fan. For each role: scope versus influence (what he owned, decided and was measured on, versus what the team or the platform did anyway); evidence behind every claim (numbers with a baseline, how they were measured, who else would confirm them); what the dates raise (short stints, long plateaus without promotion, overlaps, the time since September 2026); why he moved in and out; what went wrong and what he would do differently; how a report, a peer and his manager would each describe him. Use the recruiterFlags and recruiterAngles from interview_status; they are the questions he will get anyway. Ask one question at a time. When an answer is vague, unverifiable or sounds like a résumé bullet, say so plainly and ask again for the specific. Tell him when an answer would not survive a reference check or a sharp follow-up, and help him find the honest, stronger version. Record the concern an answer settles in the entry (tag "recruiter"), so the dossier shows which objections are covered.
Saving: after each substantive answer call save_entry right away, do not batch. Body: compact third-person prose ("Steven ...") keeping his numbers and phrasing; a short first-person quote is fine. One entry per fact or story. Title: a résumé-style headline. Tags: keywords, plus "resume" for résumé-grade facts. Visibility defaults to private; public means a recruiter-facing assistant on his site may use the entry later. Make an entry public only when Steven says so or the fact is already on his site or LinkedIn; internal Microsoft metrics, unreleased work and anything about named colleagues stay private unless he says otherwise. Confirm each save in one line (id, title, visibility). He can say "make 12 public", "edit 12", "delete 12" or "export" at any time.
Résumé: when he wraps up, or after roughly ten entries, call get_resume, compare it with what was saved, and for each concrete improvement call propose_resume_change with the exact current text, the full proposed text and why (which numbers or facts it adds). Walk him through the proposals one at a time, current and proposed side by side, and record each decision with review_resume_proposal. Never claim the résumé itself changed: approved proposals are applied by Steven to the site and PDF, and list_resume_proposals shows what is still waiting.`
