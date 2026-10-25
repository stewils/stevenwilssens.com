// GET /api/drafts (admin token): the drafts only Steven reads (migrations/0015_admin_drafts.sql),
// newest first, without their text; with ?slug=<slug>, one draft with its Markdown body.
// The text never ships in the repository or the admin bundle, which are both public.
import type { Env } from '../_lib/env'
import { isAdmin } from '../_lib/auth'
import { json } from '../_lib/http'

export type DraftSummary = { slug: string; title: string; summary: string; updatedAt: number }
export type Draft = DraftSummary & { body: string }
type DraftRow = { slug: string; title: string; summary: string; updated_at: number }

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/
const MAX_DRAFTS = 100
const summaryOf = (row: DraftRow): DraftSummary => ({ slug: row.slug, title: row.title, summary: row.summary, updatedAt: row.updated_at })

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401)
  const slug = new URL(request.url).searchParams.get('slug')
  try {
    if (slug !== null) {
      if (!SLUG.test(slug)) return json({ error: 'not found' }, 404)
      const row = await env.DB.prepare('SELECT slug, title, summary, body, updated_at FROM admin_drafts WHERE slug = ?').bind(slug).first<DraftRow & { body: string }>()
      return row ? json({ ...summaryOf(row), body: row.body } satisfies Draft) : json({ error: 'not found' }, 404)
    }
    const { results } = await env.DB.prepare('SELECT slug, title, summary, updated_at FROM admin_drafts ORDER BY updated_at DESC LIMIT ?').bind(MAX_DRAFTS).all<DraftRow>()
    return json({ drafts: results.map(summaryOf) })
  } catch (error) {
    console.error('drafts read failed:', error instanceof Error ? error.name : 'unknown error')
    return json({ error: 'could not read the drafts' }, 500)
  }
}
