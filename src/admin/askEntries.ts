// The assistant's logged answers on the admin: how an outcome is named and badged, and the
// whole answer of one entry (GET /api/ask/admin?entry=<id>), fetched once each so the queue
// can ask for the next one ahead.
import type { AskLogEntry } from './types'

export type LoadEntry = (id: number) => Promise<AskLogEntry | null>

export const outcomeLabel: Record<AskLogEntry['outcome'], string> = { answered: 'answered', gap: 'not covered', off: 'off topic', limited: 'turned away', failed: 'failed' }
export const outcomeBadge: Record<AskLogEntry['outcome'], string> = { answered: '', gap: 'warn', off: 'info', limited: 'warn', failed: 'error' }

// A fit check is logged as "Job description (N characters): " and the posting's first words,
// which still start with the line the panel puts before a pasted posting. The queue's heading
// shows only the posting's words; the length goes in the line under it.
export const fitParts = (question: string): { head: string; length: number | null } => {
  const match = /^Job description \((\d+) characters\): /.exec(question)
  if (!match) return { head: question, length: null }
  return { head: question.slice(match[0].length).replace(/^Job description to check against [^:]*:\s*/, ''), length: Number(match[1]) }
}

export const cachedLoader = (load: LoadEntry): LoadEntry => {
  const seen = new Map<number, Promise<AskLogEntry | null>>()
  return (id) => {
    let found = seen.get(id)
    if (!found) {
      found = load(id).catch(() => null)
      seen.set(id, found)
      // A failure is tried again next time.
      void found.then((entry) => { if (!entry) seen.delete(id) })
    }
    return found
  }
}
