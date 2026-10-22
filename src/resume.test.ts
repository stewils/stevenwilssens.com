// @vitest-environment node
// The resume PDF is generated from src/resume.ts (npm run resume:build). This test
// fails when the two drift, so a content change never ships without a new resume.
import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import { analyzeResume, atsScore, compareScores, dataQuestions, extractPdf, formatComparison, lenses, readBaseline, resumePath } from '../scripts/resume-check.mjs'
import resumeSource from './resume.ts?raw'
import { about, experiences, honors, profile, recommendations } from './resume'

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

  // A summary that drifts from src/resume.ts is only a warning in the checker, so it is pinned here in full.
  it('carries the new summary and every bullet of the two latest roles, with no site or tense findings', async () => {
    const report = await analyzeResume()
    expect(report.findings.filter((finding: { lens: string }) => finding.lens === 'site')).toEqual([])
    expect(report.findings.filter((finding: { id: string }) => finding.id.startsWith('tense-'))).toEqual([])
    // A word hyphenated at a line end ("co-" | "inventor") reads back as "co- inventor".
    const text = (await pdfText()).replace(/(\w)- (?=\w)/g, '$1-')
    expect(text).toContain(normalize(profile.summary))
    for (const point of experiences.slice(0, 2).flatMap((item) => item.points)) expect(text).toContain(normalize(point))
  }, 30_000)

  it('prints the HiPo honor once without empty parentheses, and the dated honors with their year', async () => {
    const text = await pdfText()
    expect(text.split("selected for microsoft's high potential (hipo) program")).toHaveLength(2)
    expect(text).not.toContain('(issued by microsoft)')
    expect(text).not.toMatch(/\(\s*\)/)
    expect(text).toMatch(/lighthouse award for teamwork\s*\(2012\)/)
    expect(text).toContain('compass award for individual excellence (2011)')
    expect(text).toContain('gold star award (2011)')
    expect(text).toContain('microsoft mvp: vs team system (2006)')
  }, 30_000)

  // The honors line in every layout of the template, and one honor's formatting, are tested in scripts/resume.test.mjs.

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
      'Measured quality across more than 1.6 billion highly diverse Windows devices, data that governed every Windows release from 2020 to 2026.',
    ])
  })

  it('windows-devices-data says about 20, then about 12, with a curly apostrophe', () => {
    const points = pointsOf('windows-devices-data')
    expect(points).toEqual([
      'Led a PM organization of about 20, initially through three people managers, then led its move to a flatter team of about 12 during Microsoft’s cost reductions; roughly half the team was promoted under my leadership.',
      'Owned strategy and roadmap for the data platform and insights products Windows engineers and PMs use to ship higher-quality releases.',
      'Built the quality measurement framework that underpinned Windows K2, Microsoft’s high-profile push to improve Windows reliability and performance.',
      'Ran the weekly ship-readiness quality review where Windows VPs made release decisions based on my team’s data on ship-blocking issues.',
      'Scaled experimentation adoption across Windows, significantly reducing the number of features pulled back after release.',
      'Owned the multi-million-dollar Windows data infrastructure budget; shut down a low-adoption on-device model platform and reinvested in platform modernization, cutting costs 30% over two years.',
      'Shifted the team to AI-driven analytics and launched the first version, letting people ask business questions in natural language across every source in the data platform instead of relying on fixed queries.',
      'Partnered with engineering, data science, and research leadership across telemetry from more than 1.6 billion Windows devices.',
    ])
    expect(points[0]).toContain('Microsoft’s')
  })
})

// Casting stays first, because the PDF prints only an older role's first bullet.
describe('the spatial audio roles', () => {
  it('spatial-audio-senior keeps casting first and adds the 2015 audio ask last', () => {
    expect(pointsOf('spatial-audio-senior')).toEqual([
      'Brought casting to Windows and Windows Phone, shipping Miracast, DLNA and Play To so people could send media from a PC or phone to a TV.',
      'Enabled HD conferencing on Surface RT and drove Media Foundation and Windows SDK work for media developers.',
      'Brought spatial sound to Windows and Xbox: Windows Sonic for headphones, plus Dolby Atmos and DTS:X across headphones, home theater, and built-in laptop speakers on Surface, Lenovo and other devices.',
      'Asked in 2015 to define the next revolutionary step for audio at Microsoft, leading to the Spatial Audio Platform and Windows Sonic.',
    ])
  })
})

describe('the summary', () => {
  it('profile.summary is Steven’s approved text, word for word', () => {
    expect(profile.summary).toBe('Product leader with nearly 20 years at Microsoft who sees early where customers and markets are heading, and builds for it: choosing low latency over 4K as the differentiator for xCloud game streaming, forecasting how a key Windows AI feature would land in retail well before broad rollout, and inventing products in areas I was new to, from spatial audio for Windows and Xbox to the data and experimentation systems that decide what ships on more than 1.6 billion Windows devices. Co-inventor on 19 granted US patents spanning spatial audio, game streaming, casting and device telemetry. I lead teams of 10 to 20 product managers, use data, experimentation and AI to find what works, and keep building products myself.')
  })

  it('keeps the two sources the summary relies on: the xCloud bullet and Amit Gupte’s forecast', () => {
    expect(pointsOf('spatial-audio-lead')).toContain('Shaped Xbox xCloud game streaming strategy, prioritizing low latency over 4K resolution and making it the platform\'s key differentiator.')
    const gupte = recommendations.find(([name]) => name === 'Amit Gupte')!
    expect(gupte[2]).toContain('accurately forecast how a key Windows AI feature would land in retail well before broad rollout')
    expect(profile.summary).toContain('low latency over 4K')
    expect(profile.summary).toContain('forecasting how a key Windows AI feature would land in retail')
  })
})

describe('the honors', () => {
  it('adds the HiPo selection first, undated, and keeps the four honors as they were', () => {
    expect(honors).toEqual([
      ['Selected for Microsoft’s High Potential (HiPo) program', 'Issued by Microsoft'],
      ['Microsoft Lighthouse Award for Teamwork', 'Issued by Microsoft · Jan 2012'],
      ['Microsoft Compass Award for Individual Excellence', 'Issued by Microsoft · Jan 2011'],
      ['Microsoft Gold Star Award', 'Issued by Microsoft · Jan 2011'],
      ['Most Valuable Professional (MVP): VS Team System', 'Issued by Microsoft · Jan 2006'],
    ])
    expect(resumeSource).toContain('TODO(steven): year of the HiPo selection')
    for (const [title, issued] of honors) {
      expect(title.trim()).not.toBe('')
      expect(issued.trim()).not.toBe('')
    }
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
