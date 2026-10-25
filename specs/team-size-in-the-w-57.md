# Team size moves into the Windows Data role summary

Slug: `team-size-in-the-w-57` · Branch: `update/team-size-in-the-w-57` · Status: built
Asked by Steven: approved résumé proposals #32 and #33 (short spec, no spec agents).

## Problem
The PDF prints only the summary and first bullet of older Microsoft roles, so the team-size bullet of "Principal Product Manager Lead - Windows Data" never reached the PDF.

## Acceptance criteria
- AC-1: the role summary (key `csx-data`) reads as proposal #32; the team size (one to five PMs, about 20 developers) is in the PDF.
- AC-2: the promotion bullet reads "Growing the team led to promotion to Principal Group Product Manager." (#33); the site no longer repeats the numbers.
- AC-3: ATS score stays 100/100; `src/resume.test.ts` passes.

## Recruiter impact
Same facts, now visible in the PDF. ATS 100 → 100.

## Sign-offs
| Role | Spec | Merge |
|---|---|---|
| PM, recruiter, designer, security, tester, developer | short spec, none started | Review workflow |
