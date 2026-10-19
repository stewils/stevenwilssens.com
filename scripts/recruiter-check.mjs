// The recruiter's bar for a merge into main: the change must not make the site worse
// for recruiters. Runs the same review as the MCP tool review_for_recruiters
// (functions/_lib/review/recruiter.ts) on the pages of a build and the resume report
// it wrote, and compares it with main: the score may not drop and no new high finding
// may appear. LinkedIn is left out (it lives in the MCP server, not in the repository).
//
//   npm run build && node scripts/recruiter-check.mjs                 (this build against main)
//   node scripts/recruiter-check.mjs --pages https://steven.wilssens.com --json live.json
//   node scripts/recruiter-check.mjs --baseline-ref origin/main --summary out.md
//   node scripts/recruiter-check.mjs --compare base.json
//
// --pages is a dist folder (default dist) or a site address; --baseline-ref checks the
// ref out next to the repository, reads its src/resume.ts and the live pages, and
// compares; --compare reads a baseline written with --json. Exit code 1 when worse.
import { execFileSync } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const { values: options } = parseArgs({ options: {
  pages: { type: 'string', default: 'dist' },
  'baseline-ref': { type: 'string' },
  'baseline-pages': { type: 'string', default: 'https://steven.wilssens.com' },
  compare: { type: 'string' },
  json: { type: 'string' },
  summary: { type: 'string' },
} })

// The functions import their siblings without an extension, the way Vite resolves them.
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context) } catch (error) {
      if (!specifier.startsWith('.')) throw error
      for (const suffix of ['.ts', '.tsx', '/index.ts']) {
        try { return next(specifier + suffix, context) } catch { /* try the next one */ }
      }
      throw error
    }
  },
})

const root = resolve(fileURLToPath(import.meta.url), '../..')
const { markdownPath } = await import(pathToFileURL(join(root, 'src/pageMeta.ts')).href)
const { reviewForRecruiters } = await import(pathToFileURL(join(root, 'functions/_lib/review/recruiter.ts')).href)

const read = async (source, path) => {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(new URL(path, source)).catch(() => null)
    return response?.ok ? response.text() : null
  }
  const file = join(source, path)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

const review = async (source) => {
  const pages = Object.fromEntries(await Promise.all(['home', 'about', 'experience', 'work', 'recommendations'].map(async (page) => [page, await read(source, markdownPath(page))])))
  let resumeReport = null
  try { resumeReport = JSON.parse(await read(source, '/resume-report.json') ?? 'null') } catch { /* no report */ }
  return reviewForRecruiters({ pages, resumeReport, linkedin: null, now: Date.now() })
}

// The baseline: the ref's own src/resume.ts with this script and the recruiter review copied in, on the live pages.
const baselineFromRef = (ref) => {
  const dir = mkdtempSync(join(tmpdir(), 'recruiter-base-'))
  try {
    execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { cwd: root, stdio: 'ignore' })
    copyFileSync(fileURLToPath(import.meta.url), join(dir, 'scripts/recruiter-check.mjs'))
    const out = join(dir, 'base.json')
    execFileSync(process.execPath, [join(dir, 'scripts/recruiter-check.mjs'), '--pages', options['baseline-pages'], '--json', out], { cwd: dir, stdio: 'ignore' })
    return JSON.parse(readFileSync(out, 'utf8'))
  } finally {
    try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'ignore' }) } catch { rmSync(dir, { recursive: true, force: true }) }
  }
}

const key = (finding) => `${finding.area}|${finding.finding}`
const current = await review(/^https?:\/\//.test(options.pages) ? options.pages : resolve(options.pages))
if (options.json) writeFileSync(options.json, JSON.stringify(current, null, 2))

let baseline = null
if (options.compare) baseline = JSON.parse(readFileSync(options.compare, 'utf8'))
else if (options['baseline-ref'] || !options.json) baseline = baselineFromRef(options['baseline-ref'] ?? 'origin/main')

const lines = [`### Recruiter check: ${current.score}/100${baseline ? ` (main: ${baseline.score}/100)` : ''}`, '', current.headline, '']
let worse = false
if (baseline) {
  const before = new Set(baseline.findings.map(key))
  const added = current.findings.filter((finding) => !before.has(key(finding)))
  const after = new Set(current.findings.map(key))
  const fixed = baseline.findings.filter((finding) => !after.has(key(finding)))
  const newHigh = added.filter((finding) => finding.severity === 'high')
  worse = current.score < baseline.score || newHigh.length > 0
  lines.push(worse ? '**Worse for recruiters than main.**' : '**Not worse for recruiters than main.**', '')
  for (const finding of added) lines.push(`- New (${finding.severity}) ${finding.area}: ${finding.finding} Fix: ${finding.fix}`)
  for (const finding of fixed) lines.push(`- Fixed (${finding.severity}) ${finding.area}: ${finding.finding}`)
} else {
  for (const finding of current.findings) lines.push(`- (${finding.severity}) ${finding.area}: ${finding.finding}`)
}
const text = lines.join('\n')
console.log(text)
if (options.summary) appendFileSync(options.summary, text + '\n')
process.exit(worse ? 1 : 0)
