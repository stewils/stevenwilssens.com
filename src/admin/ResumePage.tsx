import type { CSSProperties } from 'react'
import { TrendChart } from './Charts'
import { DataTable, type Column } from './DataTable'
import { formatBytes, formatDay, formatNumber, formatTime } from './format'
import type { Finding, Proposal, ResumeInfo, ScoreRow } from './types'
import { whereOf } from './where'

export const resumePdf = '/steven-wilssens-resume-2026.pdf'

const severityLabel = { error: 'Error', warn: 'Warning', info: 'Note' } as const
const lensLabel = { ats: 'ATS', site: 'Site', recruiter: 'Recruiter' } as const
const findingColumns: Column<Finding>[] = [
  { key: 'severity', label: 'Severity', value: (row) => (row.severity === 'error' ? 1 : 2), render: (row) => <span className={`badge ${row.severity}`}>{severityLabel[row.severity]}</span> },
  { key: 'lens', label: 'Who trips', value: (row) => (row.lens === 'ats' ? 1 : 2), render: (row) => (row.lens ? <span className={`badge ${row.lens === 'ats' ? '' : 'info'}`} title={row.lens === 'ats' ? 'Counts for the ATS score' : 'Does not change the score'}>{lensLabel[row.lens]}</span> : <span className="muted">—</span>) },
  { key: 'message', label: 'Finding', value: (row) => row.message },
  { key: 'id', label: 'Check', value: (row) => row.id, className: 'muted' },
]

const proposalColumns: Column<Proposal>[] = [
  { key: 'status', label: 'Status', value: (row) => row.status, render: (row) => <span className={`badge ${row.status}`}>{row.status}</span> },
  { key: 'role', label: 'Where', value: (row) => { const where = whereOf(row); return `${where.place} ${where.part ?? ''} ${where.kind}` }, strong: true, render: (row) => { const where = whereOf(row); return <>{where.place}<small className="muted"><br />{where.part ? `${where.part} · ` : ''}{where.kind}</small></> } },
  { key: 'change', label: 'Change', value: (row) => `${row.currentText ?? ''} ${row.proposedText ?? ''}`, render: (row) => <>{row.currentText && <s className="muted">{row.currentText}</s>}{row.currentText && row.proposedText && <br />}{row.proposedText}{row.decisionNote && <small className="muted"><br />Note: {row.decisionNote}</small>}</> },
  { key: 'rationale', label: 'Why', value: (row) => row.rationale },
  { key: 'updatedAt', label: 'Updated', value: (row) => row.updatedAt, render: (row) => formatTime(row.updatedAt) },
]

type HistoryRow = ScoreRow & { change: number | null }
const delta = (change: number | null) => (change === null || change === 0 ? '' : <span className={`delta ${change > 0 ? 'good' : 'bad'}`}>{change > 0 ? `+${change}` : change}</span>)
const historyColumns: Column<HistoryRow>[] = [
  { key: 'firstSeen', label: 'Live since', value: (row) => row.firstSeen, render: (row) => formatDay(row.firstSeen) },
  { key: 'score', label: 'Score', value: (row) => row.score, num: true, strong: true, render: (row) => <>{row.score} {delta(row.change)}</> },
  { key: 'errors', label: 'Errors', value: (row) => row.errors, num: true },
  { key: 'warnings', label: 'Warnings', value: (row) => row.warnings, num: true },
  { key: 'pages', label: 'Pages', value: (row) => row.pages, num: true },
  { key: 'bytes', label: 'Size', value: (row) => row.bytes, num: true, render: (row) => formatBytes(row.bytes) },
  { key: 'commit', label: 'Change', value: (row) => `${row.commitMessage ?? ''} ${row.commit ?? ''}`, render: (row) => <>{row.commitMessage ?? <span className="muted">—</span>}{row.commit && <small className="muted"> · {row.commit.slice(0, 7)}</small>}</> },
]

// The résumé: its ATS score for this deployment (what an applicant tracking system
// makes of the PDF), what to fix, the questions the data raises, the proposals Claude
// made in the MCP, and the score of every résumé that went live (recorded by
// functions/_lib/resume-scores.ts).
export function ResumePage({ resume, proposals }: { resume: ResumeInfo; proposals: Proposal[] | null }) {
  const report = resume.report
  const findings = report?.findings.filter((finding) => finding.severity !== 'info') ?? []
  const notes = report?.findings.filter((finding) => finding.severity === 'info') ?? []
  // Reports from before the lenses have no ats counts; then every finding counted.
  const ats = report?.ats ?? { errors: report?.errors ?? 0, warnings: report?.warnings ?? 0 }
  const others = findings.filter((finding) => finding.lens && finding.lens !== 'ats').length
  const oldestFirst = [...resume.history].sort((a, b) => a.firstSeen - b.firstSeen)
  const history: HistoryRow[] = oldestFirst.map((row, index) => ({ ...row, change: index ? row.score - oldestFirst[index - 1].score : null })).reverse()
  const baseline = report?.baseline
  return (
    <>
      <section className="card" data-part="Score">
        <div className="card-head"><h2>ATS score</h2>{report?.checkedAt && <span className="updated">Checked {formatTime(Date.parse(report.checkedAt))}</span>}</div>
        {!report ? <p className="empty">No résumé report in this deployment. The build writes it (dist/resume-report.json); deploy main again.</p> : (
          <div className="score">
            <div className={`score-ring ${report.score >= 90 ? 'good' : report.score >= 70 ? '' : 'bad'}`} style={{ '--pct': report.score } as CSSProperties}><strong>{report.score}<small>of 100</small></strong></div>
            <div className="score-facts">
              <span><b>{ats.errors}</b> {ats.errors === 1 ? 'error' : 'errors'} · <b>{ats.warnings}</b> {ats.warnings === 1 ? 'warning' : 'warnings'} for an applicant tracking system · {report.pages} {report.pages === 1 ? 'page' : 'pages'} · {formatBytes(report.bytes ?? 0)}</span>
              {others > 0 && <span className="muted">{others} more {others === 1 ? 'finding' : 'findings'} from a recruiter's reading or against the site, listed below; they do not change the score.</span>}
              {baseline
                ? <span className={`delta ${baseline.lower ? 'bad' : 'good'}`}>{baseline.verdict === 'unchanged' ? `Same score as the résumé live before this one (${baseline.score}).` : `${baseline.lower ? 'Lower' : 'Higher'} than the résumé live before this one: ${baseline.score} → ${report.score}.`}</span>
                : <span className="muted">Not compared with the live résumé: this build had no baseline.</span>}
              <span className="muted">{report.matchesSite === false ? 'The PDF does not match src/resume.ts: run npm run resume:build.' : 'The PDF matches src/resume.ts.'}{report.commitMessage ? ` Built from “${report.commitMessage}”.` : ''}</span>
              <span className="actions"><a className="ghost" href={resumePdf} target="_blank" rel="noreferrer">Open the PDF</a><a className="ghost" href="/resume-report.json" target="_blank" rel="noreferrer">The report (JSON)</a></span>
            </div>
          </div>
        )}
        <h3>How the score works</h3>
        <p className="note">The score is what an applicant tracking system makes of the PDF. It starts at 100 and loses points for each thing the system trips over. What a recruiter or the site would add is listed too, but does not count.</p>
        <dl className="rules">
          <dt><span className="badge error">Error</span> 25 points each</dt>
          <dd>
            <ul>
              <li>More than two pages</li>
              <li>Text that cannot be extracted, or broken glyphs</li>
              <li>No email address or LinkedIn</li>
              <li>A role title or company missing from the work history</li>
            </ul>
          </dd>
          <dt><span className="badge warn">Warning</span> 5 points each</dt>
          <dd>
            <ul>
              <li>A section heading it does not recognise (Summary, Skills, Experience, Education, or spelled out letter by letter)</li>
              <li>The name not on the first line</li>
              <li>Dates missing or not in the "Mon YYYY - Mon YYYY" form</li>
              <li>A title far from its dates</li>
              <li>Phone or location missing</li>
              <li>Education incomplete</li>
              <li>A missing keyword</li>
              <li>A file over 1.5 MB</li>
            </ul>
          </dd>
          <dt><span className="badge info">Recruiter</span> no points</dt>
          <dd>What a recruiter or an editor would still say: present tense for a past role, no team size, a number without a bullet behind it.</dd>
          <dt><span className="badge info">Site</span> no points</dt>
          <dd>Where the PDF differs from the site: a reworded bullet, another headline or summary. These fail the tests instead.</dd>
          <dt>When it is checked</dt>
          <dd>
            <ul>
              <li><code>npm run resume:build</code> refuses a PDF that scores worse than the current one</li>
              <li>The Site update workflow compares with main in the pull request</li>
              <li>The Deploy workflow compares with the live site and warns in the run and in your email</li>
            </ul>
          </dd>
          <dt>What to fix</dt>
          <dd>The data in <code>src/resume.ts</code>. Never the PDF, never the checker.</dd>
        </dl>
      </section>

      <section className="card" data-part="Findings">
        <div className="card-head"><h2>Findings</h2></div>
        {report && findings.length === 0 && <p className="all-clear">Nothing to fix: every check passes.</p>}
        {findings.length > 0 && <DataTable columns={findingColumns} rows={findings} rowKey={(row) => row.id} label="Résumé findings" />}
        {!report && <p className="empty">No report to show.</p>}
        {notes.length > 0 && (
          <details className="notes">
            <summary>{notes.length === 1 ? '1 note that does not' : `${notes.length} notes that do not`} change the score</summary>
            <ul>{notes.map((note) => <li key={note.id}>{note.message}</li>)}</ul>
          </details>
        )}
      </section>

      <section className="card" data-part="Questions">
        <div className="card-head"><h2>Questions for you</h2></div>
        <p className="note">What the dates and the numbers raise on their own: gaps and overlaps between roles, numbers without a bullet behind them. Recruiters ask these, so answer them in an MCP session or correct the data.</p>
        {!report || report.questions.length === 0 ? <p className="all-clear">Nothing open.</p> : (
          <ol className="questions">{report.questions.map((question) => <li key={question.question}><span className="badge">{question.about}</span> {question.question}</li>)}</ol>
        )}
      </section>

      <section className="card" data-part="Proposals">
        <div className="card-head"><h2>Proposals from Claude</h2></div>
        <p className="note">At the end of an MCP session Claude compares the dossier with the résumé and proposes edits; you approve or reject them in that conversation. Approved ones reach the site through a site update (request_site_update, several at once) and are marked applied when its pull request merges, or as soon as the résumé is seen to carry them.</p>
        {proposals === null ? <p className="empty">Loading…</p> : <DataTable columns={proposalColumns} rows={proposals} rowKey={(row) => String(row.id)} empty="None yet. When you wrap up a session, Claude proposes edits to the résumé and the About page; they show up here." label="Résumé proposals" />}
      </section>

      <section className="card" data-part="History">
        <div className="card-head"><h2>Every update</h2></div>
        <p className="note">One row per résumé PDF that went live, recorded the first time a deploy served it. The change column is the commit it was built from.</p>
        {history.length === 0 ? <p className="empty">Nothing recorded yet. The first deploy of this version of the site records the résumé that is live.</p> : (
          <>
            {history.length > 1 && <TrendChart title="Score per update" unit="points" max={100} format={String} readout={`Now ${oldestFirst[oldestFirst.length - 1].score} · best ${Math.max(...oldestFirst.map((row) => row.score))}`} points={oldestFirst.map((row) => ({ key: row.pdfHash, label: formatDay(row.firstSeen), value: row.score, detail: `${row.score}/100 · ${formatNumber(row.warnings)} warnings${row.commitMessage ? ` · ${row.commitMessage}` : ''}` }))} />}
            <DataTable columns={historyColumns} rows={history} rowKey={(row) => row.pdfHash} label="Résumé score history" rowName={(row) => `the résumé live since ${formatDay(row.firstSeen)}`} expand={(row) => (row.findings.length ? <ul className="plain">{row.findings.map((finding) => <li key={finding.id}><span className={`badge ${finding.severity}`}>{severityLabel[finding.severity as keyof typeof severityLabel] ?? finding.severity}</span> {finding.message}</li>)}</ul> : <p className="muted">No findings for this résumé.</p>)} />
          </>
        )}
      </section>
    </>
  )
}
