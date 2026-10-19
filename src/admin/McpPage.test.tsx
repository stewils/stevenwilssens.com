import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeMcp } from './fixtures'
import { McpPage } from './McpPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const item = (name: string) => screen.getByText(name).closest('li')!

describe('Career MCP page', () => {
  it('masks the owner link until revealed', () => {
    render(<McpPage info={makeMcp()} />)
    const owner = within(item('Owner link'))
    expect(owner.getByText(`https://steven.wilssens.com/mcp/${'•'.repeat(12)}`)).toBeInTheDocument()
    fireEvent.click(owner.getByRole('button', { name: 'Reveal' }))
    expect(owner.getByText('https://steven.wilssens.com/mcp/secret-owner-key')).toBeInTheDocument()
    fireEvent.click(owner.getByRole('button', { name: 'Hide' }))
    expect(owner.queryByText('https://steven.wilssens.com/mcp/secret-owner-key')).not.toBeInTheDocument()
  })

  it('copies the owner and the public links', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<McpPage info={makeMcp()} />)
    await act(async () => { fireEvent.click(within(item('Owner link')).getByRole('button', { name: 'Copy' })) })
    expect(writeText).toHaveBeenCalledWith('https://steven.wilssens.com/mcp/secret-owner-key')
    expect(within(item('Owner link')).getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    const publicLink = within(item("Public link, for recruiters' assistants"))
    await act(async () => { fireEvent.click(publicLink.getByRole('button', { name: 'Copy' })) })
    expect(publicLink.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(within(item('Owner link')).getByRole('button', { name: 'Copy' })).toBeInTheDocument()
    expect(publicLink.getByRole('link', { name: 'Open' })).toHaveAttribute('href', 'https://steven.wilssens.com/mcp')
  })

  it('says how to set the owner key when there is none', () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    render(<McpPage info={makeMcp({ ownerUrl: null })} />)
    expect(screen.getByText('Not configured: set the MCP_OWNER_KEY secret and redeploy.')).toBeInTheDocument()
    expect(within(item('Owner link')).queryByRole('button')).not.toBeInTheDocument()
    // No clipboard: the button stays as it was.
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('shows the dossier and who calls the public server', () => {
    render(<McpPage info={makeMcp()} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('job descriptions compared')).toBeInTheDocument()
    const calls = within(screen.getByRole('table', { name: 'Public MCP calls' }))
    expect(calls.getByText('Senior PM, data platform')).toBeInTheDocument()
    expect(calls.getByText('Amazon, US')).toBeInTheDocument()
    expect(calls.getAllByText('—')).toHaveLength(2)
  })

  it('says when nobody connected yet', () => {
    render(<McpPage info={makeMcp({ publicCalls: { days: 7, total: 0, byTool: [], recent: [] } })} />)
    expect(screen.getByText(/Nobody has connected yet/)).toBeInTheDocument()
    expect(screen.getAllByText('last 7 days')).toHaveLength(1)
  })
})
