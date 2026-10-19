// @vitest-environment node
// The Team page's manifest is public repository text in a public bundle: it must reach the
// DOM as text only, and it must stay in the admin (never on a public page, in the assistant,
// WebMCP or the MCP server). Both are checked on the source here.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const posix = (path: string) => relative(root, path).split('\\').join('/')
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? walk(path) : [path]
})
const isSource = (path: string) => /\.(ts|tsx|mjs|js)$/.test(path) && !/\.test\.(ts|tsx|mjs)$/.test(path) && !path.endsWith('.d.ts')

// The static imports of a file: `import … from '…'`, `export … from '…'` and `import('…')`.
const importsOf = (text: string) => [...text.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm)].map((match) => match[1] ?? match[2] ?? match[3])
const resolveImport = (from: string, specifier: string) => {
  if (!specifier.startsWith('.')) return specifier
  const base = resolve(dirname(from), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, join(base, 'index.ts'), join(base, 'index.tsx')]) if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  return base
}

// Every file reachable through static imports from the entries, and whether one of them is the manifest or the admin.
const reach = (entries: string[]) => {
  const seen = new Set<string>()
  const hits: string[] = []
  const queue = [...entries]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const name = posix(file)
    if (file === 'virtual:team-manifest' || name === 'scripts/team-manifest.mjs' || name.startsWith('src/admin/')) { hits.push(file === 'virtual:team-manifest' ? file : name); continue }
    if (!existsSync(file) || !/\.(ts|tsx|mjs|js)$/.test(file)) continue
    for (const specifier of importsOf(readFileSync(file, 'utf8'))) queue.push(resolveImport(file, specifier))
  }
  return { hits, seen }
}

describe('the Team page renders text only', () => {
  it('has no raw HTML and no Markdown renderer in its sources', () => {
    for (const file of ['TeamPage.tsx', 'FlowDiagram.tsx', 'team-state.ts', 'team-types.ts']) {
      const text = readFileSync(join(root, 'src/admin', file), 'utf8')
      expect(text, file).not.toMatch(/dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML/)
      expect(importsOf(text).filter((specifier) => /markdown|marked|remark|rehype|mdx/i.test(specifier)), file).toEqual([])
    }
  })
})

describe('the manifest stays in the admin', () => {
  it('is imported by nothing outside src/admin', () => {
    const files = [...walk(join(root, 'src')), ...walk(join(root, 'functions'))].filter(isSource).filter((path) => !posix(path).startsWith('src/admin/'))
    for (const file of files) {
      const imports = importsOf(readFileSync(file, 'utf8'))
      expect(imports.filter((specifier) => specifier === 'virtual:team-manifest' || specifier.endsWith('team-manifest.mjs')), posix(file)).toEqual([])
    }
  })

  it('is not reachable from the public pages, the prerender, WebMCP, the assistant, the write-ups or the Pages Functions', () => {
    const entries = [
      'src/main.tsx', 'src/entry-server.tsx', 'src/webmcp.ts',
      ...walk(join(root, 'src/ask')).map(posix), ...walk(join(root, 'src/articles')).map(posix), ...walk(join(root, 'functions')).map(posix),
    ].filter((path) => isSource(path)).map((path) => join(root, path))
    const { hits, seen } = reach(entries)
    expect(hits).toEqual([])
    // The walk does follow imports (it would have seen the manifest).
    expect([...seen].some((file) => posix(file) === 'src/resume.ts')).toBe(true)
  })

  it('would be found if a public module imported the admin', () => {
    const { hits } = reach([join(root, 'src/admin/Admin.tsx')])
    expect(hits).toEqual(['src/admin/Admin.tsx'])
    expect(importsOf("import manifest from 'virtual:team-manifest'\nconst x = import('./a')\nimport './side.css'\nexport { y } from './b'")).toEqual(['virtual:team-manifest', './a', './side.css', './b'])
  })
})
