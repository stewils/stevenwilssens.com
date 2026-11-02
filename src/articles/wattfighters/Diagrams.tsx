// Diagrams for the Building Watt Fighters write-up, as plain SVG. Same conventions as the
// other write-ups: colours from the --d-* variables in article.css, and each <g data-part>
// is one part of a drawing that article.ts staggers in on scroll.

const ink = 'var(--d-ink)', quiet = 'var(--d-quiet)', edge = 'var(--d-edge)', accent = 'var(--d-accent)', good = 'var(--d-good)', grid = 'var(--d-grid)'

// Many sessions, one set of rules, a clean copy of the code, and a deploy that waits for the tests.
export function SessionsDiagram() {
  const box = (x: number, y: number, w: number, h: number, tone: string, fill = 0.12) => <rect x={x} y={y} width={w} height={h} rx="8" fill={tone} fillOpacity={fill} stroke={tone} strokeWidth="1.5" />
  const session = (y: number, label: string) => <g data-part="">{box(256, y, 168, 40, edge, 0)}<text x="340" y={y + 25} textAnchor="middle" fontWeight="600" fill={ink}>{label}</text></g>
  return <svg viewBox="0 0 760 330" role="img" aria-label="A rules file, shared docs and a memory of decisions feed several Claude Code sessions working at once; each session commits only its own work to the one codebase, and a deploy from a clean copy of the code runs the tests and ships to the live game only when they pass" fontSize="13" fontFamily="inherit">
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>Many sessions, one set of rules, one gate</text>
    <g data-part="">{box(24, 56, 176, 56, accent)}<text x="112" y="80" textAnchor="middle" fontWeight="600" fill={ink}>Rules file</text><text x="112" y="98" textAnchor="middle" fontSize="11.5" fill={quiet}>CLAUDE.md</text></g>
    <g data-part="">{box(24, 124, 176, 56, accent)}<text x="112" y="148" textAnchor="middle" fontWeight="600" fill={ink}>Docs</text><text x="112" y="166" textAnchor="middle" fontSize="11.5" fill={quiet}>updated in the same change</text></g>
    <g data-part="">{box(24, 192, 176, 56, accent)}<text x="112" y="216" textAnchor="middle" fontWeight="600" fill={ink}>Memory</text><text x="112" y="234" textAnchor="middle" fontSize="11.5" fill={quiet}>my decisions, kept</text></g>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M200 84H228V212H200" /><path d="M228 148H256" /></g>
    {session(68, 'Session A')}
    {session(128, 'Session B')}
    {session(188, 'Session C')}
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M424 88H452V208H424" /><path d="M452 148H476" /></g>
    <g data-part="">{box(476, 112, 128, 72, edge, 0)}<text x="540" y="140" textAnchor="middle" fontWeight="600" fill={ink}>One codebase</text><text x="540" y="158" textAnchor="middle" fontSize="11.5" fill={quiet}>each commits</text><text x="540" y="172" textAnchor="middle" fontSize="11.5" fill={quiet}>only its own work</text></g>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M604 148H632" /></g>
    <g data-part="">{box(632, 100, 104, 96, good)}<text x="684" y="128" textAnchor="middle" fontWeight="600" fill={ink}>Deploy</text><text x="684" y="146" textAnchor="middle" fontSize="11.5" fill={quiet}>clean copy,</text><text x="684" y="160" textAnchor="middle" fontSize="11.5" fill={quiet}>tests pass,</text><text x="684" y="174" textAnchor="middle" fontSize="11.5" fill={quiet}>then it ships</text></g>
    <g data-part=""><text x="380" y="292" textAnchor="middle" fontSize="11.5" fill={quiet}>Nobody’s unfinished work goes live, because the deploy never sees it.</text></g>
  </svg>
}

// Keeping it working (sections 10 to 12). Almost all of that system is built (as of 2 November
// 2026); the text messages are not. Every step says which, in words and in its outline:
// Built is solid and tinted,
// Planned is dashed and empty (never colour alone; --d-warn stays for errors). Each diagram
// is drawn twice, across for a desktop and stacked for a phone, as in the site write-up.
type Status = 'built' | 'planned'
type Step = { status: Status; title: string; lines: string[] }
const statusWord = { built: 'Built', planned: 'Planned' } as const
const outline = (status: Status) => status === 'built' ? { fill: accent, fillOpacity: 0.12, stroke: accent } : { fill: 'none', stroke: edge, strokeDasharray: '5 4' }
const heightOf = (step: Step) => step.lines.length ? 51 + step.lines.length * 15 : 48

const Arrow = ({ id }: { id: string }) => <defs><marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={edge} /></marker></defs>

function StatusBox({ x, y, w, h, step }: { x: number; y: number; w: number; h?: number; step: Step }) {
  return <g data-part="" data-status={step.status}><rect x={x} y={y} width={w} height={h ?? heightOf(step)} rx="8" strokeWidth="1.5" {...outline(step.status)} />
    <text x={x + 12} y={y + 22} fontWeight="600" fill={ink}>{step.title}</text>
    <text x={x + 12} y={y + 38} fontSize="11" fontWeight="700" letterSpacing=".4" fill={ink}>{statusWord[step.status]}</text>
    {step.lines.map((line, i) => <text key={line} x={x + 12} y={y + 56 + i * 15} fontSize="11.5" fill={quiet}>{line}</text>)}</g>
}

// One part of a step that is part built and part planned: a pill with its own word.
function Chip({ x, y, w, label, status }: { x: number; y: number; w: number; label: string; status: Status }) {
  return <g data-status={status}><rect x={x} y={y} width={w} height="24" rx="12" strokeWidth="1.25" {...outline(status)} /><text x={x + 10} y={y + 16} fontSize="11.5" fill={ink}>{label}</text><text x={x + w - 10} y={y + 16} textAnchor="end" fontSize="11" fontWeight="700" fill={ink}>{statusWord[status]}</text></g>
}

// A plain frame with a title and a pill per part; the frame itself claims nothing.
function MixedBox({ x, y, w, title, chips }: { x: number; y: number; w: number; title: string; chips: [string, Status][] }) {
  return <g data-part=""><rect x={x} y={y} width={w} height={38 + chips.length * 30} rx="8" fill="none" stroke={grid} strokeWidth="1.25" /><text x={x + 12} y={y + 22} fontWeight="600" fill={ink}>{title}</text>
    {chips.map(([label, status], i) => <Chip key={label} x={x + 12} y={y + 34 + i * 30} w={w - 24} label={label} status={status} />)}</g>
}

// The legend under each of these diagrams, in HTML so it wraps; the words carry the meaning.
const Swatch = ({ status }: { status: Status }) => <svg aria-hidden="true" viewBox="0 0 28 14" width="28" height="14"><rect x="1" y="1" width="26" height="12" rx="3" strokeWidth="1.5" {...outline(status)} /></svg>
export const StatusLegend = () => <p className="wx-legend"><span><Swatch status="built" />Built, working today</span><span><Swatch status="planned" />Planned, written down, not built</span></p>

const today = 'While the Stop switch is on, every fix waits for my “Release it”.'

const sources: [string, Status][] = [['My marks in races', 'built'], ['Game errors and crashes', 'built'], ['Server errors and health', 'built'], ['Players’ messages', 'built']]
const count: Step = { status: 'built', title: 'Count', lines: ['counts from 3 people', 'loud: 5% in an hour', 'or 10% in a day,', 'and at least 5 people'] }
const fixer: Step = { status: 'built', title: 'The fixer', lines: ['every 5 minutes', 'a failing test first', 'then the fix', 'every test passes'] }
const decision: Step = { status: 'built', title: 'The decision', lines: ['see Who decides', 'waits for my “Release it”', 'or a merge'] }
const release: Step = { status: 'built', title: 'The release', lines: ['bundled', 'at most one an hour', 'every test runs'] }
const watching: Step = { status: 'built', title: 'Watching for 2 hours', lines: ['players on the new version'] }
const gone: Step = { status: 'built', title: 'Problem gone', lines: ['GitHub issue closed,', 'the test stays', 'for good'] }
const back: Step = { status: 'built', title: 'New loud problem', lines: ['the old version', 'goes back live'] }
const fixTitle = 'From a problem to a fix'
const fixDescription = 'From a problem to a fix, in order. Where problems come from: my marks in races, game errors and crashes, server errors and health checks, and players’ messages (all built). Count (built): a problem counts from 3 people and is loud at 5% of players in an hour or 10% in a day, with at least 5 people. The fixer (built): a Claude Code session every 5 minutes writes a failing test first, then the fix, and every test passes. The decision (built): the fix waits for my Release it or a merged pull request; a loud fix goes live in an hour on its own unless I stop it, but while the Stop switch is on, every fix waits for me. The release (built): bundled, at most one an hour, every test runs. Watching for 2 hours (built): if the problem is gone, the GitHub issue is closed and the test stays for good; if a new loud problem starts, the old version goes back live.'
const sourcesHeight = 38 + sources.length * 30, decisionHeight = 132

// The decision is built (it waits for me); its automatic path is a pill inside it.
const DecisionBox = ({ x, y, w }: { x: number; y: number; w: number }) => <g><StatusBox x={x} y={y} w={w} h={decisionHeight} step={decision} /><g data-part=""><Chip x={x + 12} y={y + 98} w={w - 24} label="Loud: live in an hour" status="built" /></g></g>

export function FixFlowDiagram() {
  // Stacked: one column 276 wide in a 300 viewBox, 24px between the boxes for the arrows,
  // then the two ways a watch ends, side by side.
  const column: [Step | 'sources' | 'decision', number][] = [['sources', sourcesHeight], [count, heightOf(count)], [fixer, heightOf(fixer)], ['decision', decisionHeight], [release, heightOf(release)], [watching, heightOf(watching)]]
  const tops: number[] = []
  let y = 48
  for (const [, h] of column) { tops.push(y); y += h + 24 }
  const watchBottom = tops[5] + heightOf(watching), branchTop = watchBottom + 32, end = branchTop + heightOf(gone)
  return <>
    <svg className="wx-flow-wide" viewBox="0 0 760 464" role="img" aria-label={fixTitle} aria-describedby="wf-fix-wide-desc" fontSize="13" fontFamily="inherit"><Arrow id="wf-fix-wide-arrow" />
      <title>{fixTitle}</title><desc id="wf-fix-wide-desc">{fixDescription}</desc>
      <text x="16" y="30" fontSize="15" fontWeight="600" fill={ink}>{fixTitle}</text>
      <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M252 111H282" markerEnd="url(#wf-fix-wide-arrow)" /><path d="M484 111H518" markerEnd="url(#wf-fix-wide-arrow)" /><path d="M632 167V232H124V254" markerEnd="url(#wf-fix-wide-arrow)" /><path d="M248 296H278" markerEnd="url(#wf-fix-wide-arrow)" /><path d="M480 296H510" markerEnd="url(#wf-fix-wide-arrow)" /><path d="M628 322V338H482V354" markerEnd="url(#wf-fix-wide-arrow)" /><path d="M628 338H662V354" markerEnd="url(#wf-fix-wide-arrow)" /></g>
      <MixedBox x={16} y={56} w={236} title="Where problems come from" chips={sources} />
      <StatusBox x={284} y={56} w={200} step={count} /><StatusBox x={520} y={56} w={224} step={fixer} />
      <DecisionBox x={16} y={256} w={232} /><StatusBox x={280} y={256} w={200} step={release} /><StatusBox x={512} y={256} w={232} step={watching} />
      <StatusBox x={400} y={356} w={164} step={gone} /><StatusBox x={580} y={356} w={164} step={back} />
      <g data-part="" fontSize="11.5" fill={quiet}><text x="16" y="404">While the Stop switch is on,</text><text x="16" y="420">every fix waits for my “Release it”.</text></g>
    </svg>
    <svg className="wx-flow-tall" viewBox={`0 0 300 ${end + 60}`} role="img" aria-label={fixTitle} aria-describedby="wf-fix-tall-desc" fontSize="13" fontFamily="inherit"><Arrow id="wf-fix-tall-arrow" />
      <title>{fixTitle}</title><desc id="wf-fix-tall-desc">{fixDescription}</desc>
      <text x="12" y="28" fontSize="15" fontWeight="600" fill={ink}>{fixTitle}</text>
      <g data-part="" fill="none" stroke={edge} strokeWidth="1.25">
        {column.slice(0, -1).map(([, h], i) => <path key={i} d={`M150 ${tops[i] + h}V${tops[i + 1] - 2}`} markerEnd="url(#wf-fix-tall-arrow)" />)}
        <path d={`M150 ${watchBottom}V${watchBottom + 14}H80V${branchTop - 2}`} markerEnd="url(#wf-fix-tall-arrow)" /><path d={`M150 ${watchBottom + 14}H220V${branchTop - 2}`} markerEnd="url(#wf-fix-tall-arrow)" />
      </g>
      {column.map(([step], i) => step === 'sources' ? <MixedBox key="sources" x={12} y={tops[i]} w={276} title="Where problems come from" chips={sources} /> : step === 'decision' ? <DecisionBox key="decision" x={12} y={tops[i]} w={276} /> : <StatusBox key={step.title} x={12} y={tops[i]} w={276} step={step} />)}
      <StatusBox x={12} y={branchTop} w={136} step={gone} /><StatusBox x={152} y={branchTop} w={136} step={back} />
      <g data-part="" fontSize="11.5" fill={quiet}><text x="150" y={end + 28} textAnchor="middle">While the Stop switch is on,</text><text x="150" y={end + 44} textAnchor="middle">every fix waits for my “Release it”.</text></g>
    </svg>
  </>
}

const protectedBand: Step = { status: 'built', title: 'Touches a protected part', lines: ['always waits for me, however many players have the problem'] }
const protectedBandTall: Step = { ...protectedBand, lines: ['always waits for me, however many', 'players have the problem'] }
const quietReady: Step = { status: 'built', title: 'Fix ready', lines: ['waits for my “Release it”', 'or a merge'] }
const quietCannot: Step = { status: 'built', title: 'Can’t fix', lines: ['an email with why'] }
const loudReady: Step = { status: 'built', title: 'Fix ready', lines: ['an email; live in an hour', 'unless I stop it', 'Stop switch on: waits for me'] }
const loudCannot: [string, Status][] = [['Urgent email with why', 'built'], ['A text with it', 'planned']]
const decideTitle = 'Who decides'
const decideDescription = 'Who decides. A fix that touches a protected part always waits for me (built). Quiet problem, fix ready: it waits for my Release it or a merged pull request (built). Quiet problem, can’t fix: an email says why (built). Loud problem, fix ready: an email, and it goes live in an hour unless I stop it (built); while the Stop switch is on, every fix waits for me. Loud problem, can’t fix: an urgent email says why (built); a text goes with it once the text message service is set up (planned).'
const cellHeight = 100

export function DecideDiagram() {
  // Stacked: the band, then each kind of problem with its two cells under it.
  const quietTop = 48 + heightOf(protectedBandTall) + 40, loudTop = quietTop + 2 * cellHeight + 12 + 40
  const end = loudTop + 2 * cellHeight + 12
  return <>
    <svg className="wx-flow-wide" viewBox="0 0 640 380" role="img" aria-label={decideTitle} aria-describedby="wf-decide-wide-desc" fontSize="13" fontFamily="inherit">
      <title>{decideTitle}</title><desc id="wf-decide-wide-desc">{decideDescription}</desc>
      <text x="16" y="30" fontSize="15" fontWeight="600" fill={ink}>{decideTitle}</text>
      <StatusBox x={16} y={48} w={608} step={protectedBand} />
      <g data-part="" fontWeight="600" fill={ink}><text x="16" y="186">Quiet</text><text x="16" y="302">Loud</text></g>
      <StatusBox x={120} y={132} w={244} h={cellHeight} step={quietReady} /><StatusBox x={380} y={132} w={244} h={cellHeight} step={quietCannot} />
      <StatusBox x={120} y={248} w={244} h={cellHeight} step={loudReady} /><MixedBox x={380} y={248} w={244} title="Can’t fix" chips={loudCannot} />
      <g data-part=""><text x="16" y="372" fontSize="11.5" fill={quiet}>{today}</text></g>
    </svg>
    <svg className="wx-flow-tall" viewBox={`0 0 300 ${end + 56}`} role="img" aria-label={decideTitle} aria-describedby="wf-decide-tall-desc" fontSize="13" fontFamily="inherit">
      <title>{decideTitle}</title><desc id="wf-decide-tall-desc">{decideDescription}</desc>
      <text x="12" y="28" fontSize="15" fontWeight="600" fill={ink}>{decideTitle}</text>
      <StatusBox x={12} y={48} w={276} step={protectedBandTall} />
      <g data-part="" fontWeight="600" fill={ink}><text x="12" y={quietTop - 12}>Quiet problem</text><text x="12" y={loudTop - 12}>Loud problem</text></g>
      <StatusBox x={12} y={quietTop} w={276} h={cellHeight} step={quietReady} /><StatusBox x={12} y={quietTop + cellHeight + 12} w={276} h={cellHeight} step={quietCannot} />
      <StatusBox x={12} y={loudTop} w={276} h={cellHeight} step={loudReady} /><MixedBox x={12} y={loudTop + cellHeight + 12} w={276} title="Can’t fix" chips={loudCannot} />
      <g data-part="" fontSize="11.5" fill={quiet}><text x="150" y={end + 28} textAnchor="middle">While the Stop switch is on,</text><text x="150" y={end + 44} textAnchor="middle">every fix waits for my “Release it”.</text></g>
    </svg>
  </>
}

// The hour, as a time line: at is the point on it (the hour runs from 330 to 640, so 45
// minutes is at 562), up or down the side its box sits on.
type Moment = Step & { at: number; up: boolean; w: number }
const moments: Moment[] = [
  { at: 96, up: true, w: 156, status: 'built', title: 'Problem turns loud', lines: [] },
  { at: 210, up: false, w: 140, status: 'built', title: 'Fix ready', lines: ['from the fixer'] },
  { at: 330, up: true, w: 140, status: 'built', title: 'Email', lines: ['the hour starts'] },
  { at: 450, up: false, w: 148, status: 'built', title: 'Other fixes join', lines: ['the same bundle'] },
  { at: 562, up: true, w: 140, status: 'built', title: '15 minutes left', lines: ['later fixes wait'] },
  { at: 640, up: false, w: 140, status: 'built', title: 'Goes live', lines: ['at 60 minutes'] },
  { at: 700, up: true, w: 112, status: 'built', title: 'Watching', lines: ['for 2 hours'] },
]
const stopIt: Step = { status: 'built', title: '“Let me check it first”', lines: ['stops it at any time', 'until the bundle goes live'] }
const textMessage: Step = { status: 'planned', title: 'Text message', lines: ['starts when the text', 'message service is set up'] }
const bundle: Step = { status: 'built', title: 'One bundle, at most one release an hour', lines: ['fixes go live together, every test runs'] }
const bundleTall: Step = { ...bundle, title: 'At most one release an hour', lines: ['fixes go live together in a bundle,', 'every test runs'] }
const hourTitle = 'The hour'
const hourDescription = 'The hour, in order: a problem turns loud, its fix is ready, and an email goes to me and the hour starts (built). A text goes with the email once the text message service is set up (planned). Other ready fixes join the same bundle until 15 minutes before the end; a later fix waits for the next bundle (built). “Let me check it first” stops it at any time (built). At 60 minutes the bundle goes live, and 2 hours of watching follow (built). Fixes going live in one bundle, never two releases within an hour, with every test run, is built.'
const dot = (cx: number, cy: number, status: Status) => <circle cx={cx} cy={cy} r="4" strokeWidth="1.5" {...outline(status)} fillOpacity={status === 'built' ? 1 : undefined} />

export function HourDiagram() {
  const axis = 170
  // Stacked: the time line down the left, the moments to its right, and “Let me check it
  // first” as a box after the hour starts.
  const tall: Step[] = [moments[0], moments[1], moments[2], textMessage, stopIt, moments[3], moments[4], moments[5], moments[6]]
  const tops: number[] = []
  let y = 48
  for (const step of tall) { tops.push(y); y += heightOf(step) + 14 }
  const mid = (i: number) => tops[i] + heightOf(tall[i]) / 2
  return <>
    <svg className="wx-flow-wide" viewBox="0 0 760 360" role="img" aria-label={hourTitle} aria-describedby="wf-hour-wide-desc" fontSize="13" fontFamily="inherit">
      <title>{hourTitle}</title><desc id="wf-hour-wide-desc">{hourDescription}</desc>
      <text x="16" y="24" fontSize="15" fontWeight="600" fill={ink}>{hourTitle}</text>
      <g data-part="" data-status="built"><path d="M330 58V50H640V58" fill="none" stroke={accent} strokeWidth="1.25" /><text x="485" y="42" textAnchor="middle" fontSize="11.5" fill={ink}><tspan fontWeight="700">Built</tspan> · “Let me check it first” stops it at any time</text></g>
      <g data-part="" fill="none" stroke={grid} strokeWidth="1.5"><path d={`M30 ${axis}H744`} /></g>
      <g data-part="" fontSize="11" fill={quiet}><text x="336" y={axis + 18}>0 min</text><text x="568" y={axis + 18}>45 min</text><text x="646" y={axis + 18}>60 min</text></g>
      {moments.map((m) => { const h = heightOf(m), top = m.up ? 64 : 204; return <g key={m.title}><path d={m.up ? `M${m.at} ${top + h}V${axis}` : `M${m.at} ${axis}V${top}`} stroke={edge} strokeWidth="1" />{dot(m.at, axis, m.status)}<StatusBox x={m.at - m.w / 2} y={top} w={m.w} step={m} /></g> })}
      <g data-part=""><Chip x={338} y={136} w={110} label="Text" status="planned" /></g>
      <StatusBox x={16} y={290} w={728} step={bundle} />
    </svg>
    <svg className="wx-flow-tall" viewBox={`0 0 300 ${y + heightOf(bundleTall) + 10}`} role="img" aria-label={hourTitle} aria-describedby="wf-hour-tall-desc" fontSize="13" fontFamily="inherit">
      <title>{hourTitle}</title><desc id="wf-hour-tall-desc">{hourDescription}</desc>
      <text x="12" y="28" fontSize="15" fontWeight="600" fill={ink}>{hourTitle}</text>
      <g data-part="" fill="none" stroke={grid} strokeWidth="1.5"><path d={`M32 ${mid(0)}V${mid(tall.length - 1)}`} /></g>
      <g data-part="" data-status="built"><path d={`M20 ${mid(2)}H12V${mid(7)}H20`} fill="none" stroke={accent} strokeWidth="1.25" /></g>
      {tall.map((step, i) => <g key={step.title}><path d={`M32 ${mid(i)}H52`} stroke={edge} strokeWidth="1" />{dot(32, mid(i), step.status)}<StatusBox x={52} y={tops[i]} w={236} step={step} /></g>)}
      <StatusBox x={12} y={y} w={276} step={bundleTall} />
    </svg>
  </>
}
