// The Site update workflow's hand-over (.github/workflows/site-update.yml): the `update` job,
// where Claude Code wrote the change and its lint, tests and build ran, hands the commit on
// as a git bundle with the commit of main it started from (its base); the `publish` job, on a
// fresh runner with main checked out and nothing from the branch run, takes it with this
// script before it mints the site bot's token, pushes and opens the pull request. Main may
// have moved on while Claude ran: the base only has to be in main's history. It refuses a
// change it cannot vouch for:
//
//   2  the branch is not one the workflow names (update/<slug>-<run number>), or the base is
//      not a commit id
//   3  the bundle is missing, corrupt, empty or does not build on this repository's history
//   4  the bundle does not carry that branch, or the branch adds nothing to its base
//   5  the base is not in main's history, or the branch does not grow from it, or it holds a
//      merge commit (the update job makes one plain commit; a merge can hide its own changes)
//   6  a commit on it, or the change as a whole, touches .github/ (the bot has no Workflows
//      permission, and a change to the workflows is Steven's to make in a session)
//
//   node scripts/site-update-bundle.mjs <bundle> <branch> <base commit> [<main>]
//
// On success the branch is a local branch of the checkout, its commit is printed and, in
// Actions, written to $GITHUB_OUTPUT as `sha`. Only node: built-ins and git.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const BRANCH = /^update\/[a-z0-9-]+-[0-9]+$/
export const SHA = /^[0-9a-f]{40}$/

const refuse = (code, message) => ({ ok: false, code, message })
const underGithub = (paths) => [...new Set(paths.map((line) => line.trim()).filter((path) => path === '.github' || path.startsWith('.github/')))]

export function takeBundle({ bundle, branch, base, main = 'origin/main', cwd = process.cwd() }) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const isAncestor = (older, newer) => { try { git('merge-base', '--is-ancestor', older, newer); return true } catch { return false } }
  const name = String(branch ?? '')
  if (!BRANCH.test(name)) return refuse(2, `The branch "${name}" is not one the Site update workflow makes (update/<slug>-<run number>).`)
  if (!SHA.test(String(base ?? ''))) return refuse(2, `The base "${String(base ?? '')}" is not a commit id.`)
  try { git('bundle', 'verify', '--quiet', bundle) } catch {
    return refuse(3, 'The change could not be read: the bundle is missing, corrupt, empty, or does not build on main.')
  }
  const heads = git('bundle', 'list-heads', bundle).split('\n').map((line) => line.trim().split(/\s+/)).filter((parts) => parts.length === 2)
  if (!heads.some(([, ref]) => ref === `refs/heads/${name}`)) return refuse(4, `The bundle does not carry ${name}.`)
  git('fetch', '--no-tags', '--quiet', bundle, `+refs/heads/${name}:refs/heads/${name}`)
  const ref = `refs/heads/${name}`
  if (!isAncestor(base, main)) return refuse(5, `The base ${base.slice(0, 7)} is not in main's history: ${name} is refused.`)
  if (!isAncestor(base, ref)) return refuse(5, `${name} does not grow from its base ${base.slice(0, 7)}: it is refused.`)
  const sha = git('rev-parse', ref).trim()
  if (sha === base) return refuse(4, `${name} adds nothing to main.`)
  if (git('rev-list', '--merges', `${base}..${ref}`).trim()) return refuse(5, `${name} holds a merge commit: it is refused.`)
  // Every path any commit on the branch touched, renames as both their paths, and the change as a whole.
  const workflows = underGithub([...git('log', '--format=', '--name-only', '--no-renames', `${base}..${ref}`).split('\n'), ...git('diff', '--name-only', '--no-renames', base, ref).split('\n')])
  if (workflows.length) return refuse(6, `${name} touches ${workflows.slice(0, 5).join(', ')}: a change to .github/ is not pushed by the site bot.`)
  return { ok: true, code: 0, sha, message: `${name} at ${sha.slice(0, 7)}: grows from main at ${base.slice(0, 7)} and touches nothing under .github/.` }
}

// The command line: the exit code, the message on the log, the commit in $GITHUB_OUTPUT.
export function main(args, { output = process.env.GITHUB_OUTPUT, log = console.log, error = console.error, cwd = process.cwd() } = {}) {
  const [bundle, branch, base, mainRef] = args
  const result = takeBundle({ bundle, branch, base, main: mainRef || 'origin/main', cwd })
  if (!result.ok) {
    error(`::error::${result.message}`)
    return result.code
  }
  log(result.message)
  if (output) appendFileSync(output, `sha=${result.sha}\n`)
  return 0
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(main(process.argv.slice(2)))
