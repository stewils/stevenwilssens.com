// The recruiter gate's comparison (scripts/recruiter-compare.mjs), which decides whether a
// pull request is worse for recruiters than main.
import { describe, expect, it } from 'vitest'
import { compareReviews, findingKey, missingSources, reviewedPages, summarize } from './recruiter-compare.mjs'

const finding = (area, severity, text = `${area} problem.`) => ({ area, severity, finding: text, why: 'Why.', fix: `Fix ${area}.` })
const review = (score, findings) => ({ score, headline: `${score}/100 from a recruiter's seat.`, findings })
const label = "main's data on the live pages"

describe('the recruiter comparison', () => {
  it('keys a finding by its area and text', () => {
    expect(findingKey(finding('scope:a', 'high', 'No team size.'))).toBe('scope:a|No team size.')
  })

  it('is not worse when nothing changed', () => {
    const base = review(80, [finding('page:work', 'medium')])
    expect(compareReviews(review(80, [finding('page:work', 'medium')]), base)).toEqual({ worse: false, added: [], fixed: [], newHigh: [], needsALook: [] })
  })

  it('is worse when the score drops, even by one point', () => {
    expect(compareReviews(review(79, [finding('tense:a', 'low')]), review(80, [])).worse).toBe(true)
  })

  it('is worse when a new high finding appears, even with a higher score', () => {
    const result = compareReviews(review(85, [finding('logistics:location', 'high')]), review(80, [finding('a', 'medium'), finding('b', 'medium'), finding('c', 'medium'), finding('d', 'medium')]))
    expect(result.worse).toBe(true)
    expect(result.newHigh.map((item) => item.area)).toEqual(['logistics:location'])
    expect(result.needsALook).toEqual([])
  })

  it('is not worse when a high finding was already there, and lists what was fixed', () => {
    const high = finding('proof', 'high')
    const result = compareReviews(review(85, [high]), review(80, [high, finding('now', 'medium')]))
    expect(result).toMatchObject({ worse: false, added: [], newHigh: [] })
    expect(result.fixed.map((item) => item.area)).toEqual(['now'])
  })

  it('lists a new medium finding at an equal score as needing a look, without failing', () => {
    const result = compareReviews(review(80, [finding('message', 'medium', 'Mixed pitch.'), finding('tense:a', 'low', 'Present tense.')]), review(80, [finding('now', 'medium')]))
    expect(result.worse).toBe(false)
    // A new low finding is listed as new, but it does not ask the recruiter for a look.
    expect(result.added.map((item) => item.finding)).toEqual(['Mixed pitch.', 'Present tense.'])
    expect(result.needsALook.map((item) => item.finding)).toEqual(['Mixed pitch.'])
    expect(result.fixed.map((item) => item.area)).toEqual(['now'])
  })

  it('treats the same area with a different text as a new finding', () => {
    const result = compareReviews(review(80, [finding('impact:40%', 'medium', 'New text.')]), review(80, [finding('impact:40%', 'medium', 'Old text.')]))
    expect(result.added).toHaveLength(1)
    expect(result.fixed).toHaveLength(1)
  })
})

describe('what a review could not read', () => {
  const pages = Object.fromEntries(reviewedPages.map((page) => [page, `# ${page}`]))

  it('is nothing when every page and the resume report are there', () => {
    expect(missingSources(pages, { score: 100 })).toEqual([])
  })

  it('names each missing page and a missing resume report', () => {
    expect(missingSources({ ...pages, work: null, about: undefined }, null)).toEqual(['page about', 'page work', 'resume report'])
  })
})

describe('the summary', () => {
  it('names the baseline honestly and says when it is not worse', () => {
    const { worse, text } = summarize(review(80, []), review(80, []), label)
    expect(worse).toBe(false)
    expect(text).toContain("### Recruiter check: 80/100 (main's data on the live pages: 80/100)")
    expect(text).toContain("**Not worse for recruiters than main's data on the live pages.**")
    expect(text).not.toContain('Needs a look')
  })

  it('lists new, fixed and needs-a-look findings', () => {
    const { worse, text } = summarize(review(80, [finding('message', 'medium', 'Mixed pitch.')]), review(80, [finding('now', 'medium', 'Gap.')]), label)
    expect(worse).toBe(false)
    expect(text).toContain('- New (medium) message: Mixed pitch. Fix: Fix message.')
    expect(text).toContain('- Fixed (medium) now: Gap.')
    expect(text).toMatch(/\*\*Needs a look\*\*[^\n]*\n- message: Mixed pitch\./)
  })

  it('says worse when it is', () => {
    const { worse, text } = summarize(review(65, [finding('proof', 'high')]), review(80, []), label)
    expect(worse).toBe(true)
    expect(text).toContain("**Worse for recruiters than main's data on the live pages.**")
    expect(text).toContain('- New (high) proof:')
  })

  it('lists every finding when there is no baseline', () => {
    const { worse, text } = summarize(review(95, [finding('tense:a', 'low')]), null, label)
    expect(worse).toBe(false)
    expect(text.split('\n')[0]).toBe('### Recruiter check: 95/100')
    expect(text).toContain('- (low) tense:a: tense:a problem.')
  })
})
