// GET /api/resume: the résumé score for the admin dashboard: the report the build wrote
// for this deployment (score, findings, the questions the data raises, the comparison
// with the résumé that was live before) and the score of every résumé that went live
// (admin token). Reading also records the current report, so the history is complete
// even when the deploy's own recording (functions/_middleware.ts) was missed.
import type { Env } from '../_lib/env'
import { isAdmin } from '../_lib/auth'
import { ResumeScores } from '../_lib/resume-scores'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401)
  const scores = new ResumeScores(env.DB)
  const report = await ResumeScores.currentReport(env.ASSETS, request.url).catch(() => null)
  await scores.record(report).catch((error: unknown) => console.error('resume score record failed', error))
  return json({ report, history: await scores.history() })
}
