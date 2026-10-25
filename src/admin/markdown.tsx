import type { ReactNode } from 'react'

// The Markdown of an admin draft (migrations/0015_admin_drafts.sql) as React elements, never as
// HTML: ## and ### headings, paragraphs, - and 1. lists, > quotes, ``` blocks (diagrams), tables
// with a header row, and inline **bold**, `code` and [links](https://…). Anything else is text.

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
      blocks.push(<pre key={key} className="draft-diagram">{body.join('\n')}</pre>)
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
