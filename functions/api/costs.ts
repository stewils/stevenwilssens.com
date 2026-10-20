// POST /api/costs: the ingest of development costs (specs/dev-costs.md). The Review and Site
// update workflows' `costs` job posts one row per Claude run; Steven's SessionEnd hook
// (.claude/hooks/dev-costs.mjs) posts the tokens of each local session. Only with
// COSTS_INGEST_TOKEN, checked before the body is read; never on a *.pages.dev preview
// (previews share the production database); 16 KB; exactly the documented shape or a fixed
// 400 that echoes nothing; at most 5,000 rows written per UTC day (429, nothing written).
//
// GET /api/costs (admin token): the five views of /admin#costs in one answer, priced now
// from functions/_lib/prices.ts, with the pull requests' states from GitHub. No session id,
// no secret, and from GitHub only the number, the state and the merge commit.
//
// No CORS header and no-store on every answer; no other method is routed.
import type { Env } from '../_lib/env'
import { bearerToken, isAdmin, sameSecret } from '../_lib/auth'
import { CostStore } from '../_lib/costs/store'
import { buildViews, type PullInfo } from '../_lib/costs/views'
import { parseIngest } from '../_lib/costs/ingest'
import { gitHubClient } from '../_lib/github'
import { isJson, json, readCapped } from '../_lib/http'
import { PRICES_READ } from '../_lib/prices'

const MAX_BODY = 16 * 1024
const MIN_SECRET = 32
const REPO = /^[\w.-]+\/[\w.-]+$/
const DEFAULT_REPO = 'stewils/stevenwilssens.com'

const failed = (what: string, error: unknown) => {
  // The error's class only: never the body, a header or a message that could carry either.
  console.error(`costs ${what} failed:`, error instanceof Error ? error.name : 'unknown error')
  return json({ error: 'unavailable' }, 500)
}

// The ingest secret, when it is set well enough to use: long, and not the admin's.
const ingestSecret = (env: Env) => {
  const secret = env.COSTS_INGEST_TOKEN ?? ''
  return secret.length >= MIN_SECRET && secret !== env.ADMIN_TOKEN ? secret : null
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (new URL(request.url).hostname.endsWith('.pages.dev')) return json({ error: 'forbidden' }, 403)
  const secret = ingestSecret(env)
  if (!secret) return json({ error: 'not configured' }, 503)
  if (!sameSecret(bearerToken(request), secret) || !/^Bearer\s/i.test(request.headers.get('Authorization') ?? '')) return json({ error: 'unauthorized' }, 401)
  if (!isJson(request)) return json({ error: 'unsupported media type' }, 415)
  const text = await readCapped(request, MAX_BODY)
  if (text === null) return json({ error: 'too large' }, 413)
  const body = parseIngest(text)
  if (!body) return json({ error: 'invalid' }, 400)
  try {
    const outcome = await new CostStore(env.DB).write(body)
    if (outcome === 'limited') return json({ error: 'daily limit' }, 429)
    return json({ ok: true })
  } catch (error) {
    return failed('ingest', error)
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401)
  const repo = env.GITHUB_REPO && REPO.test(env.GITHUB_REPO) ? env.GITHUB_REPO : DEFAULT_REPO
  try {
    const store = new CostStore(env.DB)
    const [rows, budgets] = await Promise.all([store.rows(), store.budgets()])
    // GitHub failing (or no token) leaves every state unknown; the rest of the answer stands.
    let pulls: PullInfo[] | null = null
    if (env.GITHUB_TOKEN && rows.length) {
      try {
        pulls = (await gitHubClient(env.GITHUB_TOKEN, repo).allPulls()).map((pull) => ({ number: pull.number, state: pull.state, merged: pull.merged, mergeCommit: pull.mergeCommit, branch: pull.branch, supersedes: pull.request?.supersedes ?? null }))
      } catch (error) {
        console.error('costs pull requests failed:', error instanceof Error ? error.name : 'unknown error')
      }
    }
    return json(buildViews({ rows, budgets, pulls, now: Date.now(), repo, pricesRead: PRICES_READ }))
  } catch (error) {
    return failed('read', error)
  }
}
