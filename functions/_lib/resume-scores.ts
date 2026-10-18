// The résumé score over time. The build scores the résumé PDF (scripts/resume-check.mjs)
// and writes the report next to the site as /resume-report.json. This module records
// that report in D1 once per PDF (keyed by the PDF's hash), so the admin dashboard can
// show how the score moved with every update. Recording is idempotent: the same PDF
// seen again only refreshes its latest check.
import type { ResumeReport } from './review/recruiter'

export type Comparison = { source: string; score: number; change: number; lower: boolean; verdict: 'lower' | 'higher' | 'unchanged' }
export type ScoredReport = ResumeReport & { pdfHash?: string; bytes?: number; title?: string | null; commit?: string | null; commitMessage?: string | null; baseline?: Comparison | null }
export type ScoreRow = { pdfHash: string; score: number; errors: number; warnings: number; pages: number; bytes: number; commit: string | null; commitMessage: string | null; findings: { severity: string; id: string; message: string }[]; checkedAt: number; firstSeen: number }

type Db = { pdf_hash: string; score: number; errors: number; warnings: number; pages: number; bytes: number; commit_sha: string | null; commit_message: string | null; findings: string; checked_at: number; first_seen: number }
const fromRow = (row: Db): ScoreRow => ({ pdfHash: row.pdf_hash, score: row.score, errors: row.errors, warnings: row.warnings, pages: row.pages, bytes: row.bytes, commit: row.commit_sha, commitMessage: row.commit_message, findings: JSON.parse(row.findings || '[]'), checkedAt: row.checked_at, firstSeen: row.first_seen })

// Reports from before the hash was added are keyed by size and score, so they still show once.
export const reportKey = (report: ScoredReport) => report.pdfHash ?? `legacy:${report.bytes ?? 0}:${report.score}`

export const parseReport = (text: string | null): ScoredReport | null => {
  if (!text) return null
  try {
    const report = JSON.parse(text) as ScoredReport
    return typeof report.score === 'number' && Array.isArray(report.findings) ? report : null
  } catch {
    return null
  }
}

// The table (migrations/0009_resume_scores.sql). Created here too when it is missing, so
// a deploy never has to wait for `npm run db:migrate` to start recording.
const schema = `CREATE TABLE IF NOT EXISTS resume_scores (pdf_hash TEXT PRIMARY KEY, score INTEGER NOT NULL, errors INTEGER NOT NULL DEFAULT 0, warnings INTEGER NOT NULL DEFAULT 0,
  pages INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0, commit_sha TEXT, commit_message TEXT, findings TEXT NOT NULL DEFAULT '[]', checked_at INTEGER NOT NULL, first_seen INTEGER NOT NULL)`
let ensured: Promise<unknown> | null = null

export class ResumeScores {
  constructor(private db: D1Database) {}

  private ensure() {
    ensured ??= this.db.prepare(schema).run().catch((error: unknown) => { ensured = null; throw error })
    return ensured
  }

  // Reads the deployment's own report (the static file served next to the functions).
  static async currentReport(assets: Fetcher, requestUrl: string) {
    const response = await assets.fetch(new URL('/resume-report.json', requestUrl).toString())
    return response.ok ? parseReport(await response.text()) : null
  }

  async record(report: ScoredReport | null, now = Date.now()) {
    if (!report || report.exists === false) return false
    await this.ensure()
    const checkedAt = report.checkedAt ? Date.parse(report.checkedAt) || now : now
    const findings = report.findings.filter((f) => f.severity !== 'info').map(({ severity, id, message }) => ({ severity, id, message }))
    await this.db.prepare(`INSERT INTO resume_scores (pdf_hash, score, errors, warnings, pages, bytes, commit_sha, commit_message, findings, checked_at, first_seen)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      ON CONFLICT(pdf_hash) DO UPDATE SET score = excluded.score, errors = excluded.errors, warnings = excluded.warnings, pages = excluded.pages, bytes = excluded.bytes,
        commit_sha = COALESCE(excluded.commit_sha, commit_sha), commit_message = COALESCE(excluded.commit_message, commit_message), findings = excluded.findings, checked_at = MAX(checked_at, excluded.checked_at)`)
      .bind(reportKey(report), report.score, report.errors ?? 0, report.warnings ?? 0, report.pages ?? 0, report.bytes ?? 0, report.commit ?? null, report.commitMessage ?? null, JSON.stringify(findings), checkedAt, now)
      .run()
    return true
  }

  // Newest first.
  async history(limit = 100) {
    await this.ensure()
    const { results } = await this.db.prepare('SELECT * FROM resume_scores ORDER BY first_seen DESC, checked_at DESC LIMIT ?').bind(limit).all<Db>()
    return results.map(fromRow)
  }
}
