# Building this site: the write-up is dated 20 October 2026 after the site-update-team-runs check-in

Slug: `building-steven-wilssens-com-merge-site--29` · Branch: `update/building-steven-wilssens-com-merge-site--29` · Status: built
Asked by Steven on 20 October 2026 (Site update workflow, Building refresh): "Refresh the Building write-up about steven.wilssens.com (/building-this-site, src/articles/site/SiteArticle.tsx) after a check-in on stewils/stevenwilssens.com: 'Merge site-update-team-runs: your MCP's change requests get made, and a run that changes nothing fails and tells you'."

## Problem

Peers and hiring managers who read `/building-this-site` to judge how Steven runs an
agent team need the write-up to match the repository. The check-in `08852fd` merged the
site-update-team-runs branch. Its main change for a reader is that Site update agents
run in the foreground, and a run that changes nothing outside `specs/` fails and Steven
is told. That change is already in the article: commit `59c907d` on the same branch
updated it ("The loop" bullet in `SiteArticle.tsx` line 193, "A run that changes nothing
fails and tells me so, instead of opening a pull request with nothing in it"; the
`Nothing changed` stop node in `Diagrams.tsx` line 73 and its flow description, line 66;
the matching line in `.claude/team.md`). The later commits on the branch are small fixes
inside the MCP: `a839dea`/`d0934f6` (a pull request from a fork is never treated as
Steven's), redaction of the run summary, the full status list, and `91b6f2c` (the spec
records each role's merge sign-off). A reader of the write-up would not miss any of them,
and none of them contradicts the text.

What is stale: the header comment at `SiteArticle.tsx` line 15 still says "19 October
2026". The closing section's date ("as of …", line 219) is rendered from `feed.asOf` via
`feedDate`, and `feed.json` has already been refreshed to `2026-10-20` in this branch, so
it needs no text edit.

Evidence: `sources/site.log` (commits 59c907d to 08852fd), `SiteArticle.tsx`,
`Diagrams.tsx`, `.claude/team.md`, `src/articles/site/feed.json`.

## Outcome

The write-up still agrees with the repository after the check-in, its source comment
carries the refresh date, and readers see the same article with the closing date
20 October 2026 and the refreshed live numbers from the feed. No new claim and no
typed number.

## Acceptance criteria

- AC-1: The header comment in `src/articles/site/SiteArticle.tsx` (lines 13 to 15) says
  "as of 20 October 2026"; "19 October 2026" no longer appears in the file.
- AC-2: The closing section still renders its date from `feed.asOf` through `feedDate`
  (no hard-coded date in the JSX), and in the built `dist/building-this-site/index.html`
  that date reads 20 October 2026.
- AC-3: `src/articles/site/feed.json` has `asOf` on 2026-10-20 (already in the working
  tree) and keeps every number key the article shows (the existing article test that fails
  when an article shows a number its feed lacks passes).
- AC-4: No other visible text or diagram in `SiteArticle.tsx` or `Diagrams.tsx` changes,
  unless the developer finds a sentence that contradicts the source files
  (`sources/site/CLAUDE.md`, `README.md`, `.claude/team.md`, `.claude/agents/`, the Review
  and Site update workflows); any such edit is listed in the pull request with the source
  line it now matches. `git diff main -- src/articles/site/` shows only the comment date
  and `feed.json`, or those plus the listed corrections.
- AC-5: The "The loop" bullet still says a run that changes nothing fails and Steven is
  told, and `TeamFlowDiagram` still has the `Nothing changed` stop; both agree with
  `.claude/team.md` step text and its Mermaid chart (no change to `.claude/team.md` in this
  pull request).
- AC-6: No number from `feed.json` is typed into the article text (the headline numbers
  come from `Stats`/the feed); nothing private (no visitor text, no dossier content, no
  run logs, no secret or variable name, token permission, cost or limit figure,
  redaction or fork-handling detail) is added:
  `git diff main -- src/articles/site/ | grep -E '^\+' | grep -niE 'token|secret|checks: ?read|jwt|redact|fork|cost|\$[0-9]'`
  finds nothing.
- AC-7: `npm run lint`, `npm run test:coverage` (90% or more overall and per changed
  file) and `npm run build` pass; `npm run check:recruiter` is not lower than main and the
  résumé ATS score is unchanged (`src/resume.ts` and the PDF are not touched).

## Out of scope

- Any sentence about the fork pull request handling, run summary redaction, the status
  list or the spec sign-off record (MCP internals; a reader would not miss them).
- Changes to `.claude/`, the workflows, the gate scripts or the admin Team page: this
  pull request changes no orchestration, so `/admin#team` and `scripts/team-manifest.mjs`
  are untouched.
- A sentence about the `GITHUB_TOKEN` "Checks: read" permission (operational setup for
  Steven, not a reader outcome).
- Restructuring "The loop" or adding a new diagram.

## Recruiter impact (senior-recruiter)

**First ten seconds.** Nothing changes. The home page, its first phone screen (who
Steven is, the role he wants, location and work authorization, contact, résumé link),
the résumé PDF, contact, LinkedIn, experience, the assistant and the job description
check are all untouched. `src/resume.ts`, `src/pageMeta.ts` and the PDF are not in the
diff.

**On a close read** (a hiring manager on `/building-this-site`). Before the page
hydrates, the header stat "pull requests opened by Claude Code from a conversation and
merged" reads 14 instead of 13, and the closing line reads "as of 20 October 2026".
Both come from `feed.json`, which the refresh wrote from the site's own database, and
`/api/building/site` replaces them once the page loads. The number has its source and
no copy is typed in. The header comment's date is a source comment and is not rendered.
For the reader this is a fresher page, nothing more. Reading the article as a sceptic
would, it still matches the check-in: "The loop" already says a run that changes
nothing fails and tells Steven, the diagram has the `Nothing changed` stop, and both
agree with `.claude/team.md`. Nothing about the change makes the page more
self-promotional.

**Baselines (20 October 2026, this worktree, before the build).**

- Résumé ATS score (`node scripts/resume-check.mjs`): **100/100**, 2 pages, 356 KB,
  0 errors, 0 warnings. One open question for Steven, already known and not caused by
  this change: the (cosmos) Software Developer dates (Jan 2004 to Dec 2005) overlap with
  Info Support (Jan 2001 to Dec 2004).
- Recruiter check (`npm run check:recruiter`): main's data on the live pages is
  **80/100**. The branch run printed 50/100 with six new medium findings, but every one
  says "page not in this deployment" or "no resume report", because `dist/` had not been
  built yet when I ran it. That result says nothing about this change. Once the lead has
  built, the merge review reruns the check against `dist/` and has to show 80/100 or
  more, with no new high finding.

**Risks to the bar, and what would make me block.**

1. A typed number. If the developer writes "14" (or any other feed value) into the
   article text instead of reading it from the feed, the number stops being live and
   goes stale on the next merge (AC-6). That is a blocker.
2. A visible date in the JSX. The closing date has to stay `feedDate(feed.asOf)`
   (AC-2); a hard-coded "20 October 2026" would be wrong by the next refresh.
3. Scope creep. Any edit beyond the comment and `feed.json` (AC-4) gets a line-by-line
   check against its source in the merge review. A new sentence about MCP internals
   would make the article busier for a hiring manager and would not help them decide;
   I agree with the PM's Out of scope and with both "no" recommendations under Open
   questions.
4. A stale or mismatched feed. If `feed.json` lost a key the header shows, the stat
   would render empty. The existing article test covers this (AC-3).

**What a recruiter would ask that the change should answer.** Nothing new. The
question a hiring manager has on this page ("does he actually run this, and is it
current?") is answered better by a date one day newer and a live count.

**Pushback on the PM.** None. The criteria serve the reader: they keep the article
accurate and keep numbers live, and none adds self-promotion.

**Verdict: APPROVE** (spec). For the merge I will need the recruiter check rerun on
the built `dist/` at 80/100 or more with no new high finding, an ATS score of 100/100,
and `git diff main -- src/articles/site/` limited to what AC-4 allows.

## Design (ux-designer)

Verdict on the spec: **APPROVE**. Nothing new to design. Two values change on screen, and
no diagram needs to change.

**What a reader sees differently.** Only two things, both read from
`src/articles/site/feed.json` and neither typed into the article:

1. The fourth stat tile ("pull requests opened by Claude Code from a conversation and
   merged") shows **14** instead of 13 in the prerendered HTML.
2. The closing section's date (`<span data-feed-date>`, rendered by `feedDate(feed.asOf)`)
   reads **20 October 2026** instead of 19 October 2026.

The header comment in `SiteArticle.tsx` (lines 13 to 15) is a source comment and does not
render. Every other part of the article stays the same: copy, sections, the table of
contents, `LoopDiagram`, `TeamFlowDiagram`.

**Why the layout cannot move.** `.wx-stats dt` uses `DM Mono` with
`font-variant-numeric: tabular-nums`. "13" and "14" are the same width, so the tile, the
4-column grid at 1440 and the 2-column grid under the phone breakpoint
(`article.css` line 179) keep their size. "19 October 2026" and "20 October 2026" have the
same number of characters in the same paragraph, so the line breaks stay where they are at
1440, 390 and 320. No token, component or CSS changes. The light and dark themes use the
same `--green`/`--muted` colours as now, so contrast is unchanged.

**States.**
- *No JavaScript (prerendered):* the reader sees the feed values above, 14 and
  20 October 2026. This is the state that changes.
- *Loading, then live:* `enhanceArticle` replaces the tiles and the date with
  `/api/building/site` once the page loads, as before. Today the feed matches the live
  numbers, so a reader with JavaScript sees no jump from 13 to 14 when the fetch returns.
  That is a small improvement.
- *Error:* if the fetch fails, the prerendered feed values stay. Same behaviour as now.
- *Empty or very long content:* does not apply. No new text and no new rows.

**Diagram check.** I compared `TeamFlowDiagram` (`src/articles/site/Diagrams.tsx`,
`flowSteps`, `reviews`, `flowDescription`) with the Mermaid chart in
`sources/site/.claude/team.md`, which matches this repository's `.claude/team.md` line for
line (`diff -q` finds no difference):

| Chart node / edge | Diagram |
|---|---|
| `ask` (you) | "I ask" (accent, `main`) |
| `spec` subgraph: PM, recruiter, designer; security, tester, developer add | "Spec: PM with recruiter and designer; security, test, dev add theirs" |
| `q` → `steven1` (you), asked once | "My questions: asked once, all together" (accent) |
| `build` | "Build: developer, with tests" |
| `build -- nothing changed, so the run fails and Steven is told` | "Nothing changed: the run fails and I am told" (stop colour), also in `flowDescription` |
| `reviews` r1 to r6 | the six chips: code review, security, tests 90% a file, design + screenshots, recruiter: not worse, PM: acceptance |
| `fix` loop, max 3 rounds | "Fix and review again, at most three rounds" |
| `pr`: Review check, main's gates and team review | "Pull request: required Review check: main's gates + team review" |
| `merge` (you) → `deploy` | "I merge" (accent) → "Deploy" |

Every node and edge in the chart appears in the drawing, including the step this check-in
is about. The diagram draws the "nothing changed" edge as a stop where the run ends, not as
an arrow back to "I ask". That is the right reading for a visitor and it matches the
chart's label. The chart's `gate` class (dashed spec, reviews and pull request) is not
drawn as dashes in the article. That gap was already there before this change, it is not a
mismatch in the flow, and fixing it is out of scope here. `LoopDiagram` shows the MCP loop
and this check-in does not affect it. **No diagram changes.** The flow did not change, so
CLAUDE.md's rule that a diagram changes with its flow needs nothing new here.

**Accessibility.** Nothing changes. The stat tiles stay a `<dl>`. The diagrams keep their
`<title>`/`<desc>`, so a screen reader hears the updated date and number as text. No
control, focus order or motion is added. Reduced motion does not apply.

**Pages to screenshot.** None are needed for the UI check: `git diff` shows only the
comment date and two values in `feed.json`, so the pixel difference is two glyphs.
If the lead wants a before/after pair for Steven, the useful one is
`building-this-site` at 390 (`--slices`, the first screen with the stat tiles) on main and
on the branch. At the merge check I will confirm that the built
`dist/building-this-site/index.html` shows 14 and "20 October 2026" and that the build
changed no other visible text.

## Threat model (security-engineer)

**New entry points and data.** None. The diff is a source comment date in
`src/articles/site/SiteArticle.tsx` and `src/articles/site/feed.json` (`asOf`, and
`pullRequestsMerged` 13 to 14). No route, tool, input, token, permission, dependency or
workflow changes. The untrusted inputs are the ones every Building refresh already has:
the check-in's commit messages and diff in `sources/` (written by the workflow, ignored
by git), and the live answer of `/api/building/site` that becomes `feed.json`.

**Abuse cases, controls and proofs.**

1. **Private operational detail copied into the public page.** The check-in's commits
   (`sources/site.log`) name the `GITHUB_TOKEN` secret and its "Checks: read" permission,
   JWT redaction in the run summary, the feed's 32-number cap and how fork pull requests
   are kept apart (no redo, no branch delete, markers hidden). None of it helps a reader,
   and together it maps the defences for an attacker. *Control:* Out of scope, AC-4 and
   AC-6 keep it out. The article diff may contain no secret or variable name, token
   permission, cost or limit figure, redaction or fork-handling detail, run log, visitor
   text or dossier content. *Proof (merge review):* `git diff main -- src/articles/site/`
   shows only the comment date and `feed.json` (AC-4), and
   `git diff main -- src/articles/site/ | grep -E '^\+' | grep -niE 'token|secret|checks: ?read|jwt|redact|fork|cost|\$[0-9]'`
   finds nothing.
2. **Text or markup injected through the feed.** If the live API (or a compromised
   project site) answered strings, objects or `__proto__` keys, they could reach the
   prerendered page. *Control:* `scripts/building-feed.mjs` keeps only finite numbers
   under plain keys, at most 32, plus an `asOf` that is a valid ISO date no later than
   now. React renders the values as text. *Proof:* the existing
   `scripts/building-feed.test.mjs` passes, and so does `src/articles/articles.test.tsx` ›
   `keeps every feed in the shape the pages read: a date and finite numbers`. The merge
   review checks that `feed.json` has exactly the keys `project` (`"site"`), `asOf` and
   `numbers`, and that every value under `numbers` is an integer. The current diff meets
   this: two numbers and a date, no new key.
3. **Prompt injection through `sources/`.** Commit messages and diffs are text written
   by their authors, and Claude Code reads them during the refresh. A planted "ignore your
   instructions..." could try to steer the edit, run commands or add text. *Control:*
   `sources/` is evidence to compare with the article, never instructions. The edit is
   limited to what the spec allows, and the merge goes through main's gates and the
   six-role review. I scanned `sources/site.log` and found no text that reads as an
   instruction. Its only sensitive mentions are the operational details in item 1, which
   stay out. *Proof:* the AC-4 diff check. Any edit beyond the comment date and the feed
   must be listed with the source line it matches. If the diff holds nothing else, the
   sources steered nothing.
4. **A wrong or inflated live number.** The count comes from the site's own D1 through
   `/api/building/site`, and the live value replaces it at page load. A wrong count is an
   accuracy problem, not a security one. AC-3 and AC-6 cover it (no number typed into the
   text).

**Verdict: APPROVE.** No new attack surface. The only risk is private operational
detail copied into a public page, and the AC-4 diff check controls it.

## Technical approach (senior-developer)

Feasible as written: a one-line comment edit on top of a feed refresh that is already in
the working tree. No new code, helper, dependency, route, query or test file.

**Files.**

| File | Change |
|---|---|
| `src/articles/site/SiteArticle.tsx` | Line 15 of the header comment: "19 October 2026" → "20 October 2026". It is the only occurrence of that date in the file; nothing else changes. |
| `src/articles/site/feed.json` | Already modified by the refresh (`asOf` `2026-10-20T03:20:41.239Z`, `pullRequestsMerged` 13 → 14); same keys, so committed as is. |
| `specs/building-steven-wilssens-com-merge-site--29.md` | This spec. |

Not touched: `Diagrams.tsx` (the `Nothing changed` stop and `flowDescription` already
match `.claude/team.md`), `src/resume.ts` and the PDF (so no `npm run resume:build`),
`public/og-image.png` (headline and photo unchanged), `src/pageMeta.ts` (the
`building-this-site` Article JSON-LD carries only `datePublished`, no `dateModified` to
bump; adding one is out of scope), `.claude/`, workflows and `scripts/team-manifest.mjs`
(no orchestration change, so no Team page update).

**Why the rendered date is right without a JSX edit.** Line 219 renders
`feedDate(feed.asOf)`; `feedDate` (`src/articles/wilssens/article.ts` line 8) formats in
`en-GB` with `timeZone: 'UTC'`, so `2026-10-20T03:20:41.239Z` prints "20 October 2026"
in the prerender on any build machine's time zone, and the client's `enhanceArticle`
(line 116) writes the same function's output after the live fetch, so prerender and
hydration agree. The stat tile reads `feed.numbers.pullRequestsMerged` through `Stats`;
no number is typed in the text.

**Tests.** None to add: the change has no logic. Existing coverage that guards it:
`src/articles/articles.test.tsx` ("keeps every feed in the shape the pages read: a date
and finite numbers" and the per-article completeness test, which fails when a stat key
is missing from the feed). No test pins the site article's date or the value 13
(checked with a grep for `19 October 2026` / `2026-10-19` across `src`, `scripts` and
`functions`: the hits are other articles, fixtures on a fixed clock and the AI Breaker
JSON-LD, none tied to this article). Coverage of `SiteArticle.tsx` is unchanged, since
a comment carries no statements.

**Verification (all must pass before hand-over).**

1. `grep -n "19 October 2026" src/articles/site/SiteArticle.tsx` prints nothing (AC-1).
2. `git diff main -- src/articles/site/` (or `origin/main` in a fresh checkout) shows only the comment line and the two
   `feed.json` values (AC-4).
3. `npm run lint`
4. `npm run test:coverage` (90% or more overall and per changed file; `feed.json` and a
   comment-only change are not counted against it).
5. `npm run build`, then `grep -o "as of <span data-feed-date=\"\">[^<]*" dist/building-this-site/index.html`
   reads "20 October 2026." and the fourth stat tile reads 14 (AC-2, AC-3).
6. `npm run check:recruiter` against the built `dist/` (80/100 or more, no new high
   finding) and `node scripts/resume-check.mjs` still 100/100 (AC-7), for the recruiter.

**Risks.** Practically none. The only way to get it wrong is scope creep (typing the date
or the 14 into JSX, or editing prose beyond AC-4); the diff check in step 2 catches it.

## Test plan (senior-tester)

No production logic changes (a source comment and two values in `feed.json`), so no new
test is required. Each criterion maps to an existing test or a named check below; the one
thin spot (AC-2) is called out with the test that would close it.

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | Named check: `grep -c "19 October 2026" src/articles/site/SiteArticle.tsx` is 0 and `grep -n "as of" src/articles/site/SiteArticle.tsx` shows `20 October 2026` on lines 14 to 15. A source comment does not render, so no unit test can see it. | named check |
| AC-2 | `src/articles/wilssens/article.test.ts` › `feedDate` › `writes the day the numbers were read, the same in every time zone` (UTC day, long month, on fixed October 2026 inputs; this value itself is proven by the built page check); same file, `enhanceArticle` replaces `[data-feed-date]` from the live feed. Built page: `grep -o 'data-feed-date="">[^<]*' dist/building-this-site/index.html` reads `20 October 2026.` after `npm run build`. Hard-coding guard: `git diff main -- src/articles/site/SiteArticle.tsx` touches only the comment (AC-4). | unit + named check |
| AC-3 | `src/articles/feeds.test.ts` › `site/SiteArticle.tsx yields at least one key, and every one is in its feed.json`; `src/articles/articles.test.tsx` › `keeps every feed in the shape the pages read: a date and finite numbers` (parses `asOf`, every number finite). Value check: `asOf` starts `2026-10-20` in `git diff -- src/articles/site/feed.json`. | unit + named check |
| AC-4 | Named check: `git diff --stat main -- src/articles/site/` lists only `SiteArticle.tsx` (one comment line) and `feed.json`; `git diff main -- src/articles/site/Diagrams.tsx` is empty. Backed by `src/articles/articles.test.tsx` › `the pull request item says a run that changes nothing fails and tells Steven, and the paragraph after it is unchanged` (exact text of the loop paragraph) and › `reads as a complete article: …`. | named check + unit |
| AC-5 | `src/articles/articles.test.tsx` › `the flow diagram shows the stop when nothing changed, across and stacked` (`Nothing changed` node, stop colour, after Build, in the description) and › `the pull request item says a run that changes nothing fails and tells Steven, …` (exact sentence). Agreement with `.claude/team.md`: `git diff main -- .claude/` is empty; the designer's node-by-node comparison above. | unit + named check |
| AC-6 | `src/articles/feeds.test.ts` (header numbers come from `stats` keys the feed has); `src/articles/articles.test.tsx` › the loop item and the unread-updates sentence assert `not.toMatch(/\d/)`. No general "no feed value in the text" test exists; for this pull request the AC-4 diff check (comment and `feed.json` only) proves no number was added, and the AC-6 grep (security's abuse case 1) proves no private operational detail was. | unit + named check |
| AC-7 | `npm run lint`; `npm run test:coverage` (per-file 90% thresholds in `vitest.config.ts`; no changed file under `src/` or `functions/` carries code, `feed.json` is data); `npm run build`; `npm run check:recruiter` on the built `dist/` at 80/100 or more with no new high finding; `node scripts/resume-check.mjs` ATS 100/100; `git diff main -- src/resume.ts public/steven-wilssens-resume-2026.pdf` empty; `src/resume.test.ts` (PDF matches `src/resume.ts`). | commands |

**Edge cases.**
- `asOf` near midnight: `feedDate` formats in UTC, so `2026-10-20T03:20:41Z` stays
  20 October 2026 in any time zone at build (the `feedDate` test's `+02:00` case
  covers the rule; the built page check covers this value).
- A refresh that drops a key the header shows: `feeds.test.ts` fails (AC-3).
- The live fetch fails or returns a bad date: `enhanceArticle` keeps the prerendered date
  (covered in `article.test.ts`).

**Gap (minor, not blocking this refresh).** No test renders `SiteArticle` and checks that
the closing date is `feedDate(feed.asOf)`; a later edit that hard-codes the date would pass
every unit test today and only the diff review would catch it. Suggested test for a future
change (in `src/articles/articles.test.tsx`): render `<SiteArticle />` and expect
`document.querySelector('[data-feed-date]')` to have text `` `${feedDate(siteFeed.asOf)}.` ``.

**Verdict: APPROVE** (spec). Every AC has a test or a named check that would fail if it
broke; no new tests needed for a comment-and-feed refresh. At merge I need the coverage run
green and the AC-2/AC-4 named checks on the built `dist/`.

## Open questions for Steven

1. Should the write-up mention that the MCP never acts on a pull request from someone
   else's fork (a security outcome a peer might value)? Recommendation: no, not in this
   refresh; it is an MCP internal and the article already covers that only his own pull
   requests and replies count. Revisit if the security story of the site gets its own
   section.
2. Should the write-up say that a Building refresh with nothing new warns and opens no
   pull request (distinct from a requested change that fails)? Recommendation: no; the
   existing sentence covers the outcome a reader cares about (no empty pull requests), and
   the distinction is operational.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE | | Reconciled: no conflicts between sections; AC-6 now carries security's private-detail grep; test plan's feedDate citation corrected to the real test; every AC maps to a test or named check; two open questions, both recommended "no", neither blocks |
| Senior recruiter | APPROVE | | Baselines: ATS 100/100; recruiter check 80/100 (main on live pages; the branch run before the build is not comparable) |
| Senior designer | APPROVE | | Two feed values render differently (14, 20 October 2026); no layout, token or diagram change; TeamFlowDiagram matches .claude/team.md |
| Senior developer | FEASIBLE | | One comment line in SiteArticle.tsx plus the feed.json already refreshed; rendered date comes from feedDate (UTC), no JSX, test or resume:build change |
| Security engineer | APPROVE | | No new entry point, input or token; feed.json carries numbers only (building-feed.mjs); sources/ is evidence, not instructions; no secret names, permissions, limits or fork handling in the article (AC-4 diff check) |
| Senior tester | APPROVE | | AC-1..AC-7 mapped to existing tests (feeds.test.ts, articles.test.tsx, article.test.ts) and named checks; no new tests needed; minor gap: no render test pins the closing date to feedDate(feed.asOf) |
