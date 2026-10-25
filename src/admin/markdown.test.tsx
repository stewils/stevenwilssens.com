import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Markdown, parseBars, parseFlow } from './markdown'

afterEach(cleanup)

describe('flow diagrams', () => {
  const flow = '```flow\ntitle: Stage 2: the **team**\nyou: I ask :: from my MCP\nteam: Review in parallel :: fresh agents [Developer, Security, ]\nloop: Fix and review again\ncost: Review workflow :: every push\nodd: Unknown kind\nnot a step\n```'

  it('reads the title, each step’s kind, name, detail and members, an unknown kind as an agent', () => {
    expect(parseFlow(flow.split('\n').slice(1, -1))).toEqual({
      title: 'Stage 2: the **team**',
      steps: [
        { kind: 'you', name: 'I ask', detail: 'from my MCP', members: [] },
        { kind: 'team', name: 'Review in parallel', detail: 'fresh agents', members: ['Developer', 'Security'] },
        { kind: 'loop', name: 'Fix and review again', detail: '', members: [] },
        { kind: 'cost', name: 'Review workflow', detail: 'every push', members: [] },
        { kind: 'agent', name: 'Unknown kind', detail: '', members: [] },
      ],
    })
  })

  it('draws an ordered list of steps in a labelled figure, saying who does each', () => {
    render(<Markdown source={flow} />)
    const figure = screen.getByRole('figure', { name: 'Stage 2: the team' })
    const steps = within(figure).getAllByRole('listitem')
    expect(steps.map((step) => step.className)).toEqual(['flow-step flow-you', 'flow-step flow-team', 'flow-step flow-loop', 'flow-step flow-cost', 'flow-step flow-agent'])
    expect(steps[0]).toHaveTextContent('StevenI askfrom my MCP')
    expect(steps[1]).toHaveTextContent('Agents in parallelReview in parallelfresh agentsDeveloperSecurity')
    expect(steps[2]).toHaveTextContent('↺ Goes backFix and review again')
    expect(steps[3]).toHaveTextContent('CostReview workflowevery push')
    expect(figure.querySelector('figcaption strong')).toHaveTextContent('team')
  })

  it('draws a flow without a title as a figure without a name', () => {
    render(<Markdown source={'```flow\nagent: One run\n```'} />)
    expect(screen.getByRole('figure')).not.toHaveAttribute('aria-labelledby')
  })
})

describe('bar charts', () => {
  const bars = '```bars\ntitle: Billed per day\nOct 19 | 66.79 | $67\nOct 23 | 188.39 | $188\nOct 24 | 0\nbad | x | nope\nnegative | -1 | no\n```'

  it('reads the title and each bar, skipping lines without a number', () => {
    expect(parseBars(bars.split('\n').slice(1, -1))).toEqual({ title: 'Billed per day', bars: [{ label: 'Oct 19', value: 66.79, shown: '$67' }, { label: 'Oct 23', value: 188.39, shown: '$188' }, { label: 'Oct 24', value: 0, shown: '0' }] })
  })

  it('draws each bar to the scale of the biggest, with its value as written, a zero as at least a sliver', () => {
    render(<Markdown source={bars} />)
    const figure = screen.getByRole('figure', { name: 'Billed per day' })
    const rows = within(figure).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual(['Oct 19$67', 'Oct 23$188', 'Oct 240'])
    const widths = rows.map((row) => row.querySelector<HTMLElement>('.bar-track span')!.style.width)
    expect(widths[1]).toBe('100%')
    expect(Number.parseFloat(widths[0])).toBeCloseTo(35.43, 1)
    expect(widths[2]).toBe('1%')
  })

  it('draws empty bars when every value is zero, and other code blocks as text', () => {
    render(<Markdown source={'```bars\nA | 0\n```\n\n```\nplain -> text\n```'} />)
    expect(document.querySelector<HTMLElement>('.bar-track span')!.style.width).toBe('0%')
    expect(document.querySelector('pre.draft-diagram')).toHaveTextContent('plain -> text')
  })
})
