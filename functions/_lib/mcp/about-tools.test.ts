// An About page with two equal paragraphs: a proposal that quotes one of them cannot say
// which one changes, so the tool refuses it as ambiguous (and stores nothing).
import { describe, expect, it, vi } from 'vitest'
import { handleMcp } from './server'
import { MemoryStore } from './store'

vi.mock('../../../src/resume', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../src/resume')>()
  return { ...real, about: { intro: real.about.intro, paragraphs: [real.about.paragraphs[0], 'The same paragraph, twice, about Windows & Devices Data.', 'The same paragraph, twice, about Windows & Devices Data.'] } }
})

const propose = async (store: MemoryStore, args: Record<string, unknown>) => {
  const request = new Request('https://steven.wilssens.com/mcp/key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'propose_resume_change', arguments: { role: 'about', rationale: 'why', ...args } } }) })
  const response = await handleMcp({ request, store, mode: 'owner', fetchPage: async () => null, now: 1 })
  return ((await response.json()) as { result: { content: { text: string }[] } }).result.content[0].text
}

describe('an ambiguous About paragraph', () => {
  it('refuses a replace, a remove and an add that quote a paragraph the page has twice', async () => {
    const store = new MemoryStore()
    const twice = 'The same paragraph, twice, about Windows & Devices Data.'
    for (const kind of ['replace', 'remove', 'add']) expect(await propose(store, { field: 'paragraph', kind, current_text: twice, proposed_text: 'x' })).toMatch(/matches more than one paragraph of the About page; it is ambiguous/)
    expect(store.proposals).toHaveLength(0)
  })
})
