# <Title: what changes for the reader>

Slug: `<slug>` · Branch: `<slug>` · Status: draft | approved | built | merged
Asked by Steven on <date>: "<the ask, in his words>"

## Problem

Who has the problem (a recruiter skimming on a phone, a hiring manager comparing
candidates, Steven in the admin), what they run into today, and how we know (analytics,
site questions, the recruiter review, Steven's word).

## Outcome

What is true for that reader once this ships. One or two sentences.

## Acceptance criteria

Numbered, each one testable, each one mapped to a test or a check in the test plan.

- AC-1: …
- AC-2: …

## Out of scope

## Recruiter impact (senior-recruiter)

- What a recruiter sees differently, in the first ten seconds and on a close read.
- Risks to the bar "not worse for recruiters": the resume score, the recruiter review
  score, a fact or number without a source, a slower or busier first screen, a broken
  path to the resume, the contact details or the assistant.
- Baseline: `npm run check:recruiter` on main = <score>/100; `node scripts/resume-check.mjs` ATS = <score>/100.

## Design (ux-designer)

- The flow, step by step, for each reader; states: empty, loading, error, very long
  content (a long write-up refresh, a long name or title, many rows), and the page
  without JavaScript as prerendered.
- Layout at desktop (1440) and phone (390), light and dark; which existing components
  and tokens it reuses (`src/index.css`, `src/App.css`, `src/admin/admin.css`).
- A sketch of the layout in text (ASCII is fine).
- Copy: the exact wording of headings, labels, buttons and messages, and how long it
  may get (with the recruiter).
- Accessibility: keyboard path, focus, labels, contrast, reduced motion.
- Pages to screenshot: `home`, `<page>`, `admin`, `admin#<part>` (the designer's UI
  check and the before/after pairs for Steven).

## Threat model (security-engineer)

- What is new that an attacker can reach (endpoints, inputs, tokens, stored data, model
  prompts) and what each does with untrusted input.
- Required controls and the tests that prove them.

## Technical approach (senior-developer)

- Files to change, data flow, migrations, what stays the same. Feasibility notes.

## Test plan (senior-tester)

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | … | unit / component / function / site-check / recruiter-check / ui-check |

Coverage stays at or above 90% (statements, branches, functions, lines) and every new
or changed file is at 90% or more on its own.

## Open questions for Steven

1. …

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | | | |
| Senior recruiter | | | |
| Senior designer | | | |
| Senior developer | (feasibility) | | |
| Security engineer | (threat model) | | |
| Senior tester | (test plan) | | |
