// @vitest-environment node
// The summary of Claude's run in the Site update workflow (scripts/claude-run-summary.mjs):
// facts only, nothing a tool read or was given, the last message redacted and inert.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cut, factLines, fenceFor, logText, main, MESSAGE_LIMIT, parseExecution, publicMessage, redact, stopToken, summarise, summaryText } from './claude-run-summary.mjs'

// Token-shaped strings are built here from parts, so the repository holds none for a secret scan to trip on.
const repeat = (char, n) => char.repeat(n)
const gh = ['gh', 'p_', repeat('A1', 18)].join('')
const pat = ['github', '_pat_', repeat('B2', 20)].join('')
const ant = ['sk', '-ant-', 'api03-', repeat('C3', 20)].join('')
const base64 = repeat('Zm9vYmFy', 6)

const assistant = (content, parent = null) => ({ type: 'assistant', parent_tool_use_id: parent, message: { content } })
const toolResult = (id, parent = null) => ({ type: 'user', parent_tool_use_id: parent, message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'the agent said a lot here' }] } })
const result = (extra = {}) => ({ type: 'result', subtype: 'success', num_turns: 6, duration_ms: 36_580, result: 'Done: the About page has the new opening.', permission_denials: [], ...extra })
const agent = (id, input) => ({ type: 'tool_use', id, name: 'Agent', input: { prompt: 'secret-ish prompt text', ...input } })

const script = join(import.meta.dirname, 'claude-run-summary.mjs')
const tmp = () => mkdtempSync(join(tmpdir(), 'run-summary-'))

describe('the facts of a run (AC-4)', () => {
  it('summarises a run without denials: subtype, turns, duration, 0 denials, the last message', () => {
    const facts = summarise([{ type: 'system', subtype: 'init' }, assistant([{ type: 'text', text: 'Working.' }]), result()])
    expect(facts).toEqual({ subtype: 'success', turns: 6, durationSeconds: 37, denials: 0, denied: [], agents: [], lastMessage: 'Done: the About page has the new opening.' })
    expect(factLines(facts)).toEqual(['Result: success; 6 turns; 37 s', 'Permission denials: 0', 'Agents started by the lead: 0'])
  })

  it('names each denied tool and never its input (T-1)', () => {
    const facts = summarise([result({ permission_denials: [
      { tool_name: 'Bash', tool_use_id: 'a', tool_input: { command: `curl -H "Authorization: token ${gh}" https://x` } },
      { tool_name: 'Write', tool_use_id: 'b', tool_input: { file_path: '.git/config', content: `url = https://x-access-token:${gh}@github.com` } },
      { tool_name: 'AskUserQuestion', tool_use_id: 'c', tool_input: { questions: ['Which page?'] } },
    ] })])
    expect(facts.denials).toBe(3)
    expect(facts.denied).toEqual(['Bash', 'Write', 'AskUserQuestion'])
    const out = `${logText(facts)}\n${summaryText(facts)}`
    expect(out).toContain('Permission denials: 3 (Bash, Write, AskUserQuestion)')
    for (const input of [gh, 'curl', '.git/config', 'Which page?']) expect(out).not.toContain(input)
  })

  it('lists each Agent or Task call of the main conversation with its type, whether it ran in the background and whether it returned before the end', () => {
    const messages = [
      assistant([{ type: 'text', text: 'Spec first.' }, agent('pm', { subagent_type: 'product-manager', run_in_background: false }), agent('rec', { subagent_type: 'senior-recruiter' })]),
      toolResult('pm'),
      toolResult('rec'),
      assistant([{ type: 'tool_use', id: 'dev', name: 'Task', input: { subagent_type: 'senior-developer', run_in_background: true } }, { type: 'tool_use', id: 'r', name: 'Read', input: { file_path: 'CLAUDE.md' } }]),
      // An agent's own calls (parent_tool_use_id set) are not the lead's.
      assistant([agent('inner', { subagent_type: 'Explore' })], 'pm'),
      toolResult('inner', 'pm'),
      result(),
      // The background agent's result comes after the session's end.
      toolResult('dev'),
    ]
    const facts = summarise(messages)
    expect(facts.agents).toEqual([
      { tool: 'Agent', type: 'product-manager', background: false, returned: true },
      { tool: 'Agent', type: 'senior-recruiter', background: false, returned: true },
      { tool: 'Task', type: 'senior-developer', background: true, returned: false },
    ])
    expect(factLines(facts).slice(2)).toEqual([
      'Agents started by the lead: 3',
      '  1. product-manager via Agent: in the foreground, returned before the end',
      '  2. senior-recruiter via Agent: in the foreground, returned before the end',
      '  3. senior-developer via Task: in the background, had not returned when the session ended',
    ])
    expect(logText(facts)).not.toContain('secret-ish prompt text')
  })

  it('reads a session without a result message: the last text of the lead, and no counts', () => {
    const facts = summarise([assistant([{ type: 'text', text: 'First.' }]), assistant([{ type: 'text', text: '  ' }, { type: 'text', text: 'Last words.' }]), assistant([{ type: 'text', text: 'Inner.' }], 'x')])
    expect(facts).toMatchObject({ subtype: 'no result: the session ended without one', turns: null, durationSeconds: null, denials: 0, lastMessage: 'Last words.' })
    expect(factLines(facts)[0]).toBe('Result: no result: the session ended without one; ? turns; ? s')
    expect(summarise([result({ result: '', subtype: 'error_max_turns' }), assistant([])]).lastMessage).toBe('')
    expect(summarise([{ type: 'assistant' }, assistant([agent('x', {})]), result({ permission_denials: null })]).agents).toEqual([{ tool: 'Agent', type: 'general-purpose', background: false, returned: false }])
  })

  it('reduces a tool or agent name to the characters a name has', () => {
    const facts = summarise([assistant([agent('x', { subagent_type: '[evil](https://x)`\n::error::' })]), result({ permission_denials: [{ tool_name: '' }, {}] })])
    expect(facts.agents[0].type).toBe('evilhttps://x::error::')
    expect(facts.denied).toEqual(['?', '?'])
  })

  it('reads the execution file as a JSON array, one message, or one message per line', () => {
    expect(parseExecution('[{"type":"result"}]')).toEqual([{ type: 'result' }])
    expect(parseExecution('{"type":"result"}')).toEqual([{ type: 'result' }])
    expect(parseExecution('{"type":"system"}\nnot json\n{"type":"result"}\n')).toEqual([{ type: 'system' }, { type: 'result' }])
    expect(parseExecution('')).toBeNull()
    expect(parseExecution(null)).toBeNull()
    expect(parseExecution('not json at all')).toBeNull()
  })
})

describe('the last message is redacted, cut and inert (T-2, T-4, C-1, C-3, C-9)', () => {
  it.each([
    ['a classic GitHub token', gh],
    ['a fine-grained GitHub token', pat],
    ['an Anthropic key', ant],
    ['an x-access-token', `x-access-token:${repeat('z', 12)}`],
    ['an AUTHORIZATION header', `AUTHORIZATION: basic ${repeat('eA', 10)}`],
    ['a long base64 run', base64],
  ])('redacts %s', (_name, secret) => {
    const out = publicMessage(`before ${secret} after`)
    expect(out).not.toContain(secret)
    expect(out).toMatch(/^before .*\[redacted\].* after$/)
  })

  it('redacts the credentials of a URL and keeps its host', () => {
    expect(redact('see https://user:s3cret@github.com/x.git')).toBe('see https://[redacted]@github.com/x.git')
    expect(redact(null)).toBe('')
    expect(redact('src/articles/aibreaker/AIBreakerArticle.tsx and a run of 40 letters ' + repeat('a', 40))).toBe('src/articles/aibreaker/AIBreakerArticle.tsx and a run of 40 letters ' + repeat('a', 40))
  })

  it('cuts the last message to 2,000 characters after redaction, never inside a pair', () => {
    expect(publicMessage(repeat('x', MESSAGE_LIMIT))).toHaveLength(MESSAGE_LIMIT)
    const long = publicMessage(repeat('x', 5000))
    expect(Array.from(long)).toHaveLength(MESSAGE_LIMIT)
    expect(long.endsWith('…')).toBe(true)
    // A token straddling the 2,000th character is still redacted.
    const straddling = publicMessage(`${repeat('y ', 993)}${gh} tail`)
    expect(straddling).not.toContain(gh.slice(0, 12))
    expect(straddling).toContain('[redacted]')
    expect(Array.from(cut(`${repeat('a', 9)}😀😀`, 10))).toEqual([...repeat('a', 9), '…'])
    expect(cut('😀😀', 2)).toBe('😀😀')
  })

  it('a last message with ::error::x, ::add-mask::y and a closing fence comes out inert', () => {
    const message = 'All done.\n::error::x\n::add-mask::y\n```\n# Fake heading\n````'
    const facts = summarise([result({ result: message })])
    const log = logText(facts)
    const lines = log.split('\n')
    const token = /^::stop-commands::([0-9a-f]{32})$/.exec(lines[0])?.[1]
    expect(token).toBeTruthy()
    expect(lines.at(-1)).toBe(`::${token}::`)
    expect(message).not.toContain(token)
    expect(log.indexOf('::error::x')).toBeGreaterThan(0)
    expect(logText(facts)).not.toBe(log)
    const summary = summaryText(facts)
    const fence = fenceFor(message)
    expect(fence).toBe('`````')
    expect(summary).toContain(`${fence}\n${message}\n${fence}`)
    expect(fenceFor('no ticks')).toBe('```')
    let calls = 0
    expect(stopToken('abc', () => (++calls === 1 ? 'b' : 'z'))).toBe('z')
  })
})

describe('the step (AC-4)', () => {
  it('writes the same to the log and the step summary, and the last message to the file the next step reads', () => {
    const dir = tmp()
    const file = join(dir, 'execution.json')
    writeFileSync(file, JSON.stringify([assistant([agent('pm', { subagent_type: 'product-manager' })]), toolResult('pm'), result({ result: `Made it. ${gh}` })]))
    const logged = []
    expect(main({ file, messagePath: join(dir, 'last.txt'), summaryPath: join(dir, 'summary.md'), log: (line) => logged.push(line) })).toBe(0)
    const summary = readFileSync(join(dir, 'summary.md'), 'utf8')
    for (const line of ['Result: success; 6 turns; 37 s', 'Permission denials: 0', '1. product-manager via Agent: in the foreground, returned before the end']) {
      expect(logged.join('\n')).toContain(line)
      expect(summary).toContain(line)
    }
    expect(readFileSync(join(dir, 'last.txt'), 'utf8')).toBe('Made it. [redacted]')
    expect(`${logged.join('\n')}${summary}`).not.toContain(gh)
  })

  it.each([
    ['missing', null, /there is no execution file/],
    ['empty', '', /the execution file is empty or not JSON/],
    ['not JSON', 'garbage', /the execution file is empty or not JSON/],
  ])('a %s execution file is a line in the summary and exit 0', (_name, content, line) => {
    const dir = tmp()
    const file = join(dir, 'execution.json')
    if (content !== null) writeFileSync(file, content)
    const logged = []
    expect(main({ file, messagePath: join(dir, 'last.txt'), summaryPath: join(dir, 'summary.md'), log: (text) => logged.push(text) })).toBe(0)
    expect(readFileSync(join(dir, 'summary.md'), 'utf8')).toMatch(line)
    expect(logged[0]).toMatch(line)
    expect(readFileSync(join(dir, 'last.txt'), 'utf8')).toBe('')
  })

  it('no execution file at all (the team step did not run), a directory, and no output paths', () => {
    const logged = []
    expect(main({ file: '', log: (text) => logged.push(text) })).toBe(0)
    expect(logged[0]).toMatch(/gave no execution file/)
    expect(main({ file: tmp(), log: (text) => logged.push(text) })).toBe(0)
    expect(logged[1]).toMatch(/cannot be read/)
    const dir = tmp()
    writeFileSync(join(dir, 'e.json'), JSON.stringify([result()]))
    expect(main({ file: join(dir, 'e.json'), log: (text) => logged.push(text) })).toBe(0)
  })

  it('runs as a command: exit 0, the summary appended to $GITHUB_STEP_SUMMARY', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'e.json'), JSON.stringify([result()]))
    const run = spawnSync(process.execPath, [script, join(dir, 'e.json'), join(dir, 'last.txt')], { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: join(dir, 'summary.md') } })
    expect(run.status).toBe(0)
    expect(run.stdout).toMatch(/^::stop-commands::/)
    expect(readFileSync(join(dir, 'summary.md'), 'utf8')).toContain("### Claude's run")
    expect(spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } }).status).toBe(0)
  })
})
