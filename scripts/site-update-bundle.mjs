// The Site update workflow's hand-over (.github/workflows/site-update.yml): the `update` job,
// where Claude Code wrote the change and its lint, tests and build ran, hands the commit on
// as a git bundle with the commit of main it started from (its base); the `publish` job, on a
// fresh runner with main checked out and nothing from the branch run, takes it with this
// script before it mints the site bot's token, pushes and opens the pull request. Main may
// have moved on while Claude ran: the base only has to be in main's history. It refuses a
// change it cannot vouch for:
//
//   2  the branch is not one the workflow names (update/<slug>-<run number>), or the base is
//      not a commit id, or an option is malformed
//   3  the bundle is missing, corrupt, empty or does not build on this repository's history
//   4  the bundle does not carry that branch, or the branch adds nothing to its base
//   5  the base is not in main's history, or is older than the commit the run started from, or
//      the branch does not grow from it, or it holds a merge commit (the update job makes one
//      plain commit; a merge can hide its own changes)
//   6  a commit on it, or the change as a whole, touches .github/ (the bot has no Workflows
//      permission, and a change to the workflows is Steven's to make in a session)
//   7  with --identity: a commit on it whose author or committer is anyone but the site bot
//      (specs/mcp-prs-automation.md, AC-11), so a wrong identity fails the run, not GitHub
//
//   node scripts/site-update-bundle.mjs <bundle> <branch> <base commit> [<main>] [<start commit>]
//     [--identity "<name> <email>"] [--commit --title <subject> --run <run id>]
//
// The bundle "-" means the branch is already a local branch (the update job checks its own
// commit before it hands it on). With --commit (the publish job) the change is written again
// as one new commit with git commit-tree: the bundle's tree only, on the base, as the site bot,
// with the title as subject, the bundle's messages indented as the body (so no line of them is
// ever read as a trailer) and the trailers last, written here. The bundle's own commits never
// reach GitHub. On success the branch is a local branch of the checkout at the commit to push,
// which is printed and, in Actions, written to $GITHUB_OUTPUT as `sha`. Only node: built-ins and git.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const BRANCH = /^update\/[a-z0-9-]+-[0-9]+$/
export const SHA = /^[0-9a-f]{40}$/
// "<name> <email>", as git prints an author: one line, no angle brackets inside the parts.
export const IDENTITY = /^([^<>\n]+) <([^<>\s]+)>$/
// The trailer only the publish job writes (B adds Fix-round); a line like it in the bundle's messages is indented into the body.
export const RUN_TRAILER = 'Site-update-run'

const refuse = (code, message) => ({ ok: false, code, message })
const underGithub = (paths) => [...new Set(paths.map((line) => line.trim()).filter((path) => path === '.github' || path.startsWith('.github/')))]

// start: the commit the run started from (github.sha); the base the update job names may not be older than it.
// identity: "<name> <email>" every commit's author and committer must be.
export function takeBundle({ bundle, branch, base, main = 'origin/main', start = null, identity = null, cwd = process.cwd() }) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const isAncestor = (older, newer) => { try { git('merge-base', '--is-ancestor', older, newer); return true } catch { return false } }
  const name = String(branch ?? '')
  if (!BRANCH.test(name)) return refuse(2, `The branch "${name}" is not one the Site update workflow makes (update/<slug>-<run number>).`)
  if (!SHA.test(String(base ?? ''))) return refuse(2, `The base "${String(base ?? '')}" is not a commit id.`)
  if (start !== null && !SHA.test(String(start))) return refuse(2, `The run's start "${String(start)}" is not a commit id.`)
  if (identity !== null && !IDENTITY.test(String(identity))) return refuse(2, `The identity "${String(identity)}" is not "<name> <email>".`)
  const ref = `refs/heads/${name}`
  if (bundle === '-') {
    try { git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`) } catch { return refuse(4, `There is no local branch ${name}.`) }
  } else {
    try { git('bundle', 'verify', '--quiet', bundle) } catch {
      return refuse(3, 'The change could not be read: the bundle is missing, corrupt, empty, or does not build on main.')
    }
    const heads = git('bundle', 'list-heads', bundle).split('\n').map((line) => line.trim().split(/\s+/)).filter((parts) => parts.length === 2)
    if (!heads.some(([, head]) => head === ref)) return refuse(4, `The bundle does not carry ${name}.`)
    git('fetch', '--no-tags', '--quiet', bundle, `+${ref}:${ref}`)
  }
  if (!isAncestor(base, main)) return refuse(5, `The base ${base.slice(0, 7)} is not in main's history: ${name} is refused.`)
  if (start && !isAncestor(start, base)) return refuse(5, `The base ${base.slice(0, 7)} is older than the commit the run started from (${start.slice(0, 7)}): ${name} is refused.`)
  if (!isAncestor(base, ref)) return refuse(5, `${name} does not grow from its base ${base.slice(0, 7)}: it is refused.`)
  const sha = git('rev-parse', ref).trim()
  if (sha === base) return refuse(4, `${name} adds nothing to main.`)
  if (git('rev-list', '--merges', `${base}..${ref}`).trim()) return refuse(5, `${name} holds a merge commit: it is refused.`)
  // Every path any commit on the branch touched, renames as both their paths; and, a second line behind the
  // merge refusal above, the change as a whole (what a merge could hide from the per-commit log).
  // NUL-separated (-z): git quotes a name with a non-ASCII character or a quote in it otherwise, and a quoted
  // name ("\".github/…") does not start with .github/.
  const workflows = underGithub([...git('log', '--format=', '--name-only', '--no-renames', '-z', `${base}..${ref}`).split(/[\0\n]/), ...git('diff', '--name-only', '--no-renames', '-z', base, ref).split('\0')])
  if (workflows.length) return refuse(6, `${name} touches ${workflows.slice(0, 5).join(', ')}: a change to .github/ is not pushed by the site bot.`)
  // Who wrote each commit, as git records it: the bot's name and address as author and as committer, nothing else.
  if (identity !== null) {
    const others = git('log', '--format=%h%x00%an <%ae>%x00%cn <%ce>', `${base}..${ref}`).split('\n').filter(Boolean)
      .map((line) => line.split('\0')).filter(([, author, committer]) => author !== identity || committer !== identity)
    if (others.length) return refuse(7, `${name} has ${others.length === 1 ? 'a commit' : `${others.length} commits`} not written by ${identity}: ${others.slice(0, 3).map(([short, author, committer]) => `${short} (author ${author}, committer ${committer})`).join(', ')}.`)
  }
  return { ok: true, code: 0, sha, message: `${name} at ${sha.slice(0, 7)}: grows from main at ${base.slice(0, 7)} and touches nothing under .github/${identity !== null ? `; every commit is by ${identity}` : ''}.` }
}

// The subject of the commit that goes to GitHub: the title on one line, without control characters, at most 200 characters.
// oxlint-disable-next-line no-control-regex -- stripping control characters is the point
export const subjectOf = (title) => Array.from(String(title ?? '').replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 200).join('') || 'Site update'

// The message of that commit: the subject, the bundle's messages indented by four spaces (a trailer paragraph in
// them is then body text, never a trailer), and the trailers this script writes, last.
export const messageOf = ({ title, messages, run }) => {
  const body = String(messages ?? '').replace(/\r\n/g, '\n').trim().split('\n').map((line) => (line.trim() ? `    ${line.trimEnd()}` : '')).join('\n')
  const trailers = [`${RUN_TRAILER}: ${run}`, 'Co-Authored-By: Claude <noreply@anthropic.com>']
  return `${subjectOf(title)}\n\n${body ? `${body}\n\n` : ''}${trailers.join('\n')}\n`
}

// The change, written again as one commit on the base: the tree of the bundle's head, the site bot as author and
// committer, the message above. The branch then points at it, so the push and the pull request take this commit.
export function writeCommit({ branch, base, identity, title, run, cwd = process.cwd() }) {
  const ref = `refs/heads/${branch}`
  const [, name, email] = IDENTITY.exec(String(identity ?? '')) ?? []
  if (!name) return refuse(2, `The identity "${String(identity ?? '')}" is not "<name> <email>".`)
  if (!/^[1-9][0-9]{0,12}$/.test(String(run ?? ''))) return refuse(2, `The run id "${String(run ?? '')}" is not a number.`)
  const env = { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email }
  const git = (args, input) => execFileSync('git', args, { cwd, env, input, encoding: 'utf8', stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] })
  const tree = git(['rev-parse', `${ref}^{tree}`]).trim()
  const messages = git(['log', '--reverse', '--format=%B', `${base}..${ref}`])
  const sha = git(['-c', 'commit.gpgsign=false', 'commit-tree', tree, '-p', base, '-F', '-'], messageOf({ title, messages, run })).trim()
  git(['update-ref', ref, sha])
  return { ok: true, code: 0, sha, tree, message: `${branch} is now ${sha.slice(0, 7)}: one commit by ${identity} on ${base.slice(0, 7)} with the bundle's tree ${tree.slice(0, 7)}.` }
}

// The arguments: five positions and the options --identity, --commit, --title and --run.
export const parseArgs = (args) => {
  const positional = []
  const options = { identity: null, commit: false, title: null, run: null }
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--commit') options.commit = true
    else if (arg === '--identity' || arg === '--title' || arg === '--run') options[arg.slice(2)] = args[++index] ?? ''
    else positional.push(arg)
  }
  return { positional, options }
}

// The command line: the exit code, the message on the log, the commit in $GITHUB_OUTPUT.
export function main(args, { output = process.env.GITHUB_OUTPUT, log = console.log, error = console.error, cwd = process.cwd() } = {}) {
  const { positional: [bundle, branch, base, mainRef, start], options } = parseArgs(args)
  if (options.commit && options.identity === null) {
    error('::error::--commit needs --identity: the commit is written as the site bot.')
    return 2
  }
  let result = takeBundle({ bundle, branch, base, main: mainRef || 'origin/main', start: start || null, identity: options.identity, cwd })
  if (result.ok && options.commit) {
    log(result.message)
    result = writeCommit({ branch, base, identity: options.identity, title: options.title, run: options.run, cwd })
  }
  if (!result.ok) {
    error(`::error::${result.message}`)
    return result.code
  }
  log(result.message)
  if (output) appendFileSync(output, `sha=${result.sha}\n`)
  return 0
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(main(process.argv.slice(2)))
