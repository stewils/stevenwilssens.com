// @vitest-environment node
// Whether a Site update run has a change to commit (scripts/site-update-outcome.mjs): a request
// that changed nothing outside specs/ fails before anything is pushed, a refresh with nothing
// new warns, and anything else commits.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readFileSync as read } from 'node:fs'
import { decide, encodeCommand, ERROR_LIMIT, errorLine, fromEnvironment, main, NO_CHANGE, parseStatus, STATUS_ARGS } from './site-update-outcome.mjs'

const z = (...entries) => entries.map((entry) => `${entry}\0`).join('')
const dispatch = 'workflow_dispatch'
const refresh = 'repository_dispatch'

describe('the decision (AC-3, T-7, C-5)', () => {
  it.each([
    ['a request with no change', dispatch, '', 'fail'],
    ['a request, only specs/', dispatch, z('?? specs/about-27.md'), 'fail'],
    ['a request, a deleted spec only', dispatch, z(' D specs/old.md'), 'fail'],
    ['a request, a spec and src/resume.ts', dispatch, z('?? specs/about-27.md', ' M src/resume.ts'), 'commit'],
    ['a refresh with no change', refresh, '', 'warn'],
    ['a refresh, only specs/', refresh, z('?? specs/building-27.md'), 'warn'],
    ['a refresh, only the feed', refresh, z(' M src/articles/aibreaker/feed.json'), 'commit'],
    ['a request, only a feed', dispatch, z(' M src/articles/site/feed.json'), 'commit'],
    ['a spec and an agent file', dispatch, z('?? specs/x.md', ' M .claude/agents/x.md'), 'commit'],
    ['a spec and a workflow', dispatch, z('?? specs/x.md', ' M .github/workflows/x.yml'), 'commit'],
    ['an untracked file', dispatch, z('?? notes.md'), 'commit'],
    ['a rename into specs/', dispatch, z('R  specs/x.md', 'notes/x.md'), 'commit'],
    ['a rename out of specs/', dispatch, z('R  notes/x.md', 'specs/x.md'), 'commit'],
    ['a rename within specs/', dispatch, z('R  specs/b.md', 'specs/a.md'), 'fail'],
    ['only the generated PDF', dispatch, z(' M public/steven-wilssens-resume-2026.pdf'), 'commit'],
    ['a folder that only starts like specs', dispatch, z('?? specs-old/x.md'), 'commit'],
    ['a file named like specs elsewhere', dispatch, z(' M src/specs.ts'), 'commit'],
    ['an unknown event with no change fails closed', 'push', '', 'fail'],
  ])('%s', (_name, event, status, action) => {
    expect(decide({ event, entries: parseStatus(status) }).action).toBe(action)
  })

  it('reads paths with a space or a newline, and a trailing NUL, from -z output', () => {
    expect(parseStatus(z('?? specs/with space.md', '?? specs/line\nbreak.md'))).toEqual([
      { code: '??', paths: ['specs/with space.md'] },
      { code: '??', paths: ['specs/line\nbreak.md'] },
    ])
    expect(decide({ event: dispatch, entries: parseStatus(z('?? specs/with space.md', '?? src/new\nfile.ts')) }).action).toBe('commit')
    expect(parseStatus('')).toEqual([])
    expect(parseStatus(null)).toEqual([])
    expect(parseStatus('R  only-new.md')).toEqual([{ code: 'R ', paths: ['only-new.md'] }])
  })

  it('says whether only the spec was written', () => {
    expect(decide({ event: dispatch, entries: [] })).toEqual({ action: 'fail', specOnly: false })
    expect(decide({ event: dispatch, entries: parseStatus(z('?? specs/x.md')) })).toEqual({ action: 'fail', specOnly: true })
  })
})

describe('the error line (C-3)', () => {
  it('fails with the fixed sentence and the last message', () => {
    expect(errorLine('I could not find the section.', false)).toBe(`::error::${NO_CHANGE} Nothing in the repository changed. Claude's last message: I could not find the section.`)
    expect(errorLine('  ', true)).toBe(`::error::${NO_CHANGE} Only the spec was written; nothing on the site changed. Claude left no last message.`)
  })

  it('the error line encodes %, CR and LF and is cut to 500', () => {
    const line = errorLine(`100% done\r\n::warning::forged\n${'x'.repeat(2000)}`, false)
    expect(line.split('\n')).toHaveLength(1)
    expect(line).toContain("100%25 done%0D%0A::warning::forged%0A")
    const value = line.slice(`::error::${NO_CHANGE} `.length)
    const decoded = value.replace(/%0A/g, '\n').replace(/%0D/g, '\r').replace(/%25/g, '%')
    expect(Array.from(decoded)).toHaveLength(ERROR_LIMIT)
    expect(encodeCommand('%\r\n')).toBe('%25%0D%0A')
  })

  it('redacts a token in the message once more', () => {
    const token = ['gh', 'p_', 'A1'.repeat(18)].join('')
    expect(errorLine(`pushed with ${token}`, false)).not.toContain(token)
  })
})

describe('the step', () => {
  const tmp = () => mkdtempSync(join(tmpdir(), 'outcome-'))

  it('reads every untracked file, NUL-separated, and prints the sentence the MCP reads back', () => {
    expect(STATUS_ARGS).toEqual(['status', '--porcelain', '-z', '--untracked-files=all'])
    const github = read(join(import.meta.dirname, '../functions/_lib/github.ts'), 'utf8')
    expect(/export const noChangeSentence = '([^']+)'/.exec(github)?.[1]).toBe(NO_CHANGE)
  })

  it('exit 1 for fail, 0 for warn and commit; commit=false written for warn and fail', () => {
    const dir = tmp()
    const output = join(dir, 'out')
    const logged = []
    const log = (line) => logged.push(line)
    writeFileSync(output, '')
    expect(main({ event: dispatch, status: '', lastMessage: 'Nothing to do.', output, log })).toBe(1)
    expect(logged.at(-1)).toMatch(new RegExp(`^::error::${NO_CHANGE.replace(/\./g, '\\.')} Nothing in the repository changed\\. Claude's last message: Nothing to do\\.$`))
    expect(main({ event: refresh, status: '', output, log })).toBe(0)
    expect(logged.at(-1)).toBe('::warning::Claude made no changes.')
    expect(main({ event: refresh, status: z('?? specs/x.md'), output, log })).toBe(0)
    expect(logged.at(-1)).toBe('::warning::Claude changed only the spec; there is nothing to open.')
    expect(main({ event: dispatch, status: z(' M src/resume.ts'), output, log })).toBe(0)
    expect(logged.at(-1)).toBe('There is a change to commit.')
    expect(readFileSync(output, 'utf8')).toBe('commit=false\n'.repeat(3) + 'commit=true\n')
    expect(main({ event: dispatch, status: z(' M src/resume.ts'), log })).toBe(0)
    expect(main({ event: refresh, status: '', log })).toBe(0)
  })

  it('runs as a command in a repository: git status from the working tree, the event and the last message from the environment', () => {
    const dir = tmp()
    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
    git('init', '-q')
    git('config', 'user.email', 'fixture@example.invalid')
    git('config', 'user.name', 'Fixture')
    writeFileSync(join(dir, 'README.md'), 'site\n')
    git('add', '-A')
    git('commit', '-q', '-m', 'base')
    const script = join(import.meta.dirname, 'site-update-outcome.mjs')
    const message = join(dir, '..', `${dir.split(/[\\/]/).pop()}-last.txt`)
    writeFileSync(message, 'The section does not exist.')
    const run = (event, extra = {}) => spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8', env: { ...process.env, EVENT: event, LAST_MESSAGE: message, GITHUB_OUTPUT: '', ...extra } })
    const failed = run(dispatch)
    expect(failed.status).toBe(1)
    expect(failed.stdout).toContain(`::error::${NO_CHANGE} Nothing in the repository changed. Claude's last message: The section does not exist.`)
    // The same step in this process, for the rest.
    const inProcess = (event, extra = {}) => {
      const logged = []
      const code = fromEnvironment({ env: { EVENT: event, LAST_MESSAGE: message, ...extra }, cwd: dir, log: (line) => logged.push(line) })
      return { code, out: logged.join('\n') }
    }
    mkdirSync(join(dir, 'specs'))
    writeFileSync(join(dir, 'specs', 'a b.md'), '# spec\n')
    expect(inProcess(dispatch)).toMatchObject({ code: 1, out: expect.stringContaining('Only the spec was written') })
    expect(inProcess(dispatch, { LAST_MESSAGE: join(dir, 'missing.txt') }).out).toContain('Claude left no last message.')
    expect(inProcess(refresh).code).toBe(0)
    mkdirSync(join(dir, 'src'))
    writeFileSync(join(dir, 'src', 'new file.ts'), 'x\n')
    expect(inProcess(dispatch, { LAST_MESSAGE: '' })).toEqual({ code: 0, out: 'There is a change to commit.' })
    expect(run(dispatch).status).toBe(0)
  })
})
