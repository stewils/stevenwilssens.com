// What the team step of the Site update workflow did, for the public run log and the step
// summary (.github/workflows/site-update.yml, "Summarise Claude's run"): the run's subtype,
// turns and duration, the tools it was denied (their names, never their input), each agent
// the lead started (its type, whether it ran in the background, whether its result came back
// before the session ended) and the session's last message, redacted and cut.
//
// It reads claude-code-action's execution file, which holds the whole session (every tool
// input and result). That file is never uploaded or printed: the repository is public, and
// the session can have read the private project under sources/ or a token. Only the facts
// above leave it. The workflow runs a copy of this script taken before Claude could write
// to scripts/, with no secret in its environment.
//
//   node claude-run-summary.mjs <execution file> <last message file>
//
// Appends to $GITHUB_STEP_SUMMARY, prints to the log between ::stop-commands:: markers, and
// writes the redacted last message to the second path for the no-change step. Always exits 0.
import { randomBytes } from 'node:crypto'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const MESSAGE_LIMIT = 2000

// What a token or a key looks like; each is replaced by [redacted] before anything is cut or printed.
const SECRETS = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bsk-ant-[A-Za-z0-9_-]{8,}/g,
  /x-access-token:[^\s@'"]+/gi,
  /\bAUTHORIZATION:\s*(?:basic|bearer|token)\s+\S+/gi,
  // A JSON Web Token (an OIDC or runtime token): three base64url parts, the first a JSON header.
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  // A long run of base64 or hex with letters and digits in it: a key, a token, an encoded header.
  // (No dash in it, so a long branch or file name stays readable.)
  /(?<![A-Za-z0-9+/_])(?=[A-Za-z0-9+/_]*\d)(?=[A-Za-z0-9+/_]*[A-Za-z])[A-Za-z0-9+/_]{40,}={0,2}/g,
]
export const redact = (text) => {
  let out = String(text ?? '')
  // Credentials in a URL: https://user:secret@host keeps the host.
  out = out.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[redacted]@')
  for (const pattern of SECRETS) out = out.replace(pattern, '[redacted]')
  return out
}

// At most `limit` characters, cut between code points (an emoji is never split), with an ellipsis when cut.
export const cut = (text, limit) => {
  const chars = Array.from(text)
  return chars.length <= limit ? text : `${chars.slice(0, limit - 1).join('')}…`
}

// The last message as it may be published: redacted first, so a token across the cut is still caught, then cut.
export const publicMessage = (text, limit = MESSAGE_LIMIT) => cut(redact(text).trim(), limit)

// A tool or agent name as the model gave it, reduced to the characters a real one has.
const name = (value) => cut(String(value ?? '').replace(/[^\w.:\-/ ]+/g, '').trim(), 80) || '?'

// The execution file: a JSON array of the session's messages (or one JSON message per line).
export const parseExecution = (text) => {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    const lines = trimmed.split(/\r?\n/).flatMap((line) => { try { return [JSON.parse(line)] } catch { return [] } })
    return lines.length ? lines : null
  }
}

const contentOf = (message) => (Array.isArray(message?.message?.content) ? message.message.content : [])
const isMain = (message) => message?.parent_tool_use_id === null || message?.parent_tool_use_id === undefined

// The facts of a session: no tool input, no tool result, nothing Claude read.
export const summarise = (messages) => {
  const resultAt = messages.findLastIndex((message) => message?.type === 'result')
  const result = resultAt >= 0 ? messages[resultAt] : null
  const end = resultAt >= 0 ? resultAt : messages.length
  const returned = new Set()
  messages.slice(0, end).forEach((message) => {
    if (message?.type === 'user') for (const item of contentOf(message)) if (item?.type === 'tool_result' && item.tool_use_id) returned.add(item.tool_use_id)
  })
  const agents = []
  let lastText = null
  for (const message of messages.slice(0, end)) {
    if (message?.type !== 'assistant' || !isMain(message)) continue
    for (const item of contentOf(message)) {
      if (item?.type === 'text' && typeof item.text === 'string' && item.text.trim()) lastText = item.text
      if (item?.type === 'tool_use' && (item.name === 'Agent' || item.name === 'Task')) {
        agents.push({ tool: item.name, type: name(item.input?.subagent_type ?? 'general-purpose'), background: item.input?.run_in_background === true, returned: returned.has(item.id) })
      }
    }
  }
  const denials = Array.isArray(result?.permission_denials) ? result.permission_denials : []
  return {
    subtype: result ? name(result.subtype) : 'no result: the session ended without one',
    turns: Number.isFinite(result?.num_turns) ? result.num_turns : null,
    durationSeconds: Number.isFinite(result?.duration_ms) ? Math.round(result.duration_ms / 1000) : null,
    denials: denials.length,
    denied: denials.map((denial) => name(denial?.tool_name)),
    agents,
    lastMessage: publicMessage(typeof result?.result === 'string' && result.result.trim() ? result.result : lastText ?? ''),
  }
}

// The facts as lines, the same for the log and the summary (names are already reduced).
export const factLines = (facts) => [
  `Result: ${facts.subtype}; ${facts.turns ?? '?'} turns; ${facts.durationSeconds ?? '?'} s`,
  `Permission denials: ${facts.denials}${facts.denied.length ? ` (${facts.denied.join(', ')})` : ''}`,
  `Agents started by the lead: ${facts.agents.length}`,
  ...facts.agents.map((agent, index) => `  ${index + 1}. ${agent.type} via ${agent.tool}: ${agent.background ? 'in the background' : 'in the foreground'}, ${agent.returned ? 'returned before the end' : 'had not returned when the session ended'}`),
]

// A Markdown fence longer than any run of backticks in the text, so the text cannot close it.
export const fenceFor = (text) => '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1)))

// A token for ::stop-commands:: that does not occur in the text, so the text cannot turn the commands back on.
export const stopToken = (text, random = () => randomBytes(16).toString('hex')) => {
  for (;;) {
    const token = random()
    if (!text.includes(token)) return token
  }
}

export const logText = (facts, token = stopToken(JSON.stringify(facts))) => [
  `::stop-commands::${token}`,
  "Claude's run:",
  ...factLines(facts),
  'Last message (redacted):',
  facts.lastMessage || '(none)',
  `::${token}::`,
].join('\n')

export const summaryText = (facts) => {
  const fence = fenceFor(facts.lastMessage)
  const lines = factLines(facts).map((line) => (line.startsWith('  ') ? `   ${line.trim()}` : `- ${line}`))
  return ["### Claude's run", '', ...lines, '', '**Last message** (redacted, at most 2,000 characters):', '', fence, facts.lastMessage || '(none)', fence, ''].join('\n')
}

// The whole step; never throws for a missing or unreadable file, so the run's real outcome is what counts.
export const main = ({ file, messagePath, summaryPath, log = console.log }) => {
  let messages = null
  let problem = null
  if (!file) problem = 'the team step gave no execution file (it did not run, or stopped before it started Claude)'
  else {
    try { messages = parseExecution(readFileSync(file, 'utf8')) } catch (error) { problem = error?.code === 'ENOENT' ? 'there is no execution file' : 'the execution file cannot be read' }
    if (!problem && !messages) problem = 'the execution file is empty or not JSON'
  }
  if (problem) {
    const line = `Claude's run: nothing to summarise, ${problem}.`
    log(line)
    if (summaryPath) appendFileSync(summaryPath, `### Claude's run\n\n${line}\n`)
    if (messagePath) writeFileSync(messagePath, '')
    return 0
  }
  const facts = summarise(messages)
  log(logText(facts))
  if (summaryPath) appendFileSync(summaryPath, summaryText(facts))
  if (messagePath) writeFileSync(messagePath, facts.lastMessage)
  return 0
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main({ file: process.argv[2] ?? '', messagePath: process.argv[3], summaryPath: process.env.GITHUB_STEP_SUMMARY })
}
