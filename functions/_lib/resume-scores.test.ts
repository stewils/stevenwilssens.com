// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { fakeAssets, fakeD1 } from './testing/d1'
import { parseReport, reportKey, ResumeScores, type ScoredReport } from './resume-scores'

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

const report = (overrides: Partial<ScoredReport> = {}): ScoredReport => ({
  score: 90, errors: 1, warnings: 2, pages: 2, bytes: 1000, pdfHash: 'abc', commit: 'c1', commitMessage: 'First', checkedAt: '2026-10-18T10:00:00Z',
  findings: [{ severity: 'error', id: 'tense', message: 'Past tense', lens: 'ats' }, { severity: 'info', id: 'note', message: 'FYI' }] as ScoredReport['findings'],
  questions: [],
  ...overrides,
})

describe('recording the résumé score', () => {
  it('reads the deployment report, or nothing when it is missing or broken', async () => {
    const seen: string[] = []
    const assets = fakeAssets({ '/resume-report.json': JSON.stringify(report()) }, seen)
    expect(await ResumeScores.currentReport(assets, 'https://steven.wilssens.com/api/admin/resume')).toMatchObject({ score: 90, pdfHash: 'abc' })
    expect(seen).toEqual(['/resume-report.json'])
    expect(await ResumeScores.currentReport(fakeAssets({}), 'https://steven.wilssens.com/')).toBeNull()
    expect(await ResumeScores.currentReport(fakeAssets({ '/resume-report.json': '<html>' }), 'https://steven.wilssens.com/')).toBeNull()
  })

  it('skips no report and a report for a missing PDF', async () => {
    const db = fakeD1()
    const scores = new ResumeScores(db)
    expect(await scores.record(null)).toBe(false)
    expect(await scores.record(report({ exists: false }))).toBe(false)
    expect(db.queries).toEqual([])
  })

  it('records a PDF once, refreshing its latest check, and lists the history newest first', async () => {
    const scores = new ResumeScores(fakeD1())
    expect(await scores.record(report(), 5000)).toBe(true)
    await scores.record(report({ score: 88, commit: null, commitMessage: null, checkedAt: '2026-10-19T10:00:00Z' }), 6000)
    await scores.record(report({ pdfHash: 'def', score: 95, checkedAt: 'not a date', errors: undefined, warnings: undefined, pages: undefined, bytes: undefined, commit: undefined, commitMessage: undefined }), 7000)
    await scores.record(report({ pdfHash: undefined, checkedAt: undefined, findings: [] }), 8000)
    const history = await scores.history()
    expect(history.map((row) => row.pdfHash)).toEqual(['legacy:1000:90', 'def', 'abc'])
    expect(history[2]).toEqual({ pdfHash: 'abc', score: 88, errors: 1, warnings: 2, pages: 2, bytes: 1000, commit: 'c1', commitMessage: 'First', findings: [{ severity: 'error', id: 'tense', message: 'Past tense' }], checkedAt: Date.parse('2026-10-19T10:00:00Z'), firstSeen: 5000 })
    expect(history[1]).toMatchObject({ score: 95, errors: 0, warnings: 0, pages: 0, bytes: 0, commit: null, commitMessage: null, checkedAt: 7000 })
    expect(history[0]).toMatchObject({ checkedAt: 8000, findings: [] })
    expect(await scores.history(1)).toHaveLength(1)
  })

  it('reads an empty findings column as no findings', async () => {
    const db = fakeD1()
    db.sqlite.prepare("INSERT INTO resume_scores (pdf_hash, score, findings, checked_at, first_seen) VALUES ('x', 80, '', 1, 1)").run()
    expect((await new ResumeScores(db).history())[0]).toMatchObject({ pdfHash: 'x', findings: [], commit: null })
  })

  it('creates the table when it is missing, and tries again after a failure', async () => {
    vi.resetModules()
    const { ResumeScores: Fresh } = await import('./resume-scores')
    const db = fakeD1()
    db.sqlite.exec('DROP TABLE resume_scores')
    db.failOn = /CREATE TABLE/
    await expect(new Fresh(db).history()).rejects.toThrow('D1_ERROR')
    db.failOn = undefined
    expect(await new Fresh(db).history()).toEqual([])
    expect(db.queries.filter((sql) => sql.startsWith('CREATE TABLE'))).toHaveLength(2)
    await new Fresh(db).history()
    expect(db.queries.filter((sql) => sql.startsWith('CREATE TABLE'))).toHaveLength(2)
  })
})
