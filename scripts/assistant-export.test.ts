// @vitest-environment node
// Job A's command line (scripts/assistant-export.ts): it writes the input, or says the check did
// not run; it never writes a file without the notes.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { NotReady } from '../functions/_lib/assistant-input'
import { runExport } from './assistant-export'

const dir = mkdtempSync(join(tmpdir(), 'assistant-export-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe("job A's export", () => {
  it('writes the input built from the dist folder and the notes address', async () => {
    writeFileSync(join(dir, 'building-this-site.md'), '# The site\n\nHow it was built.')
    const out = join(dir, 'branch.json')
    const lines: string[] = []
    const seen: { page: string | null; url?: string }[] = []
    const build = (async ({ readPage, notesUrl }: { readPage: (path: string) => Promise<string | null>; notesUrl?: string }) => {
      seen.push({ page: await readPage('/building-this-site.md'), url: notesUrl })
      seen.push({ page: await readPage('/missing.md') })
      return { model: 'claude-opus-5-5', system: 'xyz', notes: 2, articles: 1 }
    }) as never
    expect(await runExport([dir, 'https://example.test/api/notes', out], { build, log: (line) => lines.push(line) })).toBe(0)
    expect(JSON.parse(readFileSync(out, 'utf8'))).toMatchObject({ model: 'claude-opus-5-5', notes: 2 })
    expect(seen).toEqual([{ page: '# The site\n\nHow it was built.', url: 'https://example.test/api/notes' }, { page: null }])
    expect(lines).toEqual(["The assistant's input: claude-opus-5-5, 3 characters of system prompt, 2 public notes, 1 write-ups."])
  })

  it('exits 1 with "did not run" and writes nothing when the notes cannot be read', async () => {
    const lines: string[] = []
    let written = false
    const build = (async () => { throw new NotReady('The public notes could not be read from x: it answered 404.') }) as never
    expect(await runExport([dir, 'x', join(dir, 'never.json')], { build, write: async () => { written = true }, error: (line) => lines.push(line) })).toBe(1)
    expect(lines).toEqual(['::error::The assistant check did not run: The public notes could not be read from x: it answered 404.'])
    expect(written).toBe(false)
    expect(await runExport([dir, 'x', 'y'], { build: (async () => { throw 'odd' }) as never, error: (line) => lines.push(line) })).toBe(1)
    expect(lines.at(-1)).toBe('::error::The assistant check did not run: odd')
  })

  it('asks for its three arguments', async () => {
    const lines: string[] = []
    expect(await runExport([dir], { error: (line) => lines.push(line) })).toBe(2)
    expect(lines[0]).toMatch(/^Usage:/)
  })
})

describe("job A's built bundle, as the workflow builds and runs it", () => {
  // The exact commands of review.yml's assistant-input job: built inside the checkout, so its imports
  // (the model client among them) resolve from node_modules, then run with node. Real build: slow.
  it('builds with vite --ssr inside the checkout and runs with node, writing the input', () => {
    const root = join(import.meta.dirname, '..')
    const outDir = '.assistant-export-test'
    const site = mkdtempSync(join(tmpdir(), 'assistant-export-dist-'))
    try {
      writeFileSync(join(site, 'building-this-site.md'), '# The site\n\nHow it was built.')
      execFileSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--ssr', 'scripts/assistant-export.ts', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: root, stdio: 'pipe' })
      const out = join(site, 'branch.json')
      const log = execFileSync(process.execPath, [join(outDir, 'assistant-export.js'), site, 'data:application/json,{"notes":[]}', out], { cwd: root, encoding: 'utf8' })
      expect(log).toMatch(/^The assistant's input: claude-[a-z0-9.-]+, \d+ characters of system prompt, 0 public notes, 1 write-ups\.\n$/)
      expect(JSON.parse(readFileSync(out, 'utf8'))).toMatchObject({ schema: 'assistant-input/1', notes: 0, articles: 1 })
    } finally {
      rmSync(join(root, outDir), { recursive: true, force: true })
      rmSync(site, { recursive: true, force: true })
    }
  }, 120_000)
})
