// Types for scripts/resume-check.mjs, for src/resume.test.ts.
export type Finding = { severity: 'error' | 'warn' | 'info'; id: string; message: string }
export type Question = { about: string; question: string }
export type Report = {
  path: string
  exists: boolean
  score: number
  errors?: number
  warnings?: number
  pages: number
  bytes: number
  title: string | null
  matchesSite?: boolean
  findings: Finding[]
  questions: Question[]
  checkedAt?: string
}
export const resumePath: string
export function extractPdf(path: string): Promise<{ pages: string[]; text: string; title: string | null; bytes: number }>
export function span(dates: string): { start: number; end: number } | null
export function dataQuestions(now?: Date): Question[]
export function analyzeResume(path?: string, options?: { now?: Date }): Promise<Report>
export function formatReport(report: Report): string
