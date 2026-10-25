# Building AI Breaker: refresh after the dev beta licence check-in

Slug: `building-ai-breake-60` · Branch: `update/building-ai-breake-60` · Status: built
Asked by Steven (Site update workflow, Building refresh): refresh `/building-aibreaker` after the check-in `f5cec05` on stewils/ai-breaker, "Dev builds carry a dev beta licence so the admin download blocks without a licence file (app 0.8.1)". Short spec (team.md step 4); no spec agents.

## Problem

The check-in makes internal dev builds carry a 90-day dev-key beta licence so the private admin download behaves like a licensed install. It changes the build and test tooling only; the licence gate and the product are unchanged. The write-up says nothing about dev builds, so nothing in it is now wrong, and the change is not a decision or outcome a reader would miss.

Two small things did go stale: the header "as of" date, and "140 entries so far" for the decision log (145 dated entries now in the project's CLAUDE.md). The closing section's date and the headline numbers come from `feed.json` (asOf 2026-10-25).

## Acceptance criteria

- Header comment of `AIBreakerArticle.tsx` says 25 October 2026.
- The decision-log count agrees with the project's CLAUDE.md (145).
- No new text about the dev licence; nothing private added; no other page touched; `src/resume.ts` untouched.
- Lint, tests, coverage and build pass.

## Recruiter impact

None on the résumé (not touched; ATS score unchanged). One number in a write-up bullet moves from 140 to 145.

## Open questions for Steven

None. Note: the count 145 is my count of dated lines in the project's CLAUDE.md log; if the earlier 140 was counted differently, adjust.

## Sign-offs

| Role | Spec | Merge |
| --- | --- | --- |
| Product manager | n/a (short spec) | review workflow |
| Recruiter | n/a | review workflow |
| Designer | n/a (no layout change) | review workflow |
| Security | n/a (text only) | review workflow |
| Tester | n/a | review workflow |
| Developer | built | review workflow |
