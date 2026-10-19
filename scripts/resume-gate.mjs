// The exit code of scripts/resume-check.mjs, kept pure so the gate can be tested
// (scripts/resume-gate.test.mjs). The Review workflow runs the check with --fail-on-drop
// against the live site's /resume-report.json; an outage must not pass as "not lower".
//
//   0  no errors, and (with --fail-on-drop) the score is at least the baseline's
//   1  the PDF has errors, or (with --fail-on-drop) the score is lower than the baseline's
//   2  --fail-on-drop with a baseline asked for that could not be read: not compared

// report: { errors, baseline } where baseline is compareScores' result (null when none
// was read); baselineRequested: whether --baseline (or RESUME_BASELINE) was given.
export const gateExit = ({ report, baselineRequested = false, failOnDrop = false }) => {
  if (report.errors) return 1
  if (!failOnDrop) return 0
  if (baselineRequested && !report.baseline) return 2
  return report.baseline?.lower ? 1 : 0
}

// What the gate says on stderr when it refuses to compare (exit 2); in GitHub Actions also
// as an error annotation on the run and the pull request's checks.
export const unavailableMessages = (source, { githubActions = false } = {}) => {
  const text = `Resume check: the baseline ${source} could not be read; the ATS score is not compared. Re-run when it can be read.`
  return githubActions ? [text, `::error title=Resume baseline unavailable::${text}`] : [text]
}
