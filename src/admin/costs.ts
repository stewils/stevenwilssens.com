// The Costs page's pure parts (GET /api/costs → what the page, Needs you, the menu badge and
// the overview tile show), tested in costs.test.ts. Money is in micro-dollars; a sum carries the
// least certain mark of its parts (billed, then estimated, then unknown).
import { formatCost, formatUsd, type CostMark } from './format'
import type { CostFeature, CostLine, CostMoney, CostsInfo } from './types'

export const total = (money: CostMoney) => money.billed + money.estimated + money.unknown
export const markOf = (money: CostMoney): CostMark => (money.unknown > 0 ? 'unknown' : money.estimated > 0 ? 'estimated' : 'billed')
export const costOf = (money: CostMoney) => formatCost(total(money), markOf(money), money.unpriced.length > 0)
export const zero = (): CostMoney => ({ billed: 0, estimated: 0, unknown: 0, unpriced: [] })
export const sum = (items: CostMoney[]): CostMoney => items.reduce<CostMoney>((all, item) => ({
  billed: all.billed + item.billed, estimated: all.estimated + item.estimated, unknown: all.unknown + item.unknown,
  unpriced: [...all.unpriced, ...item.unpriced.filter((entry) => !all.unpriced.some((known) => known.model === entry.model))],
}), zero())

// Over its budget: strictly more than the budget, never equal, never without one.
export const isOver = (feature: CostFeature) => feature.budgetMicro !== null && feature.branch !== null && total(feature.total) > feature.budgetMicro
export const overBudget = (info: CostsInfo | null) => (info ? info.features.filter(isOver).sort((a, b) => (total(b.total) - b.budgetMicro!) - (total(a.total) - a.budgetMicro!)) : [])

// The answer with one budget changed, as the page shows it straight after a save.
export const withBudget = (info: CostsInfo, branch: string, budgetMicro: number | null): CostsInfo => ({
  ...info,
  features: info.features.map((feature) => (feature.branch === branch ? { ...feature, budgetMicro } : feature)),
})

// What Steven types into the budget field: 10, 10.5, $10.50, 10,50. Micro-dollars, or null
// when it is not an amount from a cent to $1,000.
export const parseAmount = (text: string) => {
  const cleaned = text.trim().replace(/^\$\s*/, '').replace(/^(\d+),(\d{1,2})$/, '$1.$2')
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(cleaned)) return null
  const micro = Math.round(Number(cleaned) * 1_000_000)
  return micro > 0 && micro <= 1_000_000_000 ? micro : null
}
export const amountText = (micro: number) => (micro / 1_000_000).toFixed(2)

// A role as the page names it: the team's roles by their title in the team manifest (never typed
// here), "Senior product manager" read as "product manager"; the lead, the two workflows and the
// built-in agents by their own words.
const OWN_NAMES: Record<string, string> = { lead: 'lead', 'review-workflow': 'Review workflow', 'site-update-workflow': 'Site update workflow', 'other-agents': 'Other agents' }
export const roleNamesFrom = (roles: { agent: string | null; title: string }[]) => new Map(roles.filter((role) => role.agent).map((role) => {
  const title = role.title.replace(/^senior\s+/i, '').replace(/\s*\([^)]*\)\s*$/, '')
  return [role.agent!, title.charAt(0).toLowerCase() + title.slice(1)]
}))
export const roleName = (role: string, names: Map<string, string> = new Map()) => (Object.hasOwn(OWN_NAMES, role) ? OWN_NAMES[role] : names.get(role) ?? role.replace(/-/g, ' '))

export const lineName = (line: CostLine) => {
  switch (line.kind) {
    case 'spec': return 'Spec'
    case 'build': return 'Build'
    case 'review': return `Review round ${line.round}`
    case 'fix': return `Fix round ${line.round}`
    case 'site-update': return 'Spec and build (Site update)'
    case 'review-workflow': return `Review workflow, round ${line.round}`
    default: return 'Lead'
  }
}

// Links only from the repository's name, a positive integer and a full SHA (S-10).
const REPO = /^[\w.-]+\/[\w.-]+$/
export const pullLink = (repo: string | null, number: number | null) => (repo && REPO.test(repo) && number !== null && Number.isSafeInteger(number) && number > 0 ? `https://github.com/${repo}/pull/${number}` : null)
export const commitLink = (repo: string | null, sha: string | null) => (repo && REPO.test(repo) && sha && /^[0-9a-f]{40}$/.test(sha) ? `https://github.com/${repo}/commit/${sha}` : null)

// "October 2026" from "2026-10", in UTC like the server counts months.
export const monthTitle = (month: string, style: 'long' | 'short' = 'long') => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', style === 'long' ? { month: 'long', year: 'numeric', timeZone: 'UTC' } : { month: 'short', timeZone: 'UTC' })

// The overview tile and Needs you (AC-20, AC-25, D-8), in the designer's words.
export const costsTile = (info: CostsInfo) => {
  if (info.empty) return 'No costs recorded yet'
  const month = info.months.find((item) => item.month === info.month)?.money ?? zero()
  const over = overBudget(info).length
  const named = info.features.filter((feature) => feature.branch !== null).length
  return `${formatUsd(month.billed)} API key · ${formatCost(month.estimated + month.unknown, month.unknown > 0 ? 'unknown' : 'estimated').text} Max plan this month · ${over > 0 ? `${over} over budget` : `${named} ${named === 1 ? 'feature' : 'features'}`}`
}
