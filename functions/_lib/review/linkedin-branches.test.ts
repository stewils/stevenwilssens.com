// The LinkedIn import and comparison on the awkward inputs: an "About" section instead
// of "Summary", a role without a company line, CSV exports with a byte order mark, a
// notes line, Windows line ends and missing columns, and a profile that differs in
// every field the comparison checks.
import { describe, expect, it } from 'vitest'
import { education, experiences, profile } from '../../../src/resume'
import { compareLinkedIn, parseCsv, parseLinkedInCsv, parseLinkedInText, type LinkedInProfile } from './linkedin'

const now = Date.UTC(2026, 9, 17)
const day = 86_400_000

describe('parsing the LinkedIn text', () => {
  it('reads an About section, a name followed by a section, and roles without company or location', () => {
    const text = [
      'Steven Wilssens', 'Headline here', 'Contact', '',
      'About', 'Builds data products.', '',
      'Experience',
      'Solo title',
      '2010 - 2012',
      '',
      'Contoso Ltd', 'Engineer', 'Jan 2008 - Dec 2009', 'A description that ends with a period.', 'More text.',
      '2001 - 2002',
    ].join('\r\n')
    const parsed = parseLinkedInText(text, now)
    expect(parsed).toMatchObject({ name: 'Steven Wilssens', headline: 'Headline here', about: 'Builds data products.' })
    expect(parsed.location).toBeUndefined()
    expect(parsed.positions).toEqual([
      { title: 'Solo title', company: '', dates: '2010 - 2012' },
      { title: 'Engineer', company: 'Contoso Ltd', dates: 'Jan 2008 - Dec 2009', description: 'A description that ends with a period. More text.' },
    ])
    // Reported: a date line right after a description, with no blank line between, is skipped (i = j, then i++).
    expect(parsed.positions.some((position) => position.dates === '2001 - 2002')).toBe(false)
  })

  it('keeps a sentence above a title from becoming the company, and finds nothing without the sections', () => {
    const parsed = parseLinkedInText(['Experience', 'Acme', 'A sentence about the job.', 'Manager', 'Mar 2015 - Present', 'Seattle'].join('\n'), now)
    expect(parsed.positions).toEqual([{ title: 'Manager', company: '', dates: 'Mar 2015 - Present', location: 'Seattle' }])
    const nothing = parseLinkedInText('Nothing useful', now)
    expect(nothing).toMatchObject({ positions: [], skills: [], education: [], languages: [] })
    expect(nothing).not.toHaveProperty('name')
    expect(nothing).not.toHaveProperty('about')
  })
})

describe('parsing the CSV export', () => {
  it('handles Windows line ends, a trailing field without a line end, and empty input', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
    expect(parseCsv('')).toEqual([])
    expect(parseCsv('\n\n , \n')).toEqual([])
  })

  it('skips a byte order mark and a notes line, and fills missing columns', () => {
    const parsed = parseLinkedInCsv({
      profile: '﻿First Name,Last Name\nSteven\n',
      positions: 'Notes: exported from LinkedIn\nCompany Name,Title,Started On,Finished On\nContoso,Engineer,January 2008,\nFabrikam\n',
      skills: '',
      education: 'School Name,Degree Name,Start Date,End Date\nKarel de Grote,,2000,\nNowhere,,,\n',
      languages: 'Name,Proficiency\nDutch,Native\nFrench,\n',
    }, now)
    expect(parsed.name).toBe('Steven')
    expect(parsed).toMatchObject({ headline: undefined, about: undefined, location: undefined, skills: [] })
    expect(parsed.positions).toEqual([
      { title: 'Engineer', company: 'Contoso', dates: 'Jan 2008 - Present', location: undefined, description: undefined },
      { title: '', company: 'Fabrikam', dates: ' - Present', location: undefined, description: undefined },
    ])
    expect(parsed.education).toEqual(['Karel de Grote, 2000', 'Nowhere'])
    expect(parsed.languages).toEqual(['Dutch: Native', 'French'])
  })

  it('reads no name and no files at all', () => {
    const parsed = parseLinkedInCsv({ profile: 'Last Name\nWilssens\n' }, now)
    expect(parsed).toMatchObject({ name: undefined, positions: [], skills: [], education: [], languages: [] })
  })
})

const imported = (overrides: Partial<LinkedInProfile> = {}): LinkedInProfile => ({ positions: [], skills: [], education: [], languages: [], source: 'csv', heuristic: false, importedAt: now, ...overrides })
const matching = () => experiences.map((item) => ({ title: item.role, company: item.company, dates: item.dates, description: [item.summary, ...item.points].join(' ') }))

describe('comparing LinkedIn with the site', () => {
  it('flags a profile with nothing imported', () => {
    const { fixes, summary } = compareLinkedIn(imported(), now + day)
    const headline = fixes.find((fix) => fix.area === 'headline')!
    expect(headline.linkedinSays).toBe('(not imported)')
    expect(fixes.find((fix) => fix.area === 'about')!.linkedinSays).toBe('(not imported)')
    expect(fixes.find((fix) => fix.area === 'skills')!.linkedinSays).toBe('(none imported)')
    expect(fixes.find((fix) => fix.area === 'education')!.linkedinSays).toBe('(none imported)')
    expect(fixes.filter((fix) => fix.area.startsWith('position:'))).toHaveLength(experiences.length)
    expect(fixes.map((fix) => fix.area)).not.toContain('location')
    expect(summary).toMatch(/^\d+ things to change on LinkedIn \(import from 1 day ago\)\.$/)
  })

  it('flags a different location, long texts, dates, titles, thin descriptions and roles the site leaves out', () => {
    const positions = matching()
    const first = experiences[0]
    positions[0] = { ...positions[0], dates: 'Jan 1999 - Feb 1999', title: first.role, description: 'x'.repeat(250) }
    positions[2] = { ...positions[2], title: 'Completely different words', description: undefined as unknown as string }
    positions.push({ title: 'Barista', company: 'Coffee Corner', dates: 'Jan 1998 - Dec 1998', description: '' })
    const linkedin = imported({ headline: 'Barista', about: `${'y'.repeat(250)}`, location: 'Brussels, Belgium', positions, education: ['Karel de Grote, Computer Science'], heuristic: true })
    const { fixes, summary } = compareLinkedIn(linkedin, now + 5 * day)
    const by = (area: string) => fixes.find((fix) => fix.area === area)
    expect(by('location')).toMatchObject({ linkedinSays: 'Brussels, Belgium', paste: profile.location })
    expect(by('about')!.linkedinSays.endsWith('…')).toBe(true)
    expect(by(`dates:${first.key}`)).toMatchObject({ linkedinSays: `${first.role}: Jan 1999 - Feb 1999`, paste: first.dates })
    expect(by(`description:${first.key}`)!.linkedinSays.endsWith('…')).toBe(true)
    expect(by(`title:${experiences[2].key}`)).toMatchObject({ linkedinSays: 'Completely different words' })
    expect(by(`description:${experiences[2].key}`)).toMatchObject({ linkedinSays: '(empty)' })
    expect(by(`description:${experiences[2].key}`)!.why).toMatch(/thinner than the resume/)
    expect(by('extra-position')).toMatchObject({ linkedinSays: 'Barista, Coffee Corner, Jan 1998 - Dec 1998', paste: '' })
    expect(by('education')).toBeUndefined()
    expect(summary).toContain('import from 5 days ago, parsed from text, so confirm the positions below')
  })

  it('counts a single fix in the singular, and a match as a match', () => {
    const skills = ['Product strategy', 'Data platforms', 'Experimentation', 'Machine learning', 'Metrics', 'Leading PM teams', 'Stakeholder communication', 'Go-to-market', 'Software engineering']
    const good = imported({ headline: `${profile.resumeHeadline}`, about: profile.summary, positions: matching(), skills, education: [`${education.degree}, ${education.school}`], location: 'Seattle, WA' })
    const clean = compareLinkedIn(good, now + day)
    expect(clean.fixes.map((fix) => fix.area)).toEqual([])
    expect(clean.summary).toBe('LinkedIn matches the site and the resume (import from 1 day ago).')
    expect(compareLinkedIn(good, now).summary).toBe('LinkedIn matches the site and the resume (import from 0 days ago).')
    const one = compareLinkedIn({ ...good, location: 'Paris' }, now + 2 * day)
    expect(one.summary).toBe('1 thing to change on LinkedIn (import from 2 days ago).')
  })
})
