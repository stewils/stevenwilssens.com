// Steven's LinkedIn profile next to the site and the resume. LinkedIn has no API for
// this, so the profile comes in as text (the "Save to PDF" export or the profile page
// copied into the conversation) or as the CSV files of LinkedIn's data export
// (Profile.csv, Positions.csv, Skills.csv, Education.csv, Languages.csv). Parsing the
// text is heuristic, so the parsed positions are returned for Steven to confirm.
import { education, experiences, profile, skills as siteSkills } from '../../../src/resume'

export type LinkedInPosition = { title: string; company: string; dates: string; location?: string; description?: string }
export type LinkedInProfile = {
  name?: string
  headline?: string
  about?: string
  location?: string
  positions: LinkedInPosition[]
  skills: string[]
  education: string[]
  languages: string[]
  source: 'text' | 'csv'
  heuristic: boolean
  importedAt: number
}

// "December 2024" -> "Dec 2024"; "Present" stays; anything else is returned as is.
export const shortMonth = (value: string) => value.trim().replace(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/, (_, month: string, year: string) => `${month[0].toUpperCase()}${month.slice(1).toLowerCase()} ${year}`)
const dateLine = /^((?:[A-Za-z]{3,9}\.? )?\d{4})\s*[-–]\s*((?:[A-Za-z]{3,9}\.? )?\d{4}|Present)(?:\s*\(.*\))?$/
const durationLine = /^(\d+ years?(?: \d+ months?)?|\d+ months?)$/
const sectionHeaders = new Set(['contact', 'top skills', 'skills', 'languages', 'honors-awards', 'honors & awards', 'patents', 'publications', 'certifications', 'summary', 'about', 'experience', 'education'])

export const parseLinkedInText = (raw: string, now: number): LinkedInProfile => {
  const lines = raw.replace(/\r/g, '').split('\n').map((line) => line.replace(/\s+/g, ' ').trim())
  const lower = lines.map((line) => line.toLowerCase())
  const sectionAt = (name: string) => lower.findIndex((line) => line === name)
  const sectionText = (name: string) => {
    const start = sectionAt(name)
    if (start < 0) return []
    const out: string[] = []
    for (let i = start + 1; i < lines.length && !sectionHeaders.has(lower[i]); i++) if (lines[i]) out.push(lines[i])
    return out
  }
  const result: LinkedInProfile = { positions: [], skills: [], education: [], languages: [], source: 'text', heuristic: true, importedAt: now }

  const nameAt = lower.findIndex((line) => line === profile.name.toLowerCase())
  if (nameAt >= 0) {
    result.name = lines[nameAt]
    const after = lines.slice(nameAt + 1).filter(Boolean)
    result.headline = after[0]
    if (after[1] && !sectionHeaders.has(after[1].toLowerCase())) result.location = after[1]
  }
  const about = sectionText('summary').length ? sectionText('summary') : sectionText('about')
  if (about.length) result.about = about.join(' ')
  result.skills = [...sectionText('top skills'), ...sectionText('skills')]
  result.languages = sectionText('languages')
  result.education = sectionText('education')

  // Experience: blocks end at a date line; the line above is the title, and the
  // company is either the line above that (first role at a company) or the company
  // whose name was followed by a total duration ("Microsoft" / "17 years 11 months").
  const start = sectionAt('experience')
  const end = (() => { const e = sectionAt('education'); return e > start ? e : lines.length })()
  if (start >= 0) {
    let company = ''
    let pending: string[] = []
    for (let i = start + 1; i < end; i++) {
      const line = lines[i]
      if (!line) continue
      if (durationLine.test(lines[i + 1] ?? '')) { company = line; i++; pending = []; continue }
      const match = dateLine.exec(line)
      if (match) {
        const title = pending.pop() ?? ''
        const maybeCompany = pending.pop()
        if (maybeCompany && !/[.!?]$/.test(maybeCompany) && maybeCompany.length < 60) company = maybeCompany
        const position: LinkedInPosition = { title, company, dates: `${shortMonth(match[1])} - ${shortMonth(match[2])}` }
        // Location on the next line when it is short and has no period; then the description until the next blank line.
        const next = lines[i + 1] ?? ''
        let j = i + 1
        if (next && next.length < 60 && !/[.!?]$/.test(next) && !dateLine.test(next)) { position.location = next; j++ }
        const description: string[] = []
        for (; j < end && lines[j] && !dateLine.test(lines[j]) && !durationLine.test(lines[j + 1] ?? ''); j++) description.push(lines[j])
        if (description.length) position.description = description.join(' ')
        result.positions.push(position)
        pending = []
        i = j
        // A blank line ends the block; whatever follows before the next date line is a title (and maybe a new company).
        continue
      }
      pending.push(line)
    }
  }
  return result
}

// RFC 4180: quoted fields may hold commas, quotes ("" for one quote) and newlines.
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((cell) => cell.trim()))
}
const records = (csv: string | undefined) => {
  if (!csv) return []
  const rows = parseCsv(csv.replace(/^﻿/, ''))
  // LinkedIn's exports sometimes start with a notes line before the header; Skills.csv has a single column.
  if (!rows.length) return []
  const headerAt = rows[0].length === 1 && rows.some((row) => row.length > 1) ? rows.findIndex((row) => row.length > 1) : 0
  const header = rows[headerAt].map((cell) => cell.trim().toLowerCase())
  return rows.slice(headerAt + 1).map((row) => Object.fromEntries(header.map((name, index) => [name, (row[index] ?? '').trim()])))
}

export type LinkedInCsvFiles = { profile?: string; positions?: string; skills?: string; education?: string; languages?: string }
export const parseLinkedInCsv = (files: LinkedInCsvFiles, now: number): LinkedInProfile => {
  const me = records(files.profile)[0] ?? {}
  const positions = records(files.positions).map((row) => ({
    title: row['title'] ?? '',
    company: row['company name'] ?? '',
    dates: `${shortMonth(row['started on'] ?? '')} - ${row['finished on'] ? shortMonth(row['finished on']) : 'Present'}`,
    location: row['location'] || undefined,
    description: row['description'] || undefined,
  }))
  return {
    name: me['first name'] ? `${me['first name']} ${me['last name'] ?? ''}`.trim() : undefined,
    headline: me['headline'] || undefined,
    about: me['summary'] || undefined,
    location: me['geo location'] || undefined,
    positions,
    skills: records(files.skills).map((row) => row['name']).filter(Boolean),
    education: records(files.education).map((row) => [row['degree name'], row['school name'], [row['start date'], row['end date']].filter(Boolean).join(' - ')].filter(Boolean).join(', ')),
    languages: records(files.languages).map((row) => [row['name'], row['proficiency']].filter(Boolean).join(': ')),
    source: 'csv',
    heuristic: false,
    importedAt: now,
  }
}

export type LinkedInFix = { area: string; linkedinSays: string; siteSays: string; why: string; paste: string }

const norm = (value: string | undefined) => (value ?? '').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
const words = (value: string) => new Set(norm(value).split(/[^a-z0-9&+]+/).filter((w) => w.length > 2))
const overlap = (a: string, b: string) => { const wa = words(a); const wb = words(b); let n = 0; for (const w of wa) if (wb.has(w)) n++; return wa.size ? n / wa.size : 0 }

// A phrase continuing a sentence: its first letter lowered, unless it opens with an acronym ("US").
export const lowerFirst = (value: string) => /^[A-Z][a-z]/.test(value) ? value[0].toLowerCase() + value.slice(1) : value

// The headline, about and position descriptions Steven should paste into LinkedIn so
// it tells the same story as the site and the resume.
export const linkedInTexts = () => ({
  headline: `${profile.resumeHeadline} | ex-Microsoft, led Windows & Devices Data PM | ${profile.location}`,
  about: `${profile.summary}\n\nLooking for: ${profile.lookingFor.toLowerCase()}. ${profile.location}, ${profile.workAuthorization.replace(/ \(.*\)$/, '').toLowerCase()}, ${profile.availability.toLowerCase()}, ${lowerFirst(profile.workArrangement)}.\n\nMore, including selected work and recommendations: ${profile.site}`,
  position: (key: string) => { const item = experiences.find((entry) => entry.key === key)!; return `${item.summary}\n\n${item.points.map((point) => `• ${point}`).join('\n')}` },
})

export const compareLinkedIn = (linkedin: LinkedInProfile, now: number): { fixes: LinkedInFix[]; summary: string } => {
  const fixes: LinkedInFix[] = []
  const texts = linkedInTexts()
  const ageDays = Math.floor((now - linkedin.importedAt) / 86_400_000)

  if (!linkedin.headline || overlap(profile.resumeHeadline, linkedin.headline) < 0.5 || !/data/i.test(linkedin.headline) || !/(^|\W)ai(\W|$)|experimentation/i.test(linkedin.headline)) {
    fixes.push({ area: 'headline', linkedinSays: linkedin.headline ?? '(not imported)', siteSays: profile.resumeHeadline, why: 'Recruiters search LinkedIn by headline keywords and read it before anything else. It has to carry the level (principal), the domain (data, experimentation, AI) and the location, and say the same thing as the site, so the story is identical wherever they land.', paste: texts.headline })
  }
  if (!linkedin.about || overlap(profile.summary, linkedin.about) < 0.45 || !/10 to 20|\d+ product managers/i.test(linkedin.about) || !/experimentation/i.test(linkedin.about)) {
    fixes.push({ area: 'about', linkedinSays: linkedin.about ? `${linkedin.about.slice(0, 200)}${linkedin.about.length > 200 ? '…' : ''}` : '(not imported)', siteSays: profile.summary, why: 'The About section is where a recruiter checks scope (team size), domain keywords and what you want next. Without "10 to 20 product managers", "experimentation" and the role you are looking for, the profile reads junior to the resume.', paste: texts.about })
  }
  if (linkedin.location && !/seattle|redmond|bellevue|washington/i.test(linkedin.location)) {
    fixes.push({ area: 'location', linkedinSays: linkedin.location, siteSays: profile.location, why: 'Location filters are the first recruiter search filter; a mismatch with the site and the resume raises the question of where you actually are.', paste: profile.location })
  }

  // A LinkedIn position is the same role when the company matches and either the start
  // month does (one role per start month) or the title is nearly identical.
  const sameCompany = (item: typeof experiences[number], pos: LinkedInPosition) => pos.company.toLowerCase().includes(item.company.toLowerCase().split(' ')[0])
  const sameStart = (item: typeof experiences[number], pos: LinkedInPosition) => pos.dates.split(' - ')[0] === item.dates.split(' - ')[0]
  const sameRole = (item: typeof experiences[number], pos: LinkedInPosition) => sameCompany(item, pos) && (sameStart(item, pos) || overlap(item.role, pos.title) >= 0.85)
  for (const item of experiences) {
    const match = linkedin.positions.find((pos) => sameCompany(item, pos) && sameStart(item, pos)) ?? linkedin.positions.find((pos) => sameRole(item, pos))
    if (!match) {
      fixes.push({ area: `position:${item.key}`, linkedinSays: '(no matching position)', siteSays: `${item.role}, ${item.company}, ${item.dates}`, why: 'Every role on the resume should be on LinkedIn with the same title and dates; recruiters cross-check them and treat a missing or renamed role as a discrepancy.', paste: `${item.role}\n${item.company} · ${item.dates}\n\n${texts.position(item.key)}` })
      continue
    }
    if (match.dates !== item.dates) fixes.push({ area: `dates:${item.key}`, linkedinSays: `${match.title}: ${match.dates}`, siteSays: item.dates, why: 'Dates that differ by even a month between LinkedIn and the resume look like an error to a background check. Pick the right ones and use them everywhere.', paste: item.dates })
    if (overlap(item.role.replace(/ - .*$/, ''), match.title) < 0.8) fixes.push({ area: `title:${item.key}`, linkedinSays: match.title, siteSays: item.role, why: 'The title is what recruiter searches match on; the resume and LinkedIn should use the same one.', paste: item.role })
    const wanted = [item.summary, ...item.points]
    const description = match.description ?? ''
    const missing = wanted.filter((line) => overlap(line, description) < 0.6)
    if (missing.length && experiences.indexOf(item) < 4) fixes.push({ area: `description:${item.key}`, linkedinSays: description ? `${description.slice(0, 200)}${description.length > 200 ? '…' : ''}` : '(empty)', siteSays: wanted.join(' '), why: experiences.indexOf(item) < 2 ? 'The two most recent roles carry the recruiter screen: team size, scope and outcomes. LinkedIn should say what the resume says, bullet for bullet.' : 'The role description on LinkedIn is thinner than the resume; align it so a recruiter reading either gets the same picture.', paste: texts.position(item.key) })
  }
  const extra = linkedin.positions.filter((pos) => !experiences.some((item) => sameRole(item, pos)))
  for (const pos of extra) fixes.push({ area: 'extra-position', linkedinSays: `${pos.title}, ${pos.company}, ${pos.dates}`, siteSays: '(not on the site or the resume)', why: 'A role on LinkedIn that the resume leaves out is a question waiting to be asked. Add it to src/resume.ts or remove it from LinkedIn.', paste: '' })

  const skillWords = norm(linkedin.skills.join(' | '))
  const missingSkills = siteSkills.map((skill) => skill.split(' (')[0]).filter((skill) => !words(skill).size || ![...words(skill)].some((w) => skillWords.includes(w)))
  if (missingSkills.length) fixes.push({ area: 'skills', linkedinSays: linkedin.skills.length ? linkedin.skills.join(', ') : '(none imported)', siteSays: siteSkills.join(', '), why: 'Recruiter searches and LinkedIn\'s own matching use the Skills list. Pin the data, experimentation, AI and leadership skills the resume leads with.', paste: siteSkills.join('\n') })
  if (!linkedin.education.some((line) => /karel de grote/i.test(line))) fixes.push({ area: 'education', linkedinSays: linkedin.education.join('; ') || '(none imported)', siteSays: `${education.degree}, ${education.school}, ${education.dates}`, why: 'Education is a hard filter in some applicant tracking systems; keep it identical to the resume.', paste: `${education.degree}, ${education.school} (${education.dates})` })

  const summary = fixes.length
    ? `${fixes.length} thing${fixes.length === 1 ? '' : 's'} to change on LinkedIn (import from ${ageDays} day${ageDays === 1 ? '' : 's'} ago${linkedin.heuristic ? ', parsed from text, so confirm the positions below' : ''}).`
    : `LinkedIn matches the site and the resume (import from ${ageDays} day${ageDays === 1 ? '' : 's'} ago).`
  return { fixes, summary }
}
