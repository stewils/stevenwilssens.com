// @vitest-environment node
// The publish job's hand-over check (scripts/site-update-bundle.mjs), on real git
// repositories in a temporary folder: the update job's repository makes the bundle from the
// commit of main it started from (its base), a fresh clone of main (the publish job's
// checkout, maybe later, after main moved on) takes it.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BRANCH, main, takeBundle } from './site-update-bundle.mjs'

// Real git, several repositories per test: more than the default 5 s on a loaded runner.
const SLOW = 30_000
const root = mkdtempSync(join(tmpdir(), 'site-update-bundle-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'init.defaultBranch=main', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const write = (cwd, path, text) => {
  mkdirSync(join(cwd, path, '..'), { recursive: true })
  writeFileSync(join(cwd, path), text)
}
const commitAll = (cwd, message) => { git(cwd, 'add', '-A'); git(cwd, 'commit', '-qm', message) }
let count = 0
// The update job's side: main with one commit, then the branch with `change` applied, bundled from main.
const updateRepo = (branch, change) => {
  const dir = join(root, `update-${++count}`)
  mkdirSync(dir)
  git(dir, 'init', '-q')
  write(dir, 'README.md', 'main\n')
  commitAll(dir, 'main')
  const base = git(dir, 'rev-parse', 'main').trim()
  git(dir, 'checkout', '-qb', branch)
  change(dir)
  commitAll(dir, 'change')
  const bundle = join(root, `change-${count}.bundle`)
  git(dir, 'bundle', 'create', '-q', bundle, branch, '^main')
  return { dir, bundle, base }
}
// The publish job's side: main only, as actions/checkout leaves it.
const publishRepo = (from) => {
  const dir = join(root, `publish-${++count}`)
  git(root, 'clone', '-q', '--single-branch', '--branch', 'main', from, dir)
  return dir
}
const take = (made, branch, cwd, extra = {}) => takeBundle({ bundle: made.bundle, branch, base: made.base, cwd, ...extra })

describe('the branch name and the base', () => {
  it.each(['update/team-size-30', 'update/building-steven-wilssens-com-merge-site--29', 'update/change-1'])('takes %s', (name) => expect(BRANCH.test(name)).toBe(true))
  it.each(['main', 'update/Team-30', 'update/x', 'update/x-30;rm', 'feature/x-30', 'update/../main-1', 'update/x-30\n', undefined])('refuses %j before touching git', (name) => {
    expect(takeBundle({ bundle: 'nowhere.bundle', branch: name, base: 'a'.repeat(40), cwd: root })).toMatchObject({ ok: false, code: 2 })
  })
  it.each(['', 'main', 'abc1234', `${'a'.repeat(40)}\n`, undefined])('refuses the base %j before touching git', (base) => {
    expect(takeBundle({ bundle: 'nowhere.bundle', branch: 'update/x-1', base, cwd: root })).toMatchObject({ ok: false, code: 2, message: expect.stringMatching(/not a commit id/) })
  })
})

describe('the bundle', () => {
  it('takes a change that grows from main and leaves the branch in the checkout', () => {
    const branch = 'update/team-size-30'
    const made = updateRepo(branch, (cwd) => write(cwd, 'src/resume.ts', 'export const x = 1\n'))
    const publish = publishRepo(made.dir)
    const result = take(made, branch, publish)
    expect(result).toMatchObject({ ok: true, code: 0 })
    expect(result.sha).toBe(git(made.dir, 'rev-parse', branch).trim())
    expect(git(publish, 'rev-parse', `refs/heads/${branch}`).trim()).toBe(result.sha)
  }, SLOW)

  it('still takes it when main moved on after the bundle was made (another merge while Claude ran)', () => {
    const branch = 'update/moved-31'
    const made = updateRepo(branch, (cwd) => write(cwd, 'src/resume.ts', 'export const x = 2\n'))
    git(made.dir, 'checkout', '-q', 'main')
    write(made.dir, 'other.txt', 'merged meanwhile\n')
    commitAll(made.dir, 'another pull request merged')
    const publish = publishRepo(made.dir)
    expect(git(publish, 'rev-parse', 'origin/main').trim()).not.toBe(made.base)
    expect(take(made, branch, publish)).toMatchObject({ ok: true, code: 0 })
  }, SLOW)

  it("refuses a base that is not in main's history (a bundle built on another branch)", () => {
    const branch = 'update/elsewhere-32'
    const dir = join(root, 'elsewhere')
    mkdirSync(dir)
    git(dir, 'init', '-q')
    write(dir, 'README.md', 'main\n')
    commitAll(dir, 'main')
    git(dir, 'checkout', '-qb', 'side')
    write(dir, 'side.txt', 'side\n')
    commitAll(dir, 'side')
    const base = git(dir, 'rev-parse', 'side').trim()
    git(dir, 'checkout', '-qb', branch)
    write(dir, 'a.txt', 'a\n')
    commitAll(dir, 'change')
    const bundle = join(root, 'elsewhere.bundle')
    git(dir, 'bundle', 'create', '-q', bundle, branch, '^main')
    expect(takeBundle({ bundle, branch, base, cwd: publishRepo(dir) })).toMatchObject({ ok: false, code: 5, message: expect.stringMatching(/not in main's history/) })
  }, SLOW)

  it('refuses a corrupt bundle and an empty file', () => {
    const made = updateRepo('update/a-1', (cwd) => write(cwd, 'a.txt', 'a\n'))
    const publish = publishRepo(made.dir)
    const corrupt = join(root, 'corrupt.bundle')
    writeFileSync(corrupt, '# v2 git bundle\nnot a pack\n')
    const empty = join(root, 'empty.bundle')
    writeFileSync(empty, '')
    for (const bundle of [corrupt, empty, join(root, 'missing.bundle')]) expect(takeBundle({ bundle, branch: 'update/a-1', base: made.base, cwd: publish })).toMatchObject({ ok: false, code: 3 })
  }, SLOW)

  it('refuses a bundle that carries another branch', () => {
    const made = updateRepo('update/a-2', (cwd) => write(cwd, 'a.txt', 'a\n'))
    expect(take(made, 'update/b-2', publishRepo(made.dir))).toMatchObject({ ok: false, code: 4 })
  }, SLOW)

  it('refuses a branch that does not grow from its base', () => {
    const branch = 'update/orphan-3'
    const dir = join(root, 'orphan')
    mkdirSync(dir)
    git(dir, 'init', '-q')
    write(dir, 'README.md', 'main\n')
    commitAll(dir, 'main')
    const base = git(dir, 'rev-parse', 'main').trim()
    git(dir, 'checkout', '-q', '--orphan', branch)
    write(dir, 'other.txt', 'other\n')
    commitAll(dir, 'orphan')
    const bundle = join(root, 'orphan.bundle')
    git(dir, 'bundle', 'create', '-q', bundle, branch)
    expect(takeBundle({ bundle, branch, base, cwd: publishRepo(dir) })).toMatchObject({ ok: false, code: 5, message: expect.stringMatching(/does not grow from its base/) })
  }, SLOW)

  it('refuses a branch that is its base', () => {
    const dir = join(root, 'same')
    mkdirSync(dir)
    git(dir, 'init', '-q')
    write(dir, 'README.md', 'main\n')
    commitAll(dir, 'main')
    git(dir, 'branch', 'update/same-4')
    const bundle = join(root, 'same.bundle')
    git(dir, 'bundle', 'create', '-q', bundle, 'update/same-4')
    expect(takeBundle({ bundle, branch: 'update/same-4', base: git(dir, 'rev-parse', 'main').trim(), cwd: publishRepo(dir) })).toMatchObject({ ok: false, code: 4, message: expect.stringContaining('adds nothing') })
  }, SLOW)

  it.each([
    ['adds a workflow', (cwd) => write(cwd, '.github/workflows/x.yml', 'on: push\n')],
    ['renames a file into .github/', (cwd) => { mkdirSync(join(cwd, '.github')); git(cwd, 'mv', 'README.md', '.github/README.md') }],
    ['changes .github/ and changes it back in a later commit', (cwd) => {
      write(cwd, '.github/CODEOWNERS', '* @someone\n')
      commitAll(cwd, 'in')
      git(cwd, 'rm', '-q', '.github/CODEOWNERS')
      write(cwd, 'b.txt', 'b\n')
    }],
  ])('refuses a branch that %s', (_what, change) => {
    const branch = `update/github-${count + 10}`
    const made = updateRepo(branch, change)
    const result = take(made, branch, publishRepo(made.dir))
    expect(result).toMatchObject({ ok: false, code: 6 })
    expect(result.message).toMatch(/\.github\//)
  }, SLOW)

  it('refuses a merge commit, also one whose own tree adds .github/ (an "evil merge" git log does not show)', () => {
    const branch = 'update/evil-40'
    const made = updateRepo(branch, (cwd) => write(cwd, 'a.txt', 'a\n'))
    git(made.dir, 'checkout', '-qb', 'side', made.base)
    write(made.dir, 'side.txt', 'side\n')
    commitAll(made.dir, 'side')
    git(made.dir, 'checkout', '-q', branch)
    git(made.dir, 'merge', '-q', '--no-ff', '--no-commit', 'side')
    write(made.dir, '.github/CODEOWNERS', '* @someone\n')
    commitAll(made.dir, 'merge side')
    // The per-commit log names no .github/ path for the merge: the reason for the merge and whole-diff checks.
    expect(git(made.dir, 'log', '--format=', '--name-only', '--no-renames', `${made.base}..${branch}`)).not.toContain('.github')
    const bundle = join(made.dir, '..', `evil-${count}.bundle`)
    git(made.dir, 'bundle', 'create', '-q', bundle, branch, '^main')
    const result = takeBundle({ bundle, branch, base: made.base, cwd: publishRepo(made.dir) })
    // On a failure, the history and the bundle say why.
    const why = `${JSON.stringify(result)}\n${git(made.dir, 'log', '--graph', '--format=%h %p %s', '--all')}\n${git(made.dir, 'bundle', 'list-heads', bundle)}`
    expect(result, why).toMatchObject({ ok: false, code: 5, message: expect.stringMatching(/merge commit/) })
  }, SLOW)

  it('refuses a base older than the commit the run started from, and takes one at or after it', () => {
    const branch = 'update/start-41'
    const made = updateRepo(branch, (cwd) => write(cwd, 'a.txt', 'a\n'))
    git(made.dir, 'checkout', '-q', 'main')
    write(made.dir, 'later.txt', 'later\n')
    commitAll(made.dir, 'main moved on before the run started')
    const later = git(made.dir, 'rev-parse', 'main').trim()
    const publish = publishRepo(made.dir)
    expect(take(made, branch, publish, { start: later })).toMatchObject({ ok: false, code: 5, message: expect.stringMatching(/older than the commit the run started from/) })
    expect(take(made, branch, publish, { start: made.base })).toMatchObject({ ok: true })
    expect(take(made, branch, publish, { start: 'not-a-sha' })).toMatchObject({ ok: false, code: 2 })
  }, SLOW)
})

describe('the command line', () => {
  it('writes the commit to $GITHUB_OUTPUT and returns 0, or prints an ::error:: line and returns the code', () => {
    const branch = 'update/cli-5'
    const made = updateRepo(branch, (cwd) => write(cwd, 'a.txt', 'a\n'))
    const publish = publishRepo(made.dir)
    const output = join(root, 'output.txt')
    const lines = []
    const sink = { output, log: (line) => lines.push(line), error: (line) => lines.push(line), cwd: publish }
    expect(main([made.bundle, branch, made.base], sink)).toBe(0)
    expect(readFileSync(output, 'utf8')).toBe(`sha=${git(made.dir, 'rev-parse', branch).trim()}\n`)
    expect(main([made.bundle, 'main', made.base], sink)).toBe(2)
    expect(lines.at(-1)).toMatch(/^::error::The branch "main"/)
    expect(main([made.bundle, branch, made.base, 'origin/main'], { ...sink, output: '' })).toBe(0)
  }, SLOW)
})
