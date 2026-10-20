// @vitest-environment node
// The development costs are Steven's only (specs/dev-costs.md AC-28 to AC-32, S-13): no public
// page, prerender, assistant, MCP server, WebMCP tool, write-up or public API may reach the costs
// code or name its tables, and nothing of it may reach the mail code. Checked on the source, with
// the same import walk as team-safety.test.mjs and a positive control. Also the two style rules
// the design holds the page to (D-10, D-12).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const posix = (path) => relative(root, path).split('\\').join('/')
const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? walk(path) : [path]
}) : [])
const isSource = (path) => /\.(ts|tsx|mjs|js)$/.test(path) && !/\.test\.(ts|tsx|mjs)$/.test(path) && !path.endsWith('.d.ts')
const importsOf = (text) => [...text.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm)].map((match) => match[1] ?? match[2] ?? match[3])
const resolveImport = (from, specifier) => {
  if (!specifier.startsWith('.') && !isAbsolute(specifier)) return specifier
  const base = resolve(dirname(from), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, join(base, 'index.ts'), join(base, 'index.tsx')]) if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  return base
}

// The costs code: the server modules and routes, the admin page and its helpers.
const isCosts = (name) => name.startsWith('functions/_lib/costs/') || /^functions\/api\/costs(\.ts|\/)/.test(name) || name === 'src/admin/CostsPage.tsx' || name === 'src/admin/costs.ts' || name === '.claude/hooks/dev-costs.mjs'
const reach = (entries, isTarget = isCosts) => {
  const seen = new Set()
  const hits = []
  const queue = [...entries]
  while (queue.length) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const name = posix(file)
    if (isTarget(name)) { hits.push(name); continue }
    if (!existsSync(file) || !/\.(ts|tsx|mjs|js)$/.test(file)) continue
    for (const specifier of importsOf(readFileSync(file, 'utf8'))) queue.push(resolveImport(file, specifier))
  }
  return { hits, seen }
}

// Everything the public side runs: the pages and their prerender, the assistant, the MCP servers,
// WebMCP, the write-ups, the public APIs and the middleware.
const publicEntries = () => [
  'src/main.tsx', 'src/entry-server.tsx', 'src/webmcp.ts', 'scripts/prerender.mjs', 'functions/_middleware.ts', 'functions/mcp.ts', 'functions/api/mcp.ts', 'functions/api/collect.ts', 'functions/api/ask.ts',
  ...walk(join(root, 'src/ask')).map(posix), ...walk(join(root, 'src/articles')).map(posix), ...walk(join(root, 'functions/_lib/ask')).map(posix), ...walk(join(root, 'functions/_lib/mcp')).map(posix),
  ...walk(join(root, 'functions/api/building')).map(posix), ...walk(join(root, 'functions/api/ask')).map(posix), ...walk(join(root, 'functions/mcp')).map(posix),
].filter(isSource).map((path) => join(root, path))

describe('the costs stay in the admin', () => {
  it('are not reachable from the public pages, the prerender, the assistant, the MCP servers, WebMCP, the write-ups or the public APIs', () => {
    const { hits, seen } = reach(publicEntries())
    expect(hits).toEqual([])
    // The walk does follow imports: the assistant reaches the price table, which holds no cost data.
    expect([...seen].map(posix)).toContain('functions/_lib/prices.ts')
    expect(importsOf(readFileSync(join(root, 'functions/_lib/prices.ts'), 'utf8'))).toEqual([])
  })

  it('would be found through another module (the positive control)', () => {
    const temp = mkdtempSync(join(tmpdir(), 'costs-safety-'))
    try {
      const middle = join(temp, 'middle.ts')
      writeFileSync(middle, `import { buildViews } from '${join(root, 'functions/_lib/costs/views').split('\\').join('/')}'\nexport const x = buildViews`)
      writeFileSync(join(temp, 'entry.ts'), "import { x } from './middle'\nexport default x")
      const { hits } = reach([join(temp, 'entry.ts')])
      expect(hits).toEqual(['functions/_lib/costs/views.ts'])
    } finally { rmSync(temp, { recursive: true, force: true }) }
  })

  it('name their tables only in the costs modules and the migration', () => {
    const files = [...walk(join(root, 'src')), ...walk(join(root, 'functions')), ...walk(join(root, 'scripts')).filter((path) => !path.includes('fixtures'))].filter(isSource)
    const naming = files.filter((file) => /dev_cost_/.test(readFileSync(file, 'utf8'))).map(posix)
    expect(naming.every((name) => name.startsWith('functions/_lib/costs/')), naming.join(', ')).toBe(true)
    expect(readFileSync(join(root, 'migrations/0013_dev_costs.sql'), 'utf8')).toContain('CREATE TABLE IF NOT EXISTS dev_cost_runs')
  })

  it('give the private MCP server no costs tool, and send no mail', () => {
    for (const file of walk(join(root, 'functions/_lib/mcp')).filter(isSource)) expect(readFileSync(file, 'utf8'), posix(file)).not.toMatch(/dev_cost|\/api\/costs|costs\/(views|store|ingest)/)
    const costs = [...walk(join(root, 'functions/_lib/costs')), join(root, 'functions/api/costs.ts'), join(root, 'functions/api/costs/budget.ts'), join(root, 'src/admin/CostsPage.tsx'), join(root, 'src/admin/costs.ts'), join(root, '.claude/hooks/dev-costs.mjs')].filter(isSource)
    const { seen } = reach(costs, () => false)
    expect([...seen].map(posix).filter((name) => /mail/i.test(name))).toEqual([])
  })
})

describe('the Costs page’s styles', () => {
  const css = readFileSync(join(root, 'src/admin/admin.css'), 'utf8')

  it('makes the budget field and its buttons 44px high', () => {
    expect(css).toMatch(/\.budget-form input \{[^}]*min-height: 44px/)
    expect(css).toMatch(/\.budget-form button \{[^}]*min-height: 44px/)
  })

  it('adds one colour token, --series-soft, in all three theme blocks', () => {
    const tokens = (text) => new Set([...text.matchAll(/(--[\w-]+):/g)].map((match) => match[1]))
    expect(css.match(/--series-soft:/g)).toHaveLength(3)
    let main = null
    try { main = execFileSync('git', ['show', 'origin/main:src/admin/admin.css'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { /* no origin/main here */ }
    if (main) expect([...tokens(css)].filter((token) => !tokens(main).has(token))).toEqual(['--series-soft'])
  })
})
