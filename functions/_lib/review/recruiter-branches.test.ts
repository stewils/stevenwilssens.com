// The recruiter review on made-up résumé data, so every rule fires that Steven's own
// data (rightly) no longer trips: missing scope, unbacked numbers, gaps, overlaps,
// present tense after a role ended, missing logistics, too few recent cases.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry, Impact, Work } from '../../../src/resume'

const data = vi.hoisted(() => ({
  experiences: [] as Entry[],
  impact: [] as Impact[],
  selectedWork: [] as Work[],
  profile: {} as Record<string, string>,
}))
vi.mock('../../../src/resume', () => data)

const { reviewForRecruiters } = await import('./recruiter')

const role = (overrides: Partial<Entry>): Entry => ({ key: 'k', role: 'Engineer', company: 'Contoso', dates: 'Jan 2000 - Dec 2000', location: 'Seattle', summary: 'Summary.', points: [], ...overrides })
const work = (overrides: Partial<Work>): Work => ({ key: 'w', title: 'Case', period: '2021', role: 'k', context: '', work: '', outcome: 'Shipped it.', ...overrides })
const now = Date.UTC(2026, 9, 19)
const pages = { home: '', about: '', experience: '', work: '', recommendations: '' }

beforeEach(() => {
  data.experiences.splice(0, Infinity,
    role({ key: 'latest', role: 'Group Product Manager Lead', dates: 'Jan 2020 - Mar 2024', summary: 'Lead the data team.', points: ['Own the roadmap.'] }),
    role({ key: 'middle', role: 'Team Lead', dates: 'Jan 2010 - Jun 2019', summary: 'Led a team of 12 engineers.', points: ['Grew usage 3x.'] }),
    role({ key: 'early', role: 'Developer', dates: 'Jan 2008 - Mar 2010' }),
    role({ key: 'odd', role: 'Intern', dates: 'Summer 2007' }),
  )
  data.impact.splice(0, Infinity, { value: '40%', label: 'faster decisions' }, { value: '1.6B', label: 'devices', backing: 'latest' })
  data.selectedWork.splice(0, Infinity, work({ title: 'Recent case', period: '2022 to 2023', outcome: 'Teams adopted it.' }), work({ title: 'Old case', period: '2012' }))
  for (const key of Object.keys(data.profile)) delete data.profile[key]
  Object.assign(data.profile, { location: '', workAuthorization: 'US citizen', availability: 'Now', lookingFor: 'A product leadership role' })
})

describe('the recruiter review on thin data', () => {
  it('flags missing scope, unbacked numbers, outcomes without numbers and missing logistics', () => {
    const review = reviewForRecruiters({ pages, resumeReport: null, linkedin: null, now })
    const areas = review.findings.map((finding) => finding.area)
    expect(review.findings.find((finding) => finding.area === 'scope:latest')?.severity).toBe('high')
    expect(areas).not.toContain('scope:middle')
    expect(areas).toContain('impact:40%')
    expect(areas).not.toContain('impact:1.6B')
    expect(areas).toContain('outcomes:latest')
    expect(areas).not.toContain('outcomes:middle')
    expect(areas).toContain('logistics:location')
    expect(areas).not.toContain('logistics:workAuthorization')
    expect(review.findings.find((finding) => finding.area === 'logistics:workArrangement')?.severity).toBe('high')
    expect(review.questions.some((question) => question.question.startsWith('Remote, hybrid or on-site'))).toBe(true)
  })

  it('asks about logistics only when they are not stated (D-17, D-21)', () => {
    const logistics = (about = '') => reviewForRecruiters({ pages: { ...pages, about }, resumeReport: null, linkedin: null, now }).questions.filter((question) => /relocat|remote|hybrid|on-site/i.test(question.question))
    expect(logistics().map((question) => question.question)).toEqual(['Remote, hybrid or on-site, and would you relocate? The site says Seattle but not how flexible that is.'])
    // How he works is stated, whether he would move is not: one question, about relocation only.
    data.profile.workArrangement = 'Hybrid or remote, across time zones'
    const only = logistics()
    expect(only).toHaveLength(1)
    expect(only[0].question).toBe('Would you relocate? The site says where you are based and how you work, but not whether you would move.')
    expect(only[0].question).toMatch(/relocat/i)
    for (const word of [/remote/i, /hybrid/i, /on-site/i]) expect(only[0].question).not.toMatch(word)
    expect(logistics('I am not relocating.')).toEqual([])
    data.profile.relocation = 'Not relocating'
    expect(logistics()).toEqual([])
    expect(reviewForRecruiters({ pages, resumeReport: null, linkedin: null, now }).findings.map((finding) => finding.area)).not.toContain('logistics:workArrangement')
    // An on-site arrangement answers the same half of the question.
    data.profile.workArrangement = 'On-site in Seattle'
    data.profile.relocation = ''
    expect(logistics().map((question) => question.question)).toEqual([only[0].question])
  })

  it('a second leadership role without scope is a medium finding', () => {
    data.experiences[1] = role({ key: 'middle', role: 'Team Lead', dates: 'Jan 2010 - Jun 2019', summary: 'Led the team.', points: ['Shipped 3 releases.'] })
    const review = reviewForRecruiters({ pages, resumeReport: null, linkedin: null, now })
    expect(review.findings.find((finding) => finding.area === 'scope:middle')?.severity).toBe('medium')
  })

  it('asks about gaps and overlaps, and flags the time since the last role and present tense', () => {
    const review = reviewForRecruiters({ pages, resumeReport: null, linkedin: null, now })
    expect(review.questions.find((question) => question.about === 'latest' && question.question.includes('months in between'))?.question).toContain('ended Jun 2019; Group Product Manager Lead started Jan 2020. What were the 6 months in between?')
    expect(review.questions.find((question) => question.about === 'middle')?.question).toContain('overlaps Developer at Contoso')
    expect(review.findings.find((finding) => finding.area === 'now')?.finding).toContain('ended Mar 2024, 31 months ago')
    expect(review.findings.filter((finding) => finding.area === 'tense:latest')).toHaveLength(2)
  })

  it('names one recent case in the singular, and asks for the number behind it', () => {
    const review = reviewForRecruiters({ pages, resumeReport: null, linkedin: null, now })
    expect(review.findings.find((finding) => finding.area === 'proof')?.finding).toContain('Only 1 selected work case is from 2020')
    expect(review.questions.some((question) => question.question.startsWith('"Recent case": is there a number'))).toBe(true)
    data.selectedWork.splice(0, Infinity)
    expect(reviewForRecruiters({ pages, resumeReport: null, linkedin: null, now }).findings.find((finding) => finding.area === 'proof')?.finding).toContain('Only 0 selected work cases are')
  })

  it('notices a home page that repeats the job search and mixes in a consulting pitch', () => {
    const home = 'Choosing my next role. Open to work. Looking for my next role. #OpenToWork. Bring me your hard product problem; my next leadership role awaits.'
    const areas = reviewForRecruiters({ pages: { ...pages, home }, resumeReport: null, linkedin: null, now }).findings.filter((finding) => finding.area === 'message')
    expect(areas.map((finding) => finding.severity).sort()).toEqual(['low', 'medium'])
  })

  it('takes a matching résumé report as is, without repeating a question it already asks, and LinkedIn fixes of every weight', () => {
    const long = 'x'.repeat(400)
    const review = reviewForRecruiters({
      pages,
      resumeReport: { score: 95, matchesSite: true, findings: [{ severity: 'warn', id: 'tense', message: 'Tense' }, { severity: 'info', id: 'note', message: 'FYI' }], questions: [{ about: 'general', question: 'Remote, hybrid or on-site, and would you relocate? The site says Seattle but not how flexible that is.' }] },
      linkedin: { fixes: [{ area: 'skills', linkedinSays: 'a', siteSays: 'b', why: 'w', paste: long }, { area: 'position:x', linkedinSays: 'a', siteSays: 'b', why: 'w', paste: '' }], summary: '' },
      now,
    })
    expect(review.findings.find((finding) => finding.area === 'resume:tense')?.severity).toBe('low')
    expect(review.findings.map((finding) => finding.area)).not.toContain('resume')
    expect(review.questions.filter((question) => question.question.startsWith('Remote'))).toHaveLength(1)
    const skills = review.findings.find((finding) => finding.area === 'linkedin:skills')!
    expect(skills.severity).toBe('low')
    expect(skills.fix.endsWith('…')).toBe(true)
    expect(review.findings.find((finding) => finding.area === 'linkedin:position:x')).toMatchObject({ severity: 'medium', fix: 'Resolve the difference on LinkedIn or in src/resume.ts.' })
  })

  it('reports a drifted résumé without an error count, and never scores below zero', () => {
    for (let i = 0; i < 10; i++) data.impact.push({ value: `${i}`, label: 'unbacked' })
    const review = reviewForRecruiters({ pages, resumeReport: { score: 10, matchesSite: false, findings: [], questions: [] }, linkedin: null, now })
    expect(review.findings.find((finding) => finding.area === 'resume')?.finding).toContain('(? errors, score 10)')
    expect(review.score).toBe(0)
  })

  it('has nothing to say about a clean record', () => {
    data.experiences.splice(0, Infinity, role({ key: 'only', role: 'Principal Engineer', dates: 'Jan 2026 - Oct 2026', summary: 'Built 3 things.' }))
    data.impact.splice(0, Infinity)
    data.selectedWork.splice(0, Infinity, ...['2021', '2022', '2023'].map((period) => work({ period, outcome: 'Saved 5 hours.' })))
    Object.assign(data.profile, { location: 'Seattle', lookingFor: 'Remote product leadership', workArrangement: 'Hybrid or remote, across time zones', relocation: 'Not relocating' })
    const review = reviewForRecruiters({ pages, resumeReport: { score: 100, matchesSite: true, findings: [], questions: [{ about: 'x', question: 'One?' }] }, linkedin: { fixes: [], summary: '' }, now })
    expect(review).toMatchObject({ score: 100, findings: [], headline: 'Nothing a recruiter would trip over; the open questions below are the next improvements.' })
    expect(review.questions).toHaveLength(1)
    data.selectedWork.splice(0, 1)
    expect(reviewForRecruiters({ pages, resumeReport: { score: 100, matchesSite: true, findings: [], questions: [{ about: 'x', question: 'One?' }] }, linkedin: { fixes: [], summary: '' }, now }).headline).toMatch(/1 question only Steven/)
  })
})
