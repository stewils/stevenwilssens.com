// @vitest-environment node
// The resume PDF is generated from src/resume.ts (npm run resume:build). This test
// fails when the two drift, so a content change never ships without a new resume.
import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import { analyzeResume, atsScore, compareScores, dataQuestions, extractPdf, formatComparison, lenses, readBaseline, resumePath } from '../scripts/resume-check.mjs'
import { about, experiences, profile, selectedWork } from './resume'

const pointsOf = (key: string) => experiences.find((item) => item.key === key)!.points
// The PDF's text the way resume-check reads it: one line, straight quotes and hyphens, lower case.
const normalize = (text: string) => text.replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
const pdfText = async () => normalize((await extractPdf(resumePath)).text)

describe('the resume PDF', () => {
  it('matches src/resume.ts and passes the resume checks', async () => {
    const report = await analyzeResume()
    const errors = report.findings.filter((finding: { severity: string }) => finding.severity === 'error').map((finding: { message: string }) => finding.message)
    expect(errors, 'run npm run resume:build after changing src/resume.ts').toEqual([])
    expect(report.pages).toBeLessThanOrEqual(2)
    expect(report.score).toBeGreaterThanOrEqual(70)
    expect(report.findings.every((finding: { lens: string }) => finding.lens in lenses)).toBe(true)
    expect(report.ats.errors).toBe(0)
  }, 30_000)

  // The PDF prints only the first bullet of the older roles at its current layout; a fall
  // back to none would drop Perfect Day, spatial audio and Azure DevOps without failing a check.
  it('keeps the first bullet of every older Microsoft role', async () => {
    const text = await pdfText()
    for (const item of experiences.slice(2).filter((role) => role.company === 'Microsoft')) expect(text, item.role).toContain(normalize(item.points[0]).slice(0, 60))
  }, 30_000)

  it('prints the full new Group PM bullet and Perfect Day first under the Lead role', async () => {
    const text = await pdfText()
    expect(text).toContain(normalize(pointsOf('windows-devices-data')[0]))
    const heading = text.indexOf('principal product manager lead - windows data')
    const next = text.indexOf('principal product manager lead - azure devops')
    const perfectDay = text.indexOf(normalize(pointsOf('csx-data')[0]).slice(0, 60), heading)
    expect(heading).toBeGreaterThan(-1)
    expect(perfectDay).toBeGreaterThan(heading)
    expect(perfectDay).toBeLessThan(next)
  }, 30_000)

  // The score is what an applicant tracking system makes of the PDF: what a recruiter
  // would say and where the PDF differs from the site are listed but do not count.
  it('scores only the findings an applicant tracking system trips over', () => {
    expect(atsScore([])).toBe(100)
    expect(atsScore([{ severity: 'warn', lens: 'recruiter' }, { severity: 'error', lens: 'site' }, { severity: 'info', lens: 'ats' }])).toBe(100)
    expect(atsScore([{ severity: 'error', lens: 'ats' }, { severity: 'warn', lens: 'ats' }, { severity: 'warn', lens: 'ats' }])).toBe(65)
    expect(atsScore(Array.from({ length: 6 }, () => ({ severity: 'error', lens: 'ats' })))).toBe(0)
  })

  // Cosmos starts in Jan 2005, the month after Info Support ends: the overlap question is gone.
  it('raises no question about the dates or the numbers once Cosmos follows Info Support', () => {
    const questions = dataQuestions(new Date('2026-10-17'))
    expect(questions.some((q: { about: string }) => q.about === 'cosmos')).toBe(false)
    expect(questions.some((q: { question: string }) => /overlaps with/.test(q.question))).toBe(false)
    // Every key number has a role behind it, so none is asked about.
    expect(questions.some((q: { about: string }) => q.about === 'impact')).toBe(false)
  })

  // The workflows compare a new resume with the one on main or on the live site and
  // warn when the score would drop; the comparison itself is pure.
  it('says when a change would lower the score recruiters see today', async () => {
    const baseline = { source: 'https://steven.wilssens.com/resume-report.json', score: 90, errors: 0, warnings: 2, checkedAt: null }
    const lower = compareScores({ score: 85 }, baseline)
    expect(lower).toMatchObject({ change: -5, lower: true, verdict: 'lower' })
    expect(formatComparison({ score: 85, baseline: lower })).toMatch(/90 → 85: LOWER than the live site/)
    expect(compareScores({ score: 90 }, baseline)).toMatchObject({ change: 0, lower: false, verdict: 'unchanged' })
    expect(formatComparison({ score: 95, baseline: compareScores({ score: 95 }, baseline) })).toMatch(/higher than the live site/)
    expect(compareScores({ score: 95 }, null)).toBeNull()
    expect(formatComparison({ score: 95, baseline: null })).toMatch(/no baseline/)
    // An unreadable baseline is not an error: the build must not fail on it.
    expect(await readBaseline('/nowhere/resume-report.json')).toBeNull()
    expect(await readBaseline(null)).toBeNull()
  })
})

// Steven's approved wording for the two Windows Data roles, word for word and in order:
// Perfect Day stays first in csx-data, because the PDF prints only an older role's first bullet.
describe('the Windows Data roles', () => {
  it('csx-data keeps Perfect Day first and adds the team growth second', () => {
    expect(pointsOf('csx-data')).toEqual([
      'Redefined Windows quality measurement around end-to-end scenarios like gaming and the shell, creating the Perfect Day metric for issue-free user days.',
      'Grew the team from one to five PMs, working with about 20 developers, leading to promotion to Principal Group Product Manager.',
      'Drove measurable quality gains, with Perfect Day improving about 5% for gaming and 3–4% for the Windows shell.',
      'Provided the data behind Windows release decisions: whether a build was ready to move from internal audiences to Insider preview, which issues had to be fixed, and ultimately whether a release met the quality bar to ship.',
      'Built the alerting dashboards Windows teams used to catch customer-impacting issues, and ran the weekly Release Quality Review where area directors acted on them.',
    ])
  })

  it('windows-devices-data says about 20, then about 12, with a curly apostrophe', () => {
    const points = pointsOf('windows-devices-data')
    expect(points).toEqual([
      'Led a PM organization of about 20, working with more than 100 developers and data scientists, initially through three people managers, then led its move to a flatter team of about 12 during Microsoft’s cost reductions; roughly half the team was promoted under my leadership.',
      'Owned strategy and roadmap for the data platform and insights products Windows engineers and PMs use to ship higher-quality releases.',
      'Built the quality measurement framework that underpinned Windows K2, Microsoft’s high-profile push to improve Windows reliability and performance.',
      'Ran the weekly ship-readiness quality review where Windows VPs made release decisions based on my team’s data on ship-blocking issues.',
      'Scaled experimentation across Windows to hundreds of concurrent experiments, significantly reducing the number of features pulled back after release.',
      'Owned the multi-million-dollar Windows data infrastructure budget; shut down a low-adoption on-device model platform and reinvested in platform modernization, cutting costs 30% over two years.',
      'Shifted the team to AI-driven analytics and launched the first version, letting people ask business questions in natural language across every source in the data platform instead of relying on fixed queries.',
      'Partnered with engineering, data science, and research leadership across telemetry from more than 1.6 billion Windows devices.',
    ])
    expect(points[0]).toContain('Microsoft’s')
  })

  it('no longer says "five direct reports", in the data or the PDF', async () => {
    expect(JSON.stringify(experiences)).not.toContain('five direct reports')
    expect(await pdfText()).not.toContain('five direct reports')
  }, 30_000)

  // The assistant's prompt is checked in functions/_lib/ask/agent.test.ts.
  it('the old experimentation bullet is gone from the data and the PDF', async () => {
    expect(JSON.stringify(experiences).toLowerCase()).not.toContain('scaled experimentation adoption')
    expect(await pdfText()).not.toContain('scaled experimentation adoption')
  }, 30_000)
})

// Steven's approved wording of 2026-10-23, typed here as literals: comparing a surface with
// profile proves the wiring, only these prove the words.
const arrangement = 'Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating.'
const cosmosSummary = 'Built and supported software components across C# client and Java server systems using CORBA middleware. Joined as a consultant from Info Support, then hired full-time.'
const experimentationBullet = 'Scaled experimentation across Windows to hundreds of concurrent experiments, significantly reducing the number of features pulled back after release.'

describe('the work arrangement', () => {
  it('profile.workArrangement is Steven’s approved sentence, and location stays Seattle, Washington', () => {
    expect(profile.workArrangement).toBe(arrangement)
    expect(profile.location).toBe('Seattle, Washington')
  })

  it('prints the work arrangement as its own facts row, the Cosmos story and the new experimentation bullet', async () => {
    const report = await analyzeResume()
    expect(report.pages).toBe(2)
    const text = await pdfText()
    expect(text).toContain(normalize(`Work arrangement ${arrangement}`))
    expect(text).not.toContain('relocating..')
    // The header's contact block is unchanged: Seattle alone and first, then the authorization.
    const contact = text.indexOf('seattle, washington · us permanent resident (green card)')
    expect(contact).toBeGreaterThan(-1)
    expect(contact).toBeLessThan(text.indexOf('work arrangement'))
    expect(text).toContain(normalize(cosmosSummary))
    expect(text).toContain(normalize(experimentationBullet))
  }, 30_000)

  it('keeps the work arrangement out of the component', () => {
    expect(appSource).not.toContain('open to remote or hybrid')
  })
})

// Steven's team sizes and his Azure DevOps choice of 2026-10-23, word for word and in order.
describe('the team sizes and the Azure DevOps choice', () => {
  it('spatial-audio-lead leads with the team size', () => {
    expect(pointsOf('spatial-audio-lead')).toEqual([
      'Led six PMs, working with about 20 developers.',
      'Led the Microsoft Spatial Audio Platform across Windows, Xbox One, and new platforms.',
      'Grew monthly active devices playing spatial audio by more than 250% over 1.5 years.',
      'Worked with developers and data insights to identify and deliver essential spatial audio features.',
      'Partnered with game studios to ship spatial audio in major franchises, including Halo, Forza Horizon, Gears of War and Call of Duty.',
      'Shaped Xbox xCloud game streaming strategy, prioritizing low latency over 4K resolution and making it the platform\'s key differentiator.',
    ])
  })

  it('azure-devops says why Steven stayed at Microsoft', () => {
    expect(pointsOf('azure-devops')).toEqual([
      'Authored a DataOps product proposal compelling enough that the team building it was moved to GitHub, as the better home for the product.',
      'Chose to stay at Microsoft rather than move to GitHub to lead the team building it.',
    ])
  })

  it('prints on two pages the Group PM bullet in full, the team size under Silicon, Graphics, Media and the Cosmos year', async () => {
    const report = await analyzeResume()
    expect(report.pages).toBe(2)
    const text = await pdfText()
    expect(text).toContain(normalize('Led a PM organization of about 20, working with more than 100 developers and data scientists, initially through three people managers, then led its move to a flatter team of about 12 during Microsoft’s cost reductions; roughly half the team was promoted under my leadership.'))
    const heading = text.indexOf('principal product manager lead - silicon, graphics, media')
    const teamSize = text.indexOf(normalize('Led six PMs, working with about 20 developers.'), heading)
    expect(heading).toBeGreaterThan(-1)
    expect(teamSize).toBeGreaterThan(heading)
    expect(teamSize).toBeLessThan(text.indexOf('principal product manager - silicon, graphics, media'))
    expect(text).toContain('jan 2005 - dec 2005')
    expect(text).not.toContain('jan 2004 - dec 2005')
  }, 30_000)
})

describe('the early career', () => {
  it('cosmos follows Info Support without overlap and keeps its title, company, location, summary and points', () => {
    expect(experiences.find((item) => item.key === 'info-support')!.dates).toBe('Jan 2001 - Dec 2004')
    expect(experiences.find((item) => item.key === 'cosmos')).toEqual({
      key: 'cosmos',
      role: 'Software Developer',
      company: 'Cosmos',
      dates: 'Jan 2005 - Dec 2005',
      location: 'Antwerp Area, Belgium',
      summary: cosmosSummary,
      points: ['Provided technical guidance, application redesigns, developer support, and code reviews.', 'Worked on the Technical Components team responsible for construction, maintenance, and support.'],
    })
  })
})

describe('the selected work', () => {
  const work = (key: string) => selectedWork.find((item) => item.key === key)!

  it('windows-quality ends on the measured outcome and has no source', () => {
    const item = work('windows-quality')
    expect(item).toEqual({
      key: 'windows-quality',
      title: 'Windows quality, measured from preview channels to retail',
      period: '2020 - 2026',
      role: 'csx-data',
      context: 'Windows ships to more than 1.6 billion devices. Engineers needed to know whether a release was healthy before it reached customers, and to find the issues that mattered once it had.',
      work: 'Led the PM team that built the data products and the review rhythms measuring Windows quality across the Insider preview channels and at retail scale, weaving customer signals and machine learning into insights engineers act on.',
      outcome: 'Adopted by every Windows team, and behind the roughly 30% drop in issue days across Perfect Day scenarios.',
    })
    expect('source' in item).toBe(false)
  })

  it('okr-tool adds the Viva Goals sentence after one space, with a curly apostrophe, and keeps its outcome and Amit Gupte as source', () => {
    const item = work('okr-tool')
    expect(item.work).toBe('With a member of my team, ideated and stood up a working replacement from scratch using AI coding tools, rather than waiting for a procurement cycle. Built in six months to replace Viva Goals, Microsoft’s acquired OKR product, after it was retired.')
    expect(item.work).toContain('Microsoft’s')
    expect(item.outcome).toBe('The gap was closed with a functional replacement, and the project became the team’s working example of a modern AI development lifecycle.')
    expect(item.source).toBe('Amit Gupte')
  })

  it('keeps the AI feature forecast credited to Amit Gupte', () => {
    expect(work('ai-feature-forecast')).toMatchObject({ outcome: 'The forecast held. Amit Gupte calls it the clearest demonstration of “an intuitive understanding of customer behavior second to none.”', source: 'Amit Gupte' })
  })

  it('raises no résumé question about the numbers in the selected work', () => {
    const questions = dataQuestions(new Date('2026-10-23'))
    expect(questions.some((q: { question: string }) => /30%|six months/.test(q.question))).toBe(false)
  })
})

// The guards and the designer's limits run on this copy in functions/_lib/mcp/about.test.ts.
describe('the About copy', () => {
  it('exports the About copy as data: one sentence under the title and 2 to 4 paragraphs, none empty', () => {
    expect(about.intro.trim()).not.toBe('')
    expect(about.intro.match(/[.!?](?=\s|$)/g)).toHaveLength(1)
    expect(about.paragraphs.length).toBeGreaterThanOrEqual(2)
    expect(about.paragraphs.length).toBeLessThanOrEqual(4)
    expect(about.paragraphs.every((paragraph) => paragraph.trim().length > 0)).toBe(true)
  })

  it('keeps the About copy out of the component', () => {
    const plain = (text: string) => text.replace(/&amp;/g, '&').replace(/\s+/g, ' ')
    const component = plain(appSource)
    for (const text of [about.intro, ...about.paragraphs]) expect(component).not.toContain(plain(text))
    expect(component).not.toContain('dangerouslySetInnerHTML')
  })
})
