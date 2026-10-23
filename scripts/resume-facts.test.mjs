// @vitest-environment node
// The hiring logistics are typed only in src/resume.ts (AC-1). The tree is read at run
// time, so a file added since the last run is scanned too (a transform-time glob is not).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { profile } from '../src/resume'

const root = fileURLToPath(new URL('..', import.meta.url))
const sources = () => ['src', 'functions', 'scripts']
  .flatMap((folder) => readdirSync(join(root, folder), { recursive: true }).map((file) => join(folder, String(file)).replaceAll('\\', '/')))
  .filter((file) => /\.(?:ts|tsx|mjs)$/.test(file) && !/\.test\./.test(file) && !file.includes('node_modules/'))

describe('the hiring logistics', () => {
  it('types the logistics values only in src/resume.ts', () => {
    const values = [profile.citizenship, profile.workArrangement, profile.travel, profile.employers, profile.relocation].map((value) => value.toLowerCase())
    const files = sources()
    expect(files).toContain('functions/_lib/ask/prompt.ts')
    expect(files).toContain('scripts/resume.mjs')
    expect(files).toContain('src/App.tsx')
    const hits = files.filter((file) => file !== 'src/resume.ts').filter((file) => values.some((value) => readFileSync(join(root, file), 'utf8').toLowerCase().includes(value)))
    expect(hits, 'a value typed outside src/resume.ts').toEqual([])
  })
})
