// @vitest-environment node
// The dossier stores: the D1 store runs its real SQL on an in-memory SQLite with every
// migration applied; the memory store and the public view are checked for the same behaviour.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeD1 } from '../testing/d1'
import { D1Store, MemoryStore, publicView, ReadOnlyError, type DossierStore, type EntryInput, type ProposalInput } from './store'

const entry = (overrides: Partial<EntryInput> = {}): EntryInput => ({ role: 'microsoft', topic: 'impact', title: 'Shipped experimentation', body: 'Steven built the experimentation platform.', visibility: 'private', tags: 'resume, platform', ...overrides })
const proposal = (overrides: Partial<ProposalInput> = {}): ProposalInput => ({ role: 'microsoft', field: 'point', kind: 'replace', currentText: 'Old bullet', proposedText: 'New bullet', rationale: 'Adds the number', basedOn: '12', ...overrides })

afterEach(() => vi.restoreAllMocks())

const stores: [string, () => DossierStore][] = [['D1', () => new D1Store(fakeD1())], ['memory', () => new MemoryStore()]]

describe.each(stores)('the %s dossier store', (_, make) => {
  it('inserts, reads, filters and orders entries', async () => {
    const store = make()
    const a = await store.insert(entry({ role: 'zeta', topic: 'b' }), 1000)
    const b = await store.insert(entry({ role: 'alpha', topic: 'b', visibility: 'public' }), 2000)
    const c = await store.insert(entry({ role: 'alpha', topic: 'a', tags: null }), 3000)
    expect(a).toMatchObject({ id: 1, createdAt: 1000, updatedAt: 1000, role: 'zeta' })
    expect(await store.get(b.id)).toEqual(b)
    expect(await store.get(99)).toBeNull()
    expect((await store.list({})).map((item) => item.id)).toEqual([c.id, b.id, a.id])
    expect((await store.list({ role: 'alpha' })).map((item) => item.id)).toEqual([c.id, b.id])
    expect((await store.list({ topic: 'b', visibility: 'public' })).map((item) => item.id)).toEqual([b.id])
    expect(await store.list({ role: 'nobody' })).toEqual([])
  })

  it('updates part of an entry and removes it', async () => {
    const store = make()
    const saved = await store.insert(entry(), 1000)
    const updated = await store.update(saved.id, { title: 'Renamed', visibility: 'public' }, 5000)
    expect(updated).toMatchObject({ id: saved.id, title: 'Renamed', visibility: 'public', body: saved.body, createdAt: 1000, updatedAt: 5000 })
    expect(await store.update(42, { title: 'x' }, 6000)).toBeNull()
    expect(await store.remove(saved.id)).toBe(true)
    expect(await store.remove(saved.id)).toBe(false)
    expect(await store.get(saved.id)).toBeNull()
  })

  it('ranks a search by title matches over body and tag matches, then by the newest', async () => {
    const store = make()
    const inBody = await store.insert(entry({ title: 'Platform', body: 'about experiments' }), 1000)
    const inTitle = await store.insert(entry({ title: 'Experiments at scale', body: 'nothing' , tags: null }), 2000)
    const inTags = await store.insert(entry({ title: 'Other', body: 'nothing', tags: 'experiments' , visibility: 'public' }), 3000)
    await store.insert(entry({ title: 'Unrelated', body: 'nothing', tags: null }), 4000)
    expect(await store.search([], {}, 10)).toEqual([])
    expect((await store.search(['experiment'], {}, 10)).map((item) => item.id)).toEqual([inTitle.id, inTags.id, inBody.id])
    expect((await store.search(['experiment'], {}, 1)).map((item) => item.id)).toEqual([inTitle.id])
    expect((await store.search(['experiment'], { visibility: 'public' }, 10)).map((item) => item.id)).toEqual([inTags.id])
    expect(await store.search(['absent'], {}, 10)).toEqual([])
  })

  it('keeps proposals, records decisions and marks them applied once', async () => {
    const store = make()
    const first = await store.insertProposal(proposal(), 1000)
    const second = await store.insertProposal(proposal({ field: null, kind: 'add', currentText: null, basedOn: null }), 2000)
    const third = await store.insertProposal(proposal({ kind: 'remove', proposedText: null }), 3000)
    expect(first).toMatchObject({ id: 1, status: 'proposed', decisionNote: null, field: 'point', currentText: 'Old bullet' })
    expect(second).toMatchObject({ field: null, currentText: null, basedOn: null })
    expect(await store.decideProposal(first.id, 'approved', 'Looks right', 4000)).toMatchObject({ status: 'approved', decisionNote: 'Looks right', updatedAt: 4000 })
    expect(await store.decideProposal(second.id, 'approved', '', 4000)).toMatchObject({ status: 'approved' })
    expect(await store.decideProposal(third.id, 'rejected', null, 4000)).toMatchObject({ status: 'rejected' })
    expect(await store.decideProposal(99, 'approved', null, 4000)).toBeNull()
    expect((await store.listProposals('approved')).map((item) => item.id)).toEqual([first.id, second.id])
    expect(await store.listProposals()).toHaveLength(3)

    expect(await store.applyProposals([], 'merged', 5000)).toEqual([])
    const applied = await store.applyProposals([first.id, second.id, 99], 'merged #12', 5000)
    expect(applied.map((item) => [item.id, item.decisionNote])).toEqual([[first.id, 'Looks right · merged #12'], [second.id, 'merged #12']])
    expect(await store.applyProposals([first.id], 'again', 6000)).toEqual([])
    expect((await store.listProposals('applied')).map((item) => item.updatedAt)).toEqual([5000, 5000])
  })

  it('keeps one LinkedIn profile, replaced on every import', async () => {
    const store = make()
    expect(await store.getLinkedIn()).toBeNull()
    await store.saveLinkedIn('{"headline":"a"}', 'paste', 1000)
    await store.saveLinkedIn('{"headline":"b"}', 'pdf', 2000)
    expect(await store.getLinkedIn()).toEqual({ json: '{"headline":"b"}', source: 'pdf', importedAt: 2000 })
  })

  it('logs the public server\'s calls and lists the recent ones, newest first', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const store = make()
    await store.logToolCall({ ts: 1000, tool: 'about_steven', query: null, role: null, hits: null, country: 'BE', asOrg: 'Proximus' })
    await store.logToolCall({ ts: 3000, tool: 'search_dossier', query: 'kubernetes', role: 'microsoft', hits: 2, country: null, asOrg: null })
    await store.logToolCall({ ts: 2000, tool: 'get_role', query: null, role: 'microsoft', hits: null, country: null, asOrg: null })
    const calls = await store.toolCalls(1500, 10)
    expect(calls.map((call) => call.tool)).toEqual(['search_dossier', 'get_role'])
    expect(calls[0]).toMatchObject({ query: 'kubernetes', role: 'microsoft', hits: 2, asOrg: null })
    expect(await store.toolCalls(0, 1)).toHaveLength(1)
  })
})

describe('the D1 dossier store', () => {
  it('serves the open questions from the site assistant and closes them once', async () => {
    const db = fakeD1()
    const insert = db.sqlite.prepare('INSERT INTO ask_questions (ts, reason, page, question, answer, country, as_org) VALUES (?, ?, ?, ?, ?, ?, ?)')
    insert.run(Date.UTC(2026, 9, 1), 'gap', '/about', 'Does Steven speak French?', null, 'BE', null)
    insert.run(Date.UTC(2026, 9, 3), 'fit', null, 'Kubernetes at scale', 'Not shown', null, null)
    const store = new D1Store(db)
    expect(await store.askGaps(10)).toEqual([
      { id: 2, question: 'Kubernetes at scale', when: '2026-10-03', reason: 'fit', page: null, answer: 'Not shown' },
      { id: 1, question: 'Does Steven speak French?', when: '2026-10-01', reason: 'gap', page: '/about', answer: null },
    ])
    expect(await store.askGaps(1)).toHaveLength(1)
    expect(await store.getAskGap(1)).toMatchObject({ id: 1, reason: 'gap' })
    expect(await store.resolveAskGap(1, 'answered', 7, 5000)).toBe(true)
    expect(await store.resolveAskGap(1, 'dismissed', null, 6000)).toBe(false)
    expect(await store.getAskGap(1)).toBeNull()
    expect(await store.getAskGap(42)).toBeNull()
    expect((await store.askGaps(10)).map((gap) => gap.id)).toEqual([2])
    expect(db.sqlite.prepare('SELECT resolution, entry_id, resolved_at FROM ask_questions WHERE id = 1').get()).toEqual({ resolution: 'answered', entry_id: 7, resolved_at: 5000 })
  })

  it('now and then deletes public server calls older than ninety days', async () => {
    const db = fakeD1()
    const store = new D1Store(db)
    const day = 86_400_000
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await store.logToolCall({ ts: 0, tool: 'old', query: null, role: null, hits: null, country: null, asOrg: null })
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    await store.logToolCall({ ts: 91 * day, tool: 'new', query: null, role: null, hits: null, country: null, asOrg: null })
    expect((await store.toolCalls(0, 10)).map((call) => call.tool)).toEqual(['new'])
  })

  it('passes a D1 failure on to the caller', async () => {
    const db = fakeD1()
    db.failOn = /FROM dossier/
    await expect(new D1Store(db).list({})).rejects.toThrow('D1_ERROR')
  })
})

describe('the memory dossier store', () => {
  it('lists open questions, finds one and closes it once', async () => {
    const store = new MemoryStore()
    store.gaps.push({ id: 1, question: 'French?', when: '2026-10-01', reason: 'gap', page: null, answer: null }, { id: 2, question: 'Go?', when: '2026-10-02', reason: 'fit', page: null, answer: null })
    expect(await store.askGaps(1)).toEqual([{ id: 1, question: 'French?', when: '2026-10-01', reason: 'gap', page: null, answer: null }])
    expect(await store.resolveAskGap(1, 'dismissed', null, 10)).toBe(true)
    expect(await store.resolveAskGap(1, 'dismissed', null, 10)).toBe(false)
    expect(await store.getAskGap(1)).toBeNull()
    expect(await store.getAskGap(2)).toMatchObject({ id: 2 })
    expect((await store.askGaps(10)).map((gap) => gap.id)).toEqual([2])
  })
})

describe('the public view of the dossier', () => {
  const setup = async () => {
    const store = new MemoryStore()
    const hidden = await store.insert(entry({ title: 'Private experiments' }), 1000)
    const shown = await store.insert(entry({ title: 'Public experiments', visibility: 'public' }), 2000)
    await store.insertProposal(proposal(), 1000)
    store.gaps.push({ id: 1, question: 'q', when: '2026-10-01', reason: 'gap', page: null, answer: null })
    await store.saveLinkedIn('{}', 'paste', 1)
    await store.logToolCall({ ts: 1, tool: 'about_steven', query: null, role: null, hits: null, country: null, asOrg: null })
    return { store, view: publicView(store), hidden, shown }
  }

  it('shows public entries only', async () => {
    const { view, hidden, shown } = await setup()
    expect((await view.list({ visibility: 'private' })).map((item) => item.id)).toEqual([shown.id])
    expect(await view.get(shown.id)).toEqual(shown)
    expect(await view.get(hidden.id)).toBeNull()
    expect(await view.get(99)).toBeNull()
    expect((await view.search(['experiments'], {}, 10)).map((item) => item.id)).toEqual([shown.id])
  })

  it('hides proposals, questions, LinkedIn and the call log', async () => {
    const { view } = await setup()
    expect(await view.listProposals()).toEqual([])
    expect(await view.askGaps(10)).toEqual([])
    expect(await view.getAskGap(1)).toBeNull()
    expect(await view.getLinkedIn()).toBeNull()
    expect(await view.toolCalls(0, 10)).toEqual([])
  })

  it('refuses every write loudly, but logs its own calls', async () => {
    const { store, view, shown } = await setup()
    const writes = [
      view.insert(entry(), 1), view.update(shown.id, { title: 'x' }, 1), view.remove(shown.id),
      view.insertProposal(proposal(), 1), view.decideProposal(1, 'approved', null, 1), view.applyProposals([1], 'x', 1),
      view.resolveAskGap(1, 'dismissed', null, 1), view.saveLinkedIn('{}', 'x', 1),
    ]
    for (const write of writes) await expect(write).rejects.toBeInstanceOf(ReadOnlyError)
    await expect(view.insert(entry(), 1)).rejects.toThrow('read-only')
    await view.logToolCall({ ts: 2, tool: 'get_role', query: null, role: null, hits: null, country: null, asOrg: null })
    expect(store.calls.map((call) => call.tool)).toEqual(['about_steven', 'get_role'])
    expect(await store.get(shown.id)).toMatchObject({ title: 'Public experiments' })
  })
})
