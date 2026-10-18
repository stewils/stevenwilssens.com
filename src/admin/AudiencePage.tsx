import { RankedList } from './Charts'
import type { Stats } from './types'

export function AudiencePage({ stats }: { stats: Stats }) {
  return (
    <>
      <section className="card" data-part="Organizations">
        <div className="card-head"><h2>Organizations</h2></div>
        <p className="note">The network a visitor browsed from, which is often their employer. Home and mobile networks show as the provider.</p>
        <RankedList title="Visitors by organization" rows={stats.organizations} />
      </section>

      <section className="card" data-part="Places">
        <div className="card-head"><h2>Places</h2></div>
        <div className="grid">
          <RankedList title="Cities" rows={stats.cities} />
          <RankedList title="Countries" rows={stats.countries} />
        </div>
      </section>

      <section className="card" data-part="Devices">
        <div className="card-head"><h2>Devices and browsers</h2></div>
        <div className="grid">
          <RankedList title="Devices" rows={stats.devices} />
          <RankedList title="Operating systems" rows={stats.systems} />
          <RankedList title="Browsers" rows={stats.browsers} />
        </div>
      </section>

      <section className="card" data-part="Languages and screens">
        <div className="card-head"><h2>Languages and screens</h2></div>
        <div className="grid">
          <RankedList title="Languages" rows={stats.languages} />
          <RankedList title="Screen sizes" rows={stats.screens} />
        </div>
      </section>
    </>
  )
}
