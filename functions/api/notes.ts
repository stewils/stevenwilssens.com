// GET /api/notes: Steven's public dossier notes, the entries he marked public so the site's
// assistant may use them (functions/_lib/ask/prompt.ts). The same notes the public MCP server
// serves, read-only and without a log row, so the Review workflow's assistant check reads what
// the live assistant reads without moving any number on the site. Private notes never leave.
import type { Env } from '../_lib/env'
import { D1Store, type DossierStore } from '../_lib/mcp/store'

export type PublicNote = { id: number; role: string; topic: string; title: string; body: string }

export const publicNotes = async (store: DossierStore): Promise<PublicNote[]> =>
  (await store.list({ visibility: 'public' })).filter((entry) => entry.visibility === 'public').map(({ id, role, topic, title, body }) => ({ id, role, topic, title, body }))

export const notesResponse = async (store: DossierStore) => {
  try {
    return new Response(JSON.stringify({ notes: await publicNotes(store) }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
  } catch (error) {
    console.error('notes', error)
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  }
}

export const onRequestGet: PagesFunction<Env> = ({ env }) => notesResponse(new D1Store(env.DB))
