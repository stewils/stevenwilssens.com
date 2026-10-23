import type { ReactNode } from 'react'

// The dashboard's pages: one per area, chosen by the URL hash (#traffic, #resume, …),
// listed in the menu on the left and as tiles on the overview. `range` pages react to
// the 7/30/90-day switch.
export type PageId = 'overview' | 'traffic' | 'sources' | 'audience' | 'crawlers' | 'speed' | 'resume' | 'assistant' | 'mcp' | 'team' | 'costs' | 'links'
// badgeNote says what the menu badge counts, for screen readers ("Team, 2 not seen").
export type PageDef = { id: PageId; title: string; sub: string; range: boolean; icon: ReactNode; badgeNote?: string }

const icon = (d: string) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>

export const pages: PageDef[] = [
  { id: 'overview', title: 'Overview', sub: 'The headline numbers and what needs you', range: true, icon: icon('M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z') },
  { id: 'traffic', title: 'Traffic', sub: 'Visitors by day and hour, who they were, the pages they read and what they clicked', range: true, icon: icon('M3 20h18v2H3zM5 10h3v8H5zm5-6h3v14h-3zm5 9h3v5h-3z') },
  { id: 'sources', title: 'Sources', sub: 'Where visitors come from: channels, referrers, campaigns and your tracking links', range: true, icon: icon('M3 4h18v2.5L14 14v6l-4 2v-8L3 6.5z') },
  { id: 'audience', title: 'Audience', sub: 'Organizations, places, devices and browsers', range: true, icon: icon('M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.5 2.2A8 8 0 0 0 4.1 11h3.4c.1-2.6.9-5 2-6.8zm3 0c1.1 1.8 1.9 4.2 2 6.8h3.4a8 8 0 0 0-5.4-6.8zM9.5 11h5c-.1-2.4-1-4.6-2.5-6.3-1.5 1.7-2.4 3.9-2.5 6.3zm-5.4 2a8 8 0 0 0 6.4 6.8c-1.1-1.8-1.9-4.2-2-6.8zm5.4 0c.1 2.4 1 4.6 2.5 6.3 1.5-1.7 2.4-3.9 2.5-6.3zm7 0c-.1 2.6-.9 5-2 6.8a8 8 0 0 0 5.4-6.8z') },
  { id: 'crawlers', title: 'Crawlers', sub: 'Search engines and AI reading the site', range: true, icon: icon('M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z') },
  { id: 'speed', title: 'Page speed', sub: "Core Web Vitals, measured in visitors' browsers", range: true, icon: icon('M12 4a9 9 0 0 0-7.8 13.5h15.6A9 9 0 0 0 12 4zm0 2a7 7 0 0 1 6.3 9.5h-2.2a4 4 0 0 0-1.7-3.3l1.3-3.1-1.8-.8-1.3 3.1a4 4 0 0 0-4.7 3.1H5.7A7 7 0 0 1 12 6z') },
  { id: 'resume', title: 'Résumé', sub: 'The ATS score, what to fix, the proposals from Claude, and how the score moved with every update', range: false, icon: icon('M6 2h8l5 5v15H6zm7 1.5V8h4.5zM8 12h8v2H8zm0 4h8v2H8z') },
  { id: 'assistant', title: 'Ask about Steven', sub: 'The assistant on the site: use, cost, the questions the dossier could not answer, and your ratings of its answers', range: true, icon: icon('M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm7 9v2h2v-2zm1-7a3 3 0 0 0-3 3h2a1 1 0 1 1 1 1h-1v2h2v-.2A3 3 0 0 0 12 6z') },
  { id: 'mcp', title: 'Career MCP', sub: 'Your private workspace in Claude: the link to add and the dossier it keeps', range: false, icon: icon('M9 2h2v4h2V2h2v4h2v4a5 5 0 0 1-4 4.9V22h-2v-7.1A5 5 0 0 1 7 10V6h2z') },
  { id: 'team', title: 'Team', sub: 'The agents that write, build and review every change: the roles, the flow, the gates and the commands, read from the repository at each build.', range: false, badgeNote: 'not seen', icon: icon('M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm1.13 1.1A6.9 6.9 0 0 0 4 14c-.99 0-1.93.21-2.78.58A2 2 0 0 0 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0 0 20 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24zM12 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6z') },
  // A receipt: what each change cost to build with Claude.
  { id: 'costs', title: 'Costs', sub: 'What each change costs to build: per feature and phase, per agent role, per month, the waste, and your budgets', range: false, badgeNote: 'over budget', icon: icon('M5 2h14v20l-2.33-1.5L14.33 22 12 20.5 9.67 22l-2.34-1.5L5 22zm3 5v2h8V7zm0 4v2h8v-2zm0 4v2h5v-2z') },
  { id: 'links', title: 'Links', sub: 'Every address for running the site: Cloudflare, GitHub, the résumé files and outside checks', range: false, icon: icon('M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zM8 21a5 5 0 0 1-3.5-8.5l2.8-2.8a1 1 0 1 1 1.4 1.4l-2.8 2.8a3 3 0 0 0 4.2 4.2l2.8-2.8a1 1 0 1 1 1.4 1.4l-2.8 2.8A5 5 0 0 1 8 21zm9.3-7.3a1 1 0 0 1-.7-1.7l2.8-2.8a3 3 0 0 0-4.2-4.2l-2.8 2.8a1 1 0 1 1-1.4-1.4l2.8-2.8a5 5 0 0 1 7 7L18 13.4a1 1 0 0 1-.7.3z') },
]

export const pageById = (id: string) => pages.find((page) => page.id === id)
