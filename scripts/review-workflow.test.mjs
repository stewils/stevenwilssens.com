// @vitest-environment node
// The Review workflow (.github/workflows/review.yml) as text: what starts it, who counts as
// Steven, which bot may start the team review, the assistant check's two jobs and what the
// reviewers are told about the preview (specs/mcp-prs-flow.md, AC-1, AC-5, AC-9, AC-10).
// The YAML is not measured by coverage; these turn red when it drifts.
import { readFileSync } from 'node:fs'
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
    ['src/articles/site/SiteArticle.tsx', true], ['src/articles/aibreaker/feed.json', true],
    ['src/ask/AskAssistant.tsx', false], ['src/resume.test.ts', false], ['functions/_lib/github.ts', false], ['README.md', false],
  ])('a change to %s runs it: %s', (path, runs) => {
    expect(pattern.test(path)).toBe(runs)
  })

  it("runs only for this repository's pull requests (a fork gets no key)", () => {
    expect(scope).toContain("SAME_REPO: ${{ github.event_name == 'workflow_dispatch' || github.event.pull_request.head.repo.full_name == github.repository }}")
    expect(scope).toContain('if [ "$SAME_REPO" = true ] && git diff --name-only origin/main...HEAD')
  })

  it('job A has no secret and no token, and builds both inputs with the export from the build', () => {
    expect(input).toMatch(/^ {4}permissions: \{\}$/m)
    expect(input).not.toMatch(/secrets\./)
    expect(input).toContain('persist-credentials: false')
    expect(stepOf(input, "The branch's input")).toContain('node "$RUNNER_TEMP/export-branch/assistant-export.js" dist https://steven.wilssens.com/api/notes "$RUNNER_TEMP/assistant-input/branch.json"')
    expect(stepOf(input, "main's input")).toContain('git worktree add --detach "$main" origin/main')
    expect(stepOf(input, "main's input")).toContain('"$RUNNER_TEMP/assistant-input/main.json"')
  })

  it('job B holds the key, checks out main only, runs main\'s harness, and has no Cloudflare token or database', () => {
    expect(check).toMatch(/^ {4}needs: assistant-input\n {4}if: needs\.assistant-input\.outputs\.run == 'true'$/m)
    expect(check).toMatch(/- uses: actions\/checkout@v\d+\n {8}with:\n {10}ref: main\n {10}persist-credentials: false\n/)
    expect(check.match(/uses: actions\/checkout/g)).toHaveLength(1)
    expect(check).toMatch(/^ {4}timeout-minutes: \d+$/m)
    expect(check).toContain('ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}')
    expect(check).not.toMatch(/CLOUDFLARE|wrangler|\bnpm\b|d1 /i)
    expect(stepOf(check, 'Ask the assistant on the branch and on main')).toContain('node scripts/assistant-check.mjs --branch "$RUNNER_TEMP/assistant-input/branch.json" --main "$RUNNER_TEMP/assistant-input/main.json" --out "$out"')
  })

  it('the key is in job B and in the existing team step only', () => {
    const uses = [...workflow.matchAll(/secrets\.ANTHROPIC_API_KEY/g)].map((match) => match.index)
    expect(uses).toHaveLength(2)
    const inCheck = workflow.indexOf(check)
    const inPrompt = workflow.indexOf(prompt)
    expect(uses.every((at) => (at > inCheck && at < inCheck + check.length) || (at > inPrompt && at < inPrompt + prompt.length))).toBe(true)
  })

  it('team still runs when the assistant check failed or was skipped, and then reads "did not run"', () => {
    expect(team).toMatch(/^ {4}needs: \[gates, assistant-input, assistant\]\n(?: {4}#.*\n)* {4}if: \$\{\{ !cancelled\(\) && needs\.gates\.result == 'success' \}\}$/m)
    const notRun = stepOf(team, 'Say when the assistant check did not run')
    expect(notRun).toContain('Result: did not run (its input job ended with')
    expect(notRun).toContain('Result: did not run (the check job ended with')
    expect(team.indexOf("- name: A clean folder for the reports, and Steven's replies on the pull request")).toBeLessThan(team.indexOf("- name: The assistant check's answers"))
  })
})

describe('what the reviewers are told (AC-10, AC-8)', () => {
  it('the preview has no assistant, no Turnstile and no MCP, and nobody asks Steven for those checks', () => {
    expect(prompt).toContain('has no assistant, no Turnstile and no MCP')
    expect(prompt).toContain('No reviewer asks Steven for a check the preview cannot run.')
    expect(prompt).toContain('"Result: did not run" is never a pass, and')
    expect(prompt).toContain('never a question for Steven: the recruiter\'s verdict is then CHANGES_REQUESTED (re-run the job).')
  })

  it('the sign-off comment carries the team-verdicts marker of the reviewed commit', () => {
    const post = stepOf(team, 'Post the sign-offs and pass or fail')
    expect(post).toContain('HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}')
    expect(post).toContain("printf '\\n<!-- team-verdicts %s -->\\n' \"$verdicts\" >> \"$RUNNER_TEMP/comment.md\"")
    expect(post).toMatch(/jq -c --arg sha "\$HEAD_SHA" '\{sha: \$sha, roles: /)
  })
})

describe("the recruiter's rule for the assistant check (AC-9)", () => {
  const recruiter = readFileSync(join(root, '.claude/agents/senior-recruiter.md'), 'utf8').replace(/\r\n/g, '\n').replace(/\s+/g, ' ')

  it('a check that did not run is CHANGES_REQUESTED, never NEEDS_STEVEN or APPROVE, and the CI answers replace the preview', () => {
    expect(recruiter).toContain('those answers replace the preview as your evidence')
    expect(recruiter).toContain('"Result: did not run" is never a pass and never a question for Steven: your verdict is then `CHANGES_REQUESTED` (re-run the job), never `APPROVE` and never `NEEDS_STEVEN`.')
    expect(recruiter).toContain('.review/assistant/assistant-check.md')
    expect(recruiter).not.toMatch(/return `NEEDS_STEVEN` asking him to put the three questions to the preview/)
  })
})
