// The email Steven gets when his resume changed: a plain-language account of what is
// different, written by Claude from the exact change in src/resume.ts, in an HTML
// email styled like the site. Used by the two workflows:
//
//   Deploy (the resume is live on steven.wilssens.com):
//     node scripts/resume-mail.mjs live --before <commit> --after <commit> --report dist/resume-report.json --title "<commit title>" --run-url <url>
//   Site update (a pull request with a new resume is ready to review):
//     node scripts/resume-mail.mjs review --before origin/main --after HEAD --report /tmp/resume-after.json \
//       --new-findings /tmp/resume-new-findings.txt --title "..." --instruction "..." --pr <url> --preview <url> --run-url <url>
//
// Environment: ANTHROPIC_API_KEY writes the summary (ANTHROPIC_MODEL overrides the model);
// without it the email still goes out, with the summary written from the data change
// itself. MAIL_APP_PASSWORD and friends are read by scripts/send-mail.py, which sends.
// --dry-run writes the email to --out <dir> (default: the current directory) and sends nothing.
import Anthropic from '@anthropic-ai/sdk'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const SITE = 'https://steven.wilssens.com'
const RESUME_PDF = `${SITE}/steven-wilssens-resume-2026.pdf`
const DEFAULT_MODEL = 'claude-opus-5-5'

// ---------------------------------------------------------------------------------
// The resume data at a commit
// ---------------------------------------------------------------------------------

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

export const isCommit = (ref) => {
  if (!ref || /^0+$/.test(ref)) return false
  try { git('cat-file', '-e', `${ref}^{commit}`); return true } catch { return false }
}

/** The exports of src/resume.ts as they were at a commit, or null when the file did not exist there. */
export async function loadResumeAt(ref) {
  let source
  try { source = git('show', `${ref}:src/resume.ts`) } catch { return null }
  // resume.ts is plain data with no imports, so a copy anywhere imports the same. Node strips the types.
  const dir = resolve(tmpdir(), 'resume-mail')
  mkdirSync(dir, { recursive: true })
  const file = resolve(dir, `resume-${git('rev-parse', '--short', ref).trim()}-${Date.now()}.ts`)
  writeFileSync(file, source)
  return { ...(await import(pathToFileURL(file).href)) }
}

// ---------------------------------------------------------------------------------
// What changed, as records a person (or a model) can read
// ---------------------------------------------------------------------------------

const words = (text) => new Set(String(text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
export const similarity = (a, b) => {
  const left = words(a), right = words(b)
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const word of left) if (right.has(word)) shared++
  return shared / Math.max(left.size, right.size)
}

/** Pairs removed and added strings that are edits of each other (similar enough); the rest stay removed/added. */
export function pairEdits(removed, added, threshold = 0.4) {
  const pairs = []
  const leftover = { removed: [...removed], added: [...added] }
  for (;;) {
    let best = null
    for (const from of leftover.removed) for (const to of leftover.added) {
      const score = similarity(from, to)
      if (score >= threshold && (!best || score > best.score)) best = { from, to, score }
    }
    if (!best) break
    pairs.push({ from: best.from, to: best.to })
    leftover.removed.splice(leftover.removed.indexOf(best.from), 1)
    leftover.added.splice(leftover.added.indexOf(best.to), 1)
  }
  return { pairs, ...leftover }
}

const text = (value) => value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value)

/** Differences between two lists of strings, within one section (bullets, skills, ...). */
function diffStrings(changes, section, noun, before = [], after = []) {
  const removed = before.filter((item) => !after.includes(item))
  const added = after.filter((item) => !before.includes(item))
  const { pairs, removed: gone, added: fresh } = pairEdits(removed, added)
  for (const { from, to } of pairs) changes.push({ section, kind: 'changed', what: `A ${noun} was reworded`, from, to })
  for (const from of gone) changes.push({ section, kind: 'removed', what: `A ${noun} was removed`, from })
  for (const to of fresh) changes.push({ section, kind: 'added', what: `A ${noun} was added`, to })
}

/** Differences in the named fields of two objects, within one section. */
function diffFields(changes, section, labels, before = {}, after = {}) {
  for (const [field, label] of Object.entries(labels)) {
    const from = text(before[field]), to = text(after[field])
    if (from === to) continue
    if (!from) changes.push({ section, kind: 'added', what: `The ${label} was added`, to })
    else if (!to) changes.push({ section, kind: 'removed', what: `The ${label} was removed`, from })
    else changes.push({ section, kind: 'changed', what: `The ${label} changed`, from, to })
  }
}

const describe = (item, labels) => Object.keys(labels).map((field) => text(item[field])).filter(Boolean).join(' · ')

/** Differences between two lists of records with a stable key (roles, selected work, press). */
function diffKeyed(changes, { noun, sectionOf, keyOf, labels, lists = {}, before = [], after = [] }) {
  const beforeByKey = new Map(before.map((item) => [keyOf(item), item]))
  const afterByKey = new Map(after.map((item) => [keyOf(item), item]))
  for (const [key, item] of afterByKey) {
    const old = beforeByKey.get(key)
    if (!old) {
      const extras = Object.keys(lists).map((field) => (item[field] ?? []).map((line) => `• ${line}`).join('\n')).filter(Boolean).join('\n')
      changes.push({ section: sectionOf(item), kind: 'added', what: `A new ${noun} was added`, to: [describe(item, labels), extras].filter(Boolean).join('\n') })
      continue
    }
    diffFields(changes, sectionOf(item), labels, old, item)
    for (const [field, listNoun] of Object.entries(lists)) diffStrings(changes, sectionOf(item), listNoun, old[field], item[field])
  }
  for (const [key, item] of beforeByKey) if (!afterByKey.has(key)) changes.push({ section: sectionOf(item), kind: 'removed', what: `The ${noun} was removed`, from: describe(item, labels) })
}

const profileLabels = { name: 'name', headline: 'headline on the site', resumeHeadline: 'headline on the resume', summary: 'summary', lookingFor: 'line about what Steven is looking for', location: 'location', workArrangement: 'work arrangement', workAuthorization: 'work authorization', availability: 'availability', teamSize: 'team size', email: 'email address', phone: 'phone number', linkedin: 'LinkedIn link', site: 'site address', resumeFileName: 'resume file name' }
const roleLabels = { role: 'title', company: 'company', dates: 'dates', location: 'location', summary: 'one-line summary' }
const workLabels = { title: 'title', period: 'period', context: 'context', work: 'description of the work', outcome: 'outcome', source: 'source' }
const newsLabels = { title: 'title', publication: 'publication', url: 'link', summary: 'summary' }

/** Every difference between two versions of the resume data, as plain records. */
export function diffResume(before, after) {
  const changes = []
  before ??= {}
  after ??= {}
  diffFields(changes, 'Profile', profileLabels, before.profile, after.profile)
  diffKeyed(changes, { noun: 'role', sectionOf: (role) => `${role.role} at ${role.company}`, keyOf: (role) => role.key, labels: roleLabels, lists: { points: 'bullet' }, before: before.experiences, after: after.experiences })
  diffKeyed(changes, { noun: 'key number', sectionOf: (item) => `Key number: ${item.value} ${item.label}`, keyOf: (item) => item.label, labels: { value: 'value', backing: 'role that backs it' }, before: before.impact, after: after.impact })
  diffStrings(changes, 'Skills', 'skill', before.skills, after.skills)
  diffKeyed(changes, { noun: 'selected work story', sectionOf: (work) => `Selected work: ${work.title}`, keyOf: (work) => work.key, labels: workLabels, before: before.selectedWork, after: after.selectedWork })
  diffStrings(changes, 'Honors', 'honor', (before.honors ?? []).map((honor) => honor.join(', ')), (after.honors ?? []).map((honor) => honor.join(', ')))
  diffFields(changes, 'Education', { degree: 'degree', school: 'school', dates: 'dates' }, before.education, after.education)
  diffFields(changes, 'Languages', { languages: 'languages line' }, { languages: before.languages }, { languages: after.languages })
  diffKeyed(changes, { noun: 'recommendation', sectionOf: (item) => `Recommendation from ${item[0]}`, keyOf: (item) => item[0], labels: { 1: 'title', 2: 'text' }, before: before.recommendations, after: after.recommendations })
  diffKeyed(changes, { noun: 'press item', sectionOf: (item) => `Press: ${item.title}`, keyOf: (item) => item.url ?? item.title, labels: newsLabels, before: before.news, after: after.news })
  return changes
}

const PDF_PATH = 'public/steven-wilssens-resume-2026.pdf'
/** Whether a change is worth an email: one diffResume sees, or a new PDF. A change only to data the email does not describe (the About page, for one) sends nothing. */
export const shouldMail = (touched, changes) => changes.length > 0 || touched.split(/\s+/).includes(PDF_PATH)

/**
 * What an email between two commits would describe, or why there is none to send: nothing
 * in src/resume.ts or the PDF changed, or only data the email does not describe changed
 * (the About page, for one) and the PDF did not. The same for the live and the review email.
 * `touched` is what git lists as changed among those two files; `load` reads src/resume.ts at a commit.
 */
export async function mailPlan({ before, after, touched, load = loadResumeAt }) {
  if (!touched.trim()) return { skip: 'The resume did not change between these commits; no email.' }
  const [was, now] = await Promise.all([load(before), load(after)])
  const changes = diffResume(was, now)
  if (!shouldMail(touched, changes)) return { skip: 'Only resume data the email does not describe changed (such as the About page), and the PDF did not; no email.' }
  return { changes }
}

// ---------------------------------------------------------------------------------
// The summary: Claude when there is a key, the records themselves when there is not
// ---------------------------------------------------------------------------------

const clip = (value, max) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value)
const firstLine = (value) => (value || '').split('\n')[0].trim()

/** A readable account of the changes without a model: one line per change, grouped by section. */
export function fallbackSummary(changes, { title } = {}) {
  const sections = [...new Set(changes.map((change) => change.section))]
  const items = changes.slice(0, 12).map((change) => {
    let sentence = `${change.what}.`
    if (change.kind === 'changed' && change.from && change.to && change.from.length + change.to.length < 260) sentence = `${change.what}: “${change.from}” is now “${change.to}”.`
    else if (change.kind === 'added' && change.to && change.to.length < 200) sentence = `${change.what}: “${change.to}”.`
    else if (change.kind === 'removed' && change.from && change.from.length < 200) sentence = `${change.what}: “${change.from}”.`
    return { label: change.section, text: sentence }
  })
  if (changes.length > 12) items.push({ label: 'And more', text: `${changes.length - 12} further changes; the pull request or the commit has the full list.` })
  const count = changes.length === 1 ? 'One change' : `${changes.length} changes`
  const headline = changes.length
    ? clip(`${count} to ${sections.length === 1 ? sections[0] : `${sections.length} parts of the resume`}`, 90)
    : (firstLine(title) ? clip(firstLine(title), 90) : 'The resume was regenerated')
  const intro = changes.length
    ? `The resume data changed in ${sections.length === 1 ? 'one place' : `${sections.length} places`}: ${clip(sections.join(', '), 220)}.${firstLine(title) ? ` The change is titled “${clip(firstLine(title), 120)}”.` : ''}`
    : `The resume file was regenerated without a change to the facts${firstLine(title) ? `, in “${clip(firstLine(title), 120)}”` : ''}.`
  return { headline, intro, items, source: 'fallback' }
}

const summarySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'intro', 'items'],
  properties: {
    headline: { type: 'string', description: 'One line, at most 90 characters, saying what changed. No trailing period.' },
    intro: { type: 'string', description: 'One or two sentences for Steven about this update, in plain words.' },
    items: {
      type: 'array',
      description: 'Three to eight items, one per change or group of related changes, most important first. Fewer when there were fewer changes.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'text'],
        properties: {
          label: { type: 'string', description: 'A short label, at most 32 characters: the role or part of the resume, such as "Windows & Devices Data", "Headline", "Skills", "Compuware".' },
          text: { type: 'string', description: 'One or two plain sentences saying what is different now and, when short, how it read before.' },
        },
      },
    },
  },
}

const instructions = `You write the note Steven Wilssens receives when his resume changed. He reads it on his phone, so write for him in plain, warm, direct English, as a careful colleague would tell him what is different now.

You get the exact change as records (section, kind, what, from, to) plus the title of the change and, sometimes, what Steven asked for. That is the whole truth: describe only those changes, never invent or embellish, and never mention records, keys, code, files or diffs. Say "your" ("your summary", "the Compuware dates") and name roles by company and title the way a person would. When something was reworded, say what changed in substance (a number, a date, a tense, a claim), and quote the new wording when it is short. Group small related edits into one item. Do not grade the resume or give advice; the email carries the score separately. No markdown, no emoji, no exclamation marks.`

/** Asks Claude for the plain-language summary; falls back to the records when there is no key or the call fails. */
export async function summarize(input, { apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL, client, timeoutMs = 120_000, log = console.error } = {}) {
  const fallback = fallbackSummary(input.changes, input)
  if (!apiKey && !client) { log('::notice::ANTHROPIC_API_KEY is not set; the email describes the change from the data itself. Add the Anthropic key as the ANTHROPIC_API_KEY repository secret for a written summary.'); return fallback }
  if (!input.changes.length) return fallback
  const records = input.changes.map((change) => ({ ...change, from: change.from && clip(change.from, 700), to: change.to && clip(change.to, 700) }))
  const user = [
    `Kind of update: ${input.kind === 'live' ? 'the resume is now live on steven.wilssens.com' : 'the resume is on a branch, in a pull request Steven still has to review and merge'}.`,
    `Title of the change: ${firstLine(input.title) || '(none)'}`,
    input.instruction ? `What Steven asked for: ${clip(input.instruction, 1500)}` : null,
    `Changes (${records.length}):`,
    clip(JSON.stringify(records, null, 1), 24_000),
  ].filter(Boolean).join('\n\n')
  try {
    const anthropic = client ?? new Anthropic({ apiKey, maxRetries: 1, timeout: timeoutMs })
    // Thinking stays on (adaptive by default); low effort is plenty for a short note. The schema makes the answer JSON.
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4000,
      system: instructions,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: summarySchema } },
    })
    if (response.stop_reason === 'refusal') throw new Error(`Claude declined (${response.stop_details?.category ?? 'no category'})`)
    if (response.stop_reason === 'max_tokens') throw new Error('Claude ran out of tokens before finishing the summary')
    const output = response.content.find((block) => block.type === 'text')?.text
    if (!output) throw new Error(`Claude returned no text (stop reason ${response.stop_reason ?? 'unknown'})`)
    const summary = JSON.parse(output)
    if (!summary.headline || !Array.isArray(summary.items) || !summary.items.length) throw new Error('Claude returned an empty summary')
    return {
      headline: clip(String(summary.headline).replace(/\.$/, ''), 120),
      intro: summary.intro || fallback.intro,
      items: summary.items.slice(0, 8).map((item) => ({ label: clip(String(item.label), 40), text: String(item.text) })),
      source: model,
    }
  } catch (error) {
    log(`::warning::The Claude summary failed (${error.message}); the email describes the change from the data itself.`)
    return fallback
  }
}

// ---------------------------------------------------------------------------------
// The email
// ---------------------------------------------------------------------------------

const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The score, from the report the build wrote, with its baseline (the live site or main). */
export function scoreOf(report) {
  if (!report || typeof report.score !== 'number') return null
  const baseline = report.baseline ?? null
  const before = baseline && typeof baseline.score === 'number' ? baseline.score : null
  const verdict = before == null ? 'unknown' : baseline.lower ? 'lower' : report.score > before ? 'higher' : 'unchanged'
  const count = (severity) => report.findings?.filter((finding) => finding.severity === severity).length ?? null
  // The score is the ATS score; the counts beside it are the findings that make it.
  return { score: report.score, before, verdict, lower: verdict === 'lower', pages: report.pages ?? null, warnings: report.ats?.warnings ?? report.warnings ?? count('warn'), errors: report.ats?.errors ?? report.errors ?? count('error') }
}

const palette = { paper: '#f4f6f1', card: '#ffffff', ink: '#172121', body: '#3c4847', muted: '#6a7473', green: '#096b50', deep: '#0f4a38', halo: '#dbeae5', line: '#d7dfd8', yellow: '#e8b84a', warnBg: '#fff8e5', warnInk: '#6b4e00', red: '#b4382c' }
const font = "'Manrope', 'Segoe UI', Helvetica, Arial, sans-serif"
const mono = "'DM Mono', Menlo, Consolas, 'Courier New', monospace"

const button = (href, label, primary) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="display:inline-table;margin:0 10px 10px 0;"><tr><td style="border-radius:999px;background:${primary ? palette.green : palette.card};border:2px solid ${primary ? palette.green : palette.line};"><a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-family:${font};font-size:15px;font-weight:700;line-height:1;color:${primary ? '#ffffff' : palette.ink};text-decoration:none;border-radius:999px;">${esc(label)}</a></td></tr></table>`

const chip = (label) => `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${palette.halo};color:${palette.green};font-family:${mono};font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;line-height:1.4;">${esc(label)}</span>`

const label = (value) => `<div style="font-family:${mono};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${palette.muted};">${esc(value)}</div>`

const stat = (name, value, note, color = palette.ink) => `<td class="stat" width="33%" valign="top" style="padding:0 6px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${palette.paper};border-radius:14px;"><tr><td style="padding:16px 18px;">${label(name)}<div style="margin-top:6px;font-family:${font};font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1;color:${color};">${value}</div>${note ? `<div style="margin-top:6px;font-family:${font};font-size:13px;line-height:1.4;color:${palette.muted};">${note}</div>` : ''}</td></tr></table></td>`

/** Subject, HTML and plain text for one email. */
export function renderEmail({ kind, summary, score, title = '', instruction = '', links = {}, newFindings = [], findings = [] }) {
  const live = kind === 'live'
  const lower = Boolean(score?.lower)
  const kicker = live ? 'Resume live on steven.wilssens.com' : 'Resume ready to review'
  const scoreText = score ? (score.before == null ? `${score.score}/100` : `${score.before} → ${score.score}`) : 'unknown'
  const subject = clip(lower
    ? `${live ? 'Resume live, scoring lower' : 'Resume ready to review, but scoring lower'} (${scoreText}): ${summary.headline}`
    : `${live ? 'Resume live' : 'Resume ready to review'}: ${summary.headline}`, 140)
  const worse = (lower ? (newFindings.length ? newFindings : findings.filter((finding) => finding.severity !== 'info').map((finding) => `[${finding.severity}] ${finding.message}`)) : []).map((line) => line.replace(/^-\s*/, '')).filter(Boolean)
  const against = live ? 'the resume recruiters downloaded until now' : 'the resume live today'
  const compared = live ? 'the live resume' : 'main'
  const verdictNote = score ? ({ lower: `Down from ${score.before} on ${compared}`, higher: `Up from ${score.before} on ${compared}`, unchanged: `Same as ${compared}`, unknown: live ? 'The live score could not be read' : 'Main’s score was not available' })[score.verdict] : ''
  const verdictColor = score?.verdict === 'lower' ? palette.red : score?.verdict === 'higher' ? palette.green : palette.ink
  const primary = live ? { href: RESUME_PDF, label: 'Open the resume PDF' } : { href: links.pr || `${SITE}/`, label: 'Review the pull request' }
  const secondary = live
    ? [{ href: `${SITE}/experience`, label: 'Experience page' }, { href: `${SITE}/`, label: 'Home page' }]
    : [links.preview && { href: `${links.preview}/steven-wilssens-resume-2026.pdf`, label: 'Resume PDF on the preview' }, links.preview && { href: links.preview, label: 'Preview the site' }].filter(Boolean)
  const closing = live
    ? `Recruiters now download this version.${firstLine(title) ? ` Change: ${clip(firstLine(title), 160)}` : ''}`
    : 'Nothing is live yet. Merge the pull request, or tell Claude to, and a second email follows when the resume is on steven.wilssens.com.'
  const credit = summary.source === 'fallback' ? 'Summary written from the data change; add the Anthropic key to the repository for a written one.' : `Summary written by ${summary.source} from the exact change in the resume data.`

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title>
<style>body{margin:0;padding:0;-webkit-text-size-adjust:100%;} a{color:${palette.green};} @media (max-width:620px){ .shell{padding:12px !important;} .inner{padding-left:20px !important;padding-right:20px !important;} .stat{display:block !important;width:100% !important;padding:0 0 10px !important;} h1{font-size:25px !important;} }</style></head>
<body style="margin:0;padding:0;background:${palette.paper};">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${palette.paper};">${esc(summary.intro)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${palette.paper};"><tr><td class="shell" align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;">
<tr><td style="padding:0 6px 14px;font-family:${mono};font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:${palette.green};">${esc(kicker)}</td></tr>
<tr><td style="background:${palette.card};border:1px solid ${palette.line};border-radius:20px;overflow:hidden;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr><td style="height:8px;background:${lower ? palette.yellow : palette.deep};font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td class="inner" style="padding:36px 40px 12px;">
    <h1 style="margin:0 0 14px;font-family:${font};font-size:30px;font-weight:800;letter-spacing:-0.8px;line-height:1.15;color:${palette.ink};">${esc(summary.headline)}</h1>
    <p style="margin:0;font-family:${font};font-size:17px;line-height:1.55;color:${palette.body};">${esc(summary.intro)}</p>
  </td></tr>
  ${lower ? `<tr><td class="inner" style="padding:14px 40px 0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${palette.warnBg};border-left:4px solid ${palette.yellow};border-radius:0 12px 12px 0;"><tr><td style="padding:16px 20px;font-family:${font};font-size:15px;line-height:1.5;color:${palette.warnInk};">
      <strong>This resume scores lower than ${against}: ${esc(scoreText)}.</strong> An applicant tracking system reads it worse. ${live ? 'Fix the data and push again.' : 'Fix the data on the branch, or tell Claude to, before merging; or merge knowing the trade-off.'}
      ${worse.length ? `<ul style="margin:10px 0 0;padding-left:18px;">${worse.map((line) => `<li style="margin:4px 0;">${esc(line)}</li>`).join('')}</ul>` : ''}
    </td></tr></table>
  </td></tr>` : ''}
  <tr><td class="inner" style="padding:26px 40px 6px;">
    <div style="padding-bottom:6px;border-bottom:1px solid ${palette.line};">${label('What changed')}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    ${summary.items.map((item, index) => `<tr><td style="padding:16px 0 ${index === summary.items.length - 1 ? 8 : 0}px;${index ? `border-top:1px solid ${palette.line};` : ''}">${chip(item.label)}<div style="margin-top:8px;font-family:${font};font-size:16px;line-height:1.55;color:${palette.ink};">${esc(item.text)}</div></td></tr>`).join('\n    ')}
    </table>
  </td></tr>
  ${instruction ? `<tr><td class="inner" style="padding:14px 40px 0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${palette.paper};border-radius:14px;"><tr><td style="padding:16px 20px;">
      ${label('What you asked')}
      <div style="margin-top:8px;font-family:${font};font-size:15px;line-height:1.55;color:${palette.body};font-style:italic;">${esc(clip(instruction, 1200))}</div>
    </td></tr></table>
  </td></tr>` : ''}
  ${score ? `<tr><td class="inner" style="padding:26px 40px 0;">
    <div style="padding-bottom:12px;">${label('How it scores')}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
      ${stat('ATS score', `${score.score}<span style="font-size:16px;font-weight:600;color:${palette.muted};">/100</span>`, esc(verdictNote), verdictColor)}
      ${stat('Pages', score.pages ?? '–', score.pages != null ? (score.pages <= 2 ? 'Fits the two pages recruiters read' : 'More than the two pages recruiters read') : '')}
      ${stat('ATS warnings', score.warnings ?? '–', score.errors ? `${score.errors} error${score.errors === 1 ? '' : 's'} too` : 'No errors')}
    </tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:14px;"><tr><td style="padding:0 6px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:${palette.line};border-radius:999px;height:6px;font-size:0;line-height:0;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="${Math.max(2, Math.min(100, score.score))}%"><tr><td style="background:${verdictColor};border-radius:999px;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table></td></tr></table>
  </td></tr>` : ''}
  <tr><td class="inner" style="padding:30px 40px 8px;">
    ${button(primary.href, primary.label, true)}${secondary.map((link) => button(link.href, link.label, false)).join('')}
  </td></tr>
  <tr><td class="inner" style="padding:8px 40px 34px;font-family:${font};font-size:14px;line-height:1.55;color:${palette.muted};">${esc(closing)}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:18px 6px 0;font-family:${font};font-size:12px;line-height:1.6;color:${palette.muted};">
  Sent by the ${live ? 'Deploy' : 'Site update'} workflow${links.run ? ` · <a href="${esc(links.run)}" style="color:${palette.muted};">View the run</a>` : ''}<br>
  ${esc(credit)}
</td></tr>
</table>
</td></tr></table>
</body></html>
`

  const plain = [
    kicker.toUpperCase(),
    '',
    summary.headline,
    '',
    summary.intro,
    ...(lower ? ['', `WARNING: this resume scores lower than ${against}: ${scoreText}. An applicant tracking system reads it worse.`, ...worse.map((line) => `- ${line}`), live ? 'Fix the data and push again.' : 'Fix the data on the branch (or tell Claude to) before merging, or merge knowing the trade-off.'] : []),
    '',
    'WHAT CHANGED',
    ...summary.items.map((item) => `- ${item.label}: ${item.text}`),
    ...(instruction ? ['', 'WHAT YOU ASKED', instruction] : []),
    ...(score ? ['', 'HOW IT SCORES', `ATS score: ${score.score}/100${score.before != null ? ` (${verdictNote.toLowerCase()})` : ''}`, `Pages: ${score.pages ?? 'unknown'}; warnings: ${score.warnings ?? 'unknown'}; errors: ${score.errors ?? 'unknown'}`] : []),
    '',
    `${primary.label}: ${primary.href}`,
    ...secondary.map((link) => `${link.label}: ${link.href}`),
    '',
    closing,
    ...(links.run ? ['', `Run: ${links.run}`] : []),
    '',
    credit,
  ].join('\n')
  return { subject, html, text: plain }
}

// ---------------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------------

export function send({ subject, html, text }, { out = '.', dryRun = false } = {}) {
  mkdirSync(out, { recursive: true })
  const textFile = resolve(out, 'resume-mail.txt'), htmlFile = resolve(out, 'resume-mail.html')
  writeFileSync(textFile, text)
  writeFileSync(htmlFile, html)
  if (dryRun) { console.log(`Subject: ${subject}\n\n${text}\n\nWritten ${textFile} and ${htmlFile}; nothing sent (--dry-run).`); return }
  const result = spawnSync(process.env.PYTHON || 'python3', [resolve(import.meta.dirname, 'send-mail.py'), '--subject', subject, '--body-file', textFile, '--html-file', htmlFile], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`send-mail.py exited with ${result.status ?? result.signal}`)
}

// ---------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      before: { type: 'string' }, after: { type: 'string', default: 'HEAD' }, report: { type: 'string' }, 'new-findings': { type: 'string' },
      title: { type: 'string', default: '' }, instruction: { type: 'string', default: '' }, pr: { type: 'string' }, preview: { type: 'string' }, 'run-url': { type: 'string' },
      'dry-run': { type: 'boolean', default: false }, out: { type: 'string', default: '.' },
    },
  })
  const kind = positionals[0]
  if (kind !== 'live' && kind !== 'review') { console.error('Usage: node scripts/resume-mail.mjs live|review --before <ref> --after <ref> --report <json> [options]'); process.exit(2) }

  const after = values.after
  const before = isCommit(values.before) ? values.before : `${after}^`
  const plan = await mailPlan({ before, after, touched: git('diff', '--name-only', before, after, '--', 'src/resume.ts', PDF_PATH) })
  if (plan.skip) { console.log(plan.skip); return }
  const { changes } = plan
  const report = values.report && existsSync(values.report) ? JSON.parse(readFileSync(values.report, 'utf8')) : null
  const newFindings = values['new-findings'] && existsSync(values['new-findings']) ? readFileSync(values['new-findings'], 'utf8').split('\n').map((line) => line.trim()).filter(Boolean) : []
  const title = firstLine(values.title)
  console.log(`${changes.length} change${changes.length === 1 ? '' : 's'} in the resume data between ${before.slice(0, 12)} and ${after.slice(0, 12)}.`)

  const summary = await summarize({ kind, changes, title, instruction: values.instruction })
  const email = renderEmail({ kind, summary, score: scoreOf(report), title, instruction: kind === 'review' ? values.instruction : '', links: { pr: values.pr, preview: values.preview, run: values['run-url'] }, newFindings, findings: report?.findings ?? [] })
  send(email, { out: values.out, dryRun: values['dry-run'] })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.stack || String(error)); process.exit(1) })
}
