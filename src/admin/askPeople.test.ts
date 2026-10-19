import { describe, expect, it } from 'vitest'
import { askPeople } from './askPeople'
import type { AskLogEntry } from './types'

// Local times: the chart counts the viewer's days.
const at = (day: string, hour: number) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, hour).getTime() }
const entry = (visitor: string, ts: number, extra: Partial<AskLogEntry> = {}): AskLogEntry => ({ id: ts, ts, visitor, kind: 'question', page: 'home', question: `q ${ts}`, answer: 'a', outcome: 'answered', country: 'BE', asOrg: 'Proximus', ...extra })

describe('askPeople', () => {
  it('groups the log by visitor, newest person first, with their questions in the order they asked', () => {
    const { people, daily } = askPeople([
      entry('b', at('2026-10-18', 9), { kind: 'fit', page: 'experience', asOrg: 'Contoso', country: 'US' }),
      entry('a', at('2026-10-17', 11)),
      entry('a', at('2026-10-17', 10)),
      entry('b', at('2026-10-18', 10)),
    ])
    expect(people.map((person) => person.visitor)).toEqual(['b', 'a'])
    expect(people[1].entries.map((item) => item.ts)).toEqual([at('2026-10-17', 10), at('2026-10-17', 11)])
    expect(people[0]).toMatchObject({ fit: 1, network: 'Contoso, US', pages: 'experience, home' })
    expect(daily).toEqual([{ day: '2026-10-17', people: 1, questions: 2 }, { day: '2026-10-18', people: 1, questions: 2 }])
  })

  it('is empty without a log', () => {
    expect(askPeople([])).toEqual({ people: [], daily: [] })
  })
})
