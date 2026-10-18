// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseReport, reportKey } from './resume-scores'

describe('the résumé score history', () => {
  it('keys a résumé by the PDF hash, and older reports without one by size and score', () => {
    expect(reportKey({ score: 90, pdfHash: '5c6d5e33a06be236', findings: [], questions: [] })).toBe('5c6d5e33a06be236')
    expect(reportKey({ score: 90, bytes: 319649, findings: [], questions: [] })).toBe('legacy:319649:90')
  })

  it('only accepts a report with a score and findings', () => {
    expect(parseReport(null)).toBeNull()
    expect(parseReport('not json')).toBeNull()
    expect(parseReport('{"score":"high"}')).toBeNull()
    expect(parseReport('{"score":90,"findings":[],"questions":[]}')).toMatchObject({ score: 90 })
  })
})
