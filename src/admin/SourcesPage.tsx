import { useState } from 'react'
import { RankedList } from './Charts'
import type { Stats } from './types'

const trackingLinks = [
  ['Résumé', 'https://steven.wilssens.com/?ref=resume', 'Link from the résumé PDF'],
  ['LinkedIn', 'https://steven.wilssens.com/?ref=linkedin', 'Profile website field, Featured section, posts'],
  ['Email', 'https://steven.wilssens.com/?ref=email', 'Email signature and messages'],
] as const

function TrackingLinks() {
  const [copied, setCopied] = useState('')
  const copy = (url: string) => { void navigator.clipboard?.writeText(url).then(() => setCopied(url)) }
  return (
    <ul className="links">
      {trackingLinks.map(([name, url, where]) => (
        <li key={name}>
          <div><strong>{name}</strong><small>{where}</small><code>{url}</code></div>
          <button type="button" className="ghost" onClick={() => copy(url)}>{copied === url ? 'Copied' : 'Copy'}</button>
        </li>
      ))}
    </ul>
  )
}

export function SourcesPage({ stats }: { stats: Stats }) {
  return (
    <>
      <section className="card" data-part="Channels">
        <div className="card-head"><h2>Channels</h2></div>
        <p className="note">Credited to each visitor's first pageview, so moving between pages never counts as direct traffic.</p>
        <RankedList title="Visitors by channel" rows={stats.channels} />
      </section>

      <section className="card" data-part="Tracking links">
        <div className="card-head"><h2>Your tracking links</h2></div>
        <p className="note">Use these so visits are credited to the right channel. PDFs, email apps and the LinkedIn app usually do not say where a visitor came from.</p>
        <TrackingLinks />
      </section>

      <section className="card" data-part="Referrers and campaigns">
        <div className="card-head"><h2>Referrers and campaigns</h2></div>
        <div className="grid">
          <RankedList title="Referrers" rows={stats.referrers} />
          <RankedList title="Sources (utm_source / ref)" rows={stats.utmSources} />
          <RankedList title="Campaigns (utm_campaign)" rows={stats.utmCampaigns} />
          <RankedList title="Entry pages" rows={stats.entryPages} />
        </div>
      </section>
    </>
  )
}
