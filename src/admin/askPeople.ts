import type { AskLogEntry } from './types'

// The people who used the assistant, from its log: one per visitor code, which the
// analytics rotate daily, so a person counts once a day, like a visitor on Traffic.
export type Asker = { visitor: string; firstTs: number; lastTs: number; entries: AskLogEntry[]; fit: number; network: string; pages: string }
export type PeopleDay = { day: string; people: number; questions: number }

export function askPeople(log: AskLogEntry[]): { people: Asker[]; daily: PeopleDay[] } {
  const byVisitor = new Map<string, AskLogEntry[]>()
  for (const entry of [...log].sort((a, b) => a.ts - b.ts)) {
    const list = byVisitor.get(entry.visitor) ?? []
    list.push(entry)
    byVisitor.set(entry.visitor, list)
  }
  const people = [...byVisitor].map(([visitor, entries]): Asker => {
    const first = entries[0]
    return {
      visitor,
      firstTs: first.ts,
      lastTs: entries[entries.length - 1].ts,
      entries,
      fit: entries.filter((entry) => entry.kind === 'fit').length,
      network: [first.asOrg, first.country].filter(Boolean).join(', '),
      pages: [...new Set(entries.map((entry) => entry.page).filter(Boolean))].join(', '),
    }
  }).sort((a, b) => b.lastTs - a.lastTs)
  const perDay = new Map<string, PeopleDay>()
  for (const person of people) {
    for (const entry of person.entries) {
      const day = new Date(entry.ts).toISOString().slice(0, 10)
      const row = perDay.get(day) ?? { day, people: 0, questions: 0 }
      row.questions++
      perDay.set(day, row)
    }
    const day = new Date(person.firstTs).toISOString().slice(0, 10)
    perDay.get(day)!.people++
  }
  return { people, daily: [...perDay.values()].sort((a, b) => a.day.localeCompare(b.day)) }
}
