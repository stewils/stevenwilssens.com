// The assistant's answers as React nodes. The model is told to use only bold,
// lists and links; everything else stays literal text. Links are kept only when
// they point at the site, the résumé, Steven's LinkedIn, Justia or his email,
// so an answer can never send a reader somewhere Steven did not choose.
import { createElement, Fragment, type ReactNode } from 'react'

const allowedHosts = new Set(['steven.wilssens.com', 'www.linkedin.com', 'linkedin.com', 'patents.justia.com'])

export const safeHref = (href: string) => {
  if (href === 'mailto:steven@wilssens.com') return href
  if (href.startsWith('/') && !href.startsWith('//')) return href
  try {
    const url = new URL(href)
    return url.protocol === 'https:' && allowedHosts.has(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

const inlinePattern = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g

export const renderInline = (text: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = []
  let last = 0
  let index = 0
  for (const match of text.matchAll(inlinePattern)) {
    const start = match.index ?? 0
    if (start > last) nodes.push(text.slice(last, start))
    const [whole, bold, code, label, href, bare] = match
    const key = `${keyPrefix}-${index++}`
    if (bold !== undefined) nodes.push(createElement('strong', { key }, bold))
    else if (code !== undefined) nodes.push(createElement('code', { key }, code))
    else if (label !== undefined) {
      const safe = safeHref(href)
      nodes.push(safe ? createElement('a', { key, href: safe, target: safe.startsWith('mailto:') || safe.startsWith('/') || safe.startsWith('https://steven.wilssens.com') ? undefined : '_blank', rel: 'noreferrer' }, label) : label)
    } else if (bare !== undefined) {
      const safe = safeHref(bare)
      nodes.push(safe ? createElement('a', { key, href: safe, target: safe.startsWith('https://steven.wilssens.com') ? undefined : '_blank', rel: 'noreferrer' }, bare.replace(/^https?:\/\//, '')) : whole)
    }
    last = start + whole.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

type Block = { kind: 'p'; text: string } | { kind: 'ul' | 'ol'; items: string[] }

const parseBlocks = (markdown: string): Block[] => {
  const blocks: Block[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  const flush = () => { if (paragraph.length) { blocks.push({ kind: 'p', text: paragraph.join(' ') }); paragraph = [] } }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      flush()
      const kind = bullet ? 'ul' : 'ol'
      const item = (bullet ?? numbered)![1]
      const lastBlock = blocks[blocks.length - 1]
      if (lastBlock && lastBlock.kind === kind) lastBlock.items.push(item)
      else blocks.push({ kind, items: [item] })
      continue
    }
    if (!line.trim()) { flush(); continue }
    // A continuation line indented under a list item belongs to that item.
    const lastBlock = blocks[blocks.length - 1]
    if (/^\s{2,}/.test(raw) && lastBlock && lastBlock.kind !== 'p' && !paragraph.length) { lastBlock.items[lastBlock.items.length - 1] += ` ${line.trim()}`; continue }
    paragraph.push(line.replace(/^#+\s*/, '').trim())
  }
  flush()
  return blocks
}

export const renderMarkdown = (markdown: string): ReactNode => createElement(Fragment, null, ...parseBlocks(markdown).map((block, index) =>
  block.kind === 'p'
    ? createElement('p', { key: index }, ...renderInline(block.text, `p${index}`))
    : createElement(block.kind, { key: index }, ...block.items.map((item, itemIndex) => createElement('li', { key: itemIndex }, ...renderInline(item, `l${index}-${itemIndex}`))))))
