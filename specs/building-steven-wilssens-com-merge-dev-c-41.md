# Building this site: the write-up is dated 23 October 2026 after the dev-costs check-in

Slug: `building-steven-wilssens-com-merge-dev-c-41` · Branch: `update/building-steven-wilssens-com-merge-dev-c-41` · Status: built
Asked by Steven on 23 October 2026 (Site update workflow, Building refresh): "Refresh the Building write-up about steven.wilssens.com (/building-this-site, src/articles/site/SiteArticle.tsx) after the check-in 'Merge dev-costs: your admin shows what each change cost to build with Claude, per feature, role and month, with budgets and waste' (5ec02cb). Update the 'as of' date in the header comment and the closing section to 23 October 2026. Leave out anything private: costs, limits, secret names."

## Problem

Peers and hiring managers who read `/building-this-site` to judge how Steven runs an
agent team need the write-up to match the repository. The check-in `5ec02cb` merged the
dev-costs branch. Its change for a reader is that the team's runs are metered against the
change they belong to (and, in Steven's own sessions, against the role), a change can
have a budget, and redone rounds are counted. That change is already in the article: the
dev-costs branch updated it in the same check-in (the last sentence of the "Put every
change past a team" bullet in "The loop", `SiteArticle.tsx` line 194; the `meterLines`
strip under `TeamFlowDiagram`, `Diagrams.tsx` line 82; the end of `flowDescription`,
line 66). These agree with `.claude/team.md`: the `meter` node "Runs metered: admin,
Costs" under the flow (lines 43 to 45) and the paragraph after the chart (line 64).

The later commits on the branch (`b2c32c0`, `354c182`, `d746158`, `c26dd30`) are fixes a
reader of the write-up would not miss: fork pull requests kept out of the cost matching,
GitHub's 500 pull request cap, hooks turned off in the workflows' Claude steps, CSS of
the month bars, tests, screenshots and sign-offs. None of them contradicts the text.

What is stale: the header comment at `SiteArticle.tsx` line 15 still says "20 October
2026". The closing section's date ("as of …", line 219) is rendered from `feed.asOf`
through `feedDate`, and `feed.json` has already been refreshed to `2026-10-23` in the
working tree, so the JSX needs no edit.

Private, and kept out of the public page: the name of the token the costs job uses, any
cost or price figure, the per-run cap, the daily row limit, how runs are billed.

Evidence: `sources/site.log` (commits up to `5ec02cb`), `sources/site.diff`,
`SiteArticle.tsx`, `Diagrams.tsx`, `.claude/team.md`, `src/articles/site/feed.json`.

## Outcome

The write-up still agrees with the repository after the check-in, its source comment
carries the refresh date, and readers see the same article with the closing date
23 October 2026 and the refreshed live numbers from the feed. No new claim, no typed
number, nothing private.

## Acceptance criteria

- AC-1: The header comment in `src/articles/site/SiteArticle.tsx` (lines 13 to 15) says
  "23 October 2026"; "20 October 2026" no longer appears in the file
  (`grep -c "20 October 2026" src/articles/site/SiteArticle.tsx` is 0).
- AC-2: The closing section still renders its date from `feed.asOf` through `feedDate`
  (no hard-coded date in the JSX), and in the built `dist/building-this-site.html` (the
  build writes no `dist/building-this-site/index.html`)
  `grep -o 'data-feed-date="">[^<]*' dist/building-this-site.html` gives
  "23 October 2026.".
- AC-3: `src/articles/site/feed.json` has `asOf` on 2026-10-23 (already in the working
  tree), keeps the keys `project`, `asOf` and `numbers`, and keeps every number key the
  article shows (`src/articles/feeds.test.ts` and the feed shape test in
  `src/articles/articles.test.tsx` pass).
- AC-4: No other visible text or diagram in `SiteArticle.tsx` or `Diagrams.tsx` changes,
  unless the developer finds a sentence that contradicts the source files
  (`sources/site/CLAUDE.md`, `README.md`, `.claude/team.md`, `.claude/agents/`, the Review
  and Site update workflows); any such edit is listed in the pull request with the source
  line it now matches. `git diff main -- src/articles/site/` shows only the comment date
  and `feed.json`, or those plus the listed corrections. Settled at reconcile: the two
  older wordings the developer flagged, "a required Review check" (`SiteArticle.tsx`
  line 194, `Diagrams.tsx` lines 66 and 74) and "Every change, mine included" (line 194),
  are not contradictions and are not edited here. CLAUDE.md itself calls `gates`, `team`
  and `check` "the required checks" (required by the team's rule until Steven turns on
  branch protection) and says "Every change goes through Steven's product team"; they
  are open questions 3 and 4 for a later pass.
- AC-5: The "The loop" bullet still ends with the metered-runs sentence, and
  `TeamFlowDiagram` still has the meter strip (`meterLines`) and the metered sentence at
  the end of `flowDescription`; both agree with the `meter` node and the paragraph after
  the chart in `.claude/team.md` (no change to `.claude/` in this pull request).
- AC-6: No number from `feed.json` is typed into the article text (the header numbers come
  from `Stats` and the feed). Nothing private is added (no secret, token or variable name,
  no cost, price, cap or row-limit figure, no billing detail, no fork-handling detail, no
  visitor text or dossier content):
  `git diff main -- src/articles/site/ | grep -E '^\+' | grep -niE 'token|secret|_KEY|cost|price|\$[0-9]|1,000|cap|limit|bill|fork|redact'`
  finds nothing.
- AC-7: `npm run lint`, `npm run test:coverage` (90% or more overall and per changed
  file) and `npm run build` pass; `npm run check:recruiter` on the built `dist/` is not
  lower than main with no new high finding, and the résumé ATS score is unchanged
  (`src/resume.ts` and the PDF are not touched).

## Out of scope

- Any sentence about the cost figures, the per-run cap, the row limit, billing, the
  token the costs job uses, or the Costs page's internals (private, and not a reader
  outcome; Steven asked to leave them out).
- Any sentence about fork pull requests in the cost matching, GitHub's 500 pull request
  cap, hooks turned off in the workflows' Claude steps, the month bar CSS or the tests
  (fixes a reader would not miss).
- Changes to `.claude/`, the workflows, the gate scripts or the admin Team page: this
  pull request changes no orchestration, so `/admin#team`, `scripts/team-manifest.mjs`
  and the Mermaid chart are untouched, and no diagram changes.
- Restructuring "The loop" or adding a new diagram.
- A `dateModified` in the article's JSON-LD (`src/pageMeta.ts`).

## Recruiter impact (senior-recruiter)

**First ten seconds.** Nothing changes. The home page and its first phone screen (who
Steven is, the role he wants, location and work authorization, contact, résumé link),
the résumé PDF, contact, LinkedIn, experience, the assistant and the job description
check are untouched. `src/resume.ts`, `src/pageMeta.ts` and the PDF are not in the diff.

**On a close read** (a hiring manager on `/building-this-site`). Before the page
hydrates, the header shows 14 countries (was 12), 85 percent of measurements rated good
(was 91), 28 approved résumé changes (unchanged) and 16 merged pull requests (was 14).
The closing line reads "as of 23 October 2026". All five values come from `feed.json`,
which the refresh wrote from the site's own database, and `/api/building/site` replaces
the numbers once the page loads. Each number has its source and none is typed in. The
header comment date does not render. In the build I made for the baseline,
`dist/building-this-site.md` shows exactly these values and `data-feed-date` reads
"23 October 2026".

The drop from 91 to 85 percent good vitals is the one figure that reads less well. I do
not want it hidden or rounded. The section on the assistant promises "the numbers that do
not flatter it", and a sceptical reader trusts a page more when a figure moves the wrong
way. 85 is still a credible figure, and its label says what it measures. If it keeps
falling, that is a performance question for Steven's admin. The copy is not where to
fix it.

**The metered-runs sentence** ("The agents' runs, on GitHub and in my own Claude Code
sessions, are metered against the change they belong to, and in my sessions against the
role that ran them; a change can have a budget, and the rounds that had to be redone are
counted, so I can see which kind of change is worth the full team.")

- **What works.** It is accurate: it matches the `meter` node and the paragraph after the
  chart in `.claude/team.md`. It names no figure, token or limit. Its last clause is the
  strongest signal on the page for a hiring manager: Steven measures the cost of his own
  process and decides where the full team is worth it. That is the judgement a product or
  engineering leader is hired for, and the sentence does not boast.
- **What is weak.** The form. At about 60 words, it closes a bullet that is already the
  longest in the list (about 160 words). The middle part ("and in my sessions against the
  role that ran them") is plumbing a hiring manager does not need.
- **Verdict on it.** It reads well enough to keep. It contradicts no source, so AC-4 is
  right to keep it out of this refresh. For a later pass on the write-up I suggest:
  "Every agent run is metered against the change it belongs to; a change can have a
  budget, and redone rounds are counted, so I can see which kinds of change are worth the
  full team." That keeps the outcome and drops the detail. It is not a condition of this
  spec.

**Baselines (23 October 2026).** Run in this worktree after `npm run build`, with
`feed.json` already refreshed and the comment date not yet edited.

- Recruiter check (`npm run check:recruiter`): **80/100**. Main's data on the live pages
  also scores 80/100. 0 high, 4 medium and 0 low findings, plus 11 questions only Steven
  can answer. Result: "Not worse for recruiters than main". Nothing under "Needs a look".
- Résumé ATS score (`node scripts/resume-check.mjs --baseline
  https://steven.wilssens.com/resume-report.json`): **100 → 100**, the same as the live
  site. 2 pages, 357 KB, 0 errors, 0 warnings. The one open question is already known and
  this change did not cause it: the (cosmos) Software Developer dates (Jan 2004 to
  Dec 2005) overlap with Info Support (Jan 2001 to Dec 2004).

**Risks to the bar, and what would make me block at merge.**

1. A typed number. If a feed value (14, 85, 28, 16) or the date is written into the JSX
   instead of read from `feed.json` and `feedDate(feed.asOf)`, it goes stale on the next
   refresh (AC-2, AC-6). That is a blocker.
2. Scope creep. Any visible edit beyond the comment and `feed.json` needs the source line
   it now matches (AC-4). An edit that adds a cost, budget figure or limit to the public
   page is a blocker. Those details are private, Steven asked to leave them out, and to a
   hiring manager they read as noise.
3. Search and link previews. Today `dist/building-this-site.html` has `index, follow`, a
   `<title>` and an `og:image` that points at `/og-image.png`. None of that may change.
4. A recruiter's path. The closing actions (Ask about Steven, Download the résumé, Share
   on LinkedIn, More projects) stay as they are.

**Note for the PM.** AC-2 names `dist/building-this-site/index.html`, but the build
writes `dist/building-this-site.html` (and `.md`). The test plan should check that file.

**What a recruiter would ask that this change should answer.** Nothing new. The change
is a date and a fresher set of live numbers. Steven is not needed.

**Verdict: APPROVE.** No question for Steven.

## Design (ux-designer)

**What renders differently.** Only values that come from `src/articles/site/feed.json`,
on `/building-this-site`, in the prerendered HTML (before the live fetch from
`/api/building/site` counts them on to today's):

| Where | Main | Branch | Characters |
|---|---|---|---|
| Header stat `countries` | 12 | 14 | 2 → 2 |
| Header stat `vitalsGoodPercent` | 91 | 85 | 2 → 2 |
| Header stat `proposalsApproved` | 28 | 28 | unchanged |
| Header stat `pullRequestsMerged` | 14 | 16 | 2 → 2 |
| Closing "as of" (`data-feed-date`, `feedDate(feed.asOf)`) | 20 October 2026. | 23 October 2026. | 16 → 16 |

The header comment date (`SiteArticle.tsx` line 15) is a source comment and does not
render. The byline (`.wx-meta`, "October 2026") does not change. No other page, admin
part, diagram or control is touched.

**Why the layout cannot move.** Every stat keeps its digit count (two before, two after),
and `.wx-stats dt` sets DM Mono with `font-variant-numeric: tabular-nums`, so each
figure keeps the same width to the pixel; the labels (`dd`) are untouched. The count-up
(`data-count`, `article.ts`) runs to a two-digit value either way, so a figure does not
change width while it animates. The closing date has the same length and wraps where it
wrapped before. So at 1440px the tiles keep their row, at 390px (and 320px) the same
grid, in light and dark; the figures keep `--green` on the same backgrounds, so contrast
is unchanged.

**States.** No JavaScript: the prerendered figures and date are the feed's, correct for
23 October. Loading, or a failed live fetch: the feed's figures stay, as today. Reduced
motion: the existing count-up handling applies; nothing new moves. Keyboard, focus order
and labels: no control is added or changed.

**How it reads.** Countries and merged pull requests go up; the share of good loading,
response and stability measurements goes down from 91 to 85. It is the measured value
and still a credible figure next to its plain label, so the design shows it as it is;
rounding or hiding it would break the rule that header numbers come from the feed.

**Reused.** `Stats` (`src/articles/wilssens/Stats.tsx`), the `.wx-stats` rules,
`feedDate`. No new token, pattern, diagram or CSS.

**Screenshots skipped.** Apart from four figures of the same width and a date of the same
length, nothing renders differently, so before/after shots would show only the new
digits. The UI check at merge confirms the `data-feed-date` text in the built page and
that `npm run check:site -- --lighthouse none` finds no layout, console or axe problem
on `/building-this-site`.

**Verdict: APPROVE.** No question for Steven.

## Threat model (security-engineer)

**Entry points and data.** None new. No route, function, tool, workflow, permission,
secret or dependency changes. The diff is a source comment (does not render) and four
integers plus a timestamp in `feed.json`, which the refresh wrote from the site's own
aggregate counts (no visitor rows, no transcript or dossier text).

**Abuse cases and controls.**

1. *Private detail on a public page.* The write-up names a secret or variable, a cost,
   price, cap or row limit, billing, fork handling, or a disabled defence (hooks off in
   the workflows' Claude steps), which tells an attacker where to push. Control: AC-6's
   grep on the added lines of `src/articles/site/`, plus Out of scope and open question 2
   (recommended no). The existing metered-runs sentence (line 194, `flowDescription`)
   already passes: no figure, name or defence, and `articles.test.tsx` pins it word for
   word.
2. *Feed values as markup.* `feed.json` values reach the page only as React text
   (`Stats`, `feedDate(feed.asOf)`), never through `dangerouslySetInnerHTML`, and the
   shape tests (AC-3) hold the keys and number types, so a tampered feed cannot inject
   script; the live `/api/building/site` path is unchanged.
3. *Privacy of the numbers.* Country count, share of good vitals and counts of approved
   proposals and merged pull requests are aggregates already shown publicly; nothing
   identifies a visitor.

**Tests that prove it.** AC-6's grep returns nothing; `src/articles/feeds.test.ts` and
the feed shape test pass; the metered-sentence tests in `src/articles/articles.test.tsx`
pass unchanged; `git diff main -- src/articles/site/` shows only the comment and
`feed.json` (AC-4).

**Verdict: APPROVE.** No question for Steven.

## Technical approach (senior-developer)

**Feasible as written; one comment edit.**

- `src/articles/site/SiteArticle.tsx` line 15: "20 October 2026" → "23 October 2026". A
  comment only: no rendered text, no test reads it.
- `src/articles/site/feed.json`: already refreshed in the working tree (`asOf`
  `2026-10-23T00:14:31.388Z`; countries 14, vitals 85, proposals 28, pull requests 16);
  same keys and shape, no edit.
- No other file. No JSX, CSS, diagram, `.claude/`, `src/resume.ts` or PDF change.

**The closing date comes from the feed.** Line 219 renders
`<span data-feed-date="">{feedDate(feed.asOf)}.</span>`; `feedDate`
(`src/articles/wilssens/article.ts` line 8) formats with `en-GB` in UTC, so
`2026-10-23T00:14Z` gives "23 October 2026" whatever the build machine's zone, and
`article.ts` line 116 overwrites it with the live `asOf` after load. The current
`dist/building-this-site.html` (built with the refreshed feed) already carries
`data-feed-date="">23 October 2026.`. Note for AC-2: the built file is
`dist/building-this-site.html`, not `dist/building-this-site/index.html`.

**Contradiction check** against `.claude/team.md`, `sources/site/CLAUDE.md` and
`sources/site/README.md` (both byte-identical to the repository's own files): none.
The six roles, spec with recruiter and designer then security, test and developer
sections, questions asked once (and once per fix round), the stop when nothing changed,
six fresh reviews, at most three rounds, the Review check running main's gates and the
team review, Steven's merge, unread team updates in the admin, and the metered runs
(per change, per role in Steven's sessions, a budget per change, redone rounds counted;
`.claude/team.md` lines 43 to 45 and 64, README "Costs") all match `SiteArticle.tsx`
lines 189 to 196 and `Diagrams.tsx` lines 66 to 82. Two pre-existing wordings are
looser than the sources but not wrong for a reader, so they stay out of this refresh:
"a required Review check" (CLAUDE.md: required by the team's rule, enforced by GitHub
once Steven turns on branch protection) and "Every change, mine included" (Dependabot's
own pull requests get `gates` only). Nothing private is in either file.

**Verify:** `grep -c "20 October 2026" src/articles/site/SiteArticle.tsx` is 0;
`git diff main --stat -- src/articles/site/` lists only `SiteArticle.tsx` (1 line) and
`feed.json`; `npm run lint`, `npm run test:coverage` (`src/articles/feeds.test.ts`,
`src/articles/articles.test.tsx`), `npm run build`; then
`grep -o 'data-feed-date="">[^<]*' dist/building-this-site.html` reads
"23 October 2026.". No `resume:build` or og-image run: neither input changes.

## Test plan (senior-tester)

No production logic changes: a source comment and the data in `feed.json`. The existing
tests already fail if the refresh breaks what a reader sees, so **no new test is needed**.
A test that pins the date or the four values would go stale on the next refresh and is
not wanted.

| Criterion | Check (file › test, or command) |
|---|---|
| AC-1 comment date | `grep -c "20 October 2026" src/articles/site/SiteArticle.tsx` is 0 and `grep -c "23 October 2026"` is 1 (a comment; no test reads it) |
| AC-2 date from the feed | `src/articles/wilssens/article.test.ts` › `feedDate` (dates in UTC, so `asOf` `2026-10-23T00:14Z` cannot read as 22 October in any time zone); in the built `dist/building-this-site.html` (not `/index.html`, the build writes no such file) `grep -o 'data-feed-date="">[^<]*' dist/building-this-site.html` gives `23 October 2026.`; JSX line 219 still reads `{feedDate(feed.asOf)}` |
| AC-3 feed shape and keys | `src/articles/feeds.test.ts` › "%s yields at least one key, and every one is in its feed.json" (site); `src/articles/articles.test.tsx` › "keeps every feed in the shape the pages read: a date and finite numbers" and "keeps development costs out of this site’s feed: the same four numbers, no cost figure" |
| AC-4 nothing else changes | `git diff main --stat -- src/articles/site/` lists only `SiteArticle.tsx` (1 line) and `feed.json`; `articles.test.tsx` › "%s reads as a complete article…" stays green |
| AC-5 metered sentence and strip | `articles.test.tsx` › "says the loop is metered per change, with a budget, in one sentence without a number, a price or \"every\"" and "draws the metered layer in both drawings, inside the picture, with the same words in the description" |
| AC-6 no typed number, nothing private | `feeds.test.ts` (numbers come from the `Stats` tuples and the feed); the AC-6 grep on the added lines finds nothing |
| AC-7 bars | `npm run lint`, `npm run test:coverage` (no changed file is under coverage: the comment does not change any statement in `SiteArticle.tsx`, and `feed.json` is data), `npm run build`, `npm run check:recruiter` (80/100, as main), résumé ATS 100 = live |

Edge cases: the `asOf` timestamp is 14 minutes after midnight UTC, the case the
`feedDate` test pins; the live fetch writes the same `data-feed-date` span through the
same function (`article.ts` line 116, covered by `article.test.ts`). The 91 → 85 drop is
data, not a defect, and no test asserts the value. Deterministic: no timers or network
in the tests named.

**Verdict: APPROVE.** No question for Steven.

## Build notes

- Built as specified: only the comment date in `SiteArticle.tsx` and the refreshed `feed.json`.
- One test outside the spec had to change. `scripts/costs-safety.test.mjs` ("adds one colour
  token, --series-soft") compared `src/admin/admin.css` with `origin/main` and expected exactly
  `--series-soft` to be new. Since dev-costs merged, main has that token too, so the test failed
  on main and on every branch with `origin/main` (and would fail this pull request's checks).
  It now checks that no token other than `--series-soft` is new against main, which keeps its
  intent. No product code changed.
- `npm run lint`, `npm run test:coverage` (92 files, 1254 tests) and `npm run build` pass;
  the built page's closing date reads 23 October 2026.

## Open questions for Steven

Steven is not available for this run; each question carries the recommendation the team
builds on, and none blocks the refresh.

1. Should the write-up say how much a change costs to build, or what the budgets are (a
   number a peer might find interesting)? Recommendation: no; Steven asked to leave costs
   and limits out, and the existing sentence already gives the reader the outcome (runs
   are metered, a change can have a budget, redone rounds are counted).
2. Should the write-up mention that the workflows' Claude steps run with hooks turned off,
   as a second safeguard? Recommendation: no, not in this refresh; it is an operational
   safeguard, and naming defences on a public page helps an attacker more than a reader.
3. Once you turn on branch protection for `gates`, `team` and `check`, "a required Review
   check" is exact; until then it is required by the team's rule, not by GitHub. Should
   the write-up say so? Recommendation: no edit in this refresh; it matches CLAUDE.md's
   own "the required checks", and a reader loses nothing. Turning on branch protection
   makes the sentence literally true.
4. "Every change, mine included, goes through Claude Code agents in six roles" is
   looser than the sources: Dependabot's own pull requests get `gates` only. Should it
   carve out dependency bumps? Recommendation: no edit in this refresh (CLAUDE.md uses
   the same "every change"); at the next write-up pass, if the bullet is shortened as the
   recruiter suggests, say "Every change I or the agents make" so bumps are not claimed.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE | | Comment date only plus the feed already refreshed; the metered-runs text and diagram strip already match .claude/team.md; private details kept out by AC-6; AC-2 now names dist/building-this-site.html; the two looser older wordings ("a required Review check", "Every change, mine included") are not contradictions and stay; four open questions, all recommended "no edit now", none blocks |
| Senior recruiter | APPROVE | | Nothing changes on the first screen or on any path; only feed values change, each with its source; baselines 80/100 (= main) and ATS 100 (= live); the metered-runs sentence is accurate and a good signal, could be shorter later; AC-2 should name dist/building-this-site.html |
| Senior designer | APPROVE | | Only three feed figures and the closing date render differently; each figure stays two digits in tabular DM Mono and the date keeps its length, so no tile reflows at any width or theme; screenshots skipped |
| Senior developer | APPROVE | | One comment date in SiteArticle.tsx line 15 plus the refreshed feed.json; closing date renders from feedDate(feed.asOf) in UTC; no contradiction with .claude/team.md, CLAUDE.md or README.md; AC-2 should name dist/building-this-site.html |
| Security engineer | APPROVE | | No new entry point, secret, permission or dependency; feed values are integers rendered as React text; AC-6 grep keeps tokens, costs, limits, billing and disabled defences off the page; the existing metered-runs sentence leaks none of them |
| Senior tester | APPROVE | | Existing tests cover it (feeds.test.ts, articles.test.tsx feed shape, no-cost and metered tests, article.test.ts feedDate in UTC); dist/building-this-site.html data-feed-date reads "23 October 2026." (checked); no new test needed; AC-2 should name dist/building-this-site.html |
