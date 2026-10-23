// Who reviews a pull request in the Review workflow (.claude/team.md, step 6), and whose
// earlier approval still holds. Each role reviews only when a file in its part changed; a
// change to the rules, the team or the gates gets the full panel. An APPROVE from the
// Review workflow's own last comment carries over when nothing in that role's part changed
// since the commit it approved. The workflow runs main's copy of this file, so a pull
// request cannot pick its own reviewers.
//
//   node scripts/review-roster.mjs <changed-files> <branch> [<previous-verdicts.json> <files-since>]
//
// <changed-files>: the pull request's files (git diff --name-only origin/main...HEAD), one per line.
// <files-since>: the files changed since the commit the previous verdicts are for, or "-" when that
// commit is not an ancestor of the head (a force push): then nothing carries over.
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const ROLES = ['senior-developer', 'security-engineer', 'senior-tester', 'ux-designer', 'senior-recruiter', 'product-manager']

const test = (path) => /\.test\.(ts|tsx|mjs|js)$/.test(path) || path.includes('/fixtures/')
const spec = (path) => path.startsWith('specs/')
// Text only: the specs and Markdown other than the rules (CLAUDE.md is the full panel).
const docs = (path) => spec(path) || (/\.md$/.test(path) && !rules(path))
// A Building write-up's feed: numbers, not code. Its words (the .tsx) are still code to the developer and
// the tester, but not a design change unless its diagrams change.
const articleFeed = (path) => /^src\/articles\/.+\.json$/.test(path)
const articleWords = (path) => /^src\/articles\/.+\.tsx$/.test(path) && !/Diagrams\.tsx$/.test(path)
// The rules, the team and the gates: a change to any of them is reviewed by everyone. So is a path git
// still quotes (a control character in it): the patterns below cannot be trusted to read it.
const rules = (path) => path.startsWith('"') || /^(CLAUDE\.md$|\.claude\/|\.github\/workflows\/|functions\/_lib\/review\/|scripts\/(review-roster|[a-z-]+-(check|gate|compare))\.mjs$)/.test(path)

const parts = {
  'senior-developer': (path) => !docs(path) && !articleFeed(path),
  'senior-tester': (path) => !docs(path) && !articleFeed(path),
  'security-engineer': (path) => !test(path) && /^(functions\/|scripts\/|migrations\/|public\/_(headers|redirects)$|wrangler\.jsonc$|package(-lock)?\.json$|src\/(ask|admin)\/|src\/webmcp\.ts$|index\.html$|vite\.config\.)/.test(path),
  'ux-designer': (path) => !test(path) && (/^src\/.+\.(tsx|css)$/.test(path) && !articleWords(path) || /^public\/.+\.(png|jpe?g|svg|webp|ico|css)$/.test(path) || /^(index\.html|scripts\/(resume|og-image)\.mjs)$/.test(path)),
  'senior-recruiter': (path) => !test(path) && (/^src\/(?!admin\/)/.test(path) || /^public\//.test(path) || /^functions\/(api\/ask|_lib\/ask\/|_lib\/assistant-input)/.test(path) || /^scripts\/(resume|assistant)/.test(path)),
  // The PM checks the acceptance criteria: a spec, or code that has to meet one.
  'product-manager': (path) => spec(path) || !docs(path),
}
const reasons = {
  'senior-developer': 'only text changed (specs, Markdown, a write-up\'s numbers)',
  'senior-tester': 'only text changed (specs, Markdown, a write-up\'s numbers)',
  'security-engineer': 'nothing on the server, in the build, the scripts, the assistant or the admin changed',
  'ux-designer': 'no page, component, style, image or résumé layout changed',
  'senior-recruiter': 'nothing a recruiter reads changed (pages, résumé, write-ups, the assistant)',
  'product-manager': 'there is no spec and no code to hold to one',
}

// A role id from the name a lead wrote ("Senior developer (code)", "security-engineer").
export const roleId = (name) => {
  const text = String(name ?? '').toLowerCase()
  if (/secur/.test(text)) return 'security-engineer'
  if (/test/.test(text)) return 'senior-tester'
  if (/design|ux/.test(text)) return 'ux-designer'
  if (/recruit/.test(text)) return 'senior-recruiter'
  if (/product|\bpm\b/.test(text)) return 'product-manager'
  if (/develop|code|engineer/.test(text)) return 'senior-developer'
  return null
}

export const roster = ({ changed, branch = '', previous = null, since = null }) => {
  const files = changed.filter(Boolean)
  const full = files.some(rules)
  // A Site update always has a spec (the team writes one first), so its PM checks it.
  let wanted = full ? [...ROLES] : ROLES.filter((role) => files.some(parts[role]) || (role === 'product-manager' && branch.startsWith('update/')))
  if (!wanted.length) wanted = ['senior-developer'] // somebody always looks
  const before = new Map((previous?.roles ?? []).map((entry) => [roleId(entry.role), entry]))
  const sha = /^[0-9a-f]{40}$/.test(previous?.sha ?? '') ? previous.sha : null
  const run = [], carried = []
  for (const role of wanted) {
    const earlier = before.get(role)
    const touched = !sha || since === null || since.some((path) => rules(path) || parts[role](path))
    if (earlier?.verdict === 'APPROVE' && !touched) carried.push({ role, verdict: 'APPROVE', blockers: 0, majors: 0, summary: `Approved on ${sha.slice(0, 7)}; nothing it reviews changed since. ${String(earlier.summary ?? '').slice(0, 400)}`.trim() })
    else run.push(role)
  }
  const skipped = ROLES.filter((role) => !wanted.includes(role)).map((role) => ({ role, verdict: 'NOT_APPLICABLE', blockers: 0, majors: 0, summary: `Not on this panel: ${reasons[role]}.` }))
  return { full, run, carried, skipped }
}

const lines = (path) => (existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [])

// The command line's answer, from its arguments: an unreadable verdicts file reads as none.
export const fromArgs = ([changedFile = '', branch = '', previousFile, sinceFile]) => {
  let previous = null
  try { previous = previousFile && existsSync(previousFile) ? JSON.parse(readFileSync(previousFile, 'utf8')) : null } catch { previous = null }
  const since = !sinceFile || sinceFile === '-' ? null : lines(sinceFile)
  return roster({ changed: lines(changedFile), branch, previous, since })
}

/* c8 ignore next 3 -- the entry point; fromArgs is tested in-process and the file as a process */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.stdout.write(`${JSON.stringify(fromArgs(process.argv.slice(2)))}\n`)
}
