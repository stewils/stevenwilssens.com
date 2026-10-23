// @vitest-environment node
// The résumé as data (scripts/resume-data.mjs) and the email reading it without importing a
// branch file (scripts/resume-mail.mjs --resume-json, --no-import).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { main, resumeAt } from './resume-data.mjs'
import { loadResumeAt, setResumeJson } from './resume-mail.mjs'

const dir = mkdtempSync(join(tmpdir(), 'resume-data-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
afterEach(() => setResumeJson([], false))

describe('the résumé data at a commit', () => {
  it("reads src/resume.ts at HEAD as its exports, and null where the commit has no such file", async () => {
    const data = await resumeAt('HEAD')
    expect(data.profile.name).toBe('Steven Wilssens')
    expect(Array.isArray(data.experiences)).toBe(true)
    expect(await resumeAt('no-such-commit-anywhere')).toBeNull()
  }, 30_000)

  it('writes it as JSON, and asks for its two arguments', async () => {
    const written = {}
    const logs = []
    expect(await main(['HEAD', 'out.json'], { write: (path, text) => { written[path] = text }, log: (line) => logs.push(line) })).toBe(0)
    expect(JSON.parse(written['out.json']).profile.name).toBe('Steven Wilssens')
    expect(logs[0]).toMatch(/^The résumé data at HEAD: \d+ exports\.$/)
    expect(await main(['no-such-commit-anywhere', 'none.json'], { write: (path, text) => { written[path] = text }, log: (line) => logs.push(line) })).toBe(0)
    expect(written['none.json']).toBe('null')
    expect(logs.at(-1)).toMatch(/no src\/resume\.ts/)
    expect(await main(['HEAD'], { log: () => {} })).toBe(2)
  }, 30_000)
})

describe('the email reads the data, never a branch file', () => {
  it('takes a commit\'s résumé from its JSON, and with --no-import refuses a commit without one', async () => {
    const file = join(dir, 'after.json')
    writeFileSync(file, JSON.stringify({ profile: { name: 'From JSON' } }))
    setResumeJson([`refs/heads/update/x-1=${file}`], true)
    expect(await loadResumeAt('refs/heads/update/x-1')).toEqual({ profile: { name: 'From JSON' } })
    await expect(loadResumeAt('HEAD')).rejects.toThrow(/No résumé data for HEAD, and this run imports no résumé file/)
    expect(() => setResumeJson(['no-equals-sign'])).toThrow(/--resume-json takes <ref>=<file>/)
    expect(readFileSync(file, 'utf8')).toContain('From JSON')
  })

  it('without the options it still reads the commit itself (the live email after a deploy)', async () => {
    expect((await loadResumeAt('HEAD')).profile.name).toBe('Steven Wilssens')
  }, 30_000)
})
