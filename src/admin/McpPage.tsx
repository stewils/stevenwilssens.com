import { useState } from 'react'
import { formatNumber } from './format'
import type { McpInfo } from './types'

// The private MCP server at /mcp/<key>: the link to add to Claude and the size of
// the dossier. The résumé proposals it produces are on the Résumé page.
export function McpPage({ info }: { info: McpInfo }) {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const copy = (url: string) => { void navigator.clipboard?.writeText(url).then(() => setCopied(true)) }
  const masked = (url: string) => url.replace(/\/mcp\/.+$/, '/mcp/' + '•'.repeat(12))
  return (
    <>
      <section className="card" data-part="Connect">
        <div className="card-head"><h2>Your career MCP</h2></div>
        <p className="note">A private MCP server for talking through your career with Claude. It reads what is already on the site and in the dossier, interviews you where there are gaps, saves what you say, reviews the site the way a recruiter would, and proposes résumé edits for you to approve or reject. Add it in Claude under Settings → Connectors → Add custom connector (no sign-in step), or in Claude Code with <code>claude mcp add --transport http my-career &lt;link&gt;</code>. The key in the link is the <code>MCP_OWNER_KEY</code> secret: anyone with it can read and change the dossier, so keep it to yourself.</p>
        <ul className="links">
          <li>
            <div><strong>Owner link</strong><small>Only you. Rotate it by setting a new MCP_OWNER_KEY secret and redeploying.</small><code>{info.ownerUrl ? (revealed ? info.ownerUrl : masked(info.ownerUrl)) : 'Not configured: set the MCP_OWNER_KEY secret and redeploy.'}</code></div>
            {info.ownerUrl && <span className="actions"><button type="button" className="ghost" onClick={() => setRevealed((value) => !value)}>{revealed ? 'Hide' : 'Reveal'}</button><button type="button" className="ghost" onClick={() => copy(info.ownerUrl!)}>{copied ? 'Copied' : 'Copy'}</button></span>}
          </li>
        </ul>
      </section>

      <section className="card" data-part="Dossier">
        <div className="card-head"><h2>The dossier</h2></div>
        <p className="note">The facts and stories behind the résumé, saved during your sessions. Public entries may be used by the assistant on the site; everything else stays private.</p>
        <div className="stats">
          <div><span>Entries</span><strong>{formatNumber(info.entries.total)}</strong><small>saved from your sessions</small></div>
          <div><span>Roles covered</span><strong>{formatNumber(info.entries.roles)}</strong><small>with at least one entry</small></div>
          <div className="highlight"><span>Public</span><strong>{formatNumber(info.entries.public)}</strong><small>usable by the assistant on the site</small></div>
        </div>
        <p className="note" style={{ margin: 0 }}>Say "export" in a session for the whole dossier, "make 12 public" to open one entry up, or start with interview_status to see the gaps and what the site's visitors asked that it could not answer.</p>
      </section>
    </>
  )
}
