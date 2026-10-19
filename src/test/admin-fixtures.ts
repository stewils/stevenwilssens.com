// Realistic answers from the admin APIs (functions/api/stats.ts, mcp.ts, ask/admin.ts,
// resume.ts, team.ts) and the Team page's build-time manifest, for the dashboard's tests
// (src/admin/*.test.tsx). Each builder takes overrides.
import type { TeamManifest, TeamReads, TeamUpdate } from '../admin/team-types'
import type { AskInfo, McpInfo, ResumeInfo, Stats } from '../admin/types'

// The tests run on a fixed clock: Monday 19 October 2026, noon local time.
export const NOW = new Date(2026, 9, 19, 12, 0, 0)
export const ts = (day: number, hour = 12) => new Date(2026, 9, day, hour, 0, 0).getTime()

export const makeStats = (overrides: Partial<Stats> = {}): Stats => ({
  days: 7,
  generatedAt: NOW.getTime() - 2 * 60_000,
  totals: { pageviews: 120, visitors: 40, avgDurationMs: 95_000, avgScrollPct: 62, bounceRate: 0.35, downloads: 6, downloaders: 5, contactClicks: 3 },
  previous: { pageviews: 100, visitors: 40, downloads: 0, contactClicks: 4 },
  daily: [{ day: '2026-10-18', pageviews: 30, visitors: 10 }, { day: '2026-10-19', pageviews: 20, visitors: 8 }],
  hours: [{ hour: 9, pageviews: 14 }, { hour: 14, pageviews: 21 }],
  pages: [
    { name: '/', views: 80, visitors: 30, avgDurationMs: 40_000, avgScrollPct: 70 },
    { name: '/work', views: 25, visitors: 12, avgDurationMs: null, avgScrollPct: null },
  ],
  entryPages: [{ name: '/', visitors: 30 }],
  clicks: [
    { category: 'download', label: 'Résumé PDF', target: '/steven-wilssens-resume-2026.pdf', context: 'hero', clicks: 6, visitors: 5 },
    { category: 'contact', label: 'Email Steven', target: null, context: null, clicks: 3, visitors: 3 },
  ],
  visitors: [
    { visitor: 'v1', firstSeen: ts(19, 9), lastSeen: ts(19, 10), pageviews: 4, journey: '/ → /work → /about', city: 'Seattle', region: 'Washington', country: 'US', organization: 'Microsoft', browser: 'Edge', os: 'Windows', device: 'desktop', referrer: 'linkedin.com', utmSource: null, channel: 'Social', engagedMs: 180_000, downloaded: 1, clicked: 'Résumé PDF' },
    { visitor: 'v2', firstSeen: ts(18, 8), lastSeen: ts(18, 8), pageviews: 1, journey: '/', city: null, region: null, country: null, organization: null, browser: 'Safari', os: 'iOS', device: 'phone', referrer: null, utmSource: null, channel: 'Direct', engagedMs: null, downloaded: 0, clicked: null },
  ],
  recent: [
    { ts: ts(19, 10), type: 'click', path: '/', category: 'download', label: 'Résumé PDF', durationMs: null, scrollPct: null, referrer: null, city: 'Seattle', country: 'US', organization: 'Microsoft', browser: 'Edge', os: 'Windows', device: 'desktop' },
    { ts: ts(19, 9), type: 'engagement', path: '/work', category: null, label: null, durationMs: 65_000, scrollPct: 80, referrer: null, city: null, country: 'BE', organization: null, browser: 'Chrome', os: 'Android', device: 'phone' },
    { ts: ts(19, 8), type: 'pageview', path: '/', category: null, label: null, durationMs: null, scrollPct: null, referrer: 'google.com', city: null, country: null, organization: null, browser: 'Firefox', os: 'Linux', device: 'desktop' },
    { ts: ts(19, 7), type: 'pageview', path: '/about', category: null, label: null, durationMs: null, scrollPct: null, referrer: null, city: null, country: null, organization: null, browser: 'Firefox', os: 'Linux', device: 'desktop' },
    { ts: ts(19, 6), type: 'click', path: '/', category: null, label: null, durationMs: null, scrollPct: null, referrer: null, city: null, country: null, organization: null, browser: 'Firefox', os: 'Linux', device: 'desktop' },
  ],
  channels: [{ name: 'Social', visitors: 22, pageviews: 70 }, { name: 'Direct', visitors: 18 }],
  referrers: [{ name: 'linkedin.com', visitors: 20, detail: 'social' }],
  utmSources: [],
  utmCampaigns: [],
  countries: [{ name: 'United States', visitors: 30 }, { name: 'Belgium', visitors: 10 }],
  cities: [{ name: 'Seattle', visitors: 20 }],
  organizations: [{ name: 'Unknown', visitors: 25 }, { name: 'Microsoft', visitors: 9 }],
  browsers: [{ name: 'Chrome', visitors: 20 }],
  systems: [{ name: 'Windows', visitors: 18 }],
  devices: [{ name: 'desktop', visitors: 28 }],
  languages: [{ name: 'en-US', visitors: 35 }],
  screens: [{ name: '1920x1080', visitors: 15 }],
  vitals: {
    metrics: [
      { metric: 'TTFB', p75: 2100, samples: 40, good: 0.5, needsImprovement: 0.2, poor: 0.3 },
      { metric: 'LCP', p75: 1800, samples: 40, good: 0.9, needsImprovement: 0.05, poor: 0.05 },
      { metric: 'CLS', p75: 0.15, samples: 40, good: 0.7, needsImprovement: 0.2, poor: 0.1 },
    ],
    pages: [{ path: '/', LCP: 1800, CLS: 0.3, INP: 120 } as unknown as { path: string } & Record<string, number>],
    devices: [
      { device: 'desktop', visits: 30, passes: true, LCP: 1500, INP: 80, CLS: 0.02 },
      { device: 'phone', visits: 10, passes: false, LCP: 4200 },
      { device: 'tablet', visits: 1, passes: null },
    ],
    culprits: [{ metric: 'LCP', path: '/', target: 'img.hero', samples: 4, p75: 4500 }],
  },
  crawlTotals: { requests: 50, bots: 4, search: 20, ai: 15, assistant: 5, other: 10, errors: 2, probes: 30 },
  crawlDaily: [{ day: '2026-10-19', requests: 12, search: 5, ai: 4 }],
  crawlBots: [
    { bot: 'Googlebot', operator: 'Google', category: 'search', requests: 20, pages: 10, lastSeen: ts(19, 9), errors: 0, networks: 1, network: 'Google LLC' },
    { bot: 'ChatGPT-User', operator: 'OpenAI', category: 'ai-assistant', requests: 5, pages: 3, lastSeen: ts(19, 8), errors: 2, networks: 3, network: null },
  ],
  crawlPages: [{ path: '/', requests: 30, search: 10, ai: 10, assistant: 5, bots: 4, status: 200 }, { path: '/old', requests: 2, search: 2, ai: 0, assistant: 0, bots: 1, status: 404 }],
  crawlRecent: [{ ts: ts(19, 9), bot: 'Googlebot', category: 'search', path: '/', status: 200, country: 'US', network: 'Google LLC' }],
  ...overrides,
})

export const makeMcp = (overrides: Partial<McpInfo> = {}): McpInfo => ({
  ownerUrl: 'https://steven.wilssens.com/mcp/secret-owner-key',
  publicUrl: 'https://steven.wilssens.com/mcp',
  entries: { total: 42, public: 9, roles: 7 },
  proposals: [
    { id: 1, updatedAt: ts(18), role: 'csx-data', field: 'point', kind: 'replace', currentText: 'Led the team', proposedText: 'Led 12 product managers', rationale: 'Adds the team size', status: 'proposed', decisionNote: null },
    { id: 2, updatedAt: ts(17), role: 'profile', field: 'headline', kind: 'add', currentText: null, proposedText: 'Product leader', rationale: 'Sharper', status: 'approved', decisionNote: 'Yes, go' },
    { id: 3, updatedAt: ts(16), role: 'old-role', field: null, kind: 'remove', currentText: 'An old bullet', proposedText: null, rationale: 'Too old', status: 'rejected', decisionNote: null },
  ],
  publicCalls: {
    days: 30,
    total: 7,
    byTool: [{ tool: 'about_steven', calls: 4 }, { tool: 'check_fit', calls: 3 }],
    recent: [
      { ts: ts(19, 9), tool: 'check_fit', query: 'Senior PM, data platform', country: 'US', asOrg: 'Amazon' },
      { ts: ts(18, 9), tool: 'about_steven', query: null, country: null, asOrg: null },
    ],
  },
  ...overrides,
})

export const makeAsk = (overrides: Partial<AskInfo> = {}): AskInfo => ({
  configured: true,
  mock: false,
  model: 'claude-sonnet',
  budgetUsd: 25,
  humanCheck: true,
  check: { state: 'standby', why: null, lastHour: 2, spentTodayMicro: 100_000, afterMicro: 1_000_000 },
  month: { questions: 30, answered: 24, gap: 4, off: 2, limited: 1, failed: 0, costMicro: 5_000_000, inputTokens: 3000, outputTokens: 2000, cacheReadTokens: 1000, cacheWriteTokens: 500 },
  daily: [
    { day: '2026-10-19', outcome: 'answered', questions: 3, costMicro: 300_000, msFirst: 3600, msTotal: 9000 },
    { day: '2026-10-19', outcome: 'gap', questions: 1, costMicro: 100_000, msFirst: 1200, msTotal: 4000 },
    { day: '2026-10-18', outcome: 'off', questions: 2, costMicro: 50_000, msFirst: 500, msTotal: 900 },
  ],
  votes: [{ day: '2026-10-19', helpful: 4, unhelpful: 1 }, { day: '2026-10-18', helpful: 1, unhelpful: 0 }],
  questions: [
    { id: 11, ts: ts(19, 9), reason: 'gap', page: '/', question: 'Has Steven managed managers?', answer: 'The dossier does not say.', country: 'US', asOrg: 'Google' },
    { id: 12, ts: ts(18, 9), reason: 'fit', page: null, question: 'Kubernetes experience', answer: null, country: null, asOrg: null },
  ],
  resolved: { answered: 3, dismissed: 1 },
  ...overrides,
})

export const makeResume = (overrides: Partial<ResumeInfo> = {}): ResumeInfo => ({
  report: {
    score: 95,
    errors: 0,
    warnings: 1,
    ats: { errors: 0, warnings: 1 },
    pages: 2,
    bytes: 120_000,
    matchesSite: true,
    checkedAt: '2026-10-19T08:00:00Z',
    commitMessage: 'Sharper headline',
    findings: [
      { severity: 'warn', lens: 'ats', id: 'keyword-sql', message: 'The keyword SQL is missing' },
      { severity: 'warn', lens: 'recruiter', id: 'tense', message: 'Present tense in a past role' },
      { severity: 'error', id: 'legacy', message: 'A legacy finding without a lens' },
      { severity: 'info', lens: 'site', id: 'note-1', message: 'A reworded bullet' },
    ],
    questions: [{ about: 'dates', question: 'What happened between 2019 and 2020?' }],
    baseline: { source: 'https://steven.wilssens.com/resume-report.json', score: 90, change: 5, lower: false, verdict: 'higher' },
  },
  history: [
    { pdfHash: 'b', score: 95, errors: 0, warnings: 1, pages: 2, bytes: 120_000, commit: 'abcdef1234567', commitMessage: 'Sharper headline', findings: [{ severity: 'warn', id: 'kw', message: 'Keyword missing' }, { severity: 'odd', id: 'x', message: 'Odd severity' }], checkedAt: ts(19), firstSeen: ts(19) },
    { pdfHash: 'a', score: 100, errors: 0, warnings: 2, pages: 2, bytes: 2_500_000, commit: null, commitMessage: null, findings: [], checkedAt: ts(10), firstSeen: ts(10) },
    { pdfHash: 'c', score: 80, errors: 1, warnings: 0, pages: 1, bytes: 90_000, commit: null, commitMessage: null, findings: [], checkedAt: ts(5), firstSeen: ts(5) },
  ],
  ...overrides,
})

// The Team page's manifest (scripts/team-manifest.mjs), with made-up roles, jobs and steps so
// the tests prove the page shows what the manifest says, not text typed into a component.
// Three updates, newest first: the newest two are from the launch on (unread with no D1
// rows), the oldest is from before it (read).
export const sha = (digit: string) => digit.repeat(40)
// Update dates at 09:00 in the machine's own time zone, like NOW: the day shown is the same in every zone.
const morningOf = (day: number) => new Date(2026, 9, day, 9).toISOString()
export const makeUpdate = (overrides: Partial<TeamUpdate> = {}): TeamUpdate => ({ sha: sha('3'), date: morningOf(19), summary: 'The panel reviews every draft', pr: 41, sections: ['flow', 'checks'], roles: [], commands: [], steps: ['draft'], removedSteps: [], beforeLaunch: false, ...overrides })
export const makeTeamManifest = (overrides: Partial<TeamManifest> = {}): TeamManifest => ({
  schema: 'team-manifest/1',
  repo: 'https://github.com/example/site',
  commit: sha('c'),
  generatedAt: new Date(2026, 9, 19, 10).toISOString(),
  launch: sha('2'),
  files: ['.team/flow.md', '.team/agents/chief-editor.md', '.team/agents/fact-checker.md', '.team/commands/publish.md', '.ci/panel.yml', '.ci/site.yml', 'scripts/proof-gate.mjs', 'RULES.md'],
  flow: {
    file: '.team/flow.md',
    steps: [
      { n: 1, id: 'intake', title: 'Intake', who: 'lead', text: 'Restate the ask.', people: ['lead'], checks: [] },
      { n: 2, id: 'draft', title: 'Draft', who: 'chief-editor', text: 'Write the draft.', people: ['chief-editor'], checks: [] },
      { n: 3, id: 'questions', title: 'Questions', who: null, text: 'Ask the owner once.', people: [], checks: [] },
      { n: 4, id: 'publish', title: 'Publish', who: null, text: 'The proof and panel jobs pass.', people: [], checks: ['proof', 'panel'] },
    ],
    diagram: {
      nodes: [
        { id: 'ask', label: 'The owner asks', shape: 'start', members: [], steps: [1], lane: 'you', gate: false, next: [{ to: 'draft', label: null }], loop: null },
        { id: 'draft', label: 'Draft: drafts/slug.md', shape: 'group', members: [{ label: 'Editor', via: null }, { label: 'Proofreader', via: null }, { label: 'Lawyer: risks', via: 'adds' }], steps: [2], lane: 'team', gate: true, next: [{ to: 'check', label: null }], loop: null },
        { id: 'check', label: 'Questions only the owner can answer?', shape: 'decision', members: [], steps: [3], lane: 'team', gate: false, next: [{ to: 'answer', label: 'yes, asked once' }, { to: 'publish', label: 'no' }], loop: null },
        { id: 'answer', label: 'The owner answers', shape: 'start', members: [], steps: [], lane: 'you', gate: false, next: [{ to: 'redo', label: null }], loop: null },
        { id: 'redo', label: 'Editor fixes', shape: 'box', members: [], steps: [], lane: 'team', gate: false, next: [], loop: { to: 'draft', label: 'changes requested, twice at most' } },
        { id: 'publish', label: 'Publish to the site', shape: 'box', members: [], steps: [4], lane: 'team', gate: true, next: [], loop: null },
      ],
    },
  },
  sections: {
    roles: {
      file: '.team/flow.md',
      items: [
        { id: 'lead', title: 'Lead (the session)', agent: null, owns: 'the flow', signsOff: 'nothing alone', description: '', headings: [], file: null },
        { id: 'chief-editor', title: 'Chief editor', agent: 'chief-editor', owns: 'the draft', signsOff: 'the draft', description: 'Writes the draft from the ask.', headings: ['Writing', 'Checking'], file: '.team/agents/chief-editor.md' },
        { id: 'fact-checker', title: 'Fact checker', agent: 'fact-checker', owns: 'the facts', signsOff: 'the merge', description: 'Checks every fact against its source. '.repeat(10).trim(), headings: [], file: '.team/agents/fact-checker.md' },
      ],
    },
    checks: {
      file: '.ci/panel.yml',
      jobs: [{ key: 'proof', name: null, needs: [], steps: ['Spell check', 'Build'] }, { key: 'panel', name: 'The panel', needs: ['proof'], steps: ['Panel reviews'] }],
      levels: [{ level: 'stop', meaning: 'must not publish.' }, { level: 'note', meaning: 'optional.' }],
      scripts: ['scripts/proof-gate.mjs'],
      protection: 'Protection on main requires proof and panel.',
    },
    commands: { items: [{ id: 'publish', name: 'publish', description: 'Run the editors on an ask.', hint: '<the ask>', file: '.team/commands/publish.md' }] },
    siteUpdate: { file: '.ci/site.yml', steps: [{ name: 'Let the editor write', lines: ['Draft first.', 'Then the panel.'], tools: ['Read', 'Edit'] }] },
    rules: { file: 'RULES.md', heading: 'The editors', paragraphs: ['Every draft goes through the editors.', 'The panel signs off; a reply never clears a stop.'] },
  },
  history: {
    updates: [
      makeUpdate(),
      makeUpdate({ sha: sha('2'), date: morningOf(18), summary: 'The Team page shows the team', pr: null, sections: ['roles'], roles: ['fact-checker'], steps: [] }),
      makeUpdate({ sha: sha('1'), date: morningOf(12), summary: 'The editors review every change', pr: null, sections: ['commands'], commands: ['publish'], steps: [], beforeLaunch: true }),
    ],
    older: 0,
    truncated: false,
  },
  problems: [],
  ...overrides,
})

export const makeTeamReads = (overrides: Partial<TeamReads> = {}): TeamReads => ({ read: [], unread: [], ...overrides })
