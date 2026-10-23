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
    expect(report.pages).toBe(2)
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

  // Header line 2, under the location an ATS parses; the facts for a close read stay off the PDF.
  it('prints the work arrangement in the PDF, "hybrid" and "remote" as words', async () => {
    const { text: raw } = await extractPdf(resumePath)
    const text = normalize(raw)
    expect(text).toContain(normalize(profile.workArrangement))
    for (const value of [profile.citizenship, profile.travel, profile.employers, profile.relocation]) expect(text).not.toContain(normalize(value))
    expect(raw).toMatch(/\bhybrid\b/i)
    expect(raw).toMatch(/\bremote\b/i)
    const lines = raw.split('\n').map(normalize)
    const at = lines.findIndex((line) => line.includes('seattle, washington'))
    expect(lines[at]).not.toMatch(/hybrid|remote/)
    expect(lines[at + 1]).toBe(normalize(profile.workArrangement))
    expect((await analyzeResume()).findings.filter((finding: { id: string }) => finding.id.startsWith('contact-'))).toEqual([])
  }, 30_000)

  // The score is what an applicant tracking system makes of the PDF: what a recruiter
  // would say and where the PDF differs from the site are listed but do not count.
  it('scores only the findings an applicant tracking system trips over', () => {
    expect(atsScore([])).toBe(100)
    expect(atsScore([{ severity: 'warn', lens: 'recruiter' }, { severity: 'error', lens: 'site' }, { severity: 'info', lens: 'ats' }])).toBe(100)
    expect(atsScore([{ severity: 'error', lens: 'ats' }, { severity: 'warn', lens: 'ats' }, { severity: 'warn', lens: 'ats' }])).toBe(65)
    expect(atsScore(Array.from({ length: 6 }, () => ({ severity: 'error', lens: 'ats' })))).toBe(0)
  })

  it('raises the questions the dates and numbers leave open', () => {
    const questions = dataQuestions(new Date('2026-10-17'))
    expect(questions.some((q: { question: string }) => /Compuware.*Microsoft|months in between|overlaps with/.test(q.question))).toBe(true)
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
      'Grew the team from one to five direct reports, leading to promotion to Principal Group Product Manager.',
      'Drove measurable quality gains, with Perfect Day improving about 5% for gaming and 3–4% for the Windows shell.',
      'Provided the data behind Windows release decisions: whether a build was ready to move from internal audiences to Insider preview, which issues had to be fixed, and ultimately whether a release met the quality bar to ship.',
      'Built the alerting dashboards Windows teams used to catch customer-impacting issues, and ran the weekly Release Quality Review where area directors acted on them.',
    ])
  })

  it('windows-devices-data says about 20, then about 12, with a curly apostrophe', () => {
    const points = pointsOf('windows-devices-data')
    expect(points).toEqual([
      'Led a PM organization of about 20, initially through three people managers, then led its move to a flatter team of about 12 during Microsoft’s cost reductions; roughly half the team was promoted under my leadership.',
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

  // The assistant's prompt is checked in functions/_lib/ask/agent.test.ts.
  it('the old experimentation bullet is gone from the data and the PDF', async () => {
    expect(JSON.stringify(experiences).toLowerCase()).not.toContain('scaled experimentation adoption')
    expect(await pdfText()).not.toContain('scaled experimentation adoption')
  }, 30_000)
})

// Steven's approved wording, typed here as literals: comparing a surface with profile
// proves the wiring, only these prove the words.
const cosmosSummary = 'Built and supported software components across C# client and Java server systems using CORBA middleware. Joined as a consultant from Info Support, then hired full-time.'
const experimentationBullet = 'Scaled experimentation across Windows to hundreds of concurrent experiments, significantly reducing the number of features pulled back after release.'

// Travel is its own fact since PR #80 merged beside this branch (D-23): Steven's words, no frequency.
describe('the travel fact', () => {
  it('profile.travel is Steven’s wording, with no frequency or percentage, and the #80 sentence is gone', () => {
    expect(profile.travel).toBe('Open to coordinated travel')
    expect(profile.travel).not.toMatch(/\d|%|weekly|monthly|quarterly|\bdays?\b/i)
    expect(profile.workArrangement).toBe('Hybrid or remote, across time zones')
    expect(profile.location).toBe('Seattle, Washington')
    expect(JSON.stringify(profile)).not.toContain('Seattle-based')
  })

  it('keeps travel off the PDF, and prints the Cosmos story and the new experimentation bullet', async () => {
    const report = await analyzeResume()
    expect(report.pages).toBe(2)
    const text = await pdfText()
    expect(text).not.toContain(normalize(profile.travel))
    expect(text).not.toContain('coordinated travel')
    expect(text).toContain(normalize(cosmosSummary))
    expect(text).toContain(normalize(experimentationBullet))
  }, 30_000)

  it('keeps the travel value out of the component', () => {
    expect(appSource).not.toContain('coordinated travel')
    expect(appSource).toContain('{profile.travel}')
  })
})

describe('the early career', () => {
  it('cosmos explains the Info Support overlap and keeps its dates, title, company, location and points', () => {
    expect(experiences.find((item) => item.key === 'cosmos')).toEqual({
      key: 'cosmos',
      role: 'Software Developer',
      company: 'Cosmos',
      dates: 'Jan 2004 - Dec 2005',
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

// Steven's words of 2026-10-22, each its own field: how he works next to when, citizenship
// next to authorization. Every surface reads them from here, so no other source types them.
describe('the hiring logistics', () => {
  it('states the logistics in Steven\'s words, each in its own field', () => {
    expect(profile.location).toBe('Seattle, Washington')
    expect(experiences.find((item) => item.key === 'independent-ai-builder')!.location).toBe(profile.location)
    expect(profile.workAuthorization).toBe('US permanent resident (green card)')
    expect(profile.citizenship).toBe('Belgian citizen (EU)')
    expect(profile.availability).toBe('Available now')
    expect(profile.workArrangement).toBe('Hybrid or remote, across time zones')
    expect(profile.workArrangement).toHaveLength(35)
    expect(profile.employers).toBe('Open to remote roles with employers outside the US, in their working hours')
    expect(profile.relocation).toBe('Not relocating')
    const keys = Object.keys(profile)
    expect(keys.slice(keys.indexOf('workAuthorization'), keys.indexOf('relocation') + 1)).toEqual(['workAuthorization', 'citizenship', 'availability', 'workArrangement', 'employers', 'relocation'])
  })
  // That the four values are typed only here is checked in scripts/resume-facts.test.mjs, which reads the tree at run time.
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
