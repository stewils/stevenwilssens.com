// GET /api/notes: the public notes only, read-only, as the assistant check reads them.
import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../_lib/mcp/store'
import { notesResponse, onRequestGet, publicNotes } from './notes'

const seeded = async () => {
  const store = new MemoryStore()
  await store.insert({ role: 'general', topic: 'now', title: 'Looking for', body: 'A product leadership role.', visibility: 'public', tags: 'secret-tag' }, 1)
  await store.insert({ role: 'general', topic: 'now', title: 'Private', body: 'Never shown.', visibility: 'private', tags: null }, 2)
  return store
}

describe('GET /api/notes', () => {
  it('answers the public notes only, without tags or dates, cacheable', async () => {
    const response = await notesResponse(await seeded())
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
    const body = await response.json() as { notes: Record<string, unknown>[] }
    expect(body.notes).toEqual([{ id: 1, role: 'general', topic: 'now', title: 'Looking for', body: 'A product leadership role.' }])
    expect(JSON.stringify(body)).not.toContain('Never shown')
  })

  it('drops a private entry even when the store ignores the filter', async () => {
    const store = await seeded()
    const careless = { ...store, list: () => store.list({}) } as unknown as MemoryStore
    expect((await publicNotes(careless)).map((note) => note.title)).toEqual(['Looking for'])
  })

  it('answers 503 when the database cannot be read', async () => {
    const broken = { list: async () => { throw new Error('D1 down') } } as unknown as MemoryStore
    const response = await notesResponse(broken)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'unavailable' })
  })

  it('reads the D1 database of the request', async () => {
    const db = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }), all: async () => ({ results: [] }) }) }
    const response = await onRequestGet({ env: { DB: db } } as unknown as Parameters<typeof onRequestGet>[0])
    expect(await response.json()).toEqual({ notes: [] })
  })
})
