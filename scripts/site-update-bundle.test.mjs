// @vitest-environment node
// The publish job's hand-over check (scripts/site-update-bundle.mjs), on real git
// repositories in a temporary folder: the update job's repository makes the bundle, a
// fresh clone of main (the publish job's checkout) takes it.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BRANCH, main, takeBundle } from './site-update-bundle.mjs'

const root = mkdtempSync(join(tmpdir(), 'site-update-bundle-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'init.defaultBranch=main', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const write = (cwd, path, text) => {
  mkdirSync(join(cwd, path, '..'), { recursive: true })
  writeFileSync(join(cwd, path), text)
}
let count = 0
// The update job's side: main with one commit, then the branch with `change` applied, bundled from main.
const updateRepo = (branch, change) => {
  const dir = join(root, `update-${++count}`)
  mkdirSync(dir)
  git(dir, 'init', '-q')
  write(dir, 'README.md', 'main\n')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-qm', 'main')
  git(dir, 'checkout', '-qb', branch)
  change(dir)
  git(dir, 'add', '-A')
  git(dir, 'commit', '-qm', 'change')
  const bundle = join(root, `change-${count}.bundle`)
  git(dir, 'bundle', 'create', '-q', bundle, branch, '^main')
  return { dir, bundle }
}
// The publish job's side: main only, as actions/checkout leaves it.
const publishRepo = (from) => {
  const dir = join(root, `publish-${++count}`)
  git(root, 'clone', '-q', '--single-branch', '--branch', 'main', from, dir)
  return dir
}

describe('the branch name', () => {
  it.each(['update/team-size-30', 'update/building-steven-wilssens-com-merge-site--29', 'update/change-1'])('takes %s', (name) => expect(BRANCH.test(name)).toBe(true))
  it.each(['main', 'update/Team-30', 'update/x', 'update/x-30;rm', 'feature/x-30', 'update/../main-1', 'update/x-30\n'])('refuses %j before touching git', (name) => {
    expect(takeBundle({ bundle: 'nowhere.bundle', branch: name, cwd: root })).toMatchObject({ ok: false, code: 2 })
  })
})

describe('the bundle', () => {
  it('takes a change that grows from main and leaves the branch in the checkout', () => {
    const branch = 'update/team-size-30'
    const { dir, bundle } = updateRepo(branch, (cwd) => write(cwd, 'src/resume.ts', 'export const x = 1\n'))
    const publish = publishRepo(dir)
    const result = takeBundle({ bundle, branch, cwd: publish })
    expect(result).toMatchObject({ ok: true, code: 0 })
    expect(result.sha).toBe(git(dir, 'rev-parse', branch).trim())
    expect(git(publish, 'rev-parse', `refs/heads/${branch}`).trim()).toBe(result.sha)
  })

  it('refuses a corrupt bundle and an empty file', () => {
    const { dir } = updateRepo('update/a-1', (cwd) => write(cwd, 'a.txt', 'a\n'))
    const publish = publishRepo(dir)
    const corrupt = join(root, 'corrupt.bundle')
    writeFileSync(corrupt, '# v2 git bundle\nnot a pack\n')
    const empty = join(root, 'empty.bundle')
    writeFileSync(empty, '')
    for (const bundle of [corrupt, empty, join(root, 'missing.bundle')]) expect(takeBundle({ bundle, branch: 'update/a-1', cwd: publish })).toMatchObject({ ok: false, code: 3 })
  })

  it('refuses a bundle that carries another branch', () => {
    const { dir, bundle } = updateRepo('update/a-2', (cwd) => write(cwd, 'a.txt', 'a\n'))
    expect(takeBundle({ bundle, branch: 'update/b-2', cwd: publishRepo(dir) })).toMatchObject({ ok: false, code: 4 })
  })

  it('refuses a branch that does not grow from main', () => {
    const branch = 'update/orphan-3'
    const dir = join(root, 'orphan')
    mkdirSync(dir)
    git(dir, 'init', '-q')
    write(dir, 'README.md', 'main\n')
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'main')
    git(dir, 'checkout', '-q', '--orphan', branch)
    write(dir, 'other.txt', 'other\n')
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'orphan')
    const bundle = join(root, 'orphan.bundle')
    git(dir, 'bundle', 'create', '-q', bundle, branch)
    expect(takeBundle({ bundle, branch, cwd: publishRepo(dir) })).toMatchObject({ ok: false, code: 5 })
  })

  it('refuses a branch that is main itself', () => {
    const dir = join(root, 'same')
    mkdirSync(dir)
    git(dir, 'init', '-q')
    write(dir, 'README.md', 'main\n')
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'main')
    git(dir, 'branch', 'update/same-4')
    const bundle = join(root, 'same.bundle')
    git(dir, 'bundle', 'create', '-q', bundle, 'update/same-4')
    expect(takeBundle({ bundle, branch: 'update/same-4', cwd: publishRepo(dir) })).toMatchObject({ ok: false, code: 4, message: expect.stringContaining('adds nothing') })
  })

  it.each([
    ['adds a workflow', (cwd) => write(cwd, '.github/workflows/x.yml', 'on: push\n')],
    ['renames a file into .github/', (cwd) => { mkdirSync(join(cwd, '.github')); git(cwd, 'mv', 'README.md', '.github/README.md') }],
    ['changes .github/ and changes it back in a later commit', (cwd) => {
      write(cwd, '.github/CODEOWNERS', '* @someone\n')
      git(cwd, 'add', '-A')
      git(cwd, 'commit', '-qm', 'in')
      git(cwd, 'rm', '-q', '.github/CODEOWNERS')
      write(cwd, 'b.txt', 'b\n')
    }],
  ])('refuses a branch that %s', (_what, change) => {
    const branch = `update/github-${count + 10}`
    const { dir, bundle } = updateRepo(branch, change)
    const result = takeBundle({ bundle, branch, cwd: publishRepo(dir) })
    expect(result).toMatchObject({ ok: false, code: 6 })
    expect(result.message).toMatch(/\.github\//)
  })
})

describe('the command line', () => {
  it('writes the commit to $GITHUB_OUTPUT and returns 0, or prints an ::error:: line and returns the code', () => {
    const branch = 'update/cli-5'
    const { dir, bundle } = updateRepo(branch, (cwd) => write(cwd, 'a.txt', 'a\n'))
    const publish = publishRepo(dir)
    const output = join(root, 'output.txt')
    const lines = []
    expect(main([bundle, branch], { output, log: (line) => lines.push(line), error: (line) => lines.push(line), cwd: publish })).toBe(0)
    expect(readFileSync(output, 'utf8')).toBe(`sha=${git(dir, 'rev-parse', branch).trim()}\n`)
    expect(main([bundle, 'main'], { output, log: (line) => lines.push(line), error: (line) => lines.push(line), cwd: publish })).toBe(2)
    expect(lines.at(-1)).toMatch(/^::error::The branch "main"/)
    expect(main([bundle, branch, 'origin/main'], { output: '', log: () => {}, error: () => {}, cwd: publish })).toBe(0)
  })
})
