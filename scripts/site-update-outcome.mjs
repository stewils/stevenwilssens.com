// Whether a Site update run has a change to commit (.github/workflows/site-update.yml, step
// "Stop when no change was made", between Claude's run and "Check and commit").
//
//   commit  any path outside specs/ changed, was added or renamed (into or out of specs/
//           too): the change goes on to the checks, the commit and the pull request.
//   fail    a request (workflow_dispatch: the MCP or the Actions tab) with no change, or a
//           change only under specs/: the run fails with an error Steven's MCP reads by this
//           step's name, and nothing is committed, pushed or opened.
//   warn    a Building refresh (repository_dispatch) with nothing new, or only a spec: a
//           warning, and nothing is opened.
//
//   git status --porcelain -z --untracked-files=all is read by the script itself; EVENT is
//   the event name, LAST_MESSAGE the file "Summarise Claude's run" wrote (already redacted).
//
// The workflow runs a copy taken before Claude could write to scripts/.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { cut, redact } from './claude-run-summary.mjs'

// The sentence the error annotation starts with; functions/_lib/github.ts (noChangeSentence) reads it back.
export const NO_CHANGE = 'Claude made no change to the site for this request.'
export const ERROR_LIMIT = 500

// `git status --porcelain -z`: "XY path\0", and for a rename or copy "XY new\0old\0".
export const parseStatus = (text) => {
  const fields = String(text ?? '').split('\0')
  const entries = []
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    if (field.length < 4) continue
    const code = field.slice(0, 2)
    const paths = [field.slice(3)]
    if (/[RC]/.test(code) && i + 1 < fields.length) paths.push(fields[++i])
    entries.push({ code, paths })
  }
  return entries
}

const isSpec = (path) => path.startsWith('specs/')

export const decide = ({ event, entries }) => {
  if (entries.some((entry) => entry.paths.some((path) => !isSpec(path)))) return { action: 'commit' }
  const specOnly = entries.length > 0
  // Only a Building refresh may end quietly; anything else (a request, an unknown event) fails closed.
  return { action: event === 'repository_dispatch' ? 'warn' : 'fail', specOnly }
}

// A workflow command's value: % first, then CR and LF, so the message stays on the one ::error:: line.
export const encodeCommand = (text) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')

export const errorLine = (message, specOnly) => {
  const what = specOnly ? 'Only the spec was written; nothing on the site changed.' : 'Nothing in the repository changed.'
  const said = message.trim() ? ` Claude's last message: ${message.trim()}` : ' Claude left no last message.'
  return `::error::${NO_CHANGE} ${encodeCommand(cut(redact(`${what}${said}`), ERROR_LIMIT))}`
}

export const main = ({ event, status, lastMessage = '', output, log = console.log }) => {
  const decision = decide({ event, entries: parseStatus(status) })
  if (decision.action === 'commit') {
    if (output) appendFileSync(output, 'commit=true\n')
    log('There is a change to commit.')
    return 0
  }
  if (output) appendFileSync(output, 'commit=false\nchanged=false\n')
  if (decision.action === 'warn') {
    log(`::warning::${decision.specOnly ? 'Claude changed only the spec; there is nothing to open.' : 'Claude made no changes.'}`)
    return 0
  }
  log(errorLine(lastMessage, decision.specOnly))
  return 1
}

// The step as the workflow runs it: git status of the working tree, the event and the last message from the environment.
export const fromEnvironment = ({ env = process.env, cwd = process.cwd(), log = console.log } = {}) => {
  const status = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd, encoding: 'utf8' })
  let lastMessage = ''
  try { lastMessage = env.LAST_MESSAGE ? readFileSync(env.LAST_MESSAGE, 'utf8') : '' } catch { lastMessage = '' }
  return main({ event: env.EVENT, status, lastMessage, output: env.GITHUB_OUTPUT, log })
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exitCode = fromEnvironment()
