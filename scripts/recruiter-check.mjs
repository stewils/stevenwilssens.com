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
// --pages is a dist folder (default dist) or a site address. --baseline-ref checks the
// ref out in a worktree under .review/ (ignored by git, and inside the repository so
// packages resolve), copies this script, scripts/recruiter-compare.mjs and this branch's
// functions/_lib/review/ in (both sides are scored by the same checker), and reviews the
// ref's src/resume.ts on --baseline-pages (default the live site): "main's data on the
// live pages", not a build of main. --compare reads a baseline written with --json.
// Exit code 1 when worse; 2 when the baseline is unavailable (a page or the resume
// report could not be read, or the baseline run failed), so an outage never passes as
// "not worse".
import { execFileSync } from 'node:child_process'
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { missingSources, reviewedPages, summarize } from './recruiter-compare.mjs'

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
  const pages = Object.fromEntries(await Promise.all(reviewedPages.map(async (page) => [page, await read(source, markdownPath(page))])))
  let resumeReport = null
  try { resumeReport = JSON.parse(await read(source, '/resume-report.json') ?? 'null') } catch { /* no report */ }
  return { ...reviewForRecruiters({ pages, resumeReport, linkedin: null, now: Date.now() }), missing: missingSources(pages, resumeReport) }
}

const unavailable = (why) => {
  console.error(`Recruiter check: the baseline is unavailable (${why}); not comparing. Re-run when it can be read.`)
  process.exit(2)
}

// The baseline: the ref's own src/resume.ts, scored by this branch's script and recruiter review, on --baseline-pages.
const baselineFromRef = (ref) => {
  mkdirSync(join(root, '.review'), { recursive: true })
  const dir = mkdtempSync(join(root, '.review', '.recruiter-base-'))
  try {
    execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { cwd: root, stdio: 'ignore' })
    for (const file of ['scripts/recruiter-check.mjs', 'scripts/recruiter-compare.mjs']) copyFileSync(join(root, file), join(dir, file))
    rmSync(join(dir, 'functions/_lib/review'), { recursive: true, force: true })
    cpSync(join(root, 'functions/_lib/review'), join(dir, 'functions/_lib/review'), { recursive: true })
    const out = join(dir, 'base.json')
    // The child's errors reach the log; its summary does not (it would read like this run's).
    execFileSync(process.execPath, [join(dir, 'scripts/recruiter-check.mjs'), '--pages', options['baseline-pages'], '--json', out], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] })
    return JSON.parse(readFileSync(out, 'utf8'))
  } catch (error) {
    return { failed: `the baseline run on ${ref} failed: ${error.message.split('\n')[0]}` }
  } finally {
    try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'ignore' }) } catch { rmSync(dir, { recursive: true, force: true }) }
  }
}

const current = await review(/^https?:\/\//.test(options.pages) ? options.pages : resolve(options.pages))
if (options.json) writeFileSync(options.json, JSON.stringify(current, null, 2))

let baseline = null
let label = 'the baseline'
if (options.compare) baseline = JSON.parse(readFileSync(options.compare, 'utf8'))
else if (options['baseline-ref'] || !options.json) {
  const ref = options['baseline-ref'] ?? 'origin/main'
  baseline = baselineFromRef(ref)
  label = `${ref.replace(/^origin\//, '')}'s data on ${/^https?:\/\//.test(options['baseline-pages']) ? 'the live pages' : options['baseline-pages']}`
}
if (baseline?.failed) unavailable(baseline.failed)
if (baseline?.missing?.length) unavailable(`could not read ${baseline.missing.join(', ')}`)

const { worse, text } = summarize(current, baseline, label)
console.log(text)
if (options.summary) appendFileSync(options.summary, `${text}\n`)
process.exit(worse ? 1 : 0)
