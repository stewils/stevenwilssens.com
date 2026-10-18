import { describe, expect, it } from 'vitest'
import { compareCells, countLabel, filterRows, matchesQuery, nextSort, sortRows } from './table'

describe('table sorting', () => {
  it('puts numbers in order, text alphabetically, and empty cells last whichever way', () => {
    const rows = [{ n: 3, s: 'b' }, { n: null, s: '—' }, { n: 1, s: 'A' }, { n: 2, s: 'c' }]
    expect(sortRows(rows, (r) => r.n, 1).map((r) => r.n)).toEqual([1, 2, 3, null])
    expect(sortRows(rows, (r) => r.n, -1).map((r) => r.n)).toEqual([3, 2, 1, null])
    expect(sortRows(rows, (r) => r.s, 1).map((r) => r.s)).toEqual(['A', 'b', 'c', '—'])
    expect(sortRows(rows, (r) => r.s, -1).map((r) => r.s)).toEqual(['c', 'b', 'A', '—'])
  })

  it('keeps the original order of rows that compare equal', () => {
    const rows = [{ id: 'first', v: 1 }, { id: 'second', v: 1 }, { id: 'third', v: 0 }]
    expect(sortRows(rows, (r) => r.v, -1).map((r) => r.id)).toEqual(['first', 'second', 'third'])
  })

  it('sorts numbers before text and version-like strings numerically', () => {
    expect(compareCells(2, 'a')).toBeLessThan(0)
    expect(compareCells('Chrome 9', 'Chrome 10')).toBeLessThan(0)
  })

  it('cycles a column from its natural direction, to the reverse, to unsorted', () => {
    expect(nextSort(null, 'views', true)).toEqual({ key: 'views', direction: -1 })
    expect(nextSort({ key: 'views', direction: -1 }, 'views', true)).toEqual({ key: 'views', direction: 1 })
    expect(nextSort({ key: 'views', direction: 1 }, 'views', true)).toBeNull()
    expect(nextSort(null, 'name', false)).toEqual({ key: 'name', direction: 1 })
    expect(nextSort({ key: 'views', direction: -1 }, 'name', false)).toEqual({ key: 'name', direction: 1 })
  })
})

describe('table search', () => {
  it('matches when every word appears, ignoring case', () => {
    expect(matchesQuery('Microsoft · Redmond, WA', 'redmond micro')).toBe(true)
    expect(matchesQuery('Microsoft · Redmond, WA', 'redmond google')).toBe(false)
    expect(filterRows([{ t: 'a b' }, { t: 'c' }], (r) => r.t, ' ')).toHaveLength(2)
    expect(filterRows([{ t: 'a b' }, { t: 'c' }], (r) => r.t, 'b')).toEqual([{ t: 'a b' }])
  })

  it('describes the count the way the search box shows it', () => {
    expect(countLabel(1, 1, '')).toBe('1 row')
    expect(countLabel(12, 12, '')).toBe('12 rows')
    expect(countLabel(12, 3, 'x')).toBe('3 of 12')
    expect(countLabel(12, 0, 'zzz')).toBe('Nothing matches')
  })
})
