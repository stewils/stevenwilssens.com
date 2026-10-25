import type { Criterion, Scores } from '../../functions/_lib/ask/rating'
import type { TeamManifest, TeamReads } from './team-types'

// What the admin APIs return. functions/api/stats.ts, functions/api/mcp.ts,
// functions/api/ask/admin.ts and functions/api/resume.ts write these shapes.

export type Row = { name: string; visitors: number; pageviews?: number; detail?: string }
export type PageRow = { name: string; views: number; visitors: number; avgDurationMs: number | null; avgScrollPct: number | null }
export type ClickRow = { category: string; label: string; target: string | null; context: string | null; clicks: number; visitors: number }
export type VisitorRow = {
  visitor: string; firstSeen: number; lastSeen: number; pageviews: number; journey: string; city: string | null; region: string | null; country: string | null
  organization: string | null; browser: string; os: string; device: string; referrer: string | null; utmSource: string | null; channel: string; engagedMs: number | null; downloaded: number; clicked: string | null
}
export type RecentRow = {
  ts: number; type: string; path: string | null; category: string | null; label: string | null; durationMs: number | null; scrollPct: number | null
  referrer: string | null; city: string | null; country: string | null; organization: string | null; browser: string; os: string; device: string
}
export type VitalSummary = { metric: string; p75: number; samples: number; good: number; needsImprovement: number; poor: number }
export type DeviceVitals = { device: string; visits: number; passes: boolean | null } & Partial<Record<'LCP' | 'INP' | 'CLS', number>>
export type VitalCulprit = { metric: string; path: string; target: string; samples: number; p75: number }
export type CrawlCategory = 'search' | 'ai-search' | 'ai-training' | 'ai-assistant' | 'social' | 'seo' | 'other'
export type CrawlBot = { bot: string; operator: string | null; category: CrawlCategory; requests: number; pages: number; lastSeen: number; errors: number; networks: number; network: string | null }
export type CrawlPage = { path: string; requests: number; search: number; ai: number; assistant: number; bots: number; status: number }
export type CrawlHit = { ts: number; bot: string; category: CrawlCategory; path: string; status: number; country: string | null; network: string | null }
export type Crawls = {
  crawlTotals: { requests: number; bots: number; search: number; ai: number; assistant: number; other: number; errors: number; probes: number }
  crawlDaily: { day: string; requests: number; search: number; ai: number }[]
  crawlBots: CrawlBot[]
  crawlPages: CrawlPage[]
  crawlRecent: CrawlHit[]
}
export type Stats = Crawls & {
  days: number
  generatedAt: number
  totals: { pageviews: number; visitors: number; avgDurationMs: number | null; avgScrollPct: number | null; bounceRate: number | null; downloads: number; downloaders: number; contactClicks: number }
  // The same counts for the period before this one, for the "vs the 30 days before" lines.
  previous: { pageviews: number; visitors: number; downloads: number; contactClicks: number }
  daily: { day: string; pageviews: number; visitors: number }[]
  hours: { hour: number; pageviews: number }[]
  pages: PageRow[]
  entryPages: Row[]
  clicks: ClickRow[]
  visitors: VisitorRow[]
  recent: RecentRow[]
  channels: Row[]
  vitals: { metrics: VitalSummary[]; pages: ({ path: string } & Record<string, number>)[]; devices: DeviceVitals[]; culprits: VitalCulprit[] }
} & Record<'referrers' | 'utmSources' | 'utmCampaigns' | 'countries' | 'cities' | 'organizations' | 'browsers' | 'systems' | 'devices' | 'languages' | 'screens', Row[]>

export type Proposal = { id: number; updatedAt: number; role: string; field?: string | null; kind: 'replace' | 'add' | 'remove'; currentText: string | null; proposedText: string | null; rationale: string; status: 'proposed' | 'approved' | 'rejected' | 'applied'; decisionNote: string | null }
export type PublicCall = { ts: number; tool: string; query: string | null; country: string | null; asOrg: string | null }
export type McpInfo = {
  ownerUrl: string | null
  publicUrl: string
  entries: { total: number; public: number; roles: number }
  proposals: Proposal[]
  // The read-only server at /mcp: calls in the range, per tool, and the latest ones.
  publicCalls: { days: number; total: number; byTool: { tool: string; calls: number }[]; recent: PublicCall[] }
}

export type AskInfo = {
  configured: boolean
  mock: boolean
  model: string
  budgetUsd: number
  humanCheck: boolean
  // The Turnstile check right now: off (no keys), standby (a quiet day, nobody is asked) or on, and why.
  check?: { state: 'off' | 'standby' | 'on'; why: 'spend' | 'connection' | 'everyone' | null; lastHour: number; spentTodayMicro: number; afterMicro: number }
  month: { questions: number; answered: number; gap: number; off: number; limited: number; failed: number; costMicro: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
  daily: { day: string; outcome: string; questions: number; costMicro: number; msFirst: number; msTotal: number }[]
  votes: { day: string; helpful: number; unhelpful: number }[]
  // Open questions (not yet answered or dismissed in the MCP), and how many were closed in the last 90 days.
  questions: { id: number; ts: number; reason: 'gap' | 'unhelpful' | 'fit' | 'rated'; page: string | null; question: string; answer: string | null; country: string | null; asOrg: string | null }[]
  resolved: { answered: number; dismissed: number }
  // Every question in the range (kept 90 days), newest first, with the analytics' visitor code of the day.
  log?: AskLogEntry[]
  // The days the log covers (at most 90), and whether it stopped at its row limit.
  logDays?: number
  logCapped?: boolean
  // Steven's ratings of the answers whose day is in the range (pruned answers' included), and
  // the rateable answers of the last seven days without one (Needs you).
  ratings?: AskRating[]
  unratedWeek?: number[]
}
// One question as the log has it, with what produced its answer (null before the versions
// were recorded), the sources it cited from the site's own data (title null: no longer in
// it), its rating, and whether the answer is cut (the whole one comes from ?entry=).
export type AskSource = { id: string; title: string | null; href: string | null }
export type AskLogEntry = {
  id: number; ts: number; visitor: string; kind: 'question' | 'fit'; page: string | null; question: string; answer: string | null; outcome: 'answered' | 'gap' | 'off' | 'limited' | 'failed'; country: string | null; asOrg: string | null
  model?: string | null; fallback?: boolean | null; promptVersion?: string | null; knowledgeVersion?: string | null; sources?: AskSource[]; rating?: AskRating | null; cut?: boolean
}
// The rubric's shapes, as functions/_lib/ask/rating.ts checks them.
export type { Criterion }
export type AskScores = Scores
export type AskRating = AskScores & { id: number; logId: number | null; day: string; model: string | null; fallback: boolean | null; promptVersion: string | null; knowledgeVersion: string | null; kind: 'question' | 'fit'; outcome: AskLogEntry['outcome']; note: string | null; questionId: number | null; ratedAt: number }
// What Steven sends to POST /api/ask/rating.
export type RatingDraft = AskScores & { id: number; note: string | null; addToQuestions: boolean }

// The résumé report the build writes (scripts/resume-check.mjs) and the score history
// functions/_lib/resume-scores.ts keeps.
// The lens a finding belongs to: only `ats` findings make the score (the ATS score).
export type Lens = 'ats' | 'site' | 'recruiter'
export type Finding = { severity: 'error' | 'warn' | 'info'; lens?: Lens; id: string; message: string }
export type ResumeReport = {
  exists?: boolean; score: number; errors?: number; warnings?: number; ats?: { errors: number; warnings: number }; pages?: number; bytes?: number; title?: string | null; matchesSite?: boolean; checkedAt?: string
  pdfHash?: string; commit?: string | null; commitMessage?: string | null
  findings: Finding[]
  questions: { about: string; question: string }[]
  baseline?: { source: string; score: number; change: number; lower: boolean; verdict: 'lower' | 'higher' | 'unchanged'; checkedAt?: string | null } | null
}
export type ScoreRow = { pdfHash: string; score: number; errors: number; warnings: number; pages: number; bytes: number; commit: string | null; commitMessage: string | null; findings: { severity: string; id: string; message: string }[]; checkedAt: number; firstSeen: number }
export type ResumeInfo = { report: ResumeReport | null; history: ScoreRow[] }

// The Team page: the manifest from the build, and what Steven has seen (null until
// /api/team answers, or when it failed: then readsError says why).
export type TeamData = { manifest: TeamManifest; reads: TeamReads | null; readsError: string }

// Everything the dashboard has loaded; null until each API has answered.
export type AdminData = { days: number; stats: Stats | null; mcp: McpInfo | null; ask: AskInfo | null; resume: ResumeInfo | null; team?: TeamData; costs?: CostsData }

// GET /api/costs (functions/_lib/costs/views.ts writes this shape): what each change cost to
// build with Claude, in micro-dollars, kept apart by how sure each figure is.
export type CostMoney = { billed: number; estimated: number; unknown: number; unpriced: { model: string; tokens: number }[] }
export type CostPull = { state: 'open' | 'merged' | 'closed' | 'superseded' | 'none' | 'unknown'; number: number | null; mergeCommit: string | null; supersededBy: number | null }
export type CostLine = { kind: 'spec' | 'build' | 'review' | 'fix' | 'lead' | 'site-update' | 'review-workflow'; round: number; pr: number | null; at: number; money: CostMoney; roles: { role: string; money: CostMoney }[] }
export type CostFeature = {
  branch: string | null; pull: CostPull | null; runs: number; firstRunAt: number; lastRunAt: number
  spec: CostMoney; build: CostMoney; review: CostMoney; fix: CostMoney; lead: CostMoney; total: CostMoney
  reviewRounds: number; fixRounds: number; budgetMicro: number | null; phases: CostLine[]; tokensIn: number; tokensOut: number
  waste: { money: CostMoney; fixRounds: number; moreReviews: number; closed: boolean; redoneBy: number | null }
}
export type CostRole = { role: string; kind: 'team' | 'lead' | 'workflow' | 'other'; runs: number; total: CostMoney; share: number; perFeatureMicro: number; byPhase: Record<'spec' | 'build' | 'review' | 'fix' | 'lead', CostMoney> }
export type CostMonth = { month: string; money: CostMoney; features: number; wasteMicro: number }
export type CostDay = { day: string; money: CostMoney; features: number; started: number; startedTotal: CostMoney }
export type CostsInfo = {
  generatedAt: number; empty: boolean; month: string; repo: string | null; pricesRead: string
  features: CostFeature[]; roles: CostRole[]; months: CostMonth[]; days: CostDay[]; waste: { fix: CostMoney; reviews: CostMoney; closed: CostMoney }
}
// The Costs page's data and why it is missing, when it is.
export type CostsData = { info: CostsInfo | null; error: string }
