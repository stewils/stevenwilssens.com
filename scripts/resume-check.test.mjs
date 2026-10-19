// The résumé gate's command line (scripts/resume-check.mjs --baseline … --fail-on-drop), run
// as the Review workflow runs it, on the committed PDF against baseline files. The exit
// codes themselves are scripts/resume-gate.mjs (resume-gate.test.mjs); this checks that the
// flags reach it. No network: every baseline is a local file.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const script = resolve(import.meta.dirname, 'resume-check.mjs')
const env = { ...process.env, GITHUB_ACTIONS: '', RESUME_BASELINE: '' }
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 60_000, env })

let dir
let score
const baselineFile = (name, value) => { const path = join(dir, name); writeFileSync(path, JSON.stringify({ score: value })); return path }

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'resume-check-'))
  const result = run('--json', join(dir, 'current.json'))
  expect(result.status, result.stderr).toBe(0)
  score = JSON.parse(readFileSync(join(dir, 'current.json'), 'utf8')).score
  expect(typeof score).toBe('number')
}, 120_000)

afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

describe('resume-check --fail-on-drop', () => {
  it('exits 2 when the baseline cannot be read', () => {
    const result = run('--baseline', join(dir, 'nowhere.json'), '--fail-on-drop')
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('could not be read; the ATS score is not compared')
  }, 60_000)

  it('exits 1 when the score is lower than the baseline', () => {
    const result = run('--baseline', baselineFile('higher.json', score + 1), '--fail-on-drop')
    expect(result.status, result.stderr).toBe(1)
    expect(result.stdout).toContain('LOWER than')
  }, 60_000)

  it('exits 0 when the score equals the baseline', () => {
    const result = run('--baseline', baselineFile('equal.json', score), '--fail-on-drop')
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('the same as')
  }, 60_000)

  it('only reports an unreadable baseline without --fail-on-drop', () => {
    const result = run('--baseline', join(dir, 'nowhere.json'))
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('No baseline could be read from')
  }, 60_000)
})
