// Sorting, searching and counting for the dashboard's tables (DataTable.tsx), kept pure
// so they can be tested without a browser. Empty cells ('', null, undefined) sort last
// whichever way the column is sorted; numbers before text.

export type CellValue = string | number | null | undefined

const empty = (value: CellValue) => value === null || value === undefined || value === '' || value === '—'

export const compareCells = (a: CellValue, b: CellValue): number => {
  if (empty(a) || empty(b)) return empty(a) === empty(b) ? 0 : empty(a) ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'number') return -1
  if (typeof b === 'number') return 1
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

// A stable sort: rows that compare equal keep their order, and empty cells stay last.
export const sortRows = <T>(rows: T[], value: (row: T) => CellValue, direction: 1 | -1): T[] =>
  rows
    .map((row, index) => ({ row, index, cell: value(row) }))
    .sort((a, b) => {
      const order = compareCells(a.cell, b.cell)
      if (empty(a.cell) || empty(b.cell)) return order || a.index - b.index
      return order * direction || a.index - b.index
    })
    .map((item) => item.row)

// Every word of the query must appear somewhere in the row's text.
export const matchesQuery = (text: string, query: string) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const haystack = text.toLowerCase()
  return words.every((word) => haystack.includes(word))
}

export const filterRows = <T>(rows: T[], text: (row: T) => string, query: string): T[] => (query.trim() ? rows.filter((row) => matchesQuery(text(row), query)) : rows)

export const countLabel = (total: number, shown: number, query: string) => {
  if (!query.trim()) return `${total} ${total === 1 ? 'row' : 'rows'}`
  return shown ? `${shown} of ${total}` : 'Nothing matches'
}

// The next sort state after a click on a column header: numbers start high to low,
// text A to Z; a second click flips; a third returns to the table's own order.
export type Sort = { key: string; direction: 1 | -1 } | null
export const nextSort = (current: Sort, key: string, numeric: boolean): Sort => {
  const first: 1 | -1 = numeric ? -1 : 1
  if (current?.key !== key) return { key, direction: first }
  return current.direction === first ? { key, direction: first === 1 ? -1 : 1 } : null
}
