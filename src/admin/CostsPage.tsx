import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { BarChart } from './Charts'
import { amountText, commitLink, costOf, isOver, lineName, markOf, monthTitle, overBudget, parseAmount, pullLink, roleName, sum, total, zero } from './costs'
import { DataTable, type Column } from './DataTable'
import { formatAgo, formatCost, formatNumber, formatPercent, formatUsd, niceMax, trendOf } from './format'
import type { CostFeature, CostMoney, CostMonth, CostRole, CostsInfo } from './types'

// What each change cost to build with Claude (specs/dev-costs.md): this month, every feature
// by phase with its budget, the months, the roles and the waste. Every figure goes through
// formatCost, so its mark says how sure it is; every field from the database is React text.

export type BudgetSave = (branch: string, budgetMicro: number | null) => Promise<{ ok: true } | { ok: false; reason: string }>

// A figure as shown (its marks hidden from screen readers) and as read.
function Amount({ value }: { value: { text: string; words: string } }) {
  return <span className="cost"><span aria-hidden="true">{value.text}</span><span className="visually-hidden">{value.words}</span></span>
}
const Money = ({ money }: { money: CostMoney }) => <Amount value={costOf(money)} />
const Plain = ({ micro, mark = 'billed' as const }: { micro: number; mark?: 'billed' | 'estimated' | 'unknown' }) => <Amount value={formatCost(micro, mark)} />

const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))
const short = (sha: string) => sha.slice(0, 7)

// "$5.70 billed · ≈$6.70 estimated", for a sum that is not all one kind.
function Split({ money, abbreviated = false }: { money: CostMoney; abbreviated?: boolean }) {
  const parts = [money.billed > 0 && <span key="b"><Plain micro={money.billed} /> billed</span>, money.estimated > 0 && <span key="e"><Plain micro={money.estimated} mark="estimated" /> {abbreviated ? 'est.' : 'estimated'}</span>, money.unknown > 0 && <span key="u"><Plain micro={money.unknown} mark="unknown" /> billing unknown</span>].filter(Boolean)
  return <>{parts.map((part, index) => <span key={index}>{index > 0 && ' · '}{part}</span>)}</>
}
const mixed = (money: CostMoney) => [money.billed, money.estimated, money.unknown].filter((part) => part > 0).length > 1

function Unpriced({ money }: { money: CostMoney }) {
  if (!money.unpriced.length) return null
  return <span className="badge warn">Unpriced: {money.unpriced.map((item) => `${item.model} (${tokens(item.tokens)} tokens)`).join(', ')}</span>
}

function PullState({ feature, repo }: { feature: CostFeature; repo: string | null }) {
  const pull = feature.pull
  if (!pull) return null
  const link = (number: number | null) => {
    const href = pullLink(repo, number)
    return href ? <a href={href}>#{number}</a> : <>#{number}</>
  }
  switch (pull.state) {
    case 'merged': {
      const href = commitLink(repo, pull.mergeCommit)
      return <>{link(pull.number)} merged{pull.mergeCommit && <> · {href ? <a href={href}>{short(pull.mergeCommit)}</a> : short(pull.mergeCommit)}</>}</>
    }
    case 'open': return <>{link(pull.number)} open</>
    case 'closed': return <>{link(pull.number)} closed, not merged</>
    case 'superseded': return <>{link(pull.number)} redone by {link(pull.supersededBy)}</>
    case 'none': return <>no pull request yet</>
    default: return <>state unknown</>
  }
}

// The budget of one feature, in its opened row (the designer's "Budget editing").
export function BudgetForm({ feature, onSave }: { feature: CostFeature; onSave: BudgetSave }) {
  const branch = feature.branch!
  const saved = feature.budgetMicro
  const [value, setValue] = useState(saved === null ? '' : amountText(saved))
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const save = useRef<HTMLButtonElement>(null)
  const id = `budget-${branch.replace(/[^A-Za-z0-9-]/g, '-')}`
  const commit = async (micro: number | null) => {
    if (saving) return
    setSaving(true)
    setStatus(null)
    const result = await onSave(branch, micro)
    setSaving(false)
    if (!result.ok) { setStatus({ text: `Could not save (${result.reason}). Your amount is still in the field.`, failed: true }); save.current?.focus(); return }
    if (micro === null) { setValue(''); setStatus({ text: `Budget removed for ${branch}.`, failed: false }); field.current?.focus() }
    else { setValue(amountText(micro)); setStatus({ text: `Saved: ${formatUsd(micro)} for ${branch}.`, failed: false }) }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const micro = parseAmount(value)
    if (micro === null) { setError(true); field.current?.focus(); return }
    setError(false)
    void commit(micro)
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { setValue(saved === null ? '' : amountText(saved)); setError(false) }
  }
  const spent = total(feature.total)
  return (
    <>
      <form className="budget-form" onSubmit={submit} noValidate>
        <span className="budget-group">
          <label htmlFor={id}>Budget for {branch}<span className="visually-hidden">, in US dollars</span></label>
          <span className="budget-field"><span aria-hidden="true">$</span><input id={id} ref={field} type="text" inputMode="decimal" autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={onKey} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-error` : undefined} /></span>
        </span>
        <button type="submit" className="primary" ref={save} aria-disabled={saving ? 'true' : undefined}>{saving ? 'Saving…' : 'Save'}</button>
        {saved !== null && <button type="button" className="ghost" onClick={() => void commit(null)}>Remove budget</button>}
      </form>
      {error && <p className="error budget-note" id={`${id}-error`}>Enter an amount in dollars, like 10 or 12.50, up to $1,000.</p>}
      <p role="status" className={`budget-note ${status?.failed ? 'status-text poor' : ''}`}>{status?.text}</p>
      {saved !== null && spent > saved && <p className="budget-note">Over by <Plain micro={spent - saved} mark={markOf(feature.total)} />. It shows in Needs you until the budget is raised or removed.</p>}
      {saved !== null && spent <= saved && spent >= saved * 0.8 && <p className="budget-note status-text needs-improvement">At {Math.round((spent / saved) * 100)}% of its budget.</p>}
    </>
  )
}

function FeatureDetail({ feature, onSave, names }: { feature: CostFeature; onSave: BudgetSave; names: Map<string, string> }) {
  const runs = feature.runs
  return (
    <>
      <ol className="cost-lines">
        {feature.phases.map((line) => (
          <li key={`${line.kind}-${line.round}-${line.pr ?? ''}`}>
            <strong>{lineName(line)}</strong> <Money money={line.money} />{' '}
            <small className="muted">{line.kind === 'review-workflow' || line.kind === 'site-update' ? 'not split by role' : line.kind === 'lead' ? 'handoffs, questions, the pull request' : line.roles.map((role, index) => <span key={role.role}>{index > 0 && ' · '}{roleName(role.role, names)} <Money money={role.money} /></span>)}</small>
          </li>
        ))}
      </ol>
      <p><small className="muted">{formatNumber(runs)} {runs === 1 ? 'run' : 'runs'} · {tokens(feature.tokensIn)} tokens in · {tokens(feature.tokensOut)} out · <Split money={feature.total} /></small> <Unpriced money={feature.total} /></p>
      {feature.branch !== null && <BudgetForm feature={feature} onSave={onSave} />}
    </>
  )
}

const featureColumns = (repo: string | null): Column<CostFeature>[] => [
  {
    key: 'feature', label: 'Feature', value: (row) => row.branch ?? 'No feature',
    render: (row) => (
      <>
        {row.branch === null ? <span className="muted">No feature</span> : <strong>{row.branch}</strong>}
        {isOver(row) && <> <span className="badge error">over budget</span></>}
        <br /><small className="muted"><PullState feature={row} repo={repo} />{row.pull && ' · '}{formatNumber(row.runs)} {row.runs === 1 ? 'run' : 'runs'} · {formatAgo(row.lastRunAt)}</small>
      </>
    ),
  },
  { key: 'spec', label: 'Spec', num: true, value: (row) => total(row.spec), render: (row) => <Money money={row.spec} /> },
  { key: 'build', label: 'Build', num: true, value: (row) => total(row.build), render: (row) => <Money money={row.build} /> },
  { key: 'review', label: 'Review', num: true, value: (row) => total(row.review), render: (row) => <><Money money={row.review} />{row.reviewRounds > 0 && <><br /><small className="muted">{row.reviewRounds} {row.reviewRounds === 1 ? 'round' : 'rounds'}</small></>}</> },
  { key: 'fix', label: 'Fix', num: true, value: (row) => total(row.fix), render: (row) => <><Money money={row.fix} />{row.fixRounds > 0 && <><br /><small className="muted">{row.fixRounds} {row.fixRounds === 1 ? 'round' : 'rounds'}</small></>}</> },
  {
    key: 'total', label: 'Total', num: true, value: (row) => total(row.total),
    render: (row) => (
      <>
        <strong><Money money={row.total} /></strong>
        {mixed(row.total) && <><br /><small className="muted"><Split money={row.total} abbreviated /></small></>}
        {isOver(row) && <><br /><span className="status-text poor">over by <Plain micro={total(row.total) - row.budgetMicro!} mark={markOf(row.total)} /></span></>}
      </>
    ),
  },
  { key: 'budget', label: 'Budget', num: true, value: (row) => row.budgetMicro ?? -1, render: (row) => (row.branch === null ? '—' : row.budgetMicro === null ? <span className="muted">none</span> : <Plain micro={row.budgetMicro} />) },
]

const monthColumns: Column<CostMonth>[] = [
  { key: 'month', label: 'Month', value: (row) => row.month, render: (row) => monthTitle(row.month) },
  { key: 'billed', label: 'Billed', num: true, value: (row) => row.money.billed, render: (row) => <Plain micro={row.money.billed} /> },
  { key: 'estimated', label: 'Estimated', num: true, value: (row) => row.money.estimated + row.money.unknown, render: (row) => <Amount value={formatCost(row.money.estimated + row.money.unknown, row.money.unknown > 0 ? 'unknown' : 'estimated', row.money.unpriced.length > 0)} /> },
  { key: 'total', label: 'Total', num: true, value: (row) => total(row.money), render: (row) => <Money money={row.money} /> },
  { key: 'features', label: 'Features', num: true, value: (row) => row.features },
  { key: 'waste', label: 'Waste', num: true, value: (row) => row.wasteMicro, render: (row) => <Plain micro={row.wasteMicro} mark={markOf(row.money)} /> },
]

const roleColumns = (names: Map<string, string>): Column<CostRole>[] => [
  { key: 'role', label: 'Role', value: (row) => roleName(row.role, names), render: (row) => (row.kind === 'workflow' || row.kind === 'other' ? <><span className="muted">{roleName(row.role, names)}</span>{row.kind === 'workflow' && <><br /><small className="muted">not split by role</small></>}</> : roleName(row.role, names)) },
  { key: 'runs', label: 'Runs', num: true, value: (row) => row.runs, render: (row) => (row.runs ? formatNumber(row.runs) : '—') },
  { key: 'total', label: 'Total', num: true, value: (row) => total(row.total), render: (row) => <Money money={row.total} /> },
  { key: 'share', label: 'Share', num: true, value: (row) => row.share, render: (row) => (row.runs ? formatPercent(row.share, true) : '—') },
  { key: 'perFeature', label: 'Per feature', num: true, value: (row) => row.perFeatureMicro, render: (row) => (row.runs ? <Plain micro={row.perFeatureMicro} mark={markOf(row.total)} /> : '—') },
]

type WasteRow = { feature: CostFeature }
const wasteColumns: Column<WasteRow>[] = [
  { key: 'feature', label: 'Feature', value: (row) => row.feature.branch ?? 'No feature' },
  {
    key: 'why', label: 'Why', value: (row) => row.feature.waste.fixRounds + row.feature.waste.moreReviews,
    render: ({ feature: { waste } }) => (
      <>
        {waste.fixRounds > 0 && <span className="badge warn">{waste.fixRounds} {waste.fixRounds === 1 ? 'fix round' : 'fix rounds'}</span>}{' '}
        {waste.moreReviews > 0 && <span className="badge warn">{waste.moreReviews} more {waste.moreReviews === 1 ? 'review' : 'reviews'}</span>}{' '}
        {waste.redoneBy !== null ? <span className="badge info">redone by #{waste.redoneBy}</span> : waste.closed && <span className="badge error">closed, not merged</span>}
      </>
    ),
  },
  { key: 'waste', label: 'Waste', num: true, value: (row) => total(row.feature.waste.money), render: (row) => <Money money={row.feature.waste.money} /> },
  { key: 'share', label: 'Of its total', num: true, value: (row) => (total(row.feature.total) ? total(row.feature.waste.money) / total(row.feature.total) : 0), render: (row) => formatPercent(total(row.feature.total) ? total(row.feature.waste.money) / total(row.feature.total) : 0, true) },
]

const notes = {
  month: 'was billed to the API key. ≈$ is an estimate: the tokens of a run on the Claude subscription, priced at Anthropic’s API rates. ?$ means the run did not say which it used. Cancelled or timed-out GitHub runs are not recorded. Open a feature to set its budget.',
  empty: 'A feature appears here after its first recorded run: the Review and Site update workflows record theirs on GitHub, and your Claude Code sessions record theirs when they end, once the ingest secret is set on GitHub, in Cloudflare and on your machine (README → Costs). Cancelled or timed-out GitHub runs are not recorded. Budgets are set per feature, so they come with the first one.',
  waste: 'What went into work that did not reach main as first built: every fix round, every review round after the first in the same place (your sessions, or the Review workflow on the pull request), and all of a pull request that was closed or redone. Counted to learn from, not to avoid.',
}

export function CostsPage({ info, onBudget, roleNames = new Map() }: { info: CostsInfo; onBudget: BudgetSave; roleNames?: Map<string, string> }) {
  if (info.empty) {
    return (
      <section className="card" data-part="Costs">
        <div className="card-head"><h2>No costs recorded yet</h2></div>
        <p className="note">{notes.empty}</p>
      </section>
    )
  }
  const months = info.months
  const current = months.find((month) => month.month === info.month) ?? { month: info.month, money: zero(), features: 0, wasteMicro: 0 }
  const lastIndex = months.findIndex((month) => month.month === info.month) - 1
  const last = months[lastIndex] ?? null
  const before = months[lastIndex - 1] ?? null
  const hadBefore = months.slice(0, Math.max(0, lastIndex)).some((month) => total(month.money) > 0)
  const trend = last && before && hadBefore ? trendOf(total(last.money), total(before.money)) : null
  const named = info.features.filter((feature) => feature.branch !== null)
  const states = [['merged', named.filter((feature) => feature.pull?.state === 'merged').length], ['open', named.filter((feature) => feature.pull?.state === 'open').length], ['closed', named.filter((feature) => feature.pull?.state === 'closed' || feature.pull?.state === 'superseded').length]] as const
  const withBudget = named.filter((feature) => feature.budgetMicro !== null).length
  const over = overBudget(info).length
  const active = months.filter((month) => total(month.money) > 0 || month.money.unpriced.length > 0).length
  const lastFull = last ? `Last full month ${costOf(last.money).text}${trend ? `, ${trend.text} on the month before` : ''}` : ''
  const all = sum(info.features.map((feature) => feature.total))
  const share = (money: CostMoney) => (total(all) ? `${formatPercent(total(money) / total(all), true)} of all` : '—')
  const wasted = info.features.filter((feature) => total(feature.waste.money) > 0 || feature.waste.closed).map((feature) => ({ feature }))
  return (
    <>
      <section className="card" data-part="This month">
        <div className="card-head"><h2>This month</h2><span className="updated">{monthTitle(info.month)}</span></div>
        <div className="stats">
          <div><span>Spent this month</span><strong><Money money={current.money} /></strong><small>{total(current.money) ? <Split money={current.money} /> : 'nothing yet'}</small></div>
          <div><span>Last month</span><strong>{last ? <Money money={last.money} /> : '—'}</strong><small>{trend && before ? `${trend.text} on ${monthTitle(before.month).split(' ')[0]}` : 'the first month'}</small></div>
          <div><span>Features</span><strong>{formatNumber(named.length)}</strong><small>{states.filter(([, n]) => n > 0).map(([word, n]) => `${n} ${word}`).join(' · ') || 'none with a pull request yet'}</small></div>
          <div><span>Waste</span><strong><Plain micro={current.wasteMicro} mark={markOf(current.money)} /></strong><small>{total(current.money) ? `${formatPercent(current.wasteMicro / total(current.money), true)} of this month` : 'nothing this month'}</small></div>
          <div className={over > 0 ? 'highlight' : ''}><span>Over budget</span><strong>{formatNumber(over)}</strong><small>of {formatNumber(withBudget)} with a budget</small></div>
        </div>
        <p className="note">$ {notes.month} <a href="#assistant">The assistant’s own cost is on Ask about Steven.</a></p>
      </section>

      <section className="card" data-part="Features">
        <div className="card-head"><h2>Features</h2></div>
        <DataTable columns={featureColumns(info.repo)} rows={info.features} rowKey={(row) => row.branch ?? '(no feature)'} rowName={(row) => row.branch ?? 'No feature'} label="Features" empty="No feature has a recorded run yet." expand={(row) => <FeatureDetail feature={row} onSave={onBudget} names={roleNames} />} />
      </section>

      <section className="card" data-part="Over time">
        <div className="card-head"><h2>Over time</h2></div>
        {active < 2 ? <p className="empty">The chart starts with the second month.</p> : (
          <BarChart
            title="The last 12 months"
            legend={<span className="chart-legend"><span><i className="billed" />billed</span><span><i className="est" />estimated</span></span>}
            readout={lastFull}
            format={(micro) => formatUsd(micro)}
            max={niceMax(Math.max(...months.map((month) => total(month.money)), 1))}
            axisLabels={months.map((month) => monthTitle(month.month, 'short'))}
            bars={months.map((month) => {
              const now = month.month === info.month
              const name = `${monthTitle(month.month).split(' ')[0]}${now ? ' so far' : ''}`
              return { key: month.month, label: name, value: month.money.billed, estimated: month.money.estimated + month.money.unknown, detail: `${formatCost(month.money.billed).words} billed, ${formatCost(month.money.estimated + month.money.unknown, 'estimated').words}, ${month.features} ${month.features === 1 ? 'feature' : 'features'}` }
            })}
          />
        )}
        <DataTable columns={monthColumns} rows={[...months].reverse()} rowKey={(row) => row.month} label="Cost per month" />
      </section>

      <div className="grid">
        <section className="card" data-part="Roles">
          <div className="card-head"><h2>Roles</h2></div>
          <p className="note">All time. A developer run in review mode counts under Review.</p>
          <DataTable columns={roleColumns(roleNames)} rows={info.roles.filter((row) => row.kind !== 'other' || row.runs > 0)} rowKey={(row) => row.role} label="Cost per role" expand={(row) => <p>{(['spec', 'build', 'review', 'fix', 'lead'] as const).filter((phase) => total(row.byPhase[phase]) > 0).map((phase, index) => <span key={phase}>{index > 0 && ' · '}{phase.charAt(0).toUpperCase() + phase.slice(1)} <Money money={row.byPhase[phase]} /></span>)}</p>} />
        </section>

        <section className="card" data-part="Waste">
          <div className="card-head"><h2>Waste</h2></div>
          <p className="note">{notes.waste}</p>
          <div className="stats">
            <div><span>Fix rounds</span><strong><Money money={info.waste.fix} /></strong><small>{share(info.waste.fix)}</small></div>
            <div><span>Reviews after the first</span><strong><Money money={info.waste.reviews} /></strong><small>{share(info.waste.reviews)}</small></div>
            <div><span>Closed or redone</span><strong><Money money={info.waste.closed} /></strong><small>{share(info.waste.closed)}</small></div>
          </div>
          <DataTable columns={wasteColumns} rows={wasted} rowKey={(row) => row.feature.branch ?? '(no feature)'} label="Waste per feature" empty="No waste yet: every pull request merged after its first review." />
        </section>
      </div>
    </>
  )
}

// The page while /api/costs failed: one card, the rest of the admin working (AC-27).
export function CostsError() {
  return (
    <section className="card" data-part="Costs">
      <div className="card-head"><h2>Costs could not be loaded</h2></div>
      <p className="note">Try again later; nothing recorded is lost.</p>
    </section>
  )
}
