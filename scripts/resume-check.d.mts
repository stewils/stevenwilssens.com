// Types for scripts/resume-check.mjs, for src/resume.test.ts.
export type Finding = { severity: 'error' | 'warn' | 'info'; id: string; message: string }
export type Question = { about: string; question: string }
export type Baseline = { source: string; score: number; errors: number | null; warnings: number | null; checkedAt: string | null }
export type Comparison = Baseline & { change: number; lower: boolean; verdict: 'lower' | 'higher' | 'unchanged' }
export type Report = {
  path: string
  exists: boolean
  score: number
  errors?: number
  warnings?: number
  pages: number
  bytes: number
  pdfHash?: string
  title: string | null
  matchesSite?: boolean
  findings: Finding[]
  questions: Question[]
  checkedAt?: string
  commit?: string | null
  commitMessage?: string | null
  baseline?: Comparison | null
}
export const resumePath: string
export function extractPdf(path: string): Promise<{ pages: string[]; text: string; title: string | null; bytes: number; sha256: string }>
export function commitInfo(): { commit: string | null; commitMessage: string | null }
export function span(dates: string): { start: number; end: number } | null
export function dataQuestions(now?: Date): Question[]
export function analyzeResume(path?: string, options?: { now?: Date }): Promise<Report>
export function formatReport(report: Report): string
export function readBaseline(source: string | null | undefined): Promise<Baseline | null>
export function compareScores(report: { score: number }, baseline: Baseline | null): Comparison | null
export function formatComparison(report: { score: number; baseline?: Comparison | null }): string
