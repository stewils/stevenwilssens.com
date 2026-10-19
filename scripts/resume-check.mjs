// Reads a resume PDF the way an applicant tracking system, a recruiter and a careful
// editor would. The score is the ATS score: what the applicant tracking system makes of
// the PDF (see lenses below); what a recruiter would say and where the PDF differs from
// the site are findings listed beside it. Three callers: scripts/resume.mjs (a new PDF only
// replaces the current one when it scores at least as well), src/resume.test.ts (the
// PDF must match src/resume.ts, so a content change always comes with a new resume)
// and the build (dist/resume-report.json, which the MCP server's check_resume reads).
//
//   node scripts/resume-check.mjs [path/to/resume.pdf] [--json path/to/report.json] [--baseline report.json|https://…/resume-report.json] [--fail-on-drop]
//
// --baseline (or the RESUME_BASELINE environment variable) compares the score with an
// earlier report: what main scored before a change, or the live site's
// /resume-report.json. The workflows use it to warn when an update would lower the
// score recruiters see today; the comparison is written into the report (baseline).
//
// Exit codes (scripts/resume-gate.mjs): 0 fine; 1 the PDF has errors, or with
// --fail-on-drop the score is lower than the baseline's; 2 with --fail-on-drop when the
// baseline was given but could not be read (missing file, 404, network), so an outage of
// the live report never passes the Review workflow's gate as "not lower". Without
// --fail-on-drop an unreadable baseline is only reported: a build must not fail on it.
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { education, experiences, impact, profile, skills } from '../src/resume.ts'
import { gateExit, unavailableMessages } from './resume-gate.mjs'

export const resumePath = resolve('public', profile.resumePdf.slice(1))

export async function extractPdf(path) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const require = createRequire(import.meta.url)
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href
  const bytes = readFileSync(path)
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false, disableFontFace: true })
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
  // The hash identifies one PDF across builds: the admin's score history keeps one row per PDF.
  return { pages, text: pages.join('\n\n'), title: meta?.info?.Title ?? null, bytes: statSync(path).size, sha256: createHash('sha256').update(bytes).digest('hex') }
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

// Who trips over a finding. Only the ATS lens makes the score: the score is what an
// applicant tracking system makes of the PDF. The other two are listed with it.
export const lenses = {
  ats: 'What an applicant tracking system parses: the text, the contact details, the section headings, the work history (title, company and dates together), education, keywords.',
  site: 'Where the PDF says something else than src/resume.ts, so the site and the resume disagree. Fails the tests; does not change the score.',
  recruiter: 'What a recruiter or an editor would still say: tense, scope, numbers without a bullet behind them. Does not change the score.',
}
const count = (list) => ({ errors: list.filter((f) => f.severity === 'error').length, warnings: list.filter((f) => f.severity === 'warn').length })
// The ATS score: 100 minus 25 per ATS error and 5 per ATS warning, floored at 0.
export const atsScore = (findings) => { const ats = count(findings.filter((f) => f.lens === 'ats')); return Math.max(0, 100 - ats.errors * 25 - ats.warnings * 5) }

// The headings an applicant tracking system files sections under; the first name is
// the one the resume template uses.
const sectionHeadings = { summary: ['summary', 'profile', 'professional summary'], skills: ['skills', 'core skills', 'key skills'], experience: ['experience', 'work experience', 'professional experience', 'employment'], education: ['education'] }
const monthYear = /^[A-Z][a-z]{2}[a-z]* \d{4}$/
// "Dec 2024 - Sep 2026" or "Oct 2026 - Present": the form parsers recognise.
const parseableDates = (dates) => { const parts = dates.split(/\s*-\s*/).map((part) => part.trim()); return parts.length === 2 && monthYear.test(parts[0]) && (monthYear.test(parts[1]) || /^present$/i.test(parts[1])) }
// "E X P E R I E N C E": what letter-spaced capitals become when the PDF is parsed.
const letterByLetter = (line) => /^\S( \S)+$/.test(line)
const squeeze = (line) => line.replace(/ /g, '')

// The analysis. Findings carry a severity (error: the PDF is wrong or unusable; warn:
// weaker than it should be; info: worth knowing) and a lens (above).
export async function analyzeResume(path = resumePath, { now = new Date() } = {}) {
  if (!existsSync(path)) return { path, exists: false, score: 0, errors: 1, warnings: 0, ats: { errors: 1, warnings: 0 }, pages: 0, bytes: 0, title: null, matchesSite: false, findings: [{ severity: 'error', lens: 'ats', id: 'missing', message: `No resume at ${path}. Run: npm run resume:build` }], questions: dataQuestions(now) }
  const pdf = await extractPdf(path)
  const text = normalize(pdf.text)
  const lines = pdf.text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean)
  const has = (needle) => text.includes(normalize(needle))
  const findings = []
  const add = (severity, lens, id, message) => findings.push({ severity, lens, id, message })

  // Usable by machines: text extractable, no broken glyphs, not too long, not too heavy.
  if (pdf.pages.length > 2) add('error', 'ats', 'pages', `${pdf.pages.length} pages; a resume for a principal role is two at most.`)
  if (text.length < 1500) add('error', 'ats', 'text', `Only ${text.length} characters of text could be extracted; applicant tracking systems will see little or nothing.`)
  if (/[�-]/.test(pdf.text)) add('error', 'ats', 'glyphs', 'The text contains replacement or private-use characters (often bullets drawn with icon fonts); parsers turn these into garbage.')
  if (pdf.pages.length === 2 && pdf.pages[1].length < pdf.pages[0].length * 0.3) add('warn', 'recruiter', 'sparse-page', 'The second page is mostly empty; tighten to one page or give it real content.')
  if (pdf.bytes > 1_500_000) add('warn', 'ats', 'size', `${(pdf.bytes / 1e6).toFixed(1)} MB; keep the file under 1.5 MB for email and upload limits.`)
  if (!pdf.title || !pdf.title.includes(profile.name)) add('info', 'ats', 'title', `The PDF's title metadata is "${pdf.title ?? ''}"; the person's name there helps when the file is renamed.`)

  // Parsed into the right fields: the name on the first line, the sections under
  // headings a parser recognises, nothing spelled out letter by letter.
  if (!lines[0]?.includes(profile.name.toLowerCase())) add('warn', 'ats', 'name-first', `The first line of the text is "${lines[0] ?? ''}", not the name; parsers take the first line as the candidate's name.`)
  for (const [section, names] of Object.entries(sectionHeadings)) {
    if (lines.some((line) => names.includes(line))) continue
    const spaced = lines.find((line) => letterByLetter(line) && names.map(squeeze).includes(squeeze(line)))
    add('warn', 'ats', `heading-${section}`, spaced ? `The "${names[0]}" heading comes out letter by letter ("${spaced}"); letter-spaced capitals are parsed as single letters, so the section is not recognised.` : `No "${names[0]}" heading as a line of its own; parsers file the sections under standard headings (${names.join(', ')}).`)
  }
  const spacedLines = lines.filter((line) => letterByLetter(line) && squeeze(line).length > 2 && !Object.values(sectionHeadings).flat().map(squeeze).includes(squeeze(line)))
  if (spacedLines.length) add('warn', 'ats', 'letter-spaced', `${spacedLines.length} ${spacedLines.length === 1 ? 'line comes' : 'lines come'} out letter by letter ("${spacedLines[0]}"); drop the letter-spacing so parsers read words.`)

  // Says who he is and how to reach him.
  for (const [id, value, severity] of [['email', profile.email, 'error'], ['phone', profile.phone, 'warn'], ['linkedin', 'linkedin.com/in/steven-wilssens', 'error'], ['location', profile.location, 'warn'], ['site', 'steven.wilssens.com', 'warn'], ['authorization', profile.workAuthorization.replace(/ \(.*\)$/, ''), 'warn']]) if (!has(value)) add(severity, 'ats', `contact-${id}`, `Missing from the PDF: ${value}.`)
  if (!has(profile.resumeHeadline) && !has(profile.headline)) add('error', 'site', 'headline', `The headline "${profile.resumeHeadline}" is not in the PDF; the site and the resume must say the same thing.`)
  if (!has(profile.summary.slice(0, 80))) add('warn', 'site', 'summary', 'The summary in the PDF differs from profile.summary in src/resume.ts.')

  // The work history: every role with its title, company and dates, in a form parsers
  // read and close enough together to be one entry; the bullets of the two most recent
  // roles and the summaries of the others as the site has them.
  experiences.forEach((item, index) => {
    if (!has(item.role)) add('error', 'ats', `role-${item.key}`, `Role title missing: ${item.role}.`)
    if (!has(item.company)) add('error', 'ats', `company-${item.key}`, `Company missing for ${item.role}: ${item.company}.`)
    if (!parseableDates(item.dates)) add('warn', 'ats', `dateformat-${item.key}`, `Dates "${item.dates}" for ${item.role} are not in the "Mon YYYY - Mon YYYY" (or "- Present") form parsers read.`)
    const at = text.indexOf(normalize(item.dates))
    if (at < 0) add('warn', 'ats', `dates-${item.key}`, `Dates "${item.dates}" not found for ${item.role}; the site and the PDF should agree to the month.`)
    else {
      const title = text.indexOf(normalize(item.role), at)
      if (title < 0 || title - at > 160) add('warn', 'ats', `order-${item.key}`, `"${item.dates}" and "${item.role}" are far apart in the extracted text; the dates and the title of a role must read together or the work history comes out wrong.`)
    }
    if (index < 2) for (const point of item.points) if (!has(point.slice(0, 60))) add('error', 'site', `point-${item.key}`, `A bullet of ${item.role} is missing or reworded: "${point.slice(0, 60)}…"`)
    else if (!has(item.summary.slice(0, 50))) add('warn', 'site', `summary-${item.key}`, `The summary of ${item.role} is missing or reworded.`)
    // Past roles in the past tense.
    const mine = span(item.dates)
    const current = now.getFullYear() * 12 + now.getMonth()
    if (mine && mine.end < current) for (const point of [item.summary, ...item.points]) if (presentTense.test(point)) add('warn', 'recruiter', `tense-${item.key}`, `${item.role} ended ${monthName(mine.end)} but a line starts in the present tense: "${point.slice(0, 50)}…"`)
  })
  if (!has(education.degree.split(',')[0]) || !has(education.school)) add('warn', 'ats', 'education', `Education missing or incomplete: parsers want the degree (${education.degree}) and the school (${education.school}).`)

  // Reads like a principal's resume: scope, numbers with context, keywords.
  if (!/\b\d+ to \d+ product managers\b|\bteam of \d+/.test(text)) add('warn', 'recruiter', 'scope', 'No team size anywhere; recruiters screen principal and director candidates on scope first.')
  for (const { value, label, backing } of impact) {
    if (!has(value)) add('warn', 'site', `impact-${value}`, `The site shows "${value} ${label}" but the PDF does not.`)
    if (!backing) add('warn', 'recruiter', `unbacked-${value}`, `"${value} ${label}" has no role bullet behind it in src/resume.ts; a hiring manager will ask what it measures.`)
  }
  for (const keyword of ['experimentation', 'machine learning', 'telemetry', 'roadmap', 'strategy', 'product manager', 'data platform', 'a/b']) if (!has(keyword)) add('warn', 'ats', `keyword-${keyword}`, `Keyword missing for searches and ATS filters: "${keyword}".`)
  if (!/\bai\b/.test(text)) add('warn', 'ats', 'keyword-ai', 'Keyword missing for searches and ATS filters: "AI".')
  for (const skill of skills) if (!has(skill.split(' (')[0])) add('info', 'ats', `skill-${skill}`, `Skill from src/resume.ts not in the PDF: ${skill}.`)
  if (!/\d+%|\d+ ?(million|billion|b\+)|\d+x\b/.test(text)) add('warn', 'recruiter', 'numbers', 'No percentages or scale numbers; outcomes read as duties.')

  const { errors, warnings } = count(findings)
  // errors and warnings count every finding; ats counts the ones that make the score.
  return { path, exists: true, score: atsScore(findings), errors, warnings, ats: count(findings.filter((f) => f.lens === 'ats')), pages: pdf.pages.length, bytes: pdf.bytes, pdfHash: pdf.sha256.slice(0, 16), title: pdf.title, matchesSite: errors === 0, findings, questions: dataQuestions(now), checkedAt: now.toISOString() }
}

// The commit the resume was built from, for the score history on /admin: GitHub Actions
// says which commit it checked out; locally git does. Null when neither is available.
export const commitInfo = () => {
  const run = (command) => { try { return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null } catch { return null } }
  const commit = process.env.GITHUB_SHA ?? run('git rev-parse HEAD')
  return { commit, commitMessage: commit ? run(`git log -1 --format=%s ${commit}`) : null }
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
  if (!b) return `ATS score ${report.score}/100; no baseline to compare with.`
  const from = /^https?:\/\//.test(b.source) ? 'the live site' : b.source
  if (b.lower) return `ATS score ${b.score} → ${report.score}: LOWER than ${from}. Fix the findings above before this goes live, or accept the trade-off knowingly.`
  return `ATS score ${b.score} → ${report.score}: ${b.verdict === 'higher' ? 'higher than' : 'the same as'} ${from}.`
}

export const formatReport = (report) => [
  `${report.path}: ATS score ${report.score}/100${report.exists ? `, ${report.pages} page${report.pages === 1 ? '' : 's'}, ${(report.bytes / 1024).toFixed(0)} KB, ${report.errors} error${report.errors === 1 ? '' : 's'}, ${report.warnings} warning${report.warnings === 1 ? '' : 's'} (${report.ats.errors} and ${report.ats.warnings} of them from the applicant tracking system's reading, which make the score)` : ''}`,
  ...report.findings.map((f) => `  [${f.severity}, ${f.lens}] ${f.message}`),
  ...(report.questions.length ? ['  Questions for Steven:', ...report.questions.map((q) => `  - (${q.about}) ${q.question}`)] : []),
].join('\n')

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args.splice(index, 2)[1] : null }
  const flag = (name) => { const index = args.indexOf(name); if (index >= 0) args.splice(index, 1); return index >= 0 }
  const failOnDrop = flag('--fail-on-drop')
  const jsonPath = option('--json')
  const baselineSource = option('--baseline') ?? process.env.RESUME_BASELINE ?? null
  const report = { ...(await analyzeResume(args[0] ? resolve(args[0]) : resumePath)), ...commitInfo() }
  if (baselineSource) {
    report.baseline = compareScores(report, await readBaseline(baselineSource))
    if (!report.baseline && !failOnDrop) console.log(`No baseline could be read from ${baselineSource}; the score is not compared.`)
  }
  console.log(formatReport(report))
  if (report.baseline) {
    console.log(formatComparison(report))
    // In GitHub Actions a drop also shows as a warning on the run and on the pull request's checks.
    if (report.baseline.lower && process.env.GITHUB_ACTIONS) console.log(`::warning title=Resume score dropped::${formatComparison(report)}`)
  }
  if (jsonPath) { writeFileSync(resolve(jsonPath), JSON.stringify(report, null, 2)); console.log(`Wrote ${jsonPath}`) }
  // --fail-on-drop (the Review workflow's gate): a lower ATS score than the baseline fails
  // too, and a baseline that could not be read refuses the comparison (exit 2).
  const code = gateExit({ report, baselineRequested: Boolean(baselineSource), failOnDrop })
  if (code === 2) for (const line of unavailableMessages(baselineSource, { githubActions: Boolean(process.env.GITHUB_ACTIONS) })) console.error(line)
  process.exitCode = code
}
