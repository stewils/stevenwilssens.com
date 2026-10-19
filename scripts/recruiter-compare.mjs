// The comparison behind scripts/recruiter-check.mjs, kept pure so it can be tested
// (scripts/recruiter-compare.test.mjs): what a change adds and fixes from a recruiter's
// seat, and whether that makes the site worse than the baseline.

// The pages the recruiter review reads, by their pageMeta name.
export const reviewedPages = ['home', 'about', 'experience', 'work', 'recommendations']

export const findingKey = (finding) => `${finding.area}|${finding.finding}`

// What a review could not read. On the baseline side anything here makes the comparison
// meaningless (a fetch that failed scores as "page missing", so every change looks
// "not worse"), and the check refuses it instead.
export const missingSources = (pages, resumeReport) => [
  ...reviewedPages.filter((page) => pages[page] == null).map((page) => `page ${page}`),
  ...(resumeReport ? [] : ['resume report']),
]

// Worse: a lower score or a new high finding. A new medium finding does not fail the
// check (a fix elsewhere can keep the score equal) but is listed as "needs a look", so
// a swapped finding never hides.
export const compareReviews = (current, baseline) => {
  const before = new Set(baseline.findings.map(findingKey))
  const after = new Set(current.findings.map(findingKey))
  const added = current.findings.filter((finding) => !before.has(findingKey(finding)))
  const fixed = baseline.findings.filter((finding) => !after.has(findingKey(finding)))
  const newHigh = added.filter((finding) => finding.severity === 'high')
  const worse = current.score < baseline.score || newHigh.length > 0
  const needsALook = worse ? [] : added.filter((finding) => finding.severity === 'medium')
  return { worse, added, fixed, newHigh, needsALook }
}

// The step summary; `label` says what the baseline is (main's data on the live pages).
export const summarize = (current, baseline, label) => {
  const lines = [`### Recruiter check: ${current.score}/100${baseline ? ` (${label}: ${baseline.score}/100)` : ''}`, '', current.headline, '']
  if (!baseline) {
    for (const finding of current.findings) lines.push(`- (${finding.severity}) ${finding.area}: ${finding.finding}`)
    return { worse: false, text: lines.join('\n') }
  }
  const result = compareReviews(current, baseline)
  lines.push(result.worse ? `**Worse for recruiters than ${label}.**` : `**Not worse for recruiters than ${label}.**`, '')
  for (const finding of result.added) lines.push(`- New (${finding.severity}) ${finding.area}: ${finding.finding} Fix: ${finding.fix}`)
  for (const finding of result.fixed) lines.push(`- Fixed (${finding.severity}) ${finding.area}: ${finding.finding}`)
  if (result.needsALook.length) {
    lines.push('', '**Needs a look** (new medium findings; they do not fail the check, the recruiter reviewer answers each):')
    for (const finding of result.needsALook) lines.push(`- ${finding.area}: ${finding.finding}`)
  }
  return { worse: result.worse, text: lines.join('\n') }
}
