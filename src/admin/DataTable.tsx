import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { formatNumber } from './format'
import { countLabel, filterRows, nextSort, sortRows, type CellValue, type Sort } from './table'

// Every table on the dashboard: sortable by its headers, a search box once it has a few
// rows, and on phones one card per row with each value under its column's name. Rows
// can open a detail row (expand).
export type Column<T> = {
  key: string
  label: string
  // What the cell holds, for sorting and searching; shown as is unless render says otherwise.
  value: (row: T) => CellValue
  render?: (row: T) => ReactNode
  num?: boolean
  strong?: boolean
  className?: string
}

type Props<T> = { columns: Column<T>[]; rows: T[]; rowKey: (row: T, index: number) => string; empty?: string; label?: string; expand?: (row: T) => ReactNode }

// A search box from this many rows on; phones stack tables this wide into cards.
const SEARCH_FROM = 6
const STACK_FROM = 5

const classes = (...names: (string | false | undefined | null)[]) => names.filter(Boolean).join(' ') || undefined

export function DataTable<T>({ columns, rows, rowKey, empty = 'No data yet', label, expand }: Props<T>) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>(null)
  const [open, setOpen] = useState<string | null>(null)
  const shown = useMemo(() => {
    const filtered = filterRows(rows, (row) => columns.map((column) => String(column.value(row) ?? '')).join(' '), query)
    const column = sort ? columns.find((item) => item.key === sort.key) : undefined
    return column && sort ? sortRows(filtered, column.value, sort.direction) : filtered
  }, [rows, columns, query, sort])
  if (rows.length === 0) return <p className="empty">{empty}</p>
  // Numbers sort high to low first, text A to Z.
  const numeric = (column: Column<T>) => column.num || rows.some((row) => typeof column.value(row) === 'number')
  return (
    <>
      {rows.length >= SEARCH_FROM && (
        <div className="tbl-tools">
          <label className="tbl-search"><span className="visually-hidden">Search this table</span><input type="search" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <span className="tbl-count" aria-live="polite">{countLabel(rows.length, shown.length, query)}</span>
        </div>
      )}
      <div className="table-scroll">
        <table className={classes('data', columns.length >= STACK_FROM && 'stack')} aria-label={label}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={classes(column.num && 'num', 'sortable')} aria-sort={sort?.key === column.key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => setSort((current) => nextSort(current, column.key, numeric(column)))}>{column.label}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={columns.length} className="muted">Nothing matches</td></tr>}
            {shown.map((row, index) => {
              const key = rowKey(row, index)
              const isOpen = open === key
              return (
                <Fragment key={key}>
                  <tr className={classes(expand && 'clickable')} onClick={expand ? () => setOpen(isOpen ? null : key) : undefined}>
                    {columns.map((column) => {
                      const value = column.value(row)
                      return (
                        <td key={column.key} data-label={column.label} className={classes(column.num && 'num', column.strong && 'strong', column.className)}>
                          {column.render ? column.render(row) : typeof value === 'number' ? formatNumber(value) : value || '—'}
                        </td>
                      )
                    })}
                  </tr>
                  {expand && isOpen && <tr className="detail"><td colSpan={columns.length}>{expand(row)}</td></tr>}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
