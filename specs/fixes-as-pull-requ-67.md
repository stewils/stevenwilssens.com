# Watt Fighters write-up: each fix is a pull request on GitHub

Slug: `fixes-as-pull-requ-67` · Branch: `update/fixes-as-pull-requ-67` · Status: built
Asked by Steven on 2026-11-01: say that each fix is now a pull request on GitHub for him to review (built and live as of 1 November 2026), in sections 10 and 11 and in the diagrams.

Short spec: a Building write-up refresh with Steven's exact wording; no spec agents were started (Steven is not available to answer questions).

## Problem

The write-up says a fix waits on its own branch for "Release it". Today it waits as a pull request on GitHub that Steven can also release by merging.

## Acceptance criteria

- AC-1: Section 10's Built bullet reads "The fix waits for me as a pull request on GitHub. I release it with “Release it” on the admin page, or by merging the pull request. Either way every test runs before it goes live."
- AC-2: Section 11's Built bullet has Steven's new wording, and the new Built bullet about closing the pull request and the comment on a protected part follows it.
- AC-3: In both diagrams the "waits for my “Release it”" boxes add "or a merge", keep their Built marking, and fit on a phone (the decision box is taller, its pill moved down); the text descriptions say "or a merged pull request".
- AC-4: Nothing else on the site or in the résumé changes. (`src/articles/articles.test.tsx`)

## Recruiter impact

Recruiter impact: none. The résumé is untouched (ATS score unchanged); the write-up says what is built, with Built labels.

## Design

Two diagram boxes gain a third line ("or a merge"); the decision box grows by 16px and its "Loud: live in an hour" pill moves down with it. Both diagrams are drawn at desktop and phone width.

## Threat model

Static text only; nothing new reachable.

## Sign-offs

| Role | Spec | Merge |
| --- | --- | --- |
| Product manager | short spec by the lead | Review workflow |
| Recruiter | none (no résumé change) | Review workflow |
| Designer | short spec by the lead | Review workflow |
| Security | none (static text) | Review workflow |
| Tester | test updated | Review workflow |
| Developer | built | Review workflow |
