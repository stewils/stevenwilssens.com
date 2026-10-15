// The article's diagrams as plain SVG. Colours come from CSS variables
// (--d-ink, --d-quiet, --d-edge, --d-grid, --d-accent, --d-good, --d-warn, --d-bad,
// --d-tint), set in article.css for both themes. Each <g data-part> is one part of
// a drawing; article.ts staggers them in when the figure scrolls into view.

const ink = 'var(--d-ink)', quiet = 'var(--d-quiet)', edge = 'var(--d-edge)', grid = 'var(--d-grid)', accent = 'var(--d-accent)'
const good = 'var(--d-good)', warn = 'var(--d-warn)', bad = 'var(--d-bad)', tint = 'var(--d-tint)'

const Arrow = ({ id }: { id: string }) => <defs><marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={edge} /></marker></defs>

export function ArchitectureDiagram() {
  const tb = (x: number) => <rect x={x} y="52" width="160" height="48" rx="8" fill="none" stroke={edge} strokeWidth="1.25" />
  const sb = (x: number) => <rect x={x} y="280" width="128" height="56" rx="8" fill="none" stroke={edge} strokeWidth="1.25" />
  return <svg viewBox="0 0 760 360" role="img" aria-label="Two front doors share one set of services" fontSize="13"><Arrow id="arch-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>Two front doors share one set of services</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M104 100V148" markerEnd="url(#arch-arrow)" /><path d="M288 100V148" markerEnd="url(#arch-arrow)" /><path d="M472 100V148" markerEnd="url(#arch-arrow)" /><path d="M656 100V148" markerEnd="url(#arch-arrow)" /><path d="M288 220V252" /><path d="M656 220V252" /><path d="M88 252H672" /><path d="M88 252V280" markerEnd="url(#arch-arrow)" /><path d="M234 252V280" markerEnd="url(#arch-arrow)" /><path d="M380 252V280" markerEnd="url(#arch-arrow)" /><path d="M526 252V280" markerEnd="url(#arch-arrow)" /><path d="M672 252V280" markerEnd="url(#arch-arrow)" /></g>
    <g data-part="">{tb(24)}<text x="104" y="80" textAnchor="middle" fill={ink}>Family members</text></g>
    <g data-part="">{tb(208)}<text x="288" y="80" textAnchor="middle" fill={ink}>AI apps over MCP</text></g>
    <g data-part="">{tb(392)}<text x="472" y="80" textAnchor="middle" fill={ink}>Command lines, GitHub</text></g>
    <g data-part="">{tb(576)}<text x="656" y="80" textAnchor="middle" fill={ink}>Site visitors</text></g>
    <g data-part=""><rect x="24" y="148" width="528" height="72" rx="8" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="2" /><text x="40" y="172" fontWeight="600" fill={ink}>www.wilssens.com</text><text x="40" y="190" fontSize="11.5" fill={quiet}>Astro pages in English, Flemish and French</text><text x="40" y="206" fontSize="11.5" fill={quiet}>One Pages Function: search, requests, sign-in, accounts, admin, MCP</text></g>
    <g data-part=""><rect x="576" y="148" width="160" height="72" rx="8" fill="none" stroke={edge} strokeWidth="1.25" /><text x="592" y="172" fontWeight="600" fill={ink}>name.wilssens.com</text><text x="592" y="190" fontSize="11.5" fill={quiet}>Every family site</text><text x="592" y="206" fontSize="11.5" fill={quiet}>static + server code</text></g>
    <g data-part="">{sb(24)}<text x="88" y="304" textAnchor="middle" fontWeight="600" fill={ink}>D1 database</text><text x="88" y="322" textAnchor="middle" fontSize="11.5" fill={quiet}>requests, names</text></g>
    <g data-part="">{sb(170)}<text x="234" y="304" textAnchor="middle" fontWeight="600" fill={ink}>R2 storage</text><text x="234" y="322" textAnchor="middle" fontSize="11.5" fill={quiet}>site versions</text></g>
    <g data-part="">{sb(316)}<text x="380" y="304" textAnchor="middle" fontWeight="600" fill={ink}>Site Workers</text><text x="380" y="322" textAnchor="middle" fontSize="11.5" fill={quiet}>own code + DB</text></g>
    <g data-part="">{sb(462)}<text x="526" y="304" textAnchor="middle" fontWeight="600" fill={ink}>Zoho Mail</text><text x="526" y="322" textAnchor="middle" fontSize="11.5" fill={quiet}>mailboxes, mail</text></g>
    <g data-part="">{sb(608)}<text x="672" y="304" textAnchor="middle" fontWeight="600" fill={ink}>Stripe</text><text x="672" y="322" textAnchor="middle" fontSize="11.5" fill={quiet}>payments (off)</text></g>
  </svg>
}

export function LifecycleDiagram() {
  const box = (x: number, main: boolean) => <rect x={x} y="122" width="120" height="56" rx="8" fill={main ? accent : 'none'} fillOpacity={main ? 0.12 : 1} stroke={main ? accent : edge} strokeWidth={main ? 2 : 1.25} />
  return <svg viewBox="0 0 760 272" role="img" aria-label="A name returns to the pool only after 24 months of quarantine" fontSize="13"><Arrow id="life-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>A name returns to the pool only after 24 months of quarantine</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M144 150H221" markerEnd="url(#life-arrow)" /><path d="M341 150H418" markerEnd="url(#life-arrow)" /><path d="M538 150H615" markerEnd="url(#life-arrow)" /><path d="M675 122V90H478V122" markerEnd="url(#life-arrow)" /><path d="M675 178V222H84V178" markerEnd="url(#life-arrow)" /></g>
    <g data-part="">{box(24, false)}<text x="84" y="146" textAnchor="middle" fontWeight="600" fill={ink}>Free</text><text x="84" y="164" textAnchor="middle" fontSize="11.5" fill={quiet}>anyone may ask</text></g>
    <g data-part="">{box(221, false)}<text x="281" y="146" textAnchor="middle" fontWeight="600" fill={ink}>Requested</text><text x="281" y="164" textAnchor="middle" fontSize="11.5" fill={quiet}>backups queue</text></g>
    <g data-part="">{box(418, false)}<text x="478" y="146" textAnchor="middle" fontWeight="600" fill={ink}>Owned</text><text x="478" y="164" textAnchor="middle" fontSize="11.5" fill={quiet}>by the person</text></g>
    <g data-part="">{box(615, true)}<text x="675" y="146" textAnchor="middle" fontWeight="600" fill={ink}>Quarantine</text><text x="675" y="164" textAnchor="middle" fontSize="11.5" fill={quiet}>mail bounces</text></g>
    <g data-part="" fontSize="11.5" fill={quiet} textAnchor="middle"><text x="182" y="140">request</text><text x="379" y="126">approve</text><text x="379" y="140">or pay</text><text x="576" y="126">all services</text><text x="576" y="140">deleted</text><text x="576" y="80">only the owner can set it up again</text><text x="380" y="244">after 24 months, and never with the old mail or settings</text></g>
  </svg>
}

export function MailBeforeAfterDiagram() {
  return <svg viewBox="0 0 760 252" role="img" aria-label="Mail moved from per-person plans to one automated organization" fontSize="13"><Arrow id="ba-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>Mail moved from per-person plans to one automated organization</text>
    <g data-part=""><rect x="24" y="52" width="340" height="176" rx="8" fill="none" stroke={edge} strokeWidth="1.25" /><text x="40" y="80" fontSize="14" fontWeight="600" fill={ink}>Before: GoDaddy, Microsoft 365</text><line x1="40" y1="96" x2="348" y2="96" stroke={grid} /><text x="40" y="124" fill={quiet}>A paid plan per person, plus add-ons</text><text x="40" y="150" fill={quiet}>Each mailbox set up by hand</text><text x="40" y="176" fill={quiet}>Every question came to me</text><text x="40" y="202" fill={quiet}>No single view of what works</text></g>
    <path data-part="" d="M364 140H394" fill="none" stroke={edge} strokeWidth="1.25" markerEnd="url(#ba-arrow)" />
    <g data-part=""><rect x="396" y="52" width="340" height="176" rx="8" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="2" /><text x="412" y="80" fontSize="14" fontWeight="600" fill={ink}>Now: Zoho, automated</text><line x1="412" y1="96" x2="720" y2="96" stroke={grid} /><text x="412" y="124" fill={ink}>One organization for the whole domain</text><text x="412" y="150" fill={ink}>Approve, and a mailbox is ready in minutes</text><text x="412" y="176" fill={ink}>The help assistant answers first</text><text x="412" y="202" fill={ink}>The admin checks every address</text></g>
  </svg>
}

export function PublishGateDiagram() {
  const inp = (y: number) => <rect x="24" y={y} width="160" height="40" rx="8" fill="none" stroke={edge} strokeWidth="1.25" />
  const out = (y: number, h: number, c: string) => <rect x="488" y={y} width="248" height={h} rx="8" fill={c} fillOpacity="0.1" stroke={c} strokeWidth="1.5" />
  return <svg viewBox="0 0 760 320" role="img" aria-label="Five ways in, one gate, three outcomes" fontSize="13"><Arrow id="gate-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>Five ways in, one gate, three outcomes</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M184 84H216" /><path d="M184 132H216" /><path d="M184 180H216" /><path d="M184 228H216" /><path d="M184 276H216" /><path d="M216 84V276" /><path d="M216 180H248" markerEnd="url(#gate-arrow)" /><path d="M408 180H448" /><path d="M448 92V260" /><path d="M448 92H488" markerEnd="url(#gate-arrow)" /><path d="M448 172H488" markerEnd="url(#gate-arrow)" /><path d="M448 260H488" markerEnd="url(#gate-arrow)" /></g>
    <g data-part="">{inp(64)}<text x="104" y="88" textAnchor="middle" fill={ink}>Page maker</text></g>
    <g data-part="">{inp(112)}<text x="104" y="136" textAnchor="middle" fill={ink}>Edit in place</text></g>
    <g data-part="">{inp(160)}<text x="104" y="184" textAnchor="middle" fill={ink}>Upload</text></g>
    <g data-part="">{inp(208)}<text x="104" y="232" textAnchor="middle" fill={ink}>AI app over MCP</text></g>
    <g data-part="">{inp(256)}<text x="104" y="280" textAnchor="middle" fill={ink}>Code editor, GitHub</text></g>
    <g data-part=""><rect x="248" y="140" width="160" height="80" rx="8" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="2" /><text x="328" y="164" textAnchor="middle" fontWeight="600" fill={ink}>publishSite()</text><text x="328" y="184" textAnchor="middle" fontSize="11.5" fill={quiet}>the same checks,</text><text x="328" y="200" textAnchor="middle" fontSize="11.5" fill={quiet}>every time</text></g>
    <g data-part="">{out(64, 56, bad)}<text x="504" y="88" fontWeight="600" fill={ink}>Refused</text><text x="504" y="106" fontSize="11.5" fill={quiet}>an API or private key in a file</text></g>
    <g data-part="">{out(136, 72, warn)}<text x="504" y="160" fontWeight="600" fill={ink}>Held for a person to review</text><text x="504" y="178" fontSize="11.5" fill={quiet}>a sign-in form naming a bank or</text><text x="504" y="194" fontSize="11.5" fill={quiet}>mail provider, a form to another site</text></g>
    <g data-part="">{out(224, 72, good)}<text x="504" y="248" fontWeight="600" fill={ink}>Private draft or live</text><text x="504" y="266" fontSize="11.5" fill={quiet}>a new version, kept for good;</text><text x="504" y="282" fontSize="11.5" fill={quiet}>going back is one click</text></g>
  </svg>
}

export function ThreeWaysDiagram() {
  const door = (y: number) => <rect x="40" y={y} width="220" height="36" rx="8" fill="none" stroke={edge} strokeWidth="1.25" />
  const tools = (y: number) => <rect x="320" y={y} width="400" height="88" rx="8" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="2" />
  const wires = (a: number, b: number, c: number) => <g fill="none" stroke={edge} strokeWidth="1.25"><path d={`M260 ${a}H290`} /><path d={`M260 ${b}H290`} /><path d={`M260 ${c}H290`} /><path d={`M290 ${a}V${c}`} /><path d={`M290 ${b}H320`} markerEnd="url(#ways-arrow)" /></g>
  return <svg viewBox="0 0 760 466" role="img" aria-label="Three ways in, one set of tools, for owners and for admins" fontSize="13"><Arrow id="ways-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>Three ways in, one set of tools, for owners and for admins</text>
    <g data-part=""><rect x="24" y="52" width="712" height="176" rx="8" fill="none" stroke={grid} strokeWidth="1.25" /><text x="40" y="78" fontWeight="600" fill={ink}>Website owners</text>{door(92)}<text x="150" y="114" textAnchor="middle" fill={ink}>/account in the browser</text>{door(136)}<text x="150" y="158" textAnchor="middle" fill={ink}>AI apps at /mcp</text>{door(180)}<text x="150" y="202" textAnchor="middle" fill={ink}>wilssens command line</text>{wires(110, 154, 198)}{tools(110)}<text x="336" y="134" fontWeight="600" fill={ink}>Owner tools, built once on the server</text><text x="336" y="154" fontSize="11.5" fill={quiet}>the same checks, wording and confirmation everywhere</text><text x="336" y="172" fontSize="11.5" fill={quiet}>every publish goes through publishSite()</text></g>
    <g data-part=""><rect x="24" y="244" width="712" height="176" rx="8" fill="none" stroke={grid} strokeWidth="1.25" /><text x="40" y="270" fontWeight="600" fill={ink}>Admins</text>{door(284)}<text x="150" y="306" textAnchor="middle" fill={ink}>/admin in the browser</text>{door(328)}<text x="150" y="350" textAnchor="middle" fill={ink}>AI apps at /adminmcp</text>{door(372)}<text x="150" y="394" textAnchor="middle" fill={ink}>wilssens-admin command line</text>{wires(302, 346, 390)}{tools(302)}<text x="336" y="326" fontWeight="600" fill={ink}>Admin tools, built once on the server</text><text x="336" y="346" fontSize="11.5" fill={quiet}>a fresh Zoho two-step sign-in to approve each connection</text><text x="336" y="364" fontSize="11.5" fill={quiet}>a typed confirmation and one audit log for every call</text></g>
    <text data-part="" x="380" y="446" textAnchor="middle" fontSize="11.5" fill={quiet}>The only gaps are deliberate: new deploy keys and secret values never pass through an AI chat</text>
  </svg>
}

export function HelpPathDiagram() {
  const box = (x: number, c?: string) => <rect x={x} y="72" width="104" height="72" rx="8" fill={c || 'none'} fillOpacity={c ? 0.12 : 1} stroke={c || edge} strokeWidth={c ? 2 : 1.25} />
  const step = (x: number, name: string, a: string, b: string, c?: string) => <g data-part="">{box(x, c)}<text x={x + 52} y="96" textAnchor="middle" fontWeight="600" fill={ink}>{name}</text><text x={x + 52} y="114" textAnchor="middle" fontSize="11.5" fill={quiet}>{a}</text><text x={x + 52} y="130" textAnchor="middle" fontSize="11.5" fill={quiet}>{b}</text></g>
  return <svg viewBox="0 0 760 344" role="img" aria-label="Every answer passes checks the model cannot talk its way around" fontSize="13"><Arrow id="help-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>Every answer passes checks the model cannot talk its way around</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M128 108H146" markerEnd="url(#help-arrow)" /><path d="M250 108H268" markerEnd="url(#help-arrow)" /><path d="M372 108H390" markerEnd="url(#help-arrow)" /><path d="M494 108H512" markerEnd="url(#help-arrow)" /><path d="M616 108H634" markerEnd="url(#help-arrow)" /><path d="M198 144V200" markerEnd="url(#help-arrow)" /><path d="M320 144V200" markerEnd="url(#help-arrow)" /><path d="M564 144V200" markerEnd="url(#help-arrow)" /><path d="M137 280V132H146" markerEnd="url(#help-arrow)" /></g>
    {step(24, 'Question', 'from any page,', '3 languages')}
    {step(146, 'Who may ask', 'Turnstile, rate', 'limits, budget')}
    {step(268, 'Signatures', 'every earlier', 'answer is ours')}
    {step(390, 'Claude', 'our guides only,', 'offers cards only')}
    {step(512, 'Scope line', 'hidden, read by', 'the server')}
    {step(634, 'Answer', 'streamed, with', 'sources, signed', good)}
    <g data-part=""><rect x="146" y="200" width="226" height="52" rx="8" fill="none" stroke={edge} strokeWidth="1.25" /><text x="259" y="222" textAnchor="middle" fontWeight="600" fill={ink}>Turned away</text><text x="259" y="240" textAnchor="middle" fontSize="11.5" fill={quiet}>and counted by detection</text></g>
    <g data-part=""><rect x="500" y="200" width="128" height="52" rx="8" fill="none" stroke={edge} strokeWidth="1.25" /><text x="564" y="222" textAnchor="middle" fontWeight="600" fill={ink}>Fixed answer</text><text x="564" y="240" textAnchor="middle" fontSize="11.5" fill={quiet}>not the model’s</text></g>
    <g data-part="" fontSize="11.5" fill={quiet}><text x="206" y="176">no</text><text x="328" y="176">no</text><text x="572" y="176">off-topic</text></g>
    <g data-part=""><rect x="24" y="280" width="714" height="40" rx="8" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="2" /><text x="381" y="305" textAnchor="middle" fill={ink}>Abuse detection: bursts or a cost spike limit it to account holders or switch it off</text></g>
  </svg>
}

export function ActionCardsDiagram() {
  const step = (x: number, name: string, a: string, b: string) => <g data-part=""><rect x={x} y="60" width="128" height="72" rx="8" fill="none" stroke={edge} strokeWidth="1.25" /><text x={x + 64} y="84" textAnchor="middle" fontWeight="600" fill={ink}>{name}</text><text x={x + 64} y="102" textAnchor="middle" fontSize="11.5" fill={quiet}>{a}</text><text x={x + 64} y="118" textAnchor="middle" fontSize="11.5" fill={quiet}>{b}</text></g>
  return <svg viewBox="0 0 760 232" role="img" aria-label="The assistant proposes, the person decides, and the site rules still apply" fontSize="13"><Arrow id="card-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>The assistant proposes, the person decides, and the site rules still apply</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M152 96H170" markerEnd="url(#card-arrow)" /><path d="M298 96H316" markerEnd="url(#card-arrow)" /><path d="M444 96H462" markerEnd="url(#card-arrow)" /><path d="M590 96H608" markerEnd="url(#card-arrow)" /><path d="M672 132V168" markerEnd="url(#card-arrow)" /></g>
    {step(24, 'Card offered', 'by Claude, under', 'its answer')}
    {step(170, 'Server checks', 'allowed for this', 'person? two at most')}
    {step(316, 'Person fills in', 'the details,', 'or cancels')}
    {step(462, 'Confirm window', 'what happens, the', 'price, any warning')}
    {step(608, 'Site’s own API', 'the same as the', 'page, own sign-in')}
    <g data-part=""><rect x="24" y="168" width="712" height="40" rx="8" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="2" /><text x="380" y="193" textAnchor="middle" fill={ink}>Turnstile, rate limits, ownership checks and the operator’s approval all still apply</text></g>
  </svg>
}

export function SafetyPillarsDiagram() {
  const left = 24, wide = 712, gap = 16, pw = (wide - 3 * gap) / 4, py = 124, ph = 150
  const px = (i: number) => left + i * (pw + gap), mid = (i: number) => px(i) + pw / 2
  const pillar = (i: number, name: string, items: string[]) => <g data-part=""><line x1={mid(i)} y1="101" x2={mid(i)} y2={py} stroke={edge} strokeWidth="1.25" /><rect x={px(i)} y={py} width={pw} height={ph} rx="8" fill="none" stroke={edge} strokeWidth="1.25" /><line x1={px(i) + 16} y1={py + 44} x2={px(i) + pw - 16} y2={py + 44} stroke={grid} /><text x={mid(i)} y={py + 29} textAnchor="middle" fontSize="14" fontWeight="600" fill={ink}>{name}</text>{items.map((item, n) => <text key={item} x={px(i) + 16} y={py + 72 + n * 24} fill={ink}>{item}</text>)}</g>
  return <svg viewBox="0 0 760 354" role="img" aria-label="Four kinds of protection hold up one promise" fontSize="12.5">
    <text x={left} y="34" fontSize="15" fontWeight="600" fill={ink}>Four kinds of protection hold up one promise</text>
    <g data-part=""><rect x={left} y="52" width={wide} height="48" rx="8" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="2" /><text x={left + wide / 2} y="81" textAnchor="middle" fontSize="14" fontWeight="600" fill={ink}>A family domain people can trust with their name</text></g>
    {pillar(0, 'Children', ['adults-only directory', 'hidden contact list', 'no photo locations'])}
    {pillar(1, 'Phishing', ['risky forms held', 'Report this page', 'signed mail'])}
    {pillar(2, 'Accounts', ['no emailed passwords', 'single-use links', 'per-site AI access'])}
    {pillar(3, 'Privacy', ['totals, never lists', 'cookieless analytics', 'redacted help logs'])}
    <g data-part=""><rect x={left} y={py + ph + 16} width={wide} height="40" rx="8" fill={tint} stroke={edge} strokeWidth="1.25" /><text x={left + wide / 2} y={py + ph + 41} textAnchor="middle" fill={ink}>Foundation: written rules, enforced in the database, tested on every push</text></g>
  </svg>
}

export function ExperimentLoopDiagram() {
  const step = (x: number, name: string, a: string, b: string, main = false) => <g data-part=""><rect x={x} y="60" width="160" height="72" rx="8" fill={main ? accent : 'none'} fillOpacity={main ? 0.12 : 1} stroke={main ? accent : edge} strokeWidth={main ? 2 : 1.25} /><text x={x + 80} y="84" textAnchor="middle" fontWeight="600" fill={ink}>{name}</text><text x={x + 80} y="102" textAnchor="middle" fontSize="11.5" fill={quiet}>{a}</text><text x={x + 80} y="118" textAnchor="middle" fontSize="11.5" fill={quiet}>{b}</text></g>
  return <svg viewBox="0 0 760 212" role="img" aria-label="Every feature ships switched off, gets measured, then gets decided" fontSize="13"><Arrow id="exp-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>Every feature ships switched off, gets measured, then gets decided</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M184 96H208" markerEnd="url(#exp-arrow)" /><path d="M368 96H392" markerEnd="url(#exp-arrow)" /><path d="M552 96H576" markerEnd="url(#exp-arrow)" /><path d="M656 132V168H104V132" markerEnd="url(#exp-arrow)" /></g>
    {step(24, 'Ship it dark', 'behind a switch, or', 'for a few sites first')}
    {step(208, 'Name the events', 'kinds and counts,', 'never text or names')}
    {step(392, 'Read it in /admin', 'HogQL funnels,', 'cached in D1')}
    {step(576, 'Decide', 'switch on, change,', 'or take it out', true)}
    <text data-part="" x="380" y="188" textAnchor="middle" fontSize="11.5" fill={quiet}>the next idea starts the loop again</text>
  </svg>
}
