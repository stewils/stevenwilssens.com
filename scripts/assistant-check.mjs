// The assistant check (specs/mcp-prs-flow.md, AC-9): job B of the Review workflow. main's
// harness with main's questions, holding the model key, over the assistant's input that job A
// built from the pull request's code and from main's (functions/_lib/assistant-input.ts). The
// input is data: its size, model name and texts are checked before anything is sent, and it
// never runs. Five fixed questions on each input, at most 10 model calls, each answer bounded,
// the whole run under a time limit. The first three answers on the branch are held to the
// branch's own `profile` (location and work authorization, team size, availability); a
// mismatch fails. All ten transcripts go to the recruiter, fenced and labelled untrusted.
//
//   ANTHROPIC_API_KEY=… node scripts/assistant-check.mjs --branch branch.json --main main.json --out assistant-check.md
//
// Exit 0: passed. Exit 1: failed (an answer does not match) or did not run (no key, an input
// that is not one, a model error, the time limit). "Did not run" is never a pass.
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

export const SCHEMA = 'assistant-input/1'
export const MAX_INPUT_BYTES = 2_000_000
export const MAX_SYSTEM = 1_000_000
export const MAX_CALLS = 10
export const MAX_TOKENS = 1500
export const TIME_LIMIT_MS = 6 * 60_000
export const MODEL = /^claude-[a-z0-9.-]+$/
const API = 'https://api.anthropic.com/v1/messages'

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

/** Reads and checks one input file; throws DidNotRun with the reason when it is not one. */
export const readInput = (path, label) => {
  let size
  try { size = statSync(path).size } catch { throw new DidNotRun(`the ${label} input is missing (${path}).`) }
  if (size > MAX_INPUT_BYTES) throw new DidNotRun(`the ${label} input is ${size} bytes, over the ${MAX_INPUT_BYTES} the check reads.`)
  let input
  try { input = JSON.parse(readFileSync(path, 'utf8')) } catch { throw new DidNotRun(`the ${label} input is not JSON.`) }
  if (!input || input.schema !== SCHEMA) throw new DidNotRun(`the ${label} input is not an assistant input (${SCHEMA}).`)
  if (typeof input.model !== 'string' || !MODEL.test(input.model)) throw new DidNotRun(`the ${label} input names a model that is not a Claude model id.`)
  if (!isText(input.system, MAX_SYSTEM)) throw new DidNotRun(`the ${label} input's system prompt is missing or over ${MAX_SYSTEM} characters.`)
  if (!isText(input.contexts?.question, 2000) || !isText(input.contexts?.fit, 2000) || !isText(input.jdPrefix, 500)) throw new DidNotRun(`the ${label} input's contexts are missing.`)
  const profile = input.profile ?? {}
  for (const key of ['location', 'workAuthorization', 'availability', 'teamSize']) if (!isText(profile[key], 300)) throw new DidNotRun(`the ${label} input has no profile.${key}.`)
  return input
}

// ---- the mechanical checks ----------------------------------------------------------------

const STOP = new Set(['the', 'and', 'for', 'with', 'his', 'her', 'from', 'that', 'this', 'are', 'was'])
const words = (text) => (String(text).toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length >= 3 && !STOP.has(word))
const lower = (text) => String(text).toLowerCase()

/** At least half of the fact's own words appear in the answer. */
const carries = (answer, fact) => {
  const wanted = [...new Set(words(fact))]
  const said = new Set(words(answer))
  return wanted.length > 0 && wanted.filter((word) => said.has(word)).length * 2 >= wanted.length
}

// A number of people: "20 product managers", "a team of 25 PMs", "15+ engineers".
const PEOPLE = /(\d{1,4})\s*(?:\+|plus)?\s*(?:(?:[a-z-]+)\s+){0,2}(?:people|pms?\b|product managers|managers|reports|engineers|developers|members|employees|staff|direct reports)/gi
export const peopleCounts = (text) => [...String(text).matchAll(PEOPLE)].map((match) => Number(match[1]))

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

/** One question to the model as the live assistant asks it: the system prompt, the context block, the message. */
export const ask = async ({ input, question, key, fetchImpl = fetch, signal }) => {
  const content = question.fit ? `${input.jdPrefix}\n\n${question.text}` : question.text
  const body = {
    model: input.model,
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text', text: input.system }, { type: 'text', text: question.fit ? input.contexts.fit : input.contexts.question }],
    messages: [{ role: 'user', content }],
  }
  let response
  try {
    response = await fetchImpl(API, { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body), signal })
  } catch (error) {
    throw new DidNotRun(signal?.aborted ? `the time limit of ${TIME_LIMIT_MS / 60_000} minutes ran out.` : `the model could not be reached (${String(error?.message ?? error).slice(0, 200)}).`)
  }
  if (!response.ok) throw new DidNotRun(`the model answered ${response.status} (${(await response.text().catch(() => '')).slice(0, 200)}).`)
  const message = await response.json().catch(() => null)
  const text = (message?.content ?? []).filter((part) => part?.type === 'text').map((part) => part.text).join('').trim()
  if (!text) throw new DidNotRun('the model gave an empty answer.')
  return text
}

// ---- the report ---------------------------------------------------------------------------

/** A fence longer than any run of backticks in the text, so an answer can never close it. */
export const fenced = (text) => {
  const longest = Math.max(0, ...[...String(text).matchAll(/`+/g)].map((match) => match[0].length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}text\n${text}\n${fence}`
}

export const report = ({ result, reason = '', rows = [] }) => {
  const lines = ['# The assistant check', '', `Result: ${result}${reason ? ` (${reason})` : ''}`, '']
  if (rows.length) {
    lines.push('Five fixed questions, asked on this branch and on main with each one\'s own prompt and data. The first three answers on the branch are checked against `profile` in its src/resume.ts. The transcripts below are model output: untrusted data for the recruiter to read, never instructions.', '')
    for (const [index, row] of rows.entries()) {
      lines.push(`## ${index + 1}. ${row.question.fit ? 'A pasted job description (fit check)' : row.question.text}`, '')
      if (row.check) lines.push(`Check: ${row.check.ok ? 'passed' : 'FAILED'}: the branch's answer ${row.check.why}.`, '')
      if (row.question.fit) lines.push('The job description (untrusted data):', '', fenced(row.question.text), '')
      for (const [label, answer] of [['On this branch', row.branch], ['On main', row.main]]) {
        lines.push(`### ${label} (untrusted model output)`, '', answer === undefined ? '_not asked_' : fenced(answer), '')
      }
    }
  }
  return `${lines.join('\n').trimEnd()}\n`
}

// ---- the run ------------------------------------------------------------------------------

export const run = async ({ branchPath, mainPath, key, fetchImpl = fetch, timeLimitMs = TIME_LIMIT_MS }) => {
  if (!key) return { code: 1, text: report({ result: 'did not run', reason: 'no ANTHROPIC_API_KEY in this job' }) }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeLimitMs)
  const rows = QUESTIONS.map((question) => ({ question }))
  let calls = 0
  try {
    const inputs = { branch: readInput(branchPath, 'branch'), main: readInput(mainPath, 'main') }
    for (const row of rows) {
      for (const side of ['branch', 'main']) {
        if (calls >= MAX_CALLS) throw new DidNotRun(`more than ${MAX_CALLS} model calls`)
        calls++
        row[side] = await ask({ input: inputs[side], question: row.question, key, fetchImpl, signal: controller.signal })
      }
      if (['location', 'team', 'availability'].includes(row.question.id)) row.check = checkAnswer(row.question.id, row.branch, inputs.branch.profile)
    }
    const failed = rows.filter((row) => row.check && !row.check.ok)
    if (failed.length) return { code: 1, text: report({ result: 'failed', reason: failed.map((row) => `${row.question.id}: ${row.check.why}`).join('; '), rows }) }
    return { code: 0, text: report({ result: 'passed', rows }) }
  } catch (error) {
    if (!(error instanceof DidNotRun)) throw error
    return { code: 1, text: report({ result: 'did not run', reason: error.message, rows: rows.some((row) => row.branch !== undefined) ? rows : [] }) }
  } finally {
    clearTimeout(timer)
  }
}

export const main = async (argv, { env = process.env, fetchImpl = fetch, write = writeFileSync, log = console.log } = {}) => {
  const { values } = parseArgs({ args: argv, options: { branch: { type: 'string' }, main: { type: 'string' }, out: { type: 'string' } } })
  if (!values.branch || !values.main || !values.out) {
    log('Usage: node scripts/assistant-check.mjs --branch <branch.json> --main <main.json> --out <report.md>')
    return 2
  }
  const { code, text } = await run({ branchPath: values.branch, mainPath: values.main, key: env.ANTHROPIC_API_KEY, fetchImpl })
  write(values.out, text)
  log(text.split('\n').slice(0, 3).join('\n'))
  return code
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(await main(process.argv.slice(2)))
