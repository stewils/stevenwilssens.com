import { describe, expect, it } from 'vitest'
import { makeCosts, makeFeature, money } from '../test/admin-fixtures'
import { amountText, commitLink, costOf, costsTile, isOver, lineName, roleNamesFrom, markOf, monthTitle, overBudget, parseAmount, pullLink, roleName, sum, total, withBudget } from './costs'

describe('a sum of money', () => {
  it('takes the least certain mark of its parts and keeps unpriced models once', () => {
    expect(markOf(money(1))).toBe('billed')
    expect(markOf(money(1, 2))).toBe('estimated')
    expect(markOf(money(1, 2, 3))).toBe('unknown')
    expect(markOf(money(0))).toBe('billed')
    const all = sum([money(1, 0, 0, [{ model: 'x', tokens: 5 }]), money(0, 2, 0, [{ model: 'x', tokens: 7 }, { model: 'y', tokens: 1 }])])
    expect(all).toEqual({ billed: 1_000_000, estimated: 2_000_000, unknown: 0, unpriced: [{ model: 'x', tokens: 5 }, { model: 'y', tokens: 1 }] })
    expect(total(all)).toBe(3_000_000)
    expect(costOf(all)).toEqual({ text: '≈$3.00+', words: 'estimated $3.00, plus unpriced runs' })
  })
})

describe('budgets', () => {
  it('is over only above the budget: not at it, not without one, never No feature', () => {
    expect(isOver(makeFeature({ total: money(10.01), budgetMicro: 10_000_000 }))).toBe(true)
    expect(isOver(makeFeature({ total: money(10), budgetMicro: 10_000_000 }))).toBe(false)
    expect(isOver(makeFeature({ total: money(5), budgetMicro: 10_000_000 }))).toBe(false)
    expect(isOver(makeFeature({ total: money(50), budgetMicro: null }))).toBe(false)
    expect(isOver(makeFeature({ branch: null, total: money(50), budgetMicro: 1 }))).toBe(false)
  })

  it('lists the features over budget, the most over first, and none without data', () => {
    const info = makeCosts({ features: [makeFeature({ branch: 'a', total: money(11), budgetMicro: 10_000_000 }), makeFeature({ branch: 'b', total: money(30), budgetMicro: 10_000_000 }), makeFeature({ branch: 'c', total: money(1), budgetMicro: 10_000_000 })] })
    expect(overBudget(info).map((feature) => feature.branch)).toEqual(['b', 'a'])
    expect(overBudget(null)).toEqual([])
  })

  it('changes one feature’s budget in place', () => {
    const info = withBudget(makeCosts(), 'dev-costs', null)
    expect(info.features[0].budgetMicro).toBeNull()
    expect(info.features[1].budgetMicro).toBeNull()
    expect(withBudget(makeCosts(), 'resume-mail', 3_000_000).features[1].budgetMicro).toBe(3_000_000)
  })

  it('reads 10, 10.5, $10.50 and 10,50, and refuses zero, negative, words and more than $1,000', () => {
    expect(['10', '10.5', '$10.50', '$ 10.50', '10,50', ' 7 ', '1000'].map(parseAmount)).toEqual([10_000_000, 10_500_000, 10_500_000, 10_500_000, 10_500_000, 7_000_000, 1_000_000_000])
    for (const text of ['0', '0.00', '-1', 'abc', '1000.01', '10.505', '', '1e3', '12,345']) expect(parseAmount(text), text).toBeNull()
    expect(amountText(10_500_000)).toBe('10.50')
  })
})

describe('words and links', () => {
  it('names the team’s roles from their titles in the manifest, and the lead, the workflows and the other agents in its own words', () => {
    const names = roleNamesFrom([
      { agent: 'product-manager', title: 'Senior product manager' }, { agent: 'senior-recruiter', title: 'Senior recruiter' }, { agent: 'ux-designer', title: 'Senior designer (UX)' },
      { agent: 'senior-developer', title: 'Senior developer' }, { agent: 'security-engineer', title: 'Senior security engineer' }, { agent: 'senior-tester', title: 'Senior tester' }, { agent: null, title: 'Lead (the main Claude session)' },
    ])
    expect(['product-manager', 'senior-recruiter', 'ux-designer', 'senior-developer', 'security-engineer', 'senior-tester', 'lead', 'review-workflow', 'site-update-workflow', 'other-agents', 'some-agent', 'constructor'].map((role) => roleName(role, names))).toEqual(['product manager', 'recruiter', 'designer', 'developer', 'security engineer', 'tester', 'lead', 'Review workflow', 'Site update workflow', 'Other agents', 'some agent', 'constructor'])
    expect(roleName('senior-tester')).toBe('senior tester')
    const line = (kind: Parameters<typeof lineName>[0]['kind'], round = 0) => lineName({ kind, round, pr: null, at: 0, money: money(0), roles: [] })
    expect([line('spec'), line('build'), line('review', 2), line('fix', 1), line('site-update'), line('review-workflow', 3), line('lead')]).toEqual(['Spec', 'Build', 'Review round 2', 'Fix round 1', 'Spec and build (Site update)', 'Review workflow, round 3', 'Lead'])
  })

  it('builds links only from the repository, a positive number and a full SHA', () => {
    expect(pullLink('stewils/stevenwilssens.com', 61)).toBe('https://github.com/stewils/stevenwilssens.com/pull/61')
    expect(commitLink('stewils/stevenwilssens.com', 'a'.repeat(40))).toBe(`https://github.com/stewils/stevenwilssens.com/commit/${'a'.repeat(40)}`)
    for (const link of [pullLink(null, 1), pullLink('x', 1), pullLink('a/b', 0), pullLink('a/b', 1.5), pullLink('a/b', null), pullLink('javascript:alert(1)//a/b', 1), commitLink('a/b', 'abc'), commitLink('a/b', null), commitLink('a/b"><x', 'a'.repeat(40))]) expect(link).toBeNull()
  })

  it('names a month in UTC', () => {
    expect(monthTitle('2026-10')).toBe('October 2026')
    expect(monthTitle('2026-09', 'short')).toBe('Sep')
  })
})

describe('the overview tile', () => {
  it('reads this month by how it was paid, and the features over budget or the count', () => {
    expect(costsTile(makeCosts())).toBe('$12.00 API key · ≈$29.20 Max plan this month · 1 over budget')
    expect(costsTile(makeCosts({ features: [makeFeature({ budgetMicro: null })] }))).toBe('$12.00 API key · ≈$29.20 Max plan this month · 1 feature')
    expect(costsTile(makeCosts({ features: [makeFeature({ budgetMicro: null }), makeFeature({ branch: 'b', budgetMicro: null }), makeFeature({ branch: null })] }))).toBe('$12.00 API key · ≈$29.20 Max plan this month · 2 features')
    expect(costsTile(makeCosts({ empty: true, features: [] }))).toBe('No costs recorded yet')
    expect(costsTile(makeCosts({ month: '2027-01' }))).toBe('$0.00 API key · — Max plan this month · 1 over budget')
  })
})
