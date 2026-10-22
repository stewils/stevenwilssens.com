import type { CSSProperties } from 'react'
import type { DiagramNode, Flow } from './team-types'

// How a change gets to main, drawn from the chart in .claude/team.md (the build-time
// manifest): an ordered list of the chart's nodes in a figure, laid out with CSS. Wide cards
// get two lanes (You above, Team below) in the order of the chart; below 1000px of card
// width (where a node gets narrower than about 120px), or from 11 nodes, one node per row.
// A note beside the flow (the chart's dotted-only nodes, such as the meter) is one quiet
// full-width row under the lanes, never a step.
// Every word comes from the manifest; this file only knows the four shapes (a node, a
// decision, a parallel group, a loop back). The
// screen reader hears each node as a sentence; arrows and lanes are decoration. Nothing in
// it takes focus.

const stepWords = (steps: number[]) => (steps.length === 0 ? '' : steps.length === 1 ? `Step ${steps[0]}, ` : `Steps ${steps.slice(0, -1).join(', ')} and ${steps[steps.length - 1]}, `)
// Class names come from here, never from the manifest.
const shapeClass: Record<string, string> = { start: 'fd-start', box: 'fd-box', decision: 'fd-decision', group: 'fd-parallel' }
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const listOf = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
// A long name (a file path, a domain) may wrap after a dot or a slash inside it, never
// inside a word, and never after the slash of a command (/feature).
const breakable = (text: string) => text.split(/(?<=\w[./])(?=\w)/).flatMap((part, index) => (index ? [<wbr key={index} />, part] : [part]))

// On a wide card: the Team lane's nodes side by side, two grid columns each (after the lane
// labels' column); a You node sits above the boundary between the team nodes it comes
// between, and two You nodes in a row go side by side rather than on top of each other.
const placeNodes = (nodes: DiagramNode[], teamCount: number) => {
  let seen = 0
  let youFrom = 0
  return nodes.map((node) => {
    if (node.lane !== 'you') { seen++; return { column: 2 * seen, last: seen === teamCount } }
    youFrom = Math.max(2, 2 * seen + 1, youFrom + 2)
    return { column: youFrom, last: false }
  })
}

function Members({ node }: { node: DiagramNode }) {
  if (!node.members.length) return null
  const groups: { via: string | null; labels: string[] }[] = []
  for (const member of node.members) {
    const last = groups[groups.length - 1]
    if (last && last.via === member.via) last.labels.push(member.label)
    else groups.push({ via: member.via, labels: [member.label] })
  }
  return (
    <span className="fd-members">
      {groups.map((group, index) => (
        <span className="fd-group" key={index}>
          {index > 0 && <span className="visually-hidden">; </span>}
          {group.via && <span className="fd-via">{group.via}: </span>}
          {group.labels.map((label, i) => <span className="fd-chip" key={i}>{label}{i < group.labels.length - 1 && <span className="visually-hidden">, </span>}</span>)}
        </span>
      ))}
      <span className="visually-hidden">. </span>
    </span>
  )
}

export function FlowDiagram({ flow, changed, labelledBy }: { flow: Flow; changed: Set<string>; labelledBy: string }) {
  const stepId = new Map(flow.steps.map((step) => [step.n, step.id]))
  const isChanged = (steps: number[]) => steps.some((n) => changed.has(stepId.get(n) ?? ''))
  if (!flow.diagram) {
    return (
      <>
        <p className="empty">The diagram could not be drawn from {flow.file}; the steps are listed in order.</p>
        <ol className="fd-plain">
          {flow.steps.map((step) => (
            <li key={step.n} data-changed={isChanged([step.n]) ? '' : undefined}>
              <span className="fd-n">{step.n}</span> <strong>{step.title}</strong>
              {isChanged([step.n]) && <><span className="visually-hidden">, new</span> <span className="badge new" aria-hidden="true">New</span></>}
            </li>
          ))}
        </ol>
      </>
    )
  }
  const nodes = flow.diagram.nodes
  const notes = flow.diagram.notes ?? []
  const labelOf = (id: string) => nodes.find((node) => node.id === id)?.label ?? id
  // A note names the steps it runs alongside by number (the numbers on the nodes above), and a
  // node without a step by its label.
  const alongsideOf = (labels: string[]) => {
    const found = labels.map((label) => nodes.find((node) => node.label === label))
    const numbers = [...new Set(found.flatMap((node) => node?.steps ?? []))].sort((a, b) => a - b)
    const unnumbered = labels.filter((_, index) => !found[index]?.steps.length)
    const steps = numbers.length === 0 ? [] : [`${numbers.length === 1 ? 'step' : 'steps'} ${listOf(numbers.map(String))}`]
    return listOf([...steps, ...unnumbered])
  }
  const teamCount = nodes.filter((node) => node.lane !== 'you').length
  const place = placeNodes(nodes, teamCount)
  // A team node whose arrow would point at the next team node it does not lead to (the pull
  // request does not deploy by itself: Steven merges first) has no arrow in the lanes.
  const cut = nodes.map((node, index) => {
    const following = nodes.slice(index + 1).find((item) => item.lane !== 'you')
    return node.lane !== 'you' && following !== undefined && !node.next.some((edge) => edge.to === following.id)
  })
  return (
    <figure className={`fd${nodes.length > 10 ? ' fd-long' : ''}`} aria-labelledby={labelledBy}>
      <figcaption>From your ask to the live site. You: the steps that wait for you. Gate: the change stops until it passes.</figcaption>
      <div className="fd-frame">
        <ol className="fd-steps" aria-label="The steps, in order" style={{ '--fd-cols': Math.max(2, 2 * teamCount) } as CSSProperties}>
          {nodes.map((node, index) => {
            const isNew = isChanged(node.steps)
            const { column, last } = place[index]
            return (
              <li key={node.id} className={`fd-node ${shapeClass[node.shape] ?? 'fd-box'} ${node.lane === 'you' ? 'fd-you' : 'fd-team'}${last ? ' fd-tail' : ''}${cut[index] ? ' fd-cut' : ''}`} data-changed={isNew ? '' : undefined} style={{ '--fd-col': column } as CSSProperties}>
                <span className="fd-title">
                  <span className="visually-hidden">{stepWords(node.steps)}</span>
                  {node.steps.length > 0 && <span className="fd-n" aria-hidden="true">{node.steps.join(', ')}</span>}
                  <strong className="fd-label">{breakable(node.label)}</strong>
                  {isNew && <><span className="visually-hidden">, new</span><span className="badge new" aria-hidden="true">New</span></>}
                  <span className="visually-hidden">. </span>
                </span>
                <Members node={node} />
                {node.next.filter((edge) => edge.label).map((edge) => <span className="fd-branch" key={edge.to}>{capital(edge.label!)}: {labelOf(edge.to)}. </span>)}
                {node.loop && <span className="fd-loop"><span aria-hidden="true">↺ </span>Back to {labelOf(node.loop.to)}{node.loop.label ? `: ${node.loop.label}` : ''}. </span>}
                {(node.lane === 'you' || node.gate) && (
                  <span className="fd-badges">
                    {node.lane === 'you' && <span className="badge you">You</span>}
                    {node.lane === 'you' && node.gate && <span className="visually-hidden">, </span>}
                    {node.gate && <span className="badge">Gate</span>}
                    <span className="visually-hidden">.</span>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        {notes.length > 0 && (
          <ul className="fd-notes" aria-label="Alongside the steps">
            {notes.map((note) => (
              <li className="fd-note" key={note.label}>
                {note.label}
                {note.alongside.length > 0 && <span className="fd-note-along"><span aria-hidden="true"> · </span><span className="visually-hidden">, </span>alongside {alongsideOf(note.alongside)}</span>}
                <span className="visually-hidden">.</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </figure>
  )
}
