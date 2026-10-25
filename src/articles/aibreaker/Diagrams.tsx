// The AI Breaker article's diagrams as plain SVG, in the same style and colours as
// the wilssens.com article (--d-* variables from ../wilssens/article.css). Each
// <g data-part> is one part of a drawing; article.ts staggers them in on scroll.

const ink = 'var(--d-ink)', quiet = 'var(--d-quiet)', edge = 'var(--d-edge)', accent = 'var(--d-accent)'
const good = 'var(--d-good)', warn = 'var(--d-warn)', bad = 'var(--d-bad)', tint = 'var(--d-tint)'

const Arrow = ({ id }: { id: string }) => <defs><marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={edge} /></marker></defs>

// Pew Research Center: "more concerned than excited" about the growing use of AI in
// daily life. US adults 2021 and 2026 (June 2026 survey, published 18 August 2026);
// the 25-country median outside the US (surveys January to April 2025, published 15
// October 2025). Three segments per row, in fixed order, each labelled directly.
const rows: [string, string, number, number, number][] = [
  ['US adults, 2021', 'Pew, 2021', 37, 45, 18],
  ['US adults, 2026', 'Pew, June 2026', 52, 37, 9],
  ['25 countries, median', 'Pew, 2025', 34, 42, 16],
]
export function ConcernChart() {
  const x0 = 214, width = 500, gap = 2, bar = 34, top = 76, step = 62
  const segs = [bad, quiet, good]
  return <svg viewBox="0 0 760 318" role="img" aria-label="Share of adults more concerned than excited about AI in daily life: 37% of US adults in 2021, 52% in 2026; a 25-country median of 34% in 2025" fontSize="13">
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>How people feel about the growing use of AI in daily life</text>
    <g data-part="" fontSize="11.5" fill={quiet}><text x="24" y="52">Share of adults. Source: Pew Research Center, 2021 to 2026.</text></g>
    {rows.map(([label, source, concerned, equal, excited], index) => {
      const y = top + index * step
      let x = x0
      const parts = [concerned, equal, excited].map((value, part) => {
        const w = (width * value) / 100 - (part < 2 ? gap : 0)
        const element = <g key={part}><rect x={x} y={y} width={Math.max(0, w)} height={bar} rx={part === 0 ? 4 : part === 2 ? 4 : 0} fill={segs[part]} fillOpacity={part === 1 ? 0.35 : 0.9} /><text x={x + w / 2} y={y + 22} textAnchor="middle" fontSize="12.5" fontWeight={part === 0 ? 700 : 400} fill={part === 1 ? ink : '#fff'}>{value}%</text></g>
        x += w + gap
        return element
      })
      return <g key={label} data-part=""><text x="24" y={y + 16} fontWeight="600" fill={ink}>{label}</text><text x="24" y={y + 32} fontSize="11" fill={quiet}>{source}</text>{parts}</g>
    })}
    <g data-part="" fontSize="12" fill={quiet}>
      <rect x="214" y="270" width="12" height="12" rx="3" fill={bad} fillOpacity="0.9" /><text x="232" y="281">More concerned than excited</text>
      <rect x="420" y="270" width="12" height="12" rx="3" fill={quiet} fillOpacity="0.35" /><text x="438" y="281">Equally both</text>
      <rect x="548" y="270" width="12" height="12" rx="3" fill={good} fillOpacity="0.9" /><text x="566" y="281">More excited than concerned</text>
      <text x="24" y="304" fontSize="11">Asked in 2025 about control over how AI is used in their own lives, about six in ten US adults want more; 17% are comfortable with what they have.</text>
    </g>
  </svg>
}

export function LevelsDiagram() {
  const groups: [string, string, string, string][] = [
    ['1', 'AI built into Windows, browsers and Office', 'Recall, Click to Do, Copilot in Office and Edge, Paint and Notepad AI, Widgets, browser AI, AI training data', 'Those features, and the whole Widgets board'],
    ['2', 'AI chatbots, sites and apps', 'Chatbot sites and apps, the Copilot apps, chatbots inside Messenger, AI in Google Search', 'Chatbot sites and apps, the image strips on Google’s results page'],
    ['3', 'AI hidden inside other apps', 'AI engines inside apps, local model runners; option: Windows’ own AI engines', 'Background blur, generative tools, local AI apps'],
  ]
  return <svg viewBox="0 0 760 392" role="img" aria-label="Three choices over three independent groups: nothing turned off, choose what to turn off, everything AI Breaker can turn off; the groups are AI built into Windows, AI chatbots, sites and apps, and AI hidden inside other apps" fontSize="13">
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>Three choices over three groups that combine freely</text>
    {['Nothing turned off', 'Choose what to turn off', 'Everything AI Breaker can turn off'].map((choice, i) => <g key={choice} data-part="">
      <rect x={24 + i * 240} y="46" width="232" height="40" rx="8" fill={i === 1 ? accent : 'none'} fillOpacity={0.1} stroke={i === 1 ? accent : edge} strokeWidth="1.25" />
      <text x={140 + i * 240} y="71" textAnchor="middle" fontWeight="600" fill={ink}>{choice}</text>
    </g>)}
    {groups.map(([n, name, what, breaks], index) => {
      const y = 140 + index * 74
      return <g key={n} data-part="">
        <rect x="24" y={y - 30} width="712" height="66" rx="8" fill={accent} fillOpacity={0.08} stroke={accent} strokeWidth="1.5" />
        <text x="40" y={y + 10} fontSize="22" fontWeight="700" fill={accent}>{n}</text>
        <text x="76" y={y - 10} fontWeight="600" fill={ink}>{name}</text>
        <text x="76" y={y + 8} fontSize="11.5" fill={quiet}>{what}</text>
        <text x="76" y={y + 26} fontSize="11" fill={warn}>Breaks: {breaks}</text>
      </g>
    })}
    <g data-part="" fontSize="11.5" fill={quiet}><text x="24" y="364">Each group has “Choose items” for single items. The choice is worked out from the groups, never stored.</text><text x="24" y="382">Defender’s malware protection is never touched.</text></g>
  </svg>
}

export function ProcessDiagram() {
  const box = (x: number, y: number, w: number, h: number, main = false) => <rect x={x} y={y} width={w} height={h} rx="8" fill={main ? accent : 'none'} fillOpacity={main ? 0.12 : 1} stroke={main ? accent : edge} strokeWidth={main ? 2 : 1.25} />
  return <svg viewBox="0 0 760 370" role="img" aria-label="The app and the command line talk to a background service over a named pipe; only the service changes Windows, and it writes to the journal first" fontSize="13"><Arrow id="proc-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>The window never touches Windows. A helper does, and writes it down first.</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M168 94H256" markerEnd="url(#proc-arrow)" /><path d="M168 174H256" markerEnd="url(#proc-arrow)" /><path d="M416 134H494" markerEnd="url(#proc-arrow)" /><path d="M337 198V236" markerEnd="url(#proc-arrow)" /><path d="M576 198V236" markerEnd="url(#proc-arrow)" /></g>
    <g data-part="">{box(24, 62, 144, 64)}<text x="96" y="88" textAnchor="middle" fontWeight="600" fill={ink}>The app</text><text x="96" y="106" textAnchor="middle" fontSize="11.5" fill={quiet}>WinUI 3, never elevated</text></g>
    <g data-part="">{box(24, 142, 144, 64)}<text x="96" y="168" textAnchor="middle" fontWeight="600" fill={ink}>Command line</text><text x="96" y="186" textAnchor="middle" fontSize="11.5" fill={quiet}>aibreaker.exe, recovery</text></g>
    <g data-part="" fontSize="10.5" fill={quiet} textAnchor="middle"><text x="212" y="86">named pipe</text><text x="212" y="166">local only</text></g>
    <g data-part="">{box(258, 62, 158, 136, true)}<text x="337" y="90" textAnchor="middle" fontWeight="600" fill={ink}>The service</text><text x="337" y="108" textAnchor="middle" fontSize="11.5" fill={quiet}>runs as SYSTEM</text><text x="337" y="130" textAnchor="middle" fontSize="11.5" fill={quiet}>plan → authorize</text><text x="337" y="146" textAnchor="middle" fontSize="11.5" fill={quiet}>journal → apply → verify</text><text x="337" y="162" textAnchor="middle" fontSize="11.5" fill={quiet}>only targets in its catalog</text><text x="337" y="184" textAnchor="middle" fontSize="11" fill={accent}>owns undo and state</text></g>
    <g data-part="">{box(494, 62, 242, 136)}<text x="615" y="90" textAnchor="middle" fontWeight="600" fill={ink}>Windows</text>{['policy settings in the registry', 'browser block lists', 'per-app firewall rules', 'DNS rules, AppLocker', 'App Control policies'].map((line, i) => <text key={line} x="615" y={112 + i * 17} textAnchor="middle" fontSize="11.5" fill={quiet}>{line}</text>)}</g>
    <g data-part="">{box(258, 236, 158, 72)}<text x="337" y="262" textAnchor="middle" fontWeight="600" fill={ink}>Change journal</text><text x="337" y="280" textAnchor="middle" fontSize="11.5" fill={quiet}>before and after, per change</text><text x="337" y="296" textAnchor="middle" fontSize="11.5" fill={quiet}>readable by the recovery tool</text></g>
    <g data-part="">{box(494, 236, 242, 72)}<text x="615" y="262" textAnchor="middle" fontWeight="600" fill={ink}>Windows’ own event logs</text><text x="615" y="280" textAnchor="middle" fontSize="11.5" fill={quiet}>Code Integrity 3077, Firewall 5157, AppLocker 8004</text><text x="615" y="296" textAnchor="middle" fontSize="11.5" fill={quiet}>shown in Activity with the record number</text></g>
    <g data-part="" fontSize="11.5" fill={quiet}><text x="24" y="338">Blocking more needs an administrator. Blocking less (undo, panic, enabling an item) also needs Windows’ own approval prompt,</text><text x="24" y="356">so nothing can quietly switch AI back on.</text></g>
  </svg>
}

export function JournalFlowDiagram() {
  const steps: [string, string, string][] = [['Plan', 'what would', 'change'], ['Authorize', 'from the plan,', 'not the caller'], ['Write it down', 'journal entry:', 'Pending'], ['Change', 'one documented', 'control'], ['Verify', 'read it', 'back'], ['Applied', 'or undone', 'if it failed']]
  const w = 110, gap = 11, x0 = 24
  return <svg viewBox="0 0 760 236" role="img" aria-label="Every change goes plan, authorize, write it down, change Windows, verify, applied; a failure part-way undoes the completed steps" fontSize="13"><Arrow id="jrn-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>No change is made before it is written down</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25">{steps.slice(0, -1).map((_, i) => <path key={i} d={`M${x0 + i * (w + gap) + w} 100H${x0 + (i + 1) * (w + gap) - 2}`} markerEnd="url(#jrn-arrow)" />)}<path d={`M${x0 + 5 * (w + gap) + w / 2} 140V180H${x0 + w + gap + w / 2}V140`} markerEnd="url(#jrn-arrow)" strokeDasharray="4 4" /></g>
    {steps.map(([name, line1, line2], i) => <g key={name} data-part=""><rect x={x0 + i * (w + gap)} y="64" width={w} height="74" rx="8" fill={i === 2 ? accent : 'none'} fillOpacity={i === 2 ? 0.14 : 1} stroke={i === 2 ? accent : edge} strokeWidth={i === 2 ? 2 : 1.25} /><text x={x0 + i * (w + gap) + w / 2} y="88" textAnchor="middle" fontWeight="600" fill={ink}>{name}</text><text x={x0 + i * (w + gap) + w / 2} y="107" textAnchor="middle" fontSize="10.5" fill={quiet}>{line1}</text><text x={x0 + i * (w + gap) + w / 2} y="122" textAnchor="middle" fontSize="10.5" fill={quiet}>{line2}</text></g>)}
    <g data-part="" fontSize="11.5" fill={quiet} textAnchor="middle"><text x="400" y="200">undo reads the journal newest first and restores each recorded “before”; a sweep also finds our rules without it</text></g>
    <g data-part="" fontSize="11.5" fill={quiet}><text x="24" y="226">A rescue command works with the service stopped, and the uninstaller undoes everything before it removes a file.</text></g>
  </svg>
}

export function LayersDiagram() {
  const rows: [string, string, string][] = [
    ['AI built into Windows, Office and browsers', 'Documented policy settings (Microsoft’s, Google’s and Mozilla’s own)', 'Group 1'],
    ['Chatbot websites', 'Each browser’s own URL block list, then DNS rules as a catch-all', 'Group 2'],
    ['AI desktop apps', 'Per-app outbound firewall rules', 'Group 2'],
    ['The Copilot apps', 'AppLocker: the app does not start (Microsoft’s recommended method)', 'Group 2'],
    ['AI in Google Search, Messenger', 'The browser extension that comes with AI Breaker', 'Group 2'],
    ['AI engines inside apps, local models', 'App Control: Windows refuses to run those files', 'Group 3'],
  ]
  return <svg viewBox="0 0 760 318" role="img" aria-label="Where each kind of AI is stopped: policy settings, browser block lists and DNS, firewall rules, AppLocker, a browser extension, and App Control" fontSize="13">
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>Each kind of AI is stopped by the control Microsoft documents for it</text>
    <g data-part="" fontSize="11" fill={quiet}><text x="24" y="56">WHAT</text><text x="300" y="56">HOW</text><text x="700" y="56">GROUP</text></g>
    {rows.map(([what, how, level], i) => <g key={what} data-part=""><rect x="24" y={68 + i * 38} width="712" height="32" rx="6" fill={tint} /><text x="36" y={89 + i * 38} fontWeight="600" fontSize="12.5" fill={ink}>{what}</text><text x="300" y={89 + i * 38} fontSize="12" fill={quiet}>{how}</text><text x="700" y={89 + i * 38} fontSize="11.5" fontWeight="600" fill={accent}>{level}</text></g>)}
    <g data-part="" fontSize="11.5" fill={quiet}><text x="24" y="312">Layers back each other up. Never used: the hosts file, patched system files, kernel drivers, or any block on Microsoft’s own servers.</text></g>
  </svg>
}

export function FeedDiagram() {
  const box = (x: number, main = false) => <rect x={x} y="70" width="128" height="68" rx="8" fill={main ? accent : 'none'} fillOpacity={main ? 0.12 : 1} stroke={main ? accent : edge} strokeWidth={main ? 2 : 1.25} />
  return <svg viewBox="0 0 760 242" role="img" aria-label="A second PC finds new AI app versions and sites, tests them in virtual machines and opens a pull request; Steven reviews and signs; each PC verifies the signature before applying" fontSize="13"><Arrow id="feed-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>The paid value is a list that stays current, and every step leaves evidence</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M152 104H174" markerEnd="url(#feed-arrow)" /><path d="M304 104H326" markerEnd="url(#feed-arrow)" /><path d="M456 104H478" markerEnd="url(#feed-arrow)" /><path d="M608 104H630" markerEnd="url(#feed-arrow)" /></g>
    <g data-part="">{box(24)}<text x="88" y="96" textAnchor="middle" fontWeight="600" fill={ink}>Rule station</text><text x="88" y="113" textAnchor="middle" fontSize="11" fill={quiet}>finds new AI apps,</text><text x="88" y="127" textAnchor="middle" fontSize="11" fill={quiet}>sites and settings</text></g>
    <g data-part="">{box(176)}<text x="240" y="96" textAnchor="middle" fontWeight="600" fill={ink}>VM evidence</text><text x="240" y="113" textAnchor="middle" fontSize="11" fill={quiet}>Home and Pro:</text><text x="240" y="127" textAnchor="middle" fontSize="11" fill={quiet}>blocked, then undone</text></g>
    <g data-part="">{box(328, true)}<text x="392" y="96" textAnchor="middle" fontWeight="600" fill={ink}>Steven reviews</text><text x="392" y="113" textAnchor="middle" fontSize="11" fill={quiet}>a pull request a week,</text><text x="392" y="127" textAnchor="middle" fontSize="11" fill={quiet}>signs with a hardware key</text></g>
    <g data-part="">{box(480)}<text x="544" y="96" textAnchor="middle" fontWeight="600" fill={ink}>Signed feed</text><text x="544" y="113" textAnchor="middle" fontSize="11" fill={quiet}>feed.aibreaker.org,</text><text x="544" y="127" textAnchor="middle" fontSize="11" fill={quiet}>versions only go up</text></g>
    <g data-part="">{box(632)}<text x="696" y="96" textAnchor="middle" fontWeight="600" fill={ink}>Each PC</text><text x="696" y="113" textAnchor="middle" fontSize="11" fill={quiet}>checks the signature,</text><text x="696" y="127" textAnchor="middle" fontSize="11" fill={quiet}>applies tightening only</text></g>
    <g data-part="" fontSize="11.5" fill={quiet}><text x="24" y="172">The station’s research agent has no rights to the virtual machines and no GitHub token; a deterministic runner checks its requests.</text><text x="24" y="190">Nobody on the station can sign a release or push to main.</text><text x="24" y="212">The feed can add domains, app identities and prebuilt App Control policies, never a registry target or a signing key.</text><text x="24" y="230">A PC whose list is more than 21 days old says so. Anything a release would block less waits for the person’s next change.</text></g>
  </svg>
}
