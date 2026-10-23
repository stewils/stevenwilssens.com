// The résumé data at a commit, as JSON. The Site update workflow's `resume-data` job runs this,
// with no secret, on main's commit and on the branch, so the email job (which holds the mail
// password) reads the branch's résumé as data and never imports a file from the branch
// (scripts/resume-mail.mjs --resume-json, --no-import).
//
//   node scripts/resume-data.mjs <ref> <out.json>
//
// src/resume.ts is plain data with no imports, so a copy anywhere imports the same; Node strips
// the types. A commit without the file writes null. Only node: built-ins and git.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

/** The exports of src/resume.ts as they were at a commit, or null when the file did not exist there. */
export async function resumeAt(ref) {
  let source
  try { source = git('show', `${ref}:src/resume.ts`) } catch { return null }
  const dir = resolve(tmpdir(), 'resume-data')
  mkdirSync(dir, { recursive: true })
  const file = resolve(dir, `resume-${git('rev-parse', '--short', ref).trim()}-${Date.now()}.ts`)
  writeFileSync(file, source)
  return { ...(await import(pathToFileURL(file).href)) }
}

export const main = async ([ref, out] = [], { write = writeFileSync, log = console.log } = {}) => {
  if (!ref || !out) {
    log('Usage: node scripts/resume-data.mjs <ref> <out.json>')
    return 2
  }
  const data = await resumeAt(ref)
  write(out, JSON.stringify(data))
  log(`The résumé data at ${ref}: ${data ? `${Object.keys(data).length} exports` : 'no src/resume.ts'}.`)
  return 0
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exit(await main(process.argv.slice(2)))
