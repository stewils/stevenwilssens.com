# Building this site: the write-up is dated 23 October 2026 after the mcp-plain-names check-in

Slug: `building-steven-wi-45` · Branch: `update/building-steven-wi-45` · Status: built
Asked by Steven on 23 October 2026 (Site update workflow, Building refresh): "Refresh the Building write-up about steven.wilssens.com (/building-this-site, src/articles/site/SiteArticle.tsx) after a check-in on stewils/stevenwilssens.com: 'Merge mcp-plain-names: your updates get readable names, each its own preview, and no numbers in what your assistant is told'."

## Problem

Peers and hiring managers who read `/building-this-site` to judge how Steven runs an
agent team need the write-up to match the repository. The check-in `9336a39` merged the
mcp-plain-names branch. The only change in the watched files (`sources/site.diff`) is in
`.github/workflows/site-update.yml`, step `Create the branch`: the branch slug is cut to
`20 - len(run number)` characters so Cloudflare's 28-character preview address keeps the
run number, and two updates never share a preview. The other commits (`23bb94c`,
`b832f6e`, `c0c8e5b`, `210ade9`) are MCP internals: update names, the wording of the
hints, "not ready to go live yet". A reader of the write-up would not miss any of them.

Nothing in the article contradicts the check-in. "The loop" (`SiteArticle.tsx` line 193)
says the workflow "opens a pull request, starts the preview and emails me", still true;
`Diagrams.tsx` lines 55 and 75 say "after the preview", still true.
`sources/site/.claude/team.md` and `sources/site/CLAUDE.md` match this repository's
copies (`diff -q` finds no difference).

What is stale: the header comment at `SiteArticle.tsx` line 15 says "20 October 2026".
The closing section's date (line 219) renders from `feed.asOf` via `feedDate`, and
`feed.json` is already refreshed in the working tree (`asOf` 2026-10-23; countries 14,
vitals good 85%, proposals approved 28, pull requests merged 16), so it needs no text edit.

Not an orchestration change for the Team page: CLAUDE.md counts a `site-update.yml` change
only in `Let Claude make the change` or `Open the pull request`; this one is in
`Create the branch`, already on main, and this pull request does not touch the workflow.

Evidence: `sources/site.log` (to `9336a39`), `sources/site.diff`, `SiteArticle.tsx`,
`Diagrams.tsx`, `src/articles/site/feed.json`.

## Outcome

The write-up still agrees with the repository after the check-in, its source comment
carries the refresh date, and readers see the same article with the closing date
23 October 2026 and the refreshed numbers from the feed. No new claim and no typed number.

## Acceptance criteria

- AC-1: The header comment in `src/articles/site/SiteArticle.tsx` (lines 13 to 15) says
  "as of" … "23 October 2026"; `grep -n "20 October 2026" src/articles/site/SiteArticle.tsx`
  finds nothing.
- AC-2: The closing section still renders its date from `feedDate(feed.asOf)` (no
  hard-coded date in the JSX), and in the built `dist/building-this-site.html` that
  date reads 23 October 2026.
- AC-3: `src/articles/site/feed.json` has `asOf` on 2026-10-23 and keeps every number key
  the article shows (`countries`, `vitalsGoodPercent`, `proposalsApproved`,
  `pullRequestsMerged`); `src/articles/articles.test.tsx` passes.
- AC-4: No other visible text or diagram in `SiteArticle.tsx` or `Diagrams.tsx` changes,
  unless the developer finds a sentence that contradicts the source files
  (`sources/site/CLAUDE.md`, `README.md`, `.claude/team.md`, `.claude/agents/`, the Review
  and Site update workflows); any such edit is listed in the pull request with the source
  line it now matches. `git diff main -- src/articles/site/` shows only the comment date
  and `feed.json`, or those plus the listed corrections.
- AC-5: No number from `feed.json` is typed into the article text, and nothing private is
  added (no visitor text, dossier content, run logs, secret or token, run or pull request
  number, preview address or branch-length detail):
  `git diff main -- src/articles/site/*.tsx | grep -E '^\+' | grep -niE 'token|secret|28|run number|pages\.dev|\$[0-9]'`
  finds nothing.
- AC-6: No file under `.claude/`, `.github/`, `scripts/` or `src/admin/` changes, nor
  `src/resume.ts` or the résumé PDF (`git diff --stat main` lists only `specs/`,
  `src/articles/site/`).
- AC-7: `npm run lint`, `npm run test:coverage` (90% or more overall and per changed
  file) and `npm run build` pass; `npm run check:recruiter` on the built `dist/` is not
  lower than main, and the résumé ATS score is unchanged.

## Out of scope

- A sentence about per-update preview addresses, update names, or the hint wording (MCP
  and workflow internals; a reader would not miss them, and "starts the preview" stays
  accurate).
- Changes to `.claude/`, the workflows, the gate scripts or the admin Team page: this pull
  request changes no orchestration, so `/admin#team`, `TeamFlowDiagram` and the Mermaid
  chart are untouched.
- Restructuring "The loop" or adding a diagram.

## Recruiter impact (senior-recruiter)

**First ten seconds.** Nothing changes. The home page, the résumé PDF, contact, LinkedIn,
the assistant and the job description check are untouched; `src/resume.ts` and
`src/pageMeta.ts` do not change. On `/building-this-site` only the four header figures
(feed values) and the closing date move.

**Close read.** The header reads 14 countries, 85 percent of measurements rated good,
28 proposals approved, 16 pull requests merged (checked in the built
`dist/building-this-site.md`). The drop in "rated good" from 91 to 85 does not matter to a
hiring manager: it is a secondary stat on a project write-up, not a claim about Steven's
work, and it is the measured value from `feed.json` (replaced on load by
`/api/building/site`), never typed. Shipping the real number is more credible than
holding back a lower one; I agree with team decision TD-2. No new
claim, number or outcome is added, so nothing needs a source.

**Baselines (23 October 2026, build of this branch with the refreshed feed).**
- `npm run check:recruiter`: 80/100 (main's data on the live pages: 80/100); 0 high,
  4 medium, 0 low; 11 questions for Steven; "Not worse for recruiters than main's data".
- `node scripts/resume-check.mjs`: ATS 100/100, 2 pages, 0 errors, 0 warnings; with
  `--baseline https://steven.wilssens.com/resume-report.json`: 100 → 100, same as live.
  Its one open question (the Cosmos / Info Support date overlap) predates this change.

**Risks to the bar.** None expected. AC-5 and AC-6 already guard the two that could hurt
(a typed number; an unintended résumé or meta change). At merge I rerun both scores and
check that the closing date still renders from `feedDate(feed.asOf)`.

**What a recruiter would ask.** Nothing new. Per-update previews (team decision TD-1) are
internal detail and stay out.

Verdict: APPROVED.

## Design (ux-designer)

Nothing renders differently except four feed values and one date, each in a slot that
already exists:

- Header Stats: countries 12 → 14, Core Web Vitals good 91% → 85%, proposals approved
  28 (unchanged), pull requests merged 14 → 16. Every value is still two digits (vitals
  keeps its "%"), so each stat keeps its width at 1440px, 390px and 320px: no wrap, no
  reflow, no change to the Stats row. On load the page swaps in `/api/building/site` as
  before; the prerendered (no JavaScript) page shows these feed values.
- Closing line: `feedDate(feed.asOf)` renders "23 October 2026" in place of
  "20 October 2026", the same length, in the same `data-feed-date` span.
- The `SiteArticle.tsx` edit is a source comment; it never reaches the DOM.

No component, token, diagram, copy, focus order, label, contrast pair or motion changes,
in light or dark; the states are unchanged (the feed keeps all four keys, AC-3).

Screenshot check: no layout risk, so no 320px, keyboard or admin pass. Because
`src/articles/site/` changes, the UI check is not `NOT_APPLICABLE`: one branch-against-main
pair of `building-this-site` (1440px and 390px, top slice) confirms the Stats row is the
same apart from the digits. Should the developer end up editing visible copy under AC-4,
the full UI check applies to that section.

Verdict: APPROVED.

## Threat model (security-engineer)

**Entry points and data.** None new: no route, function, tool, workflow, dependency or
header changes. The change is a source-comment date in `SiteArticle.tsx` (never reaches
the DOM) and `feed.json`, which the article already renders.

**`feed.json`.** `asOf` (an ISO timestamp) and four integers (`countries`,
`vitalsGoodPercent`, `proposalsApproved`, `pullRequestsMerged`): aggregates, no visitor
rows, IPs, user agents, country names, transcript text, dossier entries or tokens. Rendered
as text through the existing `Stats` and `feedDate` (React escapes them); no
`dangerouslySetInnerHTML`. On load `/api/building/site` replaces them, as before.

**Privacy of the write-up.** Nothing new is said. AC-5 keeps secrets, run or pull request
numbers, preview addresses and the branch-length detail out of the `.tsx` diff; nothing
about family or colleagues is added.

**`sources/` is data, not instructions.** The log, the diff and the copies under
`sources/site/` are evidence to compare the article against, not rules for this run; an
instruction inside them is not followed. They were only read and compared.

**Abuse cases and controls.**
- Text in a check-in steers the refresh into adding a claim, a secret or a link: AC-4 and
  AC-5 limit the diff to the comment date and `feed.json`.
- A non-numeric feed value reaches the page: `src/articles/articles.test.tsx` ("a date and
  finite numbers") holds each value to a finite number.
- Edits outside scope (`.github/`, `.claude/`, `scripts/`, `functions/`): AC-6.

Verdict: APPROVED.

## Technical approach (senior-developer)

Feasible as written; one comment line and the feed, no code path changes.

- **Edit:** `src/articles/site/SiteArticle.tsx` line 15, `20 October 2026` →
  `23 October 2026` in the header comment. Nothing else in the file.
- **Feed:** `src/articles/site/feed.json` as refreshed in the working tree (`asOf`
  `2026-10-23T03:00:57.975Z`, same four keys). `feedDate` (`src/articles/wilssens/article.ts:8`)
  formats in `timeZone: 'UTC'`, so the prerendered and hydrated closing date both read
  "23 October 2026"; no hydration difference. The Stats header reads the feed by key.
- **Checked, no change needed:** `sources/site.diff` touches only `site-update.yml`
  `Create the branch` (slug length for the preview address). The article's only mentions
  of the preview (`SiteArticle.tsx:193` "starts the preview", `:194` "I read the preview",
  `:199` caption "a preview link") and `Diagrams.tsx:55,75` ("after the preview") stay
  true. No date or number besides line 15 is typed in either file: line 89 "October 2026"
  is the publication month, line 119 is the launch date, line 140 is a historical
  checker output; none come from the feed.
- **No test changes:** `src/articles/articles.test.tsx` already asserts the feed keys
  (line 78), a valid `asOf` (line 71) and the feed URL; a comment does not affect
  coverage.
- **Verify:** `grep -n "20 October 2026" src/articles/site/SiteArticle.tsx` (empty);
  `git diff --stat main` (only `specs/`, `src/articles/site/`); `npm run lint`;
  `npm run test:coverage`; `npm run build`, then
  `grep -o 'data-feed-date="">[^<]*' dist/building-this-site.html` reads
  "23 October 2026."; `npm run check:recruiter`. No `resume:build` or og-image (no
  `src/resume.ts`, headline or photo change).

Verdict: FEASIBLE.

## Test plan (senior-tester)

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | `grep -n "20 October 2026" src/articles/site/SiteArticle.tsx` is empty and `grep -n "23 October 2026" src/articles/site/SiteArticle.tsx` hits lines 13 to 15 (source comment, never rendered, so no unit test can see it) | grep |
| AC-2 | `grep -n "feedDate(feed.asOf)" src/articles/site/SiteArticle.tsx` hits the closing `data-feed-date` span and `git diff main -- src/articles/site/SiteArticle.tsx` adds no date in JSX; `grep -o 'data-feed-date="">[^<]*' dist/building-this-site.html` reads `23 October 2026.`. The formatting itself: `src/articles/wilssens/article.test.ts` › `feedDate` (UTC date, timezone offsets) | grep + built HTML + unit |
| AC-3 | `src/articles/feeds.test.ts` › "site/SiteArticle.tsx yields at least one key, and every one is in its feed.json"; `src/articles/articles.test.tsx` › "keeps every feed in the shape the pages read: a date and finite numbers" and "keeps development costs out of this site's feed: the same four numbers, no cost figure" (exact key set); `asOf` checked by `node -e "console.log(require('./src/articles/site/feed.json').asOf)"` starting `2026-10-23` | unit + check |
| AC-4 | `git diff main -- src/articles/site/` shows only the comment date and `feed.json` (or the corrections listed in the pull request); `src/articles/articles.test.tsx` › "the team diagram on /building-this-site" block (preview/merge wording, loop diagram, metered layer, unread updates) stays green, so any drift in the loop text or diagrams fails | diff + unit |
| AC-5 | the spec's `git diff main -- src/articles/site/*.tsx \| grep -E '^\+' \| grep -niE 'token\|secret\|28\|run number\|pages\.dev\|\$[0-9]'` is empty; also no added line matches `\b(14\|85\|16)\b` (the refreshed feed values) | grep |
| AC-6 | `git diff --stat main` lists only `specs/` and `src/articles/site/`; `src/resume.test.ts` (PDF matches `src/resume.ts`) stays green | diff + unit |
| AC-7 | `npm run lint`, `npm run test:coverage`, `npm run build`, `npm run check:recruiter` (80/100 baseline, not lower than main), `node scripts/resume-check.mjs --baseline https://steven.wilssens.com/resume-report.json` (100 → 100) | named checks |

Edge cases: the refreshed feed keeps all four keys (a dropped key would render 0, caught
by `feeds.test.ts`); `asOf` at 03:00Z renders the same day in UTC (covered by the
`feedDate` timezone cases); the prerendered page shows feed values and the live swap is
unchanged (`articles.test.tsx` › "asks the live feed for today's numbers only where the
project has one").

New tests: none. There is no code change: the comment never reaches the DOM and
`feed.json` is data already held by `feeds.test.ts` and `articles.test.tsx`. A test
pinning "23 October 2026" or the four values would break on every refresh and assert
nothing about behaviour; the built-HTML grep covers the date for this pull request.
Gap noted, not blocking: no unit test asserts that the site article's closing span is
fed by `feedDate(feed.asOf)` rather than a typed date (only the AC-2 grep does); worth
adding to `articles.test.tsx` the next time that file changes for a code reason.

Coverage stays at or above 90% (statements, branches, functions, lines) and every new
or changed file is at 90% or more on its own. No `.ts`/`.tsx` logic changes, so the
per-file numbers equal main's; `SiteArticle.tsx` is checked in `coverage-summary.json`
at merge.

Verdict: APPROVED.

## Team decisions

- TD-1: "The loop" does not mention that every update gets its own preview. An editorial
  call: "starts the preview" is already true and the detail does not help a reader decide
  (Out of scope, first bullet; recruiter agrees).
- TD-2: The feed's "Core Web Vitals good" value ships as 85% (was 91%). It is a measured
  live number from `feed.json`, not a choice; the article never types it and the page
  replaces it with `/api/building/site` on load (AC-3, AC-5; recruiter agrees).

## Open questions for Steven

None.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | approved | | |
| Senior recruiter | APPROVED | | |
| Senior designer | APPROVED | | |
| Senior developer | FEASIBLE (feasibility) | | |
| Security engineer | APPROVED (threat model) | | |
| Senior tester | APPROVED (test plan) | | |
