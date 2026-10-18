import { describe, expect, it } from 'vitest'
import { badgeCounts, computeNeeds, computeSummaries } from './needs'
import type { AdminData, AskInfo, McpInfo, ResumeInfo, Stats } from './types'

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
    expect(summaries.resume).toBe('Score 85/100 · 2 pages · 3 warnings · lower than the live résumé before')
    expect(summaries.assistant).toBe('$1.25 of $25.00 this month · 10 questions · 2 gaps')
    expect(summaries.mcp).toBe('40 dossier entries across 6 roles · 8 public · 12 public calls')
    expect(computeSummaries({ days: 30, stats: null, mcp: null, ask: null, resume: { report: null, history: [] } }).resume).toBe('No résumé report in this deployment')
  })
})
