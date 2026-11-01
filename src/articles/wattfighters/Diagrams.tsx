// Diagram for the Building Watt Fighters write-up, as plain SVG. Same conventions as the
// other write-ups: colours from the --d-* variables in article.css, and each <g data-part>
// is one part of a drawing that article.ts staggers in on scroll.

const ink = 'var(--d-ink)', quiet = 'var(--d-quiet)', edge = 'var(--d-edge)', accent = 'var(--d-accent)', good = 'var(--d-good)'

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
