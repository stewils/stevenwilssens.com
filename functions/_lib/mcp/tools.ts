// The MCP tools. Public tools answer a recruiter's assistant from the résumé data
// and the public part of the dossier; owner tools (unlocked by MCP_OWNER_KEY) run
// the interview that fills the dossier and read what recruiters asked.
import { education, experiences, honors, languages, news, recommendationLinks, recommendations } from '../../../src/resume'
import { grantedPatents, patentApplications } from '../../../src/patents'
import type { DossierEntry, DossierStore, Proposal, ProposalStatus, Visibility } from './store'

export const siteUrl = 'https://steven.wilssens.com'
const contact = { email: 'steven@wilssens.com', linkedin: 'https://www.linkedin.com/in/steven-wilssens-59495889/', site: siteUrl, resumePdf: `${siteUrl}/steven-wilssens-resume-2026.pdf` }

export const generalRole = 'general'
export const roleKeys = [...experiences.map((item) => item.key), generalRole]
export const resumeSections = ['headline', 'summary', 'skills', 'education']
const proposalRoles = [...experiences.map((item) => item.key), ...resumeSections]
export const roleTopics = ['scope', 'outcomes', 'decisions', 'challenges', 'lessons', 'people', 'skills', 'story', 'transition']
export const generalTopics = ['philosophy', 'looking-for', 'strengths', 'now', 'background', 'story']

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

export type ToolContext = {
  store: DossierStore
  owner: boolean
  now: number
  visitor: string
  country: string | null
  asOrg: string | null
}

type Args = Record<string, unknown>
type JsonSchema = { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean }

export type Tool = {
  name: string
  description: string
  inputSchema: JsonSchema
  owner: boolean          // only listed and callable in owner mode
  readOnly: boolean
  logQuery?: (args: Args) => string | null   // what to record about a public call
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

// "What did Steven ship for Xbox?" -> ['steven', 'ship', 'xbox']
const stopWords = new Set(['the', 'and', 'for', 'with', 'what', 'did', 'does', 'how', 'was', 'were', 'his', 'her', 'has', 'have', 'had', 'about', 'that', 'this', 'from', 'into', 'you', 'your', 'are', 'can', 'tell', 'steven', 'wilssens', 'microsoft', 'role', 'work', 'worked', 'experience', 'any', 'all', 'who', 'when', 'where', 'why', 'which'])
export const searchTerms = (query: string) => {
  const words = query.toLowerCase().split(/[^\p{L}\p{N}+#.]+/u).map((word) => word.replace(/^[.]+|[.]+$/g, ''))
  const terms = words.filter((word) => (word.length >= 3 || /[\d#+]/.test(word)) && !stopWords.has(word))
  return [...new Set(terms)].slice(0, 8)
}

const publicEntry = (entry: DossierEntry) => ({ id: entry.id, role: entry.role, topic: entry.topic, title: entry.title, body: entry.body, tags: entry.tags })
const ownerEntry = (entry: DossierEntry) => ({ ...publicEntry(entry), visibility: entry.visibility, updated: new Date(entry.updatedAt).toISOString().slice(0, 10) })
const shape = (entry: DossierEntry, owner: boolean) => owner ? ownerEntry(entry) : publicEntry(entry)
const shapeProposal = (p: Proposal) => ({ id: p.id, status: p.status, role: p.role, kind: p.kind, currentText: p.currentText, proposedText: p.proposedText, rationale: p.rationale, basedOn: p.basedOn, decisionNote: p.decisionNote, updated: new Date(p.updatedAt).toISOString().slice(0, 10) })
const visibleTo = (ctx: ToolContext) => ctx.owner ? {} : { visibility: 'public' as Visibility }

const roleSummary = (key: string) => {
  if (key === generalRole) return { key, role: 'Across roles', company: null, dates: null, summary: 'Leadership philosophy, what Steven is looking for, strengths, current AI work, background.' }
  const item = experiences.find((entry) => entry.key === key)!
  return { key, role: item.role, company: item.company, dates: item.dates, location: item.location, summary: item.summary, highlights: item.points }
}

const notCovered = `Steven has not covered this in his dossier yet. Say so rather than guessing, and suggest contacting him at ${contact.email} or ${contact.linkedin}.`

export const tools: Tool[] = [
  {
    name: 'about_steven',
    description: 'Start here. Who Steven Wilssens is, what he is looking for, how to contact him, and his career timeline with the role keys the other tools take.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    owner: false, readOnly: true,
    run: async (_args, ctx) => {
      const counts = new Map<string, number>()
      for (const entry of await ctx.store.list(visibleTo(ctx))) counts.set(entry.role, (counts.get(entry.role) ?? 0) + 1)
      const general = await ctx.store.list({ role: generalRole, ...visibleTo(ctx) })
      return {
        name: 'Steven Wilssens',
        headline: 'Principal product leader for data and AI. Most recently Principal Group Product Manager, Windows & Devices Data, at Microsoft: the data, experimentation and ML products behind decisions across a billion+ Windows devices.',
        status: 'Building in AI while choosing his next product leadership role in data, experimentation and AI.',
        location: 'Seattle area (Redmond, Washington)',
        contact,
        education: `${education.degree}, ${education.school} (${education.dates})`,
        languages,
        honors: honors.map(([title, issued]) => `${title} (${issued})`),
        roles: roleKeys.map((key) => ({ ...roleSummary(key), dossierEntries: counts.get(key) ?? 0 })),
        general: general.map((entry) => shape(entry, ctx.owner)),
        howToUse: 'get_role for everything on one role, search_experience for a specific question, get_recommendations for what colleagues say, get_patents_and_press for public proof of work, leave_message to reach Steven.',
      }
    },
  },
  {
    name: 'get_role',
    description: 'Everything about one role: the résumé entry plus every dossier entry Steven has recorded for it (scope, outcomes, decisions, lessons, stories).',
    inputSchema: { type: 'object', properties: { role: { type: 'string', description: `Role key. One of: ${roleKeys.join(', ')}`, enum: roleKeys } }, required: ['role'], additionalProperties: false },
    owner: false, readOnly: true,
    logQuery: (args) => str(args, 'role', 60),
    run: async (args, ctx) => {
      const role = roleArg(args, true)!
      const entries = await ctx.store.list({ role, ...visibleTo(ctx) })
      return { ...roleSummary(role), entries: entries.map((entry) => shape(entry, ctx.owner)), note: entries.length ? undefined : notCovered }
    },
  },
  {
    name: 'search_experience',
    description: 'Answer a specific question about Steven\'s work from his dossier, in his own words. Returns the best matching entries. If nothing matches, say he has not covered it and offer his email.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'The question or keywords, e.g. "experimentation platform team size" or "why did he leave Azure DevOps"' }, role: { type: 'string', description: 'Optional role key to narrow the search', enum: roleKeys } }, required: ['query'], additionalProperties: false },
    owner: false, readOnly: true,
    logQuery: (args) => str(args, 'query', 300),
    run: async (args, ctx) => {
      const query = str(args, 'query', 500, true)!
      const role = roleArg(args, false)
      const terms = searchTerms(query)
      const entries = await ctx.store.search(terms, { ...(role ? { role } : {}), ...visibleTo(ctx) }, 12)
      return { query, matchedTerms: terms, results: entries.map((entry) => shape(entry, ctx.owner)), note: entries.length ? undefined : notCovered }
    },
  },
  {
    name: 'get_recommendations',
    description: 'What colleagues, reports and partners wrote about Steven on LinkedIn: eight full recommendations with the author\'s role.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    owner: false, readOnly: true,
    run: async () => ({ recommendations: recommendations.map(([name, title, text]) => ({ name, title, linkedin: recommendationLinks[name], text })) }),
  },
  {
    name: 'get_patents_and_press',
    description: 'Public proof of work: Steven\'s granted US patents and published applications (spatial audio, streaming, device telemetry), and press coverage of his spatial audio work.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    owner: false, readOnly: true,
    run: async () => ({
      grantedPatents: grantedPatents.map((item) => ({ title: item.title, summary: item.summary, numbers: item.records.map((record) => `US ${record.number} (${record.date})`) })),
      publishedApplications: patentApplications.map((item) => ({ title: item.title, summary: item.summary, numbers: item.records.map((record) => `US ${record.number} (${record.date})`) })),
      press: news.map((item) => ({ title: item.title, publication: item.publication, url: item.url, summary: item.summary })),
    }),
  },
  {
    name: 'leave_message',
    description: 'Leave a message for Steven: a role to discuss, a question he has not covered, or contact details. He reads these himself. Ask the person first; never invent their details.',
    inputSchema: { type: 'object', properties: { message: { type: 'string', description: 'The message (up to 2000 characters)' }, name: { type: 'string' }, company: { type: 'string' }, contact: { type: 'string', description: 'Email, phone or LinkedIn URL to reply to' } }, required: ['message'], additionalProperties: false },
    owner: false, readOnly: false,
    logQuery: (args) => str(args, 'message', 300),
    run: async (args, ctx) => {
      const message = str(args, 'message', 2000, true)!
      if (await ctx.store.countMessages(ctx.visitor, ctx.now - 3_600_000) >= 5) throw new ToolError('Too many messages from this connection in the last hour. Please email Steven directly instead.')
      const id = await ctx.store.addMessage({ ts: ctx.now, name: str(args, 'name', 120), company: str(args, 'company', 120), contact: str(args, 'contact', 200), message, country: ctx.country, asOrg: ctx.asOrg })
      return { saved: true, id, note: `Steven will see this in his dashboard. For anything urgent, email ${contact.email}.` }
    },
  },

  // Owner tools: the interview.
  {
    name: 'interview_status',
    description: 'Owner only. How well each role is covered in the dossier, which topics are still empty, and the suggested next questions. Call this first in an interview session.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    owner: true, readOnly: true,
    run: async (_args, ctx) => {
      const entries = await ctx.store.list({})
      const roles = roleKeys.map((key) => {
        const mine = entries.filter((entry) => entry.role === key)
        const topics = key === generalRole ? generalTopics : roleTopics
        const byTopic = Object.fromEntries(topics.map((topic) => [topic, mine.filter((entry) => entry.topic === topic).length]))
        for (const entry of mine) if (!(entry.topic in byTopic)) byTopic[entry.topic] = (byTopic[entry.topic] ?? 0) + 1
        return { ...roleSummary(key), entries: mine.length, public: mine.filter((entry) => entry.visibility === 'public').length, byTopic, missingTopics: topics.filter((topic) => !byTopic[topic]) }
      })
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
      return { totals: { entries: entries.length, public: entries.filter((entry) => entry.visibility === 'public').length, private: entries.filter((entry) => entry.visibility === 'private').length }, roles, suggestedNext: suggested, topics: { roles: roleTopics, general: generalTopics } }
    },
  },
  {
    name: 'save_entry',
    description: 'Owner only. Save one fact or story from the interview. Body: compact third-person prose ("Steven ...") keeping his numbers and phrasing; a short first-person quote is fine. One entry per fact. Default visibility is private.',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: roleKeys, description: 'Role key, or "general" for cross-cutting facts' },
        topic: { type: 'string', description: `Slug. Roles: ${roleTopics.join(', ')}. General: ${generalTopics.join(', ')}. Others allowed.` },
        title: { type: 'string', description: 'Résumé-style headline, under 120 characters' },
        body: { type: 'string', description: 'The fact or story, usually 1 to 6 sentences' },
        visibility: { type: 'string', enum: ['public', 'private'], description: 'public = recruiters\' assistants may read it. Default private.' },
        tags: { type: 'string', description: 'Comma-separated keywords; include "resume" for résumé-grade facts' },
      },
      required: ['role', 'topic', 'title', 'body'],
      additionalProperties: false,
    },
    owner: true, readOnly: false,
    run: async (args, ctx) => {
      const entry = await ctx.store.insert({ role: roleArg(args, true)!, topic: topicArg(args, true)!, title: str(args, 'title', 160, true)!, body: str(args, 'body', 6000, true)!, visibility: visibilityArg(args, false) ?? 'private', tags: str(args, 'tags', 300) }, ctx.now)
      return { saved: ownerEntry(entry) }
    },
  },
  {
    name: 'update_entry',
    description: 'Owner only. Change an entry: fix wording, move it to another role or topic, or make it public or private. Only the fields given change.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer' }, role: { type: 'string', enum: roleKeys }, topic: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, visibility: { type: 'string', enum: ['public', 'private'] }, tags: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    owner: true, readOnly: false,
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
      return { updated: ownerEntry(entry) }
    },
  },
  {
    name: 'delete_entry',
    description: 'Owner only. Delete an entry for good.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'], additionalProperties: false },
    owner: true, readOnly: false,
    run: async (args, ctx) => {
      const id = int(args, 'id', 0, 1, Number.MAX_SAFE_INTEGER)
      if (!await ctx.store.remove(id)) throw new ToolError(`no entry with id ${id}`)
      return { deleted: id }
    },
  },
  {
    name: 'list_entries',
    description: 'Owner only. List dossier entries, including private ones, optionally filtered by role, topic or visibility.',
    inputSchema: { type: 'object', properties: { role: { type: 'string', enum: roleKeys }, topic: { type: 'string' }, visibility: { type: 'string', enum: ['public', 'private'] } }, additionalProperties: false },
    owner: true, readOnly: true,
    run: async (args, ctx) => {
      const filter = { role: roleArg(args, false) ?? undefined, topic: topicArg(args, false) ?? undefined, visibility: visibilityArg(args, false) ?? undefined }
      const entries = await ctx.store.list(filter)
      return { count: entries.length, entries: entries.map(ownerEntry) }
    },
  },
  {
    name: 'export_dossier',
    description: 'Owner only. The whole dossier as Markdown grouped by role and topic, for résumé writing and interview prep. visibility "public" exports only what recruiters can see.',
    inputSchema: { type: 'object', properties: { visibility: { type: 'string', enum: ['public', 'private'], description: 'Omit for everything' } }, additionalProperties: false },
    owner: true, readOnly: true,
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
  {
    name: 'recent_activity',
    description: 'Owner only. What recruiters\' assistants asked through the public server and the messages they left, so gaps in the dossier show up.',
    inputSchema: { type: 'object', properties: { days: { type: 'integer', description: 'Look back this many days (default 30)' } }, additionalProperties: false },
    owner: true, readOnly: true,
    run: async (args, ctx) => {
      const since = ctx.now - int(args, 'days', 30, 1, 365) * 86_400_000
      const [questions, messages] = await Promise.all([ctx.store.recentQuestions(since, 200), ctx.store.recentMessages(since, 100)])
      const when = (ts: number) => new Date(ts).toISOString().slice(0, 16).replace('T', ' ')
      return {
        questions: questions.map((q) => ({ when: when(q.ts), tool: q.tool, query: q.query, role: q.role, hits: q.hits, from: [q.asOrg, q.country].filter(Boolean).join(', ') || null })),
        unanswered: questions.filter((q) => q.tool === 'search_experience' && q.hits === 0).map((q) => q.query),
        messages: messages.map((m) => ({ when: when(m.ts), name: m.name, company: m.company, contact: m.contact, message: m.message, from: [m.asOrg, m.country].filter(Boolean).join(', ') || null })),
      }
    },
  },

  // Owner tools: the résumé.
  {
    name: 'get_resume',
    description: 'Owner only. The résumé as it stands today: the role entries (summary and bullet points), headline, education and honors, exactly as published on steven.wilssens.com/experience. Compare against the dossier before proposing changes.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    owner: true, readOnly: true,
    run: async () => ({
      headline: 'Principal product leader for data and AI.',
      summary: 'Most recently I led Windows & Devices Data product management at Microsoft: the data, experimentation and ML products behind decisions across a billion+ Windows devices. Now building in AI while choosing my next leadership role.',
      roles: experiences.map((item) => ({ key: item.key, role: item.role, company: item.company, dates: item.dates, location: item.location, summary: item.summary, points: item.points })),
      education: `${education.degree}, ${education.school} (${education.dates})`,
      languages,
      honors: honors.map(([title, issued]) => `${title} (${issued})`),
      pdf: contact.resumePdf,
      note: 'The PDF is exported from a résumé builder and mirrors these entries. Propose changes with propose_resume_change; Steven applies approved ones to src/resume.ts and the PDF himself.',
    }),
  },
  {
    name: 'propose_resume_change',
    description: 'Owner only. Propose one concrete résumé edit for Steven to approve or reject: replace a bullet or summary with stronger wording, add a bullet, or remove one. Quote the current text exactly and give the full proposed text. One proposal per change.',
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
    owner: true, readOnly: false,
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
    description: 'Owner only. Résumé proposals and their status: proposed (awaiting Steven), approved (to be applied to the site and PDF), rejected, applied.',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['proposed', 'approved', 'rejected', 'applied'], description: 'Omit for all' } }, additionalProperties: false },
    owner: true, readOnly: true,
    run: async (args, ctx) => {
      const status = str(args, 'status', 10)?.toLowerCase() as ProposalStatus | undefined
      if (status && !['proposed', 'approved', 'rejected', 'applied'].includes(status)) throw new ToolError('status must be proposed, approved, rejected or applied')
      const proposals = await ctx.store.listProposals(status)
      return { count: proposals.length, proposals: proposals.map(shapeProposal) }
    },
  },
  {
    name: 'review_resume_proposal',
    description: 'Owner only. Record Steven\'s decision on a résumé proposal: approve or reject, with an optional note (for example a tweak to the wording). "applied" marks an approved change as done in the site and PDF.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' }, decision: { type: 'string', enum: ['approve', 'reject', 'applied'] }, note: { type: 'string' } }, required: ['id', 'decision'], additionalProperties: false },
    owner: true, readOnly: false,
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

export const publicInstructions = `This server answers questions about Steven Wilssens, a principal product leader in data, experimentation and AI. Most recently he was Principal Group Product Manager for Windows & Devices Data at Microsoft; he is now building in AI while choosing his next leadership role. The dossier entries were written by Steven himself for recruiters and hiring managers.
Rules: state only what the tools return and say it comes from Steven's own notes. If something is not covered, say Steven has not covered it here rather than guessing, and offer ${contact.email} or his LinkedIn. Never speculate about compensation, visa status or personal matters. Start with about_steven for the overview and role keys, get_role for one job, search_experience for a specific question. Offer leave_message when the person wants to reach Steven.`

export const ownerInstructions = `Steven Wilssens, the owner, is connected. Your job is to interview him about his career and save what he says, so the dossier can answer recruiters (public entries), feed his résumé and prepare him for interviews.
How to run it:
1. Call interview_status first. It shows how well each role is covered and suggests the next questions. Let Steven pick the role, otherwise take the least covered recent role.
2. Ask one question at a time, conversationally. Follow up until the answer has specifics: numbers, dates, team sizes, named products, partners or customers, the decision he made and the alternatives, what happened, what he would do differently.
3. After each substantive answer call save_entry right away, do not batch. Body: compact third-person prose ("Steven ...") keeping his numbers and phrasing; a short first-person quote is fine. One entry per fact or story. Title: a résumé-style headline. Tags: keywords, plus "resume" for résumé-grade facts.
4. Visibility defaults to private. Make an entry public only when Steven says so or the fact is already on his site or LinkedIn. Internal Microsoft metrics, unreleased work and anything about named colleagues stay private unless he says otherwise. Ask now and then: "Can recruiters see this one?"
5. Confirm each save in one line (id, title, visibility), then ask the next question. Steven can say "make 12 public", "edit 12", "delete 12" or "export" at any time; use update_entry, delete_entry and export_dossier.
6. When Steven wraps up, or after roughly ten entries, turn to the résumé: call get_resume, compare it with what was saved this session, and for each concrete improvement call propose_resume_change with the exact current text, the full proposed text and why (which numbers or facts it adds). Walk him through the proposals one at a time, current and proposed side by side, and record each answer with review_resume_proposal. Never claim the résumé itself changed: approved proposals are applied by Steven to the site and PDF, and list_resume_proposals shows what is still waiting.
The public tools work here too and show private entries as well, so you can check what a recruiter would get.`
