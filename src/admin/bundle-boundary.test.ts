// The rating UI and its maths ship only in the admin bundle (specs/ask-ratings.md, AC-14): no
// module under src/admin/ is reachable from the public entries. The walk follows every static
// import and export, side-effect import and dynamic import() by relative path, over the source
// files as Vite reads them.
import { describe, expect, it } from 'vitest'

const files = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.*'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const specifiers = /(?:^|[\s;])(?:import|export)\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

// A relative specifier from a file, as a path from the root ('/src/admin/askQuality.ts').
const resolveFrom = (from: string, specifier: string, known: Record<string, string>) => {
  if (!specifier.startsWith('.')) return null
  const parts = from.split('/').slice(0, -1)
  for (const part of specifier.split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '.') parts.push(part)
  }
  const base = parts.join('/')
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) => candidate in known) ?? base
}
// Every file an entry reaches.
const reach = (entry: string, known: Record<string, string> = files) => {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const match of (known[file] ?? '').matchAll(specifiers)) {
      const found = resolveFrom(file, match[1] ?? match[2] ?? match[3], known)
      if (found) queue.push(found)
    }
  }
  return [...seen]
}
const admin = (list: string[]) => list.filter((file) => file.startsWith('/src/admin/'))

describe('the public bundle', () => {
  it('nothing the public entries import comes from src/admin', () => {
    for (const entry of ['/src/main.tsx', '/src/entry-server.tsx']) {
      const reached = reach(entry)
      expect(reached.length, entry).toBeGreaterThan(20)
      expect(reached).toContain('/src/ask/markdown.ts')
      expect(admin(reached), entry).toEqual([])
    }
    // The admin entry does reach them, so the walk reads what it should.
    expect(admin(reach('/src/admin/main.tsx'))).toEqual(expect.arrayContaining(['/src/admin/askQuality.ts', '/src/admin/RatingForm.tsx', '/src/admin/RateAnswers.tsx']))
  })

  it('the walk finds an admin module when an entry does import one: statically, for its side effects or later', () => {
    const fixture = (source: string) => admin(reach('/src/fixture.tsx', { ...files, '/src/fixture.tsx': source }))
    expect(fixture("import { verdict } from './admin/askQuality'\nexport const x = verdict")).toContain('/src/admin/askQuality.ts')
    expect(fixture("import './admin/admin.css'")).toEqual(['/src/admin/admin.css'])
    expect(fixture("export const later = () => import('./admin/RatingForm')")).toEqual(expect.arrayContaining(['/src/admin/RatingForm.tsx', '/src/admin/askQuality.ts']))
    expect(fixture("export { pct } from './admin/askQuality'")).toContain('/src/admin/askQuality.ts')
    expect(fixture("import App from './App.tsx'")).toEqual([])
  })
})
