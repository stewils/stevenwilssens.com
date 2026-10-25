import { describe, expect, it } from 'vitest'
import { experiences, profile } from '../../../src/resume'
import { compareLinkedIn, linkedInTexts, lowerFirst, parseCsv, parseLinkedInCsv, parseLinkedInText, shortMonth } from './linkedin'
import { reviewForRecruiters } from './recruiter'

const now = Date.UTC(2026, 9, 17)

const savedToPdfText = `Contact
steven@wilssens.com
www.linkedin.com/in/steven-wilssens-59495889 (LinkedIn)

Top Skills
Product Management
Data Strategy

Languages
Dutch (Native or Bilingual)

Steven Wilssens
Product Leader at Microsoft
Redmond, Washington, United States

Summary
Product leader with a decade at Microsoft.

Experience

Microsoft
17 years 11 months
Principal Group Product Manager
December 2024 - September 2026 (1 year 10 months)
Redmond, Washington, United States
Lead the PM team for Windows data.

Principal Product Manager Lead
February 2020 - December 2024 (4 years 11 months)
Redmond, Washington
Built data products for the Windows customer experience.

Compuware
Lead Developer and Team Lead
January 2005 - December 2006 (2 years)
Belgium

Education
Karel de Grote-Hogeschool
Bachelor's degree, Computer Science · (2000 - 2004)
`

describe('LinkedIn import', () => {
  it('shortens month names', () => {
    expect(shortMonth('December 2024')).toBe('Dec 2024')
    expect(shortMonth('Sep 2026')).toBe('Sep 2026')
    expect(shortMonth('Present')).toBe('Present')
  })

  it('parses the Save to PDF text: headline, location, about, positions under a shared company, skills, education', () => {
    const parsed = parseLinkedInText(savedToPdfText, now)
    expect(parsed.headline).toBe('Product Leader at Microsoft')
    expect(parsed.location).toBe('Redmond, Washington, United States')
    expect(parsed.about).toContain('decade at Microsoft')
    expect(parsed.skills).toEqual(['Product Management', 'Data Strategy'])
    expect(parsed.positions.map((p) => `${p.title} | ${p.company} | ${p.dates}`)).toEqual([
      'Principal Group Product Manager | Microsoft | Dec 2024 - Sep 2026',
      'Principal Product Manager Lead | Microsoft | Feb 2020 - Dec 2024',
      'Lead Developer and Team Lead | Compuware | Jan 2005 - Dec 2006',
    ])
    expect(parsed.positions[0].description).toContain('Lead the PM team')
    expect(parsed.education[0]).toContain('Karel de Grote')
    expect(parsed.heuristic).toBe(true)
  })

  it('parses RFC 4180 CSV with quoted commas, quotes and newlines', () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi""\nsecond line",\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"\nsecond line', '']])
  })

  it('reads the data export CSV files', () => {
    const parsed = parseLinkedInCsv({
      profile: 'First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location,Twitter Handles,Websites,Instant Messengers\nSteven,Wilssens,,,,"Principal product leader: data, experimentation and AI","Summary here",Software,,"Seattle, Washington, United States",,,\n',
      positions: 'Company Name,Title,Description,Location,Started On,Finished On\nMicrosoft,Principal Group Product Manager - Windows & Devices Data,"Led a team of 10 to 20 product managers.","Redmond, Washington",Dec 2024,Sep 2026\nMicrosoft,Principal Product Manager Lead - CSX Data,,Redmond,Feb 2020,Dec 2024\n',
      skills: 'Name\nExperimentation\nMachine Learning\n',
    }, now)
    expect(parsed.source).toBe('csv')
    expect(parsed.heuristic).toBe(false)
    expect(parsed.headline).toBe('Principal product leader: data, experimentation and AI')
    expect(parsed.positions[0]).toMatchObject({ company: 'Microsoft', dates: 'Dec 2024 - Sep 2026', location: 'Redmond, Washington' })
    expect(parsed.skills).toEqual(['Experimentation', 'Machine Learning'])
  })

  it('tells Steven what to fix on LinkedIn, why, and what to paste', () => {
    const parsed = parseLinkedInText(savedToPdfText, now)
    const { fixes, summary } = compareLinkedIn(parsed, now + 3 * 86_400_000)
    const areas = fixes.map((fix) => fix.area)
    expect(areas).toContain('headline')
    expect(areas).toContain('about')
    expect(areas).toContain('description:windows-devices-data')
    expect(areas.filter((area) => area.startsWith('position:'))).toEqual(expect.arrayContaining(['position:azure-devops', 'position:cosmos']))
    expect(areas).toContain('skills')
    expect(summary).toMatch(/to change on LinkedIn/)
    const headline = fixes.find((fix) => fix.area === 'headline')!
    expect(headline.paste).toContain(profile.resumeHeadline)
    expect(headline.why).toMatch(/recruiters search/i)
    for (const fix of fixes) { expect(fix.why.length).toBeGreaterThan(20); expect(fix.siteSays.length).toBeGreaterThan(0) }
    expect(linkedInTexts().position('windows-devices-data')).toContain(experiences.find((e) => e.key === 'windows-devices-data')!.points[0])
    // The arrangement follows the availability, first letter lowered; the facts kept off the home page stay off LinkedIn too.
    const about = linkedInTexts().about
    expect(about).toContain(`${profile.location}, us permanent resident, available now, hybrid or remote, across time zones.\n`)
    for (const value of [profile.citizenship, profile.travel, profile.employers, profile.relocation]) expect(about).not.toContain(value)
  })

  it('lowers the first letter of a phrase inside a sentence, but not an acronym', () => {
    expect(lowerFirst('Hybrid or remote, across time zones')).toBe('hybrid or remote, across time zones')
    expect(lowerFirst('US-based, remote')).toBe('US-based, remote')
    expect(lowerFirst('')).toBe('')
  })

  it('has nothing to say when LinkedIn already matches', () => {
    const parsed = parseLinkedInCsv({
      profile: `First Name,Last Name,Headline,Summary,Geo Location\nSteven,Wilssens,"${profile.resumeHeadline} | Seattle","${profile.summary.replace(/"/g, '""')}","Seattle, Washington, United States"\n`,
      positions: `Company Name,Title,Description,Location,Started On,Finished On\n${experiences.map((item) => `${item.company},"${item.role}","${[item.summary, ...item.points].join(' ').replace(/"/g, '""')}","${item.location}",${item.dates.split(' - ')[0]},${item.dates.split(' - ')[1]}`).join('\n')}\n`,
      skills: 'Name\nProduct strategy\nData platforms\nExperimentation\nMachine learning\nMetrics\nLeading PM teams\nStakeholder communication\nGo-to-market\nSoftware engineering\n',
      education: 'School Name,Start Date,End Date,Notes,Degree Name,Activities\nKarel de Grote,2000,2004,,"Bachelor\'s degree, Computer Science",\n',
    }, now)
    const { fixes } = compareLinkedIn(parsed, now)
    expect(fixes.map((fix) => fix.area)).toEqual([])
  })
})

describe('the recruiter review', () => {
  const pages = { home: '# Steven Wilssens\n\nPrincipal product leader for data and AI. Now building in AI while choosing my next leadership role. Hiring a product leader for data, experimentation or AI?', about: '# About', experience: '# Experience', work: '# Selected work', recommendations: '# Recommendations' }

  it('flags the missing resume report and the missing LinkedIn import, and asks what the roles leave open', () => {
    const review = reviewForRecruiters({ pages, resumeReport: null, linkedin: null, now })
    const areas = review.findings.map((f) => f.area)
    expect(areas.filter((area) => area.startsWith('impact:'))).toEqual([])
    expect(areas).toContain('resume')
    expect(areas).toContain('linkedin')
    expect(areas).not.toContain('scope:windows-devices-data')
    // "five PMs, working with about 20 developers" and "Led six PMs" are team sizes, in words.
    expect(areas).not.toContain('scope:csx-data')
    expect(areas).not.toContain('scope:spatial-audio-lead')
    expect(areas).toContain('scope:azure-devops')
    // Cosmos starts the month after Info Support ends, so the real data leaves no overlap to ask
    // about; Azure DevOps states no team size at all.
    expect(review.questions.some((q) => /overlaps/.test(q.question) || q.about === 'cosmos')).toBe(false)
    expect(review.questions.some((q) => q.about === 'azure-devops' && /How many product managers/.test(q.question))).toBe(true)
    expect(review.score).toBeLessThan(100)
    expect(review.headline).toMatch(/recruiter's seat/)
    for (const finding of review.findings) { expect(finding.why.length).toBeGreaterThan(20); expect(finding.fix.length).toBeGreaterThan(10) }
  })

  it('reports a deployment whose pages are missing and a resume that drifted from the site', () => {
    const review = reviewForRecruiters({ pages: { ...pages, work: null }, resumeReport: { exists: true, score: 40, errors: 2, warnings: 1, matchesSite: false, findings: [{ severity: 'error', id: 'role-csx-data', message: 'Role title missing: Principal Product Manager Lead - CSX Data.' }], questions: [{ about: 'impact', question: 'Which role?' }] }, linkedin: { fixes: [{ area: 'headline', linkedinSays: 'Product Leader', siteSays: profile.resumeHeadline, why: 'Searches match on it.', paste: 'x' }], summary: '1 thing' }, now })
    const areas = review.findings.map((f) => f.area)
    expect(areas).toContain('page:work')
    expect(areas).toContain('resume')
    expect(areas).toContain('resume:role-csx-data')
    expect(areas).toContain('linkedin:headline')
    expect(review.findings[0].severity).toBe('high')
  })
})
