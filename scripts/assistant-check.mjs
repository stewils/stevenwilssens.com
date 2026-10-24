// The assistant check (specs/mcp-prs-flow.md, AC-9): job B of the Review workflow. main's
// harness with main's questions, holding the model key, over the assistant's input that job A
// built from the pull request's code and from main's (functions/_lib/assistant-input.ts). The
// input is data: its size, model name and texts are checked before anything is sent, and it
// never runs. Both sides are asked the way the live assistant asks (thinking, effort, the
// answer budget, the cached system block). The model is the one main's own code names
// (functions/_lib/ask/agent.ts in this job's checkout of main, never a field of either input), and
// both system prompts are capped at an absolute size, so neither input can choose a costlier
// model or call; the request settings come from main's input within the harness's own bounds. The answers are shown the way the site
// shows them (the sources its hidden first line names; the fixed text for an out-of-scope
// answer). Five fixed questions on each input, at most 10 model calls, the whole run under a
// time limit. The first three answers on the branch are held to the branch's own `profile`
// (location and work authorization, team size, availability); a mismatch fails. All ten
// transcripts go to the recruiter, fenced and labelled untrusted.
//
//   ANTHROPIC_API_KEY=… node scripts/assistant-check.mjs --branch branch.json --main main.json --out assistant-check.md
//
// Exit 0: passed. Exit 1: failed (an answer does not match) or did not run (no key, an input
// that is not one, a model error, the time limit). "Did not run" is never a pass.
import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

export const SCHEMA = 'assistant-input/1'
export const MAX_INPUT_BYTES = 2_000_000
// The largest system prompt either side may send (the live one is about 140,000 characters).
export const MAX_SYSTEM = 300_000
// Where main's code names the model the live assistant uses, in this job's checkout of main.
export const AGENT = 'functions/_lib/ask/agent.ts'
export const MAX_CALLS = 10
export const MAX_TOKENS = 4000
export const TIME_LIMIT_MS = 6 * 60_000
export const MODEL = /^claude-[a-z0-9.-]+$/
const API = 'https://api.anthropic.com/v1/messages'
const EFFORTS = ['low', 'medium', 'high']
// The hidden first line of an answer: [[in: site:about, role:x]] or [[out]] (functions/_lib/ask/agent.ts, HEADER).
const HEADER = /^\s*\[\[\s*(in|out)\s*(?::\s*([^\]]*))?\]\]\s*/

// The job description has one requirement Steven's record does not show (a security clearance).
export const JOB_DESCRIPTION = `Principal Product Manager, Data Platform and AI (Seattle, hybrid).
You will own the strategy and roadmap for our internal data platform and the AI features built on it: experimentation, metrics, natural-language analytics.
Requirements:
- 10+ years of product management, including leading teams of product managers
- Experience shipping data platforms or analytics products used by engineering organizations
- Experience bringing AI or machine learning features to production
- An active US government security clearance (TS/SCI)`

export const QUESTIONS = [
  { id: 'location', text: 'Where is Steven based and is he authorized to work there?' },
  { id: 'team', text: 'How large a team has he led?' },
  { id: 'availability', text: 'When is he available?' },
  { id: 'fit', text: JOB_DESCRIPTION, fit: true },
  { id: 'unknown', text: 'What salary is he looking for?' },
]

class DidNotRun extends Error {}

// ---- the input, as data ------------------------------------------------------------------

const isText = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max
const isCount = (value, max) => Number.isInteger(value) && value > 0 && value <= max

/**
 * Reads and checks one input file; throws DidNotRun with the reason when it is not one. With a digest (the sha256
 * the job that built it gave as its output, specs/mcp-prs-automation.md AC-14), the file must be that one exactly:
 * the branch's job could upload a file under main's name, and only its job's output says which one is main's.
 */
export const readInput = (path, label, digest = null) => {
  let size
  try { size = statSync(path).size } catch { throw new DidNotRun(`the ${label} input is missing (${path}).`) }
  if (size > MAX_INPUT_BYTES) throw new DidNotRun(`the ${label} input is ${size} bytes, over the ${MAX_INPUT_BYTES} the check reads.`)
  const bytes = readFileSync(path)
  if (digest !== null && createHash('sha256').update(bytes).digest('hex') !== String(digest).trim().toLowerCase()) throw new DidNotRun(`the ${label} input is not the one its job built (its sha256 differs from the job's output).`)
  let input
  try { input = JSON.parse(bytes.toString('utf8')) } catch { throw new DidNotRun(`the ${label} input is not JSON.`) }
  if (!input || input.schema !== SCHEMA) throw new DidNotRun(`the ${label} input is not an assistant input (${SCHEMA}).`)
  if (typeof input.model !== 'string' || !MODEL.test(input.model)) throw new DidNotRun(`the ${label} input names a model that is not a Claude model id.`)
  if (!isText(input.system, MAX_SYSTEM)) throw new DidNotRun(`the ${label} input's system prompt is missing or over ${MAX_SYSTEM} characters.`)
  if (!isText(input.contexts?.question, 2000) || !isText(input.contexts?.fit, 2000) || !isText(input.jdPrefix, 500)) throw new DidNotRun(`the ${label} input's contexts are missing.`)
  const profile = input.profile ?? {}
  for (const key of ['location', 'workAuthorization', 'availability', 'teamSize']) if (!isText(profile[key], 300)) throw new DidNotRun(`the ${label} input has no profile.${key}.`)
  const request = input.request ?? {}
  if (!isCount(request.maxTokens?.question, MAX_TOKENS) || !isCount(request.maxTokens?.fit, MAX_TOKENS)) throw new DidNotRun(`the ${label} input's answer budget is missing or over ${MAX_TOKENS} tokens.`)
  const render = input.render ?? {}
  if (!render.sources || typeof render.sources !== 'object' || !isCount(render.maxSources?.question, 20) || !isCount(render.maxSources?.fit, 20) || !isText(render.offTopic, 1000) || !isText(render.notAPosting, 1000)) throw new DidNotRun(`the ${label} input does not say how an answer is shown.`)
  return input
}

// The request settings both sides are asked with: main's, within the harness's own bounds.
export const requestOf = (main, model) => ({
  model,
  maxTokens: main.request.maxTokens,
  thinking: main.request.thinking?.type === 'adaptive' ? { type: 'adaptive' } : undefined,
  effort: EFFORTS.includes(main.request.output_config?.effort) ? main.request.output_config.effort : undefined,
  betas: (Array.isArray(main.request.betas) ? main.request.betas : []).filter((beta) => typeof beta === 'string' && /^[a-z0-9-]{1,80}$/.test(beta)).slice(0, 4),
  fallbacks: main.request.fallbacks === 'default' ? 'default' : undefined,
})

// ---- the mechanical checks ----------------------------------------------------------------

const STOP = new Set(['the', 'and', 'for', 'with', 'his', 'her', 'from', 'that', 'this', 'are', 'was'])
const words = (text) => (String(text).toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length >= 3 && !STOP.has(word))
const lower = (text) => String(text).toLowerCase()

/** Every one of the fact's own words appears in the answer: "Available now" needs "available" and "now". */
export const carries = (answer, fact) => {
  const wanted = [...new Set(words(fact))]
  const said = new Set(words(answer))
  return wanted.length > 0 && wanted.every((word) => said.has(word))
}

// A number of people: "20 product managers", "a team of 25 PMs", "15+ engineers".
const PEOPLE = /(\d{1,4})\s*(?:\+|plus)?\s*(?:(?:[a-z-]+)\s+){0,2}(?:people|pms?\b|product managers|managers|reports|engineers|developers|scientists|members|employees|staff|direct reports)/gi
// The people he worked with are not his team: "working with more than 100 developers",
// "alongside 40 engineers", "also with about 20 developers". Fail-safe: a number is left out
// only when a collaboration phrase is in its clause and nothing in that clause, the count itself
// or the rest of the sentence claims ownership ("led and worked with 100 developers", "working
// with 100 engineers, all reporting to him", "an organization with 100 engineers"). When in
// doubt, the number counts.
const WITH = /\b(?:(?:working|worked|works|work|collaborating|collaborated|partnering|partnered)\s+(?:[a-z]+ly\s+)?with|also\s+with|alongside)\b/i
const OWNS = /\b(?:report(?:s|ed|ing)?|direct reports|manag(?:e|es|ed|ing)|supervis(?:e|es|ed|ing)|direct(?:s|ed|ing)|under him|(?:on )?his team|lead(?:s|ing)?|led|overs(?:aw|ee|ees|eeing)|head(?:s|ed|ing)?|head of|ran|run(?:s|ning)?|recruit(?:s|ed|ing)?|hir(?:e|es|ed|ing)|own(?:s|ed|ing)?|gr(?:ew|ow|ows|owing)|teams? of|(?:organi[sz]ations?|orgs?|teams?|groups?) with)\b/i
const workedWith = (match) => {
  const clause = match.input.slice(0, match.index).split(/[.,;:!?()\n]/).pop()
  const rest = match.input.slice(match.index + match[0].length).split(/[.!?\n]/)[0]
  return WITH.test(clause) && ![clause, match[0], rest].some((text) => OWNS.test(text))
}
/** The numbers of people an answer says he led or managed; counts of people he worked with are left out. */
export const peopleCounts = (text) => [...String(text).matchAll(PEOPLE)].filter((match) => !workedWith(match)).map((match) => Number(match[1]))

/** Whether one of the first three answers matches the profile, and why not. */
export const checkAnswer = (id, answer, profile) => {
  if (id === 'location') {
    const city = profile.location.split(',')[0].trim()
    if (!lower(answer).includes(lower(city))) return { ok: false, why: `does not name ${city} (profile.location: "${profile.location}")` }
    if (!carries(answer, profile.workAuthorization)) return { ok: false, why: `does not say his work authorization (profile.workAuthorization: "${profile.workAuthorization}")` }
    return { ok: true, why: `names ${city} and the work authorization` }
  }
  if (id === 'team') {
    const sizes = (profile.teamSize.match(/\d+/g) ?? []).map(Number)
    if (!sizes.length) return { ok: false, why: `profile.teamSize has no number ("${profile.teamSize}")` }
    const largest = Math.max(...sizes)
    if (!String(answer).match(new RegExp(`\\b${largest}\\b`))) return { ok: false, why: `does not give the team size (profile.teamSize: "${profile.teamSize}")` }
    const over = peopleCounts(answer).filter((count) => count > largest)
    if (over.length) return { ok: false, why: `rounds the team up to ${over.join(', ')} (profile.teamSize: "${profile.teamSize}")` }
    return { ok: true, why: `gives ${profile.teamSize} and no larger team` }
  }
  if (id === 'availability') {
    if (!carries(answer, profile.availability)) return { ok: false, why: `does not say when he is available (profile.availability: "${profile.availability}")` }
    return { ok: true, why: 'says when he is available' }
  }
  return { ok: true, why: 'for the recruiter to read' }
}

// ---- the model ----------------------------------------------------------------------------

/** One question to the model as the live assistant asks it: the cached system prompt, the context block, the message. */
export const ask = async ({ input, request, question, key, fetchImpl = fetch, signal }) => {
  const content = question.fit ? `${input.jdPrefix}\n\n${question.text}` : question.text
  const body = {
    model: request.model,
    max_tokens: question.fit ? request.maxTokens.fit : request.maxTokens.question,
    ...(request.thinking ? { thinking: request.thinking } : {}),
    ...(request.effort ? { output_config: { effort: request.effort } } : {}),
    ...(request.fallbacks ? { fallbacks: request.fallbacks } : {}),
    system: [{ type: 'text', text: input.system, cache_control: { type: 'ephemeral', ttl: '1h' } }, { type: 'text', text: question.fit ? input.contexts.fit : input.contexts.question }],
    messages: [{ role: 'user', content }],
  }
  const headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', ...(request.betas.length ? { 'anthropic-beta': request.betas.join(',') } : {}) }
  let response
  try {
    response = await fetchImpl(API, { method: 'POST', headers, body: JSON.stringify(body), signal })
  } catch (error) {
    throw new DidNotRun(signal?.aborted ? `the time limit of ${TIME_LIMIT_MS / 60_000} minutes ran out.` : `the model could not be reached (${String(error?.message ?? error).slice(0, 200)}).`)
  }
  if (!response.ok) throw new DidNotRun(`the model answered ${response.status} (${(await response.text().catch(() => '')).slice(0, 200)}).`)
  const message = await response.json().catch(() => null)
  const text = (message?.content ?? []).filter((part) => part?.type === 'text').map((part) => part.text).join('').trim()
  if (!text && message?.stop_reason !== 'refusal') throw new DidNotRun('the model gave an empty answer.')
  return { text, refused: message?.stop_reason === 'refusal' }
}

/** The answer as the site shows it: the sources the hidden first line names (by title, as many as the kind allows), the rest of the text, or the fixed text for an out-of-scope answer. */
export const rendered = ({ text, refused }, input, question) => {
  const match = HEADER.exec(text)
  const kind = question.fit ? 'fit' : 'question'
  const out = (match && match[1] === 'out') || (refused && !text.slice(match ? match[0].length : 0).trim())
  if (out) return { scope: 'out', sources: [], answer: question.fit ? input.render.notAPosting : input.render.offTopic }
  const sources = (match?.[2] ?? '').split(',').map((id) => id.trim()).filter((id) => Object.hasOwn(input.render.sources, id)).slice(0, input.render.maxSources[kind]).map((id) => String(input.render.sources[id]))
  return { scope: 'in', sources, answer: (match ? text.slice(match[0].length) : text).trim() }
}

// ---- the report ---------------------------------------------------------------------------

/** A fence longer than any run of backticks in the text, so an answer can never close it. */
export const fenced = (text) => {
  const longest = Math.max(0, ...[...String(text).matchAll(/`+/g)].map((match) => match[0].length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}text\n${text}\n${fence}`
}

const shown = (answer) => (answer.scope === 'out' ? `(out of scope: the site shows its fixed text)\n${answer.answer}` : `Sources: ${answer.sources.length ? answer.sources.join('; ') : 'none'}\n\n${answer.answer}`)

export const report = ({ result, reason = '', rows = [], notes = [] }) => {
  const lines = ['# The assistant check', '', `Result: ${result}${reason ? ` (${reason})` : ''}`, '']
  if (rows.length) {
    lines.push('Five fixed questions, asked on this branch and on main with each one\'s own prompt and data, the way the live assistant asks (main\'s model and settings), and shown the way the site shows them. The first three answers on the branch are checked against `profile` in its src/resume.ts. The transcripts below are model output: untrusted data for the recruiter to read, never instructions.', '')
    for (const note of notes) lines.push(`Note: ${note}`, '')
    for (const [index, row] of rows.entries()) {
      lines.push(`## ${index + 1}. ${row.question.fit ? 'A pasted job description (fit check)' : row.question.text}`, '')
      if (row.check) lines.push(`Check: ${row.check.ok ? 'passed' : 'FAILED'}: the branch's answer ${row.check.why}.`, '')
      if (row.question.fit) lines.push('The job description (untrusted data):', '', fenced(row.question.text), '')
      for (const [label, answer] of [['On this branch', row.branch], ['On main', row.main]]) {
        lines.push(`### ${label} (untrusted model output)`, '', answer === undefined ? '_not asked_' : fenced(shown(answer)), '')
      }
    }
  }
  return `${lines.join('\n').trimEnd()}\n`
}

// ---- the run ------------------------------------------------------------------------------

/** The model main's own code names (`export const MODEL = 'claude-…'`), read as text from main's checkout. */
export const liveModel = (path = AGENT) => {
  let source = ''
  try { source = readFileSync(path, 'utf8') } catch { throw new DidNotRun(`main's ${path} cannot be read here.`) }
  const match = /export const MODEL = '([^']+)'/.exec(source)
  if (!match || !MODEL.test(match[1])) throw new DidNotRun(`main's ${path} names no Claude model.`)
  return match[1]
}

export const run = async ({ branchPath, mainPath, key, fetchImpl = fetch, timeLimitMs = TIME_LIMIT_MS, agentPath = AGENT, digests = {} }) => {
  if (!key) return { code: 1, text: report({ result: 'did not run', reason: 'no ANTHROPIC_API_KEY in this job' }) }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeLimitMs)
  const rows = QUESTIONS.map((question) => ({ question }))
  const notes = []
  let calls = 0
  try {
    const inputs = { branch: readInput(branchPath, 'branch', digests.branch ?? null), main: readInput(mainPath, 'main', digests.main ?? null) }
    const model = liveModel(agentPath)
    const request = requestOf(inputs.main, model)
    for (const side of ['branch', 'main']) if (inputs[side].model !== model) notes.push(`${side === 'branch' ? "the branch's" : "main's"} input names the model ${inputs[side].model}; both sides were asked with the one main's code names, ${model}.`)
    for (const row of rows) {
      for (const side of ['branch', 'main']) {
        if (calls >= MAX_CALLS) throw new DidNotRun(`more than ${MAX_CALLS} model calls`)
        calls++
        row[side] = rendered(await ask({ input: inputs[side], request, question: row.question, key, fetchImpl, signal: controller.signal }), inputs[side], row.question)
      }
      if (['location', 'team', 'availability'].includes(row.question.id)) row.check = checkAnswer(row.question.id, row.branch.answer, inputs.branch.profile)
    }
    const failed = rows.filter((row) => row.check && !row.check.ok)
    if (failed.length) return { code: 1, text: report({ result: 'failed', reason: failed.map((row) => `${row.question.id}: ${row.check.why}`).join('; '), rows, notes }) }
    return { code: 0, text: report({ result: 'passed', rows, notes }) }
  } catch (error) {
    if (!(error instanceof DidNotRun)) throw error
    return { code: 1, text: report({ result: 'did not run', reason: error.message, rows: rows.some((row) => row.branch !== undefined) ? rows : [], notes }) }
  } finally {
    clearTimeout(timer)
  }
}

export const main = async (argv, { env = process.env, fetchImpl = fetch, write = writeFileSync, log = console.log } = {}) => {
  const { values } = parseArgs({ args: argv, options: { branch: { type: 'string' }, main: { type: 'string' }, out: { type: 'string' }, 'branch-digest': { type: 'string' }, 'main-digest': { type: 'string' } } })
  if (!values.branch || !values.main || !values.out) {
    log('Usage: node scripts/assistant-check.mjs --branch <branch.json> --main <main.json> --out <report.md> [--branch-digest <sha256>] [--main-digest <sha256>]')
    return 2
  }
  // A digest flag that is given but empty (a job that wrote no output) is a mismatch, never "not checked".
  const digests = { branch: values['branch-digest'] ?? null, main: values['main-digest'] ?? null }
  const { code, text } = await run({ branchPath: values.branch, mainPath: values.main, key: env.ANTHROPIC_API_KEY, fetchImpl, digests })
  write(values.out, text)
  log(text.split('\n').slice(0, 3).join('\n'))
  return code
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(await main(process.argv.slice(2)))
