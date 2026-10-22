import { cleanup, render, screen, within } from '@testing-library/react'
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

  // The lanes themselves are CSS, a container query (checked in scripts/team-safety.test.mjs): jsdom lays nothing out.
  it('switches to the one-column form from 11 nodes', () => {
    const many: Flow = { ...flow, diagram: { nodes: Array.from({ length: 11 }, (_, index): DiagramNode => ({ id: `n${index}`, label: `Node ${index}`, shape: 'box', members: [], steps: [], lane: 'team', gate: false, next: [], loop: null })) } }
    const { unmount } = show([], many)
    expect(screen.getByRole('figure')).toHaveClass('fd', 'fd-long')
    unmount()
    show()
    expect(screen.getByRole('figure')).not.toHaveClass('fd-long')
  })

  it('draws a note beside the flow as one quiet row under the steps, not as a step, and keeps the lanes', () => {
    const noted: Flow = { ...flow, diagram: { nodes: flow.diagram!.nodes, notes: [{ label: 'Runs metered: admin, Costs', alongside: ['Draft: drafts/slug.md', 'Editor fixes'] }, { label: 'Logged', alongside: [] }] } }
    const { container } = show([], noted)
    expect(nodes()).toHaveLength(flow.diagram!.nodes.length)
    expect(screen.getByRole('figure')).not.toHaveClass('fd-long')
    const notes = within(screen.getByRole('list', { name: 'Alongside the steps' })).getAllByRole('listitem')
    // The steps by number (Draft is step 2); a node without a step (Editor fixes) by its label.
    expect(notes.map((item) => item.textContent)).toEqual(['Runs metered: admin, Costs · , alongside step 2 and Editor fixes.', 'Logged.'])
    expect(notes[0]).toHaveClass('fd-note')
    expect(container.querySelector('.fd-note [aria-hidden="true"]')).toHaveTextContent('·')
    // The notes come after the steps, inside the frame.
    expect(container.querySelector('.fd-frame > .fd-steps + .fd-notes')).not.toBeNull()
    expect(container.querySelector('.fd-notes')!.querySelectorAll('a, button, [tabindex]')).toHaveLength(0)
  })

  it('names the steps a note runs alongside by number, in order and once, so labels with commas cannot run together', () => {
    // Publish is step 4, the decision step 3; the draft node here holds steps 5 and 2.
    const numbered: Flow = { ...flow, diagram: { nodes: flow.diagram!.nodes.map((item) => (item.id === 'draft' ? { ...item, label: 'Draft, with checks', steps: [5, 2] } : item)), notes: [{ label: 'Runs metered', alongside: ['Publish to the site', 'Draft, with checks', 'Questions only the owner can answer?'] }] } }
    show([], numbered)
    const [note] = within(screen.getByRole('list', { name: 'Alongside the steps' })).getAllByRole('listitem')
    expect(note.textContent).toBe('Runs metered · , alongside steps 2, 3, 4 and 5.')
  })

  it('draws no notes row when the chart has none', () => {
    const { container } = show()
    expect(container.querySelector('.fd-notes')).toBeNull()
    show([], { ...flow, diagram: { nodes: flow.diagram!.nodes, notes: [] } })
    expect(container.querySelector('.fd-notes')).toBeNull()
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

  it('places the team lane side by side and each You node above the boundary it comes at, for the wide layout', () => {
    show()
    const steps = screen.getByRole('list', { name: 'The steps, in order' })
    expect(steps.style.getPropertyValue('--fd-cols')).toBe('8')
    expect(nodes().map((item) => [item.style.getPropertyValue('--fd-col'), item.classList.contains('fd-you'), item.classList.contains('fd-tail')])).toEqual([
      ['2', true, false], ['2', false, false], ['4', false, false], ['5', true, false], ['6', false, false], ['8', false, true],
    ])
  })

  it('draws no arrow from a team node to the next one it does not lead to, in the wide layout', () => {
    show()
    // The decision leads to the owner and to Publish, not to "Editor fixes" next to it;
    // "Editor fixes" loops back and does not lead to Publish. Draft leads to the decision.
    expect(nodes().filter((item) => item.classList.contains('fd-cut')).map((item) => item.querySelector('.fd-label')!.textContent)).toEqual(['Questions only the owner can answer?', 'Editor fixes'])
  })

  it('lets a long name wrap after its dots and slashes, never inside a word', () => {
    show()
    expect(node('Draft:').querySelector('.fd-label')!.innerHTML).toBe('Draft: drafts/<wbr>slug.<wbr>md')
    expect(node('Questions only').querySelector('.fd-label wbr')).toBeNull()
    expect(node('Draft:').querySelector('.fd-label')!.textContent).toBe('Draft: drafts/slug.md')
    const command: Flow = { ...flow, diagram: { nodes: [{ ...flow.diagram!.nodes[0], label: 'Steven asks: /feature, or deploy to steven.wilssens.com.' }] } }
    cleanup()
    show([], command)
    expect(nodes()[0].querySelector('.fd-label')!.innerHTML).toBe('Steven asks: /feature, or deploy to steven.<wbr>wilssens.<wbr>com.')
  })

  it('puts two You nodes in a row side by side, and a chart of only You nodes in two columns', () => {
    const you = (id: string): DiagramNode => ({ id, label: id, shape: 'start', members: [], steps: [], lane: 'you', gate: false, next: [], loop: null })
    const team = (id: string): DiagramNode => ({ ...you(id), shape: 'box', lane: 'team' })
    const { unmount } = show([], { ...flow, diagram: { nodes: [team('a'), you('b'), you('c'), team('d')] } })
    expect(nodes().map((item) => item.style.getPropertyValue('--fd-col'))).toEqual(['2', '3', '5', '4'])
    unmount()
    show([], { ...flow, diagram: { nodes: [you('x')] } })
    expect(screen.getByRole('list', { name: 'The steps, in order' }).style.getPropertyValue('--fd-cols')).toBe('2')
  })

  it('treats an unknown shape as a plain node', () => {
    const odd = { ...flow, diagram: { nodes: [{ ...flow.diagram!.nodes[5], shape: 'hexagon' as DiagramNode['shape'] }] } }
    show([], odd)
    expect(nodes()[0]).toHaveClass('fd-node', 'fd-box', 'fd-team')
  })
})
