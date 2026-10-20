// Where a proposal lands, for the Résumé page's proposals table.
import { about } from '../resume'
import type { Proposal } from './types'

// Whitespace, curly quotes and long dashes do not make a different wording: the same rule as
// norm in functions/_lib/mcp/proposals.ts (the admin does not import functions/; a test keeps them in step).
export const normWording = (text: string | null | undefined) => (text ?? '').replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()
export const sameWording = (a: string | null | undefined, b: string | null | undefined) => normWording(a) === normWording(b)

// Where a proposal lands, in two lines: the place and what in it changes. An About proposal
// reads as a place on the page, from fixed words (never the stored text); its paragraph is
// numbered by matching its current text to the page as deployed. Résumé rows keep their key.
export const whereOf = (row: Pick<Proposal, 'role' | 'field' | 'kind' | 'currentText'>, paragraphs: readonly string[] = about.paragraphs) => {
  if (row.role !== 'about') return { place: row.role, part: row.field && row.field !== 'point' ? row.field : null, kind: row.kind }
  const index = row.currentText ? paragraphs.findIndex((paragraph) => sameWording(paragraph, row.currentText)) : -1
  const part = row.field === 'intro' ? 'line under the title' : row.field !== 'paragraph' ? null : row.kind === 'add' ? 'new paragraph' : index >= 0 ? `paragraph ${index + 1}` : 'paragraph'
  return { place: 'About page', part, kind: row.kind }
}
