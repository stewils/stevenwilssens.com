import type { ReactNode } from 'react'

// The Markdown of an admin draft (migrations/0015_admin_drafts.sql) as React elements, never as
// HTML: ## and ### headings, paragraphs, - and 1. lists, > quotes, ``` blocks, tables with a
// header row, and inline **bold**, `code` and [links](https://…). Anything else is text.
// Two block kinds draw a diagram instead of code:
//
//   ```flow                                    ```bars
//   title: Before: one agent                   title: Billed to the API key per day
//   you: Steven asks :: from the MCP           Oct 19 | 66.79 | $67
//   agent: One Claude run :: edits [A, B]      Oct 20 | 74.59 | $75
//   loop: Fix loop, up to 3 rounds             ```
//   ```
//
// A flow step is `<kind>: <name> :: <detail> [<member>, …]` (kind you, agent, team, gate or
// cost; detail and members optional), drawn left to right on a wide page and top to bottom on a
// narrow one; `loop:` is a step that goes back. A bar is `<label> | <value> | <shown as>`.

const LINK = /^https:\/\/[^\s)]+$/

// One line's inline marks, left to right.
export function inline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let n = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) out.push(text.slice(last, match.index))
    const id = `${key}-${n++}`
    if (match[1] !== undefined) out.push(<strong key={id}>{inline(match[1], id)}</strong>)
    else if (match[2] !== undefined) out.push(<code key={id}>{match[2]}</code>)
    else out.push(LINK.test(match[4]) ? <a key={id} href={match[4]} target="_blank" rel="noreferrer">{match[3]}</a> : match[0])
    last = match.index + match[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const KINDS = ['you', 'agent', 'team', 'gate', 'cost', 'loop']

type Step = { kind: string; name: string; detail: string; members: string[] }
export const parseFlow = (body: string[]) => {
  let title = ''
  const steps: Step[] = []
  for (const line of body) {
    const titled = /^title:\s*(.+)$/.exec(line.trim())
    if (titled) { title = titled[1]; continue }
    const step = /^(\w+):\s*(.+)$/.exec(line.trim())
    if (!step) continue
    const kind = KINDS.includes(step[1]) ? step[1] : 'agent'
    const members = /\[([^\]]+)\]\s*$/.exec(step[2])
    const rest = members ? step[2].slice(0, members.index).trim() : step[2]
    const [name, detail = ''] = rest.split(' :: ')
    steps.push({ kind, name: name.trim(), detail: detail.trim(), members: members ? members[1].split(',').map((member) => member.trim()).filter(Boolean) : [] })
  }
  return { title, steps }
}

const KIND_WORDS: Record<string, string> = { you: 'Steven', agent: 'Agent', team: 'Agents in parallel', gate: 'Check', cost: 'Cost', loop: 'Goes back' }

function Flow({ body, id }: { body: string[]; id: string }) {
  const { title, steps } = parseFlow(body)
  return (
    <figure className="draft-flow" aria-labelledby={title ? `${id}-t` : undefined}>
      {title && <figcaption id={`${id}-t`}>{inline(title, `${id}t`)}</figcaption>}
      <ol>
        {steps.map((step, n) => (
          <li key={n} className={`flow-step flow-${step.kind}`}>
            <span className="flow-kind">{step.kind === 'loop' ? '↺ ' : ''}{KIND_WORDS[step.kind]}</span>
            <strong>{inline(step.name, `${id}s${n}`)}</strong>
            {step.detail && <small>{inline(step.detail, `${id}d${n}`)}</small>}
            {step.members.length > 0 && <span className="flow-members">{step.members.map((member) => <span key={member}>{member}</span>)}</span>}
          </li>
        ))}
      </ol>
    </figure>
  )
}

export const parseBars = (body: string[]) => {
  let title = ''
  const bars: { label: string; value: number; shown: string }[] = []
  for (const line of body) {
    const titled = /^title:\s*(.+)$/.exec(line.trim())
    if (titled) { title = titled[1]; continue }
    const [label, value, shown] = line.split('|').map((part) => part.trim())
    const number = Number(value)
    if (label && value && Number.isFinite(number) && number >= 0) bars.push({ label, value: number, shown: shown || value })
  }
  return { title, bars }
}

function Bars({ body, id }: { body: string[]; id: string }) {
  const { title, bars } = parseBars(body)
  const max = Math.max(...bars.map((bar) => bar.value), 0)
  return (
    <figure className="draft-bars" aria-labelledby={title ? `${id}-t` : undefined}>
      {title && <figcaption id={`${id}-t`}>{inline(title, `${id}t`)}</figcaption>}
      <ul>
        {bars.map((bar, n) => (
          <li key={n}>
            <span className="bar-label">{bar.label}</span>
            <span className="bar-track" aria-hidden="true"><span style={{ width: `${max ? Math.max(1, (bar.value / max) * 100) : 0}%` }} /></span>
            <span className="bar-value">{bar.shown}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const key = `b${i}`
    if (!line.trim()) { i++; continue }
    if (line.startsWith('```')) {
      const body: string[] = []
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i])
      i++
      const kind = line.slice(3).trim()
      blocks.push(kind === 'flow' ? <Flow key={key} id={key} body={body} /> : kind === 'bars' ? <Bars key={key} id={key} body={body} /> : <pre key={key} className="draft-diagram">{body.join('\n')}</pre>)
      continue
    }
    const heading = /^(#{2,3}) (.+)$/.exec(line)
    if (heading) {
      blocks.push(heading[1] === '##' ? <h2 key={key}>{inline(heading[2], key)}</h2> : <h3 key={key}>{inline(heading[2], key)}</h3>)
      i++
      continue
    }
    if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      const head = cells(line)
      const rows: string[][] = []
      for (i += 2; i < lines.length && lines[i].startsWith('|'); i++) rows.push(cells(lines[i]))
      blocks.push(
        <div key={key} className="table-wrap"><table>
          <thead><tr>{head.map((cell, c) => <th key={c}>{inline(cell, `${key}h${c}`)}</th>)}</tr></thead>
          <tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{inline(cell, `${key}r${r}c${c}`)}</td>)}</tr>)}</tbody>
        </table></div>,
      )
      continue
    }
    const list = /^(- |\d+\. )/.exec(line)
    if (list) {
      const ordered = list[1] !== '- '
      const items: string[] = []
      for (; i < lines.length && (ordered ? /^\d+\. /.test(lines[i]) : lines[i].startsWith('- ')); i++) items.push(lines[i].replace(/^(- |\d+\. )/, ''))
      const children = items.map((item, n) => <li key={n}>{inline(item, `${key}l${n}`)}</li>)
      blocks.push(ordered ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>)
      continue
    }
    if (line.startsWith('> ')) {
      const quote: string[] = []
      for (; i < lines.length && lines[i].startsWith('> '); i++) quote.push(lines[i].slice(2))
      blocks.push(<blockquote key={key}>{inline(quote.join(' '), key)}</blockquote>)
      continue
    }
    const paragraph: string[] = []
    for (; i < lines.length && lines[i].trim() && !/^(#{2,3} |```|- |\d+\. |> |\|)/.test(lines[i]); i++) paragraph.push(lines[i].trim())
    if (!paragraph.length) { blocks.push(<p key={key}>{inline(line, key)}</p>); i++; continue }
    blocks.push(<p key={key}>{inline(paragraph.join(' '), key)}</p>)
  }
  return <>{blocks}</>
}
