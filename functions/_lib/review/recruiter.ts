// What a recruiter or hiring manager runs into on steven.wilssens.com, the resume and
// LinkedIn, computed from the same data the site is built from plus the published
// pages, the resume report the build writes and the LinkedIn import. Findings say what
// is wrong, why a recruiter cares and what fixes it; questions are the ones only
// Steven can answer, for the interviewer to ask.
import { experiences, impact, profile, selectedWork } from '../../../src/resume'
import type { LinkedInFix } from './linkedin'

export type Severity = 'high' | 'medium' | 'low'
export type Finding = { area: string; severity: Severity; finding: string; why: string; fix: string }
export type Question = { about: string; question: string; whyItMatters: string }
// The score is the ATS score: only findings with lens 'ats' make it (scripts/resume-check.mjs).
export type ResumeReport = { exists?: boolean; score: number; pages?: number; errors?: number; warnings?: number; ats?: { errors: number; warnings: number }; matchesSite?: boolean; checkedAt?: string; findings: { severity: 'error' | 'warn' | 'info'; lens?: 'ats' | 'site' | 'recruiter'; id: string; message: string }[]; questions: { about: string; question: string }[] }
export type ReviewInput = { pages: Record<string, string | null>; resumeReport: ResumeReport | null; linkedin: { fixes: LinkedInFix[]; summary: string } | null; now: number }
export type Review = { score: number; headline: string; findings: Finding[]; questions: Question[]; counts: Record<Severity, number> }

const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
const span = (dates: string) => {
  const parts = dates.split(/\s*-\s*/).map((part) => { const m = /^([A-Za-z]{3})\w*\s+(\d{4})$/.exec(part.trim()); return m ? Number(m[2]) * 12 + months[m[1].toLowerCase()] : null })
  return parts.length === 2 && parts[0] !== null && parts[1] !== null ? { start: parts[0], end: parts[1] } : null
}
const monthName = (serial: number) => `${Object.keys(months)[serial % 12].replace(/^./, (c) => c.toUpperCase())} ${Math.floor(serial / 12)}`
const presentTense = /^(Lead|Own|Partner|Drive|Build|Manage|Define|Deliver|Grow|Oversee|Create|Develop|Ship|Work)\b/
const scopeWords = /\b\d+ to \d+ (product managers|pms|engineers)|team of (about )?\d+|(pm|product management) organization of (about )?\d+|\d+ (product managers|pms|engineers|data scientists)\b/i

export const reviewForRecruiters = ({ pages, resumeReport, linkedin, now }: ReviewInput): Review => {
  const findings: Finding[] = []
  const questions: Question[] = []
  const current = new Date(now).getFullYear() * 12 + new Date(now).getMonth()
  const text = (page: string) => (pages[page] ?? '').replace(/\s+/g, ' ')

  // 1. Scope. Recruiters for principal and director roles screen on team size first.
  for (const item of experiences.filter((entry) => /Lead|Group|Team Lead/.test(entry.role))) {
    if (!scopeWords.test([item.summary, ...item.points].join(' '))) {
      findings.push({ area: `scope:${item.key}`, severity: item === experiences[0] ? 'high' : 'medium', finding: `${item.role} gives no team size or scope numbers.`, why: 'A recruiter decides in seconds whether a leader is at the right level; "led the team" without a number reads as a senior IC.', fix: 'Add how many PMs (and engineers or data scientists) the role led, and what the products were used by, to the role in src/resume.ts.' })
      questions.push({ about: item.key, question: `How many product managers, engineers and data scientists did you lead or partner with as ${item.role}, and how did that change over the period?`, whyItMatters: 'Team size is the first screen for principal and director roles.' })
    }
  }

  // 2. Numbers without backing.
  for (const { value, label, backing } of impact) {
    if (!backing) {
      findings.push({ area: `impact:${value}`, severity: 'high', finding: `"${value} ${label}" appears on the home page and in the resume with no role bullet explaining it.`, why: 'Hiring managers ask "adoption of what, measured how?"; a number that cannot be explained costs more credibility than it earns.', fix: 'Either add a bullet to the role it came from (and set backing in src/resume.ts), or remove it from impact.' })
      questions.push({ about: 'impact', question: `"${value} ${label}": which role, what was measured, over what period, and how much of it was your team's work?`, whyItMatters: 'Unexplained numbers are the first thing a sceptical hiring manager pushes on.' })
    }
  }
  for (const item of experiences.slice(0, 2)) if (![item.summary, ...item.points].some((line) => /\d/.test(line))) findings.push({ area: `outcomes:${item.key}`, severity: 'medium', finding: `${item.role} has no quantified outcome.`, why: 'Bullets without numbers read as duties, not results.', fix: 'Add one measured outcome to the role.' })

  // 3. Dates: gaps, overlaps, time since the last role, tense.
  experiences.forEach((item, index) => {
    const mine = span(item.dates)
    const previous = experiences[index + 1]
    const before = previous ? span(previous.dates) : null
    if (mine && before && mine.start - before.end > 6) questions.push({ about: item.key, question: `${previous.role} at ${previous.company} ended ${monthName(before.end)}; ${item.role} started ${monthName(mine.start)}. What were the ${mine.start - before.end - 1} months in between?`, whyItMatters: 'Recruiters notice gaps over six months and will ask; the site can say it first.' })
    if (mine && before && before.end > mine.start + 1) questions.push({ about: item.key, question: `${item.role} (${item.dates}) overlaps ${previous.role} at ${previous.company} (${previous.dates}). Consultancy placements, or dates to correct?`, whyItMatters: 'Overlapping full-time roles look like an error until explained.' })
    if (index === 0 && mine && current - mine.end > 6) findings.push({ area: 'now', severity: 'medium', finding: `The last role ended ${monthName(mine.end)}, ${current - mine.end} months ago, and the site does not say what has happened since.`, why: 'The longer the gap after the last role, the more a recruiter wants to see current work.', fix: 'Add the current work (building in AI, wilssens.com) as a dated entry or a line in the hero.' })
    if (mine && mine.end < current) for (const line of [item.summary, ...item.points]) if (presentTense.test(line)) findings.push({ area: `tense:${item.key}`, severity: 'low', finding: `A line of ${item.role} is in the present tense although the role ended: "${line.slice(0, 60)}…"`, why: 'Mixed tenses read as a resume that was not updated after leaving.', fix: 'Rewrite the line in the past tense in src/resume.ts.' })
  })

  // 4. Hiring logistics.
  for (const [field, label] of [['location', 'location'], ['workAuthorization', 'work authorization'], ['availability', 'availability'], ['lookingFor', 'the role you are looking for']] as const) {
    if (!profile[field]) findings.push({ area: `logistics:${field}`, severity: 'high', finding: `The ${label} is not stated.`, why: 'Recruiters filter on location and authorization before reading a word; leaving them out gets the profile skipped, not asked.', fix: `Set profile.${field} in src/resume.ts.` })
  }
  if (!/remote|hybrid|on-site|relocat/i.test(`${profile.lookingFor} ${profile.availability} ${text('about')}`)) questions.push({ about: 'general', question: 'Remote, hybrid or on-site, and would you relocate? The site says Seattle but not how flexible that is.', whyItMatters: 'Work arrangement is the second filter after location.' })

  // 5. Proof points to the right chapter.
  const recent = selectedWork.filter((item) => /20(2[0-9]|3\d)/.test(item.period))
  if (recent.length < 3) findings.push({ area: 'proof', severity: 'high', finding: `Only ${recent.length} selected work ${recent.length === 1 ? 'case is' : 'cases are'} from 2020 onwards while the headline is about data and AI.`, why: 'Patents, press and honors are from the spatial audio years; without recent cases the proof contradicts the pitch.', fix: 'Add cases from the Windows data and AI years to selectedWork in src/resume.ts.' })
  for (const item of recent) if (!/\d/.test(item.outcome)) questions.push({ about: item.role, question: `"${item.title}": is there a number for the outcome (users, decisions changed, time saved, adoption)?`, whyItMatters: 'A case with a measured outcome is worth three without.' })

  // 6. The published pages: present, and saying the job-search message once.
  for (const page of ['home', 'about', 'experience', 'work', 'recommendations']) if (pages[page] === null) findings.push({ area: `page:${page}`, severity: 'medium', finding: `The ${page} page is not in this deployment.`, why: 'A link a recruiter follows that fails is the end of the visit.', fix: 'Check the build; the Markdown copy of the page is missing.' })
  const home = text('home')
  const repeats = (home.match(/next (leadership |product leadership )?role|choosing my next|looking for my next|open to work|#opentowork/gi) ?? []).length
  if (repeats > 2) findings.push({ area: 'message', severity: 'low', finding: `The home page says you are looking ${repeats} times.`, why: 'Once reads as confident; repeated, it reads as anxious.', fix: 'Keep it in the hero and the contact band, nowhere else.' })
  if (/consult|hard product problem/i.test(home) && /next .*role/i.test(home)) findings.push({ area: 'message', severity: 'medium', finding: 'The home page mixes a consulting pitch with a job search.', why: 'Recruiters want one answer to "what are you looking for".', fix: 'Pick one call to action in the contact band.' })

  // 7. The resume PDF, from the build's report.
  if (!resumeReport) findings.push({ area: 'resume', severity: 'medium', finding: 'No resume report is available for this deployment.', why: 'The resume is what recruiters forward; it has to match the site.', fix: 'The build writes /resume-report.json; redeploy.' })
  else {
    if (!resumeReport.matchesSite) findings.push({ area: 'resume', severity: 'high', finding: `The resume PDF does not match the site (${resumeReport.errors ?? '?'} errors, score ${resumeReport.score}).`, why: 'A resume that says something different from the site is the fastest way to lose a recruiter\'s trust.', fix: 'Run npm run resume:build and commit the PDF, or use request_site_update.' })
    for (const f of resumeReport.findings.filter((item) => item.severity !== 'info')) findings.push({ area: `resume:${f.id}`, severity: f.severity === 'error' ? 'high' : 'low', finding: f.message, why: 'From the resume analysis (ATS readability, contact, keywords, scope, tense).', fix: 'Fix the data in src/resume.ts and rebuild the resume.' })
    for (const q of resumeReport.questions) if (!questions.some((item) => item.question === q.question)) questions.push({ about: q.about, question: q.question, whyItMatters: 'Raised by the resume analysis.' })
  }

  // 8. LinkedIn.
  if (!linkedin) findings.push({ area: 'linkedin', severity: 'medium', finding: 'LinkedIn has not been imported, so it cannot be compared with the site and the resume.', why: 'Most recruiters read LinkedIn before the site; the three must tell the same story.', fix: 'Call save_linkedin_profile with the "Save to PDF" text or the data-export CSV files, then compare_linkedin.' })
  else for (const fix of linkedin.fixes) findings.push({ area: `linkedin:${fix.area}`, severity: /^(headline|about|position|dates)/.test(fix.area) ? 'medium' : 'low', finding: `LinkedIn: ${fix.area} differs. LinkedIn says "${fix.linkedinSays.slice(0, 120)}"; the site says "${fix.siteSays.slice(0, 120)}".`, why: fix.why, fix: fix.paste ? `Paste into LinkedIn: ${fix.paste.slice(0, 300)}${fix.paste.length > 300 ? '…' : ''}` : 'Resolve the difference on LinkedIn or in src/resume.ts.' })

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  findings.sort((a, b) => order[a.severity] - order[b.severity])
  const counts = { high: findings.filter((f) => f.severity === 'high').length, medium: findings.filter((f) => f.severity === 'medium').length, low: findings.filter((f) => f.severity === 'low').length }
  const score = Math.max(0, 100 - counts.high * 15 - counts.medium * 5 - counts.low * 1)
  const headline = findings.length ? `${score}/100 from a recruiter's seat: ${counts.high} high, ${counts.medium} medium, ${counts.low} low. ${questions.length} question${questions.length === 1 ? '' : 's'} only Steven can answer.` : 'Nothing a recruiter would trip over; the open questions below are the next improvements.'
  return { score, headline, findings, questions, counts }
}
