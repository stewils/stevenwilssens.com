// The About page as a proposal target: how a proposal changes the copy, and the guards
// every About proposal (and the live copy in src/resume.ts, through about.test.ts) has to pass.
// Refusals stop a proposal; flags are shown to Steven before he decides and he can
// approve over them. Every check runs on the result: the live copy with the one proposal
// applied. Flags are not stored; they are recomputed from the live data each time a
// proposal is shown.
import type { About } from '../../../src/resume'
import { aboutSection, norm, type ResumeData } from './proposals'
import type { Proposal } from './store'

// What an About proposal can change: the line under the title (replace only) or one paragraph.
export const aboutFields = ['intro', 'paragraph']
// The designer's limits: what the layout carries well (specs/mcp-about-proposals.md, Design).
export const aboutLimits = { intro: 120, firstParagraph: 220, paragraph: 700, total: 1200, minParagraphs: 2, maxParagraphs: 4 }
export const sideNoteRefusal = 'the side-note facts change through the résumé proposals'

export type AboutChange = Pick<Proposal, 'field' | 'kind' | 'currentText' | 'proposedText'>
export type AboutCheck = { refusals: string[]; flags: string[] }

/** The indexes of the paragraphs that read as `text`, after the usual normalisation. */
export const matchParagraph = (paragraphs: readonly string[], text: string | null | undefined) => {
  const wanted = norm(text)
  return paragraphs.flatMap((paragraph, index) => (norm(paragraph) === wanted ? [index] : []))
}

/** The About copy with one proposal applied. A replace or remove whose current text is gone changes nothing. */
export const applyAbout = (about: About, p: AboutChange): About => {
  if (p.field === 'intro') return p.kind === 'replace' && p.proposedText ? { ...about, intro: p.proposedText } : about
  if (p.field !== 'paragraph') return about
  const paragraphs = [...about.paragraphs]
  const [at] = matchParagraph(paragraphs, p.currentText)
  if (p.kind === 'add') {
    if (p.proposedText) paragraphs.splice(p.currentText && at !== undefined ? at + 1 : paragraphs.length, 0, p.proposedText)
  } else if (at !== undefined) {
    if (p.kind === 'remove') paragraphs.splice(at, 1)
    else if (p.proposedText) paragraphs[at] = p.proposedText
  }
  return { ...about, paragraphs }
}

// Plain text only: no markup the Markdown copies or a pull request would render, nothing
// a reader cannot see, and nothing that imitates the assistant's own markers.
const markup: [RegExp, string][] = [
  [/[\r\n]/, 'a line break'],
  // An allowlist, after NFC: letters, digits, punctuation, spaces, currency and math signs.
  // Everything else is refused: control and format characters, line and paragraph
  // separators, combining marks and variation selectors (which can smuggle bytes after a
  // visible letter), symbols such as the braille blank, and the Hangul filler letters.
  [/[^\p{L}\p{N}\p{P}\p{Zs}\p{Sc}\p{Sm}\r\n]|[\u115F\u1160\u3164\uFFA0]/u, 'an invisible character, a mark or a symbol outside plain text'],
  [/<[a-z/!]/i, 'HTML'],
  [/\]\(/, 'a Markdown link or image'],
  [/^\s*(?:#|[-*+>]|\d+[.)]\s|```|~~~)/, 'a Markdown heading, list marker, quote or fence at the start'],
  [/`/, 'a backtick'],
  [/\[\[|\]\]/, 'the [[ or ]] of the assistant’s source markers'],
  [/:\/\//, 'a URL'],
]
const length = (text: string) => [...text].length
const sentenceEnds = (text: string) => (text.match(/[.!?](?=\s|$)/g) ?? []).length

/** The plain-text validator (C-2): the refusals for an About copy, empty when it may go on the page. */
export const checkAboutText = (about: About): string[] => {
  const refusals: string[] = []
  const parts: [string, string][] = [['the intro', about.intro], ...about.paragraphs.map((text, index): [string, string] => [`paragraph ${index + 1}`, text])]
  for (const [where, raw] of parts) {
    const text = raw.normalize('NFC')
    if (!text.trim()) { refusals.push(`${where} is empty`); continue }
    for (const [pattern, what] of markup) if (pattern.test(text)) refusals.push(`${where} has ${what}; About text is plain text`)
  }
  const intro = about.intro.normalize('NFC')
  if (length(intro) > aboutLimits.intro) refusals.push(`the intro has ${length(intro)} characters; at most ${aboutLimits.intro}`)
  if (sentenceEnds(intro) > 1) refusals.push('the intro is more than one sentence')
  const count = about.paragraphs.length
  if (count < aboutLimits.minParagraphs || count > aboutLimits.maxParagraphs) refusals.push(`the page would have ${count} ${count === 1 ? 'paragraph' : 'paragraphs'}; it needs ${aboutLimits.minParagraphs} to ${aboutLimits.maxParagraphs}`)
  about.paragraphs.forEach((text, index) => {
    const max = index === 0 ? aboutLimits.firstParagraph : aboutLimits.paragraph
    const size = length(text.normalize('NFC'))
    if (size > max) refusals.push(`paragraph ${index + 1} has ${size} characters; at most ${max}${index === 0 ? ' for the green opening paragraph' : ''}`)
  })
  const total = about.paragraphs.reduce((sum, text) => sum + length(text.normalize('NFC')), 0)
  if (total > aboutLimits.total) refusals.push(`the paragraphs have ${total} characters together; at most ${aboutLimits.total}`)
  return refusals
}

// The side-note facts (recruiter guard 1): a sentence about location, work authorization or
// availability must say what profile says; a job title must be one of the roles.
const sideNote: { pattern: RegExp; value: (resume: ResumeData) => string }[] = [
  { pattern: /\b(?:based in|live in|living in|located in|relocat\w*|moving to)\b/i, value: (resume) => resume.profile.location },
  { pattern: /\b(?:green card|visas?|H-1B|sponsor\w*|citizen\w*|permanent resident|authori[sz]ed to work)\b/i, value: (resume) => resume.profile.workAuthorization },
  { pattern: /\b(?:available (?:from|in|now|immediately|starting)|start date|notice period)\b/i, value: (resume) => resume.profile.availability },
]
const titleStart = /\b(?:Head of|Vice President|Principal|Senior|Group|Lead|Chief|Director|VP)\b(?: (?:[A-Z][\w&-]*|of|and|&))*/g
const titleEnd = /^(.*\b(?:Product Manager|Manager|Director|Officer|Engineer|Lead|VP|Vice President))\b/
/** The job titles a sentence names: a seniority word up to the last title word, or "Head of" and what follows. */
export const titlesIn = (sentence: string) => (sentence.match(titleStart) ?? []).flatMap((phrase) => {
  const title = phrase.match(titleEnd)?.[1] ?? (/^Head of [A-Z]/.test(phrase) ? phrase : null)
  return title ? [title.trim()] : []
})

// Recruiter guard 7: words that read as self-promotion to a hiring manager.
export const superlatives = ['world-class', 'visionary', 'passionate', 'rockstar', 'ninja', 'guru', 'best-in-class', 'thought leader']
const pastRole = /\b(?:Microsoft|Windows|Xbox)\b/
const presentTense = /\bI (?:lead|manage|run|own|work (?:at|on))\b|\bI'm leading\b|\bI am leading\b/i

const sentencesOf = (about: About) => [about.intro, ...about.paragraphs].flatMap((text) => norm(text).split(/(?<=[.!?])\s+/)).filter(Boolean)
const stringsOf = (value: unknown): string[] => (typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(stringsOf) : value && typeof value === 'object' ? Object.values(value).flatMap(stringsOf) : [])
const numbersIn = (text: string) => text.match(/\d+(?:[.,]\d+)*/g) ?? []

// The flags that read the sentences themselves: present tense about a past role (guard 4)
// and a number without a source in the résumé data, not the About copy itself (guard 2).
const sentenceFlags = (texts: string[], resume: ResumeData) => {
  const flags: string[] = []
  const sentences = texts.flatMap((text) => norm(text).split(/(?<=[.!?])\s+/)).filter(Boolean)
  for (const sentence of sentences) if (pastRole.test(sentence) && presentTense.test(sentence)) flags.push(`"${sentence}" is in the present tense about a past role (Steven left Microsoft in September 2026)`)
  const known = new Set(stringsOf([resume.profile, resume.experiences, resume.impact, resume.selectedWork, resume.education, resume.honors]).flatMap(numbersIn))
  for (const number of new Set(sentences.flatMap(numbersIn))) if (!known.has(number)) flags.push(`the number ${number} needs a source: no role bullet, key achievement or profile field in src/resume.ts carries it`)
  return flags
}
// Recruiter guard 7: self-promotion.
const superlativeFlags = (texts: string[]) => { const all = texts.map(norm).join(' '); return superlatives.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(all)).map((word) => `"${word}" reads as self-promotion to a hiring manager`) }

/** The guards on the About copy with this proposal applied: refusals stop it, flags go to Steven. */
export const checkAboutProposal = (p: AboutChange, resume: ResumeData): AboutCheck => {
  const result = applyAbout(resume.about, p)
  const texts = [result.intro, ...result.paragraphs]
  const refusals = checkAboutText(result)
  const roles = resume.experiences.map((item) => item.role.toLowerCase())
  for (const sentence of sentencesOf(result)) {
    const lower = sentence.toLowerCase()
    const fact = sideNote.find(({ pattern, value }) => pattern.test(sentence) && !lower.includes(norm(value(resume)).toLowerCase()))
    const title = titlesIn(sentence).find((name) => !roles.some((role) => role.includes(name.toLowerCase())))
    if (fact || title) refusals.push(`"${sentence}" states ${title ? `the title "${title}"` : 'a location, work authorization or availability'} that the résumé does not: ${sideNoteRefusal}`)
  }
  const flags = sentenceFlags(texts, resume)
  // Recruiter guard 6: what a recruiter's search and a hiring manager's skim look for.
  const all = texts.map(norm).join(' ')
  for (const [pattern, word] of [[/\bproducts?\b/i, 'product'], [/\bdata\b/i, 'data'], [/\bAI\b/, 'AI']] as const) if (!pattern.test(all)) flags.push(`the page would no longer say "${word}", a word recruiters search for`)
  if (!/Windows (?:&|and) Devices Data/.test(all)) flags.push('the page would no longer name the last Microsoft role (Windows & Devices Data)')
  return { refusals, flags: [...flags, ...superlativeFlags(texts)] }
}

/** True when the page no longer has the text the proposal changes (another change merged first): applying it would change nothing. */
export const isStale = (p: AboutChange, about: About) => {
  if (p.field === 'intro') return norm(p.currentText) !== norm(about.intro)
  if (p.field !== 'paragraph' || !p.currentText) return false
  return matchParagraph(about.paragraphs, p.currentText).length === 0
}
export const staleNote = 'The About page no longer has this proposal\'s current text (another change went live first): read get_resume and propose again. The flags read the proposed text alone.'

/** An About proposal against the résumé as it is now: its flags, and whether it is stale; null for any other proposal. */
export const aboutReview = (p: Proposal, resume: ResumeData) => {
  if (p.role !== aboutSection) return null
  if (!isStale(p, resume.about)) return { flags: checkAboutProposal(p, resume).flags, stale: false }
  const texts = p.proposedText ? [p.proposedText] : []
  return { flags: [...sentenceFlags(texts, resume), ...superlativeFlags(texts)], stale: true }
}
