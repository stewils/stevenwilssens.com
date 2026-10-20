import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { about } from '../resume'
import { makeMcp, makeResume } from '../test/admin-fixtures'
import { ResumePage } from './ResumePage'
import type { Proposal, ResumeReport } from './types'
import { whereOf } from './where'

afterEach(cleanup)

const base = makeResume().report!
const withReport = (report: Partial<ResumeReport> | null, history = makeResume().history) => makeResume({ report: report && { ...base, ...report }, history })
const card = (name: string) => within(screen.getByRole('heading', { level: 2, name }).closest('section')!)

describe('Résumé page', () => {
  it('shows the ATS score, its counts and how it compares with the résumé live before', () => {
    const { container } = render(<ResumePage resume={makeResume()} proposals={makeMcp().proposals} />)
    const score = card('ATS score')
    expect(container.querySelector('.score-ring')).toHaveClass('good')
    expect(score.getByText('of 100')).toBeInTheDocument()
    expect(score.getByText(/warning for an applicant tracking system · 2 pages · 117 KB/)).toBeInTheDocument()
    expect(score.getByText(/errors ·/)).toBeInTheDocument()
    expect(score.getByText("1 more finding from a recruiter's reading or against the site, listed below; they do not change the score.")).toBeInTheDocument()
    expect(score.getByText('Higher than the résumé live before this one: 90 → 95.')).toHaveClass('good')
    expect(score.getByText('The PDF matches src/resume.ts. Built from “Sharper headline”.')).toBeInTheDocument()
    expect(score.getByText(/^Checked /)).toBeInTheDocument()
    expect(score.getByRole('link', { name: 'Open the PDF' })).toHaveAttribute('href', '/steven-wilssens-resume-2026.pdf')
  })

  it('explains the score as a list: what costs 25 points, what costs 5, and what does not count', () => {
    const { container } = render(<ResumePage resume={makeResume()} proposals={makeMcp().proposals} />)
    const rules = container.querySelector('dl.rules')!
    const terms = [...rules.querySelectorAll('dt')].map((term) => term.textContent)
    expect(terms).toEqual(['Error 25 points each', 'Warning 5 points each', 'Recruiter no points', 'Site no points', 'When it is checked', 'What to fix'])
    expect(within(rules as HTMLElement).getByText('More than two pages')).toBeInTheDocument()
    expect(within(rules as HTMLElement).getByText('A file over 1.5 MB')).toBeInTheDocument()
    expect(within(rules as HTMLElement).getByText(/Never the PDF, never the checker/)).toBeInTheDocument()
  })

  it('warns about a lower score, a PDF that drifted from the data, and counts old reports without lenses', () => {
    const { container } = render(<ResumePage resume={withReport({ score: 60, ats: undefined, errors: 1, warnings: 3, pages: 1, bytes: undefined, matchesSite: false, commitMessage: null, checkedAt: undefined, baseline: { source: 'main', score: 70, change: -10, lower: true, verdict: 'lower' }, findings: [{ severity: 'warn', lens: 'site', id: 'a', message: 'a' }, { severity: 'warn', lens: 'recruiter', id: 'b', message: 'b' }] })} proposals={[]} />)
    const score = card('ATS score')
    expect(container.querySelector('.score-ring')).toHaveClass('bad')
    expect(score.getByText(/error · /)).toBeInTheDocument()
    expect(score.getByText(/warnings for an applicant tracking system · 1 page · 0 KB/)).toBeInTheDocument()
    expect(score.getByText(/^2 more findings/)).toBeInTheDocument()
    expect(score.getByText('Lower than the résumé live before this one: 70 → 60.')).toHaveClass('bad')
    expect(score.getByText('The PDF does not match src/resume.ts: run npm run resume:build.')).toBeInTheDocument()
    expect(score.queryByText(/^Checked /)).not.toBeInTheDocument()
  })

  it('says when the score did not move, or when there was nothing to compare with', () => {
    const { container, rerender } = render(<ResumePage resume={withReport({ score: 80, ats: undefined, errors: undefined, warnings: undefined, baseline: { source: 'main', score: 80, change: 0, lower: false, verdict: 'unchanged' } })} proposals={[]} />)
    expect(container.querySelector('.score-ring')!.className).toBe('score-ring ')
    expect(screen.getByText('Same score as the résumé live before this one (80).')).toBeInTheDocument()
    expect(screen.getByText(/^0 errors|errors · /)).toBeInTheDocument()
    rerender(<ResumePage resume={withReport({ baseline: null })} proposals={[]} />)
    expect(screen.getByText('Not compared with the live résumé: this build had no baseline.')).toBeInTheDocument()
  })

  it('lists the findings that count, with who trips over them, and the notes apart', () => {
    render(<ResumePage resume={makeResume()} proposals={[]} />)
    const findings = within(screen.getByRole('table', { name: 'Résumé findings' }))
    expect(findings.getByText('ATS')).toHaveAttribute('title', 'Counts for the ATS score')
    expect(findings.getByText('Recruiter')).toHaveAttribute('title', 'Does not change the score')
    expect(findings.getByText('Error')).toHaveClass('badge', 'error')
    expect(findings.getAllByText('Warning')).toHaveLength(2)
    expect(findings.getByText('—')).toBeInTheDocument()
    fireEvent.click(findings.getByRole('button', { name: 'Severity' }))
    expect(findings.getAllByRole('row')[3]).toHaveTextContent('Error')
    fireEvent.click(findings.getByRole('button', { name: 'Who trips' }))
    expect(screen.getByText('1 note that does not change the score')).toBeInTheDocument()
    expect(screen.getByText('A reworded bullet')).toBeInTheDocument()
  })

  it('says when every check passes, and counts several notes', () => {
    render(<ResumePage resume={withReport({ findings: [{ severity: 'info', id: 'n1', message: 'one' }, { severity: 'info', id: 'n2', message: 'two' }], questions: [] })} proposals={[]} />)
    expect(screen.getByText('Nothing to fix: every check passes.')).toBeInTheDocument()
    expect(screen.getByText('2 notes that do not change the score')).toBeInTheDocument()
    expect(card('Questions for you').getByText('Nothing open.')).toBeInTheDocument()
  })

  it('explains what to do when the deployment has no report', () => {
    render(<ResumePage resume={withReport(null, [])} proposals={null} />)
    expect(screen.getByText(/No résumé report in this deployment/)).toBeInTheDocument()
    expect(screen.getByText('No report to show.')).toBeInTheDocument()
    expect(card('Questions for you').getByText('Nothing open.')).toBeInTheDocument()
    expect(card('Proposals from Claude').getByText('Loading…')).toBeInTheDocument()
    expect(screen.getByText(/Nothing recorded yet/)).toBeInTheDocument()
  })

  it('lists the questions the data raises', () => {
    render(<ResumePage resume={makeResume()} proposals={[]} />)
    const questions = card('Questions for you')
    expect(questions.getByText('dates')).toHaveClass('badge')
    expect(questions.getByText(/What happened between 2019 and 2020\?/)).toBeInTheDocument()
  })

  it("lists Claude's proposals with the change side by side", () => {
    render(<ResumePage resume={makeResume()} proposals={makeMcp().proposals} />)
    const proposals = within(screen.getByRole('table', { name: 'Résumé proposals' }))
    const replace = proposals.getByText('Led the team').closest('tr')!
    expect(within(replace).getByText('proposed')).toHaveClass('badge', 'proposed')
    expect(replace).toHaveTextContent('csx-datareplace')
    expect(replace).toHaveTextContent('Led the teamLed 12 product managers')
    const add = proposals.getByText('Product leader').closest('tr')!
    expect(add).toHaveTextContent('profileheadline · add')
    expect(add).toHaveTextContent('Note: Yes, go')
    expect(proposals.getByText('An old bullet').tagName).toBe('S')
  })

  it('says when Claude has not proposed anything', () => {
    render(<ResumePage resume={makeResume()} proposals={[]} />)
    expect(screen.getByText(/None yet\. When you wrap up a session/)).toBeInTheDocument()
  })

  it('charts the score of every update and lists them newest first with the change', () => {
    render(<ResumePage resume={makeResume()} proposals={[]} />)
    expect(screen.getByText('Now 95 · best 100')).toBeInTheDocument()
    const history = within(screen.getByRole('table', { name: 'Résumé score history' }))
    const rows = history.getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell')[1].textContent)).toEqual(['95 -5', '100 +20', '80 '])
    expect(within(rows[0]).getByText('-5')).toHaveClass('delta', 'bad')
    expect(within(rows[1]).getByText('+20')).toHaveClass('delta', 'good')
    expect(rows[0]).toHaveTextContent('Sharper headline · abcdef1')
    expect(rows[1]).toHaveTextContent('2.5 MB')
    fireEvent.click(rows[0])
    expect(screen.getByText('Keyword missing')).toBeInTheDocument()
    expect(screen.getByText('odd')).toHaveClass('badge', 'odd')
    fireEvent.click(rows[1])
    expect(screen.getByText('No findings for this résumé.')).toBeInTheDocument()
  })

  it('leaves the chart out with a single update', () => {
    render(<ResumePage resume={makeResume({ history: makeResume().history.slice(0, 1) })} proposals={[]} />)
    expect(screen.queryByText(/^Now /)).not.toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(4 + 2)
  })
})

describe('About proposals on the Résumé page', () => {
  const row = (id: number, extra: Partial<Proposal>): Proposal => ({ id, updatedAt: id, role: 'about', field: 'paragraph', kind: 'replace', currentText: null, proposedText: 'New text.', rationale: 'r', status: 'proposed', decisionNote: null, ...extra })
  const rows = [
    row(10, { field: 'intro', currentText: about.intro, proposedText: 'A sharper intro.' }),
    row(11, { currentText: about.paragraphs[1], proposedText: 'A sharper second paragraph.' }),
    row(12, { kind: 'add', currentText: about.paragraphs[0], proposedText: 'A paragraph to add.' }),
    row(13, { currentText: 'A paragraph that is no longer on the page.', proposedText: '<b>x</b>' }),
    ...makeMcp().proposals,
  ]

  it('names the About page in the Where column from fixed words, and shows the texts as text (AC-15, T-9)', () => {
    const { container } = render(<ResumePage resume={makeResume()} proposals={rows} />)
    const table = within(screen.getByRole('table', { name: 'Résumé proposals' }))
    const whereOfRow = (text: string) => within(table.getByText(text).closest('tr')!).getAllByRole('cell')[1].textContent
    expect(whereOfRow('A sharper intro.')).toBe('About pageline under the title · replace')
    expect(whereOfRow('A sharper second paragraph.')).toBe('About pageparagraph 2 · replace')
    expect(whereOfRow('A paragraph to add.')).toBe('About pagenew paragraph · add')
    expect(whereOfRow('<b>x</b>')).toBe('About pageparagraph · replace')
    expect(container.querySelector('td b')).toBeNull()
    // Résumé rows keep their key.
    expect(whereOfRow('Led 12 product managers')).toBe('csx-datareplace')
    // Searching "about" finds the About rows only.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'about page' } })
    expect(table.getAllByRole('row').slice(1)).toHaveLength(4)
  })

  it('reads a place from a proposal, with the paragraph counted from the page as deployed', () => {
    expect(whereOf({ role: 'about', field: 'paragraph', kind: 'remove', currentText: ' Second’s  “one”. ' }, ['First.', "Second's \"one\"."])).toEqual({ place: 'About page', part: 'paragraph 2', kind: 'remove' })
    expect(whereOf({ role: 'about', field: 'paragraph', kind: 'replace', currentText: null }, ['First.'])).toEqual({ place: 'About page', part: 'paragraph', kind: 'replace' })
    expect(whereOf({ role: 'about', field: 'title', kind: 'replace', currentText: 'x' })).toEqual({ place: 'About page', part: null, kind: 'replace' })
    expect(whereOf({ role: 'csx-data', field: 'point', kind: 'add', currentText: null })).toEqual({ place: 'csx-data', part: null, kind: 'add' })
    expect(whereOf({ role: 'csx-data', field: 'title', kind: 'replace', currentText: null })).toEqual({ place: 'csx-data', part: 'title', kind: 'replace' })
  })

  it('says the empty table covers the résumé and the About page', () => {
    render(<ResumePage resume={makeResume()} proposals={[]} />)
    expect(screen.getByText('None yet. When you wrap up a session, Claude proposes edits to the résumé and the About page; they show up here.')).toBeInTheDocument()
  })
})
