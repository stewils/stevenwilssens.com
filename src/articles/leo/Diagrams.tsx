// Diagrams for the Building leo.wilssens.com write-up, as plain SVG. Same conventions
// as the other write-ups: colours from the --d-* variables in article.css, and each
// <g data-part> is one part of a drawing that article.ts staggers in on scroll.

const ink = 'var(--d-ink)', quiet = 'var(--d-quiet)', edge = 'var(--d-edge)', grid = 'var(--d-grid)', accent = 'var(--d-accent)'
const good = 'var(--d-good)', bad = 'var(--d-bad)'

const Arrow = ({ id }: { id: string }) => <defs><marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={edge} /></marker></defs>

// What reaches the page, what is filtered on the way, and what never enters the build.
export function PublishRulesDiagram() {
  const input = (y: number, label: string, note: string) => <g data-part=""><rect x="24" y={y} width="176" height="44" rx="8" fill="none" stroke={edge} strokeWidth="1.25" /><text x="40" y={y + 19} fontWeight="600" fill={ink}>{label}</text><text x="40" y={y + 35} fontSize="11.5" fill={quiet}>{note}</text></g>
  const filter = (y: number, label: string, note: string) => <g data-part=""><rect x="272" y={y} width="232" height="44" rx="8" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="1.5" /><text x="288" y={y + 19} fontWeight="600" fill={ink}>{label}</text><text x="288" y={y + 35} fontSize="11.5" fill={quiet}>{note}</text></g>
  return <svg viewBox="0 0 760 412" role="img" aria-label="Results, race reports, photos, velodrome rides and approved posts pass through filters into the static site; school, home town, schedule, location and road rides never enter the build" fontSize="13"><Arrow id="pub-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>What reaches the page, and what never enters the build</text>
    {input(56, 'Results', 'real ones only, never rounded')}
    {input(108, 'Race reports', 'written after the event')}
    {input(160, 'Rides', 'from the training platform')}
    {input(212, 'Photos and video', 'action shots, ride media')}
    {input(264, 'Instagram posts', 'synced by a Worker')}
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M200 78H236V286H200" /><path d="M236 182H272" markerEnd="url(#pub-arrow)" /></g>
    {filter(96, 'Surface filter', 'velodrome and trainer rides only')}
    {filter(148, 'Day precision', 'dates, never times or places')}
    {filter(200, 'Metadata strip', 'EXIF, XMP, video location boxes')}
    {filter(252, 'Guardian approval', 'posts wait for a parent to approve')}
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M504 118H532V274H504" /><path d="M532 196H560" markerEnd="url(#pub-arrow)" /></g>
    <g data-part=""><rect x="560" y="160" width="176" height="72" rx="10" fill={good} fillOpacity="0.12" stroke={good} strokeWidth="2" /><text x="648" y="190" textAnchor="middle" fontWeight="600" fill={ink}>leo.wilssens.com</text><text x="648" y="210" textAnchor="middle" fontSize="11.5" fill={quiet}>static pages, one contact route</text></g>
    <g data-part=""><text x="380" y="330" textAnchor="middle" fontSize="11.5" fill={quiet}>The filters live in the data selection and the build, not in the templates: a page cannot show what the build never received.</text></g>
    <g data-part=""><rect x="24" y="352" width="712" height="44" rx="8" fill={bad} fillOpacity="0.08" stroke={bad} strokeDasharray="4 4" /><text x="40" y="371" fontWeight="600" fill={ink}>Never in the build</text><text x="40" y="387" fontSize="11.5" fill={quiet}>school · home town · training schedule · weekly calendar · real-time or exact location · road rides · any way to reach Leo directly</text></g>
  </svg>
}

// Content and data go through one build into static files; the only server code sits behind a proxy.
export function BuildFlowDiagram() {
  const box = (x: number, y: number, w: number, h: number, main = false) => <rect x={x} y={y} width={w} height={h} rx="8" fill={main ? accent : 'none'} fillOpacity={main ? 0.12 : 1} stroke={main ? accent : edge} strokeWidth={main ? 2 : 1.25} />
  return <svg viewBox="0 0 760 356" role="img" aria-label="Markdown content, athlete data and the training platform's API go through the Astro build into static files on Cloudflare Pages; a Worker with a database sits behind a same-origin proxy for scores, analytics and posts; a push to main is verified before the deploy, which refuses to run without its secrets" fontSize="13"><Arrow id="flow-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>One build, static output, one small server behind a proxy</text>
    <g data-part="">{box(24, 56, 168, 48)}<text x="108" y="76" textAnchor="middle" fontWeight="600" fill={ink}>Markdown collections</text><text x="108" y="94" textAnchor="middle" fontSize="11.5" fill={quiet}>palmares · stories · albums</text></g>
    <g data-part="">{box(24, 116, 168, 48)}<text x="108" y="136" textAnchor="middle" fontWeight="600" fill={ink}>Athlete data</text><text x="108" y="154" textAnchor="middle" fontSize="11.5" fill={quiet}>facts, bike, photos, nav</text></g>
    <g data-part="">{box(24, 176, 168, 48)}<text x="108" y="196" textAnchor="middle" fontWeight="600" fill={ink}>Training platform API</text><text x="108" y="214" textAnchor="middle" fontSize="11.5" fill={quiet}>rides and ride media</text></g>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M192 80H232V200H192" /><path d="M232 140H272" markerEnd="url(#flow-arrow)" /></g>
    <g data-part="">{box(272, 96, 200, 88, true)}<text x="372" y="120" textAnchor="middle" fontWeight="600" fill={ink}>Astro build</text><text x="372" y="140" textAnchor="middle" fontSize="11.5" fill={quiet}>static output, no islands</text><text x="372" y="156" textAnchor="middle" fontSize="11.5" fill={quiet}>strips media metadata</text><text x="372" y="172" textAnchor="middle" fontSize="11.5" fill={quiet}>scripts hashed into the CSP</text></g>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M472 140H520" markerEnd="url(#flow-arrow)" /></g>
    <g data-part="">{box(520, 96, 216, 88)}<text x="628" y="120" textAnchor="middle" fontWeight="600" fill={ink}>Cloudflare Pages</text><text x="628" y="140" textAnchor="middle" fontSize="11.5" fill={quiet}>static files at leo.wilssens.com</text><text x="628" y="156" textAnchor="middle" fontSize="11.5" fill={quiet}>Functions proxy /api and /media</text><text x="628" y="172" textAnchor="middle" fontSize="11.5" fill={quiet}>to the Worker, same origin</text></g>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M628 184V220" markerEnd="url(#flow-arrow)" /></g>
    <g data-part="">{box(520, 220, 216, 64)}<text x="628" y="242" textAnchor="middle" fontWeight="600" fill={ink}>Worker + D1 + KV</text><text x="628" y="258" textAnchor="middle" fontSize="11.5" fill={quiet}>scores, records, analytics</text><text x="628" y="274" textAnchor="middle" fontSize="11.5" fill={quiet}>posts awaiting approval</text></g>
    <g data-part=""><rect x="24" y="244" width="448" height="40" rx="8" fill="none" stroke={grid} strokeDasharray="4 4" /><text x="40" y="261" fontSize="12" fontWeight="600" fill={ink}>Deploy</text><text x="40" y="277" fontSize="11.5" fill={quiet}>push → type check → build → tests → deploy, refused without its secrets</text></g>
    <g data-part=""><text x="380" y="330" textAnchor="middle" fontSize="11.5" fill={quiet}>The type check is a separate step because the Astro build ignores type errors. Nothing deploys that did not pass it.</text></g>
  </svg>
}
