// Reads a resume PDF the way a recruiter, an applicant tracking system and a careful
// editor would, and scores it. Three callers: scripts/resume.mjs (a new PDF only
// replaces the current one when it scores at least as well), src/resume.test.ts (the
// PDF must match src/resume.ts, so a content change always comes with a new resume)
// and the build (dist/resume-report.json, which the MCP server's check_resume reads).
//
//   node scripts/resume-check.mjs [path/to/resume.pdf] [--json path/to/report.json] [--baseline report.json|https://…/resume-report.json]
//
// --baseline (or the RESUME_BASELINE environment variable) compares the score with an
// earlier report: what main scored before a change, or the live site's
// /resume-report.json. The workflows use it to warn when an update would lower the
// score recruiters see today; the comparison is written into the report (baseline).
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { education, experiences, impact, profile, skills } from '../src/resume.ts'

export const resumePath = resolve('public', profile.resumePdf.slice(1))

export async function extractPdf(path) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const require = createRequire(import.meta.url)
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href
  const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true, isEvalSupported: false, disableFontFace: true })
  const doc = await task.promise
  const pages = []
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number)
    const content = await page.getTextContent()
    let text = ''
    for (const item of content.items) if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ')
    pages.push(text)
  }
  const meta = await doc.getMetadata().catch(() => null)
  await task.destroy()
  return { pages, text: pages.join('\n\n'), title: meta?.info?.Title ?? null, bytes: statSync(path).size }
}

const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
// "Dec 2024 - Sep 2026" -> serial months, or null when the dates do not parse.
export const span = (dates) => {
  const parts = dates.split(/\s*-\s*/).map((part) => { const m = /^([A-Za-z]{3})\w*\s+(\d{4})$/.exec(part.trim()); return m ? Number(m[2]) * 12 + months[m[1].toLowerCase()] : null })
  return parts.length === 2 && parts[0] !== null && parts[1] !== null ? { start: parts[0], end: parts[1] } : null
}
const monthName = (serial) => `${Object.keys(months)[serial % 12].replace(/^./, (c) => c.toUpperCase())} ${Math.floor(serial / 12)}`

const normalize = (text) => text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
// Verbs that only read as present tense ("Set", "Run", "Spearhead" read as past as well).
const presentTense = /^(Lead|Own|Partner|Drive|Build|Manage|Define|Deliver|Grow|Oversee|Create|Develop|Ship|Work)\b/

// Questions the data itself raises, independent of the PDF: what a recruiter will ask
// from the dates alone, and which numbers have nothing behind them.
export const dataQuestions = (now = new Date()) => {
  const questions = []
  const current = now.getFullYear() * 12 + now.getMonth()
  experiences.forEach((item, index) => {
    const mine = span(item.dates)
    const previous = experiences[index + 1]
    const before = previous ? span(previous.dates) : null
    if (mine && before && mine.start - before.end > 6) questions.push({ about: item.key, question: `${previous.role} at ${previous.company} ended ${monthName(before.end)} and ${item.role} started ${monthName(mine.start)}: ${mine.start - before.end - 1} months in between. What happened? Recruiters ask, so say it or correct the dates.` })
    if (mine && before && before.end > mine.start + 1) questions.push({ about: item.key, question: `${item.role} (${item.dates}) overlaps with ${previous.role} at ${previous.company} (${previous.dates}). Were these consultancy placements, or should the dates change?` })
    if (index === 0 && mine && current - mine.end > 6) questions.push({ about: item.key, question: `The last role ended ${monthName(mine.end)}, ${current - mine.end} months ago. What have you been doing since, in one line for the resume?` })
  })
  for (const { value, label, backing } of impact) if (!backing) questions.push({ about: 'impact', question: `"${value} ${label}" has no role bullet explaining it. Which role, measured how, over what period? Add the bullet (and set backing in src/resume.ts) or drop the number.` })
  return questions
}

// The analysis. Findings carry a severity: error (the PDF is wrong or unusable),
// warn (weaker than it should be), info (worth knowing). Score: 100 minus 25 per
// error and 5 per warning, floored at 0.
export async function analyzeResume(path = resumePath, { now = new Date() } = {}) {
  if (!existsSync(path)) return { path, exists: false, score: 0, pages: 0, bytes: 0, title: null, findings: [{ severity: 'error', id: 'missing', message: `No resume at ${path}. Run: npm run resume:build` }], questions: dataQuestions(now) }
  const pdf = await extractPdf(path)
  const text = normalize(pdf.text)
  const has = (needle) => text.includes(normalize(needle))
  const findings = []
  const add = (severity, id, message) => findings.push({ severity, id, message })

  // Usable by machines: text extractable, no broken glyphs, not too long, not too heavy.
  if (pdf.pages.length > 2) add('error', 'pages', `${pdf.pages.length} pages; a resume for a principal role is two at most.`)
  if (text.length < 1500) add('error', 'text', `Only ${text.length} characters of text could be extracted; applicant tracking systems will see little or nothing.`)
  if (/[�-]/.test(pdf.text)) add('error', 'glyphs', 'The text contains replacement or private-use characters (often bullets drawn with icon fonts); parsers turn these into garbage.')
  if (pdf.pages.length === 2 && pdf.pages[1].length < pdf.pages[0].length * 0.3) add('warn', 'sparse-page', 'The second page is mostly empty; tighten to one page or give it real content.')
  if (pdf.bytes > 1_500_000) add('warn', 'size', `${(pdf.bytes / 1e6).toFixed(1)} MB; keep the file under 1.5 MB for email and upload limits.`)
  if (!pdf.title || !pdf.title.includes(profile.name)) add('info', 'title', `The PDF's title metadata is "${pdf.title ?? ''}"; the person's name there helps when the file is renamed.`)

  // Says who he is and how to reach him.
  for (const [id, value, severity] of [['email', profile.email, 'error'], ['phone', profile.phone, 'warn'], ['linkedin', 'linkedin.com/in/steven-wilssens', 'error'], ['location', profile.location, 'warn'], ['site', 'steven.wilssens.com', 'warn'], ['authorization', profile.workAuthorization.replace(/ \(.*\)$/, ''), 'warn']]) if (!has(value)) add(severity, `contact-${id}`, `Missing from the PDF: ${value}.`)
  if (!has(profile.resumeHeadline) && !has(profile.headline)) add('error', 'headline', `The headline "${profile.resumeHeadline}" is not in the PDF; the site and the resume must say the same thing.`)
  if (!has(profile.summary.slice(0, 80))) add('warn', 'summary', 'The summary in the PDF differs from profile.summary in src/resume.ts.')

  // Matches the site: every role, its dates, and the bullets of the two most recent roles.
  experiences.forEach((item, index) => {
    if (!has(item.role)) add('error', `role-${item.key}`, `Role title missing: ${item.role}.`)
    if (!has(item.company)) add('error', `company-${item.key}`, `Company missing for ${item.role}: ${item.company}.`)
    if (!has(item.dates)) add('warn', `dates-${item.key}`, `Dates "${item.dates}" not found for ${item.role}; the site and the PDF should agree to the month.`)
    if (index < 2) for (const point of item.points) if (!has(point.slice(0, 60))) add('error', `point-${item.key}`, `A bullet of ${item.role} is missing or reworded: "${point.slice(0, 60)}…"`)
    else if (!has(item.summary.slice(0, 50))) add('warn', `summary-${item.key}`, `The summary of ${item.role} is missing or reworded.`)
    // Past roles in the past tense.
    const mine = span(item.dates)
    const current = now.getFullYear() * 12 + now.getMonth()
    if (mine && mine.end < current) for (const point of [item.summary, ...item.points]) if (presentTense.test(point)) add('warn', `tense-${item.key}`, `${item.role} ended ${monthName(mine.end)} but a line starts in the present tense: "${point.slice(0, 50)}…"`)
  })
  if (!has(education.degree.split(',')[0])) add('warn', 'education', 'Education missing.')

  // Reads like a principal's resume: scope, numbers with context, keywords.
  if (!/\b\d+ to \d+ product managers\b|\bteam of \d+/.test(text)) add('warn', 'scope', 'No team size anywhere; recruiters screen principal and director candidates on scope first.')
  for (const { value, label, backing } of impact) {
    if (!has(value)) add('warn', `impact-${value}`, `The site shows "${value} ${label}" but the PDF does not.`)
    if (!backing) add('warn', `unbacked-${value}`, `"${value} ${label}" has no role bullet behind it in src/resume.ts; a hiring manager will ask what it measures.`)
  }
  for (const keyword of ['experimentation', 'machine learning', 'telemetry', 'roadmap', 'strategy', 'product manager', 'data platform', 'a/b']) if (!has(keyword)) add('warn', `keyword-${keyword}`, `Keyword missing for searches and ATS filters: "${keyword}".`)
  if (!/\bai\b/.test(text)) add('warn', 'keyword-ai', 'Keyword missing for searches and ATS filters: "AI".')
  for (const skill of skills) if (!has(skill.split(' (')[0])) add('info', `skill-${skill}`, `Skill from src/resume.ts not in the PDF: ${skill}.`)
  if (!/\d+%|\d+ ?(million|billion|b\+)|\d+x\b/.test(text)) add('warn', 'numbers', 'No percentages or scale numbers; outcomes read as duties.')

  const errors = findings.filter((f) => f.severity === 'error').length
  const warnings = findings.filter((f) => f.severity === 'warn').length
  return { path, exists: true, score: Math.max(0, 100 - errors * 25 - warnings * 5), errors, warnings, pages: pdf.pages.length, bytes: pdf.bytes, title: pdf.title, matchesSite: errors === 0, findings, questions: dataQuestions(now), checkedAt: now.toISOString() }
}

// The score a change is measured against: a report written earlier (a file) or the
// live site's /resume-report.json (a URL). Returns null, never throws, when it cannot
// be read: a missing baseline must not fail a build.
export async function readBaseline(source) {
  if (!source) return null
  try {
    const text = /^https?:\/\//.test(source) ? await (await fetch(source, { signal: AbortSignal.timeout(15_000) })).text() : readFileSync(resolve(source), 'utf8')
    const report = JSON.parse(text)
    return typeof report.score === 'number' ? { source, score: report.score, errors: report.errors ?? null, warnings: report.warnings ?? null, checkedAt: report.checkedAt ?? null } : null
  } catch {
    return null
  }
}

// How the new score relates to the baseline; `lower` is the warning the workflows act on.
export const compareScores = (report, baseline) => {
  if (!baseline) return null
  const change = report.score - baseline.score
  return { ...baseline, change, lower: change < 0, verdict: change < 0 ? 'lower' : change > 0 ? 'higher' : 'unchanged' }
}

export const formatComparison = (report) => {
  const b = report.baseline
  if (!b) return `Score ${report.score}/100; no baseline to compare with.`
  const from = /^https?:\/\//.test(b.source) ? 'the live site' : b.source
  if (b.lower) return `Score ${b.score} → ${report.score}: LOWER than ${from}. Fix the findings above before this goes live, or accept the trade-off knowingly.`
  return `Score ${b.score} → ${report.score}: ${b.verdict === 'higher' ? 'higher than' : 'the same as'} ${from}.`
}

export const formatReport = (report) => [
  `${report.path}: score ${report.score}/100${report.exists ? `, ${report.pages} page${report.pages === 1 ? '' : 's'}, ${(report.bytes / 1024).toFixed(0)} KB, ${report.errors} error${report.errors === 1 ? '' : 's'}, ${report.warnings} warning${report.warnings === 1 ? '' : 's'}` : ''}`,
  ...report.findings.map((f) => `  [${f.severity}] ${f.message}`),
  ...(report.questions.length ? ['  Questions for Steven:', ...report.questions.map((q) => `  - (${q.about}) ${q.question}`)] : []),
].join('\n')

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args.splice(index, 2)[1] : null }
  const jsonPath = option('--json')
  const baselineSource = option('--baseline') ?? process.env.RESUME_BASELINE ?? null
  const report = await analyzeResume(args[0] ? resolve(args[0]) : resumePath)
  if (baselineSource) {
    report.baseline = compareScores(report, await readBaseline(baselineSource))
    if (!report.baseline) console.log(`No baseline could be read from ${baselineSource}; the score is not compared.`)
  }
  console.log(formatReport(report))
  if (report.baseline) {
    console.log(formatComparison(report))
    // In GitHub Actions a drop also shows as a warning on the run and on the pull request's checks.
    if (report.baseline.lower && process.env.GITHUB_ACTIONS) console.log(`::warning title=Resume score dropped::${formatComparison(report)}`)
  }
  if (jsonPath) { writeFileSync(resolve(jsonPath), JSON.stringify(report, null, 2)); console.log(`Wrote ${jsonPath}`) }
  process.exitCode = report.errors ? 1 : 0
}
