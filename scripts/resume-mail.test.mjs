// @vitest-environment node
// The resume email: the diff of src/resume.ts between two versions, the plain-language
// summary (Claude, or the changes themselves without a key) and the rendered email.
import { describe, expect, it, vi } from 'vitest'
import { diffResume, fallbackSummary, pairEdits, renderEmail, scoreOf, shouldMail, summarize } from './resume-mail.mjs'

const role = (overrides = {}) => ({ key: 'windows-devices-data', role: 'Principal Group Product Manager - Windows & Devices Data', company: 'Microsoft', dates: 'Dec 2024 - Sep 2026', location: 'Redmond, Washington', summary: 'Led product management for Windows & Devices Data.', points: ['Led a team of 10 to 20 product managers.', 'Set the direction for experimentation across Windows.'], ...overrides })
const resume = (overrides = {}) => ({
  profile: { name: 'Steven Wilssens', headline: 'Principal product leader for data and AI', summary: 'Principal product leader with nearly 20 years at Microsoft.', location: 'Seattle, Washington' },
  experiences: [role()],
  impact: [{ value: '1.6B+', label: 'Windows devices informing product decisions', backing: 'windows-devices-data' }],
  skills: ['Product strategy and roadmaps', 'Experimentation and A/B testing'],
  selectedWork: [],
  honors: [['Microsoft Gold Star Award', 'Issued by Microsoft · Jan 2011']],
  education: { degree: 'Bachelor’s degree, Computer Science', school: 'Karel de Grote, Belgium', dates: '2000 - 2004' },
  languages: 'Dutch and English (native), French (intermediate)',
  recommendations: [['Steve Rowe', 'Group Engineering Manager at Microsoft', 'I had the privilege of working with Steven for five years.']],
  news: [],
  ...overrides,
})

describe('diffResume', () => {
  it('finds nothing when nothing changed', () => {
    expect(diffResume(resume(), resume())).toEqual([])
  })

  it('sees a reworded bullet as one change with the old and the new text', () => {
    const after = resume({ experiences: [role({ points: ['Led a team of 10 to 20 product managers across three sites.', 'Set the direction for experimentation across Windows.'] })] })
    const changes = diffResume(resume(), after)
    expect(changes).toEqual([{ section: 'Principal Group Product Manager - Windows & Devices Data at Microsoft', kind: 'changed', what: 'A bullet was reworded', from: 'Led a team of 10 to 20 product managers.', to: 'Led a team of 10 to 20 product managers across three sites.' }])
  })

  it('reports a new role with its bullets, a removed role, changed dates and a changed summary', () => {
    const after = resume({
      profile: { ...resume().profile, summary: 'Principal product leader with nearly 20 years at Microsoft, most recently in AI.' },
      experiences: [
        { key: 'independent-ai-builder', role: 'Independent AI Product Builder', company: 'Independent', dates: 'Oct 2026 - Present', location: 'Seattle, Washington', summary: 'Building AI products independently.', points: ['Building AI Breaker.'] },
        role({ dates: 'Dec 2024 - Aug 2026' }),
      ],
    })
    const changes = diffResume(resume(), after)
    expect(changes.map((change) => [change.section, change.kind, change.what])).toEqual([
      ['Profile', 'changed', 'The summary changed'],
      ['Independent AI Product Builder at Independent', 'added', 'A new role was added'],
      ['Principal Group Product Manager - Windows & Devices Data at Microsoft', 'changed', 'The dates changed'],
    ])
    expect(changes[1].to).toContain('Oct 2026 - Present')
    expect(changes[1].to).toContain('• Building AI Breaker.')
    expect(diffResume(after, resume()).find((change) => change.kind === 'removed')).toMatchObject({ section: 'Independent AI Product Builder at Independent', what: 'The role was removed' })
  })

  it('covers skills, key numbers, honors, education, languages and recommendations', () => {
    const after = resume({
      skills: ['Product strategy and roadmaps', 'Machine learning and AI products'],
      impact: [{ value: '1.6B+', label: 'Windows devices informing product decisions', backing: 'windows-devices-data' }, { value: '15%', label: 'increase in Windows adoption' }],
      honors: [],
      education: { ...resume().education, dates: '2000 - 2003' },
      languages: 'Dutch and English (native), French (fluent)',
      recommendations: [['Steve Rowe', 'Partner Engineering Manager at Microsoft', 'I had the privilege of working with Steven for five years.']],
    })
    const sections = diffResume(resume(), after).map((change) => `${change.section}: ${change.what}`)
    expect(sections).toEqual([
      'Key number: 15% increase in Windows adoption: A new key number was added',
      'Skills: A skill was removed',
      'Skills: A skill was added',
      'Honors: A honor was removed',
      'Education: The dates changed',
      'Languages: The languages line changed',
      'Recommendation from Steve Rowe: The title changed',
    ])
  })

  it('treats a missing version as empty', () => {
    expect(diffResume(null, resume()).some((change) => change.kind === 'added')).toBe(true)
  })
})

describe('shouldMail', () => {
  it('sends nothing when only the About copy changed, and still sends for a change it sees or a new PDF', () => {
    const before = resume({ about: { intro: 'A leader.', paragraphs: ['One.', 'Two.'] } })
    const aboutOnly = resume({ about: { intro: 'A sharper leader.', paragraphs: ['One.', 'Two.', 'Three.'] } })
    expect(diffResume(before, aboutOnly)).toEqual([])
    expect(shouldMail('src/resume.ts', diffResume(before, aboutOnly))).toBe(false)
    expect(shouldMail('src/resume.ts\npublic/steven-wilssens-resume-2026.pdf',diffResume(before, aboutOnly))).toBe(true)
    expect(shouldMail('public/steven-wilssens-resume-2026.pdf', [])).toBe(true)
    const reworded = resume({ ...aboutOnly, languages: 'Dutch, English and French' })
    expect(shouldMail('src/resume.ts', diffResume(before, reworded))).toBe(true)
  })
})

describe('pairEdits', () => {
  it('pairs an edited line with its original and leaves unrelated lines alone', () => {
    const { pairs, removed, added } = pairEdits(['Shipped spatial audio to Windows and Xbox.', 'Ran the OKR process.'], ['Shipped spatial audio to Windows, Xbox and HoloLens.', 'Opened a new office in Prague.'])
    expect(pairs).toEqual([{ from: 'Shipped spatial audio to Windows and Xbox.', to: 'Shipped spatial audio to Windows, Xbox and HoloLens.' }])
    expect(removed).toEqual(['Ran the OKR process.'])
    expect(added).toEqual(['Opened a new office in Prague.'])
  })
})

describe('fallbackSummary', () => {
  it('describes the changes without a model', () => {
    const changes = [{ section: 'Lead Developer at Compuware', kind: 'changed', what: 'The dates changed', from: 'Jan 2005 - Dec 2006', to: 'Jan 2006 - Sep 2006' }]
    const summary = fallbackSummary(changes, { title: 'Compuware dates' })
    expect(summary.source).toBe('fallback')
    expect(summary.headline).toBe('One change to Lead Developer at Compuware')
    expect(summary.items).toEqual([{ label: 'Lead Developer at Compuware', text: 'The dates changed: “Jan 2005 - Dec 2006” is now “Jan 2006 - Sep 2006”.' }])
    expect(summary.intro).toContain('Compuware dates')
  })

  it('says the resume was only regenerated when the data did not change', () => {
    expect(fallbackSummary([], { title: 'Regenerated resume' }).headline).toBe('Regenerated resume')
  })
})

describe('summarize', () => {
  const changes = [{ section: 'Profile', kind: 'changed', what: 'The headline on the resume changed', from: 'Principal product leader', to: 'Principal product leader: data, experimentation and AI' }]

  const reply = (text, extra = {}) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }], ...extra })

  it('asks Claude for structured JSON when there is a key and keeps the model as the source', async () => {
    const create = vi.fn(async (params) => {
      expect(params.model).toBe('claude-test')
      expect(params.output_config.format.type).toBe('json_schema')
      expect(params.output_config.effort).toBe('low')
      expect(params.system).toContain('Steven Wilssens')
      expect(params.messages[0].content).toContain('Principal product leader: data, experimentation and AI')
      return reply(JSON.stringify({ headline: 'Your resume headline now names data, experimentation and AI.', intro: 'One line changed.', items: [{ label: 'Headline', text: 'It now reads "Principal product leader: data, experimentation and AI".' }] }))
    })
    const summary = await summarize({ kind: 'live', changes, title: 'Headline' }, { client: { messages: { create } }, model: 'claude-test', log: () => {} })
    expect(create).toHaveBeenCalledOnce()
    expect(summary).toEqual({ headline: 'Your resume headline now names data, experimentation and AI', intro: 'One line changed.', items: [{ label: 'Headline', text: 'It now reads "Principal product leader: data, experimentation and AI".' }], source: 'claude-test' })
  })

  it('falls back to the changes themselves without a key, when the call fails, and when Claude declines', async () => {
    const log = vi.fn()
    expect((await summarize({ kind: 'live', changes }, { apiKey: '', log })).source).toBe('fallback')
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining('::notice::ANTHROPIC_API_KEY is not set'))
    const failing = { messages: { create: vi.fn(async () => { throw new Error('429 rate limited') }) } }
    expect((await summarize({ kind: 'live', changes }, { client: failing, log })).source).toBe('fallback')
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining('::warning::The Claude summary failed (429 rate limited)'))
    const declining = { messages: { create: vi.fn(async () => reply('', { stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'general_harms' } })) } }
    expect((await summarize({ kind: 'live', changes }, { client: declining, log })).source).toBe('fallback')
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining('Claude declined (general_harms)'))
  })
})

describe('scoreOf', () => {
  it('reads the score and its baseline from the report', () => {
    expect(scoreOf({ score: 84, pages: 2, warnings: 3, errors: 0, baseline: { score: 90, lower: true, change: -6, verdict: 'lower' } })).toEqual({ score: 84, before: 90, verdict: 'lower', lower: true, pages: 2, warnings: 3, errors: 0 })
    expect(scoreOf({ score: 90, pages: 2, findings: [{ severity: 'warn' }, { severity: 'info' }], baseline: null })).toMatchObject({ verdict: 'unknown', before: null, warnings: 1, errors: 0 })
    expect(scoreOf(null)).toBeNull()
  })
})

describe('renderEmail', () => {
  const summary = { headline: 'The Compuware dates are fixed', intro: 'One date range changed.', items: [{ label: 'Compuware', text: 'The dates now read January to September 2006.' }], source: 'claude-opus-5-5' }

  it('renders the live email with the PDF link and no warning when the score held', () => {
    const email = renderEmail({ kind: 'live', summary, score: { score: 90, before: 90, verdict: 'unchanged', lower: false, pages: 2, warnings: 2, errors: 0 }, title: 'Compuware dates', links: { run: 'https://github.com/x/y/actions/runs/1' } })
    expect(email.subject).toBe('Resume live: The Compuware dates are fixed')
    expect(email.html).toContain('The Compuware dates are fixed')
    expect(email.html).toContain('https://steven.wilssens.com/steven-wilssens-resume-2026.pdf')
    expect(email.html).toContain('Same as the live resume')
    expect(email.html).not.toContain('scores lower')
    expect(email.text).toContain('- Compuware: The dates now read January to September 2006.')
    expect(email.text).toContain('Run: https://github.com/x/y/actions/runs/1')
  })

  it('renders the review email with the warning, the new findings, the instruction and the pull request', () => {
    const email = renderEmail({ kind: 'review', summary, score: { score: 84, before: 90, verdict: 'lower', lower: true, pages: 2, warnings: 3, errors: 0 }, title: 'Compuware dates', instruction: 'Fix the Compuware <dates>.', links: { pr: 'https://github.com/x/y/pull/4', preview: 'https://update-x.stevenwilssens.pages.dev' }, newFindings: ['- [warn] "250%+" has no role bullet behind it'] })
    expect(email.subject).toBe('Resume ready to review, but scoring lower (90 → 84): The Compuware dates are fixed')
    expect(email.html).toContain('scores lower than the resume live today: 90 → 84')
    expect(email.html).toContain('[warn] &quot;250%+&quot; has no role bullet behind it')
    expect(email.html).toContain('Fix the Compuware &lt;dates&gt;.')
    expect(email.html).toContain('https://github.com/x/y/pull/4')
    expect(email.html).toContain('https://update-x.stevenwilssens.pages.dev/steven-wilssens-resume-2026.pdf')
    expect(email.text).toContain('WARNING: this resume scores lower than the resume live today: 90 → 84.')
    expect(email.text).toContain('Nothing is live yet.')
  })
})
