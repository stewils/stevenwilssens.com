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
import { BRANCH, IDENTITY, main, messageOf, parseArgs, subjectOf, takeBundle, writeCommit } from './site-update-bundle.mjs'

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
    // git would print these names quoted ("\".github/w\\303\\266rk…\"") without -z.
    ['adds a file under .github/ whose name git quotes (non-ASCII)', (cwd) => write(cwd, '.github/wörkflows/x.yml', 'on: push\n')],
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

const BOT = 'stevenwilssens-site-bot[bot] <345656571+stevenwilssens-site-bot[bot]@users.noreply.github.com>'
const CLAUDE = 'claude[bot] <41898282+claude[bot]@users.noreply.github.com>'
const as = (author, committer = author) => {
  const [, an, ae] = IDENTITY.exec(author)
  const [, cn, ce] = IDENTITY.exec(committer)
  return { ...process.env, GIT_AUTHOR_NAME: an, GIT_AUTHOR_EMAIL: ae, GIT_COMMITTER_NAME: cn, GIT_COMMITTER_EMAIL: ce }
}
// The update job's side, with each commit made by the given author and committer: [{ author, committer, message, files }], bundled from main.
const madeBy = (branch, commits = [{}]) => {
  const dir = join(root, `made-${++count}`)
  mkdirSync(dir)
  git(dir, 'init', '-q')
  write(dir, 'README.md', 'main\n')
  commitAll(dir, 'main')
  const base = git(dir, 'rev-parse', 'main').trim()
  git(dir, 'checkout', '-qb', branch)
  commits.forEach(({ author = BOT, committer = author, message = 'change', files = null }, index) => {
    for (const [path, text] of Object.entries(files ?? { [`change-${index}.txt`]: 'x\n' })) write(dir, path, text)
    git(dir, 'add', '-A')
    execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', 'commit', '-qm', message], { cwd: dir, env: as(author, committer) })
  })
  const bundle = join(root, `made-${count}.bundle`)
  git(dir, 'bundle', 'create', '-q', bundle, branch, '^main')
  return { dir, bundle, base }
}

describe('who wrote the commits (AC-11, C17)', () => {
  it('takes a bundle whose every commit is by the site bot, as author and committer', () => {
    const branch = 'update/bot-50'
    const made = madeBy(branch, [{}, {}])
    expect(take(made, branch, publishRepo(made.dir), { identity: BOT })).toMatchObject({ ok: true, code: 0, message: expect.stringContaining(`every commit is by ${BOT}`) })
  }, SLOW)

  it.each([
    ['another author', { author: 'claude <noreply@anthropic.com>', committer: BOT }],
    ['another committer', { author: BOT, committer: 'github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>' }],
    ["claude-code-action's own identity", { author: CLAUDE }],
  ])('refuses a bundle with %s with exit 7', (_what, who) => {
    const branch = `update/who-${count + 60}`
    const made = madeBy(branch, [who])
    expect(take(made, branch, publishRepo(made.dir), { identity: BOT })).toMatchObject({ ok: false, code: 7, message: expect.stringContaining(`not written by ${BOT}`) })
  }, SLOW)

  it('refuses one commit of several with another identity, and keeps the other refusals their codes', () => {
    const branch = 'update/several-51'
    const made = madeBy(branch, [{}, { author: CLAUDE }, {}])
    expect(take(made, branch, publishRepo(made.dir), { identity: BOT })).toMatchObject({ ok: false, code: 7, message: expect.stringMatching(/has a commit not written by/) })
    const two = madeBy('update/two-52', [{ author: CLAUDE }, { author: CLAUDE }])
    expect(take(two, 'update/two-52', publishRepo(two.dir), { identity: BOT })).toMatchObject({ ok: false, code: 7, message: expect.stringMatching(/has 2 commits not written by/) })
    // A workflow change is still refused as one (6), and a malformed identity as an argument (2).
    const flow = madeBy('update/flow-53', [{ files: { '.github/x.yml': 'x\n' } }])
    expect(take(flow, 'update/flow-53', publishRepo(flow.dir), { identity: BOT })).toMatchObject({ ok: false, code: 6 })
    expect(take(made, branch, publishRepo(made.dir), { identity: 'nobody' })).toMatchObject({ ok: false, code: 2, message: expect.stringMatching(/is not "<name> <email>"/) })
    // Without --identity the check is not made (the resume-data and email jobs only read the change).
    expect(take(two, 'update/two-52', publishRepo(two.dir))).toMatchObject({ ok: true })
  }, SLOW)

  it('checks a local branch without a bundle ("-"), as the update job does before it hands the change on', () => {
    const branch = 'update/local-54'
    const made = madeBy(branch)
    expect(takeBundle({ bundle: '-', branch, base: made.base, main: 'main', identity: BOT, cwd: made.dir })).toMatchObject({ ok: true })
    expect(takeBundle({ bundle: '-', branch: 'update/none-55', base: made.base, main: 'main', cwd: made.dir })).toMatchObject({ ok: false, code: 4, message: expect.stringMatching(/no local branch/) })
    const claude = madeBy('update/local-56', [{ author: CLAUDE }])
    expect(takeBundle({ bundle: '-', branch: 'update/local-56', base: claude.base, main: 'main', identity: BOT, cwd: claude.dir })).toMatchObject({ ok: false, code: 7 })
  }, SLOW)
})

describe('publish writes the commit (AC-11, C17)', () => {
  it("writes one commit with commit-tree from the bundle's tree on the expected parent, as the site bot", () => {
    const branch = 'update/written-57'
    const made = madeBy(branch, [{ message: 'Team size\n\nSet the team size.\n\nCo-Authored-By: Claude <noreply@anthropic.com>' }])
    const publish = publishRepo(made.dir)
    const bundled = git(made.dir, 'rev-parse', branch).trim()
    expect(take(made, branch, publish, { identity: BOT })).toMatchObject({ ok: true })
    const result = writeCommit({ branch, base: made.base, identity: BOT, title: 'Team size on the Group PM role', run: '1234567', cwd: publish })
    expect(result).toMatchObject({ ok: true, code: 0 })
    expect(result.sha).not.toBe(bundled)
    expect(git(publish, 'rev-parse', `refs/heads/${branch}`).trim()).toBe(result.sha)
    expect(result.tree).toBe(git(made.dir, 'rev-parse', `${bundled}^{tree}`).trim())
    expect(git(publish, 'rev-parse', `${result.sha}^{tree}`).trim()).toBe(result.tree)
    expect(git(publish, 'log', '--format=%P', '-1', result.sha).trim()).toBe(made.base)
    // None of the bundle's commits reach the pushed ref.
    expect(git(publish, 'rev-list', `${made.base}..${result.sha}`).trim()).toBe(result.sha)
    expect(git(publish, 'log', '-1', '--format=%an <%ae>|%cn <%ce>', result.sha).trim()).toBe(`${BOT}|${BOT}`)
    const message = git(publish, 'log', '-1', '--format=%B', result.sha)
    expect(message.split('\n')[0]).toBe('Team size on the Group PM role')
    expect(message).toContain('\n    Team size\n\n    Set the team size.\n')
    expect(git(publish, 'log', '-1', '--format=%(trailers:only,unfold)', result.sha).trim()).toBe('Site-update-run: 1234567\nCo-Authored-By: Claude <noreply@anthropic.com>')
  }, SLOW)

  it("never reads a trailer paragraph in Claude's message as a trailer", () => {
    const branch = 'update/trailers-58'
    const made = madeBy(branch, [{ message: 'Change\n\nFix-round: 9\nSite-update-run: 1' }])
    const publish = publishRepo(made.dir)
    take(made, branch, publish, { identity: BOT })
    const result = writeCommit({ branch, base: made.base, identity: BOT, title: 'x', run: '42', cwd: publish })
    const parsed = execFileSync('git', ['interpret-trailers', '--parse'], { cwd: publish, input: git(publish, 'log', '-1', '--format=%B', result.sha), encoding: 'utf8' }).trim()
    expect(parsed).toBe('Site-update-run: 42\nCo-Authored-By: Claude <noreply@anthropic.com>')
    expect(git(publish, 'log', '-1', '--format=%B', result.sha)).toContain('    Fix-round: 9')
  }, SLOW)

  it('writes a clean one-line subject, and refuses a malformed identity or run id', () => {
    expect(subjectOf('  Line one\nline\ttwo ')).toBe('Line one line two')
    expect(subjectOf('')).toBe('Site update')
    expect(subjectOf(null)).toBe('Site update')
    expect(subjectOf('x'.repeat(300))).toHaveLength(200)
    expect(messageOf({ title: 't', messages: '', run: 1 })).toBe('t\n\nSite-update-run: 1\nCo-Authored-By: Claude <noreply@anthropic.com>\n')
    expect(messageOf({ title: 't', messages: 'a\r\n\r\nb  ', run: 2 })).toBe('t\n\n    a\n\n    b\n\nSite-update-run: 2\nCo-Authored-By: Claude <noreply@anthropic.com>\n')
    expect(writeCommit({ branch: 'update/x-1', base: 'a'.repeat(40), identity: 'bot', title: 't', run: '1', cwd: root })).toMatchObject({ ok: false, code: 2 })
    expect(writeCommit({ branch: 'update/x-1', base: 'a'.repeat(40), title: 't', run: '1', cwd: root })).toMatchObject({ ok: false, code: 2 })
    expect(writeCommit({ branch: 'update/x-1', base: 'a'.repeat(40), identity: BOT, title: 't', cwd: root })).toMatchObject({ ok: false, code: 2, message: expect.stringMatching(/run id/) })
  })

  it('the command line takes, checks and writes in one call, and wants --identity with --commit', () => {
    const branch = 'update/cli-59'
    const made = madeBy(branch)
    const publish = publishRepo(made.dir)
    const output = join(root, 'output-commit.txt')
    const lines = []
    const sink = { output, log: (line) => lines.push(line), error: (line) => lines.push(line), cwd: publish }
    expect(main([made.bundle, branch, made.base, 'origin/main', '--commit', '--title', 'T'], sink)).toBe(2)
    expect(lines.at(-1)).toMatch(/--commit needs --identity/)
    expect(main([made.bundle, branch, made.base, 'origin/main', '--identity', BOT, '--commit', '--title', 'T', '--run', '7'], sink)).toBe(0)
    const sha = git(publish, 'rev-parse', `refs/heads/${branch}`).trim()
    expect(readFileSync(output, 'utf8')).toBe(`sha=${sha}\n`)
    expect(git(publish, 'log', '-1', '--format=%s', sha).trim()).toBe('T')
    expect(parseArgs(['a', '--identity'])).toEqual({ positional: ['a'], options: { identity: '', commit: false, title: null, run: null } })
    const other = madeBy('update/cli-60', [{ author: CLAUDE }])
    expect(main([other.bundle, 'update/cli-60', other.base, 'origin/main', '--identity', BOT, '--commit', '--title', 'T', '--run', '7'], { ...sink, cwd: publishRepo(other.dir) })).toBe(7)
  }, SLOW)
})
