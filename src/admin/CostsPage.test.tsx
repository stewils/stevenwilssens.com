import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeCosts, makeFeature, money, NOW } from '../test/admin-fixtures'
import { roleNamesFrom } from './costs'
import { CostsError, CostsPage, type BudgetSave } from './CostsPage'
import type { CostsInfo } from './types'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const saved: BudgetSave = async () => ({ ok: true })
// The team's roles as the manifest titles them (the page never types them).
const names = roleNamesFrom(['product-manager:Senior product manager', 'senior-recruiter:Senior recruiter', 'ux-designer:Senior designer (UX)', 'senior-developer:Senior developer', 'security-engineer:Senior security engineer', 'senior-tester:Senior tester'].map((pair) => ({ agent: pair.split(':')[0], title: pair.split(':')[1] })))
const show = (info: CostsInfo = makeCosts(), onBudget: BudgetSave = saved) => render(<CostsPage info={info} onBudget={onBudget} roleNames={names} />)
const card = (part: string) => document.querySelector<HTMLElement>(`section.card[data-part="${part}"]`)!
const stat = (scope: HTMLElement, label: string) => within(scope).getByText(label, { selector: '.stats span' }).parentElement!
const featureRow = (name: string) => within(card('Features')).getByRole('button', { name: `Open details for ${name}` }).closest('tr')!

describe('the Costs page', () => {
  it('shows only one card with how runs get recorded when nothing is recorded yet', () => {
    show(makeCosts({ empty: true, features: [] }))
    expect([...document.querySelectorAll('section.card')].map((section) => section.getAttribute('data-part'))).toEqual(['Costs'])
    expect(screen.getByRole('heading', { name: 'No costs recorded yet' })).toBeInTheDocument()
    expect(screen.getByText(/^A feature appears here after its first recorded run: the Review and Site update workflows record theirs on GitHub, and your Claude Code sessions record theirs when they end, once the ingest secret is set on GitHub, in Cloudflare and on your machine \(README → Costs\)\. Cancelled or timed-out GitHub runs are not recorded\. Budgets are set per feature, so they come with the first one\.$/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows one card when the costs could not be loaded', () => {
    render(<CostsError />)
    expect(screen.getByRole('heading', { name: 'Costs could not be loaded' })).toBeInTheDocument()
    expect(screen.getByText('Try again later; nothing recorded is lost.')).toBeInTheDocument()
  })

  it('has its parts in order: This month, Features, Over time, Roles, Waste', () => {
    show()
    expect([...document.querySelectorAll('section.card')].map((section) => section.getAttribute('data-part'))).toEqual(['This month', 'Features', 'Over time', 'Roles', 'Waste'])
  })
})

describe('This month', () => {
  it('reads the spend, the last full month against the one before, the features, the waste and the budgets', () => {
    show()
    const month = card('This month')
    expect(within(month).getByText('October 2026')).toHaveClass('updated')
    expect(stat(month, 'Spent this month')).toHaveTextContent('≈$41.20estimated $41.20$12.00$12.00 billed · ≈$29.20estimated $29.20 estimated')
    expect(stat(month, 'Last month')).toHaveTextContent('+12% on August')
    expect(within(stat(month, 'Last month')).getByText('estimated $63.10')).toBeInTheDocument()
    expect(stat(month, 'Features')).toHaveTextContent('41 merged · 1 open · 2 closed')
    expect(stat(month, 'Waste')).toHaveTextContent('20% of this month')
    expect(within(stat(month, 'Waste')).getByText('estimated $8.40')).toBeInTheDocument()
    expect(stat(month, 'Over budget')).toHaveTextContent('1of 1 with a budget')
    expect(stat(month, 'Over budget')).toHaveClass('highlight')
    expect(within(month).getByText(/^\$ was billed to the API key\. ≈\$ is an estimate: the tokens of a run on the Claude subscription, priced at Anthropic’s API rates\. \?\$ means the run did not say which it used\. Cancelled or timed-out GitHub runs are not recorded\. Open a feature to set its budget\./)).toBeInTheDocument()
    expect(within(month).getByRole('link', { name: 'The assistant’s own cost is on Ask about Steven.' })).toHaveAttribute('href', '#assistant')
  })

  it('calls the first month with costs the first month, and nothing spent nothing yet', () => {
    const months = makeCosts().months.map((month) => (month.month === '2026-09' ? month : { ...month, money: money(0), wasteMicro: 0 }))
    show(makeCosts({ months, features: [makeFeature({ budgetMicro: null, pull: { state: 'none', number: null, mergeCommit: null, supersededBy: null } })] }))
    const month = card('This month')
    expect(stat(month, 'Last month')).toHaveTextContent('the first month')
    expect(stat(month, 'Spent this month')).toHaveTextContent('nothing yet')
    expect(stat(month, 'Waste')).toHaveTextContent('nothing this month')
    expect(stat(month, 'Features')).toHaveTextContent('none with a pull request yet')
    expect(stat(month, 'Over budget')).not.toHaveClass('highlight')
  })
})

describe('Features', () => {
  it('has the seven columns, the pull request and commit links, and each state in words', () => {
    show()
    const table = within(card('Features')).getByRole('table', { name: 'Features' })
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Feature', 'Spec', 'Build', 'Review', 'Fix', 'Total', 'Budget'])
    const open = featureRow('dev-costs')
    expect(within(open).getByRole('link', { name: '#61' })).toHaveAttribute('href', 'https://github.com/stewils/stevenwilssens.com/pull/61')
    expect(open).toHaveTextContent('#61 open · 23 runs · Oct 17')
    const merged = featureRow('resume-mail')
    expect(within(merged).getByRole('link', { name: '3f2a1bc' })).toHaveAttribute('href', `https://github.com/stewils/stevenwilssens.com/commit/${'3f2a1bc'.padEnd(40, '0')}`)
    expect(merged).toHaveTextContent('#57 merged · 3f2a1bc')
    expect(featureRow('closed-idea')).toHaveTextContent('#55 closed, not merged')
    expect(featureRow('update/redo-1')).toHaveTextContent('#54 redone by #56')
    expect(within(featureRow('update/redo-1')).getByRole('link', { name: '#56' })).toHaveAttribute('href', 'https://github.com/stewils/stevenwilssens.com/pull/56')
  })

  it('says when there is no pull request yet or GitHub did not answer, and links nothing without a repository', () => {
    show(makeCosts({ repo: null, features: [makeFeature({ branch: 'a', pull: { state: 'none', number: null, mergeCommit: null, supersededBy: null } }), makeFeature({ branch: 'b', pull: { state: 'unknown', number: null, mergeCommit: null, supersededBy: null } }), makeFeature({ branch: 'c', pull: { state: 'merged', number: 3, mergeCommit: 'a'.repeat(40), supersededBy: null } })] }))
    expect(featureRow('a')).toHaveTextContent('no pull request yet')
    expect(featureRow('b')).toHaveTextContent('state unknown')
    expect(featureRow('c')).toHaveTextContent('#3 merged · aaaaaaa')
    expect(within(card('Features')).queryAllByRole('link')).toEqual([])
  })

  it('puts No feature last, without a budget, and marks a feature over its budget in words', () => {
    show()
    const rows = within(card('Features')).getAllByRole('button', { name: /^Open details for / }).map((button) => button.getAttribute('aria-label'))
    expect(rows.at(-1)).toBe('Open details for No feature')
    const total = within(featureRow('dev-costs')).getByText('over budget')
    expect(total).toHaveClass('badge', 'error')
    expect(featureRow('dev-costs')).toHaveTextContent('over by ≈$2.40estimated $2.40')
    // Mixed billing: the Total cell's second line.
    expect(featureRow('dev-costs')).toHaveTextContent('$5.70$5.70 billed · ≈$6.70estimated $6.70 est.')
    expect(featureRow('resume-mail')).toHaveTextContent('none')
    fireEvent.click(within(card('Features')).getByRole('button', { name: 'Open details for No feature' }))
    expect(screen.queryByLabelText(/^Budget for/)).not.toBeInTheDocument()
  })

  it('opens a row by click, Enter or Space and shows every round on its own line with its roles, and the lead', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    show()
    const toggle = within(card('Features')).getByRole('button', { name: 'Open details for dev-costs' })
    toggle.focus()
    await user.keyboard('{Enter}')
    const detail = document.querySelector('tr.detail')!
    expect([...detail.querySelectorAll('.cost-lines strong')].map((line) => line.textContent)).toEqual(['Spec', 'Build', 'Review round 1', 'Fix round 1', 'Review round 2', 'Review workflow, round 1', 'Lead'])
    expect(detail).toHaveTextContent('security engineer $0.40')
    expect(detail).toHaveTextContent('Review workflow, round 1 $0.90$0.90 not split by role')
    expect(detail).toHaveTextContent('handoffs, questions, the pull request')
    expect(detail).toHaveTextContent('23 runs · 4.1M tokens in · 310k out · $5.70$5.70 billed · ≈$6.70estimated $6.70 estimated')
    await user.keyboard('{Enter}')
    expect(document.querySelector('tr.detail')).toBeNull()
    await user.keyboard(' ')
    expect(document.querySelector('tr.detail')).not.toBeNull()
    fireEvent.click(featureRow('resume-mail'))
    expect(document.querySelectorAll('tr.detail')).toHaveLength(1)
  })

  it('names the Site update line and the unpriced models', () => {
    show(makeCosts({ features: [makeFeature({ branch: 'update/x-1', total: money(2, 0, 0, [{ model: 'claude-x-1', tokens: 1_200_000 }]), phases: [{ kind: 'site-update', round: 0, pr: null, at: 1, money: money(2), roles: [{ role: 'site-update-workflow', money: money(2) }] }] })] }))
    expect(featureRow('update/x-1')).toHaveTextContent('$2.00+$2.00, plus unpriced runs')
    fireEvent.click(featureRow('update/x-1'))
    const detail = document.querySelector('tr.detail')!
    expect(detail).toHaveTextContent('Spec and build (Site update) $2.00$2.00 not split by role')
    expect(within(detail as HTMLElement).getByText('Unpriced: claude-x-1 (1.2M tokens)')).toHaveClass('badge', 'warn')
  })

  it('sorts by any column, searches, and keeps an open row open when its budget moves it (AC-21, D-7)', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const info = makeCosts({ features: makeCosts().features.toSpliced(4, 0, makeFeature({ branch: 'big-one', pull: null, total: money(20), budgetMicro: 30_000_000 })) })
    const { rerender } = show(info)
    const part = card('Features')
    const order = () => within(part).getAllByRole('button', { name: /^(Open|Close) details for / }).map((button) => button.getAttribute('aria-label')!.replace(/^(Open|Close) details for /, ''))
    const opened = () => within(part).getByRole('button', { name: 'Close details for resume-mail' })
    expect(order()).toEqual(['dev-costs', 'resume-mail', 'closed-idea', 'update/redo-1', 'big-one', 'No feature'])
    // Total: high to low first, then low to high. No feature sorts with the rest.
    await user.click(within(part).getByRole('button', { name: 'Total' }))
    expect(order()).toEqual(['big-one', 'dev-costs', 'resume-mail', 'closed-idea', 'update/redo-1', 'No feature'])
    await user.click(within(part).getByRole('button', { name: 'Total' }))
    expect(order()).toEqual(['No feature', 'update/redo-1', 'closed-idea', 'resume-mail', 'dev-costs', 'big-one'])
    // Search, from six rows on.
    const search = within(part).getByRole('searchbox', { name: 'Search this table' })
    await user.type(search, 'resume')
    expect(order()).toEqual(['resume-mail'])
    await user.clear(search)
    // Budget, high to low: features without one after those with one, No feature last.
    await user.click(within(part).getByRole('button', { name: 'Budget' }))
    expect(order().slice(0, 2)).toEqual(['big-one', 'dev-costs'])
    await user.click(within(part).getByRole('button', { name: 'Open details for resume-mail' }))
    expect(opened().closest('tr')!.nextElementSibling).toHaveClass('detail')
    // Its budget is saved: the row moves to the top and stays open.
    rerender(<CostsPage info={{ ...info, features: info.features.map((feature) => (feature.branch === 'resume-mail' ? { ...feature, budgetMicro: 50_000_000 } : feature)) }} onBudget={saved} roleNames={names} />)
    expect(order()[0]).toBe('resume-mail')
    expect(document.querySelectorAll('tr.detail')).toHaveLength(1)
    expect(opened().closest('tr')!.nextElementSibling).toHaveClass('detail')
    expect(opened()).toHaveAttribute('aria-expanded', 'true')
  })

  it('says the pull request states are unknown when GitHub did not answer for any feature', () => {
    const unknown = { state: 'unknown' as const, number: null, mergeCommit: null, supersededBy: null }
    show(makeCosts({ features: [makeFeature({ pull: unknown }), makeFeature({ branch: 'b', pull: unknown }), makeFeature({ branch: null, pull: null })] }))
    expect(stat(card('This month'), 'Features')).toHaveTextContent('2pull request states unknown')
    cleanup()
    show(makeCosts({ features: [makeFeature({ pull: { state: 'none', number: null, mergeCommit: null, supersededBy: null } })] }))
    expect(stat(card('This month'), 'Features')).toHaveTextContent('1none with a pull request yet')
  })

  it('renders a branch carrying markup as text', () => {
    const branch = '"><img src=x onerror=alert(1)>'
    show(makeCosts({ features: [makeFeature({ branch })] }))
    expect(within(card('Features')).getByText(branch)).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })
})

describe('Over time', () => {
  it('draws the 12 months stacked, with a legend and the last full month, and lists every month', () => {
    show()
    const part = card('Over time')
    expect(within(part).getByText('billed')).toBeInTheDocument()
    expect(within(part).getByText('Last full month ≈$63.10, +12% on the month before')).toBeInTheDocument()
    expect(within(part).getAllByRole('button', { name: /^(January|February|March|April|May|June|July|August|September|October|November|December)/ })).toHaveLength(12)
    expect(within(part).getByRole('button', { name: 'October so far: $12.00 billed, estimated $29.20, 5 features' })).toBeInTheDocument()
    const table = within(part).getByRole('table', { name: 'Cost per month' })
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Month', 'Billed', 'Estimated', 'Total', 'Features', 'Waste'])
    expect(within(table).getAllByRole('row')).toHaveLength(13)
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('October 2026')
    // Twelve fixed months need no search box.
    expect(within(part).queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('reads an empty month as nothing recorded, and the axis in whole dollars', () => {
    const months = makeCosts().months.map((month) => (month.month === '2025-11' ? { ...month, money: money(0), features: 0 } : month))
    show(makeCosts({ months }))
    const part = card('Over time')
    expect(within(part).getByRole('button', { name: 'November: nothing recorded' })).toBeInTheDocument()
    const axis = [...part.querySelectorAll('.chart-grid em')].map((label) => label.textContent)
    for (const label of axis) expect(label).toMatch(/^\$\d[\d,]*$/)
    // One axis column per month, so each label sits under its bar.
    expect(part.querySelector<HTMLElement>('.chart-axis')!.style.gridTemplateColumns).toBe('repeat(12, minmax(0, 1fr))')
  })

  it('starts the chart with the second month', () => {
    const months = makeCosts().months.map((month) => (month.month === '2026-10' ? month : { ...month, money: money(0) }))
    show(makeCosts({ months }))
    expect(within(card('Over time')).getByText('The chart starts with the second month.')).toBeInTheDocument()
    expect(within(card('Over time')).queryByRole('button', { name: /so far/ })).not.toBeInTheDocument()
  })

  it('shows an unknown billing in the Estimated column with its mark', () => {
    const months = makeCosts().months.map((month) => (month.month === '2026-10' ? { ...month, money: money(1, 2, 3) } : month))
    show(makeCosts({ months }))
    const october = within(within(card('Over time')).getByRole('table')).getAllByRole('row')[1]
    expect(october).toHaveTextContent('?$5.00billing unknown, $5.00')
  })
})

describe('Roles', () => {
  it('has every role, the workflows marked not split by role, Other agents only with runs, and — without runs', () => {
    show()
    const table = within(card('Roles')).getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.querySelector('td')!.textContent!.replace(/^[▸▾]/, ''))).toEqual(['developer', 'tester', 'Review workflownot split by role', 'lead', 'security engineer', 'Other agents', 'product manager', 'recruiter', 'designer', 'Site update workflownot split by role'])
    expect(rows[0]).toHaveTextContent('6$5.00$5.0040%')
    expect(rows.at(-1)).toHaveTextContent('—')
    expect(within(card('Roles')).getByText('All time. A developer run in review mode counts under Review.')).toBeInTheDocument()
    fireEvent.click(rows[0])
    expect(card('Roles').querySelector('tr.detail')).toHaveTextContent('Build $5.00$5.00')
    cleanup()
    show(makeCosts({ roles: makeCosts().roles.filter((role) => role.role !== 'other-agents').concat([{ ...makeCosts().roles[0], role: 'other-agents', kind: 'other', runs: 0 }]) }))
    expect(within(card('Roles')).queryByText('Other agents')).not.toBeInTheDocument()
  })
})

describe('Waste', () => {
  it('shows the three totals with their shares, the reasons as badges and the note', () => {
    show()
    const part = card('Waste')
    expect(stat(part, 'Fix rounds')).toHaveTextContent('$1.20$1.20')
    expect(stat(part, 'Closed or redone')).toHaveTextContent(/\d+% of all/)
    expect(within(part).getByText('2 fix rounds')).toHaveClass('badge', 'warn')
    expect(within(part).getByText('1 more review')).toHaveClass('badge', 'warn')
    expect(within(part).getByText('closed, not merged')).toHaveClass('badge', 'error')
    expect(within(part).getByText('redone by #56')).toHaveClass('badge', 'info')
    // Four short headers, so the table fits a phone; the badges wrap inside their cell.
    expect(within(within(part).getByRole('table')).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Feature', 'Why', 'Waste', 'Share'])
    expect(within(part).getByText('2 fix rounds').parentElement).toHaveClass('cost-why')
    // Roles and Waste are full-width cards, not squeezed into a grid.
    expect(part.parentElement!.matches('.grid')).toBe(false)
    expect(card('Roles').parentElement!.matches('.grid')).toBe(false)
    expect(within(part).getByText(/^What went into work that did not reach main as first built: every fix round, every review round after the first in the same place \(your sessions, or the Review workflow on the pull request\), and all of a pull request that was closed or redone\. Counted to learn from, not to avoid\.$/)).toBeInTheDocument()
  })

  it('says so when there is no waste', () => {
    show(makeCosts({ features: [makeFeature({ waste: { money: money(0), fixRounds: 0, moreReviews: 0, closed: false, redoneBy: null } })], waste: { fix: money(0), reviews: money(0), closed: money(0) } }))
    expect(within(card('Waste')).getByText('No waste yet: every pull request merged after its first review.')).toBeInTheDocument()
    expect(stat(card('Waste'), 'Fix rounds')).toHaveTextContent('—')
  })

  it('reads two of each in the plural and shows no share when nothing was spent', () => {
    show(makeCosts({ features: [makeFeature({ total: money(0), waste: { money: money(0), fixRounds: 1, moreReviews: 2, closed: true, redoneBy: null } })] }))
    expect(within(card('Waste')).getByText('1 fix round')).toBeInTheDocument()
    expect(within(card('Waste')).getByText('2 more reviews')).toBeInTheDocument()
    expect(stat(card('Waste'), 'Fix rounds')).toHaveTextContent('—')
  })
})

describe('a budget, by keyboard', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>, name = 'dev-costs') => {
    within(card('Features')).getByRole('button', { name: `Open details for ${name}` }).focus()
    await user.keyboard('{Enter}')
    return screen.getByLabelText(`Budget for ${name}, in US dollars`)
  }

  it('saves what is typed on Enter, says Saving… while it saves and keeps focus, then says it was saved', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    let finish: (value: { ok: true }) => void = () => {}
    const onBudget = vi.fn<BudgetSave>(() => new Promise((resolve) => { finish = resolve }))
    show(makeCosts(), onBudget)
    const field = await open(user)
    expect(field).toHaveValue('10.00')
    await user.clear(field)
    await user.type(field, '$10,50{Enter}')
    expect(onBudget).toHaveBeenCalledWith('dev-costs', 10_500_000)
    const save = screen.getByRole('button', { name: 'Saving…' })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    // A second Enter while it saves sends nothing more.
    await user.type(field, '{Enter}')
    expect(onBudget).toHaveBeenCalledTimes(1)
    finish({ ok: true })
    expect(await screen.findByText('Saved: $10.50 for dev-costs.')).toHaveAttribute('role', 'status')
    expect(field).toHaveValue('10.50')
    expect(field).toHaveFocus()
    expect(screen.getByText(/^Over by/)).toHaveTextContent('Over by ≈$2.40estimated $2.40. It shows in Needs you until the budget is raised or removed.')
  })

  it('puts the saved amount back on Escape, and refuses what is not an amount with a message tied to the field', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const onBudget = vi.fn<BudgetSave>(saved)
    show(makeCosts(), onBudget)
    const field = await open(user)
    await user.clear(field)
    await user.type(field, '42{Escape}')
    expect(field).toHaveValue('10.00')
    for (const text of ['0', '-1', 'abc', '1000.01']) {
      await user.clear(field)
      await user.type(field, `${text}{Enter}`)
      expect(field).toHaveAttribute('aria-invalid', 'true')
      const message = screen.getByText('Enter an amount in dollars, like 10 or 12.50, up to $1,000.')
      expect(field.getAttribute('aria-describedby')).toBe(message.id)
      expect(field).toHaveFocus()
    }
    expect(onBudget).not.toHaveBeenCalled()
    await user.type(field, '{Escape}')
    expect(field).not.toHaveAttribute('aria-invalid')
  })

  it('removes a budget, moves focus to the empty field and says so', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const onBudget = vi.fn<BudgetSave>(saved)
    show(makeCosts(), onBudget)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Remove budget' }))
    expect(onBudget).toHaveBeenCalledWith('dev-costs', null)
    expect(await screen.findByText('Budget removed for dev-costs.')).toBeInTheDocument()
    expect(screen.getByLabelText('Budget for dev-costs, in US dollars')).toHaveValue('')
    expect(screen.getByLabelText('Budget for dev-costs, in US dollars')).toHaveFocus()
  })

  it('keeps the typed amount and focus on Save when saving fails', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    show(makeCosts(), async () => ({ ok: false, reason: 'HTTP 500' }))
    const field = await open(user, 'resume-mail')
    expect(screen.queryByRole('button', { name: 'Remove budget' })).not.toBeInTheDocument()
    await user.type(field, '12')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const status = await screen.findByText('Could not save (HTTP 500). Your amount is still in the field.')
    expect(status).toHaveClass('status-text', 'poor')
    expect(field).toHaveValue('12')
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
  })

  it('says how close a feature is to its budget from 80%', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    show(makeCosts({ features: [makeFeature({ total: money(8.6), budgetMicro: 10_000_000 })] }))
    await open(user)
    expect(screen.getByText('At 86% of its budget.')).toHaveClass('status-text', 'needs-improvement')
  })
})
