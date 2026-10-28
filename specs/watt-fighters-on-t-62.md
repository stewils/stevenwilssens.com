# Watt Fighters is the first project on the Projects page

Slug: `watt-fighters-on-t-62` · Branch: `update/watt-fighters-on-t-62` · Status: built
Asked by Steven: "Add a new project to the Projects page and make it the FIRST project, above wilssens.com. … the card gets only a 'Visit project' link."

Short spec: a content addition with no new data flow; no spec agents were started because Steven is not available and the change is one card.

## Problem

Steven's newest project, Watt Fighters (wattfighters.com), is not on the Projects page.

## Outcome

`/projects` lists Watt Fighters first, labelled Game, with Steven's text and a "Visit project" link. The Markdown copy, `llms-full.txt` and the page's prerendered HTML carry it too, because they are generated from the page.

## Acceptance criteria

- AC-1: Watt Fighters is the first card on `/projects`, with kicker "Game", Steven's exact text and "Visit project" → https://wattfighters.com. (`src/App.test.tsx`)
- AC-2: It has no "Read how it was built" link and no write-up page; the other cards, their order and wording are unchanged. (`src/App.test.tsx`)
- AC-3: The Markdown page, llms.txt and llms-full.txt list it first, generated from the page. No sitemap or structured data lists projects, so nothing else changes.
- AC-4: The résumé is unchanged.

## Out of scope

A write-up, the résumé, other cards.

## Recruiter impact

Recruiter impact: small. A new first card on a secondary page; no change to the résumé, so the ATS score is unchanged. The text is Steven's own wording.

## Design

The card reuses `project-card`. There is no screenshot yet, so the frame shows the project name on the browser-frame background (`.project-placeholder`) and omits the phone image.

## Threat model

None new: static text and an outbound link with `rel="noreferrer"`, `target="_blank"`.

## Technical approach

`src/App.tsx` (`projects`, `renderProjectFrame`), `src/App.css`, `src/App.test.tsx`.

## Test plan

| AC | Test | Kind |
|---|---|---|
| AC-1, AC-2 | `src/App.test.tsx` "lists Watt Fighters first…" | component |

## Open questions for Steven

1. Screenshots: this run could not capture wattfighters.com. Recommendation: add `['https://wattfighters.com/', 'wattfighters']` to `scripts/capture-projects.mjs`, run it, and import the two images on the card.

## Sign-offs

| Role | Spec | Merge |
|---|---|---|
| Product manager | not run (short spec) | Review workflow |
| Recruiter | not run (short spec) | Review workflow |
| Designer | not run (short spec) | Review workflow |
| Security | not run (short spec) | Review workflow |
| Tester | not run (short spec) | Review workflow |
| Developer | built | Review workflow |
