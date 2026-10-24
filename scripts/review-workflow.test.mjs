// @vitest-environment node
// The Review workflow (.github/workflows/review.yml) as text: what starts it, who counts as
// Steven, which bot may start the team review, the assistant check's two jobs and what the
// reviewers are told about the preview (specs/mcp-prs-flow.md, AC-1, AC-5, AC-9, AC-10).
// The YAML is not measured by coverage; these turn red when it drifts.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cutStep } from './team-manifest.mjs'

const root = resolve(import.meta.dirname, '..')
const workflow = readFileSync(join(root, '.github/workflows/review.yml'), 'utf8').replace(/\r\n/g, '\n')
const jobOf = (key) => {
  const start = workflow.indexOf(`\n  ${key}:\n`)
  expect(start, `the job ${key}`).toBeGreaterThan(-1)
  const next = workflow.slice(start + 1).search(/\n {2}[a-z][a-z-]*:\n/)
  return next === -1 ? workflow.slice(start + 1) : workflow.slice(start + 1, start + 1 + next)
}
const stepOf = (job, name) => {
  const block = cutStep(job, name)
  expect(block, `the step "${name}"`).not.toBeNull()
  return block
}
const gates = jobOf('gates')
const team = jobOf('team')
const input = jobOf('assistant-input')
const mainInput = jobOf('assistant-input-main')
const check = jobOf('assistant')
const prompt = stepOf(team, 'The team reviews the pull request')

describe('what starts it (AC-1)', () => {
  it('gates and team run on every pull request to main: opened, synchronize, reopened (so a recheck starts them)', () => {
    expect(workflow).toMatch(/^on:\n {2}pull_request:\n {4}branches: \[main\]\n {4}types: \[opened, synchronize, reopened, ready_for_review\]\n/m)
  })

  it('one review per pull request: a recheck cancels the older run', () => {
    expect(workflow).toMatch(/^concurrency:\n {2}group: review-\$\{\{ github\.event\.pull_request\.number \|\| inputs\.pr \}\}\n {2}cancel-in-progress: true$/m)
  })
})

describe('only Steven counts as Steven (AC-5)', () => {
  it('the label counts only when the repository owner added it', () => {
    const score = stepOf(gates, 'Resume ATS score against the live site')
    expect(score).toContain(`select(.event == "labeled" and .label.name == "accept-lower-score") | .actor.login' | tail -n 1)`)
    expect(score).toContain('if [ "$by" = "$GITHUB_REPOSITORY_OWNER" ]; then')
  })

  it('only comments whose author and last editor are the owner are his replies', () => {
    expect(stepOf(team, "A clean folder for the reports, and Steven's replies on the pull request")).toContain('select(.author.login == $owner and (.editor == null or .editor.login == $owner))')
  })

  it("lets only the site bot start the team review, by its slug: never '*', no longer github-actions", () => {
    expect(prompt).toMatch(/\n {10}allowed_bots: \$\{\{ vars\.SITE_BOT_SLUG \}\}\n/)
    expect(workflow).not.toMatch(/allowed_bots: ['"]?\*|allowed_bots: ['"]?github-actions/)
  })

  it("a pull request by another bot is not Dependabot's: dependabot[bot] exactly, on author, actor, triggering actor, branch and commit", () => {
    const who = stepOf(team, "Dependabot's own dependency update?")
    expect(who).toContain(`[ "$AUTHOR" = 'dependabot[bot]' ] && [ "$GITHUB_ACTOR" = 'dependabot[bot]' ] && [ "\${GITHUB_TRIGGERING_ACTOR:-$GITHUB_ACTOR}" = 'dependabot[bot]' ] && [[ "$HEAD_REF" == dependabot/* ]]`)
    expect(who).toContain(`if [ "$commit_author" = 'dependabot[bot]' ]; then dependabot=true; fi`)
  })
})

describe('the assistant check (AC-9)', () => {
  const scope = stepOf(input, 'Does the change reach the assistant?')
  const pattern = new RegExp(/grep -qE '([^']+)'/.exec(scope)[1])

  it.each([
    ['functions/api/ask.ts', true], ['functions/api/ask/report.ts', true], ['functions/_lib/ask/prompt.ts', true], ['src/resume.ts', true],
    ['src/articles/site/SiteArticle.tsx', true], ['src/articles/aibreaker/feed.json', true], ['src/patents.ts', true],
    ['functions/_lib/assistant-input.ts', true], ['scripts/assistant-export.ts', true],
    ['src/ask/AskAssistant.tsx', false], ['src/resume.test.ts', false], ['functions/_lib/github.ts', false], ['README.md', false],
  ])('a change to %s runs it: %s', (path, runs) => {
    expect(pattern.test(path)).toBe(runs)
  })

  it("runs only for this repository's pull requests (a fork gets no key)", () => {
    expect(scope).toContain("SAME_REPO: ${{ github.event_name == 'workflow_dispatch' || github.event.pull_request.head.repo.full_name == github.repository }}")
    expect(scope).toContain('if [ "$SAME_REPO" = true ] && git diff --name-only origin/main...HEAD')
  })

  it("job A has no secret and no token, and builds the branch's input with the export from the build", () => {
    expect(input).toMatch(/^ {4}permissions: \{\}$/m)
    expect(input).not.toMatch(/secrets\./)
    expect(input).toContain('persist-credentials: false')
    // The bundle is built inside the checkout, where node_modules resolves its imports.
    const branch = stepOf(input, "The branch's input")
    expect(branch).toContain('npx vite build --ssr scripts/assistant-export.ts --outDir .assistant-export --emptyOutDir --logLevel warn')
    expect(branch).toContain('node .assistant-export/assistant-export.js dist https://steven.wilssens.com/api/notes "$RUNNER_TEMP/assistant-input/branch.json"')
    expect(input).not.toMatch(/--outDir "\$RUNNER_TEMP/)
    // main's input is no longer built here, beside the branch's npm ci and build (AC-14).
    expect(cutStep(input, "main's input")).toBeNull()
    expect(input).not.toMatch(/git worktree add|assistant-input\/main\.json/)
  })

  it('assistant-input-main checks out ref main, on its own runner, with no secret, no branch checkout and no step after a branch checkout (AC-14, C21)', () => {
    expect(mainInput).toMatch(/^ {4}runs-on: ubuntu-latest$/m)
    expect(mainInput).toMatch(/^ {4}permissions: \{\}$/m)
    expect(mainInput).not.toMatch(/secrets\.|github\.token|environment:/)
    const checkouts = [...mainInput.matchAll(/- uses: actions\/checkout@v\d+\n((?: {8}.+\n)+)/g)].map((match) => match[1])
    expect(checkouts).toEqual([`${' '.repeat(8)}with:\n${' '.repeat(10)}ref: main\n${' '.repeat(10)}persist-credentials: false\n`])
    expect(mainInput).not.toMatch(/git (worktree|checkout|fetch)|head\.sha|head_ref|github\.sha/)
    // No npm cache shared with the branch's job.
    expect(mainInput).not.toMatch(/cache: npm/)
    const build = stepOf(mainInput, "main's input")
    expect(build).toContain('node .assistant-export/assistant-export.js dist https://steven.wilssens.com/api/notes "$RUNNER_TEMP/assistant-input/main.json"')
    expect(build).not.toMatch(/\bcp\b/)
  })

  it('outputs the sha256 of each input, and each job uploads under its own name', () => {
    expect(mainInput).toContain('digest: ${{ steps.main.outputs.digest }}')
    expect(stepOf(mainInput, "main's input")).toContain(`echo "digest=$(sha256sum "$RUNNER_TEMP/assistant-input/main.json" | cut -d' ' -f1)" >> "$GITHUB_OUTPUT"`)
    expect(input).toContain('digest: ${{ steps.branch.outputs.digest }}')
    expect(stepOf(input, "The branch's input")).toContain(`echo "digest=$(sha256sum "$RUNNER_TEMP/assistant-input/branch.json" | cut -d' ' -f1)" >> "$GITHUB_OUTPUT"`)
    expect(input).toContain('name: assistant-input-branch')
    expect(input).not.toContain('name: assistant-input-main')
    expect(mainInput).toContain('name: assistant-input-main')
  })

  it("assistant takes each input only when its digest equals its job's output; a mismatch or a missing input reads did not run", () => {
    const ask = stepOf(check, 'Ask the assistant on the branch and on main')
    expect(ask).toContain('BRANCH_DIGEST: ${{ needs.assistant-input.outputs.digest }}')
    expect(ask).toContain('MAIN_DIGEST: ${{ needs.assistant-input-main.outputs.digest }}')
    expect(check).toContain('name: assistant-input-branch\n          path: ${{ runner.temp }}/assistant-input-branch')
    expect(check).toContain('name: assistant-input-main\n          path: ${{ runner.temp }}/assistant-input-main')
    expect(ask).toContain(`[ "$(sha256sum "$file" | cut -d' ' -f1)" != "$want" ]`)
    expect(ask).toContain('Result: did not run (%s; see the run).')
    expect(ask.indexOf('problem=')).toBeLessThan(ask.indexOf('node scripts/assistant-check.mjs'))
  })

  it('the digest check gives its verdict on real files (bash)', () => {
    const run = /\n {8}run: \|\n([\s\S]*)$/.exec(stepOf(check, 'Ask the assistant on the branch and on main'))[1].replace(/^ {10}/gm, '')
    const dir = mkdtempSync(join(tmpdir(), 'assistant-digest-'))
    // Forward slashes, as on the runner: sha256sum escapes a name with a backslash in it.
    const unix = (path) => path.replaceAll('\\', '/')
    try {
      for (const side of ['branch', 'main']) { mkdirSync(join(dir, `assistant-input-${side}`)); writeFileSync(join(dir, `assistant-input-${side}`, `${side}.json`), `{"side":"${side}"}`) }
      const sha = (side) => createHash('sha256').update(`{"side":"${side}"}`).digest('hex')
      // scripts/assistant-check.mjs here is a stub that says it ran.
      mkdirSync(join(dir, 'scripts'))
      writeFileSync(join(dir, 'scripts/assistant-check.mjs'), "// --main-digest\nimport { writeFileSync } from 'node:fs'\nwriteFileSync(process.argv[process.argv.indexOf('--out') + 1], 'Result: passed')\n")
      const go = (env) => {
        try { execFileSync('bash', ['-c', run], { cwd: dir, env: { ...process.env, RUNNER_TEMP: unix(dir), GITHUB_OUTPUT: join(dir, 'out'), ANTHROPIC_API_KEY: 'x', ...env }, encoding: 'utf8', stdio: 'pipe' }); return 0 } catch (error) { return error.status }
      }
      const report = () => readFileSync(join(dir, 'assistant-check/assistant-check.md'), 'utf8')
      expect(go({ BRANCH_DIGEST: sha('branch'), MAIN_DIGEST: sha('main') })).toBe(0)
      expect(report()).toContain('Result: passed')
      expect(go({ BRANCH_DIGEST: sha('branch'), MAIN_DIGEST: sha('branch') })).toBe(1)
      expect(report()).toContain('Result: did not run (the main input is not the one its job built; see the run).')
      expect(go({ BRANCH_DIGEST: '', MAIN_DIGEST: sha('main') })).toBe(1)
      expect(report()).toContain('Result: did not run (the branch input is not the one its job built')
      rmSync(join(dir, 'assistant-input-main/main.json'))
      expect(go({ BRANCH_DIGEST: sha('branch'), MAIN_DIGEST: sha('main') })).toBe(1)
      expect(report()).toContain('Result: did not run (the main input is missing; see the run).')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('is set up only when main has both the export and the harness, and builds nothing until then', () => {
    expect(scope).toContain('if git cat-file -e origin/main:scripts/assistant-check.mjs 2>/dev/null && git cat-file -e origin/main:scripts/assistant-export.ts 2>/dev/null; then setup=true; fi')
    expect(input).toContain('setup: ${{ steps.scope.outputs.setup }}')
    expect(stepOf(input, "The branch's input")).toContain("if: steps.scope.outputs.run == 'true' && steps.scope.outputs.setup == 'true'")
    expect(mainInput).toMatch(/^ {4}needs: assistant-input\n {4}if: needs\.assistant-input\.outputs\.run == 'true' && needs\.assistant-input\.outputs\.setup == 'true'$/m)
  })

  it('job B holds the key, checks out main only, runs main\'s harness, and has no Cloudflare token or database', () => {
    expect(check).toMatch(/^ {4}needs: \[assistant-input, assistant-input-main\]\n {4}if: needs\.assistant-input\.outputs\.run == 'true' && needs\.assistant-input\.outputs\.setup == 'true'$/m)
    expect(check).toMatch(/- uses: actions\/checkout@v\d+\n {8}with:\n {10}ref: main\n {10}persist-credentials: false\n/)
    expect(check.match(/uses: actions\/checkout/g)).toHaveLength(1)
    expect(check).toMatch(/^ {4}timeout-minutes: \d+$/m)
    expect(check).toContain('ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}')
    expect(check).not.toMatch(/CLOUDFLARE|wrangler|\bnpm\b|d1 /i)
    expect(stepOf(check, 'Ask the assistant on the branch and on main')).toContain('node scripts/assistant-check.mjs --branch "$branch" --main "$main" --branch-digest "$BRANCH_DIGEST" --main-digest "$MAIN_DIGEST" --out "$out"')
  })

  it('the key is in job B only: the team step runs on Steven’s Max plan', () => {
    const uses = [...workflow.matchAll(/secrets\.ANTHROPIC_API_KEY/g)].map((match) => match.index)
    expect(uses).toHaveLength(1)
    const inCheck = workflow.indexOf(check)
    expect(uses[0] > inCheck && uses[0] < inCheck + check.length).toBe(true)
    expect(prompt).not.toMatch(/anthropic_api_key|ANTHROPIC_API_KEY/)
    expect(prompt).toContain('claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}')
  })

  it('says "scope not decided", not "did not run", when the input job stopped before it read the diff', () => {
    const notRun = stepOf(team, 'Say when the assistant check did not run')
    expect(notRun).toContain('elif [ "$INPUT" != success ] && [ -z "$SCOPE" ]; then')
    expect(notRun).toContain('Result: scope not decided (its input job ended with "%s" before it read the diff; see the run)')
    expect(notRun.indexOf('scope not decided')).toBeLessThan(notRun.indexOf('Result: did not run (its input job ended with'))
    const said = prompt.replace(/\s+/g, ' ')
    expect(said).toContain('"Result: scope not decided" means the input job stopped before it read the diff: when the diff touches none of the assistant\'s files')
    expect(said).toContain('the assistant part is not applicable; when it does, it counts as "did not run".')
  })

  it("keeps the model's comment from opening or closing an HTML comment before the team-verdicts marker", () => {
    const post = stepOf(team, 'Post the sign-offs and pass or fail')
    expect(post).toContain("jq -r '.comment' .review/result.json | sed 's/<!--/\\&lt;!--/g; s/-->/--\\&gt;/g' > \"$RUNNER_TEMP/comment.md\"")
    expect(post.indexOf("jq -r '.comment'")).toBeLessThan(post.indexOf('<!-- team-verdicts %s -->'))
  })

  it('takes the report only when it is the one the check job wrote (its digest is that job\'s output; job A ran branch code and could upload one too)', () => {
    expect(check).toContain('digest: ${{ steps.ask.outputs.digest }}')
    expect(stepOf(check, 'Ask the assistant on the branch and on main')).toContain('if [ -f "$out" ]; then echo "digest=$(sha256sum "$out" | cut -d\' \' -f1)" >> "$GITHUB_OUTPUT"; fi')
    const notRun = stepOf(team, 'Say when the assistant check did not run')
    expect(notRun).toContain('DIGEST: ${{ needs.assistant.outputs.digest }}')
    // The artifact lands outside the checkout; only assistant-check.md is copied in, and only when its digest matches.
    expect(stepOf(team, "The assistant check's answers")).toContain('path: ${{ runner.temp }}/assistant-artifact')
    expect(notRun).toContain('downloaded="$RUNNER_TEMP/assistant-artifact/assistant-check.md"')
    expect(notRun).toContain('rm -rf .review/assistant')
    expect(notRun).toContain('if [ "$(sha256sum "$downloaded" | cut -d\' \' -f1)" = "$DIGEST" ]; then\n              cp "$downloaded" "$report"')
    expect(notRun.match(/\bcp /g)).toHaveLength(1)
    expect(notRun.indexOf('rm -rf .review/assistant')).toBeLessThan(notRun.indexOf('= "$DIGEST"'))
    expect(notRun.indexOf('= "$DIGEST"')).toBeLessThan(notRun.indexOf('not set up on main yet'))
  })

  it('team still runs when the assistant check failed or was skipped, and then reads "did not run"', () => {
    expect(team).toMatch(/^ {4}needs: \[gates, assistant-input, assistant, roster\]\n(?: {4}#.*\n)* {4}if: \$\{\{ !cancelled\(\) && needs\.gates\.result == 'success' && github\.event\.pull_request\.draft != true \}\}$/m)
    const notRun = stepOf(team, 'Say when the assistant check did not run')
    expect(notRun).toContain('Result: did not run (its input job ended with')
    expect(notRun).toContain('Result: did not run (the check job ended with')
    // Only the bootstrap reads "not set up": the input job ran, the change is in scope and main has no check yet.
    expect(notRun).toContain('if [ "$INPUT" = success ] && [ "$SCOPE" = true ] && [ "$SETUP" != true ]; then')
    expect(notRun).toContain('Result: not set up on main yet (main has no scripts/assistant-check.mjs and scripts/assistant-export.ts: the pull request that adds the check)')
    expect(team.indexOf("- name: A clean folder for the reports, and Steven's replies on the pull request")).toBeLessThan(team.indexOf("- name: The assistant check's answers"))
  })
})

describe('what the reviewers are told (AC-10, AC-8)', () => {
  it('the preview has no assistant, no Turnstile and no MCP, and nobody asks Steven for those checks', () => {
    expect(prompt).toContain('has no assistant, no Turnstile and no MCP')
    expect(prompt).toContain('No reviewer asks Steven for a check the preview cannot run.')
    const said = prompt.replace(/\s+/g, ' ')
    expect(said).toContain('"Result: failed" (an answer that does not match profile) is CHANGES_REQUESTED.')
    expect(said).toContain('"Result: did not run" is never a pass, and never a question for Steven: the recruiter\'s verdict is then CHANGES_REQUESTED (re-run the job).')
    expect(said).toContain('"Result: not set up on main yet" is only the pull request that adds the check: for the recruiter the assistant part is then not applicable (say so in the report; the verdict still covers the rest of the merge check).')
    // The part, never the verdict token, which the recruiter never uses.
    expect(said).not.toMatch(/assistant part is then NOT_APPLICABLE/)
  })

  it('the sign-off comment carries the team-verdicts marker of the reviewed commit', () => {
    const post = stepOf(team, 'Post the sign-offs and pass or fail')
    expect(post).toContain('HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}')
    expect(post).toContain("printf '\\n<!-- team-verdicts %s -->\\n' \"$verdicts\" >> \"$RUNNER_TEMP/comment.md\"")
    expect(post).toMatch(/jq -c --arg sha "\$HEAD_SHA" '\{sha: \$sha, roles: /)
  })
})

describe("the recruiter's rule for the assistant check (AC-9)", () => {
  // This commit's rule, through git: the Review workflow puts main's .claude/ on the disk before its team job.
  const recruiter = execFileSync('git', ['show', 'HEAD:.claude/agents/senior-recruiter.md'], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n').replace(/\s+/g, ' ')

  it('a check that did not run is CHANGES_REQUESTED, never NEEDS_STEVEN or APPROVE, and the CI answers replace the preview', () => {
    expect(recruiter).toContain('those answers replace the preview as your evidence')
    expect(recruiter).toContain('"Result: did not run" is never a pass and never a question for Steven: your verdict is then `CHANGES_REQUESTED` (re-run the job), never `APPROVE` and never `NEEDS_STEVEN`.')
    expect(recruiter).toContain('.review/assistant/assistant-check.md')
    expect(recruiter).not.toMatch(/return `NEEDS_STEVEN` asking him to put the three questions to the preview/)
  })

  it('a failed mechanical check is a blocker, CHANGES_REQUESTED; not set up on main is not applicable', () => {
    expect(recruiter).toContain('"Result: failed" (an answer that does not match `profile`) is a `blocker`: your verdict is `CHANGES_REQUESTED`.')
    expect(recruiter).toContain('"Result: not set up on main yet" happens only on the pull request that adds the check: the assistant part is then not applicable')
    expect(recruiter).toContain('"Result: scope not decided" (the input job stopped before it read the diff) is not applicable when the diff touches none of the assistant\'s files, and "did not run" when it does.')
  })
})

describe("the team-verdicts marker as the workflow's jq writes it (m-8)", () => {
  const hasJq = (() => { try { execFileSync('jq', ['--version'], { stdio: 'ignore' }); return true } catch { return false } })()
  it.skipIf(!hasJq)('is read back by the MCP server, with accents, curly quotes and a comment end in a summary', async () => {
    const post = stepOf(team, 'Post the sign-offs and pass or fail')
    const filter = /jq -c --arg sha "\$HEAD_SHA" '([^']+)' \.review\/result\.json/.exec(post)[1]
    const dir = mkdtempSync(join(tmpdir(), 'verdicts-'))
    try {
      const result = join(dir, 'result.json')
      writeFileSync(result, JSON.stringify({ approved: false, roles: [{ role: 'senior-recruiter', verdict: 'CHANGES_REQUESTED', blockers: 1, majors: 0, summary: 'Le résumé dit “now” --> pas “available”.' }, { role: 'senior-tester', verdict: 'APPROVE' }] }))
      const sha = 'a'.repeat(40)
      const json = execFileSync('jq', ['-c', '--arg', 'sha', sha, filter, result], { encoding: 'utf8' })
      const marker = `<!-- team-verdicts ${Buffer.from(json, 'utf8').toString('base64')} -->`
      const { teamVerdictsFrom } = await import('../functions/_lib/github.ts')
      expect(teamVerdictsFrom([{ author: 'github-actions', url: null, body: `Sign-offs\n${marker}\n` }], sha)).toEqual({ sha, url: null, stale: false, roles: [{ role: 'senior-recruiter', verdict: 'CHANGES_REQUESTED', summary: 'Le résumé dit “now” --> pas “available”.' }, { role: 'senior-tester', verdict: 'APPROVE', summary: '' }] })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('the panel: only the reviewers whose part changed, never on a draft', () => {
  const roster = jobOf('roster')

  it('decides in a job of its own that runs nothing from the pull request, with main\'s copy of the script', () => {
    expect(roster).toMatch(/^ {4}if: github\.event\.pull_request\.draft != true$/m)
    expect(roster).not.toMatch(/npm (ci|run|test)|npx /)
    expect(roster).toContain('git show origin/main:scripts/review-roster.mjs > "$roster"')
    expect(roster).toContain('persist-credentials: false')
    expect(roster).toMatch(/permissions:\n {6}contents: read\n {6}pull-requests: read\n/)
  })

  it('reads the previous verdicts only from this workflow\'s own comment, and only files of the pull request since', () => {
    expect(roster).toContain('select(.user.login == "github-actions[bot]")')
    expect(roster).toContain('git merge-base --is-ancestor "$prev" HEAD')
    expect(roster).toContain('grep -Fx -f "$RUNNER_TEMP/changed.txt"')
  })

  it('hands the team job its answer as job outputs, which nothing in the team job can change', () => {
    expect(team).toContain('PANEL: ${{ needs.roster.outputs.run }}')
    expect(team).toContain('ROSTER: ${{ needs.roster.outputs.json }}')
    const post = stepOf(team, 'Post the sign-offs and pass or fail')
    expect(post).toContain(`jq --argjson r "$ROSTER" '.roles = ([(.roles // [])[] | select(.role as $role | $r.run | index($role))] + $r.carried + $r.skipped)'`)
    expect(post.indexOf('$r.carried + $r.skipped')).toBeLessThan(post.indexOf('(.roles | length) == 6'))
  })

  it('runs no reviewer when every approval holds, and then posts the carried verdicts', () => {
    expect(stepOf(team, 'The team reviews the pull request')).toMatch(/if: steps\.who\.outputs\.dependabot != 'true' && needs\.roster\.outputs\.run != ''/)
    expect(stepOf(team, 'Post the sign-offs and pass or fail')).toContain('if [ -z "$PANEL" ]; then')
  })

  it('builds main and starts a browser only for the designer, and runs coverage once, before main\'s rules', () => {
    expect(stepOf(team, "Browser and local database for the designer's screenshots")).toContain("contains(needs.roster.outputs.run, 'ux-designer')")
    expect(stepOf(team, "Main's build for the before screenshots (best effort)")).toContain("contains(needs.roster.outputs.run, 'ux-designer')")
    const once = stepOf(team, 'Lint and coverage once, for the whole panel')
    expect(once).toContain('cov=0; npm run test:coverage')
    expect(once).toContain('echo "npm run test:coverage exited with $cov"')
    expect(once).not.toContain('|| true\n')
    expect(team.indexOf('- name: Lint and coverage once, for the whole panel')).toBeLessThan(team.indexOf("- name: Review by main's rules"))
    expect(stepOf(team, "The panel's reports")).toContain('cp "$RUNNER_TEMP/panel/lint.txt" "$RUNNER_TEMP/panel/coverage.txt" .review/')
  })

  it('runs nothing from the pull request after main\'s rules are restored, up to the review', () => {
    const from = team.indexOf("- name: Review by main's rules")
    const to = team.indexOf('- name: The team reviews the pull request')
    const between = team.slice(team.indexOf('\n', from), to)
    expect(between).not.toMatch(/\b(npm|npx|node|yarn|pnpm) /)
    expect(between).not.toMatch(/\.\/node_modules|(bash|sh|tsx) +\.?\/?scripts\/|\.\/scripts\//)
  })

  it('coordinates on Sonnet', () => {
    expect(stepOf(team, 'The team reviews the pull request')).toContain("claude_args: '--model claude-sonnet-5-5 ")
  })

  it('fails, never skips, when the roster job did not decide (a skipped required check passes)', () => {
    expect(team).not.toContain("needs.roster.result == 'success' &&")
    const guard = stepOf(team, 'The roster job decided who reviews')
    expect(guard).toContain('[ "$ROSTER_RESULT" = success ] && [ -n "$ROSTER" ] || {')
    expect(guard).toContain('ROSTER_RESULT: ${{ needs.roster.result }}')
    expect(team.indexOf('- name: The roster job decided who reviews')).toBeLessThan(team.indexOf("- name: Dependabot's own dependency update?"))
  })

  it('merges the carried verdicts before it writes the marker the next round reads', () => {
    const post = stepOf(team, 'Post the sign-offs and pass or fail')
    expect(post.indexOf('$r.carried + $r.skipped')).toBeLessThan(post.indexOf('<!-- team-verdicts'))
    expect(post.indexOf('$r.carried + $r.skipped')).toBeGreaterThan(post.indexOf('The team review wrote no result.'))
  })

  it('reads the changed paths unquoted', () => {
    const roster = jobOf('roster')
    expect(roster).toContain('git -c core.quotePath=false diff --no-renames --name-only origin/main...HEAD')
    expect(roster).toContain('git -c core.quotePath=false diff --no-renames --name-only "$prev" HEAD')
    expect(roster).not.toMatch(/git (-c \S+ )?diff --name-only/)
  })

  it('runs the developer and the security engineer on Opus, the other four on Sonnet', () => {
    const model = (agent) => /^model: (\S+)$/m.exec(readFileSync(join(root, `.claude/agents/${agent}.md`), 'utf8').split(/^---$/m)[1] ?? '')?.[1]
    for (const agent of ['senior-developer', 'security-engineer']) expect(model(agent), agent).toBe('opus')
    for (const agent of ['product-manager', 'senior-recruiter', 'senior-tester', 'ux-designer']) expect(model(agent), agent).toBe('sonnet')
  })
})

describe('every shell step parses', () => {
  // A `run: |` block, as bash reads it: the lines indented deeper than its key, the indent taken off.
  const blocks = (text) => [...text.replace(/\r\n/g, '\n').matchAll(/^( *)(?:- )?run: \|\n((?:\1 {2,}.*\n|\n)+)/gm)].map((match) => {
    const lines = match[2].split('\n')
    const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length))
    return lines.map((line) => line.slice(indent)).join('\n')
  })
  it.each(['.github/workflows/review.yml', '.github/workflows/site-update.yml', '.github/workflows/building-notify.yml'])('%s', (path) => {
    const found = blocks(readFileSync(join(root, path), 'utf8'))
    expect(found.length).toBeGreaterThan(0)
    for (const script of found) expect(() => execFileSync('bash', ['-n'], { input: script, stdio: ['pipe', 'pipe', 'pipe'] }), script.slice(0, 120)).not.toThrow()
  }, 60_000)
})

