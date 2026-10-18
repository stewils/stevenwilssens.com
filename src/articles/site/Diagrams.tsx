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
