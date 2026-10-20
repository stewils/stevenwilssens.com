// @vitest-environment node
// The resume PDF is generated from src/resume.ts (npm run resume:build). This test
// fails when the two drift, so a content change never ships without a new resume.
import { describe, expect, it } from 'vitest'
import { analyzeResume, atsScore, compareScores, dataQuestions, extractPdf, formatComparison, lenses, readBaseline, resumePath } from '../scripts/resume-check.mjs'
import { experiences, profile } from './resume'

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

  // The score is what an applicant tracking system makes of the PDF: what a recruiter
  // would say and where the PDF differs from the site are listed but do not count.
  it('scores only the findings an applicant tracking system trips over', () => {
    expect(atsScore([])).toBe(100)
    expect(atsScore([{ severity: 'warn', lens: 'recruiter' }, { severity: 'error', lens: 'site' }, { severity: 'info', lens: 'ats' }])).toBe(100)
    expect(atsScore([{ severity: 'error', lens: 'ats' }, { severity: 'warn', lens: 'ats' }, { severity: 'warn', lens: 'ats' }])).toBe(65)
    expect(atsScore(Array.from({ length: 6 }, () => ({ severity: 'error', lens: 'ats' })))).toBe(0)
  })

  // resume-check does not look for the work arrangement or the tail of an older role's
  // summary, so the drift test above would pass without them.
  it('prints the work arrangement beside the location in the PDF header', async () => {
    const pdf = await extractPdf(resumePath)
    expect(pdf.pages.length).toBeLessThanOrEqual(2)
    const flat = (text: string) => text.replace(/\s+/g, ' ')
    const first = flat(pdf.pages[0])
    const location = first.indexOf(profile.location)
    expect(location).toBeGreaterThanOrEqual(0)
    expect(first.indexOf(profile.workArrangement)).toBeGreaterThan(location)
    expect(first).not.toContain(`${profile.location}${profile.workArrangement}`)
    const cosmos = experiences.find((item) => item.key === 'cosmos')!
    expect(flat(pdf.text)).toContain(cosmos.summary)
  }, 30_000)

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
