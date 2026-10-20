// @vitest-environment node
// How the Review and Site update workflows record what their Claude runs cost (specs/dev-costs.md
// AC-1 to AC-4, S-1 to S-3, S-14, S-15). The workflows are read as text, like team-manifest.test.mjs
// does; then the two inline scripts are taken out of the YAML and run with bash and jq: the step that
// reads the execution file (fixtures in functions/_lib/costs/fixtures/, in the format
// claude-code-action@v1 writes: a JSON array of the SDK's messages, system/init first and a `result`
// message per turn of the session) and the `costs` job's post, with curl replaced by a stub that
// records what it was given.
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseIngest } from '../functions/_lib/costs/ingest.ts'

const root = resolve(import.meta.dirname, '..')
const fixtures = join(root, 'functions/_lib/costs/fixtures')
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n')
const workflows = {
  review: { path: '.github/workflows/review.yml', claudeStep: 'The team reviews the pull request', id: 'team', job: 'team' },
  'site-update': { path: '.github/workflows/site-update.yml', claudeStep: 'Let Claude make the change', id: 'claude', job: 'update' },
}

// A job's block: from `  <key>:` to the next job (two-space key) or the end.
const jobBlock = (text, key) => {
  const lines = text.split('\n')
  const start = lines.indexOf(`  ${key}:`)
  if (start < 0) return null
  const end = lines.findIndex((line, index) => index > start && /^ {2}\S/.test(line))
  return lines.slice(start, end < 0 ? undefined : end).join('\n')
}
// A step's block: from its `- name:` line to the next step or the end of the job.
const stepBlock = (text, name) => {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trim() === `- name: ${name}`)
  if (start < 0) return null
  const indent = lines[start].indexOf('-')
  const end = lines.findIndex((line, index) => index > start && line.trim() && (line.indexOf('-') === indent && line.trim().startsWith('- ') || /^ {0,4}\S/.test(line) && line.search(/\S/) <= indent - 2))
  return lines.slice(start, end < 0 ? undefined : end).join('\n')
}
// The `run: |` script of a step block, unindented.
const runScript = (step) => {
  const lines = step.split('\n')
  const at = lines.findIndex((line) => /^\s+run: \|$/.test(line))
  const body = lines.slice(at + 1)
  const indent = body.find((line) => line.trim()).search(/\S/)
  const end = body.findIndex((line) => line.trim() && line.search(/\S/) < indent)
  return body.slice(0, end < 0 ? undefined : end).map((line) => line.slice(indent)).join('\n')
}
const onBlock = (text) => text.slice(text.indexOf('\non:'), text.indexOf('\n', text.indexOf('\n', text.indexOf('\non:') + 1) + 1) > 0 ? text.search(/\n(concurrency|permissions|run-name|jobs):/) : undefined)

const bashWorks = spawnSync('bash', ['-c', 'command -v jq >/dev/null']).status === 0
// On CI the scripts must run; off CI, without bash and jq, the text tests still do.
const runs = (name, test) => (bashWorks || process.env.CI ? it : it.skip)(name, test, 60_000)

describe.each(Object.entries(workflows))('the %s workflow', (workflow, meta) => {
  const text = read(meta.path)
  const job = jobBlock(text, meta.job)
  const costs = jobBlock(text, 'costs')

  it('gives the Claude step an id and reads its execution file in a step after it, also when it failed', () => {
    const claude = stepBlock(job, meta.claudeStep)
    expect(claude).toContain(`id: ${meta.id}`)
    const readStep = stepBlock(job, 'Read what the run cost')
    expect(job.indexOf('- name: Read what the run cost')).toBeGreaterThan(job.indexOf(`- name: ${meta.claudeStep}`))
    expect(readStep).toMatch(/\n\s+id: cost\n/)
    expect(readStep).toMatch(/\n\s+if: always\(\)/)
    expect(readStep).toContain(`EXECUTION_FILE: \${{ steps.${meta.id}.outputs.execution_file }}`)
    // Only the three numbers become job outputs (and, for Site update, its branch and pull request).
    const afterOutputs = job.slice(job.indexOf('    outputs:') + '    outputs:'.length)
    const outputs = afterOutputs.slice(0, afterOutputs.search(/\n {4}\S/))
    expect([...outputs.matchAll(/^ {6}(\w+):/gm)].map((match) => match[1])).toEqual(workflow === 'review' ? ['micro', 'turns', 'ms'] : ['micro', 'turns', 'ms', 'branch', 'pr'])
    if (workflow === 'site-update') {
      expect(outputs).toContain('branch: ${{ steps.branch.outputs.branch }}')
      // The branch step runs before Claude: nothing Claude runs can change its output.
      expect(job.indexOf('- name: Create the branch')).toBeLessThan(job.indexOf(`- name: ${meta.claudeStep}`))
    }
  })

  it('posts from its own job: after the Claude job, no permissions, no checkout, no action, no npm', () => {
    expect(costs).not.toBeNull()
    expect(costs).toContain(`    needs: ${meta.job}\n`)
    expect(costs).toContain(`    if: always() && needs.${meta.job}.result != 'skipped'\n`)
    expect(costs).toContain('    permissions: {}\n')
    expect(costs).toMatch(/\n {4}timeout-minutes: 5\n/)
    expect(costs).not.toMatch(/uses:|checkout|npm |npx |setup-node|upload-artifact|download-artifact/)
    for (const step of costs.split('\n      - name: ').slice(1)) expect(runScript(`      - name: ${step}`)).not.toContain('${{')
  })

  it('names COSTS_INGEST_TOKEN once, in the post step’s env, and passes neither Claude credential into it', () => {
    expect(text.match(/COSTS_INGEST_TOKEN: \$\{\{/g)).toHaveLength(1)
    expect(costs).toContain('          COSTS_INGEST_TOKEN: ${{ secrets.COSTS_INGEST_TOKEN }}')
    expect(costs).toContain("          HAS_API_KEY: ${{ secrets.ANTHROPIC_API_KEY != '' }}")
    expect(costs).toContain("          HAS_OAUTH: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN != '' }}")
    expect(costs).not.toMatch(/secrets\.(ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN) \}\}/)
    // The billing rule cites the Claude Code authentication docs.
    expect(costs).toContain('https://code.claude.com/docs/en/authentication')
    // The Claude step keeps both credentials, as today.
    const claude = stepBlock(job, meta.claudeStep)
    expect(claude).toContain('anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}')
    expect(claude).toContain('claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}')
  })

  it('takes the run id, attempt, workflow and job from its own github context and literals', () => {
    expect(costs).toContain('          RUN_ID: ${{ github.run_id }}')
    expect(costs).toContain('          RUN_ATTEMPT: ${{ github.run_attempt }}')
    expect(costs).toContain(`          WORKFLOW: ${workflow}\n`)
    expect(costs).toContain(`          JOB: ${meta.job}\n`)
    expect(costs).toContain(workflow === 'review' ? 'BRANCH: ${{ github.head_ref || github.ref_name }}' : 'BRANCH: ${{ needs.update.outputs.branch }}')
    expect(costs).toContain(workflow === 'review' ? 'PR: ${{ github.event.pull_request.number || inputs.pr }}' : 'PR: ${{ needs.update.outputs.pr }}')
  })

  it('adds no trigger', () => {
    let main = null
    try { main = execFileSync('git', ['show', `origin/main:${meta.path}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\r\n/g, '\n') } catch { /* no origin/main in this checkout */ }
    if (main) expect(onBlock(text)).toBe(onBlock(main))
    expect(text).not.toMatch(/pull_request_target|workflow_run/)
  })
})

describe('the two post scripts', () => {
  it('are the same script in both workflows', () => {
    const scripts = Object.values(workflows).map((meta) => runScript(stepBlock(jobBlock(read(meta.path), 'costs'), 'Record what the run cost')))
    expect(scripts[0]).toBe(scripts[1])
    const readers = Object.values(workflows).map((meta) => runScript(stepBlock(jobBlock(read(meta.path), meta.job), 'Read what the run cost')))
    expect(readers[0]).toBe(readers[1])
  })
})

describe('the scripts, run', () => {
  const review = read(workflows.review.path)
  const readScript = runScript(stepBlock(jobBlock(review, 'team'), 'Read what the run cost')).replaceAll('/usr/bin/jq', 'jq')
  let temp
  let stub
  beforeEach(() => {
    temp = mkdtempSync(join(tmpdir(), 'costs-wf-')).replace(/\\/g, '/')
    stub = `${temp}/curl`
    writeFileSync(stub, '#!/usr/bin/env bash\nprintf \'%s\\n\' "$@" > "$STUB_DIR/args"\ncat > "$STUB_DIR/stdin"\nfor a in "$@"; do case "$a" in @-) ;; @*) cp "${a#@}" "$STUB_DIR/header" ;; esac; done\nexit "${STUB_EXIT:-0}"\n')
    chmodSync(stub, 0o755)
  })
  afterEach(() => rmSync(temp, { recursive: true, force: true }))
  const bash = (script, env) => spawnSync('bash', ['-c', script], { env: { ...process.env, RUNNER_TEMP: temp, STUB_DIR: temp, ...env }, encoding: 'utf8' })

  const extract = (fixture) => {
    const output = `${temp}/output`
    writeFileSync(output, '')
    const result = bash(readScript, { EXECUTION_FILE: fixture === null ? '' : `${fixtures.replace(/\\/g, '/')}/${fixture}`, GITHUB_OUTPUT: output })
    return { status: result.status, out: result.stdout + result.stderr, written: readFileSync(output, 'utf8') }
  }

  runs('take the three numbers from the last result message, also when it is an error, and nothing else', () => {
    const result = extract('execution.json')
    expect(result.status).toBe(0)
    expect(result.written).toBe('micro=5645206\nturns=16\nms=418786\n')
    expect(result.out).not.toContain('SECRET-TRANSCRIPT-TEXT')
  })

  runs('warn once and write nothing for a missing, empty, unreadable or result-less file', () => {
    writeFileSync(`${temp}/empty.json`, '')
    for (const fixture of [null, 'missing.json', 'invalid.json', 'no-result.json']) {
      const result = extract(fixture)
      expect(result.status, String(fixture)).toBe(0)
      expect(result.written, String(fixture)).toBe('')
      expect(result.out.match(/::warning::/g), String(fixture)).toHaveLength(1)
    }
    expect(extract('no-result.json').out).toContain('::warning::The execution file has no result')
    const empty = bash(readScript, { EXECUTION_FILE: `${temp}/empty.json`, GITHUB_OUTPUT: `${temp}/output` })
    expect(empty.stdout).toMatch(/^::warning::No execution file/)
  })

  runs('round a cost with a long float tail to whole micro-dollars, so it is still recorded', () => {
    // Claude Code sums total_cost_usd as a float; jq keeps its 17-digit literal.
    expect(extract('long-tail.json').written).toBe('micro=300000\nturns=2\nms=1000\n')
    expect(extract('long-tail-2.json').written).toBe('micro=1234568\nturns=7\nms=2000\n')
  })

  runs('read the file the action leaves in RUNNER_TEMP when the step names none', () => {
    writeFileSync(`${temp}/claude-execution-output.json`, readFileSync(join(fixtures, 'execution.json')))
    expect(extract(null).written).toBe('micro=5645206\nturns=16\nms=418786\n')
  })

  runs('read the file the step names before the one in RUNNER_TEMP when both are there', () => {
    writeFileSync(`${temp}/claude-execution-output.json`, readFileSync(join(fixtures, 'long-tail.json')))
    expect(extract('execution.json').written).toBe('micro=5645206\nturns=16\nms=418786\n')
  })

  runs('take up to $1,000, the most /api/costs takes, and name the cause above it', () => {
    const own = (cost) => {
      const file = `${temp}/own.json`
      writeFileSync(file, JSON.stringify([{ type: 'result', total_cost_usd: cost, num_turns: 3, duration_ms: 999_999_999 }]))
      writeFileSync(`${temp}/output`, '')
      const result = bash(readScript, { EXECUTION_FILE: file, GITHUB_OUTPUT: `${temp}/output` })
      return { out: result.stdout + result.stderr, written: readFileSync(`${temp}/output`, 'utf8') }
    }
    expect(own(1000).written).toBe('micro=1000000000\nturns=3\nms=999999999\n')
    const over = own(1000.01)
    expect(over.written).toBe('turns=3\nms=999999999\n')
    expect(over.out.match(/::warning::/g)).toHaveLength(1)
    expect(over.out).toContain('::warning::The run cost more than $1,000, more than the costs page takes: it is not recorded.')
    expect(extract('huge.json').out).toContain('more than $1,000')
  })

  runs('refuse an injected or a huge value, keeping the plain ones', () => {
    const injected = extract('injected.json')
    expect(injected.written).toBe('ms=100\n')
    expect(injected.out.match(/::warning::/g)).toHaveLength(2)
    expect(existsSync(join(root, 'pwned'))).toBe(false)
    expect(extract('huge.json').written).toBe('ms=5\n')
  })

  const post = (env, script = runScript(stepBlock(jobBlock(review, 'costs'), 'Record what the run cost'))) => {
    for (const file of ['stdin', 'args', 'header']) rmSync(`${temp}/${file}`, { force: true })
    const result = bash(script.replaceAll('/usr/bin/jq', 'jq').replaceAll('/usr/bin/curl', stub), {
      COSTS_INGEST_TOKEN: 's'.repeat(40), HAS_API_KEY: 'true', HAS_OAUTH: 'true', MICRO: '5645206', TURNS: '16', DURATION: '418786',
      WORKFLOW: 'review', JOB: 'team', RUN_ID: '39349674556', RUN_ATTEMPT: '1', BRANCH: 'dev-costs', PR: '61', ...env,
    })
    const called = existsSync(`${temp}/stdin`)
    return { status: result.status, out: result.stdout + result.stderr, called, body: called ? JSON.parse(readFileSync(`${temp}/stdin`, 'utf8')) : null, args: called ? readFileSync(`${temp}/args`, 'utf8') : '', header: existsSync(`${temp}/header`) ? readFileSync(`${temp}/header`, 'utf8') : '' }
  }

  runs('post exactly the GitHub body to steven.wilssens.com with the token in a header file', () => {
    const result = post({})
    expect(result.status).toBe(0)
    expect(Object.keys(result.body)).toEqual(['v', 'source', 'workflow', 'job', 'runId', 'runAttempt', 'branch', 'billing', 'costMicro', 'numTurns', 'durationMs', 'endedAt', 'pr'])
    expect(result.body).toMatchObject({ v: 1, source: 'github', workflow: 'review', job: 'team', runId: 39349674556, runAttempt: 1, branch: 'dev-costs', billing: 'billed', costMicro: 5_645_206, numTurns: 16, durationMs: 418786, pr: 61 })
    expect(Math.abs(result.body.endedAt - Date.now())).toBeLessThan(60_000)
    // The contract with /api/costs: the server’s parser takes the body as the workflow builds it.
    expect(parseIngest(JSON.stringify(result.body))).toMatchObject({ source: 'github', workflow: 'review', job: 'team', costMicro: 5_645_206, pr: 61 })
    expect(parseIngest(JSON.stringify(post({ WORKFLOW: 'site-update', JOB: 'update', BRANCH: 'update/add-x-12', PR: '' }).body))).toMatchObject({ workflow: 'site-update', pr: null })
    expect(result.args).toContain('https://steven.wilssens.com/api/costs')
    expect(result.args).toContain('--fail\n--silent\n--show-error\n--max-time\n10\n')
    expect(result.args).not.toContain('s'.repeat(40))
    expect(result.header).toBe(`Authorization: Bearer ${'s'.repeat(40)}\n`)
    // The header file does not outlive the step.
    expect(existsSync(`${temp}/costs-header`)).toBe(false)
    expect(result.out).not.toContain('s'.repeat(40))
  })

  runs('mark the run billed with the API key, estimated with only the OAuth token, unknown with neither', () => {
    expect(post({ HAS_API_KEY: 'true', HAS_OAUTH: 'false' }).body.billing).toBe('billed')
    expect(post({ HAS_API_KEY: 'false', HAS_OAUTH: 'true' }).body.billing).toBe('estimated')
    expect(post({ HAS_API_KEY: 'false', HAS_OAUTH: 'false' }).body.billing).toBe('unknown')
  })

  runs('leave out the pull request when there is none, and refuse one that is not a number', () => {
    expect('pr' in post({ PR: '' }).body).toBe(false)
    const bad = post({ PR: '61; rm -rf /' })
    expect([bad.status, bad.called]).toEqual([0, false])
    expect(bad.out).toContain('::warning::')
  })

  runs('refuse a Site update branch outside update/ and any branch the costs page would refuse', () => {
    expect(post({ WORKFLOW: 'site-update', JOB: 'update', BRANCH: 'update/add-x-12', PR: '' }).body).toMatchObject({ workflow: 'site-update', job: 'update', branch: 'update/add-x-12' })
    for (const env of [{ WORKFLOW: 'site-update', JOB: 'update', BRANCH: 'main' }, { BRANCH: 'a..b' }, { BRANCH: '-x' }, { BRANCH: 'x.lock' }, { BRANCH: 'a b' }, { BRANCH: '"><img>' }, { BRANCH: '' }]) {
      const result = post(env)
      expect([result.status, result.called], JSON.stringify(env)).toEqual([0, false])
      expect(result.out.match(/::warning::/g)).toHaveLength(1)
    }
  })

  runs('warn once and make no call without numbers, a run id, or the secret', () => {
    for (const env of [{ MICRO: '' }, { MICRO: '5.6452057' }, { MICRO: '0123' }, { MICRO: '12345678901' }, { MICRO: '1000000001' }, { TURNS: '1.5' }, { TURNS: '0123' }, { DURATION: '1234567890' }, { DURATION: '' }, { MICRO: '1; curl evil' }, { RUN_ID: 'x' }, { RUN_ATTEMPT: '0' }, { COSTS_INGEST_TOKEN: '' }]) {
      const result = post(env)
      expect([result.status, result.called], JSON.stringify(env)).toEqual([0, false])
      expect(result.out.match(/::warning::/g)).toHaveLength(1)
    }
  })

  runs('post the most /api/costs takes: $1,000 and 9-digit turns and milliseconds', () => {
    const result = post({ MICRO: '1000000000', TURNS: '0', DURATION: '999999999' })
    expect(result.called).toBe(true)
    expect(result.body).toMatchObject({ costMicro: 1_000_000_000, numTurns: 0, durationMs: 999_999_999 })
  })

  runs('warn and still pass when the post fails, and never print the secret', () => {
    const result = post({ STUB_EXIT: '22' })
    expect(result.status).toBe(0)
    expect(result.out).toContain('::warning::This run\'s cost is not recorded: the post to /api/costs failed.')
    expect(result.out).not.toContain('s'.repeat(40))
    expect(existsSync(`${temp}/costs-header`)).toBe(false)
  })
})

describe('the team’s flow says the runs are metered', () => {
  it('names /admin#costs under "The flow", without "every", and draws the meter with dotted links only', () => {
    const team = read('.claude/team.md')
    const flow = team.slice(team.indexOf('## The flow'), team.indexOf('## The verdict block'))
    const sentence = flow.split('\n').find((line) => line.includes('/admin#costs'))
    expect(sentence).toBeDefined()
    expect(sentence).not.toMatch(/\bevery\b|\ball\b/i)
    const chart = flow.slice(flow.indexOf('```mermaid'), flow.indexOf('```', flow.indexOf('```mermaid') + 3))
    expect(chart).toContain('meter[/Runs metered: admin, Costs/]')
    const links = chart.split('\n').filter((line) => /\bmeter\b/.test(line) && !line.includes('meter['))
    expect(links.map((line) => line.trim()).sort()).toEqual(['build -.- meter', 'fix -.- meter', 'reviews -.- meter'])
    expect(chart).not.toMatch(/%% step \d+: meter|class [^\n]*\bmeter\b/)
  })
})
