# The write-up says the dashboard counts the people who asked the assistant, and what each asked

Slug: `building-steven-wilssens-com-merge-ask-p-31` · Branch: `building-steven-wilssens-com-merge-ask-p-31` · Status: built
Asked by Steven on 2026-10-19 (Building write-up refresh): "refresh /building-this-site after the check-in 357b10d: Merge ask-people: the assistant page shows how many different people used Ask about Steven and what each of them asked"

## Problem

A peer or hiring manager reading `/building-this-site`, section 05 (the assistant), learns
that "questions, cost, votes and the unanswered questions go to the dashboard". Since
357b10d that is incomplete: the dashboard now also counts how many different people asked
(once a day, with the same daily code as the visitor statistics) and shows what each of
them asked, kept 90 days, redacted, and nothing at all under Global Privacy Control or Do
Not Track. The write-up undersells the measurement habit it is there to show, and says
nothing about how the questions are kept.

Facts read from the repository itself (the `sources/` folder the workflow normally
provides is missing in this run): `README.md`, "Ask about Steven", the **Log** bullet;
`specs/ask-people.md`; the privacy paragraph in `src/App.tsx` (`renderPrivacy`).

## Outcome

The section 05 sentence about the dashboard says, in Steven's voice and about the same
length, that it counts the different people who asked, the way visitors are counted, and
what each asked, with how long and how carefully that is kept. Nothing else on the page
changes.

## Acceptance criteria

- AC-1: In `src/articles/site/SiteArticle.tsx`, section 05, the paragraph before
  `<ReportCard />` says the dashboard counts how many different people asked, counted
  once a day like visitors (the daily code), and shows what each of them asked.
- AC-2: The same paragraph (or the sentence next to it) says the questions are kept 90
  days, with email addresses, phone numbers and keys removed, and that nothing is kept
  when the browser sends Global Privacy Control or Do Not Track. Each claim matches the
  README **Log** bullet and `/privacy`; no claim goes beyond them.
- AC-3: The paragraph stays in the first person and plain English, still ends on the
  Microsoft measurement line (or keeps its meaning), and grows by no more than about two
  sentences. It never says "anonymous", "unique people" or anything implying Steven knows
  who asked; the people count is described as "counted once a day, like visitors".
- AC-4: No number from `src/articles/site/feed.json` is typed into the text (90 days is a
  retention rule from the README and `/privacy`, not a feed value), and nothing private is
  named: no cost figure, no budget, no secret or binding name, no table name.
- AC-5: The header "as of" date (19 October 2026) and the closing date read from
  `feed.json` stay as they are; `Diagrams.tsx` does not change (no diagram shows the
  assistant's dashboard).
- AC-6: The diff against `origin/main` touches only `src/articles/site/SiteArticle.tsx`
  and this spec. No test file is added or changed: no test pins the old sentence, and a
  test pinning the new prose would break on the next Building refresh and catch nothing.
- AC-7: `npm run lint`, `npm run test:coverage` (90% or more overall and per changed file)
  and `npm run build` pass with the existing tests; after the build,
  `dist/building-this-site.html` (and `dist/building-this-site.md`) contains the new
  sentence; `npm run check:recruiter` is not lower than on main (80/100).

## Out of scope

- The later merge 08852fd (Site update team runs) and any write-up change it calls for;
  a follow-up refresh covers it.
- `src/resume.ts`, the résumé PDF, `/privacy`, the admin and every other page.
- New diagrams or changes to `ReportCard`.

## Recruiter impact (senior-recruiter)

- First ten seconds: nothing changes (home, résumé, contact, LinkedIn, the assistant and the fit check are untouched); the edit is one sentence deep in section 05.
- Close read: a hiring manager learns that I measure who uses the assistant, not only how many questions it gets, which fits the "I measured what I shipped at Microsoft" line.
- Risk: the sentence could read as watching people. The privacy terms go in the same sentence: anonymous, counted once a day like visitors, kept 90 days, redacted, nothing under GPC/DNT; never suggest I know who asked.
- Risk: a run-on. Split into two short sentences rather than adding a fifth clause; no new section or picture; no count typed in.
- Baseline: `npm run check:recruiter` on main = 80/100 (the live pages; a run without `dist/` shows 50, which is not the branch's score); `node scripts/resume-check.mjs` ATS = 100/100.
- Verdict: APPROVED, provided the privacy terms stay with the claim and no number is typed in.

## Design (ux-designer)

- Nothing new renders: one more clause or short sentence in the existing `<p>` in section 05; type, measure and spacing unchanged, `<ReportCard />` stays below. No component, token or CSS change.
- No diagram changes: `Diagrams.tsx` never shows the assistant's dashboard (the source-of-truth chart shows the assistant as an output, the loop starts at "A visitor asks").
- About one line longer at 1440, two to three at 390; no reflow risk at 320.
- Screenshots: `building-this-site`, branch against main, the section 05 slice in light and dark.
- Verdict: APPROVED.

## Threat model (security-engineer)

- No new entry point, data, route, tool or dependency: one prerendered paragraph of static JSX copy; no model output, Markdown or visitor text is rendered, so there is no XSS or injection path.
- Disclosure: the copy says only what `/privacy` (`renderPrivacy` in `src/App.tsx`) already tells the public: questions kept 90 days with the same daily code; emails, phone numbers and keys removed; nothing under GPC or DNT. It names no table or migration, no secret or binding, not how the code is built, no admin path or section names, no cost, budget or rate limit, and not the preview-deployment exclusion (README only).
- Accuracy: "counted once a day, like visitors", never "unique people" or anything implying Steven knows who asked; no claim stronger than `/privacy` and the README **Log** bullet (not "anonymous", not "all personal data removed").
- Check: grep the changed paragraph and the prerendered page for table, secret and binding names, `salt`, `hash`, `migration`, `budget` and `$`, and expect no match; check each privacy claim against `renderPrivacy`; the diff touches only `SiteArticle.tsx` and this spec (reconciled: no test file, see AC-6).
- Verdict: APPROVED, provided the copy stays within `/privacy` and names none of the above.

## Test plan (senior-tester)

No test asserts the old sentence (grep over `*.test.*` for "go to the dashboard" finds none), so nothing needs updating. Copy is checked by reading it plus the named checks below, not by a unit test that pins the prose. A string match on a sentence that Building refreshes will reword would only break on the next refresh and catch nothing.

| AC | Test or check | Fails when |
|---|---|---|
| AC-1, AC-2, AC-3 | PM's and recruiter's read of the diff against README **Log** and `/privacy` (`renderPrivacy` in `src/App.tsx`); after `npm run build`, `grep -c "counted once a day" dist/building-this-site.html` (or the final wording) returns at least 1 | the claim is missing, goes beyond the sources, or is not in the prerendered page |
| AC-3 (page still whole) | `src/articles/articles.test.tsx` › "building-this-site reads as a complete article…"; `src/App.test.tsx` › `/building-this-site` route (h1, section headings, `privacy page` link) | the edit breaks the JSX, the TOC anchors or the links |
| AC-4 | `src/articles/feeds.test.ts` › "site/SiteArticle.tsx yields at least one key, and every one is in its feed.json"; reviewer greps the paragraph for digits other than "90" and for table, binding or secret names | a feed key goes missing; a number or private name is typed in |
| AC-5 | `git diff origin/main...HEAD -- src/articles/site/Diagrams.tsx src/articles/site/feed.json` is empty; `articles.test.tsx` › team diagram tests stay green | the date, feed or diagrams change |
| AC-6 | `git diff --name-only origin/main...HEAD` = `SiteArticle.tsx` + this spec | any other file is touched |
| AC-7 | `npm run lint`, `npm run test:coverage` (≥ 90% overall and for `SiteArticle.tsx`; copy inside an existing `<p>` adds no branch or function, so the file's numbers should not change), `npm run build`, `npm run check:recruiter` ≥ 80 (main's baseline) | any gate is red or lower than main |

Edge cases: a curly apostrophe or `’` stays as text (no stray `{`/`}` in JSX); a link added to `/privacy` keeps the existing `privacy page` link unique for `App.test.tsx`'s `getByRole` (add a second one under another name, or the test breaks); no new threat-model control. The only data path, GPC/DNT keeping nothing, is already covered by `functions/_lib/ask/agent.test.ts` › "keeps no unanswered question … under Global Privacy Control", and this change does not touch it.

Verdict: APPROVED. No new or changed test needed.

## Technical approach (senior-developer)

- Feasible as written: one JSX text edit to the `<p>` at `SiteArticle.tsx:182`, plain text, no new markup, component, import or dependency; curly quotes/apostrophes as the rest of the file.
- The Markdown copy is not committed: `scripts/prerender.mjs` turns the prerendered HTML into `dist/building-this-site.md`, `llms.txt` and `llms-full.txt` at every `npm run build`, and the assistant reads `/building-this-site.md` from the deployed assets at runtime (`functions/_lib/ask/prompt.ts`). So it updates by itself; no regenerate step, no file to commit beyond the TSX.
- No existing test pins this paragraph (`src/articles/articles.test.tsx` pins only section 06 text; the ask tests use fake Markdown). (Reconciled: not adopted; the tester's plan stands, see AC-6.) Proposed: add one there, in the style of the section 06 tests: render `<SiteArticle />`, find the section 05 paragraph before the report card, assert it names the people count, the daily code, 90 days, the redaction and GPC/DNT, ends on the Microsoft line, and contains none of `siteFeed.numbers` values. Do not reuse the `not.toMatch(/\d/)` check: "90" is a digit by design.
- AC-7's "prerendered page contains the sentence": check with `grep` on `dist/building-this-site.html` and `dist/building-this-site.md` after the build. Coverage: the TSX is already covered by the render tests; the edit adds no branch.

## Open questions for Steven

None. Reconciled decisions (PM):

1. Wording: security's bar wins over the recruiter's "anonymous". The copy stays within
   `/privacy`: counted once a day like visitors (the same daily code), kept 90 days,
   emails, phone numbers and keys removed, nothing under GPC/DNT. No "anonymous", no
   "unique people" (the code rotates daily; the same person on two days counts twice, as
   `specs/ask-people.md` says). The recruiter's real ask, privacy terms in the same breath
   as the claim, is kept.
2. Tests: the tester's plan wins; no new test pins the prose (AC-6, AC-7). The developer's
   proposed test is not built.
3. Prerender path: `dist/building-this-site.html`, not `dist/building-this-site/index.html`.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVED | | Reconciled: no "anonymous", no new test, path fixed |
| Senior recruiter | APPROVED | | Privacy terms stay with the claim; no number typed in |
| Senior designer | APPROVED | | |
| Senior developer | APPROVED (feasibility) | | Proposed test not adopted (AC-6) |
| Security engineer | APPROVED (threat model) | | Copy stays within `/privacy` |
| Senior tester | APPROVED (test plan) | | No new or changed test |
