import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { DataTable, type Column } from './DataTable'

afterEach(cleanup)

type Org = { name: string; visitors: number | null; note: string }
const columns: Column<Org>[] = [
  { key: 'name', label: 'Organization', value: (row) => row.name, strong: true },
  { key: 'visitors', label: 'Visitors', value: (row) => row.visitors },
  { key: 'note', label: 'Note', value: (row) => row.note, render: (row) => <em>{row.note || 'none'}</em>, className: 'muted' },
]
const rows: Org[] = [
  { name: 'Microsoft', visitors: 1200, note: 'employer' },
  { name: 'Amazon', visitors: 30, note: '' },
  { name: 'Google', visitors: null, note: 'search' },
  { name: 'Contoso', visitors: 5, note: '' },
  { name: 'Fabrikam', visitors: 8, note: '' },
  { name: 'Northwind', visitors: 2, note: '' },
]
const names = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent)

describe('DataTable', () => {
  it('says when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(row) => row.name} empty="No organizations yet" />)
    expect(screen.getByText('No organizations yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('formats numbers, shows a dash for empty cells and renders custom cells', () => {
    render(<DataTable columns={columns} rows={rows.slice(0, 3)} rowKey={(row) => row.name} label="Organizations" />)
    const table = screen.getByRole('table', { name: 'Organizations' })
    expect(within(table).getByText('1,200')).toBeInTheDocument()
    expect(within(table).getByText('—')).toBeInTheDocument()
    expect(within(table).getAllByText('none')).toHaveLength(1)
    // Fewer than six rows: no search box.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(table).not.toHaveClass('stack')
  })

  it('sorts numbers high to low first, then low to high, then back to its own order; empty cells stay last', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.name} />)
    const header = screen.getByRole('button', { name: 'Visitors' })
    fireEvent.click(header)
    expect(names()).toEqual(['Microsoft', 'Amazon', 'Fabrikam', 'Contoso', 'Northwind', 'Google'])
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'descending')
    fireEvent.click(header)
    expect(names()).toEqual(['Northwind', 'Contoso', 'Fabrikam', 'Amazon', 'Microsoft', 'Google'])
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'ascending')
    fireEvent.click(header)
    expect(names()).toEqual(rows.map((row) => row.name))
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'none')
  })

  it('sorts text A to Z first', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.name} />)
    fireEvent.click(screen.getByRole('button', { name: 'Organization' }))
    expect(names()).toEqual(['Amazon', 'Contoso', 'Fabrikam', 'Google', 'Microsoft', 'Northwind'])
  })

  it('treats a column marked numeric as numbers even when its values are text', () => {
    const textNumbers: Column<Org>[] = [{ key: 'name', label: 'Name', value: (row) => row.name, num: true }]
    render(<DataTable columns={textNumbers} rows={rows.slice(0, 2)} rowKey={(row) => row.name} />)
    fireEvent.click(screen.getByRole('button', { name: 'Name' }))
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending')
    expect(screen.getAllByRole('cell')[0]).toHaveClass('num')
  })

  it('searches every word across the columns and counts what it shows', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.name} />)
    expect(screen.getByText('6 rows')).toBeInTheDocument()
    const search = screen.getByRole('searchbox', { name: 'Search this table' })
    fireEvent.change(search, { target: { value: 'micro employer' } })
    expect(names()).toEqual(['Microsoft'])
    expect(screen.getByText('1 of 6')).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'oracle' } })
    expect(screen.getAllByText('Nothing matches')).toHaveLength(2)
  })

  it('opens a detail row when a row is clicked, and closes it again', () => {
    const wide: Column<Org>[] = [...columns, { key: 'a', label: 'A', value: () => 'a' }, { key: 'b', label: 'B', value: () => 'b' }]
    render(<DataTable columns={wide} rows={rows.slice(0, 2)} rowKey={(row) => row.name} expand={(row) => <p>Details of {row.name}</p>} />)
    expect(screen.getByRole('table')).toHaveClass('stack')
    const row = screen.getByText('Amazon').closest('tr')!
    expect(row).toHaveClass('clickable')
    fireEvent.click(row)
    expect(screen.getByText('Details of Amazon')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Microsoft').closest('tr')!)
    expect(screen.queryByText('Details of Amazon')).not.toBeInTheDocument()
    expect(screen.getByText('Details of Microsoft')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Microsoft').closest('tr')!)
    expect(screen.queryByText('Details of Microsoft')).not.toBeInTheDocument()
  })

  it('opens and closes a detail row from the keyboard, with Enter and Space on its button', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} rows={rows.slice(0, 2)} rowKey={(row) => row.name} expand={(row) => <p>Details of {row.name}</p>} />)
    const first = screen.getByRole('button', { name: 'Open details for Microsoft' })
    const second = screen.getByRole('button', { name: 'Open details for Amazon' })
    expect(first).toHaveAttribute('aria-expanded', 'false')
    first.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByText('Details of Microsoft')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close details for Microsoft' })).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard(' ')
    expect(screen.queryByText('Details of Microsoft')).not.toBeInTheDocument()
    second.focus()
    await user.keyboard(' ')
    expect(screen.getByText('Details of Amazon')).toBeInTheDocument()
  })

  it('has no row buttons when rows do not open', () => {
    render(<DataTable columns={columns} rows={rows.slice(0, 2)} rowKey={(row) => row.name} />)
    expect(screen.queryByRole('button', { name: /details for/ })).not.toBeInTheDocument()
  })
})
