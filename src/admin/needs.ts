// What needs Steven, per page, and a line per page for the overview's tiles. Both are
// derived from the loaded data, so they are pure and tested in needs.test.ts.
import { isWrong, tileText } from './askQuality'
import { formatNumber, formatUsd, projectMonth } from './format'
import type { PageId } from './pages'
import { cutLine, tileLine, unreadUpdates } from './team-state'
import type { AdminData } from './types'

// `hash` is where the line links when it is more than the page (#assistant?rate=wrong).
export type Need = { key: string; page: PageId; n: number; text: string; hash?: string }

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export const computeNeeds = ({ stats, mcp, ask, resume, team }: AdminData, now = new Date()): Need[] => {
  const needs: Need[] = []
  const add = (key: string, page: PageId, n: number, text: string, hash?: string) => { if (n > 0) needs.push({ key, page, n, text, ...(hash ? { hash } : {}) }) }

  if (resume) {
    const report = resume.report
    if (!report) add('resume-missing', 'resume', 1, 'no résumé report in this deployment; deploy main again')
    else {
      if (report.matchesSite === false) add('resume-mismatch', 'resume', 1, 'the résumé PDF does not match src/resume.ts: run npm run resume:build')
      if (report.baseline?.lower) add('resume-lower', 'resume', 1, `the résumé scores lower than the one it replaced (${report.baseline.score} → ${report.score})`)
      const findings = report.findings.filter((finding) => finding.severity !== 'info').length
      add('resume-findings', 'resume', findings, plural(findings, 'résumé finding to fix in the data', 'résumé findings to fix in the data'))
      add('resume-questions', 'resume', report.questions.length, plural(report.questions.length, 'question the résumé data raises for you', 'questions the résumé data raises for you'))
    }
  }
  if (mcp) {
    const proposed = mcp.proposals.filter((proposal) => proposal.status === 'proposed').length
    const approved = mcp.proposals.filter((proposal) => proposal.status === 'approved').length
    add('proposals-waiting', 'resume', proposed, plural(proposed, 'proposal from Claude waiting for your decision', 'proposals from Claude waiting for your decision'))
    add('proposals-approved', 'resume', approved, plural(approved, 'approved edit not yet on the site', 'approved edits not yet on the site'))
    if (!mcp.ownerUrl) add('mcp-key', 'mcp', 1, 'the career MCP has no owner key: set the MCP_OWNER_KEY secret and redeploy')
  }
  if (ask) {
    add('ask-gaps', 'assistant', ask.questions.length, plural(ask.questions.length, 'question from the site waits for your answer; your career MCP will offer it when a session starts', 'questions from the site wait for your answers; your career MCP will offer them when a session starts'))
    if (!ask.configured && !ask.mock) add('ask-off', 'assistant', 1, 'the assistant is not live: set the ANTHROPIC_API_KEY secret and redeploy')
    const budget = ask.budgetUsd * 1_000_000
    const projected = projectMonth(ask.month.costMicro, now)
    if (ask.month.costMicro > budget * 0.8) add('ask-budget', 'assistant', 1, `the assistant has used ${formatUsd(ask.month.costMicro)} of its ${formatUsd(budget)} monthly budget`)
    // The pace only means something once a few days are in; day one would multiply a single question by thirty.
    else if (now.getUTCDate() >= 3 && projected > budget) add('ask-pace', 'assistant', 1, `at this pace the assistant's budget runs out before the month ends (about ${formatUsd(projected)} of ${formatUsd(budget)})`)
    // Steven's ratings: the answers he marked wrong in the range that are still kept (past 90 days
    // a rating keeps its scores but not its answer, so there is nothing left to check or re-rate),
    // and every rateable answer of the last seven days (whatever the range) that he has not rated.
    // Nothing when the log could not be read.
    if (ask.log) {
      const wrong = (ask.ratings ?? []).filter((rating) => rating.logId !== null && isWrong(rating)).length
      add('ask-wrong', 'assistant', wrong, plural(wrong, 'answer you marked wrong: check the facts it used', 'answers you marked wrong: check the facts they used'), 'assistant?rate=wrong')
      const unrated = ask.unratedWeek?.length ?? 0
      add('ask-unrated', 'assistant', unrated, plural(unrated, 'answer from the last 7 days waits for your rating', 'answers from the last 7 days wait for your rating'), 'assistant?rate=unrated')
    }
  }
  if (team) {
    // Changes to the agent team Steven has not seen yet, like unread mail (the Team page).
    const unread = unreadUpdates(team.manifest, team.reads)
    const line = unread[0] ? `“${cutLine(unread[0].summary)}”` : ''
    add('team-unread', 'team', unread.length, unread.length === 1 ? `change to your agent team you have not seen: ${line}` : `changes to your agent team you have not seen, the latest ${line}`)
  }
  if (stats) {
    const failing = stats.vitals.devices.filter((device) => device.passes === false).length
    add('vitals', 'speed', failing, plural(failing, 'device type fails Core Web Vitals', 'device types fail Core Web Vitals'))
    if (stats.crawlTotals.errors > 0) add('crawl-errors', 'crawlers', stats.crawlTotals.errors, plural(stats.crawlTotals.errors, 'named crawler request got an error answer', 'named crawler requests got error answers'))
  }
  return needs
}

// Badge per page: the sum of what needs Steven there.
export const badgeCounts = (needs: Need[]) => {
  const counts: Partial<Record<PageId, number>> = {}
  for (const need of needs) counts[need.page] = (counts[need.page] ?? 0) + need.n
  return counts
}

export const computeSummaries = ({ stats, mcp, ask, resume, team, days }: AdminData): Partial<Record<PageId, string>> => {
  const summaries: Partial<Record<PageId, string>> = {}
  if (stats) {
    const { totals } = stats
    summaries.traffic = `${formatNumber(totals.visitors)} visitors · ${formatNumber(totals.pageviews)} pageviews · ${formatNumber(totals.downloads)} résumé downloads`
    const channel = stats.channels[0]
    summaries.sources = channel ? `${channel.name} leads with ${formatNumber(channel.visitors)} visitors · ${stats.channels.length} ${plural(stats.channels.length, 'channel', 'channels')}` : 'No visits in this range yet'
    const organization = stats.organizations.find((row) => row.name !== 'Unknown')
    summaries.audience = `${organization ? `${organization.name} is the top organization` : 'No organization known yet'} · ${stats.countries.length} ${plural(stats.countries.length, 'country', 'countries')}`
    summaries.crawlers = `${formatNumber(stats.crawlTotals.requests)} crawler requests · ${formatNumber(stats.crawlTotals.assistant)} from AI assistants`
    const devices = stats.vitals.devices.filter((device) => device.passes !== null)
    summaries.speed = devices.length ? devices.map((device) => `${device.device} ${device.passes ? 'passes' : 'fails'}`).join(' · ') : 'Not enough measurements yet'
  }
  if (resume) {
    const report = resume.report
    summaries.resume = report
      ? `ATS score ${report.score}/100 · ${report.pages ?? '?'} ${plural(report.pages ?? 0, 'page', 'pages')} · ${report.ats?.warnings ?? report.warnings ?? 0} ${plural(report.ats?.warnings ?? report.warnings ?? 0, 'warning', 'warnings')}${report.baseline ? ` · ${report.baseline.verdict === 'unchanged' ? 'unchanged from' : `${report.baseline.verdict} than`} the live résumé before` : ''}`
      : 'No résumé report in this deployment'
  }
  if (ask) {
    const people = ask.log && new Set(ask.log.map((entry) => entry.visitor)).size
    // The log keeps 90 days, so a longer range counts the people of those 90.
    const logDays = ask.logDays ?? Math.min(days, 90)
    summaries.assistant = `${formatUsd(ask.month.costMicro)} of ${formatUsd(ask.budgetUsd * 1_000_000)} this month · ${formatNumber(ask.month.questions)} questions · ${formatNumber(ask.month.gap)} gaps${people === undefined ? '' : ` · ${formatNumber(people)} ${people === 1 ? 'person' : 'people'} asked in ${plural(logDays, 'the last day', `${logDays} days`)}`}${tileText(ask.ratings)}`
  }
  if (mcp) summaries.mcp = `${formatNumber(mcp.entries.total)} dossier entries across ${mcp.entries.roles} roles · ${formatNumber(mcp.entries.public)} public${mcp.publicCalls ? ` · ${formatNumber(mcp.publicCalls.total)} public ${plural(mcp.publicCalls.total, 'call', 'calls')}` : ''}`
  if (team) summaries.team = tileLine(team.manifest, unreadUpdates(team.manifest, team.reads).length)
  return summaries
}
