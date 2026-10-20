// The About page's guards: the plain-text validator (refusals), the side-note facts
// (refusals), and the recruiter flags, each hit both ways on a fixture, plus the live copy
// in src/resume.ts, which has to pass every rule with no flag.
import { describe, expect, it } from 'vitest'
import { about as liveAbout } from '../../../src/resume'
import { aboutFlags, aboutLimits, applyAbout, checkAboutProposal, checkAboutText, matchParagraph, sideNoteRefusal, superlatives, titlesIn, type AboutChange } from './about'
import { normWording } from '../../../src/admin/where'
import { liveResume, norm, type ResumeData } from './proposals'
import type { Proposal } from './store'

const intro = 'A product and data leader after Microsoft.'
const first = 'After nearly 20 years at Microsoft, I build AI products.'
const second = 'Most recently, I led the Windows & Devices Data PM team as Principal Group Product Manager.'
const third = 'Earlier still, I was a developer and team lead in Belgium.'
const resume: ResumeData = {
  experiences: [
    { key: 'windows-devices-data', role: 'Principal Group Product Manager - Windows & Devices Data', company: 'Microsoft', dates: 'Dec 2024 - Sep 2026', location: 'Redmond, Washington', summary: 'Led the org.', points: ['Led a PM organization of 10 to 20.', 'Telemetry from more than 1.6 billion Windows devices.'] },
    { key: 'spatial', role: 'Senior Product Manager - Silicon, Graphics, Media', company: 'Microsoft', dates: 'Oct 2008 - Aug 2017', location: 'Redmond', summary: 'Audio.', points: ['Grew it 250% over 1.5 years.'] },
  ],
  profile: { resumeHeadline: 'Product leader', headline: 'Product leader', summary: 'Product leader with nearly 20 years at Microsoft.', location: 'Seattle, Washington', workAuthorization: 'US permanent resident (green card)', availability: 'Available now' },
  skills: [],
  education: { degree: 'BSc', school: 'KdG', dates: '2000 - 2004' },
  impact: [{ value: '+5%', label: 'Perfect Day', backing: 'windows-devices-data' }],
  about: { intro, paragraphs: [first, second, third] },
  selectedWork: [{ key: 'w', title: 'Work', period: '2026', role: 'general', context: 'c', work: 'w', outcome: 'Shipped in 16 days.' }],
  honors: [['Award', 'Issued by Microsoft · Jan 2012']],
}
const replace = (currentText: string, proposedText: string): AboutChange => ({ field: 'paragraph', kind: 'replace', currentText, proposedText })
const check = (change: AboutChange, data = resume) => checkAboutProposal(change, data)
const refusalsFor = (proposedText: string) => check(replace(third, proposedText)).refusals
const flagsFor = (proposedText: string) => check(replace(third, proposedText)).flags

describe('applying a proposal to the About copy', () => {
  it('replaces the intro, and replaces, adds and removes a paragraph', () => {
    const about = resume.about
    expect(applyAbout(about, { field: 'intro', kind: 'replace', currentText: intro, proposedText: 'New.' }).intro).toBe('New.')
    expect(applyAbout(about, { field: 'intro', kind: 'add', currentText: null, proposedText: 'New.' })).toBe(about)
    expect(applyAbout(about, replace(' Most  recently, I led the Windows & Devices Data PM team as Principal Group Product Manager. ', 'B.')).paragraphs).toEqual([first, 'B.', third])
    expect(applyAbout(about, { field: 'paragraph', kind: 'add', currentText: first, proposedText: 'X.' }).paragraphs).toEqual([first, 'X.', second, third])
    expect(applyAbout(about, { field: 'paragraph', kind: 'add', currentText: null, proposedText: 'X.' }).paragraphs).toEqual([first, second, third, 'X.'])
    expect(applyAbout(about, { field: 'paragraph', kind: 'add', currentText: 'gone', proposedText: 'X.' }).paragraphs).toEqual([first, second, third, 'X.'])
    expect(applyAbout(about, { field: 'paragraph', kind: 'add', currentText: null, proposedText: null }).paragraphs).toEqual(about.paragraphs)
    expect(applyAbout(about, { field: 'paragraph', kind: 'remove', currentText: second, proposedText: null }).paragraphs).toEqual([first, third])
    // A current text that is gone (the page changed since) changes nothing.
    expect(applyAbout(about, replace('gone', 'B.')).paragraphs).toEqual(about.paragraphs)
    expect(applyAbout(about, { field: 'paragraph', kind: 'replace', currentText: second, proposedText: null }).paragraphs).toEqual(about.paragraphs)
    expect(applyAbout(about, { field: 'title', kind: 'replace', currentText: intro, proposedText: 'x' })).toBe(about)
    // The live copy is not touched.
    expect(about.paragraphs).toEqual([first, second, third])
  })

  it('finds a paragraph by its wording, however it is quoted', () => {
    expect(matchParagraph(['It’s “data” – here.', 'Other.'], ' It\'s "data" - here. ')).toEqual([0])
    expect(matchParagraph(['Same.', 'Same.'], 'Same.')).toEqual([0, 1])
    expect(matchParagraph(['Same.'], null)).toEqual([])
  })
})

describe('the plain-text validator', () => {
  const withParagraph = (text: string) => checkAboutText({ intro, paragraphs: [first, text] })
  it('refuses markup, links, URLs, line breaks and characters a reader cannot see, one class at a time', () => {
    const cases: [string, RegExp][] = [
      ['A <b>bold</b> claim.', /HTML/],
      ['Run <script>alert(1)</script> now.', /HTML/],
      ['A comment <!-- x --> here.', /HTML/],
      ['See [x](https://e.com) here.', /Markdown link/],
      ['A picture ![x](https://e.com/p.png) here.', /Markdown link/],
      ['# heading', /heading, list marker/],
      ['- a list item', /heading, list marker/],
      ['> a quote', /heading, list marker/],
      ['1. first item', /heading, list marker/],
      ['```code', /heading, list marker/],
      ['Some `code` here.', /backtick/],
      ['See https://e.com for more.', /a URL/],
      ['Two\nlines.', /a line break/],
      ['Two\r\nlines.', /a line break/],
      ['The marker [[in: site:about]] here.', /source markers/],
      ['A closing ]] here.', /source markers/],
      ['Zero​width.', /invisible/],
      ['Bidi‮override.', /invisible/],
      ['Tag \u{E0041}character.', /invisible/],
      ['Byte﻿order mark.', /invisible/],
      ['Bell\u0007.', /invisible/],
    ]
    for (const [text, why] of cases) {
      const refusals = withParagraph(text)
      expect(refusals.join(' | '), text).toMatch(why)
      expect(refusals.every((refusal) => refusal.startsWith('paragraph 2 '))).toBe(true)
    }
    // A line break is one refusal, not also an invisible character.
    expect(withParagraph('Two\nlines.')).toHaveLength(1)
    expect(checkAboutText({ intro: 'A <i>leader</i>.', paragraphs: [first, second] })[0]).toMatch(/^the intro has HTML/)
  })

  it('takes plain prose with an ampersand, curly quotes, dashes and a less-than sign', () => {
    expect(withParagraph('Windows & Devices — it’s “data”, 3 < 4 and 2 > 1.')).toEqual([])
    expect(checkAboutText(liveAbout)).toEqual([])
  })

  it('refuses an empty part', () => {
    expect(checkAboutText({ intro: ' ', paragraphs: [first, second] })).toContain('the intro is empty')
    expect(withParagraph('')).toContain('paragraph 2 is empty')
  })

  it('holds the designer’s limits, and text exactly at a limit passes', () => {
    const of = (size: number) => `${'a'.repeat(size - 1)}.`
    expect(checkAboutText({ intro: of(aboutLimits.intro), paragraphs: [first, second] })).toEqual([])
    expect(checkAboutText({ intro: of(aboutLimits.intro + 1), paragraphs: [first, second] })).toEqual(['the intro has 121 characters; at most 120'])
    expect(checkAboutText({ intro: 'One. Two.', paragraphs: [first, second] })).toEqual(['the intro is more than one sentence'])
    expect(checkAboutText({ intro: 'One, e.g.so one.', paragraphs: [first, second] })).toEqual([])
    expect(checkAboutText({ intro, paragraphs: [of(aboutLimits.firstParagraph), second] })).toEqual([])
    expect(checkAboutText({ intro, paragraphs: [of(aboutLimits.firstParagraph + 1), second] })).toEqual(['paragraph 1 has 221 characters; at most 220 for the green opening paragraph'])
    expect(checkAboutText({ intro, paragraphs: [first, of(aboutLimits.paragraph)] })).toEqual([])
    expect(checkAboutText({ intro, paragraphs: [first, of(aboutLimits.paragraph + 1)] })).toEqual(['paragraph 2 has 701 characters; at most 700'])
    // The total: 220 + 490 + 490 = 1,200 passes, one more does not.
    expect(checkAboutText({ intro, paragraphs: [of(220), of(490), of(490)] })).toEqual([])
    expect(checkAboutText({ intro, paragraphs: [of(220), of(490), of(491)] })).toEqual(['the paragraphs have 1201 characters together; at most 1200'])
    expect(checkAboutText({ intro, paragraphs: [first] })).toEqual(['the page would have 1 paragraph; it needs 2 to 4'])
    expect(checkAboutText({ intro, paragraphs: [first, 'b.', 'c.', 'd.', 'e.'] })).toEqual(['the page would have 5 paragraphs; it needs 2 to 4'])
    expect(checkAboutText({ intro, paragraphs: [first, 'b.', 'c.', 'd.'] })).toEqual([])
    // Characters, not UTF-16 units: an emoji-free accented text counts each letter once.
    expect(checkAboutText({ intro: `${'é'.repeat(119)}.`, paragraphs: [first, second] })).toEqual([])
  })

  it('checks the result of a proposal: a fifth paragraph, a remove that leaves one, a long paragraph that becomes the opening', () => {
    const four: ResumeData = { ...resume, about: { intro, paragraphs: [first, second, third, 'Fourth.'] } }
    expect(check({ field: 'paragraph', kind: 'add', currentText: null, proposedText: 'Fifth.' }, four).refusals).toEqual(['the page would have 5 paragraphs; it needs 2 to 4'])
    const two: ResumeData = { ...resume, about: { intro, paragraphs: [first, second] } }
    expect(check({ field: 'paragraph', kind: 'remove', currentText: first, proposedText: null }, two).refusals).toEqual(['the page would have 1 paragraph; it needs 2 to 4'])
    const long = `${'Windows & Devices Data, product, data and AI. '.repeat(6).trim()}`
    const longSecond: ResumeData = { ...resume, about: { intro, paragraphs: [first, long, third] } }
    expect(check({ field: 'paragraph', kind: 'remove', currentText: first, proposedText: null }, longSecond).refusals).toEqual([`paragraph 1 has ${long.length} characters; at most 220 for the green opening paragraph`])
  })
})

describe('the side-note facts (recruiter guard 1)', () => {
  it('refuses another location, work authorization, availability or title', () => {
    for (const text of ['I am based in Austin, Texas.', 'I hold an H-1B visa.', 'I will need sponsorship.', 'I am available from January.', 'Most recently I was a Director at Google.', 'I was Head of Product at Contoso.', 'I was Vice President of Product.', 'I was Chief Data Officer at Fabrikam.']) {
      const refusals = refusalsFor(text)
      expect(refusals, text).toHaveLength(1)
      expect(refusals[0]).toContain(sideNoteRefusal)
      expect(refusals[0]).toContain(`"${text}"`)
    }
    expect(refusalsFor('Most recently I was a Director at Google.')[0]).toContain('the title "Director"')
    expect(refusalsFor('I am based in Austin, Texas.')[0]).toContain('a location, work authorization or availability')
  })

  it('takes what profile and the roles say, and sentences that only mention a place or a team', () => {
    for (const text of ['I am based in Seattle, Washington.', 'I am a US permanent resident (green card).', 'I am available now.', 'I was a Senior Product Manager at Microsoft.', 'I was a developer and team lead in Belgium.', 'The Operating System Group shipped it.', 'I led a team of engineers.']) expect(refusalsFor(text), text).toEqual([])
  })

  it('reads a title from a seniority word up to the last title word', () => {
    expect(titlesIn('As Principal Group Product Manager at Microsoft, I led.')).toEqual(['Principal Group Product Manager'])
    expect(titlesIn('I was Head of Product and Director.')).toEqual(['Head of Product and Director'])
    expect(titlesIn('I was Head of Product.')).toEqual(['Head of Product'])
    expect(titlesIn('In the Operating System Group.')).toEqual([])
    expect(titlesIn('a team lead.')).toEqual([])
  })
})

describe('the recruiter flags', () => {
  it('flags a number the résumé does not carry, and none that it does (guard 2)', () => {
    expect(flagsFor('I led 45 PMs.')).toEqual(['the number 45 needs a source: no role bullet, key achievement or profile field in src/resume.ts carries it'])
    // From profile.summary, a role bullet, impact, selected work and an honor.
    for (const text of ['For nearly 20 years.', 'Over 1.6 billion devices.', 'Up 250% in 1.5 years.', 'Up +5% in Perfect Day.', 'Built in 16 days.', 'Since 2012.', 'From 2000.']) expect(flagsFor(text), text).toEqual([])
    expect(flagsFor('In 2031 and 2031.')).toEqual(['the number 2031 needs a source: no role bullet, key achievement or profile field in src/resume.ts carries it'])
    // Number words are a known limit.
    expect(flagsFor('I led forty-five PMs.')).toEqual([])
  })

  it('flags present tense about a past role (guard 4)', () => {
    expect(flagsFor('I lead the Windows data team at Microsoft.')).toEqual(['"I lead the Windows data team at Microsoft." is in the present tense about a past role (Steven left Microsoft in September 2026)'])
    expect(flagsFor('I am leading the data work for Windows.')).toHaveLength(1)
    expect(flagsFor('I’m leading spatial audio on Xbox.')).toHaveLength(1)
    expect(flagsFor('I work at Microsoft.')).toHaveLength(1)
    expect(flagsFor('I led the Windows data team at Microsoft.')).toEqual([])
    expect(flagsFor('I lead product on my own AI projects.')).toEqual([])
  })

  it('flags a result that loses the keywords or the last Microsoft role (guard 6)', () => {
    const plain: ResumeData = { ...resume, about: { intro: 'A leader.', paragraphs: ['I build product with data and AI.', 'Most recently, Windows and Devices Data.'] } }
    const flags = (paragraph: string, data = plain) => check({ field: 'paragraph', kind: 'replace', currentText: 'I build product with data and AI.', proposedText: paragraph }, data).flags
    const lost = (word: string) => `the page would no longer say "${word}", a word recruiters search for`
    const lastRole = 'the page would no longer name the last Microsoft role (Windows & Devices Data)'
    expect(flags('I build product with data and AI.')).toEqual([])
    expect(flags('I build products with Data and AI.')).toEqual([])
    expect(flags('I build things with data and AI.')).toEqual([lost('product')])
    expect(flags('I build product with data, he said.')).toEqual([lost('AI')])
    expect(flags('I build product with data and ai.')).toEqual([lost('AI')])
    // "Devices Data" carries the word too, so "data" goes only with the role.
    const noRole: ResumeData = { ...plain, about: { intro: 'A leader.', paragraphs: ['I build product with data and AI.', 'Most recently, Windows.'] } }
    expect(flags('I build product with AI.', noRole)).toEqual([lost('data'), lastRole])
    expect(check({ field: 'paragraph', kind: 'replace', currentText: 'Most recently, Windows and Devices Data.', proposedText: 'Most recently, Windows.' }, plain).flags).toEqual([lastRole])
    expect(check({ field: 'paragraph', kind: 'remove', currentText: second, proposedText: null }).flags).toEqual([lastRole])
  })

  it('flags superlatives, as whole words in any case (guard 7)', () => {
    expect(superlatives).toEqual(['world-class', 'visionary', 'passionate', 'rockstar', 'ninja', 'guru', 'best-in-class', 'thought leader'])
    for (const word of ['world-class', 'Visionary', 'PASSIONATE', 'rockstar', 'thought leader']) expect(flagsFor(`I am a ${word} builder.`), word).toEqual([`"${word.toLowerCase()}" reads as self-promotion to a hiring manager`])
    expect(flagsFor('I am compassionate and a gurus fan.')).toEqual([])
  })

  it('recomputes the flags from the data it is given', () => {
    const change = replace(third, 'I shipped it in 7 days.')
    expect(check(change).flags).toHaveLength(1)
    expect(check(change, { ...resume, honors: [['Seven', 'In 7 days']] }).flags).toEqual([])
  })

  it('gives flags for an About proposal only', () => {
    const p: Proposal = { id: 1, createdAt: 0, updatedAt: 0, role: 'about', field: 'paragraph', kind: 'replace', currentText: third, proposedText: 'A visionary.', rationale: 'r', basedOn: null, status: 'proposed', decisionNote: null }
    expect(aboutFlags(p, resume)).toEqual(['"visionary" reads as self-promotion to a hiring manager'])
    expect(aboutFlags({ ...p, role: 'headline' }, resume)).toBeNull()
  })
})

describe('the live About copy (AC-14)', () => {
  it('passes every rule with no refusal and no flag', () => {
    const live = liveResume()
    expect(live.about).toBe(liveAbout)
    expect(checkAboutText(liveAbout)).toEqual([])
    expect(checkAboutProposal({ field: 'intro', kind: 'replace', currentText: liveAbout.intro, proposedText: liveAbout.intro }, live)).toEqual({ refusals: [], flags: [] })
    for (const paragraph of liveAbout.paragraphs) expect(checkAboutProposal(replace(paragraph, paragraph), live)).toEqual({ refusals: [], flags: [] })
  })
})

describe('the admin’s copy of the wording rule', () => {
  it('matches wording the same way the MCP server does', () => {
    for (const text of ['  It’s “data” – here.  ', 'Plain text.', 'a b\tc', '‚low‘ „quote“ — dash', '', null, undefined]) expect(normWording(text)).toBe(norm(text))
  })
})
