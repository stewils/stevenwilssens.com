# Building this site: the write-up says who opens the site's pull requests and when the assistant is tested, dated 23 October 2026

Slug: `building-steven-wilssens-com-merge-mcp-p-43` · Branch: `update/building-steven-wilssens-com-merge-mcp-p-43` · Status: built
Asked by Steven on 23 October 2026 (Site update workflow, Building refresh): "Refresh the Building write-up about steven.wilssens.com (/building-this-site, src/articles/site/SiteArticle.tsx) after a check-in on stewils/stevenwilssens.com: 'Merge mcp-prs-flow: your MCP's pull requests can merge (a GitHub App opens them so their checks attach), the assistant is tested in CI, and the MCP says what holds one'."

## Problem

Peers and hiring managers read `/building-this-site` to judge how Steven runs an agent
team, so the write-up has to match the repository. The check-in `40d84f9` merged the
mcp-prs-flow branch (`sources/site.log`, commits `1991f78` to `cdf2de9`). For a reader it
changed three things:

1. **Who opens a Site update pull request.** The workflow now pushes and opens it as the
   site's own GitHub App, from a separate job that runs nothing from the branch. Because
   of that, the pull request's required checks (gates, team, check) start on it like on
   anyone's, and a green one can merge. Before, they never counted (`1991f78`;
   `.claude/team.md` step 8; CLAUDE.md, The team).
2. **When the assistant is tested.** The Review workflow runs the assistant check in CI
   on a change to the assistant, the résumé or a write-up (`.claude/team.md` step 8,
   `prTeam` node; CLAUDE.md).
3. **What Steven hears when a change is held.** The MCP names what holds an update, in
   plain words (`884e91f`, `4da1533`; CLAUDE.md, The MCP server).

The article already covers part of this. "The loop", bullet 5 says "On GitHub the team
review runs as one of the pull request's own checks" (added in `cdf2de9`), and
`TeamFlowDiagram`'s Pull request box reads "its own checks: gates, team review, / site
checks, assistant tested in CI". Three things are still out of step with the sources:

- **Stale:** the header comment at `SiteArticle.tsx` line 15 says "as of 20 October
  2026". The feed is now dated 2026-10-23.
- **Narrower than the files:** `flowDescription` (`Diagrams.tsx` line 66, read by screen
  readers as the diagram's `<desc>`) says the team review "also tries the assistant when
  a change touches it". The sources say the check runs on a change to the assistant, the
  résumé or a write-up. A reader would take "touches it" to mean the assistant's code
  only.
- **Missing, and now slightly wrong:** "The loop", bullet 4 ("Change the site, through a
  pull request") says Claude Code "opens a pull request". It no longer does. A separate
  step opens it as the site's App, and that is why the pull request's checks count. A
  peer who wants to know whether the agent can merge its own work would miss this, and
  it is the mechanism the check-in is named after.

`src/articles/site/feed.json` has already been refreshed in this branch (`asOf`
2026-10-23, countries 12 → 14, vitals good 91 → 85, pull requests merged 14 → 16). The
closing date renders from `feed.asOf` through `feedDate`.

Evidence: `sources/site.log`, `sources/site/CLAUDE.md`, `.claude/team.md` (step 8 and
the Mermaid chart), `SiteArticle.tsx` lines 15 and 193 to 194, `Diagrams.tsx` lines 66
and 74, `src/articles/articles.test.tsx` lines 165 to 241.

## Outcome

A peer reading "The loop" learns, in one sentence and without operational detail, that
the site's pull requests are opened by the site's own App from a step that runs nothing
from the branch. That is why their required checks count. When a change is held up, the MCP
tells Steven what holds it. The flow diagram's description names the right trigger for
the assistant check. Every other part of the article stays the same, apart from the
fresher date and live numbers that come from the feed.

## Acceptance criteria

- AC-1: The header comment in `src/articles/site/SiteArticle.tsx` (lines 13 to 15) says
  "as of 23 October 2026". "20 October 2026" no longer appears in the file.
- AC-2: The closing section still renders its date from `feed.asOf` through `feedDate`,
  with no date typed into the JSX. In the built `dist/building-this-site/index.html`, the
  `data-feed-date` span reads "23 October 2026". A new test (T-2) renders
  `<SiteArticle />` and checks that `[data-feed-date]` reads `feedDate(siteFeed.asOf)`
  followed by a full stop. It also checks that the source of `SiteArticle.tsx`, with
  comment lines removed, has no typed "<day> <Month> <year>" date.
- AC-3: `src/articles/site/feed.json` is committed as refreshed: `project` "site",
  `asOf` starting `2026-10-23`, and the same four keys under `numbers`, all integers.
  `src/articles/feeds.test.ts` and the feed-shape test in `src/articles/articles.test.tsx`
  pass.
- AC-4: In `flowDescription` (`src/articles/site/Diagrams.tsx`), the clause "the team
  review, which also tries the assistant when a change touches it" becomes "the team
  review, which also tests the assistant on a change to the assistant, the résumé or a
  write-up". The rest of the description is word for word the same, and it still has no
  first person. The assertion in `articles.test.tsx` ("draws the flow across and
  stacked…", line 180) is updated to the new text in the same pull request and passes for
  both drawings.
- AC-5: "The loop", bullet 4 ("Change the site, through a pull request.") no longer says
  that Claude Code opens the pull request. It says, in at most one added sentence plus
  the change to the existing first sentence, that:
  (a) the pull request is opened by the site's own GitHub App, from a step that runs
  nothing from the branch;
  (b) because of that, the pull request's required checks start on it as on anyone's;
  (c) when a change is held up, the MCP tells Steven what holds it.
  The wording below is the agreed text (PM, recruiter, designer, developer). The developer
  may tighten it, but keeps (a) to (c) and the rules after it:
  > An approved batch goes to GitHub Actions, where an agent first writes a spec for it,
  > then Claude Code edits the data file on a branch, rebuilds the résumé through the gate
  > and runs the lint, tests and build. A separate step that runs nothing from the branch
  > opens the pull request as the site’s own GitHub App, so the pull request’s required
  > checks start on it as on anyone’s; the preview starts and I get an email of what
  > changed, in plain words. Questions only I can answer go into the spec and the pull
  > request. A run that changes nothing fails and tells me so, instead of opening a pull
  > request with nothing in it. When a change is held up, the MCP tells me what holds it.

  Rules for the bullet:
  - The two existing sentences "Questions only I can answer go into the spec and the pull
    request." and "A run that changes nothing fails and tells me so, instead of opening a
    pull request with nothing in it." stay word for word (existing test, lines 213 to 219).
  - It still mentions the preview and the email.
  - "in plain words" appears exactly once.
  - Apostrophes are typographic (’). There is no straight `'` in the bullet.
  - The bullet contains no digit (existing test, line 217).
  - The bullet grows by about one sentence: at most about 40 words more than on main. It
    gets no new paragraph, and nothing spreads into bullet 5, the paragraph after the list
    or a caption.

  A new test (T-1 in the test plan) renders `<SiteArticle />` and takes bullet 4's `li`.
  It checks that the bullet contains "GitHub App", "runs nothing from the branch",
  "required checks", "what holds it", "preview" and "email". Then it splits the bullet
  into sentences. The sentence that matches `/opens (the|a) pull request/` must contain
  "GitHub App" and must not contain "Claude Code". The test also checks the "in plain
  words" count, the absence of `'`, and the absence of
  `/token|secret|permission|environment|bundle|publish|read-only|workflow_dispatch/i`.
- AC-6: No other visible text in `SiteArticle.tsx` or `Diagrams.tsx` changes. That
  includes bullet 5 and its pinned sentences, the paragraph "The agent never pushes to
  production…", the Pull request box lines, `LoopDiagram`, the figure captions and the
  screenshot's alt text. `git diff main -- src/articles/site/` shows only the comment
  date, `feed.json`, the `flowDescription` clause (AC-4) and bullet 4 (AC-5). Any further
  correction the developer finds is listed in the pull request with the source line it
  now matches.
- AC-7: Nothing private or operational and no typed number is added. The added lines
  name no secret, variable, environment or key, no token or its permissions, no job
  name (`publish`, `update`), no "bundle", no cost or limit, and nothing from visitors or
  the dossier:
  `git diff main -- src/articles/site/*.tsx | grep -E '^\+[^+]' | grep -niE 'token|secret|permission|environment|private key|variable|key|\.github|grow|refus|limit|bundle|publish|workflow_dispatch|read-only|cost|\$[0-9]|http|<script|dangerouslySetInnerHTML|href'`
  finds nothing. On 23 October 2026 the three lines that change (`SiteArticle.tsx` 15 and
  193, `Diagrams.tsx` 66) do not match it today, so a hit is something added. "GitHub
  App", "required checks" and "runs nothing from the branch" are allowed. No value from
  `feed.json` appears in the article text. No sentence suggests that anyone but Steven
  merges. The diagram test
  that rejects `GitHub App|workflow_dispatch|check run|token` inside the drawing still
  passes, so the App is named in the article text only, never in the diagram.
- AC-8: No change to `.claude/`, `.github/`, `CLAUDE.md`, `src/resume.ts`, the PDF,
  `src/pageMeta.ts` or `scripts/team-manifest.mjs` (`git diff main --stat` on those paths
  is empty). This pull request changes no orchestration, so the Team page and the
  Mermaid chart do not change. `TeamFlowDiagram`'s nodes still match `.claude/team.md`'s
  chart (Pull request: own checks, assistant tested in CI).
- AC-9: `npm run lint`, `npm run test:coverage` (90% or more overall and per changed
  file) and `npm run build` pass. `npm run check:recruiter` on the built `dist/` is not
  lower than main and adds no new high finding. The résumé ATS score is unchanged.

## Out of scope

- Any detail of how the hand-over works: the git bundle, the read-only token, the
  App's environment and key, the refusal of changes that touch `.github/` or do not
  grow from main, cost posting. These are defences and setup, not something a reader
  needs, and together they map the defences.
- The assistant check's internals: the five questions, the three facts held to
  `profile`, the report digest, "scope not decided", the model limits.
- MCP internals: rechecks (`recheck: true`), redoing a conflict or a refresh, the
  merge-at-the-previewed-commit rule, the error for a missing permission. Bullet 4 gets
  one clause, "tells me what holds it", and nothing more.
- The Team page's new Site update step boxes (`4da1533`). Admin-only.
- The `LoopDiagram` label "a pull request made by Claude Code" and the screenshot alt
  text "opened by the github-actions bot". The first is still true of the change itself.
  The second describes a historical screenshot of the first batch. See open question 2.
- A new section, a new diagram, or a change to the Pull request box. It already says
  "its own checks … assistant tested in CI".
- A `dateModified` in the article's JSON-LD.

## Recruiter impact (senior-recruiter)

**Verdict: APPROVE** (spec), with the conditions under *What makes me block* below.

**Who reads this page.** Recruiters seldom open `/building-this-site`. The hiring managers
and engineering peers Steven is forwarded to do, and they read it to answer one
question: can this person run an agent team with real controls, or is it a demo? This
change touches nothing on the recruiter's paths: home, résumé PDF, contact, LinkedIn,
experience, the assistant, the job description check. No change to `src/resume.ts`,
`src/pageMeta.ts`, the PDF, the og image or the first screen of any page.

**First ten seconds.** Nothing changes. The header numbers come from `feed.json` (already
refreshed: countries 12 → 14, pull requests merged 14 → 16, vitals good 91 → 85). The
drop in the vitals figure is real data, not an edit. It does not make the page less
credible, and it stays rendered from the feed, never typed into the text. The closing
date moves to 23 October 2026 through `feedDate(feed.asOf)`.

**Close read.** The bullet 4 sentence is a net gain for a hiring manager. "The agent opens
a pull request" next to "a team review gates the merge" raises an obvious question from
a sceptical engineering lead: can the agent approve its own work? The new sentence
answers it. A separate identity opens the pull request, from a step that runs none of
the branch's code, and the same required checks run on it as on anyone's. That is a
controls story a director-level reader respects, and it is the mechanism the check-in is
named after. The AC-4 fix to `flowDescription` corrects a claim that was narrower than
the truth. Only screen readers hear it. No reader's decision depends on it, but keeping
it accurate is right.

**Notes on AC-5's proposed wording.** It does the job, but it adds about 35 words to the
second-longest bullet in the list. I agree with both of the designer's wording notes:
- "so its required checks start on it as on anyone’s" becomes "so the pull request’s
  required checks start on it as on anyone’s".
- "When a change is held, my MCP tells me what holds it" becomes "When a change is held
  up, the MCP tells me what holds it". "Held" alone reads like a status or HR term, and the
  section already introduces "a private MCP server".

One more note: do not say "in plain words" a second time in the bullet. It is there once
already, for the email. Beyond these notes, the sentence should not grow.

**Open questions (recruiter's view).** Q1: yes, name the App. It is the credibility
point, and naming it reveals nothing. Q2: agree, keep the alt text. It describes a dated
screenshot of the first batch accurately. Q3: agree, no prose sentence. The Pull request
box already says it, and more length helps no reader decide.

**Baselines on main's data, 23 October 2026 (this worktree, before the edits).**
- Résumé ATS score (`node scripts/resume-check.mjs`): **100/100**, 2 pages, 0 errors, 0
  warnings. The one standing question for Steven is the 2004 date overlap between Cosmos
  and Info Support, which this change does not touch. Expected after the change:
  unchanged, because no résumé input changes.
- `npm run check:recruiter`: **50/100, against 80/100 for main's data on the live pages.
  The 50 is not meaningful**: `dist/` is not built in this worktree, so every page reads
  "not in this deployment" (5 pages plus the résumé report: 6 new medium findings, 0
  high). The baseline that counts is the live **80/100, 0 high**. At merge review the check
  is rerun on the lead's build and must not be lower than main or add a high finding.

**What makes me block at merge review.**
1. A number from `feed.json` typed into the article text, the diagram or its description,
   or a date typed into the closing section instead of `feedDate(feed.asOf)`.
2. Private or operational detail in the visible text or the `<desc>`: a secret, variable,
   environment or key name, a token or its permissions, "read-only", the job names
   (`update`, `publish`), "bundle", the refusal of changes to `.github/`, rechecks, costs or
   limits. One sentence on who opens the pull request is the ceiling. A map of the
   defences is not acceptable.
3. Length creep: bullet 4 growing by more than about 40 words, a new paragraph, or the
   explanation spreading into bullet 5, "The agent never pushes to production…" or a
   caption. AC-6 keeps the rest of the page word for word.
4. Jargon a hiring manager trips over, added without a gloss: "check runs", "contexts",
   "workflow_dispatch", "repository_dispatch", "head SHA", "App installation". "GitHub App"
   and "required checks" are fine on this page, whose readers are technical.
5. Any claim the sources do not back, for example "the agent can now merge" (it cannot:
   Steven merges), or wording that suggests the team review replaces Steven's decision.
6. Any change to the recruiter's paths, `src/resume.ts`, the PDF, `pageMeta`, the og
   tags or `noindex` on this page, or a recruiter score or ATS score lower than main's.

## Design (ux-designer)

**Verdict: APPROVED**, with two wording notes for the developer (below). This is a text
refresh of a long-form article. No layout, token, component or diagram geometry changes,
and nothing new for the keyboard to reach.

### What renders differently

| Where | Main | Branch | Seen by |
|---|---|---|---|
| Header stat tiles, from `feed.json` | 12 countries, 91% good vitals, 14 pull requests merged | 14, 85%, 16 | everyone |
| Closing date (`data-feed-date`) | 20 October 2026 | 23 October 2026 | everyone |
| "The loop", bullet 4 | 5 sentences | about 6 sentences (AC-5) | everyone |
| `TeamFlowDiagram` `<desc>` | "...tries the assistant when a change touches it..." | "...tests the assistant on a change to the assistant, the résumé or a write-up..." | screen readers only |
| Header comment date | | | nobody (not rendered) |

The new numbers have the same digit count as the old ones (two digits each), so the stat
tiles keep their widths and do not wrap differently. The comment date and the `<desc>` draw
nothing. The only visible layout difference is bullet 4: roughly one more line at 1440px
and three or four more at 390px.

Layout of the changed area, unchanged apart from the bullet's length:

```
1440px (content column ~680px)            390px
06  The loop: interview, review, ...      06 The loop: ...
(1) Interview me ...         4 lines      (1) Interview me ...   ~14 lines
(2) Review the site ...      3 lines      (2) ...
(3) Propose résumé ...       2 lines      (3) ...
(4) Change the site ...      4 -> 5 lines (4) Change the site ... ~12 -> ~15 lines
(5) Put every change ...     7 lines      (5) Put every change ... ~22 lines
[ TeamFlowDiagram: wide, 760x548 ]        [ TeamFlowDiagram: tall, max 360px ]
```

Bullet 4 stays shorter than bullet 5, so the list's rhythm (`.wx-steps`: 32px number disc,
1px connector line, 14px gap) is unchanged. Light and dark use the same `--ink` body text and
`--green` discs as today. No new token, class or component.

### Does the diagram have to change?

No. CLAUDE.md's rule is that a diagram changes with the flow it shows. The flow's steps did
not change: spec, build, six reviews, at most three rounds, then the pull request with its
own required checks (gates, team, check), then Steven merges. Who *opens* the pull request is
a step of the Site update workflow, not of this diagram, and the Pull request box already
says "its own checks: gates, team review, site checks, assistant tested in CI", which is the
outcome the check-in was about. The App stays out of the drawing (AC-7's test), which keeps
the box text short enough for the 300px tall drawing. Making the `<desc>` match what triggers
the assistant check is the right fix: it is the diagram's text equivalent and has to say what
the box says, in full.

Both drawings (`wx-flow-wide`, `wx-flow-tall`) share `flowDescription`, and the one not shown
is `display: none`, so a screen reader hears the description once at any width. Leave it
that way.

### Wording notes for the developer (bullet 4)

1. The proposed sentence "...opens the pull request as the site’s own GitHub App, so its
   required checks start on it as on anyone’s" has three pronouns in a row (its, it,
   anyone’s), and on a phone they land on different lines. Say "the pull request" once more:
   "...so the pull request’s required checks start on it as on anyone’s". Same length to the
   eye, no rereading.
2. "When a change is held, my MCP tells me what holds it." The list is introduced as what
   the MCP does ("it does five things"), and "held" alone reads like a status word. Prefer
   "When a change is held up, the MCP tells me what holds it." It keeps the phrase the test
   checks ("what holds it") and matches "the MCP server" used in the section's intro.

Use the typographic apostrophe (’) as the rest of the article does; a straight `'` in
"site's" or "anyone's" would be the only one on the page. Keep "GitHub App" as written: it is
GitHub's own name for the thing and does not need an `<abbr>`.

### States

- **No JavaScript:** the page is prerendered. Bullet 4, the stat tiles (feed values at build
  time) and the closing date are all in the static HTML; the `<desc>` is in the SVG markup.
  Nothing here depends on hydration.
- **Live numbers:** once the page loads, `/api/building/site` may replace the feed values;
  that path is unchanged. A three-digit value would still fit the tile (it does on
  `/building-wilssens`).
- **Loading, empty, error:** no new fetch, so no new state.
- **Very long content:** the bullet is fixed text; the only risk is length, covered above.

### Accessibility

- Keyboard and focus order: unchanged. Bullet 4 adds no link; the section's links and the
  "Ask the assistant" button keep their order.
- Screen readers: the diagram is `role="img"` with `aria-label` (the title) and
  `aria-describedby` (the `<desc>`). The new clause reads cleanly aloud and keeps no first
  person, like the rest of the description.
- Contrast: body text and discs are unchanged in both themes. Reduced motion: no motion
  is added.

### What I will check in review

1. `git diff --name-only origin/main...HEAD` shows only `src/articles/site/` (and the spec
   and tests); anything else under `src/`, `public/` or the HTML entry points widens the
   check.
2. Screenshots of `building-this-site`, branch against main's build, at 1440px and 390px
   (`--slices`), light and dark: the header tiles (same widths, no wrap), "The loop" with
   bullet 4 (rhythm, connector line, no orphaned last word on the phone), the flow diagram
   (identical pixels, wide and tall), and the closing date. A 320px shot of "The loop" for
   reflow, since that bullet grows.
3. The DOM of the built page: one `<desc>` per drawing with the new clause, the hidden
   drawing still `display: none`, the curly apostrophes in bullet 4.
4. `npm run check:site -- --lighthouse none` for `/building-this-site`: no console error, no
   new axe finding, no horizontal scroll.
5. Tab through "The loop" and the diagram figure on the served build to confirm the focus
   order did not move.

Before/after pairs for Steven: the "The loop" slice at 390px light, the same at 1440px dark,
and the header stat tiles at 1440px light.

## Technical approach (senior-developer)

**Feasible as written.** Text-only change in two files plus one test file; no new
component, helper, dependency or branch logic, so coverage of the changed files does not
move.

**Accuracy against the sources (checked line by line).**
- AC-4: `sources/site/CLAUDE.md` (The team) "When a change touches the assistant, the
  résumé or a write-up, the Review workflow runs the assistant check itself", and
  `.claude/team.md` step 8 "on a change to the assistant, the résumé or a write-up". The
  new clause matches both. The "team review" is the Review workflow's `team` check, so
  attributing the test to it is correct.
- AC-5 (a) matches "pushed and opened by the site's GitHub App … from the workflow's
  `publish` job, which runs no branch code" (CLAUDE.md) and "from a runner that runs
  nothing from the branch" (team.md step 8); (b) matches "the required checks start on
  the pull request itself, like on anyone's"; (c) matches The MCP server: "name what
  holds it from its own checks and the team's verdicts". None of the proposed sentences
  claims the agent merges; "Merging stays his" is untouched in the article.
- The proposed bullet keeps "Claude Code edits … runs the lint, tests and build", which
  is still true (the `update` job). The existing paragraph "the review would have refused
  the bot that opens the site's pull requests" stays true (the App is a bot account), so
  AC-6's "no other text changes" holds without a correction.
- No AC contradicts the sources. One nuance, not a blocker: the article says nothing
  about which pull requests the App opens; bullet 4 is about the Site update batch, which
  is exactly the scope of the App, so the claim is not over-broad.

**Edits.**
1. `src/articles/site/SiteArticle.tsx` line 15: `20 October 2026` → `23 October 2026`
   (comment only). Line 219 already renders `feedDate(feed.asOf)`; no edit (AC-2).
2. `SiteArticle.tsx` line 193, bullet 4: replace ", opens a pull request, starts the
   preview and emails me what changed, in plain words." with "and runs the lint, tests and
   build. A separate step that runs nothing from the branch opens the pull request as the
   site’s own GitHub App, so the pull request’s required checks start on it as on
   anyone’s; the preview starts and I get an email of what changed, in plain words." and
   append " When a change is held up, the MCP tells me what holds it." after the two
   pinned sentences. Takes both of the designer's and recruiter's wording notes; curly
   apostrophes; no digit; none of the AC-7 grep terms appears in it ("required" and
   "GitHub App" are not on that list).
3. `src/articles/site/Diagrams.tsx` line 66: the AC-4 clause swap only. Diagram geometry
   and box lines are untouched, so the box-width test and the `GitHub App|…` drawing test
   keep passing (`flowDescription` is in `<desc>`, which that test's `textContent` does
   include, so the new clause must not name the App, and it does not).
4. `src/articles/site/feed.json`: already refreshed; commit as is. `feeds.test.ts` and the
   feed-shape test cover it (AC-3).

**Tests (`src/articles/articles.test.tsx`).**
- Line 180: update the regex to the new clause ("which also tests the assistant on a
  change to the assistant, the résumé or a write-up, and the site checks"), both drawings.
- New test next to "the pull request item says a run that changes nothing fails…"
  (line 205): render `<SiteArticle />`, take bullet 4's `li`, assert it contains
  "GitHub App", "runs nothing from the branch", "required checks", "what holds it", does
  not match `/Claude Code[^.]*opens a pull request/`, and contains no digit (the existing
  test at line 217 already pins the two kept sentences and the paragraph after it).
- No other test pins the old text (`grep` for "tries the assistant" and "20 October" finds
  only these two lines and the comment).

**Commands before hand-over:** `npm run lint`, `npm run test:coverage`, `npm run build`,
then `grep -c 'data-feed-date="">23 October 2026' dist/building-this-site/index.html`
and the AC-7 grep. No `resume:build` or og image: neither `src/resume.ts` nor the photo
changes.

## Test plan (senior-tester)

**Baseline (this branch before the edits, `npx vitest run src/articles` with coverage on
`src/articles/site/**`, 53 tests green):** `SiteArticle.tsx` 100/100/100/100 and
`Diagrams.tsx` 100/100/100/100 (statements, branches, functions, lines); `feed.json` 100.
The change is text only, with no new branch or function, so both files must stay at 100%.
The bar is `npm run test:coverage` at 90% or more overall and for every file on its own
(`perFile` in `vitest.config.ts`). No new exclusion is allowed, and no test may be
assertion-free.

**Existing tests that pin the changed text** (`src/articles/articles.test.tsx`):

| Line | Test | What it pins | Action |
|---|---|---|---|
| 180 | "draws the flow across and stacked, each an image with its name and a description of every step" | `flowDescription` regex containing "which also tries the assistant when a change touches it, and the site checks" (both drawings) | **Must change** in the same pull request to "which also tests the assistant on a change to the assistant, the résumé or a write-up, and the site checks". It turns red with the AC-4 edit, which proves it guards the clause. |
| 213–219 | "the pull request item says a run that changes nothing fails and tells Steven, and the paragraph after it is unchanged" | Bullet 4 found by its `<strong>` "Change the site, through a pull request.", its two kept sentences word for word, no digit, and the "The agent never pushes to production." paragraph exactly | Unchanged; must still pass (AC-5 kept sentences, AC-6). |
| 196 | "the Pull request box reads its own checks…" | Box lines; the drawing's `textContent` (which includes `<desc>`) has no `GitHub App\|workflow_dispatch\|check run\|token` | Unchanged; must still pass (AC-7: the App is never named in the diagram or its description). |
| ~248 | "draws the metered layer in both drawings…" | `<desc>` ends with the metered sentence; no first person in `<desc>` | Unchanged; must still pass (AC-4: "word for word the same, no first person"). |
| 70–79 | feed shape; "the same four numbers, no cost figure" | `siteFeed` keys and finite values | Unchanged (AC-3). |
| `src/articles/feeds.test.ts` | every key the article reads is in its feed | | Unchanged (AC-3). |

`grep` for "tries the assistant", "touches it", "20 October" and "emails me what changed"
in `src/`, `functions/` and `scripts/` finds only line 180, `Diagrams.tsx:66`,
`SiteArticle.tsx:15` and `SiteArticle.tsx:193`. No other test, prompt or MCP text pins the
old wording.

**New assertions** (all in `src/articles/articles.test.tsx`, in the
`the team diagram on /building-this-site` describe block; no new fakes needed, since
`render`, `within`, `siteFeed` and `import.meta.glob` raw imports are already in use):

1. **T-1, bullet 4 says who opens the pull request and what holds a change (AC-5).**
   Render `<SiteArticle />`, take the `li` of "Change the site, through a pull request.",
   and assert that it contains "GitHub App", "runs nothing from the branch", "required
   checks" and "what holds it". Split the text into sentences and find the one that matches
   `/opens the pull request|opens a pull request/`. That sentence must contain "GitHub App"
   and must not contain "Claude Code". The spec's `/Claude Code[^.]*opens a pull request/`
   alone is too weak: the planned text says "opens *the* pull request", so that regex
   would pass even if the sentence went back to Claude Code opening it. Also assert:
   - "preview" and "email" are still in the bullet. The tightened wording must not drop
     them; they were there before (AC-6).
   - "in plain words" appears exactly once (recruiter note).
   - There is no straight apostrophe `'` (designer note; the page uses ’).
   - The bullet does not match
     `/token|secret|permission|environment|bundle|publish|read-only|workflow_dispatch/i`
     (AC-7 on the rendered text, as well as the diff grep).
   - The kept sentences and the no-digit rule stay with the existing test at line 217.
2. **T-2, the closing date comes from the feed (AC-2).** Render `<SiteArticle />` and
   assert that `[data-feed-date]` has the text `` `${feedDate(siteFeed.asOf)}.` ``
   (`feedDate` from `./wilssens/article`; it formats in UTC, so the result does not depend
   on the machine). Also assert that the raw source of `SiteArticle.tsx` (glob `?raw`, as
   `feeds.test.ts` does), with `//` comment lines removed, has no
   `/\b\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\b/`.
   That makes a date typed into the JSX fail even when it happens to equal today's feed.
   No test pins this today.
3. **Line 180, updated (AC-4)**, as in the table above. The regex keeps the text before
   and after the clause ("…main’s gates, the team review, which also tests the assistant
   on a change to the assistant, the résumé or a write-up, and the site checks. Steven
   merges…"), so a change to the neighbouring words also fails. Write "résumé" with the
   precomposed é (U+00E9), as in the source.

Mutations I will run at merge review, each of which must turn a test red: put the old
clause back in `flowDescription` (line 180); put "Claude Code … opens the pull request"
back in bullet 4 (T-1); remove "what holds it" (T-1); replace `{feedDate(feed.asOf)}` with
a typed "23 October 2026" (T-2); type a feed number such as "fourteen countries" or "14"
into bullet 4 (line 217).

**Test plan by criterion:**

| AC / control | Test or check |
|---|---|
| AC-1 comment date | Named check: `grep -c '20 October 2026' src/articles/site/SiteArticle.tsx` is 0 and `grep -c '23 October 2026' src/articles/site/SiteArticle.tsx` is 1. It is a comment, so no unit test: tying it to `feed.asOf` would break every automatic feed refresh. |
| AC-2 closing date from feed | T-2 (new); built HTML: `grep -c 'data-feed-date="">23 October 2026' dist/building-this-site/index.html` is 1 |
| AC-3 feed refreshed | articles.test.tsx feed-shape and four-keys tests; `feeds.test.ts`; named check: `node -e` reads `src/articles/site/feed.json`, `asOf` starts with `2026-10-23`, all four values are integers |
| AC-4 flowDescription clause | articles.test.tsx line 180 (updated), both drawings; metered/no-first-person test; built HTML: the new clause appears twice in `dist/building-this-site/index.html` (one `<desc>` per drawing) |
| AC-5 bullet 4 | T-1 (new) plus the existing line 213–219 test (kept sentences, no digit) |
| AC-6 nothing else changes | Existing pins: the "never pushes" paragraph (exact), bullet 5 sentences (lines 163–165, 234–243, 266–271), the Pull request box lines, `LoopDiagram` labels. Named check: `git diff main -- src/articles/site/` shows only the comment date, `feed.json`, the AC-4 clause and bullet 4. |
| AC-7 nothing operational, no typed number | T-1's word list; the line 196 drawing test (`GitHub App` not in the diagram); line 217 (no digit); the AC-7 diff grep returns nothing |
| AC-8 no orchestration or résumé change | Named check: `git diff main --stat -- .claude .github CLAUDE.md src/resume.ts public/steven-wilssens-resume-2026.pdf src/pageMeta.ts scripts/team-manifest.mjs` is empty; `src/resume.test.ts` (PDF matches data) still green |
| AC-9 gates | `npm run lint`; `npm run test:coverage` (90%+ overall and per file; `SiteArticle.tsx` and `Diagrams.tsx` expected to stay at 100%); `npm run build`; `npm run check:recruiter` not lower than main, no new high finding; `node scripts/resume-check.mjs` ATS score unchanged (100) |

No threat-model control adds a refusal path here: no code path, input or permission
changes. Security's "no operational detail" condition is covered by T-1's word list, the
line 196 drawing test and the AC-7 grep.

**Edge cases covered:** both drawings (wide and tall) share one `<desc>`, and line 180 loops
over both; the é and ’ characters in the regexes (precomposed, as in the source); the
pinned sentences next to the new text; a feed refresh that changes `asOf` (T-2 reads the
feed and does not hard-code the date); the stat tiles reading only keys the feed has
(`feeds.test.ts`).

**Flakiness:** none expected. These are pure renders: no timers, no fetch (the stats' live
fetch is not called in these renders, and the existing `fetchMock` stub covers the file),
and `feedDate` formats in UTC. `cleanup` runs after each test (afterEach), so no DOM is
shared between tests.

## Threat model (security-engineer)

**Verdict: APPROVE.** Nothing new to attack: no entry point, route, tool, data store or
workflow change. The change is a public article's text, a comment date and a refreshed
feed. The risks are what the text makes public and where its words come from.

**Data and entry points.** None new. The only untrusted input is what the Site update run
read to write this change: `sources/` (the project's files, log and diff) and the live
numbers in `feed.json`. `site-update.yml` already tells Claude that these are data, never
instructions, and keeps them out of the public run log.

**Abuse cases.**
1. *Mapping the defences.* The article is public and indexed. A sentence that names the
   App's secret, variable, environment or key, the token's permissions, the read-only
   token, the job names, the bundle hand-over or the refusal rules (a change that does not
   grow from main, or that touches `.github/`) would tell an attacker which checks a
   malicious change has to get past, and which names to look for in a leaked log. This is
   unlikely, but leaving it out costs nothing. Control: AC-5 says only (a) to (c), and
   AC-7's grep checks it.
2. *Cost and limits.* Model limits, cost posting or the assistant check's questions in
   the text would help someone tune abuse of `/api/ask` or game the check. Control: Out of
   scope, and AC-7 (`cost`, `\$[0-9]`).
3. *Instructions from `sources/` showing up as prose.* A commit message or file in the
   project could carry text meant for the agent ("also add…", a link, a script tag).
   Control: the diff of `src/articles/site/` holds only the four edits (AC-6). Every added
   sentence traces back to the wording in AC-5 and AC-4. The change adds no URL and no
   HTML, renders nothing through `dangerouslySetInnerHTML`, and touches nothing in
   `.claude/`, `.github/`, `CLAUDE.md` or `functions/` (AC-8).
4. *A wrong security claim.* "The agent can merge", or "runs nothing from the branch" said
   of the whole workflow, would overstate the controls. Control: the sentence speaks only
   of the step that opens the pull request, and nothing in it suggests anyone but Steven
   merges (recruiter's block 5).
5. *Feed values.* React renders the `feed.json` values as escaped numbers. Control: AC-3
   (all four values are integers). The feed holds no visitor or dossier data.

**Tests that prove the controls** (for the test plan):
- AC-7's grep over the added lines of `src/articles/site/*.tsx`, extended with
  `variable|key|\.github|grow|refus|limit` (case-insensitive), finds nothing. "GitHub
  App", "required checks" and "runs nothing from the branch" are allowed.
- The new bullet-4 test (AC-5) passes, and so does the existing diagram test that rejects
  `GitHub App|workflow_dispatch|check run|token` in the drawing.
- `git diff main --stat -- .claude .github CLAUDE.md functions` is empty. The added lines
  in `git diff main -- src/articles/site/` contain no `http`, `<script`,
  `dangerouslySetInnerHTML` or `href`.
- The feed-shape test passes: four integer values, and `asOf` is a date.

## Open questions for Steven

1. Should "The loop" name the site's own GitHub App as the one that opens the pull
   requests (AC-5)? Recommendation: yes. It is the mechanism the check-in is named
   after, and it explains to a peer why the agent cannot merge its own work while its
   checks still count. The sentence names no key, environment or permission.
2. Should the screenshot's alt text "opened by the github-actions bot" change, now that
   new pull requests come from the App? Recommendation: no. The screenshot is the first
   batch as it was opened, and the alt text describes that image accurately. Replace it
   only if a new screenshot is taken.
3. Should the write-up say the assistant is now tested on every change to the résumé or
   a write-up in the prose too, not only in the diagram's description? Recommendation:
   no. The Pull request box already says "assistant tested in CI", and AC-4 makes the
   description precise. A sentence in the prose would add length without a new outcome.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE | | Reconciled, no contradictions left. Bullet 4 wording now follows the recruiter and designer: "the pull request’s required checks", "held up", "the MCP", curly apostrophes, "in plain words" once, about 40 words more at most. AC-5 uses the tester's sentence-level check (T-1) in place of the weak regex; AC-2 adds T-2 (closing date from the feed, no typed date). AC-7 carries security's extended grep, checked clean against the lines that change. Four edits in all; three open questions with recommendations, none blocking |
| Senior recruiter | APPROVE | | No recruiter path touched; ATS 100/100; recruiter check 80/100 live, 0 high (local 50/100 only because dist/ is unbuilt); bullet 4 is a credibility gain if it stays one sentence with no operational detail and no typed feed number; endorse the designer's two wording notes |
| Senior designer | APPROVED | | Text refresh only: bullet 4 grows by about one sentence, the flow diagram’s `<desc>` is corrected, stat values keep their width; no diagram change needed (the flow’s steps are unchanged); two wording notes on bullet 4 |
| Senior developer | APPROVE | | Feasible and accurate to sources/site/CLAUDE.md and .claude/team.md step 8; three text edits (comment date, bullet 4, flowDescription clause) plus feed.json; articles.test.tsx line 180 updated and one new bullet-4 test; no AC contradicts the sources |
| Security engineer | APPROVE | | Nothing new to attack; the text names no secret, variable, environment, key, token permission, job name, hand-over or refusal rule, cost or limit; sources/ stays data and the diff holds only the four edits; the extended AC-7 grep and the diff checks go into the test plan |
| Senior tester | APPROVE | | Every AC has a test or a named check. articles.test.tsx:180 pins the old flowDescription clause and must be updated in the same PR. New: T-1 for bullet 4, with a sentence-level check that the sentence which opens the pull request names the GitHub App and not Claude Code (the spec's `/Claude Code[^.]*opens a pull request/` passes trivially against "opens the pull request"), and T-2 for the closing date coming from `feedDate(siteFeed.asOf)` with no typed date in the JSX. Bar: 90%+ overall and per file; SiteArticle.tsx and Diagrams.tsx are at 100% now and must stay there |
