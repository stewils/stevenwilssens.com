// @vitest-environment node
// The resume PDF is generated from src/resume.ts (npm run resume:build). This test
// fails when the two drift, so a content change never ships without a new resume.
import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import { analyzeResume, atsScore, compareScores, dataQuestions, extractPdf, formatComparison, lenses, readBaseline, resumePath } from '../scripts/resume-check.mjs'
import resumeScript from '../scripts/resume.mjs?raw'
import { about, experiences, impact, profile, recommendations, selectedWork } from './resume'

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

  // In the facts strip's "Looking for" cell, which sits under the header and before the summary.
  it('prints the work arrangement on page 1, before the summary', async () => {
    const { pages } = await extractPdf(resumePath)
    const first = normalize(pages[0])
    const at = first.indexOf(normalize(profile.workArrangement))
    expect(at).toBeGreaterThan(-1)
    expect(at).toBeLessThan(first.indexOf('summary'))
    expect(pages).toHaveLength(2)
  }, 30_000)

  // T-S1: the PDF is HTML put together as a string, so the field only ever goes in through esc().
  it('interpolates the work arrangement into the PDF template only through esc()', () => {
    const uses = resumeScript.match(/.{0,4}profile\.workArrangement/g) ?? []
    expect(uses.length).toBeGreaterThan(0)
    for (const use of uses) expect(use).toBe('esc(profile.workArrangement')
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
})

describe('the profile', () => {
  it('states the work arrangement in Steven\'s words and keeps the location', () => {
    expect(profile.workArrangement).toBe('Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating.')
    expect(profile.location).toBe('Seattle, Washington')
  })

  // T-S2: the sentence goes into the assistant's prompt as part of one line, so it holds
  // nothing that could pose as prompt structure (the bar of the About copy's validator).
  it('keeps the work arrangement to one plain line', () => {
    expect(profile.workArrangement.length).toBeLessThanOrEqual(160)
    expect(profile.workArrangement).not.toMatch(/[\n\r<>[\]`]/)
    expect(profile.workArrangement).not.toMatch(/[​-‏‪-‮⁠-⁤⁦-⁩﻿]/)
  })
})

const entry = (key: string) => experiences.find((item) => item.key === key)!
const work = (key: string) => selectedWork.find((item) => item.key === key)!

// Steven's approved wording, decided on 2026-10-21, and what it had to leave alone.
describe('Steven\'s approved entries', () => {
  it('cosmos explains the overlap with Info Support', () => {
    const cosmos = entry('cosmos')
    expect(cosmos.summary).toBe('Built and supported software components across C# client and Java server systems using CORBA middleware. Joined as a consultant from Info Support, then hired full-time.')
    expect(cosmos.dates).toBe('Jan 2004 - Dec 2005')
    expect(cosmos.points).toEqual(['Provided technical guidance, application redesigns, developer support, and code reviews.', 'Worked on the Technical Components team responsible for construction, maintenance, and support.'])
  })

  it('windows-quality outcome', () => {
    const item = work('windows-quality')
    expect(item.outcome).toBe('Adopted by every Windows team, and behind the roughly 30% drop in issue days across Perfect Day scenarios.')
    expect(item.source).toBe('Amit Gupte')
    expect([item.title, item.period, item.context, item.work]).toEqual([
      'Windows quality, measured from preview channels to retail',
      '2020 - 2026',
      'Windows ships to more than 1.6 billion devices. Engineers needed to know whether a release was healthy before it reached customers, and to find the issues that mattered once it had.',
      'Led the PM team that built the data products and the review rhythms measuring Windows quality across the Insider preview channels and at retail scale, weaving customer signals and machine learning into insights engineers act on.',
    ])
  })

  it('okr-tool what I did', () => {
    const item = work('okr-tool')
    expect(item.work).toBe('With a member of my team, ideated and stood up a working replacement from scratch using AI coding tools, rather than waiting for a procurement cycle. Built in six months to replace Viva Goals, Microsoft’s acquired OKR product, after it was retired.')
    expect(item.work).toContain('Microsoft’s')
    expect(item.outcome).toBe('The gap was closed with a functional replacement, and the project became the team’s working example of a modern AI development lifecycle.')
    expect(item.source).toBe('Amit Gupte')
  })

  it('wilssens-com outcome', () => {
    expect(work('wilssens-com').outcome).toBe('Live with five sites and about eight family mailboxes, each site on its own isolated Worker and database; the design decisions are written up for hiring managers.')
  })

  it('leaves the impact numbers and the recommendations as they were', async () => {
    expect(impact).toEqual([
      { value: '250%+', label: 'growth in monthly active spatial-audio devices', backing: 'spatial-audio-lead' },
      { value: '1.6B+', label: 'Windows devices informing product decisions', backing: 'windows-devices-data' },
      { value: '+5%', label: 'Perfect Day improvement for Windows gaming', backing: 'csx-data' },
      { value: '~30%', label: 'fewer issue days across Perfect Day scenarios', backing: 'csx-data' },
    ])
    // Every recommendation (name, title, words) byte for byte, as a hash of the list.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(recommendations)))
    expect([...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')).toBe('47853398fad42be5068bd6fb25742d12b0737ee100adc0912eb9cd5950aecc4f')
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
