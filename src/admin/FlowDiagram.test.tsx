import { cleanup, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { makeTeamManifest } from '../test/admin-fixtures'
import { FlowDiagram } from './FlowDiagram'
import type { DiagramNode, Flow } from './team-types'

afterEach(cleanup)

const flow = makeTeamManifest().flow as Flow
const show = (changed: string[] = [], value: Flow = flow) => render(<><h2 id="h">How a change gets to main</h2><FlowDiagram flow={value} changed={new Set(changed)} labelledBy="h" /></>)
const nodes = () => within(screen.getByRole('list', { name: 'The steps, in order' })).getAllByRole('listitem').filter((item) => item.parentElement?.matches('.fd-steps'))
const node = (label: string) => nodes().find((item) => item.querySelector('.fd-label')!.textContent!.startsWith(label))!

describe('the flow diagram', () => {
  it('is a figure labelled by the card heading, with its caption and an ordered list of the chart nodes', () => {
    show()
    const figure = screen.getByRole('figure', { name: 'How a change gets to main' })
    expect(within(figure).getByText(/^From your ask to the live site\. You: the steps that wait for you\. Gate: the change stops until it passes\.$/)).toBeInTheDocument()
    const list = within(figure).getByRole('list', { name: 'The steps, in order' })
    expect(list.tagName).toBe('OL')
    expect(nodes().map((item) => item.querySelector('.fd-label')!.textContent)).toEqual(['The owner asks', 'Draft: drafts/slug.md', 'Questions only the owner can answer?', 'The owner answers', 'Editor fixes', 'Publish to the site'])
  })

  it('reads each node as a sentence: its step, its label, its members and Gate', () => {
    show()
    expect(node('Draft:').textContent).toBe('Step 2, 2Draft: drafts/slug.md. Editor, Proofreader; adds: Lawyer: risks. Gate.')
    expect(node('Draft:')).toHaveTextContent(/^Step 2,/)
  })

  it('reads a decision with its branches, a loop with "Back to", and You on the nodes that wait for the owner', () => {
    show()
    expect(node('Questions only')).toHaveTextContent('Step 3, 3Questions only the owner can answer?. Yes, asked once: The owner answers. No: Publish to the site.')
    expect(node('Editor fixes')).toHaveTextContent('Editor fixes. ↺ Back to Draft: drafts/slug.md: changes requested, twice at most.')
    expect(node('The owner asks')).toHaveTextContent('You')
    expect(node('The owner answers')).toHaveTextContent('You')
    expect(node('Publish')).not.toHaveTextContent('You')
    expect(node('The owner answers').textContent).not.toMatch(/Step/)
  })

  it('marks the node of a changed step, and only that node, with New', () => {
    show(['questions'])
    const marked = nodes().filter((item) => item.hasAttribute('data-changed'))
    expect(marked).toEqual([node('Questions only')])
    expect(marked[0].textContent).toContain(', new')
    expect(within(marked[0]).getByText('New')).toHaveAttribute('aria-hidden', 'true')
  })

  it('has no mark once nothing is unread', () => {
    show([])
    expect(nodes().filter((item) => item.hasAttribute('data-changed'))).toEqual([])
    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('reads a node with two steps as "Steps 2 and 4"', () => {
    const shared: Flow = { ...flow, diagram: { nodes: flow.diagram!.nodes.map((item) => (item.id === 'draft' ? { ...item, steps: [2, 4] } : item.id === 'publish' ? { ...item, steps: [] } : item)) } }
    show(['publish'], shared)
    expect(node('Draft:')).toHaveTextContent(/^Steps 2 and 4, 2, 4Draft/)
    expect(node('Draft:')).toHaveAttribute('data-changed')
  })

  it('keeps the arrows, lanes and badges out of the reading and adds no Tab stops', () => {
    const { container } = show(['draft'])
    const figure = screen.getByRole('figure')
    expect(figure.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0)
    for (const number of container.querySelectorAll('.fd-n')) expect(number).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.fd-loop [aria-hidden="true"]')).toHaveTextContent('↺')
  })

  it('switches to the one-column form from 11 nodes, and draws lanes only from CSS', () => {
    const many: Flow = { ...flow, diagram: { nodes: Array.from({ length: 11 }, (_, index): DiagramNode => ({ id: `n${index}`, label: `Node ${index}`, shape: 'box', members: [], steps: [], lane: 'team', gate: false, next: [], loop: null })) } }
    const { unmount } = show([], many)
    expect(screen.getByRole('figure')).toHaveClass('fd', 'fd-long')
    unmount()
    show()
    expect(screen.getByRole('figure')).not.toHaveClass('fd-long')
    const css = readFileSync('src/admin/admin.css', 'utf8')
    expect(css).toMatch(/@container \(min-width: 700px\)/)
    expect(css).toMatch(/\.fd:not\(\.fd-long\)/)
  })

  it('lists the numbered steps in order when the chart and the steps disagree', () => {
    show(['questions'], { ...flow, diagram: null })
    expect(screen.getByText('The diagram could not be drawn from .team/flow.md; the steps are listed in order.')).toBeInTheDocument()
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => item.querySelector('strong')!.textContent)).toEqual(['Intake', 'Draft', 'Questions', 'Publish'])
    expect(items[2]).toHaveAttribute('data-changed')
    expect(items[2]).toHaveTextContent('Questions, new')
  })

  it('treats an unknown shape as a plain node', () => {
    const odd = { ...flow, diagram: { nodes: [{ ...flow.diagram!.nodes[5], shape: 'hexagon' as DiagramNode['shape'] }] } }
    show([], odd)
    expect(nodes()[0]).toHaveClass('fd-node', 'fd-box', 'fd-team')
  })
})
