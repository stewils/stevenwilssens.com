// Diagrams for the Building juniortrackcycling.com write-up, as plain SVG. Same conventions
// as the other write-ups: colours from the --d-* variables in article.css, and each
// <g data-part> is one part of a drawing that article.ts staggers in on scroll.

const ink = 'var(--d-ink)', quiet = 'var(--d-quiet)', edge = 'var(--d-edge)', accent = 'var(--d-accent)'
const good = 'var(--d-good)', bad = 'var(--d-bad)'

const Arrow = ({ id }: { id: string }) => <defs><marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={edge} /></marker></defs>

// The hub and the platform: static pages on Cloudflare, data in Supabase, analysis and the coach on Fly.io, and Claude apps over MCP.
export function ArchitectureDiagram() {
  const box = (x: number, y: number, w: number, h: number, main = false) => <rect x={x} y={y} width={w} height={h} rx="8" fill={main ? accent : 'none'} fillOpacity={main ? 0.12 : 1} stroke={main ? accent : edge} strokeWidth={main ? 2 : 1.25} />
  const lines = (x: number, y: number, items: string[]) => items.map((item, index) => <text key={item} x={x} y={y + index * 16} fontSize="11.5" fill={quiet}>{item}</text>)
  return <svg viewBox="0 0 760 384" role="img" aria-label="Riders, parents and coaches use the static hub and the app pages on Cloudflare Pages; the data, sign-in and storage are in Supabase; the analysis engine, the AI coach and the MCP server run on Fly.io; Claude apps reach the same data over MCP" fontSize="13"><Arrow id="jtc-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>One site, three modes: persuade, read, operate</text>
    <g data-part="">{box(24, 52, 356, 48)}<text x="202" y="72" textAnchor="middle" fontWeight="600" fill={ink}>Riders, parents, coaches</text><text x="202" y="90" textAnchor="middle" fontSize="11.5" fill={quiet}>in a browser</text></g>
    <g data-part="">{box(404, 52, 332, 48)}<text x="570" y="72" textAnchor="middle" fontWeight="600" fill={ink}>Claude apps over MCP</text><text x="570" y="90" textAnchor="middle" fontSize="11.5" fill={quiet}>18 read tools, 7 write tools with confirmation</text></g>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M202 100V140" markerEnd="url(#jtc-arrow)" /><path d="M570 100V140" markerEnd="url(#jtc-arrow)" /></g>
    <g data-part="">{box(24, 140, 356, 112, true)}<text x="40" y="164" fontWeight="600" fill={ink}>Cloudflare Pages</text>{lines(40, 184, ['Hub: guides, disciplines, gear, nationals, help', 'App: activities, clubs, coach, feed, admin', 'Functions: the launch gate and security headers', 'Static Astro output; islands only where needed'])}</g>
    <g data-part="">{box(404, 140, 332, 128)}<text x="420" y="164" fontWeight="600" fill={ink}>Fly.io: the analysis engine</text>{lines(420, 184, ['Python. Parses the files a bike computer writes,', 'segments velodrome efforts, classifies sessions,', 'computes power curves and training load', 'The AI coach, judged by a second model', 'The MCP server, mounted at /mcp'])}</g>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M202 252V292" markerEnd="url(#jtc-arrow)" /><path d="M380 196H404" markerEnd="url(#jtc-arrow)" /><path d="M570 268V328H380" markerEnd="url(#jtc-arrow)" /></g>
    <g data-part="">{box(24, 292, 356, 72)}<text x="40" y="316" fontWeight="600" fill={ink}>Supabase</text>{lines(40, 336, ['Postgres with row-level security on every table,', 'sign-in with Google and Apple, storage, functions'])}</g>
    <g data-part=""><text x="570" y="300" textAnchor="middle" fontSize="11.5" fill={quiet}>reads and writes the same data</text></g>
    <g data-part=""><text x="380" y="380" textAnchor="middle" fontSize="11.5" fill={quiet}>Domains stay at the registrar; nothing is hosted there. GitHub Actions deploys the site and the engine, each behind its own checks.</text></g>
  </svg>
}

// A ride's journey from upload to a plan, and the gate at every step where a minor is involved.
export function SafetyGatesDiagram() {
  const step = (x: number, label: string, note: string) => <g data-part=""><rect x={x} y="88" width="136" height="64" rx="8" fill="none" stroke={edge} strokeWidth="1.25" /><text x={x + 68} y="112" textAnchor="middle" fontWeight="600" fill={ink}>{label}</text><text x={x + 68} y="130" textAnchor="middle" fontSize="11" fill={quiet}>{note}</text></g>
  const gate = (x: number, label: string, note: string, more: string, tone = accent) => <g data-part=""><rect x={x} y="184" width="136" height="72" rx="8" fill={tone} fillOpacity="0.12" stroke={tone} strokeWidth="1.5" /><text x={x + 68} y="206" textAnchor="middle" fontSize="12" fontWeight="600" fill={ink}>{label}</text><text x={x + 68} y="224" textAnchor="middle" fontSize="11" fill={quiet}>{note}</text><text x={x + 68} y="240" textAnchor="middle" fontSize="11" fill={quiet}>{more}</text></g>
  return <svg viewBox="0 0 760 348" role="img" aria-label="From upload to plan, every step has a gate: consent before upload, the rider's review before the AI coach reads a ride, a safety judge on the coach's words, a guardian's signature for under-13s, and a signed confirmation and a notice to guardians before an app writes" fontSize="13"><Arrow id="gate-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>A ride’s journey, and the gate at every step</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M160 120H168" markerEnd="url(#gate-arrow)" /><path d="M304 120H312" markerEnd="url(#gate-arrow)" /><path d="M448 120H456" markerEnd="url(#gate-arrow)" /><path d="M592 120H600" markerEnd="url(#gate-arrow)" /></g>
    {step(24, 'Upload', 'file from the bike')}
    {step(168, 'Analysis', 'efforts, power, load')}
    {step(312, 'Review', 'labels and a debrief')}
    {step(456, 'AI coach', 'reads, then advises')}
    {step(600, 'Plan', 'the week ahead')}
    <g data-part="" fill="none" stroke={accent} strokeWidth="1.25" strokeDasharray="3 3"><path d="M92 152V184" /><path d="M236 152V184" /><path d="M380 152V184" /><path d="M524 152V184" /><path d="M668 152V184" /></g>
    {gate(24, 'Consent first', 'no upload, no analysis', 'without it')}
    {gate(168, 'No GPS leaves', 'payloads to apps', 'carry no location', good)}
    {gate(312, 'Rider review', 'labels confirmed,', 'effort rated, debrief')}
    {gate(456, 'Safety judge', 'a second model checks', 'the words, fails closed')}
    {gate(600, 'Two steps to write', 'a signed confirmation;', 'guardians are told')}
    <g data-part=""><rect x="24" y="276" width="712" height="56" rx="8" fill={bad} fillOpacity="0.08" stroke={bad} strokeDasharray="4 4" /><text x="40" y="298" fontSize="11.5" fill={quiet}>Under 13: the AI coach needs a guardian’s typed signature, separately from the consent to analyse.</text><text x="40" y="316" fontSize="11.5" fill={quiet}>A rider’s page is indexed by search engines only if the rider, with a guardian, opts in.</text></g>
  </svg>
}
