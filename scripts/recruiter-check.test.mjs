// The recruiter gate's exit codes (scripts/recruiter-check.mjs), run as the Review workflow
// runs it: on a folder of pages, compared with a baseline file. No git and no network.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const script = resolve(import.meta.dirname, 'recruiter-check.mjs')
const files = { 'index.md': '# Steven Wilssens', 'about.md': '# About', 'experience.md': '# Experience', 'work.md': '# Work', 'recommendations.md': '# Recommendations' }

let dir
let current
const run = (...args) => spawnSync(process.execPath, [script, '--pages', join(dir, 'pages'), ...args], { encoding: 'utf8', timeout: 60_000 })
const baselineFile = (name, baseline) => { const path = join(dir, name); writeFileSync(path, JSON.stringify(baseline)); return path }

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'recruiter-check-'))
  const pages = join(dir, 'pages')
  mkdirSync(pages)
  for (const [file, text] of Object.entries(files)) writeFileSync(join(pages, file), text)
  writeFileSync(join(pages, 'resume-report.json'), JSON.stringify({ score: 100, errors: 0, warnings: 0, findings: [], questions: [] }))
  // This run writes the current review; the same file is the "equal" baseline.
  const result = run('--json', join(dir, 'current.json'), '--compare', join(dir, 'current.json'))
  expect(result.status, result.stderr).toBe(0)
  current = JSON.parse(readFileSync(join(dir, 'current.json'), 'utf8'))
}, 120_000)

afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

describe('the recruiter check exit code', () => {
  it('is 0 when the pages are as good as the baseline', () => {
    expect(current.missing).toEqual([])
    const result = run('--compare', baselineFile('equal.json', current))
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Not worse for recruiters')
  }, 60_000)

  it('is 1 when the score is lower than the baseline', () => {
    const result = run('--compare', baselineFile('better.json', { ...current, score: current.score + 1 }))
    expect(result.status, result.stderr).toBe(1)
    expect(result.stdout).toContain('Worse for recruiters')
  }, 60_000)

  it('is 2 when the baseline could not read a page', () => {
    const result = run('--compare', baselineFile('missing.json', { ...current, missing: ['page work'] }))
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('baseline is unavailable (could not read page work)')
    expect(result.stdout).toBe('')
  }, 60_000)

  it('is 2 when the baseline run failed', () => {
    const result = run('--compare', baselineFile('failed.json', { failed: 'the baseline run on origin/main failed: boom' }))
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('baseline run on origin/main failed')
  }, 60_000)

  it('is 2 when the baseline file cannot be read', () => {
    const missing = run('--compare', join(dir, 'nowhere.json'))
    expect(missing.status).toBe(2)
    expect(missing.stderr).toContain('baseline is unavailable (could not read')
    writeFileSync(join(dir, 'broken.json'), '{ not json')
    expect(run('--compare', join(dir, 'broken.json')).status).toBe(2)
  }, 60_000)
})
