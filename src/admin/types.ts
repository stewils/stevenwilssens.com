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
  month: { questions: number; answered: number; gap: number; off: number; limited: number; failed: number; costMicro: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
  daily: { day: string; outcome: string; questions: number; costMicro: number; msFirst: number; msTotal: number }[]
  votes: { day: string; helpful: number; unhelpful: number }[]
  // Open questions (not yet answered or dismissed in the MCP), and how many were closed in the last 90 days.
  questions: { id: number; ts: number; reason: 'gap' | 'unhelpful' | 'fit'; page: string | null; question: string; answer: string | null; country: string | null; asOrg: string | null }[]
  resolved: { answered: number; dismissed: number }
}

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

// Everything the dashboard has loaded; null until each API has answered.
export type AdminData = { days: number; stats: Stats | null; mcp: McpInfo | null; ask: AskInfo | null; resume: ResumeInfo | null }
