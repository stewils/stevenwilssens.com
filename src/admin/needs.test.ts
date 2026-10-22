import { describe, expect, it } from 'vitest'
import { badgeCounts, computeNeeds, computeSummaries } from './needs'
import { makeRating, makeTeamManifest, makeTeamReads, makeUpdate, sha } from '../test/admin-fixtures'
import type { AdminData, AskInfo, McpInfo, ResumeInfo, Stats, TeamData } from './types'

const stats = {
  totals: { visitors: 12, pageviews: 30, downloads: 3, downloaders: 2, contactClicks: 1, avgDurationMs: null, avgScrollPct: null, bounceRate: null },
  channels: [{ name: 'LinkedIn', visitors: 7 }, { name: 'Direct', visitors: 5 }],
  organizations: [{ name: 'Unknown', visitors: 9 }, { name: 'Microsoft', visitors: 3 }],
  countries: [{ name: 'United States', visitors: 12 }],
  crawlTotals: { requests: 40, bots: 5, search: 20, ai: 10, assistant: 4, other: 6, errors: 2, probes: 110 },
  vitals: { metrics: [], pages: [], devices: [{ device: 'phone', visits: 5, passes: true }, { device: 'desktop', visits: 7, passes: false }], culprits: [] },
} as unknown as Stats
const mcp: McpInfo = { ownerUrl: null, publicUrl: 'https://x/mcp', publicCalls: { days: 30, total: 12, byTool: [{ tool: 'about_steven', calls: 12 }], recent: [] }, entries: { total: 40, public: 8, roles: 6 }, proposals: [{ id: 1, updatedAt: 0, role: 'csx-data', kind: 'replace', currentText: 'a', proposedText: 'b', rationale: 'why', status: 'proposed', decisionNote: null }, { id: 2, updatedAt: 0, role: 'csx-data', kind: 'add', currentText: null, proposedText: 'c', rationale: 'why', status: 'approved', decisionNote: null }, { id: 3, updatedAt: 0, role: 'csx-data', kind: 'add', currentText: null, proposedText: 'd', rationale: 'why', status: 'applied', decisionNote: null }] }
const ask: AskInfo = { configured: true, mock: false, model: 'm', budgetUsd: 25, humanCheck: true, month: { questions: 10, answered: 8, gap: 2, off: 0, limited: 0, failed: 0, costMicro: 1_250_000, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, daily: [], votes: [], questions: [{ id: 1, ts: 0, reason: 'gap', page: null, question: 'q', answer: null, country: null, asOrg: null }], resolved: { answered: 0, dismissed: 0 } }
const resume: ResumeInfo = { report: { score: 85, errors: 0, warnings: 3, pages: 2, matchesSite: true, findings: [{ severity: 'warn', id: 'a', message: 'a' }, { severity: 'warn', id: 'b', message: 'b' }, { severity: 'warn', id: 'c', message: 'c' }, { severity: 'info', id: 'd', message: 'd' }], questions: [{ about: 'impact', question: 'Which role?' }], baseline: { source: 'https://steven.wilssens.com/resume-report.json', score: 90, change: -5, lower: true, verdict: 'lower' } }, history: [] }
const data: AdminData = { days: 30, stats, mcp, ask, resume }
const midMonth = new Date('2026-10-17T12:00:00Z')

describe('what needs Steven', () => {
  it('counts the résumé findings, questions, proposals and a lower score on the Résumé page', () => {
    const needs = computeNeeds(data, midMonth)
    expect(needs.filter((need) => need.page === 'resume').map((need) => [need.key, need.n])).toEqual([['resume-lower', 1], ['resume-findings', 3], ['resume-questions', 1], ['proposals-waiting', 1], ['proposals-approved', 1]])
    expect(needs.find((need) => need.key === 'resume-lower')?.text).toContain('90 → 85')
    expect(needs.find((need) => need.key === 'resume-findings')?.text).toBe('résumé findings to fix in the data')
  })

  it('words the proposals for the résumé and the About page alike, one and several, on the Résumé page', () => {
    const lines = (proposals: McpInfo['proposals']) => computeNeeds({ ...data, mcp: { ...mcp, proposals } }, midMonth).filter((need) => need.key.startsWith('proposals-')).map((need) => [need.key, need.page, need.n, need.text])
    const one = mcp.proposals[0]
    expect(lines([{ ...one, status: 'proposed' }, { ...one, id: 2, role: 'about', field: 'intro', status: 'approved' }])).toEqual([
      ['proposals-waiting', 'resume', 1, 'proposal from Claude waiting for your decision'],
      ['proposals-approved', 'resume', 1, 'approved edit not yet on the site'],
    ])
    expect(lines([{ ...one, status: 'proposed' }, { ...one, id: 2, role: 'about', status: 'proposed' }, { ...one, id: 3, status: 'approved' }, { ...one, id: 4, role: 'about', status: 'approved' }])).toEqual([
      ['proposals-waiting', 'resume', 2, 'proposals from Claude waiting for your decision'],
      ['proposals-approved', 'resume', 2, 'approved edits not yet on the site'],
    ])
    expect(badgeCounts(computeNeeds({ ...data, mcp: { ...mcp, proposals: [{ ...one, status: 'proposed' }, { ...one, id: 2, role: 'about', status: 'approved' }] } }, midMonth)).resume).toBe(badgeCounts(computeNeeds(data, midMonth)).resume)
  })

  it('flags the missing MCP key, the assistant gaps, a failing device type and crawl errors', () => {
    const needs = computeNeeds(data, midMonth)
    expect(needs.map((need) => need.key)).toEqual(expect.arrayContaining(['mcp-key', 'ask-gaps', 'vitals', 'crawl-errors']))
    expect(badgeCounts(needs)).toEqual({ resume: 7, mcp: 1, assistant: 1, speed: 1, crawlers: 2 })
  })

  it("warns when the assistant's pace would run through the budget, but not on the first days of a month", () => {
    const spending: AdminData = { ...data, ask: { ...ask, month: { ...ask.month, costMicro: 15_000_000 } } }
    const pace = computeNeeds(spending, midMonth).find((need) => need.key === 'ask-pace')
    expect(pace?.text).toBe("at this pace the assistant's budget runs out before the month ends (about $27.35 of $25.00)")
    expect(computeNeeds(spending, new Date('2026-10-02T12:00:00Z')).map((need) => need.key)).not.toContain('ask-pace')
    // Past 80% spent, the budget line says it instead of the pace.
    const nearlySpent: AdminData = { ...data, ask: { ...ask, month: { ...ask.month, costMicro: 21_000_000 } } }
    expect(computeNeeds(nearlySpent, midMonth).map((need) => need.key)).toEqual(expect.arrayContaining(['ask-budget']))
    expect(computeNeeds(nearlySpent, midMonth).map((need) => need.key)).not.toContain('ask-pace')
  })

  it('says nothing is waiting when the data is clean', () => {
    const clean: AdminData = { days: 30, stats: { ...stats, crawlTotals: { ...stats.crawlTotals, errors: 0 }, vitals: { ...stats.vitals, devices: [] } }, mcp: { ...mcp, ownerUrl: 'https://x/mcp/k', proposals: [] }, ask: { ...ask, questions: [] }, resume: { report: { ...resume.report!, findings: [], questions: [], baseline: null }, history: [] } }
    expect(computeNeeds(clean, midMonth)).toEqual([])
    expect(computeNeeds({ days: 30, stats: null, mcp: null, ask: null, resume: null }, midMonth)).toEqual([])
  })

  it('writes one line per page for the overview tiles', () => {
    const summaries = computeSummaries(data)
    expect(summaries.traffic).toBe('12 visitors · 30 pageviews · 3 résumé downloads')
    expect(summaries.sources).toBe('LinkedIn leads with 7 visitors · 2 channels')
    expect(summaries.audience).toBe('Microsoft is the top organization · 1 country')
    expect(summaries.speed).toBe('phone passes · desktop fails')
    expect(summaries.resume).toBe('ATS score 85/100 · 2 pages · 3 warnings · lower than the live résumé before')
    expect(summaries.assistant).toBe('$1.25 of $25.00 this month · 10 questions · 2 gaps')
    const logged = (visitors: string[]) => computeSummaries({ ...data, days: 7, ask: { ...ask, log: visitors.map((visitor, id) => ({ id, ts: id, visitor, kind: 'question' as const, page: null, question: 'q', answer: null, outcome: 'answered' as const, country: null, asOrg: null })) } }).assistant
    expect(logged(['a', 'a'])).toBe('$1.25 of $25.00 this month · 10 questions · 2 gaps · 1 person asked in 7 days')
    expect(logged(['a', 'b', 'a'])).toBe('$1.25 of $25.00 this month · 10 questions · 2 gaps · 2 people asked in 7 days')
    // A year asked for: the log holds 90 days, and the line says so.
    const year = computeSummaries({ ...data, days: 365, ask: { ...ask, log: [], logDays: 90 } }).assistant
    expect(year).toBe('$1.25 of $25.00 this month · 10 questions · 2 gaps · 0 people asked in 90 days')
    expect(computeSummaries({ ...data, days: 365, ask: { ...ask, log: [] } }).assistant).toMatch(/in 90 days$/)
    expect(computeSummaries({ ...data, days: 1, ask: { ...ask, log: [] } }).assistant).toMatch(/0 people asked in the last day$/)
    expect(summaries.mcp).toBe('40 dossier entries across 6 roles · 8 public · 12 public calls')
    expect(computeSummaries({ days: 30, stats: null, mcp: null, ask: null, resume: { report: null, history: [] } }).resume).toBe('No résumé report in this deployment')
  })

  it('flags a missing report, a PDF that drifted, a single finding or question, and an assistant that is not live', () => {
    expect(computeNeeds({ ...data, resume: { report: null, history: [] } }, midMonth).find((need) => need.page === 'resume')?.text).toBe('no résumé report in this deployment; deploy main again')
    const drifted: AdminData = { ...data, mcp: { ...mcp, proposals: [mcp.proposals[0], mcp.proposals[1], { ...mcp.proposals[1], id: 9 }] }, ask: { ...ask, configured: false, questions: [...ask.questions, ask.questions[0]] }, resume: { report: { ...resume.report!, matchesSite: false, baseline: undefined, findings: [resume.report!.findings[0]], questions: [...resume.report!.questions, resume.report!.questions[0]] }, history: [] } }
    const needs = computeNeeds(drifted, midMonth)
    expect(needs.map((need) => need.text)).toEqual(expect.arrayContaining([
      'the résumé PDF does not match src/resume.ts: run npm run resume:build',
      'résumé finding to fix in the data',
      'questions the résumé data raises for you',
      'proposal from Claude waiting for your decision',
      'approved edits not yet on the site',
      'questions from the site wait for your answers; your career MCP will offer them when a session starts',
      'the assistant is not live: set the ANTHROPIC_API_KEY secret and redeploy',
    ]))
    expect(needs.map((need) => need.key)).not.toContain('resume-lower')
    // In mock mode the assistant answers without a key.
    expect(computeNeeds({ ...data, ask: { ...ask, configured: false, mock: true } }, midMonth).map((need) => need.key)).not.toContain('ask-off')
    const oneEach: AdminData = { ...data, stats: { ...stats, crawlTotals: { ...stats.crawlTotals, errors: 1 }, vitals: { ...stats.vitals, devices: [{ device: 'phone', visits: 1, passes: false }, { device: 'desktop', visits: 1, passes: false }] } } }
    expect(computeNeeds(oneEach, midMonth).filter((need) => need.page === 'speed' || need.page === 'crawlers').map((need) => need.text)).toEqual(['device types fail Core Web Vitals', 'named crawler request got an error answer'])
  })

  it('writes the tiles for an empty range, an old report and an MCP without public calls', () => {
    const quiet = { ...stats, channels: [{ name: 'Direct', visitors: 1 }], organizations: [{ name: 'Unknown', visitors: 1 }], countries: [{ name: 'Belgium', visitors: 1 }, { name: 'United States', visitors: 1 }], vitals: { ...stats.vitals, devices: [{ device: 'phone', visits: 1, passes: null }] } } as Stats
    const summaries = computeSummaries({ days: 30, stats: quiet, mcp: { ...mcp, publicCalls: undefined as unknown as McpInfo['publicCalls'] }, ask: null, resume: { report: { score: 70, findings: [], questions: [], pages: 1, baseline: { source: 'main', score: 70, change: 0, lower: false, verdict: 'unchanged' } }, history: [] } })
    expect(summaries.sources).toBe('Direct leads with 1 visitors · 1 channel')
    expect(summaries.audience).toBe('No organization known yet · 2 countries')
    expect(summaries.speed).toBe('Not enough measurements yet')
    expect(summaries.resume).toBe('ATS score 70/100 · 1 page · 0 warnings · unchanged from the live résumé before')
    expect(summaries.mcp).toBe('40 dossier entries across 6 roles · 8 public')
    const one = computeSummaries({ days: 30, stats: { ...quiet, channels: [] }, mcp: { ...mcp, publicCalls: { ...mcp.publicCalls, total: 1 } }, ask: null, resume: { report: { score: 90, findings: [], questions: [], ats: { errors: 0, warnings: 1 } }, history: [] } })
    expect(one.sources).toBe('No visits in this range yet')
    expect(one.resume).toBe('ATS score 90/100 · ? pages · 1 warning')
    expect(one.mcp).toContain('1 public call')
  })
})

describe('the Team page in Needs you, the badge and the tile', () => {
  const manifest = makeTeamManifest()
  const team = (reads: TeamData['reads'], extra: Partial<TeamData> = {}): AdminData => ({ days: 30, stats: null, mcp: null, ask: null, resume: null, team: { manifest, reads, readsError: '', ...extra } })

  it('has one Team line with the number not seen, worded for several, and badges the menu', () => {
    const needs = computeNeeds(team(makeTeamReads()))
    expect(needs).toEqual([{ key: 'team-unread', page: 'team', n: 2, text: 'changes to your agent team you have not seen, the latest “The panel reviews every draft”' }])
    expect(badgeCounts(needs)).toEqual({ team: 2 })
    expect(computeSummaries(team(makeTeamReads())).team).toBe('2 roles · 1 command · last change 19 Oct · 2 not seen')
  })

  it('words one change on its own', () => {
    const [need] = computeNeeds(team(makeTeamReads({ read: [sha('3')] })))
    expect(need).toMatchObject({ n: 1, text: 'change to your agent team you have not seen: “The Team page shows the team”' })
  })

  it('has no Team line, no badge and no "not seen" on the tile when all are read', () => {
    const data = team(makeTeamReads({ read: [sha('2'), sha('3')] }))
    expect(computeNeeds(data)).toEqual([])
    expect(badgeCounts(computeNeeds(data))).toEqual({})
    expect(computeSummaries(data).team).toBe('2 roles · 1 command · last change 19 Oct')
  })

  it('counts a change from before the launch only when it was marked unread', () => {
    expect(computeNeeds(team(makeTeamReads({ read: [sha('2'), sha('3')], unread: [sha('1')] })))[0]).toMatchObject({ n: 1, text: expect.stringContaining('The editors review every change') })
  })

  it('counts nothing while the read state is loading or unavailable, without a history or without the launch', () => {
    expect(computeNeeds(team(null))).toEqual([])
    expect(computeNeeds(team(null, { readsError: 'HTTP 500' }))).toEqual([])
    expect(computeSummaries(team(null)).team).toBe('2 roles · 1 command · last change 19 Oct')
    const noHistory: AdminData = { ...team(makeTeamReads()), team: { manifest: makeTeamManifest({ history: null }), reads: makeTeamReads(), readsError: '' } }
    expect(computeNeeds(noHistory)).toEqual([])
    expect(computeSummaries(noHistory).team).toBe('2 roles · 1 command')
    const noLaunch: AdminData = { ...team(makeTeamReads()), team: { manifest: makeTeamManifest({ launch: null }), reads: makeTeamReads(), readsError: '' } }
    expect(computeNeeds(noLaunch)).toEqual([])
  })

  it('quotes the latest summary cut at 80 code points, never inside an emoji', () => {
    const summary = `${'a'.repeat(79)}😀${'b'.repeat(120)}`
    const long: AdminData = { ...team(makeTeamReads()), team: { manifest: makeTeamManifest({ history: { updates: [makeUpdate({ summary })], older: 0, truncated: false } }), reads: makeTeamReads(), readsError: '' } }
    const [need] = computeNeeds(long)
    expect(need.text).toBe(`change to your agent team you have not seen: “${'a'.repeat(79)}😀…”`)
    expect(need.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
  })
})

describe('the assistant ratings in Needs you and on the tile', () => {
  const rating = (accurate: 'yes' | 'no', overall: number, id = 1) => makeRating({ id, logId: id, accurate, overall })
  const withRatings = (overrides: Partial<AskInfo>): AdminData => ({ days: 30, stats: null, mcp: null, resume: null, ask: { ...ask, questions: [], log: [], ...overrides } })
  const ratingNeeds = (overrides: Partial<AskInfo>) => computeNeeds(withRatings(overrides), midMonth).filter((need) => need.key === 'ask-wrong' || need.key === 'ask-unrated')

  it('one need for the answers marked wrong in the range, worded for one and for several, linking to Marked wrong', () => {
    expect(ratingNeeds({ ratings: [rating('no', 4, 1)] })).toEqual([{ key: 'ask-wrong', page: 'assistant', n: 1, text: 'answer you marked wrong: check the facts it used', hash: 'assistant?rate=wrong' }])
    expect(ratingNeeds({ ratings: [rating('no', 4, 1), rating('no', 1, 2), rating('yes', 2, 3)] })[0]).toMatchObject({ n: 2, text: 'answers you marked wrong: check the facts they used' })
  })

  it('every unrated answer of the last 7 days waits, worded for one and for several, linking to Not rated, and goes once they are rated', () => {
    expect(ratingNeeds({ unratedWeek: [4] })).toEqual([{ key: 'ask-unrated', page: 'assistant', n: 1, text: 'answer from the last 7 days waits for your rating', hash: 'assistant?rate=unrated' }])
    expect(ratingNeeds({ unratedWeek: [4, 5, 6] })[0]).toMatchObject({ n: 3, text: 'answers from the last 7 days wait for your rating' })
    expect(ratingNeeds({ unratedWeek: [] })).toEqual([])
    // Both together, with no countdown to a verdict.
    expect(ratingNeeds({ unratedWeek: [4], ratings: [rating('no', 3)] }).map((need) => need.key)).toEqual(['ask-wrong', 'ask-unrated'])
    expect(badgeCounts(ratingNeeds({ unratedWeek: [4, 5], ratings: [rating('no', 3)] }))).toEqual({ assistant: 3 })
  })

  it('no rating need when the log could not be read', () => {
    expect(ratingNeeds({ log: undefined, unratedWeek: [4], ratings: [rating('no', 3)] })).toEqual([])
  })

  it("the Ask about Steven tile adds '· 72% rated good (25)' once there is a rating, and nothing before", () => {
    const ratings = Array.from({ length: 25 }, (_, i) => rating('yes', i < 18 ? 5 : 3, i + 1))
    expect(computeSummaries(withRatings({ ratings })).assistant).toBe('$1.25 of $25.00 this month · 10 questions · 2 gaps · 0 people asked in 30 days · 72% rated good (25)')
    expect(computeSummaries(withRatings({ ratings: [] })).assistant).toBe('$1.25 of $25.00 this month · 10 questions · 2 gaps · 0 people asked in 30 days')
  })
})
