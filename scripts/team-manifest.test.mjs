// @vitest-environment node
// The Team page's generator (scripts/team-manifest.mjs), on fixture repositories built in a
// temp folder with fixed dates (never this repository's history, so the results do not move
// as main moves), plus the checks that run on this repository itself: every orchestration
// file is listed or ignored, the real manifest has no problems and no secrets, and nothing
// about the team is typed into src/admin.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AUDITED, IGNORED, MAX_UPDATES, ORCHESTRATION, SCHEMA, SYNC_MERGE, UPDATE_KEYS, buildDiagram, clean, coverageGaps, cutSection, cutStep, emptyManifest, entryFor, frontmatter, generate,
  globToRegExp, manifestModule, parseChart, parseJobs, parseLog, parseTeam, plain, readable, refused, scanSecrets, slug, summaryOf,
} from './team-manifest.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
// The rules as this commit has them. The Review workflow puts main's CLAUDE.md and .claude/ on the disk before
// its team job (the rules it reviews by), so the tests of this change's rules read them through git.
const committed = (path) => execFileSync('git', ['show', `HEAD:${path}`], { cwd: repoRoot, encoding: 'utf8' })
const SLOW = 120_000
const made = []
afterAll(() => { for (const dir of made) rmSync(dir, { recursive: true, force: true }) })

// ---- fixture repositories ---------------------------------------------------------------

const TEAM = `# The team

| Role | Agent | Owns | Signs off on |
|---|---|---|---|
| Lead (the session) | — | the flow | nothing alone |
| Chief editor | \`chief-editor\` | the draft | the draft |
| Fact checker | \`fact-checker\` | the facts | the merge |

## The flow

\`\`\`mermaid
flowchart TD
  ask([The owner asks]) --> draft
  subgraph draft [Draft: drafts/slug.md]
    ed[Editor] --- proof0[Proofreader]
    ed -.adds.- law[Lawyer: risks] & acc[Accountant]
  end
  draft --> q{Questions only the owner can answer?}
  q -- yes, asked once --> ans([The owner answers]) --> pub
  q -- no --> pub[Publish to the site]
  pub -- changes requested --> fix[Editor fixes] --> pub
  pub -.-> done[Done]
  classDef you stroke-width:3px
  class ask,ans you
  class draft,pub gate
  %% step 1: ask
  %% step 2: draft
  %% step 3: q
  %% step 4: pub
\`\`\`

1. **Intake** (lead). Restate the ask.
2. **Draft** (\`chief-editor\`, with \`fact-checker\`). Write it,
   then check it.
3. **Questions.** Ask the owner once.
4. **Publish**. \`proof\` and \`panel\` pass; branch protection on main requires \`proof\` and \`panel\`.

## The verdict block

- **stop**: must not publish (a wrong fact,
  a broken link). **note**: optional, never blocks.
- \`APPROVE\` with stops is invalid.

## Ground rules

Be kind.
`
const agent = (name, description = `The ${name}.`) => `---\nname: ${name}\ndescription: "${description}"\ntools: Read, Secret\n---\n\nYou are the ${name}.\n\n## Writing\n\n## Checking\n`
const skill = (name) => `---\nname: ${name}\ndescription: Run the editors on an ask.\nargument-hint: <the ask>\n---\n\n# /${name}\n`
const REVIEW = `name: Review
on: push
jobs:
  proof:
    runs-on: ubuntu-latest
    steps:
      # A comment
      - name: Spell check
        run: echo spell

      - uses: actions/upload-artifact@v4
        with:
          name: not-a-step
      - if: always()
        name: 'Build'
  panel:
    name: The panel
    needs: [proof]
    steps:
      - name: Panel reviews
`
const siteUpdate = ({ team = 'Draft first.', other = 'echo mail', name = 'Let Claude make the change', open = null } = {}) => `name: Site update
jobs:
  update:
    steps:
      - name: Create the branch
        run: echo branch
      - name: ${name}
        uses: anthropics/claude-code-action@v1
        with:
          prompt: |
            Do the change.
            1. ${team}
            2. Then build \${{ steps.branch.outputs.spec }} on \${{ steps.branch.outputs.branch }}.
          claude_args: '--max-turns 10 --allowedTools "Read,Edit,Bash(npm run *)"'

      # The next step
      - name: Email Steven
        run: ${other}
${open === null ? '' : `      - name: Open the pull request
        run: ${open}
`}`
const RULES = (rules = 'Every change goes through the editors.') => `# Site\n\n## Facts\n\nOne source.\n\n## The team\n\n${rules}\n\nA reply never clears a stop.\n\n## The admin\n\nTiles.\n`
const BASE = {
  'CLAUDE.md': RULES(),
  '.claude/team.md': TEAM,
  '.claude/agents/chief-editor.md': agent('chief-editor'),
  '.claude/agents/fact-checker.md': agent('fact-checker'),
  '.claude/skills/publish/SKILL.md': skill('publish'),
  '.github/workflows/review.yml': REVIEW,
  '.github/workflows/site-update.yml': siteUpdate(),
  '.github/workflows/deploy.yml': 'name: Deploy\n',
  'scripts/recruiter-check.mjs': '// check\n',
  'functions/_lib/review/recruiter.ts': '// checker\n',
  'functions/_lib/review/recruiter.test.ts': '// test\n',
  'specs/TEMPLATE.md': '# Template\n',
  'README.md': '# Site\n',
}

let clock = Date.UTC(2026, 9, 1, 12)
// The fixtures' git reads no system or global config (hooks, templates, signing): only the
// repository's own. An empty file, not os.devNull: git for Windows cannot open that path.
const emptyConfig = join(mkdtempSync(join(tmpdir(), 'team-manifest-config-')), 'gitconfig')
writeFileSync(emptyConfig, '')
made.push(dirname(emptyConfig))
const GIT_ENV = { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: emptyConfig }
const git = (dir, args, env = {}) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...GIT_ENV, ...env } })
const repo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'team-manifest-'))
  made.push(dir)
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.name', 'Fixture'])
  git(dir, ['config', 'user.email', 'fixture@example.invalid'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  const write = (files) => {
    for (const [path, text] of Object.entries(files)) {
      const full = join(dir, path)
      if (text === null) { rmSync(full, { force: true }); continue }
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, text)
    }
  }
  const dated = () => { clock += 3_600_000; const date = new Date(clock).toISOString(); return { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } }
  const commit = (files, subject, body) => {
    write(files)
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '--allow-empty', '-m', subject, ...(body ? ['-m', body] : [])], dated())
    return git(dir, ['rev-parse', 'HEAD']).trim()
  }
  const merge = (branch, subject, body) => {
    git(dir, ['merge', '-q', '--no-ff', branch, '-m', subject, ...(body ? ['-m', body] : [])], dated())
    return git(dir, ['rev-parse', 'HEAD']).trim()
  }
  return { dir, write, commit, merge, git: (args) => git(dir, args, dated()) }
}
const byKey = (items, key = 'id') => Object.fromEntries(items.map((item) => [item[key], item]))

// One repository most read-only checks share: the base files, with a branch merged GitHub's
// way, one merged this repository's way, direct commits and an unrelated one.
let shared
let sharedManifest
beforeAll(() => {
  const r = repo()
  const root = r.commit(BASE, 'The team, from the start')
  r.git(['checkout', '-q', '-b', 'feature'])
  r.commit({ '.claude/agents/fact-checker.md': agent('fact-checker', 'Checks every fact.') }, 'Sharper fact checker')
  r.git(['checkout', '-q', 'main'])
  const github = r.merge('feature', 'Merge pull request #12 from someone/feature', 'The fact checker checks every fact')
  r.commit({ 'README.md': '# Site, again\n' }, 'Unrelated readme change')
  r.git(['checkout', '-q', '-b', 'skills'])
  r.commit({ '.claude/skills/publish/SKILL.md': skill('publish').replace('Run the editors', 'Run every editor') }, 'Skill wording')
  r.git(['checkout', '-q', 'main'])
  const local = r.merge('skills', 'Merge skills: every editor runs on an ask')
  const direct = r.commit({ 'scripts/recruiter-check.mjs': '// check, stricter\n', 'functions/_lib/review/recruiter.test.ts': '// more tests\n' }, 'The checker is stricter')
  r.write({ '.review/x/r1.md': 'SENTINEL-REVIEW', 'sources/a.md': 'SENTINEL-SOURCES', '.dev.vars': 'ADMIN_TOKEN=SENTINEL-DEVVARS', '.claude/agents/untracked.md': agent('untracked', 'SENTINEL-UNTRACKED') })
  shared = { ...r, root, github, local, direct }
  sharedManifest = generate({ root: r.dir, now: new Date('2026-10-19T10:00:00Z') })
}, SLOW)

describe('the manifest of a fixture repository', () => {
  it('reads the flow, every role, every skill, the Review jobs, the Site update team step and the gate scripts', () => {
    const m = sharedManifest
    expect(m.schema).toBe(SCHEMA)
    expect(m.problems).toEqual([])
    expect(m.commit).toBe(shared.direct)
    expect(m.flow.steps.map((step) => [step.n, step.id, step.title, step.who])).toEqual([[1, 'intake', 'Intake', 'lead'], [2, 'draft', 'Draft', 'chief-editor, with fact-checker'], [3, 'questions', 'Questions', null], [4, 'publish', 'Publish', null]])
    expect(m.flow.steps[1]).toMatchObject({ text: 'Write it, then check it.', people: ['chief-editor', 'fact-checker'], checks: [] })
    expect(m.flow.steps[0].people).toEqual(['lead'])
    expect(m.flow.steps[3].checks).toEqual(['proof', 'panel'])
    const roles = byKey(m.sections.roles.items)
    expect(Object.keys(roles)).toEqual(['lead-the-session', 'chief-editor', 'fact-checker'])
    expect(roles['lead-the-session']).toMatchObject({ title: 'Lead (the session)', agent: null, owns: 'the flow', signsOff: 'nothing alone', file: null })
    expect(roles['fact-checker']).toMatchObject({ title: 'Fact checker', agent: 'fact-checker', description: 'Checks every fact.', headings: ['Writing', 'Checking'], file: '.claude/agents/fact-checker.md' })
    expect(m.sections.commands.items).toEqual([{ id: 'publish', name: 'publish', description: 'Run every editor on an ask.', hint: '<the ask>', file: '.claude/skills/publish/SKILL.md' }])
    expect(m.sections.checks).toEqual({
      file: '.github/workflows/review.yml',
      jobs: [{ key: 'proof', name: null, needs: [], steps: ['Spell check', 'Build'] }, { key: 'panel', name: 'The panel', needs: ['proof'], steps: ['Panel reviews'] }],
      levels: [{ level: 'stop', meaning: 'must not publish (a wrong fact, a broken link).' }, { level: 'note', meaning: 'optional, never blocks.' }],
      scripts: ['functions/_lib/review/recruiter.ts', 'scripts/recruiter-check.mjs'],
      protection: 'proof and panel pass; branch protection on main requires proof and panel.',
    })
    expect(m.sections.siteUpdate).toEqual({ file: '.github/workflows/site-update.yml', steps: [{ name: 'Let Claude make the change', lines: ['Draft first.', 'Then build specs/<slug>.md on <branch>.'], tools: ['Read', 'Edit', 'Bash(npm run *)'] }] })
    expect(m.sections.rules).toEqual({ file: 'CLAUDE.md', heading: 'The team', paragraphs: ['Every change goes through the editors.', 'A reply never clears a stop.'] })
  })

  it('lists the files it read, at the built commit, so the page can link each one', () => {
    expect(sharedManifest.files).toEqual(['.claude/agents/chief-editor.md', '.claude/agents/fact-checker.md', '.claude/skills/publish/SKILL.md', '.claude/team.md', '.github/workflows/review.yml', '.github/workflows/site-update.yml', 'CLAUDE.md', 'functions/_lib/review/recruiter.ts', 'scripts/recruiter-check.mjs', 'specs/TEMPLATE.md'])
    expect(sharedManifest.repo).toBe('https://github.com/stewils/stevenwilssens.com')
  })

  it('draws the chart: nodes in order, the group with its members, the decision, the loop, the lanes and the gates', () => {
    const nodes = sharedManifest.flow.diagram.nodes
    expect(nodes.map((node) => node.id)).toEqual(['ask', 'draft', 'q', 'ans', 'pub', 'fix', 'done'])
    const node = byKey(nodes)
    expect(node.ask).toMatchObject({ label: 'The owner asks', shape: 'start', steps: [1], lane: 'you', gate: false, next: [{ to: 'draft', label: null }] })
    expect(node.draft).toMatchObject({ label: 'Draft: drafts/slug.md', shape: 'group', gate: true, members: [{ label: 'Editor', via: null }, { label: 'Proofreader', via: null }, { label: 'Lawyer: risks', via: 'adds' }, { label: 'Accountant', via: 'adds' }] })
    expect(node.q).toMatchObject({ shape: 'decision', next: [{ to: 'ans', label: 'yes, asked once' }, { to: 'pub', label: 'no' }] })
    expect(node.ans).toMatchObject({ lane: 'you', steps: [] })
    expect(node.pub).toMatchObject({ gate: true, next: [{ to: 'fix', label: 'changes requested' }, { to: 'done', label: null }], loop: null })
    expect(node.fix).toMatchObject({ loop: { to: 'pub', label: 'changes requested' }, next: [] })
  })

  it('lists the updates on the first-parent history, newest first, with summaries Steven reads', () => {
    const updates = sharedManifest.history.updates
    expect(updates.map((update) => update.sha)).toEqual([shared.direct, shared.local, shared.github, shared.root])
    const [direct, local, github, root] = updates
    expect(github).toMatchObject({ summary: 'The fact checker checks every fact', pr: 12, sections: ['roles'], roles: ['fact-checker'] })
    expect(local).toMatchObject({ summary: 'Every editor runs on an ask', pr: null, sections: ['commands'], commands: ['publish'] })
    expect(direct).toMatchObject({ summary: 'The checker is stricter', sections: ['checks'], steps: [] })
    expect(root.sections).toEqual(['flow', 'roles', 'checks', 'commands', 'siteUpdate', 'rules'])
    expect(root.steps).toEqual(['intake', 'draft', 'questions', 'publish'])
    expect(direct.date).toMatch(/^2026-10-\d\dT\d\d:00:00\.000Z$/)
    expect(sharedManifest.history.older).toBe(0)
  })

  it('has no launch before the generator is in the history: everything counts as before it', () => {
    expect(sharedManifest.launch).toBeNull()
    expect(sharedManifest.history.updates.every((update) => update.beforeLaunch)).toBe(true)
  })

  it('reads only listed paths, from git: nothing from .review/, sources/, .dev.vars or an untracked file', () => {
    const text = JSON.stringify(sharedManifest)
    for (const sentinel of ['SENTINEL-REVIEW', 'SENTINEL-SOURCES', 'SENTINEL-DEVVARS', 'SENTINEL-UNTRACKED', 'untracked']) expect(text).not.toContain(sentinel)
  })

  it('carries only the allowed fields: no author, no e-mail, no body, no other frontmatter key', () => {
    for (const update of sharedManifest.history.updates) expect(Object.keys(update).sort()).toEqual([...UPDATE_KEYS].sort())
    expect(Object.keys(sharedManifest).sort()).toEqual(['commit', 'files', 'flow', 'generatedAt', 'history', 'launch', 'problems', 'repo', 'schema', 'sections'])
    for (const role of sharedManifest.sections.roles.items) expect(Object.keys(role).sort()).toEqual(['agent', 'description', 'file', 'headings', 'id', 'owns', 'signsOff', 'title'])
    const text = JSON.stringify(sharedManifest)
    expect(text).not.toContain('@')
    expect(text).not.toContain('Fixture')
    expect(text).not.toContain('Secret')
    expect(scanSecrets(sharedManifest)).toEqual([])
  })
})

describe('a change adds a card by itself (AC-3)', () => {
  it('an extra agent file gives an extra role, an extra skill an extra command, an extra job an extra gate', () => {
    const r = repo()
    r.commit(BASE, 'Base')
    r.commit({
      '.claude/agents/new-role.md': agent('new-role', 'Does the new thing.'),
      '.claude/skills/audit/SKILL.md': skill('audit'),
      '.github/workflows/review.yml': `${REVIEW}  audit:\n    needs: proof\n    steps:\n      - name: Audit it\n`,
    }, 'More team')
    const m = generate({ root: r.dir })
    expect(m.problems).toEqual([])
    expect(byKey(m.sections.roles.items)['new-role']).toEqual({ id: 'new-role', title: 'new-role', agent: 'new-role', owns: '', signsOff: '', description: 'Does the new thing.', headings: ['Writing', 'Checking'], file: '.claude/agents/new-role.md' })
    expect(m.sections.commands.items.map((item) => item.name)).toEqual(['audit', 'publish'])
    expect(m.sections.checks.jobs.at(-1)).toEqual({ key: 'audit', name: null, needs: ['proof'], steps: ['Audit it'] })
    // The new job is named by no step, so no step of the flow changed.
    expect(m.history.updates[0]).toMatchObject({ sections: ['roles', 'checks', 'commands'], roles: ['new-role'], commands: ['audit'], steps: [] })
  }, SLOW)
})

describe('a part that cannot be read never fails the build (AC-5)', () => {
  it('skips an agent file without frontmatter and a skill without a description, and reads the rest', () => {
    const r = repo()
    r.commit({ ...BASE, '.claude/agents/broken.md': 'no frontmatter here\n', '.claude/skills/odd/SKILL.md': '---\nname: odd\n---\n' }, 'Base')
    const m = generate({ root: r.dir })
    expect(m.problems.map((p) => p.path)).toEqual(['.claude/agents/broken.md', '.claude/skills/odd/SKILL.md'])
    expect(m.problems[0]).toEqual({ path: '.claude/agents/broken.md', error: 'unreadable', message: 'no frontmatter with a name and a description' })
    expect(m.sections.roles.items.at(-1)).toEqual({ id: 'broken', unreadable: '.claude/agents/broken.md' })
    expect(m.sections.commands.items[0]).toEqual({ id: 'odd', unreadable: '.claude/skills/odd/SKILL.md' })
    expect(m.sections.roles.items).toHaveLength(4)
  }, SLOW)

  it('skips a table row whose agent file cannot be read', () => {
    const r = repo()
    r.commit({ ...BASE, '.claude/agents/fact-checker.md': 'broken\n' }, 'Base')
    const m = generate({ root: r.dir })
    expect(byKey(m.sections.roles.items)['fact-checker']).toEqual({ id: 'fact-checker', unreadable: '.claude/agents/fact-checker.md' })
  }, SLOW)

  it('skips a Review workflow it cannot read, a missing team file and a missing Site update workflow', () => {
    const r = repo()
    r.commit({ ...BASE, '.github/workflows/review.yml': 'name: Review\non: push\n', '.claude/team.md': null, '.github/workflows/site-update.yml': null }, 'Base')
    const m = generate({ root: r.dir })
    expect(m.sections.checks).toEqual({ unreadable: '.github/workflows/review.yml' })
    expect(m.flow).toEqual({ unreadable: '.claude/team.md' })
    expect(m.sections.siteUpdate).toEqual({ unreadable: '.github/workflows/site-update.yml' })
    expect(m.sections.roles.items.map((role) => role.id)).toEqual(['chief-editor', 'fact-checker'])
    expect(m.problems.map((p) => [p.path, p.message])).toEqual([
      ['.github/workflows/review.yml', 'no "jobs:" block'],
      ['.claude/team.md', '.claude/team.md is missing'],
      ['.github/workflows/site-update.yml', '.github/workflows/site-update.yml is missing'],
    ])
  }, SLOW)

  it('reports a team file without steps, without a chart or without a roles table', () => {
    const r = repo()
    r.commit({ ...BASE, '.claude/team.md': '# Team\n\n## The flow\n\nNo steps.\n' }, 'Base')
    let m = generate({ root: r.dir })
    expect(m.flow).toEqual({ unreadable: '.claude/team.md' })
    expect(m.problems.map((p) => p.message)).toEqual(['no numbered steps under "## The flow"', 'no roles table before "## The flow"'])
    expect(m.sections.roles).toEqual({ unreadable: '.claude/team.md' })
    r.commit({ '.claude/team.md': TEAM.replace(/```mermaid[\s\S]*?```/, '') }, 'No chart')
    m = generate({ root: r.dir })
    expect(m.flow.diagram).toBeNull()
    expect(m.flow.steps).toHaveLength(4)
    expect(m.problems.map((p) => p.message)).toEqual(['no mermaid chart under "## The flow"'])
  }, SLOW)

  it('reports a renamed Site update team step, and then counts every change to the file', () => {
    const r = repo()
    r.commit(BASE, 'Base')
    r.commit({ '.github/workflows/site-update.yml': siteUpdate({ other: 'echo mail, again' }) }, 'Only the email step')
    r.commit({ '.github/workflows/site-update.yml': siteUpdate({ other: 'echo mail, again', name: 'Let the agent work' }) }, 'Renamed the step')
    const m = generate({ root: r.dir })
    expect(m.sections.siteUpdate).toEqual({ unreadable: '.github/workflows/site-update.yml' })
    expect(m.problems.map((p) => p.message)).toEqual(['no step named "Let Claude make the change", "Open the pull request": every change to the file now counts as a team change'])
    expect(m.history.updates.map((update) => update.summary)).toEqual(['Renamed the step', 'Only the email step', 'Base'])
  }, SLOW)

  it('never throws: a failure after the commit is known gives an empty manifest of that commit', () => {
    const m = generate({ root: shared.dir, orchestration: { find: () => { throw new Error('boom') } }, now: new Date('2026-10-19T00:00:00Z') })
    expect(m).toEqual({ ...emptyManifest('the team manifest could not be generated: boom', new Date('2026-10-19T00:00:00Z')), commit: shared.direct })
    const odd = generate({ root: shared.dir, orchestration: { find: () => { throw 'odd' } } })
    expect(odd.problems.map((p) => p.message)).toEqual(['the team manifest could not be generated: odd'])
  }, SLOW)

  it('never throws: not a git repository gives an empty manifest whose parts say they could not be read', () => {
    const dir = mkdtempSync(join(tmpdir(), 'team-manifest-nogit-'))
    made.push(dir)
    writeFileSync(join(dir, 'x.md'), 'x')
    const m = generate({ root: dir, now: new Date('2026-10-19T00:00:00Z') })
    expect(m).toEqual(emptyManifest('the build is not in a git repository, so the team files could not be read', new Date('2026-10-19T00:00:00Z')))
    expect(m.history).toBeNull()
    expect(m.flow).toEqual({ unreadable: '.claude/team.md' })
  })

  it('reports a history it cannot read, and keeps the sections', () => {
    const r = repo()
    r.commit(BASE, 'Base')
    const m = generate({ root: r.dir, maxUpdates: Symbol('not a number') })
    expect(m.history).toBeNull()
    expect(m.problems.map((p) => p.path)).toEqual(['.git'])
    expect(m.sections.roles.items).toHaveLength(3)
  }, SLOW)
})

describe('the history (AC-6, AC-7)', () => {
  it('uses the subject when a GitHub merge has no title in its body, and skips merges of main into a branch', () => {
    const r = repo()
    r.commit(BASE, 'Base')
    r.git(['checkout', '-q', '-b', 'feature'])
    const own = r.commit({ '.claude/agents/chief-editor.md': agent('chief-editor', 'Edits.') }, 'Feature work')
    r.git(['checkout', '-q', 'main'])
    r.commit({ '.claude/agents/fact-checker.md': agent('fact-checker', 'Main moved.') }, 'Main moved on')
    r.git(['checkout', '-q', '-b', 'side', 'main'])
    r.commit({ '.claude/skills/publish/SKILL.md': skill('publish').replace('editors', 'writers') }, 'Side work')
    r.git(['checkout', '-q', 'main'])
    const untitled = r.merge('side', 'Merge pull request #7 from someone/side')
    r.git(['checkout', '-q', 'feature'])
    r.merge('main', "Merge branch 'main' into feature")
    const m = generate({ root: r.dir })
    expect(m.history.updates.map((update) => update.summary)).toEqual(['Feature work', 'Base'])
    expect(m.history.updates[0].sha).toBe(own)
    const onMain = generate({ root: r.dir, ref: 'main' })
    expect(onMain.history.updates.find((update) => update.sha === untitled)).toMatchObject({ summary: 'Merge pull request #7 from someone/side', pr: 7 })
  }, SLOW)

  it('counts a Site update change only when its team step changed', () => {
    const r = repo()
    r.commit(BASE, 'Base')
    r.commit({ '.github/workflows/site-update.yml': siteUpdate({ team: 'Spec, then build.' }) }, 'Inside the team step')
    r.commit({ '.github/workflows/site-update.yml': siteUpdate({ team: 'Spec, then build.', other: 'echo another mail' }) }, 'Outside the team step')
    r.commit({ '.github/workflows/site-update.yml': siteUpdate({ team: 'Spec first, always.', other: 'echo a third mail' }) }, 'In both')
    const m = generate({ root: r.dir })
    expect(m.history.updates.map((update) => [update.summary, update.sections])).toEqual([['In both', ['siteUpdate']], ['Inside the team step', ['siteUpdate']], ['Base', ['flow', 'roles', 'checks', 'commands', 'siteUpdate', 'rules']]])
  }, SLOW)

  it('counts a change to how the pull request is opened, and not one to another step (AC-14)', () => {
    const r = repo()
    r.commit({ ...BASE, '.github/workflows/site-update.yml': siteUpdate({ open: 'gh pr create' }) }, 'Base')
    r.commit({ '.github/workflows/site-update.yml': siteUpdate({ open: 'gh pr create --draft' }) }, 'How the pull request opens')
    r.commit({ '.github/workflows/site-update.yml': siteUpdate({ open: 'gh pr create --draft', other: 'echo another mail' }) }, 'Another step')
    const m = generate({ root: r.dir })
    expect(m.history.updates.map((update) => [update.summary, update.sections])).toEqual([['How the pull request opens', ['siteUpdate']], ['Base', ['flow', 'roles', 'checks', 'commands', 'siteUpdate', 'rules']]])
    expect(m.sections.siteUpdate.steps.map((step) => step.name)).toEqual(['Let Claude make the change', 'Open the pull request'])
  }, SLOW)

  it('counts a CLAUDE.md change only when its "The team" section changed', () => {
    const r = repo()
    r.commit(BASE, 'Base')
    r.commit({ 'CLAUDE.md': RULES().replace('One source.', 'One source, always.') }, 'Outside the team section')
    r.commit({ 'CLAUDE.md': RULES('Every change goes through every editor.').replace('One source.', 'One source, always.') }, 'Inside the team section')
    r.commit({ 'CLAUDE.md': RULES('Every change goes through every editor.').replace('Tiles.', 'Tiles, sorted.') }, 'The next section')
    const m = generate({ root: r.dir })
    expect(m.history.updates.map((update) => [update.summary, update.sections])).toEqual([['Inside the team section', ['rules']], ['Base', ['flow', 'roles', 'checks', 'commands', 'siteUpdate', 'rules']]])
    expect(m.sections.rules.paragraphs[0]).toBe('Every change goes through every editor.')
  }, SLOW)

  it('reports a CLAUDE.md without the team section, and a repository without CLAUDE.md, as a part it cannot read', () => {
    const r = repo()
    r.commit({ ...BASE, 'CLAUDE.md': '# Site\n\n## Facts\n\nOne source.\n' }, 'Base')
    let m = generate({ root: r.dir })
    expect(m.sections.rules).toEqual({ unreadable: 'CLAUDE.md' })
    expect(m.problems.map((p) => [p.path, p.message])).toEqual([['CLAUDE.md', 'no "## The team" section in CLAUDE.md']])
    r.commit({ 'CLAUDE.md': null }, 'No CLAUDE.md')
    m = generate({ root: r.dir })
    expect(m.sections.rules).toEqual({ unreadable: 'CLAUDE.md' })
    // Without a rules entry in the list there is no rules part at all.
    m = generate({ root: r.dir, orchestration: ORCHESTRATION.filter((entry) => entry.section !== 'rules') })
    expect(m.sections.rules).toBeUndefined()
  }, SLOW)

  it('skips the merges git writes to bring a branch up to date, from any branch', () => {
    const r = repo()
    r.commit(BASE, 'Base')
    r.git(['checkout', '-q', '-b', 'other'])
    r.commit({ '.claude/agents/chief-editor.md': agent('chief-editor', 'Other work.') }, 'Other work')
    r.git(['checkout', '-q', 'main'])
    r.git(['checkout', '-q', '-b', 'feature'])
    const own = r.commit({ '.claude/agents/fact-checker.md': agent('fact-checker', 'Feature work.') }, 'Feature work')
    r.merge('other', "Merge branch 'other' into feature")
    r.merge('main', "Merge remote-tracking branch 'origin/main' into feature")
    const m = generate({ root: r.dir })
    expect(m.history.updates.map((update) => update.summary)).toEqual(['Feature work', 'Base'])
    expect(m.history.updates[0].sha).toBe(own)
    for (const subject of ["Merge branch 'main' into feature", "Merge remote-tracking branch 'origin/main' into x", "Merge branch 'review-team' into admin-team-page", "Merge branch 'a' of https://github.com/x/y into b", `Merge ${"a".repeat(40)} into ${"b".repeat(40)}`]) expect(SYNC_MERGE.test(subject), subject).toBe(true)
    for (const subject of ['Merge pull request #4 from a/b', 'Merge feature: the page says so', "Merge branch 'feature'"]) expect(SYNC_MERGE.test(subject), subject).toBe(false)
  }, SLOW)

  it('reads the pull request title from the merge alone: separators in a body cannot add a record', () => {
    const r = repo()
    r.commit(BASE, 'Base')
    r.git(['checkout', '-q', '-b', 'feature'])
    r.commit({ '.claude/agents/fact-checker.md': agent('fact-checker', 'Feature work.') }, 'Feature work')
    r.git(['checkout', '-q', 'main'])
    const fake = `${'f'.repeat(40)}\x1f\x1f2026-10-01T00:00:00Z\x1fInjected\x1f.claude/agents/x.md`
    const merged = r.merge('feature', 'Merge pull request #5 from a/feature', `The fact checker\n\nMore \x1e${fake}`)
    const m = generate({ root: r.dir })
    expect(m.history.updates.map((update) => [update.summary, update.pr])).toEqual([['The fact checker', 5], ['Base', null]])
    expect(m.history.updates[0].sha).toBe(merged)
    expect(JSON.stringify(m)).not.toContain('Injected')
  }, SLOW)

  it('a shallow clone builds the sections with no history and no launch', () => {
    const r = repo()
    r.commit(BASE, 'Base')
    r.commit({ 'README.md': 'more\n' }, 'Second')
    const clone = mkdtempSync(join(tmpdir(), 'team-manifest-shallow-'))
    made.push(clone)
    execFileSync('git', ['clone', '-q', '--depth', '1', `file:///${r.dir.split('\\').join('/').replace(/^\//, '')}`, clone], { stdio: 'pipe', env: { ...process.env, ...GIT_ENV } })
    const m = generate({ root: clone })
    expect(m.history).toBeNull()
    expect(m.launch).toBeNull()
    expect(m.problems).toEqual([])
    expect(m.sections.roles.items).toHaveLength(3)
  }, SLOW)

  it('tying the steps to the chart is no change to a step; a node drawn differently at the same time is', () => {
    const r = repo()
    const untied = TEAM.replace(/  class [^\n]*\n/g, '').replace(/  %% step [^\n]*\n/g, '')
    r.commit({ ...BASE, '.claude/team.md': untied }, 'Base')
    r.commit({ '.claude/team.md': TEAM }, 'Steps tied to the chart')
    r.commit({ '.claude/team.md': untied }, 'Untied again')
    r.commit({ '.claude/team.md': TEAM.replace('pub[Publish to the site]', 'pub[Publish to the website]') }, 'Tied, and a node renamed')
    const m = generate({ root: r.dir })
    const by = Object.fromEntries(m.history.updates.map((update) => [update.summary, update]))
    expect(m.problems).toEqual([])
    expect(by['Steps tied to the chart']).toMatchObject({ sections: ['flow'], steps: [] })
    // From tied to untied, each step loses its node: that is a change to the drawing of every step.
    expect(by['Untied again'].steps).toEqual(['intake', 'draft', 'questions', 'publish'])
    expect(by['Tied, and a node renamed']).toMatchObject({ sections: ['flow'], steps: ['publish'] })
  }, SLOW)

  it('the launch is the oldest first-parent commit that adds the generator; older updates are before it', () => {
    const r = repo()
    const base = r.commit(BASE, 'Base')
    r.git(['checkout', '-q', '-b', 'team-page'])
    r.commit({ 'scripts/team-manifest.mjs': '// generator\n', '.claude/agents/chief-editor.md': agent('chief-editor', 'Now on the page.') }, 'Add the generator')
    r.git(['checkout', '-q', 'main'])
    const launch = r.merge('team-page', 'Merge team-page: the team page')
    const later = r.commit({ 'scripts/team-manifest.mjs': '// generator, changed\n', '.claude/agents/fact-checker.md': agent('fact-checker', 'Later.') }, 'Later change')
    const m = generate({ root: r.dir })
    expect(m.launch).toBe(launch)
    expect(m.history.updates.map((update) => [update.sha, update.beforeLaunch])).toEqual([[later, false], [launch, false], [base, true]])
  }, SLOW)

  it('keeps at most 200 updates and counts the older ones', () => {
    const r = repo()
    const lines = []
    for (let i = 0; i < 250; i++) {
      const content = `---\nname: a\ndescription: Version ${i}.\n---\n`
      const message = `Change ${i}`
      lines.push('commit refs/heads/main', `mark :${i + 1}`, `committer Fixture <fixture@example.invalid> ${1_760_000_000 + i * 60} +0000`, `data ${Buffer.byteLength(message)}`, message)
      if (i > 0) lines.push(`from :${i}`)
      lines.push('M 100644 inline .claude/agents/a.md', `data ${Buffer.byteLength(content)}`, content, '')
    }
    execFileSync('git', ['fast-import', '--quiet'], { cwd: r.dir, input: `${lines.join('\n')}\n`, env: { ...process.env, ...GIT_ENV } })
    const m = generate({ root: r.dir })
    expect(m.history.updates).toHaveLength(MAX_UPDATES)
    expect(m.history.older).toBe(50)
    expect(m.history.updates[0].summary).toBe('Change 249')
    expect(m.history.truncated).toBe(false)
  }, SLOW)

  it('drops the oldest updates beyond the size limit and says so', () => {
    const small = generate({ root: shared.dir, maxBytes: JSON.stringify(sharedManifest).length - 10 })
    expect(small.history.updates).toHaveLength(3)
    expect(small.history.older).toBe(1)
    expect(small.history.truncated).toBe(true)
  }, SLOW)
})

describe('flow steps that changed (AC-20 c)', () => {
  it('marks a step whose text or chart node changed; an inserted step marks only itself; a removed step is named', () => {
    const r = repo()
    r.commit(BASE, 'Base')
    const text = TEAM.replace('Ask the owner once.', 'Ask the owner once, all together.')
    r.commit({ '.claude/team.md': text }, 'Step text')
    const label = text.replace('q{Questions only the owner can answer?}', 'q{Anything only the owner can answer?}')
    r.commit({ '.claude/team.md': label }, 'Node label')
    // A step inserted before the others (with its own node, edges out of it only): the steps
    // after it are renumbered, and still not marked.
    const inserted = label
      .replace('1. **Intake** (lead). Restate the ask.', '1. **Intake** (lead). Restate the ask.\n2. **Plan**. Plan it.')
      .replace('2. **Draft**', '3. **Draft**').replace('3. **Questions.**', '4. **Questions.**').replace('4. **Publish**', '5. **Publish**')
      .replace('%% step 4: pub', '%% step 5: pub').replace('%% step 3: q', '%% step 4: q').replace('%% step 2: draft', '%% step 3: draft\n  %% step 2: plan')
      .replace('  pub -.-> done[Done]', '  pub -.-> done[Done]\n  plan[Plan] -.-> draft')
    r.commit({ '.claude/team.md': inserted }, 'A step inserted')
    r.commit({ '.claude/team.md': label }, 'A step removed')
    const part = `${label}\n## Another part\n\nMore.\n`
    r.commit({ '.claude/team.md': part }, 'Another part')
    const roles = part.replace('the facts | the merge', 'every fact | the merge').replace('optional, never blocks', 'optional')
    r.commit({ '.claude/team.md': roles }, 'Roles and verdict')
    r.commit({ '.claude/team.md': roles.replace('| Fact checker | `fact-checker` | every fact | the merge |\n', '') }, 'Row removed')
    const m = generate({ root: r.dir })
    const by = Object.fromEntries(m.history.updates.map((update) => [update.summary, update]))
    expect(by['Step text']).toMatchObject({ sections: ['flow'], steps: ['questions'], removedSteps: [] })
    expect(by['Node label']).toMatchObject({ sections: ['flow'], steps: ['questions'] })
    expect(by['A step inserted']).toMatchObject({ sections: ['flow'], steps: ['plan'] })
    expect(by['A step removed']).toMatchObject({ sections: ['flow'], removedSteps: ['Plan'] })
    expect(by['Another part']).toMatchObject({ sections: ['flow'], steps: [] })
    expect(by['Roles and verdict']).toMatchObject({ sections: ['roles', 'checks'], roles: ['fact-checker'], steps: [] })
    expect(by['Row removed']).toMatchObject({ sections: ['roles'], roles: ['fact-checker'] })
  }, SLOW)

  it('marks the steps that name a Review job that changed', () => {
    const r = repo()
    r.commit(BASE, 'Base')
    r.commit({ '.github/workflows/review.yml': 'name: broken\n' }, 'Broken workflow')
    r.commit({ '.github/workflows/review.yml': REVIEW.replace('Panel reviews', 'Panel reviews twice') }, 'Panel job')
    r.commit({ '.github/workflows/review.yml': REVIEW.replace('Panel reviews', 'Panel reviews twice').replace('echo spell', 'echo spell again') }, 'Proof job')
    const m = generate({ root: r.dir })
    expect(m.history.updates.slice(0, 3).map((update) => [update.summary, update.sections, update.steps])).toEqual([
      ['Proof job', ['flow', 'checks'], ['publish']],
      ['Panel job', ['flow', 'checks'], ['publish']],
      ['Broken workflow', ['flow', 'checks'], ['publish']],
    ])
  }, SLOW)
})

describe('the chart parser (AC-20 a, b)', () => {
  const chart = TEAM.slice(TEAM.indexOf('flowchart'), TEAM.indexOf('```\n\n1.'))
  const diagram = (source, steps = [1, 2, 3, 4]) => buildDiagram(parseChart(source), steps)

  it('a step and a node more give one more node with its label, step and members', () => {
    const more = chart.replace('pub -.-> done[Done]', 'pub -.-> done[Done] --> extra[Extra check]\n  subgraph extra [Extra check]\n    e1[One] & e2[Two]\n  end').replace('%% step 4: pub', '%% step 4: pub\n  %% step 5: extra')
    const built = diagram(more, [1, 2, 3, 4, 5])
    expect(built.problems).toEqual([])
    expect(built.diagram.nodes.at(-1)).toMatchObject({ id: 'extra', label: 'Extra check', steps: [5], members: [{ label: 'One', via: null }, { label: 'Two', via: null }] })
    expect(built.diagram.nodes).toHaveLength(8)
  })

  it('a step without a step line, a line naming a missing node or step, a duplicate, or a class on a missing node is a problem and no diagram', () => {
    const cases = [
      [chart.replace('  %% step 4: pub\n', ''), 'step 4 has 0 "%% step" lines in the chart; it needs exactly one'],
      [chart.replace('%% step 4: pub', '%% step 4: nowhere'), '"%% step 4: nowhere" names a node the chart does not have'],
      [chart.replace('%% step 4: pub', '%% step 4: pub\n  %% step 9: pub'), '"%% step 9: pub" names a step that is not in the numbered list'],
      [chart.replace('%% step 4: pub', '%% step 4: pub\n  %% step 4: fix'), 'step 4 has 2 "%% step" lines in the chart; it needs exactly one'],
      [chart.replace('class ask,ans you', 'class ask,ghost you'), 'a class line names the node "ghost", which the chart does not have'],
      ['flowchart TD\n', 'the chart has no nodes'],
    ]
    for (const [source, message] of cases) {
      const built = diagram(source)
      expect(built.diagram).toBeNull()
      expect(built.problems).toContain(message)
    }
  })

  it('reads labels in quotes, plain node references, and ignores what it does not know', () => {
    const parsed = parseChart('graph LR\n  a["Quoted label"] --> b\n  b --- c[C];\n  style a fill:#fff\n  click a call x()\n  d -.-> a\n  e -.- d\n')
    expect(parsed.order).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(parsed.nodes.get('a').label).toBe('Quoted label')
    expect(parsed.nodes.get('b')).toMatchObject({ label: 'b', shape: 'box' })
    expect(parsed.edges).toEqual([{ from: 'a', to: 'b', label: null }, { from: 'b', to: 'c', label: null }, { from: 'd', to: 'a', label: null }, { from: 'e', to: 'd', label: null }])
    const built = buildDiagram(parsed, [])
    expect(built.diagram.nodes.find((node) => node.id === 'd').loop).toEqual({ to: 'a', label: null })
  })

  it('keeps the first label of a node and links a subgraph defined before it is referenced', () => {
    const parsed = parseChart('flowchart TD\n  subgraph g [Group]\n    m[Member]\n  end\n  g --> x[First]\n  x[Second] --> g\n  m --> x\n')
    expect(parsed.order).toEqual(['g', 'x'])
    expect(parsed.nodes.get('x').label).toBe('First')
    const built = buildDiagram(parsed, [])
    expect(built.diagram.nodes[1].loop).toEqual({ to: 'g', label: null })
    expect(built.diagram.nodes[0].next).toEqual([{ to: 'x', label: null }])
  })

  // The real chart changes with the team: these check its shape, never today's nodes (the
  // fixture tests above pin the exact drawing).
  it('reads the real team.md chart: every numbered step is mapped, with a You and a Gate node', () => {
    const text = readFileSync(join(repoRoot, '.claude/team.md'), 'utf8')
    const team = parseTeam(text, { agents: [], jobs: [] })
    const built = buildDiagram(team.chart, team.steps.map((step) => step.n))
    expect(built.problems).toEqual([])
    expect(built.diagram).not.toBeNull()
    const mapped = built.diagram.nodes.flatMap((node) => node.steps).sort((a, b) => a - b)
    expect(mapped).toEqual(team.steps.map((step) => step.n).sort((a, b) => a - b))
    expect(built.diagram.nodes.some((node) => node.lane === 'you')).toBe(true)
    expect(built.diagram.nodes.some((node) => node.gate)).toBe(true)
  })

  // A Site update run that builds nothing goes back to Steven as a labelled edge, not a node:
  // from 11 nodes the Team page drops its two lanes (fd-long).
  it('the real chart has the labelled edge from build back to ask, still 10 nodes', () => {
    const team = parseTeam(readFileSync(join(repoRoot, '.claude/team.md'), 'utf8'), { agents: [], jobs: [] })
    expect(team.chart.order).toHaveLength(10)
    expect(team.chart.edges).toContainEqual({ from: 'build', to: 'ask', label: 'nothing changed, so the run fails and Steven is told' })
    const build = buildDiagram(team.chart, team.steps.map((step) => step.n)).diagram.nodes.find((node) => node.id === 'build')
    expect(build).toMatchObject({ steps: [5], loop: { to: 'ask', label: 'nothing changed, so the run fails and Steven is told' } })
  })

  it('the team.md introduction says a run that changes nothing fails and Steven is told', () => {
    const intro = readFileSync(join(repoRoot, '.claude/team.md'), 'utf8').split('## ')[0].replace(/\s+/g, ' ')
    expect(intro).toContain('a run that changes nothing beyond the spec fails and Steven is told the request was not carried out')
  })
})

describe('the parts that read text', () => {
  it('takes out the other invisible characters: the Arabic letter mark, the word joiner and invisible operators, the Mongolian vowel separator', () => {
    expect(clean('a\u061Cb\u2060c\u2061d\u2062e\u2063f\u2064g\u180Eh')).toBe('abcdefgh')
  })

  it('reads a workflow expression as what it stands for, and a Markdown section by its heading', () => {
    expect(readable('Write ${{ steps.branch.outputs.spec }} for ${{ needs.brief.outputs.instruction }} and ${{ }}')).toBe('Write specs/<slug>.md for <instruction> and <value>')
    expect(cutSection('# A\n\n## The team\n\nOne.\n\nTwo.\n## Next\n\nNo.\n', 'The team')).toBe('One.\n\nTwo.')
    expect(cutSection('# A\n', 'The team')).toBeNull()
  })

  it('reads the log record by record, and drops one that does not read as a commit', () => {
    const a = 'a'.repeat(40)
    const b = 'b'.repeat(40)
    const record = (fields) => `\x1e${fields.join('\x1f')}`
    const log = [
      record([a, b, '2026-10-01T12:00:00+02:00', 'Good', '\n.claude/team.md\0CLAUDE.md\0']),
      record([b, '', '2026-09-01T12:00:00Z', 'Root', '\n.claude/team.md\0']),
      record(['not-a-sha', b, '2026-10-01T12:00:00Z', 'Bad hash', '']),
      record([a, 'zz', '2026-10-01T12:00:00Z', 'Bad parent', '']),
      record([a, b, 'yesterday', 'Bad date', '']),
      record([a, b, '2026-10-01T12:00:00Z', 'A subject\x1fwith a separator', '']),
    ].join('')
    expect(parseLog(log)).toEqual([
      { sha: a, parent: b, date: '2026-10-01T12:00:00+02:00', subject: 'Good', paths: ['.claude/team.md', 'CLAUDE.md'] },
      { sha: b, parent: null, date: '2026-09-01T12:00:00Z', subject: 'Root', paths: ['.claude/team.md'] },
    ])
  })

  it('normalises text: control, bidi and zero-width characters out, one line, 300 code points with an ellipsis, an emoji at the cut intact', () => {
    const subject = `Start\u202Eevil\u200B\nline two\u0007 ${'x'.repeat(5000)}`
    const out = clean(subject)
    expect(out.startsWith('Startevil line two x')).toBe(true)
    expect(Array.from(out)).toHaveLength(300)
    expect(out.endsWith('…')).toBe(true)
    // oxlint-disable-next-line no-control-regex -- asserting the control characters are gone
    expect(out).not.toMatch(/[\u0000-\u001f\u202a-\u202e\u200b-\u200f]/)
    const emoji = clean(`${'a'.repeat(298)}😀😀😀`)
    expect(Array.from(emoji)).toEqual([...'a'.repeat(298), '😀', '…'])
    expect(clean(null)).toBe('')
    expect(plain('**bold** and `code`')).toBe('bold and code')
    expect(slug('Spec sign-off!')).toBe('spec-sign-off')
    expect(slug('***')).toBe('part')
  })

  it('reads frontmatter, and refuses a file without it', () => {
    expect(frontmatter('---\nname: x\ndescription: \'quoted\'\n---\nbody')).toEqual({ fields: { name: 'x', description: 'quoted' }, body: 'body' })
    expect(frontmatter('no frontmatter')).toBeNull()
  })

  it('cuts one named workflow step, and finds none when the name is not there', () => {
    const text = siteUpdate()
    expect(cutStep(text, 'Let Claude make the change')).toMatch(/^      - name: Let Claude make the change\n[\s\S]*claude_args: .*'$/)
    expect(cutStep(text, 'Let Claude make the change')).not.toContain('Email Steven')
    expect(cutStep(text, 'Nope')).toBeNull()
  })

  it('reads job names and needs in their YAML forms, and refuses a job line it cannot read', () => {
    expect(parseJobs('jobs:\n  a:\n    name: "Quoted"\n    needs: b\n  b:\n    steps: []\n').map(({ key, name, needs }) => [key, name, needs])).toEqual([['a', 'Quoted', ['b']], ['b', null, []]])
    expect(() => parseJobs('jobs:\n  - a\n')).toThrow(/cannot read the job line/)
    expect(() => parseJobs('jobs:\nnext: 1\n')).toThrow(/no jobs/)
  })

  it('reads the team file without a flow or a verdict block', () => {
    const team = parseTeam('# Team\n\n| Role | Agent | Owns | Signs off on |\n|---|---|---|---|\n| A | `a` | x | y |\n')
    expect(team.roles.map((row) => row.agent)).toEqual(['a'])
    expect(team.steps).toEqual([])
    expect(team.chart).toBeNull()
    expect(team.levels).toEqual([])
    expect(team.protection).toBeNull()
    expect(parseTeam('just text').roles).toEqual([])
  })

  it('takes a step without a bold title as its title', () => {
    const team = parseTeam('## The flow\n\n1. Just do it.\n')
    expect(team.steps[0]).toMatchObject({ n: 1, title: 'Just do it', text: '', who: null })
  })

  it('takes the pull request title for GitHub merges, the text after the colon for local merges, and only a valid number', () => {
    expect(summaryOf('Merge pull request #41 from a/b', '\n  The title\nmore body')).toEqual({ summary: 'The title', pr: 41 })
    expect(summaryOf('Merge pull request #12abc from a/b', 'Title')).toEqual({ summary: 'Merge pull request #12abc from a/b', pr: null })
    expect(summaryOf('Merge pull request #99999999 from a/b', 'Title')).toEqual({ summary: 'Title', pr: null })
    expect(summaryOf('Merge feature-x: the page says so', 'body')).toEqual({ summary: 'The page says so', pr: null })
    expect(summaryOf('See https://evil.example/x and $(rm -rf /) `x`; y', '')).toEqual({ summary: 'See https://evil.example/x and $(rm -rf /) `x`; y', pr: null })
  })

  it('matches globs and refuses private paths even when listed', () => {
    expect(globToRegExp('.claude/**').test('.claude/a/b.md')).toBe(true)
    expect(globToRegExp('.claude/agents/*.md').test('.claude/agents/a/b.md')).toBe(false)
    expect(globToRegExp('**/*.test.*').test('functions/_lib/review/x.test.ts')).toBe(true)
    for (const path of ['.review/x/r1.md', 'a/.review/b', 'sources/a.md', '.env', '.env.local', '.dev.vars', 'x/.dev.vars.prod']) expect(refused(path), path).toBe(true)
    expect(refused('.claude/team.md')).toBe(false)
    const greedy = [{ glob: '**', section: 'flow' }]
    expect(entryFor('.review/x/r1.md', greedy)).toBeNull()
    expect(entryFor('.claude/team.md', greedy)).toEqual(greedy[0])
    expect(entryFor('functions/_lib/review/recruiter.test.ts')).toBeNull()
  })
})

describe('C1 and C4: what may and may not reach the manifest', () => {
  it('refuses a listed private path, and reads a file named like a shell command as a name', () => {
    const r = repo()
    r.commit({ ...BASE, '.review/x/r1.md': 'SENTINEL-COMMITTED', '.claude/agents/$(touch pwned).md': agent('$(touch pwned)') }, 'Base')
    const m = generate({ root: r.dir, orchestration: [...ORCHESTRATION, { glob: '.review/**', section: 'flow' }] })
    expect(JSON.stringify(m)).not.toContain('SENTINEL-COMMITTED')
    expect(m.files).not.toContain('.review/x/r1.md')
    expect(byKey(m.sections.roles.items)['$(touch pwned)']).toMatchObject({ agent: '$(touch pwned)' })
    expect(existsSync(join(r.dir, 'pwned'))).toBe(false)
    expect(existsSync(join(repoRoot, 'pwned'))).toBe(false)
  }, SLOW)

  it('leaves out text that looks like a token or an e-mail address, and says so', () => {
    const r = repo()
    r.commit({ ...BASE, '.claude/agents/chief-editor.md': agent('chief-editor', `Uses ghp_${'a1'.repeat(18)} and mail@example.com`) }, 'Base')
    const m = generate({ root: r.dir })
    expect(JSON.stringify(m)).not.toContain('ghp_')
    expect(byKey(m.sections.roles.items)['chief-editor'].description).toBe('')
    expect(m.problems.map((p) => p.message)).toEqual([expect.stringMatching(/^text that looks like a token or an e-mail address was left out: manifest\.sections\.roles\.items\[1\]\.description/)])
  }, SLOW)

  it('the scan finds tokens, keys and addresses, and leaves SHAs alone', () => {
    expect(scanSecrets({ a: `ghp_${'x'.repeat(36)}` })).toEqual(['manifest.a'])
    expect(scanSecrets({ b: ['fine', 'sk-ant-abc'] })).toEqual(['manifest.b[1]'])
    expect(scanSecrets({ c: 'AKIAABCDEFGHIJKLMNOP', d: '-----BEGIN KEY', e: 'x@y.co', f: 'a1'.repeat(20), g: 'github_pat_x', h: 'gho_x' }).sort()).toEqual(['manifest.c', 'manifest.d', 'manifest.e', 'manifest.f', 'manifest.g', 'manifest.h'])
    expect(scanSecrets({ sha: 'a'.repeat(40), commit: 'b1'.repeat(20), launch: null, n: 4, ok: 'functions/_lib/review/recruiter.ts' })).toEqual([])
  })
})

describe('the module vite.config.ts serves', () => {
  it('is the manifest as an ES module, with its problems to print', () => {
    const { code, problems } = manifestModule({ root: shared.dir })
    expect(code.startsWith('export default {"schema":"team-manifest/1"')).toBe(true)
    expect(problems).toEqual([])
    const broken = manifestModule({ root: tmpdir() + '/does-not-exist-team-manifest' })
    expect(broken.problems).toEqual(['.: the build is not in a git repository, so the team files could not be read'])
  }, SLOW)

  it('still answers when generating throws', () => {
    const { code, problems } = manifestModule({ orchestration: { find: () => { throw new Error('boom') } }, root: shared.dir })
    expect(code).toContain('"history":null')
    expect(problems).toEqual(['.: the team manifest could not be generated: boom'])
    // Even a throw before the commit is read (here, a clock that is not a date).
    const early = manifestModule({ now: {}, root: shared.dir })
    expect(early.problems).toEqual([expect.stringMatching(/^\.: the team manifest could not be generated: /)])
    const odd = manifestModule({ now: { toISOString: () => { throw 'odd' } }, root: shared.dir })
    expect(odd.problems).toEqual(['.: the team manifest could not be generated: odd'])
  }, SLOW)
})

// ---- this repository ------------------------------------------------------------------

describe('this repository', () => {
  it('lists or ignores, with a reason, every tracked file where orchestration lives (AC-4)', () => {
    const files = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean)
    const gaps = coverageGaps(files)
    expect(gaps.unlisted, 'add these to ORCHESTRATION or IGNORED (with a reason) in scripts/team-manifest.mjs').toEqual([])
    expect(gaps.badIgnores, 'these IGNORED entries need a reason and a file that exists').toEqual([])
    expect(IGNORED.every((entry) => entry.reason.length > 10)).toBe(true)
  })

  it('names an unlisted file, an ignore without a reason and an ignore whose file is gone', () => {
    const gaps = coverageGaps(['.claude/new-thing.md', 'scripts/new-gate.mjs', 'scripts/other.mjs', '.claude/team.md'], { ignored: [{ path: '.claude/old.md', reason: 'gone' }, { path: '.claude/team.md', reason: ' ' }] })
    expect(gaps.unlisted).toEqual(['.claude/new-thing.md', 'scripts/new-gate.mjs'])
    expect(gaps.badIgnores).toEqual(['.claude/old.md', '.claude/team.md'])
    expect(AUDITED).toContain('.claude/**')
  })

  it('gives no problems and no secrets when generated from this repository (AC-5)', () => {
    const manifest = generate({ root: repoRoot })
    expect(manifest.problems).toEqual([])
    expect(scanSecrets(manifest)).toEqual([])
    expect(manifest.flow.diagram).not.toBeNull()
    const steps = manifest.flow.steps.map((step) => step.n).sort((a, b) => a - b)
    expect(manifest.flow.diagram.nodes.flatMap((node) => node.steps).sort((a, b) => a - b)).toEqual(steps)
    expect(manifest.sections.rules.paragraphs.length).toBeGreaterThan(0)
    expect(JSON.stringify(manifest).length).toBeLessThan(256 * 1024)
  }, SLOW)

  it('draws step 8 as the pull request with its three required checks, still 10 nodes, the gates and Steven where they were (specs/mcp-prs-flow.md, AC-11)', () => {
    const team = committed('.claude/team.md').replace(/\r\n/g, '\n')
    expect(team).toContain("  subgraph pr [Pull request: its required checks start on it]\n    prGates[gates: main's checkers]\n    prTeam[team: six reviews, with the assistant check in CI]\n    prCheck[check: site checks]\n  end\n")
    for (const line of ['  class ask,steven1,merge you', '  class spec,reviews,pr gate', '  %% step 8: pr', '  %% step 9: merge', '  pr --> merge([Steven merges]) --> deploy[Deploy to steven.wilssens.com]']) expect(team).toContain(line)
    expect(team).not.toMatch(/auto-?merge|merges by itself|redo/i)
    const chart = /```mermaid\n([\s\S]*?)```/.exec(team)[1]
    const members = chart.slice(chart.indexOf('subgraph pr '), chart.indexOf('  end\n', chart.indexOf('subgraph pr ')))
    for (const label of members.matchAll(/\[([^\]]*)\]/g)) expect(label[1], 'no bracket or parenthesis inside a label').not.toMatch(/[[\]()]/)
    const manifest = generate({ root: repoRoot })
    expect(manifest.flow.diagram.nodes).toHaveLength(10)
    const pr = manifest.flow.diagram.nodes.find((node) => node.id === 'pr')
    expect(pr).toMatchObject({ label: 'Pull request: its required checks start on it', shape: 'group', gate: true, steps: [8], members: [{ label: "gates: main's checkers", via: null }, { label: 'team: six reviews, with the assistant check in CI', via: null }, { label: 'check: site checks', via: null }] })
    expect(manifest.flow.diagram.nodes.find((node) => node.id === 'merge')).toMatchObject({ lane: 'you', steps: [9] })
    const step8 = JSON.stringify(manifest.flow.steps.find((step) => step.n === 8)).replace(/\s+/g, ' ')
    for (const words of ['job opens the pull request', "site's App", 'start Review, Site checks and Deploy on the pull request', 'assistant check in CI', 'recheck: true']) expect(step8, words).toContain(words)
    expect(team).toContain('9. **Merge**: only when every sign-off is `APPROVE`, CI is green and Steven says so.')
  }, SLOW)

  it('CLAUDE.md says who opens Site update pull requests and what that changes (AC-13)', () => {
    const claude = committed('CLAUDE.md').replace(/\r\n/g, '\n')
    const rules = cutSection(claude, 'The team').replace(/\s+/g, ' ')
    for (const words of ["pushed and opened by the site's GitHub App", 'runs no branch code', 'the required checks start on the pull request', 'read-only token', 'nothing the App or a workflow writes counts as his', 'assistant check', 'recheck: true', 'Merging stays his']) expect(rules, words).toContain(words)
    const mcp = cutSection(claude, 'The MCP server').replace(/\s+/g, ' ')
    for (const words of ['recheck', '`project`', '`sourceSha`']) expect(mcp, words).toContain(words)
  })

  it('lists the assistant check harness as a checker, which the write-up also watches (AC-14)', () => {
    expect(entryFor('scripts/assistant-check.mjs')).toMatchObject({ section: 'checks' })
    const notify = readFileSync(join(repoRoot, '.github/workflows/building-notify.yml'), 'utf8')
    const paths = JSON.parse(/paths: (\[.*\])/.exec(notify)[1].replace(/'/g, '"'))
    expect(paths.some((glob) => globToRegExp(glob).test('scripts/assistant-check.mjs'))).toBe(true)
    const sources = JSON.parse(readFileSync(join(repoRoot, 'src/articles/sources.json'), 'utf8'))
    expect(sources.site.sources).toContain('scripts/assistant-check.mjs')
    expect(ORCHESTRATION.find((entry) => entry.glob === '.github/workflows/site-update.yml').steps).toEqual(['Let Claude make the change', 'Open the pull request'])
  })

  it('types no role name, job name or bar into src/admin (AC-2)', () => {
    const agents = readdirSync(join(repoRoot, '.claude/agents')).map((file) => frontmatter(readFileSync(join(repoRoot, '.claude/agents', file), 'utf8')).fields.name)
    expect(agents.length).toBeGreaterThan(0)
    const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]))
    const sources = walk(join(repoRoot, 'src/admin')).filter((path) => /\.(ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path) && !/fixture/.test(path))
    expect(sources.length).toBeGreaterThan(10)
    for (const path of sources) {
      const text = readFileSync(path, 'utf8')
      for (const name of [...agents, 'senior-recruiter']) expect(text, `${path} names ${name}`).not.toContain(name)
      expect(text, `${path} names the gates job`).not.toMatch(/['"`]gates['"`]/)
      expect(text, `${path} types a bar`).not.toContain('90%')
    }
  })
})
