// The Site update workflow's hand-over (.github/workflows/site-update.yml): the `update` job,
// where Claude Code wrote the change and its lint, tests and build ran, hands the commit on
// as a git bundle; the `publish` job, on a fresh runner with main checked out and nothing
// from the branch run, takes it with this script before it mints the site bot's token,
// pushes and opens the pull request. It refuses a change it cannot vouch for:
//
//   2  the branch is not one the workflow names (update/<slug>-<run number>)
//   3  the bundle is missing, corrupt, empty or does not build on this repository's history
//   4  the bundle does not carry that branch, or the branch adds nothing to main
//   5  the branch does not grow from main
//   6  a commit on it touches .github/ (the bot has no Workflows permission, and a change to
//      the workflows is Steven's to make in a session)
//
//   node scripts/site-update-bundle.mjs <bundle> <branch> [<base>]
//
// On success the branch is a local branch of the checkout, its commit is printed and, in
// Actions, written to $GITHUB_OUTPUT as `sha`. Only node: built-ins and git.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const BRANCH = /^update\/[a-z0-9-]+-[0-9]+$/

const refuse = (code, message) => ({ ok: false, code, message })

export function takeBundle({ bundle, branch, base = 'origin/main', cwd = process.cwd() }) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (!BRANCH.test(String(branch ?? ''))) return refuse(2, `The branch "${String(branch ?? '')}" is not one the Site update workflow makes (update/<slug>-<run number>).`)
  try { git('bundle', 'verify', '--quiet', bundle) } catch {
    return refuse(3, 'The change could not be read: the bundle is missing, corrupt, empty, or does not build on main.')
  }
  const heads = git('bundle', 'list-heads', bundle).split('\n').map((line) => line.trim().split(/\s+/)).filter((parts) => parts.length === 2)
  if (!heads.some(([, ref]) => ref === `refs/heads/${branch}`)) return refuse(4, `The bundle does not carry ${branch}.`)
  git('fetch', '--no-tags', '--quiet', bundle, `+refs/heads/${branch}:refs/heads/${branch}`)
  try { git('merge-base', '--is-ancestor', base, `refs/heads/${branch}`) } catch {
    return refuse(5, `${branch} does not grow from main: it is refused.`)
  }
  const sha = git('rev-parse', `refs/heads/${branch}`).trim()
  if (sha === git('rev-parse', base).trim()) return refuse(4, `${branch} adds nothing to main.`)
  // Every path any commit on the branch touched, renames as both their paths.
  const touched = git('log', '--format=', '--name-only', '--no-renames', `${base}..refs/heads/${branch}`).split('\n').map((line) => line.trim()).filter(Boolean)
  const workflows = [...new Set(touched.filter((path) => path === '.github' || path.startsWith('.github/')))]
  if (workflows.length) return refuse(6, `${branch} touches ${workflows.slice(0, 5).join(', ')}: a change to .github/ is not pushed by the site bot.`)
  return { ok: true, code: 0, sha, message: `${branch} at ${sha.slice(0, 7)}: grows from main and touches nothing under .github/.` }
}

// The command line: the exit code, the message on the log, the commit in $GITHUB_OUTPUT.
export function main(args, { output = process.env.GITHUB_OUTPUT, log = console.log, error = console.error, cwd = process.cwd() } = {}) {
  const [bundle, branch, base] = args
  const result = takeBundle({ bundle, branch, base: base || 'origin/main', cwd })
  if (!result.ok) {
    error(`::error::${result.message}`)
    return result.code
  }
  log(result.message)
  if (output) appendFileSync(output, `sha=${result.sha}\n`)
  return 0
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(main(process.argv.slice(2)))
