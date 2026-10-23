// The admin's Team page, generated from the orchestration files of the commit being built
// (specs/admin-team-page.md). `vite build` loads it as the module `virtual:team-manifest`
// (vite.config.ts), which only src/admin/ imports, so it lands in the admin bundle and
// nowhere else; nothing is written to dist/ and nothing is committed, so it cannot lag the
// files it describes.
//
// What it reads, and only that: the paths in ORCHESTRATION, through git, from the built
// commit (never the working tree, so .review/, sources/ and .dev.vars cannot reach a public
// bundle), and the first-parent history of that commit for "What changed". Every string is
// normalised and capped; links are built by the page from validated parts. It never throws
// and never fails the build: a part it cannot read becomes a `problems` entry and an
// `{ unreadable: path }` placeholder, and the test that runs it on the real repository
// (scripts/team-manifest.test.mjs) fails on any problem, so CI stops it before a merge.
import { execFileSync } from 'node:child_process'

export const SCHEMA = 'team-manifest/1'
export const REPO = 'https://github.com/stewils/stevenwilssens.com'
// The steps of site-update.yml that hand work on: where the team works, and where the site bot
// opens the pull request (specs/mcp-prs-flow.md); a change elsewhere in that file is not a team change.
export const TEAM_STEP = 'Let Claude make the change'
export const PR_STEP = 'Open the pull request'
// The section of CLAUDE.md with the team's rules; a change elsewhere in that file is not a team change.
export const TEAM_RULES = 'The team'

// The orchestration files: the only list of them. A new kind goes here (or in IGNORED, with a
// reason) in the same pull request; the coverage test fails on a file that is in neither.
export const ORCHESTRATION = [
  { glob: '.claude/team.md', section: 'flow' },
  { glob: '.claude/agents/*.md', section: 'roles' },
  { glob: '.claude/skills/*/SKILL.md', section: 'commands' },
  { glob: '.github/workflows/review.yml', section: 'checks' },
  { glob: '.github/workflows/site-update.yml', section: 'siteUpdate', steps: [TEAM_STEP, PR_STEP] },
  { glob: 'scripts/recruiter-check.mjs', section: 'checks' },
  { glob: 'scripts/assistant-check.mjs', section: 'checks' },
  { glob: 'scripts/recruiter-compare.mjs', section: 'checks' },
  { glob: 'scripts/resume-gate.mjs', section: 'checks' },
  { glob: 'functions/_lib/review/**', exclude: '**/*.test.*', section: 'checks' },
  { glob: 'specs/TEMPLATE.md', section: 'flow' },
  // The SessionEnd hook that meters the team's local runs (specs/dev-costs.md).
  { glob: '.claude/settings.json', section: 'flow' },
  { glob: 'CLAUDE.md', section: 'rules', heading: TEAM_RULES },
]

// Files in the places orchestration lives that are deliberately not part of it.
export const IGNORED = [
  { path: '.github/workflows/deploy.yml', reason: 'deploys main; no hand-off between agents or to Steven' },
  { path: '.github/workflows/site-check.yml', reason: 'checks the built pages in a browser; a site check, not a merge gate of the team' },
  { path: '.github/workflows/building-notify.yml', reason: 'tells the Building write-up to refresh; no agent in it' },
  { path: 'scripts/resume-check.mjs', reason: 'scores the résumé for the site and the admin; resume-gate.mjs is the gate' },
  { path: 'scripts/site-check.mjs', reason: 'the browser site check, not a merge gate of the team' },
  { path: 'functions/_lib/review/*.test.ts', reason: 'the tests of the recruiter checker, not the checker' },
  { path: '.claude/hooks/dev-costs.mjs', reason: 'measures the runs; hands nothing between agents or to Steven' },
]

// Where orchestration files live: every tracked file here is in ORCHESTRATION or IGNORED.
export const AUDITED = ['.claude/**', '.github/workflows/**', 'functions/_lib/review/**', 'scripts/*-gate.mjs', 'scripts/*-check.mjs', 'scripts/*-compare.mjs']

export const SECTIONS = ['flow', 'roles', 'checks', 'commands', 'siteUpdate', 'rules']
export const UPDATE_KEYS = ['sha', 'date', 'summary', 'pr', 'sections', 'roles', 'commands', 'steps', 'removedSteps', 'beforeLaunch']
export const MAX_UPDATES = 200
export const MAX_BYTES = 256 * 1024

const HEX40 = /^[0-9a-f]{40}$/

// ---- text -------------------------------------------------------------------------------

// Control, bidi and zero-width characters out, whitespace collapsed, cut on a code point.
// oxlint-disable-next-line no-control-regex -- stripping control characters is the point
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g
export const clean = (value, max = 300) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim()
  const points = Array.from(text)
  return points.length > max ? `${points.slice(0, max - 1).join('').trimEnd()}…` : text
}
// Markdown emphasis and code marks out: the page shows text only.
export const plain = (value) => String(value ?? '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]*)`/g, '$1')
const unquote = (value) => value.trim().replace(/^(['"])(.*)\1$/, '$2')
export const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part'

// ---- paths ------------------------------------------------------------------------------

const escapeRegExp = (text) => text.replace(/[.+?^$(){}|[\]\\]/g, '\\$&')
export const globToRegExp = (glob) => new RegExp(`^${glob.split('**/').map((part) => part.split('**').map((piece) => piece.split('*').map(escapeRegExp).join('[^/]*')).join('.*')).join('(?:.*/)?')}$`)
const matches = (glob, path) => globToRegExp(glob).test(path)

// Never shipped, even if someone lists them: review reports, other projects' sources, secrets.
export const refused = (path) => /(^|\/)(\.review|sources)\//.test(path) || /(^|\/)(\.env|\.dev\.vars)[^/]*$/.test(path)

export const entryFor = (path, orchestration = ORCHESTRATION) => (refused(path) ? null : orchestration.find((entry) => matches(entry.glob, path) && !(entry.exclude && matches(entry.exclude, path))) ?? null)

// AC-4: every tracked file where orchestration lives is listed or ignored with a reason, and
// every ignore entry still has a reason and a file.
export const coverageGaps = (files, { orchestration = ORCHESTRATION, ignored = IGNORED, audited = AUDITED } = {}) => {
  const isIgnored = (path) => ignored.some((entry) => matches(entry.path, path))
  const unlisted = files.filter((path) => audited.some((glob) => matches(glob, path)) && !entryFor(path, orchestration) && !isIgnored(path))
  const badIgnores = ignored.filter((entry) => !String(entry.reason ?? '').trim() || !files.some((path) => matches(entry.path, path))).map((entry) => entry.path)
  return { unlisted, badIgnores }
}

// ---- git, with an argument array and never a shell ----------------------------------------

const runGit = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
const show = (root, rev, path) => {
  try { return runGit(root, ['cat-file', 'blob', `${rev}:${path}`]) } catch { return null }
}

// ---- parsers ----------------------------------------------------------------------------

export const frontmatter = (text) => {
  const found = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text)
  if (!found) return null
  const fields = {}
  for (const line of found[1].split(/\r?\n/)) {
    const pair = /^([\w-]+):\s*(.*)$/.exec(line)
    if (pair) fields[pair[1]] = unquote(pair[2])
  }
  return { fields, body: text.slice(found[0].length) }
}
const headings = (body) => [...body.matchAll(/^## +(.+)$/gm)].map((match) => clean(plain(match[1]), 120)).slice(0, 30)

// Splits Markdown on its `## ` headings: [{ heading (null before the first), body }].
const splitSections = (text) => {
  const parts = [{ heading: null, body: '' }]
  for (const line of text.split(/\r?\n/)) {
    const heading = /^## +(.+?)\s*$/.exec(line)
    if (heading) parts.push({ heading: heading[1], body: '' })
    else parts[parts.length - 1].body += `${line}\n`
  }
  return parts
}

const tableRows = (body) => {
  const lines = body.split(/\r?\n/).filter((line) => line.trim().startsWith('|'))
  if (lines.length < 2) return []
  const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
  const header = cells(lines[0]).map((cell) => cell.toLowerCase())
  const column = (name) => header.findIndex((cell) => cell.startsWith(name))
  const [role, agent, owns, signs] = [column('role'), column('agent'), column('owns'), column('signs')]
  return lines.slice(1).filter((line) => !/^\|?\s*:?-{3,}/.test(line.trim())).map((line) => {
    const row = cells(line)
    const name = /`([^`]+)`/.exec(row[agent] ?? '')
    return { title: clean(plain(row[role]), 120), agent: name ? name[1] : null, owns: clean(plain(row[owns]), 300), signsOff: clean(plain(row[signs]), 300), raw: line }
  })
}

const flowItems = (body) => {
  const items = []
  let current = null
  let fenced = false
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { fenced = !fenced; current = null; continue }
    if (fenced) continue
    const item = /^(\d+)\.\s+(.*)$/.exec(line)
    if (item) { current = { n: Number(item[1]), raw: item[2] }; items.push(current); continue }
    if (current && /^\s+\S/.test(line)) current.raw += ` ${line.trim()}`
    else if (line.trim()) current = null
  }
  return items
}

const withoutFences = (text) => text.replace(/```[\s\S]*?```/g, ' ')
const mermaidSource = (body) => /```mermaid\r?\n([\s\S]*?)\r?\n\s*```/.exec(body)?.[1] ?? null

// A small fixed subset of a Mermaid flowchart (AC-20): node ids and labels (id[..], id([..]),
// id{..}), subgraph id [label] … end, edges -->, ---, -.->, -.- with an optional label
// (-- label -->, -.label.-), chains and &, `class a,b name` and `%% step N: id` comments.
// Anything else on a line is ignored. A node with no step line whose only links are dotted
// (-.-) is a note beside the flow (the meter), not a step: it leaves `order` and `edges`.
const EDGE = /\s*(?:--\s+([^\n]+?)\s+-->|-\.->|-\.([^.\n]+?)\.->?|-\.-|-->|---)\s*/g
const NODE = /^([A-Za-z_][\w-]*)\s*(?:\(\[(.*)\]\)|\[(.*)\]|\{(.*)\})?\s*;?$/

export const parseChart = (source) => {
  const nodes = new Map()
  const order = []
  const members = new Set()
  const edges = []
  const dotted = new Set()
  const classes = []
  const stepLines = []
  let group = null
  const place = (id) => { if (!group && !members.has(id) && !order.includes(id)) order.push(id) }
  const define = (id, label, shape) => {
    const node = nodes.get(id) ?? { id, label: id, labelled: false, shape: 'box', members: [] }
    // A parallelogram ([/label/]) is drawn as a box; its slashes are Mermaid's, not the label's.
    if (label !== undefined && !node.labelled) Object.assign(node, { label: clean(unquote(label).replace(/^\/(.*)\/$/, '$1'), 120), labelled: true, shape })
    nodes.set(id, node)
    if (group && group !== id && !members.has(id) && !order.includes(id)) {
      members.add(id)
      nodes.get(group).members.push({ id, via: null })
    }
    place(id)
    return node
  }
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim()
    const step = /^%%\s*step\s+(\d+)\s*:\s*([\w-]+)\s*$/i.exec(line)
    if (step) { stepLines.push({ n: Number(step[1]), id: step[2] }); continue }
    if (!line || line.startsWith('%%') || /^(flowchart|graph)\b/.test(line) || /^classDef\b/.test(line)) continue
    const cls = /^class\s+([\w,\s-]+?)\s+([\w-]+)\s*;?$/.exec(line)
    if (cls) { classes.push({ ids: cls[1].split(',').map((id) => id.trim()).filter(Boolean), name: cls[2] }); continue }
    const sub = /^subgraph\s+([\w-]+)\s*(?:\[(.*)\])?\s*$/.exec(line)
    if (sub) { group = null; define(sub[1], sub[2] ?? sub[1], 'group').shape = 'group'; group = sub[1]; continue }
    if (line === 'end') { group = null; continue }
    // Brackets out of the way first, so a label can hold anything but its own closing bracket.
    const saved = []
    const masked = line.replace(/\(\[[^\]]*\]\)|\[[^\]]*\]|\{[^}]*\}/g, (text) => `\u0000${saved.push(text) - 1}\u0000`)
    // oxlint-disable-next-line no-control-regex -- NUL marks a masked bracket; it cannot occur in a chart line
    const unmask = (text) => text.replace(/\u0000(\d+)\u0000/g, (_, index) => saved[Number(index)])
    const segments = []
    const labels = []
    const kinds = []
    let last = 0
    for (const match of masked.matchAll(EDGE)) {
      segments.push(masked.slice(last, match.index))
      labels.push(match[1] ?? match[2] ?? null)
      kinds.push(match[0].trim() === '-.-')
      last = match.index + match[0].length
    }
    segments.push(masked.slice(last))
    const ids = segments.map((segment) => segment.split(/\s*&\s*/).map((ref) => {
      const node = NODE.exec(unmask(ref.trim()))
      if (!node) return null
      const [, id, stadium, box, decision] = node
      if (stadium !== undefined) define(id, stadium, 'start')
      else if (box !== undefined) define(id, box, 'box')
      else if (decision !== undefined) define(id, decision, 'decision')
      else define(id)
      return id
    }).filter(Boolean))
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i] === null ? null : clean(unquote(labels[i]), 120)
      for (const from of ids[i]) for (const to of ids[i + 1] ?? []) {
        if (group) {
          const member = nodes.get(group).members.find((item) => item.id === to)
          if (member && label && member.via === null) member.via = label
        } else {
          const edge = { from, to, label }
          edges.push(edge)
          if (kinds[i]) dotted.add(edge)
        }
      }
    }
  }
  const stepped = new Set(stepLines.map((line) => line.id))
  // Only in a chart that ties its steps to nodes: elsewhere every node is a step.
  const notes = stepLines.length === 0 ? [] : order.filter((id) => {
    const linked = edges.filter((edge) => edge.from === id || edge.to === id)
    return nodes.get(id).shape !== 'group' && !stepped.has(id) && linked.length > 0 && linked.every((edge) => dotted.has(edge))
  }).map((id) => ({
    id,
    label: nodes.get(id).label,
    alongside: [...new Set(edges.filter((edge) => edge.from === id || edge.to === id).map((edge) => (edge.from === id ? edge.to : edge.from)))],
  }))
  const noted = new Set(notes.map((note) => note.id))
  return {
    nodes, order: order.filter((id) => !noted.has(id)), edges: edges.filter((edge) => !noted.has(edge.from) && !noted.has(edge.to)), classes, stepLines, notes,
  }
}

// The chart as the page draws it: the nodes in order, each with its steps, lane, gate,
// members, the edges forward (`next`) and back (`loop`). Problems when the chart and the
// numbered steps disagree; then the diagram is null and the page lists the steps instead.
export const buildDiagram = (chart, stepNumbers) => {
  const problems = []
  const { nodes, order, edges, classes, stepLines, notes = [] } = chart
  if (!order.length) problems.push('the chart has no nodes')
  for (const n of stepNumbers) {
    const count = stepLines.filter((line) => line.n === n).length
    if (count !== 1) problems.push(`step ${n} has ${count} "%% step" lines in the chart; it needs exactly one`)
  }
  for (const line of stepLines) {
    if (!order.includes(line.id)) problems.push(`"%% step ${line.n}: ${line.id}" names a node the chart does not have`)
    if (!stepNumbers.includes(line.n)) problems.push(`"%% step ${line.n}: ${line.id}" names a step that is not in the numbered list`)
  }
  for (const { ids } of classes) for (const id of ids) if (!nodes.has(id)) problems.push(`a class line names the node "${id}", which the chart does not have`)
  const classed = (id, name) => classes.some((item) => item.name === name && item.ids.includes(id))
  const labelOf = (id) => nodes.get(id)?.label ?? id
  const list = order.slice(0, 40).map((id, index) => {
    const node = nodes.get(id)
    const next = []
    let loop = null
    for (const edge of edges.filter((item) => item.from === id)) {
      const target = order.indexOf(edge.to)
      if (target < 0) continue
      if (target <= index) {
        loop ??= { to: edge.to, label: edge.label ?? edges.find((item) => item.from === edge.to && item.to === id)?.label ?? null }
      } else if (!next.some((item) => item.to === edge.to)) next.push({ to: edge.to, label: edge.label })
    }
    return {
      id,
      label: node.label,
      shape: node.shape,
      members: node.members.slice(0, 20).map((member) => ({ label: labelOf(member.id), via: member.via })),
      steps: stepLines.filter((line) => line.id === id).map((line) => line.n).sort((a, b) => a - b),
      lane: classed(id, 'you') ? 'you' : 'team',
      gate: classed(id, 'gate'),
      next,
      loop,
    }
  })
  const drawnNotes = notes.slice(0, 5).map((note) => ({ label: note.label, alongside: note.alongside.filter((id) => order.includes(id)).map(labelOf) }))
  return { diagram: problems.length ? null : { nodes: list, notes: drawnNotes }, problems, nodes: list, notes: drawnNotes }
}

// The parts of .claude/team.md: the roles table, the flow (steps and chart), the finding levels.
export const parseTeam = (text, { agents = [], jobs = [] } = {}) => {
  const parts = splitSections(text)
  const flowAt = parts.findIndex((part) => part.heading === 'The flow')
  const rolesText = parts.slice(0, flowAt < 0 ? parts.length : flowAt).map((part) => `${part.heading ? `## ${part.heading}\n` : ''}${part.body}`).join('')
  const flowPart = flowAt < 0 ? null : parts[flowAt]
  const verdict = parts.find((part) => part.heading === 'The verdict block')
  const rest = parts.filter((part, index) => index > flowAt && part !== verdict && part.heading !== null).map((part) => part.body).join('\n')

  const steps = (flowPart ? flowItems(flowPart.body) : []).map((item) => {
    const title = /^\*\*(.+?)\*\*/.exec(item.raw)
    const after = title ? item.raw.slice(title[0].length) : item.raw
    const who = /^\s*\(([^)]*)\)/.exec(after)
    const text = clean(plain(who ? after.slice(who[0].length) : after).replace(/^[\s.:]+/, ''), 1000)
    const ticks = [...item.raw.matchAll(/`([^`]+)`/g)].map((match) => match[1])
    const people = [...new Set(ticks.filter((name) => agents.includes(name)))]
    if (who && /\blead\b/.test(who[1])) people.push('lead')
    return {
      n: item.n,
      id: slug(title ? title[1] : item.raw.slice(0, 40)),
      title: clean(plain(title ? title[1] : item.raw), 120).replace(/[.:]$/, ''),
      who: who ? clean(plain(who[1]), 300) : null,
      text: title ? text : '',
      people,
      checks: [...new Set(ticks.filter((name) => jobs.includes(name)))],
    }
  }).slice(0, 40)
  const source = flowPart ? mermaidSource(flowPart.body) : null
  const chart = source === null ? null : parseChart(source)
  const verdictLine = clean(withoutFences(verdict?.body ?? ''), 100_000)
  const levels = [...verdictLine.matchAll(/\*\*([a-z]+)\*\*:\s*([^*]+?)(?=\s*\*\*[a-z]+\*\*:|\s+-\s|$)/g)].map((match) => ({ level: match[1], meaning: clean(match[2], 300) }))
  const protection = /[^.]*\bbranch protection\b[^.]*\./i.exec(clean(plain(withoutFences(flowPart?.body ?? '')), 100_000))
  return {
    roles: tableRows(rolesText),
    rolesText,
    flowText: flowPart ? flowPart.body : null,
    verdictText: verdict ? verdict.body : '',
    restText: rest,
    steps,
    chart,
    levels,
    protection: protection ? clean(protection[0], 300) : null,
  }
}

// The jobs of a workflow, cut by indentation: key, name, needs, step names, and the text of
// each job (to see which job a change touched; the text is not shipped).
export const parseJobs = (text) => {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line))
  if (start < 0) throw new Error('no "jobs:" block')
  const jobs = []
  const indentOf = (line) => line.length - line.trimStart().length
  let job = null
  let jobIndent = null
  let dash = null
  for (const line of lines.slice(start + 1)) {
    if (!line.trim() || /^\s*#/.test(line)) { if (job) job.block.push(line); continue }
    const indent = indentOf(line)
    if (indent === 0) break
    jobIndent ??= indent
    if (indent === jobIndent) {
      const key = /^\s*([\w-]+):\s*$/.exec(line)
      if (!key) throw new Error(`cannot read the job line "${clean(line, 60)}"`)
      job = { key: key[1], name: null, needs: [], steps: [], block: [line] }
      jobs.push(job)
      dash = null
      continue
    }
    job.block.push(line)
    if (indent === jobIndent + 2) {
      const name = /^\s*name:\s*(.+)$/.exec(line)
      const needs = /^\s*needs:\s*(.+)$/.exec(line)
      if (name) job.name = clean(unquote(name[1]), 120)
      if (needs) job.needs = needs[1].replace(/[[\]]/g, '').split(',').map((item) => clean(unquote(item), 60)).filter(Boolean)
      continue
    }
    if (/^\s*-\s/.test(line)) dash ??= indent
    const step = indent === dash ? /^\s*-\s+name:\s*(.+)$/.exec(line) : indent === (dash ?? -9) + 2 ? /^\s*name:\s*(.+)$/.exec(line) : null
    if (step && job.steps.length < 40) job.steps.push(clean(unquote(step[1]), 120))
  }
  if (!jobs.length) throw new Error('no jobs under "jobs:"')
  return jobs.map((item) => ({ ...item, block: item.block.join('\n').trimEnd() }))
}

// One named step of a workflow, from its `- name:` line to the next line at or left of its dash.
export const cutStep = (text, name) => {
  const lines = text.split(/\r?\n/)
  const at = lines.findIndex((line) => { const found = /^\s*-\s+name:\s*(.+?)\s*$/.exec(line); return Boolean(found) && unquote(found[1]) === name })
  if (at < 0) return null
  const dash = lines[at].indexOf('-')
  let end = at + 1
  while (end < lines.length && !(lines[end].trim() && lines[end].length - lines[end].trimStart().length <= dash)) end++
  return lines.slice(at, end).map((line) => line.trimEnd()).join('\n').trimEnd()
}

// One `## ` section of a Markdown file, from its heading to the next one; null when it is not there.
export const cutSection = (text, heading) => {
  const part = splitSections(text).find((item) => item.heading === heading)
  return part ? part.body.trim() : null
}

// A workflow expression (${{ steps.branch.outputs.spec }}) as Steven reads it: what it stands for.
const READABLE = { 'steps.branch.outputs.spec': 'specs/<slug>.md' }
export const readable = (text) => text.replace(/\$\{\{\s*([^}]*?)\s*\}\}/g, (_, name) => READABLE[name] ?? `<${name.split('.').pop() || 'value'}>`)

// The comment lines right under a step's `- name:` say in a line what the step does.
const stepDescription = (block) => (/^[^\n]*\n((?:[ \t]*#[^\n]*\n)+)/.exec(block.replace(/\r\n/g, '\n'))?.[1] ?? '').split('\n').map((line) => line.replace(/^\s*#\s?/, '').trim()).filter(Boolean).join(' ')

const stepDetails = (name, block) => ({
  name: clean(name, 120),
  description: clean(stepDescription(block), 300),
  lines: [...block.matchAll(/^\s*\d+\.\s+(.+)$/gm)].slice(0, 20).map((match) => clean(readable(plain(match[1])), 1000)),
  tools: (/--allowedTools\s+\\?"([^"\\]*)\\?"/.exec(block)?.[1] ?? '').split(',').map((tool) => clean(tool, 80)).filter(Boolean).slice(0, 60),
})

// ---- secrets ----------------------------------------------------------------------------

const SECRET = [/sk-ant-/, /ghp_/, /gho_/, /github_pat_/, /AKIA[0-9A-Z]{12,}/, /-----BEGIN/, /[\w.+-]+@[\w-]+\.[\w.-]+/, /\b(?=[A-Za-z0-9+/]*\d)(?=[A-Za-z0-9+/]*[A-Za-z])[A-Za-z0-9+/]{32,}={0,2}/]
const SHA_KEYS = new Set(['sha', 'commit', 'launch'])
// Every string in the manifest that looks like a token, a key or an e-mail address, by where it is.
export const scanSecrets = (value, where = 'manifest') => {
  if (typeof value === 'string') return SECRET.some((pattern) => pattern.test(value)) ? [where] : []
  if (Array.isArray(value)) return value.flatMap((item, index) => scanSecrets(item, `${where}[${index}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => (SHA_KEYS.has(key) ? [] : scanSecrets(item, `${where}.${key}`)))
  return []
}
// The same walk, blanking what it finds, so a secret committed by mistake never ships.
const scrub = (value) => {
  if (typeof value === 'string') return SECRET.some((pattern) => pattern.test(value)) ? '' : value
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SHA_KEYS.has(key) ? item : scrub(item)]))
  return value
}

// ---- the manifest -----------------------------------------------------------------------

const problem = (path, message) => ({ path, error: 'unreadable', message: clean(message, 300) })

// Builds every section from the files at one commit. `read` returns a file's text or null.
const readSections = (files, read, orchestration) => {
  const problems = []
  const fail = (path, error) => { problems.push(problem(path, error instanceof Error ? error.message : String(error))); return { unreadable: path } }
  const pathsOf = (section) => files.filter((path) => entryFor(path, orchestration)?.section === section)
  const teamPath = '.claude/team.md'
  const reviewPath = '.github/workflows/review.yml'
  const sitePath = '.github/workflows/site-update.yml'

  let jobs = null
  try {
    const text = read(reviewPath)
    if (text === null) throw new Error(`${reviewPath} is missing`)
    jobs = parseJobs(text)
  } catch (error) { fail(reviewPath, error) }

  const agentFiles = files.filter((path) => /^\.claude\/agents\/[^/]+\.md$/.test(path))
  const agents = agentFiles.map((path) => {
    const id = path.slice('.claude/agents/'.length, -3)
    const front = frontmatter(read(path) ?? '')
    if (!front || !front.fields.name || !front.fields.description) return { id, ...fail(path, 'no frontmatter with a name and a description') }
    return { id, name: clean(front.fields.name, 80), description: clean(front.fields.description, 1000), headings: headings(front.body), file: path }
  })

  let team = null
  const teamText = read(teamPath)
  if (teamText === null) fail(teamPath, `${teamPath} is missing`)
  else team = parseTeam(teamText, { agents: agents.map((agent) => agent.id), jobs: (jobs ?? []).map((job) => job.key) })

  let flow = { unreadable: teamPath }
  if (team) {
    if (!team.steps.length) fail(teamPath, 'no numbered steps under "## The flow"')
    else {
      let diagram = null
      if (!team.chart) problems.push(problem(teamPath, 'no mermaid chart under "## The flow"'))
      else {
        const built = buildDiagram(team.chart, team.steps.map((step) => step.n))
        for (const message of built.problems) problems.push(problem(teamPath, message))
        diagram = built.diagram
      }
      flow = { file: teamPath, steps: team.steps, diagram }
    }
  }

  const rows = team ? team.roles : []
  const roles = team && !rows.length ? fail(teamPath, 'no roles table before "## The flow"') : {
    file: team ? teamPath : null,
    items: [
      ...rows.map((row) => {
        const agent = agents.find((item) => item.id === row.agent)
        if (agent?.unreadable) return { id: agent.id, unreadable: agent.unreadable }
        return { id: agent ? agent.id : slug(row.title), title: row.title, agent: agent ? agent.name : null, owns: row.owns, signsOff: row.signsOff, description: agent ? agent.description : '', headings: agent ? agent.headings : [], file: agent ? agent.file : null }
      }),
      ...agents.filter((agent) => !rows.some((row) => row.agent === agent.id)).map((agent) => (agent.unreadable ? { id: agent.id, unreadable: agent.unreadable } : { id: agent.id, title: agent.name, agent: agent.name, owns: '', signsOff: '', description: agent.description, headings: agent.headings, file: agent.file })),
    ].slice(0, 40),
  }

  const commands = {
    items: pathsOf('commands').filter((path) => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(path)).map((path) => {
      const id = path.split('/')[2]
      const front = frontmatter(read(path) ?? '')
      if (!front || !front.fields.name || !front.fields.description) return { id, ...fail(path, 'no frontmatter with a name and a description') }
      return { id, name: clean(front.fields.name, 80), description: clean(front.fields.description, 1000), hint: clean(front.fields['argument-hint'] ?? '', 120), file: path }
    }).slice(0, 40),
  }

  const checks = jobs ? {
    file: reviewPath,
    jobs: jobs.map(({ key, name, needs, steps }) => ({ key: clean(key, 60), name, needs, steps })),
    levels: team ? team.levels.slice(0, 10) : [],
    scripts: pathsOf('checks').filter((path) => path !== reviewPath).slice(0, 40),
    protection: team ? team.protection : null,
  } : { unreadable: reviewPath }

  let siteUpdate = { unreadable: sitePath }
  const siteEntry = orchestration.find((entry) => entry.section === 'siteUpdate')
  const siteText = read(sitePath)
  if (siteText === null) fail(sitePath, `${sitePath} is missing`)
  else {
    const steps = (siteEntry?.steps ?? []).map((name) => [name, cutStep(siteText, name)]).filter(([, block]) => block !== null)
    if (!steps.length) fail(sitePath, `no step named "${(siteEntry?.steps ?? []).join('", "')}": every change to the file now counts as a team change`)
    else siteUpdate = { file: sitePath, steps: steps.map(([name, block]) => stepDetails(name, block)) }
  }

  // The team's rules: one section of CLAUDE.md, as paragraphs of text.
  let rules = null
  const rulesEntry = orchestration.find((entry) => entry.section === 'rules')
  if (rulesEntry) {
    const text = read(rulesEntry.glob)
    const section = text === null ? null : cutSection(text, rulesEntry.heading)
    if (section === null) rules = fail(rulesEntry.glob, `no "## ${rulesEntry.heading}" section in ${rulesEntry.glob}`)
    else rules = { file: rulesEntry.glob, heading: clean(rulesEntry.heading, 120), paragraphs: section.split(/\r?\n\s*\r?\n/).map((paragraph) => clean(plain(paragraph), 2000)).filter(Boolean).slice(0, 20) }
  }

  return { flow, sections: { roles, checks, commands, siteUpdate, ...(rules ? { rules } : {}) }, problems, team, jobs, siteSteps: siteUpdate.steps ? siteEntry.steps : null }
}

// The signature of each step: its text, and its node in the chart. A step whose signature
// differs between two versions of team.md changed. When the older version tied no step to the
// chart (before the "%% step" lines), a step whose text is the same and whose node is drawn
// the same there (label, shape, members, edges) did not change: tying it to its node is not
// a change to the step.
const drawn = ({ label, shape, members, next, loop }) => JSON.stringify({ label, shape, members, next, loop })
const stepSignatures = (team) => {
  const steps = new Map()
  const built = team.chart ? buildDiagram(team.chart, team.steps.map((step) => step.n)) : { nodes: [], notes: [] }
  const nodes = built.nodes
  for (const step of team.steps) {
    const found = nodes.find((item) => item.steps.includes(step.n))
    // A note beside a node (the meter) is part of how that node is drawn.
    const node = found && { ...found, notes: built.notes.filter((note) => note.alongside.includes(found.label)).map((note) => note.label) }
    const { steps: _, ...shape } = node ?? {}
    steps.set(step.title, { id: step.id, text: JSON.stringify([step.text, step.who]), node: node ? JSON.stringify(shape) : null, nodeId: node ? node.id : null, drawn: node ? drawn(node) : null })
  }
  return { steps, nodes, mapped: Boolean(team.chart?.stepLines.length) }
}
const sameStep = (was, before, step) => Boolean(before) && before.text === step.text && (before.node === step.node
  || (!was.mapped && step.drawn !== null && was.nodes.some((node) => node.id === step.nodeId && drawn(node) === step.drawn)))

// What one commit changed, by section, role, command and flow step.
const touchedBy = ({ root, sha, parent, paths, orchestration, current, siteMissing }) => {
  const sections = new Set()
  const roles = new Set()
  const commands = new Set()
  const steps = new Set()
  const removedSteps = new Set()
  const before = (path) => (parent ? show(root, parent, path) : null)
  const after = (path) => show(root, sha, path)
  for (const path of paths) {
    const entry = entryFor(path, orchestration)
    if (!entry) continue
    if (path === '.claude/team.md') {
      const agents = current.agents
      const options = { agents, jobs: current.jobKeys }
      const old = parseTeam(before(path) ?? '', options)
      const now = parseTeam(after(path) ?? '', options)
      if (old.rolesText !== now.rolesText) {
        sections.add('roles')
        for (const row of now.roles) if (row.agent && old.roles.find((item) => item.agent === row.agent)?.raw !== row.raw) roles.add(row.agent)
        for (const row of old.roles) if (row.agent && !now.roles.some((item) => item.agent === row.agent)) roles.add(row.agent)
      }
      if (old.verdictText !== now.verdictText) sections.add('checks')
      if (old.flowText !== now.flowText || old.restText !== now.restText) sections.add('flow')
      const was = stepSignatures(old)
      const is = stepSignatures(now)
      for (const [title, step] of is.steps) if (!sameStep(was, was.steps.get(title), step)) { steps.add(step.id); sections.add('flow') }
      for (const title of was.steps.keys()) if (!is.steps.has(title)) { removedSteps.add(clean(title, 120)); sections.add('flow') }
    } else if (entry.section === 'rules') {
      const cut = (text) => (text === null ? null : cutSection(text, entry.heading))
      if (cut(before(path)) !== cut(after(path))) sections.add('rules')
    } else if (entry.section === 'siteUpdate') {
      const oldText = before(path)
      const newText = after(path)
      const counted = siteMissing || (entry.steps ?? []).some((name) => (oldText === null ? null : cutStep(oldText, name)) !== (newText === null ? null : cutStep(newText, name)))
      if (counted) sections.add('siteUpdate')
    } else if (path === '.github/workflows/review.yml') {
      sections.add('checks')
      const blocks = (text) => { try { return new Map(parseJobs(text ?? '').map((job) => [job.key, job.block])) } catch { return new Map() } }
      const old = blocks(before(path))
      const now = blocks(after(path))
      const changed = [...new Set([...old.keys(), ...now.keys()])].filter((key) => old.get(key) !== now.get(key))
      for (const step of current.steps) if (step.checks.some((key) => changed.includes(key))) { steps.add(step.id); sections.add('flow') }
    } else if (entry.section === 'roles') {
      sections.add('roles')
      roles.add(path.slice('.claude/agents/'.length, -3))
    } else if (entry.section === 'commands') {
      sections.add('commands')
      commands.add(path.split('/')[2])
    } else sections.add(entry.section)
  }
  return { sections: SECTIONS.filter((id) => sections.has(id)), roles: [...roles], commands: [...commands], steps: [...steps], removedSteps: [...removedSteps] }
}

// The summary Steven reads: the subject, the pull request title for GitHub's default merge,
// the text after the colon for this repository's "Merge <branch>: <text>". Never the body.
export const summaryOf = (subject, body) => {
  const github = /^Merge pull request #(\d+) from /.exec(subject)
  if (github) {
    const title = body.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
    const pr = Number(github[1])
    return { summary: clean(title ?? subject, 300), pr: Number.isSafeInteger(pr) && pr > 0 && pr < 1e7 ? pr : null }
  }
  const local = /^Merge [^\s:]+: (.+)/.exec(subject)
  if (local) {
    const text = clean(local[1], 300)
    return { summary: text.charAt(0).toUpperCase() + text.slice(1), pr: null }
  }
  return { summary: clean(subject, 300), pr: null }
}
// git's own text when a branch is brought up to date ("Merge branch 'main' into x",
// "Merge remote-tracking branch 'origin/main' into x"): not written for Steven, and what it
// brings in is on the commits it merges.
// Branch syncs, also written by hand ("Merge main into x: …"), and the merge commit GitHub makes
// to test a pull request ("Merge <sha> into <sha>").
export const SYNC_MERGE = /^Merge (?:(?:remote-tracking )?branch '?[^'\s]+'?(?: of \S+)?|(?:origin\/)?main|[0-9a-f]{40}) into /

// The first-parent log, one record per commit. A record that does not read as one (a subject
// carrying the separators) is dropped, never half read. The body is not in it: see bodyOf.
export const parseLog = (log) => log.split('\x1e').filter(Boolean).flatMap((record) => {
  const fields = record.split('\x1f')
  if (fields.length !== 5) return []
  const [hash, parentList, date, subject, names] = fields
  const parents = parentList.split(' ').filter(Boolean)
  if (!HEX40.test(hash) || !parents.every((parent) => HEX40.test(parent)) || Number.isNaN(Date.parse(date))) return []
  return [{ sha: hash, parent: parents[0] ?? null, date, subject, paths: names.split('\0').map((name) => name.trim()).filter(Boolean) }]
})

const readHistory = ({ root, sha, orchestration, current, siteMissing, maxUpdates }) => {
  const commits = parseLog(runGit(root, ['log', '--first-parent', '--diff-merges=first-parent', '--name-only', '-z', '--format=%x1e%H%x1f%P%x1f%cI%x1f%s%x1f', sha]))
  // Only GitHub's merges need the body (its first line is the pull request title): read it for those alone.
  const bodyOf = (commit) => (/^Merge pull request #/.test(commit.subject) ? runGit(root, ['log', '-1', '--format=%b', commit.sha]) : '')
  const added = runGit(root, ['log', '--first-parent', '--diff-merges=first-parent', '--diff-filter=A', '--reverse', '--format=%H', sha, '--', 'scripts/team-manifest.mjs']).split(/\s+/).find(Boolean) ?? null
  const launch = added && HEX40.test(added) ? added : null
  const launchAt = launch ? commits.findIndex((commit) => commit.sha === launch) : -1
  const updates = []
  commits.forEach((commit, index) => {
    if (SYNC_MERGE.test(commit.subject)) return
    const paths = commit.paths.filter((path) => entryFor(path, orchestration))
    if (!paths.length) return
    const touched = touchedBy({ root, sha: commit.sha, parent: commit.parent, paths, orchestration, current, siteMissing })
    if (!touched.sections.length) return
    const { summary, pr } = summaryOf(commit.subject, bodyOf(commit))
    const date = new Date(commit.date).toISOString()
    updates.push({ sha: commit.sha, date, summary, pr, ...touched, beforeLaunch: launchAt < 0 || index > launchAt })
  })
  return { launch: launchAt < 0 ? null : launch, history: { updates: updates.slice(0, maxUpdates), older: Math.max(0, updates.length - maxUpdates), truncated: false } }
}

// The manifest of the commit `ref` in the repository at `root`. Never throws.
export const generate = ({ root = process.cwd(), ref = 'HEAD', orchestration = ORCHESTRATION, maxUpdates = MAX_UPDATES, maxBytes = MAX_BYTES, now = new Date() } = {}) => {
  const manifest = { schema: SCHEMA, repo: REPO, commit: null, generatedAt: now.toISOString(), launch: null, files: [], flow: null, sections: {}, history: null, problems: [] }
  let sha
  try {
    sha = runGit(root, ['rev-parse', '--verify', `${ref}^{commit}`]).trim()
    if (!HEX40.test(sha)) throw new Error('not a commit')
  } catch {
    return emptyManifest('the build is not in a git repository, so the team files could not be read', now)
  }
  manifest.commit = sha
  try {
    return readCommit({ root, sha, orchestration, maxUpdates, maxBytes, manifest })
  } catch (error) {
    return { ...emptyManifest(`the team manifest could not be generated: ${error instanceof Error ? error.message : error}`, now), commit: sha }
  }
}

// Everything after the commit is known; generate() turns a throw in here into an empty manifest.
const readCommit = ({ root, sha, orchestration, maxUpdates, maxBytes, manifest }) => {
  const files = runGit(root, ['ls-tree', '-r', '--name-only', '-z', sha]).split('\0').filter((path) => path && clean(path, 500) === path && entryFor(path, orchestration))
  manifest.files = files
  const read = (path) => (files.includes(path) ? show(root, sha, path) : null)
  const built = readSections(files, read, orchestration)
  Object.assign(manifest, { flow: built.flow, sections: built.sections })
  manifest.problems.push(...built.problems)

  let shallow = true
  try { shallow = runGit(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true' } catch { /* not a repository: no history */ }
  if (!shallow) {
    try {
      const current = { agents: files.filter((path) => /^\.claude\/agents\/[^/]+\.md$/.test(path)).map((path) => path.slice('.claude/agents/'.length, -3)), jobKeys: (built.jobs ?? []).map((job) => job.key), steps: built.flow.steps ?? [] }
      Object.assign(manifest, readHistory({ root, sha, orchestration, current, siteMissing: built.siteSteps === null, maxUpdates }))
    } catch (error) {
      manifest.problems.push(problem('.git', `the history could not be read: ${error instanceof Error ? error.message : error}`))
    }
  }

  const secrets = scanSecrets(manifest)
  if (secrets.length) {
    manifest.problems.push(problem('.claude', `text that looks like a token or an e-mail address was left out: ${secrets.slice(0, 5).join(', ')}`))
    Object.assign(manifest, scrub({ ...manifest, problems: [] }), { problems: manifest.problems })
  }
  while (manifest.history && manifest.history.updates.length && JSON.stringify(manifest).length > maxBytes) {
    manifest.history.updates.pop()
    manifest.history.older++
    manifest.history.truncated = true
  }
  return manifest
}

// The manifest when nothing could be read: every part says so, and the build goes on.
export const emptyManifest = (message, now = new Date()) => ({
  schema: SCHEMA, repo: REPO, commit: null, generatedAt: now.toISOString(), launch: null, files: [],
  flow: { unreadable: '.claude/team.md' },
  sections: { roles: { unreadable: '.claude/team.md' }, checks: { unreadable: '.github/workflows/review.yml' }, commands: { unreadable: '.claude/skills' }, siteUpdate: { unreadable: '.github/workflows/site-update.yml' } },
  history: null,
  problems: [problem('.', message)],
})

// What vite.config.ts serves as `virtual:team-manifest`: the module text and the problems
// to print as warnings. Wrapped once more, so nothing it meets can fail the build.
export const manifestModule = (options = {}) => {
  let manifest
  try { manifest = generate(options) } catch (error) { manifest = emptyManifest(`the team manifest could not be generated: ${error instanceof Error ? error.message : error}`) }
  return { code: `export default ${JSON.stringify(manifest)}`, problems: manifest.problems.map((item) => `${item.path}: ${item.message}`) }
}
