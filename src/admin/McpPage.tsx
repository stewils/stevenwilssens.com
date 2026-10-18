import { useState } from 'react'
import { DataTable, type Column } from './DataTable'
import { formatNumber, formatTime } from './format'
import type { McpInfo, PublicCall } from './types'

const callColumns: Column<PublicCall>[] = [
  { key: 'ts', label: 'When', value: (row) => row.ts, render: (row) => formatTime(row.ts) },
  { key: 'tool', label: 'Tool', value: (row) => row.tool, render: (row) => <code>{row.tool}</code> },
  { key: 'query', label: 'Query', value: (row) => row.query ?? '', strong: true },
  { key: 'network', label: 'Network', value: (row) => [row.asOrg, row.country].filter(Boolean).join(', ') },
]

// The MCP server: the private link for Steven's own sessions and the dossier it keeps,
// and the public read-only server at /mcp that recruiters' assistants can connect to,
// with who has been calling it. The résumé proposals it produces are on the Résumé page.
export function McpPage({ info }: { info: McpInfo }) {
  const [copied, setCopied] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const copy = (url: string) => { void navigator.clipboard?.writeText(url).then(() => setCopied(url)) }
  const masked = (url: string) => url.replace(/\/mcp\/.+$/, '/mcp/' + '•'.repeat(12))
  const calls = info.publicCalls
  return (
    <>
      <section className="card" data-part="Connect">
        <div className="card-head"><h2>Your career MCP</h2></div>
        <p className="note">A private MCP server for talking through your career with Claude. It reads what is already on the site and in the dossier, interviews you where there are gaps, saves what you say, reviews the site the way a recruiter would, answers the questions the site's assistant could not (it tells you how many wait when a session starts), and proposes résumé edits for you to approve or reject. Add it in Claude under Settings → Connectors → Add custom connector (no sign-in step), or in Claude Code with <code>claude mcp add --transport http my-career &lt;link&gt;</code>. The key in the link is the <code>MCP_OWNER_KEY</code> secret: anyone with it can read and change the dossier, so keep it to yourself.</p>
        <ul className="links">
          <li>
            <div><strong>Owner link</strong><small>Only you. Rotate it by setting a new MCP_OWNER_KEY secret and redeploying.</small><code>{info.ownerUrl ? (revealed ? info.ownerUrl : masked(info.ownerUrl)) : 'Not configured: set the MCP_OWNER_KEY secret and redeploy.'}</code></div>
            {info.ownerUrl && <span className="actions"><button type="button" className="ghost" onClick={() => setRevealed((value) => !value)}>{revealed ? 'Hide' : 'Reveal'}</button><button type="button" className="ghost" onClick={() => copy(info.ownerUrl!)}>{copied === info.ownerUrl ? 'Copied' : 'Copy'}</button></span>}
          </li>
          <li>
            <div><strong>Public link, for recruiters' assistants</strong><small>Read-only: the résumé, roles, recommendations, patents, your public notes and a fit check. Nothing private, nothing writable. Share it freely; it is also in llms.txt.</small><code>{info.publicUrl}</code></div>
            <span className="actions"><a className="ghost" href={info.publicUrl} target="_blank" rel="noreferrer">Open</a><button type="button" className="ghost" onClick={() => copy(info.publicUrl)}>{copied === info.publicUrl ? 'Copied' : 'Copy'}</button></span>
          </li>
        </ul>
      </section>

      <section className="card" data-part="Dossier">
        <div className="card-head"><h2>The dossier</h2></div>
        <p className="note">The facts and stories behind the résumé, saved during your sessions. Public entries may be used by the assistant on the site and read through the public server; everything else stays private.</p>
        <div className="stats">
          <div><span>Entries</span><strong>{formatNumber(info.entries.total)}</strong><small>saved from your sessions</small></div>
          <div><span>Roles covered</span><strong>{formatNumber(info.entries.roles)}</strong><small>with at least one entry</small></div>
          <div className="highlight"><span>Public</span><strong>{formatNumber(info.entries.public)}</strong><small>usable by the assistant on the site</small></div>
        </div>
        <p className="note" style={{ margin: 0 }}>Say "export" in a session for the whole dossier, "make 12 public" to open one entry up, "what is waiting from the site" for the questions recruiters asked that the assistant could not answer, or start with interview_status to see the gaps.</p>
      </section>

      <section className="card" data-part="Public server">
        <div className="card-head"><h2>Who connects to the public server</h2></div>
        <p className="note">Every call to the read-only server at <code>/mcp</code> in the last {calls.days} days: the tool, the query it carried (a search, a role key, the first words of a job description) and the network it came from. No IP addresses are kept. An AI assistant that reads the site this way is a recruiter who did not have to.</p>
        <div className="stats">
          <div className="highlight"><span>Calls</span><strong>{formatNumber(calls.total)}</strong><small>last {calls.days} days</small></div>
          {calls.byTool.slice(0, 5).map((row) => <div key={row.tool}><span><code>{row.tool}</code></span><strong>{formatNumber(row.calls)}</strong><small>{row.tool === 'check_fit' ? 'job descriptions compared' : 'calls'}</small></div>)}
        </div>
        <DataTable columns={callColumns} rows={calls.recent} rowKey={(row) => `${row.ts}-${row.tool}`} empty="Nobody has connected yet. The link is on this page, in llms.txt and in the Building steven.wilssens.com write-up." label="Public MCP calls" />
      </section>
    </>
  )
}
