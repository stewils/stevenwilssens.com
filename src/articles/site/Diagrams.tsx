// Diagrams for the Building steven.wilssens.com write-up, as plain SVG. Same conventions
// as the wilssens.com article: colours from the --d-* variables in article.css, and each
// <g data-part> is one part of a drawing that article.ts staggers in on scroll.

const ink = 'var(--d-ink)', quiet = 'var(--d-quiet)', edge = 'var(--d-edge)', grid = 'var(--d-grid)', accent = 'var(--d-accent)'
const good = 'var(--d-good)', bad = 'var(--d-bad)'

const Arrow = ({ id }: { id: string }) => <defs><marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={edge} /></marker></defs>

// One file about Steven, five things built from it.
export function SourceOfTruthDiagram() {
  const out = (x: number, title: string, line: string) => <g data-part=""><rect x={x} y="236" width="136" height="72" rx="8" fill="none" stroke={edge} strokeWidth="1.25" /><text x={x + 68} y="262" textAnchor="middle" fontWeight="600" fill={ink}>{title}</text><text x={x + 68} y="282" textAnchor="middle" fontSize="11.5" fill={quiet}>{line}</text></g>
  return <svg viewBox="0 0 760 352" role="img" aria-label="One file, src/resume.ts, is the source for the pages, the résumé PDF, the Markdown copies, the assistant and the MCP server" fontSize="13"><Arrow id="sot-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>One file about me, five things built from it</text>
    <g data-part=""><rect x="180" y="56" width="400" height="104" rx="10" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="2" /><text x="200" y="84" fontWeight="600" fill={ink}>src/resume.ts</text><text x="200" y="106" fontSize="11.5" fill={quiet}>profile · roles with stable keys · impact numbers, each with its bullet</text><text x="200" y="124" fontSize="11.5" fill={quiet}>skills · selected work · honors · education · recommendations · press</text><text x="200" y="146" fontSize="11.5" fill={ink}>Never a fact about me anywhere else.</text></g>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M380 160V196" /><path d="M92 196H668" /><path d="M92 196V236" markerEnd="url(#sot-arrow)" /><path d="M236 196V236" markerEnd="url(#sot-arrow)" /><path d="M380 196V236" markerEnd="url(#sot-arrow)" /><path d="M524 196V236" markerEnd="url(#sot-arrow)" /><path d="M668 196V236" markerEnd="url(#sot-arrow)" /></g>
    {out(24, 'The pages', 'prerendered HTML')}
    {out(168, 'The résumé PDF', 'rendered and scored')}
    {out(312, 'Markdown + llms.txt', 'one copy per page')}
    {out(456, 'The assistant', 'its system prompt')}
    {out(600, 'The MCP server', 'review and proposals')}
    <g data-part=""><text x="380" y="338" textAnchor="middle" fontSize="11.5" fill={quiet}>The tests fail when the PDF no longer matches the file, so a content change always comes with a new résumé.</text></g>
  </svg>
}

// A new PDF replaces the current one only when its score does not drop.
export function ResumeGateDiagram() {
  const box = (x: number, y: number, w: number, main = false) => <rect x={x} y={y} width={w} height="56" rx="8" fill={main ? accent : 'none'} fillOpacity={main ? 0.12 : 1} stroke={main ? accent : edge} strokeWidth={main ? 2 : 1.25} />
  return <svg viewBox="0 0 760 308" role="img" aria-label="The résumé build scores the new PDF and the current one and only replaces the file when the score does not drop" fontSize="13"><Arrow id="gate-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>A new résumé has to score at least as well as the one it replaces</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M164 108H196" markerEnd="url(#gate-arrow)" /><path d="M336 108H368" markerEnd="url(#gate-arrow)" /><path d="M548 92H584" markerEnd="url(#gate-arrow)" /><path d="M548 124H584" markerEnd="url(#gate-arrow)" /><path d="M458 136V180" /><path d="M458 180H176" /><path d="M176 180V164" markerEnd="url(#gate-arrow)" /></g>
    <g data-part="">{box(24, 80, 140)}<text x="94" y="104" textAnchor="middle" fontWeight="600" fill={ink}>Edit the data</text><text x="94" y="122" textAnchor="middle" fontSize="11.5" fill={quiet}>src/resume.ts</text></g>
    <g data-part="">{box(196, 80, 140)}<text x="266" y="104" textAnchor="middle" fontWeight="600" fill={ink}>Render the PDF</text><text x="266" y="122" textAnchor="middle" fontSize="11.5" fill={quiet}>HTML to PDF, headless</text></g>
    <g data-part="">{box(368, 80, 180, true)}<text x="458" y="104" textAnchor="middle" fontWeight="600" fill={ink}>Score both files</text><text x="458" y="122" textAnchor="middle" fontSize="11.5" fill={quiet}>100 − 25 per error − 5 per warning</text></g>
    <g data-part=""><rect x="584" y="66" width="152" height="40" rx="8" fill={good} fillOpacity="0.12" stroke={good} strokeWidth="1.5" /><text x="660" y="91" textAnchor="middle" fontWeight="600" fill={ink}>Same or better: replace</text></g>
    <g data-part=""><rect x="584" y="112" width="152" height="40" rx="8" fill={bad} fillOpacity="0.12" stroke={bad} strokeWidth="1.5" /><text x="660" y="137" textAnchor="middle" fontWeight="600" fill={ink}>Lower: keep the current</text></g>
    <g data-part="" fontSize="11.5" fill={quiet}><text x="300" y="200" textAnchor="middle">The findings name the data to fix: a role, a date, a number without a bullet. Never the checker.</text></g>
    <g data-part=""><rect x="24" y="222" width="712" height="66" rx="8" fill="none" stroke={grid} strokeDasharray="4 4" /><text x="40" y="244" fontSize="12" fontWeight="600" fill={ink}>What the score reads</text><text x="40" y="262" fontSize="11.5" fill={quiet}>Pages and file size · extractable text and glyphs · contact details · headline and summary · every role, company and date</text><text x="40" y="278" fontSize="11.5" fill={quiet}>the bullets of the two latest roles · tense · team size · keywords recruiters search for · numbers with context</text></g>
  </svg>
}

// From a question nobody could answer to a change on the site, with a person deciding twice.
export function LoopDiagram() {
  const step = (x: number, y: number, title: string, line: string, main = false) => <g data-part=""><rect x={x} y={y} width="160" height="60" rx="8" fill={main ? accent : 'none'} fillOpacity={main ? 0.12 : 1} stroke={main ? accent : edge} strokeWidth={main ? 2 : 1.25} /><text x={x + 80} y={y + 25} textAnchor="middle" fontWeight="600" fill={ink}>{title}</text><text x={x + 80} y={y + 44} textAnchor="middle" fontSize="11.5" fill={quiet}>{line}</text></g>
  return <svg viewBox="0 0 760 360" role="img" aria-label="The loop: a visitor's question the assistant could not answer becomes an interview question, a dossier entry, a résumé proposal, a pull request made by Claude Code, and after Steven merges it, a change on the site" fontSize="13"><Arrow id="loop-arrow" />
    <text x="24" y="30" fontSize="15" fontWeight="600" fill={ink}>From a question nobody could answer to a change on the site</text>
    <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M184 90H216" markerEnd="url(#loop-arrow)" /><path d="M376 90H408" markerEnd="url(#loop-arrow)" /><path d="M568 90H600" markerEnd="url(#loop-arrow)" /><path d="M680 120V150H104V180" markerEnd="url(#loop-arrow)" /><path d="M184 210H216" markerEnd="url(#loop-arrow)" /><path d="M376 210H408" markerEnd="url(#loop-arrow)" /><path d="M568 210H600" markerEnd="url(#loop-arrow)" /><path d="M680 240V300H104V270" markerEnd="url(#loop-arrow)" /></g>
    {step(24, 60, 'A visitor asks', 'the assistant on the site')}
    {step(216, 60, 'No answer in the notes', 'the question is saved')}
    {step(408, 60, 'Claude interviews me', 'in my private MCP, as a recruiter')}
    {step(600, 60, 'The dossier grows', '22 entries, 9 public')}
    {step(24, 180, 'A résumé proposal', 'current text, new text, why')}
    {step(216, 180, 'I approve or reject', 'in the conversation', true)}
    {step(408, 180, 'Claude Code edits', 'on a branch, under checks')}
    {step(600, 180, 'I merge the pull request', 'after the preview', true)}
    <g data-part="" fontSize="11.5" fill={quiet} textAnchor="middle"><text x="392" y="318">Deploy: the pages, the PDF, the Markdown copies and the assistant change together, and I get an email when the résumé is live.</text><text x="392" y="340">The question that started it is now answered, on the site and in the assistant.</text></g>
  </svg>
}


// How a change reaches main: the team of agents from the ask to the deploy, with a person
// deciding at the questions and the merge (.claude/team.md, .github/workflows/review.yml).
// Two drawings of the same flow: across on a wide screen, stacked on a phone (article.css
// shows one of them), so it is readable at 390px without swiping.
const flowTitle = 'How a change reaches the site: a team of AI agents, and Steven deciding'
const flowDescription = 'Steven asks. A product manager agent writes the spec with a recruiter and a designer; a security engineer, a tester and a developer add their sections. Steven’s open questions are asked once, all together. A developer builds it with its tests. Six reviews run in parallel, by fresh agents that did not write the code: code, security, tests at 90% coverage per file, design with screenshots, the recruiter’s check that the site is not worse, and the product manager’s acceptance check. Changes go back to the developer for at most three rounds. The pull request has a required Review check that runs main’s gates and the team review. Steven merges, and the site deploys.'
const flowSteps: { title: string; lines: string[]; main?: boolean }[] = [
  { title: 'I ask', lines: ['in Claude, the MCP or a refresh'], main: true },
  { title: 'Spec', lines: ['PM with recruiter and designer;', 'security, test, dev add theirs'] },
  { title: 'My questions', lines: ['asked once, all together'], main: true },
  { title: 'Build', lines: ['developer, with tests'] },
  { title: 'Pull request', lines: ['required Review check:', 'main’s gates + team review'] },
  { title: 'I merge', lines: ['after the preview'], main: true },
  { title: 'Deploy', lines: ['steven.wilssens.com'] },
]
const reviews = ['code review', 'security', 'tests, 90% a file', 'design + screenshots', 'recruiter: not worse', 'PM: acceptance']
const fixLoop = 'Changes asked: fix and review again, at most three rounds'
const flowFooter = 'The agents check each other; I answer the questions and decide the merge.'

function FlowBox({ x, y, w, step }: { x: number; y: number; w: number; step: (typeof flowSteps)[number] }) {
  return <g data-part=""><rect x={x} y={y} width={w} height="68" rx="8" fill={step.main ? accent : 'none'} fillOpacity={step.main ? 0.12 : 1} stroke={step.main ? accent : edge} strokeWidth={step.main ? 2 : 1.25} /><text x={x + w / 2} y={y + 24} textAnchor="middle" fontWeight="600" fill={ink}>{step.title}</text>{step.lines.map((line, i) => <text key={line} x={x + w / 2} y={y + 42 + i * 15} textAnchor="middle" fontSize="11.5" fill={quiet}>{line}</text>)}</g>
}

function Reviews({ x, y, w, chipWidth }: { x: number; y: number; w: number; chipWidth: number }) {
  const gap = w - 32 - 2 * chipWidth
  return <g data-part=""><rect x={x} y={y} width={w} height="140" rx="8" fill="none" stroke={edge} strokeWidth="1.25" /><text x={x + w / 2} y={y + 22} textAnchor="middle" fontWeight="600" fill={ink}>Six reviews, in parallel</text><text x={x + w / 2} y={y + 38} textAnchor="middle" fontSize="11.5" fill={quiet}>fresh agents that did not write the code</text>
    {reviews.map((label, i) => { const cx = x + 16 + (i % 2) * (chipWidth + gap), cy = y + 48 + Math.floor(i / 2) * 30; return <g key={label}><rect x={cx} y={cy} width={chipWidth} height="24" rx="12" fill="none" stroke={edge} strokeWidth="1" /><text x={cx + chipWidth / 2} y={cy + 16} textAnchor="middle" fontSize="11.5" fill={ink}>{label}</text></g> })}</g>
}

export function TeamFlowDiagram() {
  const [ask, spec, questions, build, pullRequest, merge, deploy] = flowSteps
  // Stacked: one column of boxes 20px apart; the reviews box sits after the build.
  const tall = [ask, spec, questions, build, null, pullRequest, merge, deploy]
  const tops: number[] = []
  let y = 52
  for (const step of tall) { tops.push(y); y += (step ? 68 : 140) + (step === null ? 44 : 20) }
  const tallHeight = y + 30
  return <>
    <svg className="wx-flow-wide" viewBox="0 0 640 484" role="img" aria-label={flowTitle} aria-describedby="team-wide-desc" fontSize="13"><Arrow id="team-wide-arrow" />
      <title>{flowTitle}</title><desc id="team-wide-desc">{flowDescription}</desc>
      <text x="16" y="30" fontSize="15" fontWeight="600" fill={ink}>Every change, through a team of agents</text>
      <g data-part="" fill="none" stroke={edge} strokeWidth="1.25"><path d="M208 90H224" markerEnd="url(#team-wide-arrow)" /><path d="M416 90H432" markerEnd="url(#team-wide-arrow)" /><path d="M528 124V144H96V164" markerEnd="url(#team-wide-arrow)" /><path d="M176 198H240" markerEnd="url(#team-wide-arrow)" /><path d="M300 304V324H96V232" markerEnd="url(#team-wide-arrow)" /><path d="M560 304V356H144V372" markerEnd="url(#team-wide-arrow)" /><path d="M272 406H304" markerEnd="url(#team-wide-arrow)" /><path d="M464 406H496" markerEnd="url(#team-wide-arrow)" /></g>
      <FlowBox x={16} y={56} w={192} step={ask} /><FlowBox x={224} y={56} w={192} step={spec} /><FlowBox x={432} y={56} w={192} step={questions} />
      <FlowBox x={16} y={164} w={160} step={build} />
      <Reviews x={240} y={164} w={384} chipWidth={172} />
      <g data-part="" fontSize="11.5" fill={quiet}><text x="104" y="342">{fixLoop}</text></g>
      <FlowBox x={16} y={372} w={256} step={pullRequest} /><FlowBox x={304} y={372} w={160} step={merge} /><FlowBox x={496} y={372} w={128} step={deploy} />
      <g data-part="" fontSize="11.5" fill={quiet} textAnchor="middle"><text x="320" y="472">{flowFooter}</text></g>
    </svg>
    <svg className="wx-flow-tall" viewBox={`0 0 340 ${tallHeight}`} role="img" aria-label={flowTitle} aria-describedby="team-tall-desc" fontSize="13"><Arrow id="team-tall-arrow" />
      <title>{flowTitle}</title><desc id="team-tall-desc">{flowDescription}</desc>
      <text x="16" y="28" fontSize="15" fontWeight="600" fill={ink}>Every change, through a team of agents</text>
      <g data-part="" fill="none" stroke={edge} strokeWidth="1.25">
        {tall.slice(0, -1).map((step, i) => { const from = tops[i] + (step ? 68 : 140) + (step === null ? 24 : 0); return <path key={i} d={`M170 ${from}V${tops[i + 1]}`} markerEnd="url(#team-tall-arrow)" /> })}
        <path d={`M24 ${tops[4] + 140}V${tops[4] + 152}H6V${tops[3] + 34}H16`} markerEnd="url(#team-tall-arrow)" />
      </g>
      {tall.map((step, i) => step ? <FlowBox key={step.title} x={16} y={tops[i]} w={308} step={step} /> : <Reviews key="reviews" x={16} y={tops[i]} w={308} chipWidth={134} />)}
      <g data-part="" fontSize="11" fill={quiet}><text x="30" y={tops[4] + 156}>Fix and review again, at most three rounds</text></g>
      <g data-part="" fontSize="11.5" fill={quiet} textAnchor="middle"><text x="170" y={y + 4}>The agents check each other;</text><text x="170" y={y + 20}>I answer the questions and decide the merge.</text></g>
    </svg>
  </>
}
