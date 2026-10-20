// The numbers of a Building write-up after a refresh (.github/workflows/site-update.yml,
// "What changed in the project"): the committed feed.json with the live feed's numbers
// merged over it. A project's site may send only some of the article's numbers (AI Breaker
// sends visitorCountries30d alone); the others stay as they were, so the article never
// reads 0 for a number the feed did not send.
//
//   node building-feed.mjs <live feed JSON> <feed.json> [project]
//
// Exits 1 without writing when the live answer has no numbers object; the step then keeps
// the committed file and warns. The live feed is outside text: only a finite number under a
// plain key reaches the file (no string, no object, no __proto__), at most 32 of them.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const KEY = /^[A-Za-z][A-Za-z0-9]{0,63}$/
export const MAX_NUMBERS = 32
const ISO = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/
// The live site's clock and the runner's may differ by a little.
const SKEW_MS = 5 * 60 * 1000

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const finiteNumbers = (numbers, limit) => {
  const out = {}
  if (!isObject(numbers)) return out
  for (const [key, value] of Object.entries(numbers)) {
    if (Object.keys(out).length >= limit) break
    if (KEY.test(key) && typeof value === 'number' && Number.isFinite(value)) out[key] = value
  }
  return out
}

export const validAsOf = (value, now) => typeof value === 'string' && ISO.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now.getTime() + SKEW_MS

// A fresh object: the committed project and numbers, the live numbers over them, the live date when it is a real one.
export const mergeFeed = (committed, live, { now = new Date(), project = null } = {}) => {
  if (!isObject(live) || !isObject(live.numbers)) return null
  const base = isObject(committed) ? committed : {}
  const numbers = finiteNumbers(base.numbers, MAX_NUMBERS)
  for (const [key, value] of Object.entries(finiteNumbers(live.numbers, Infinity))) {
    if (Object.hasOwn(numbers, key) || Object.keys(numbers).length < MAX_NUMBERS) numbers[key] = value
  }
  const asOf = validAsOf(live.asOf, now) ? live.asOf : typeof base.asOf === 'string' ? base.asOf : now.toISOString()
  return { project: typeof base.project === 'string' ? base.project : project, asOf, numbers }
}

export const main = ([livePath, feedPath, project] = [], { now = new Date(), log = console.log } = {}) => {
  let live = null
  try { live = JSON.parse(readFileSync(livePath, 'utf8')) } catch { live = null }
  let committed = null
  try { committed = existsSync(feedPath) ? JSON.parse(readFileSync(feedPath, 'utf8')) : null } catch { committed = null }
  const merged = mergeFeed(committed, live, { now, project: project ?? null })
  if (!merged) {
    log('The live feed has no numbers; the committed ones stay.')
    return 1
  }
  writeFileSync(feedPath, `${JSON.stringify(merged, null, 2)}\n`)
  return 0
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main(process.argv.slice(2))
}
