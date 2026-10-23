// POST /api/costs/budget (admin token): Steven's budget for one feature. { branch, amountUsd }
// sets it (0 < amount <= 1000 dollars), { branch, amountUsd: null } removes it. At most 500
// budgets. Exactly that shape, the same branch rule as the ingest, fixed error bodies; the
// answer is the budget as stored, so the page updates without reading everything again.
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/auth'
import { isBranch } from '../../_lib/costs/ingest'
import { CostStore } from '../../_lib/costs/store'
import { isJson, json, readCapped } from '../../_lib/http'

const MAX_BODY = 4 * 1024
const MAX_USD = 1000

export const parseBudget = (text: string): { branch: string; micro: number | null } | null => {
  let body: unknown
  try { body = JSON.parse(text) } catch { return null }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const keys = Object.keys(body)
  if (keys.length !== 2 || !keys.includes('branch') || !keys.includes('amountUsd')) return null
  const { branch, amountUsd } = body as { branch: unknown; amountUsd: unknown }
  if (!isBranch(branch) || branch === 'main' || branch === 'HEAD') return null
  if (amountUsd === null) return { branch, micro: null }
  if (typeof amountUsd !== 'number' || !Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > MAX_USD) return null
  return { branch, micro: Math.round(amountUsd * 1_000_000) }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401)
  if (!isJson(request)) return json({ error: 'unsupported media type' }, 415)
  const text = await readCapped(request, MAX_BODY)
  if (text === null) return json({ error: 'too large' }, 413)
  const parsed = parseBudget(text)
  if (!parsed) return json({ error: 'invalid' }, 400)
  try {
    const outcome = await new CostStore(env.DB).setBudget(parsed.branch, parsed.micro)
    if (outcome === 'full') return json({ error: 'too many budgets' }, 400)
    return json({ branch: parsed.branch, budgetMicro: parsed.micro })
  } catch (error) {
    console.error('costs budget failed:', error instanceof Error ? error.name : 'unknown error')
    return json({ error: 'unavailable' }, 500)
  }
}
