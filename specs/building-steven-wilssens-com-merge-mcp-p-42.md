# Building this site: the loop says only the version Steven previewed goes live, as of 23 October 2026

Slug: `building-steven-wilssens-com-merge-mcp-p-42` · Branch: `update/building-steven-wilssens-com-merge-mcp-p-42` · Status: built
Asked by Steven on 23 October 2026 (Site update workflow, Building refresh): "Refresh the Building write-up about steven.wilssens.com (/building-this-site, src/articles/site/SiteArticle.tsx) after a check-in on stewils/stevenwilssens.com: 'Merge mcp-plain-english: your MCP talks to you in plain English about site updates'."

Short spec (`.claude/team.md` step 4): a write-up refresh with no new logic, UI component
or orchestration change.

## Problem

Peers and hiring managers read `/building-this-site` to judge how Steven runs an agent
team and where he keeps the decisions. The check-in `b4982f2` merged the
mcp-plain-english branch (`sources/site.log`, commits `de11e3c..b4982f2`). The only
change to the source-of-truth files is one sentence in CLAUDE.md, "## The MCP server":
the site-update tools talk to Steven in plain English (each update has a human name,
every answer a `say` line without pull requests, runs or branches), and
`merge_site_update` takes the version Steven previewed and merges that commit or
nothing, refuses an update still being checked or whose checks failed, and redoes a
real conflict by itself, once.

The team bullet of "The loop" (`src/articles/site/SiteArticle.tsx` line 194) says only
"I read the preview and merge, from the same conversation if I like." That is still
true, but a reader misses the decision behind it: what goes live is exactly what Steven
looked at, never a version that changed after the preview or is still being checked,
and he is spoken to about updates, not about pull requests. That is the
human-in-the-loop guarantee a peer judging the setup looks for. Nothing changed in
`.claude/team.md`, `.claude/agents/` or the workflows, so the flow and its diagrams
(`TeamFlowDiagram`, `LoopDiagram`, the Mermaid chart) stay as they are.

Also stale: the header comment at `SiteArticle.tsx` line 15 says "20 October 2026". The
closing section's date renders from `feed.asOf` via `feedDate`, and `feed.json` is
already refreshed to `2026-10-23` in the working tree.

Evidence: `sources/site.log`, `sources/site.diff`, `SiteArticle.tsx`, `Diagrams.tsx`,
`src/articles/articles.test.tsx`, `src/articles/site/feed.json`.

## Outcome

A reader of "The loop" learns, in the same bullet, that Steven is told about each update
in plain words and that only the version he previewed goes live, never one still being
checked. The article is dated 23 October 2026 and shows the refreshed feed numbers. No
other claim, no typed number, no private detail.

## Acceptance criteria

- AC-1: In `src/articles/site/SiteArticle.tsx`, the team bullet ("Put every change past
  a team.") replaces "I read the preview and merge, from the same conversation if I
  like." with exactly this sentence (35 words by `wc -w`):
  "I read the preview and merge from the same conversation: Claude tells me about each
  update in plain words, not pull requests, and only the version I previewed goes live,
  never one still being checked."
  It starts "I read the preview and merge" (so prose and `TeamFlowDiagram`'s "I merge"
  agree), keeps "from the same conversation" (the guarantee holds for a merge from the
  conversation, not for the GitHub merge button, which pins no version), and never claims
  that an update whose checks failed is refused (Steven's explicit yes can still merge
  one). "if I like" is dropped to keep the 35-word cap. No internal names ("MCP", "sha",
  tool names, "check runs"), no self-praising adjective, no second sentence, no digit,
  and neither "metered" nor "unread updates" (the existing sentence tests in
  `articles.test.tsx` match on those words).
- AC-2: A test in `src/articles/articles.test.tsx` renders `<SiteArticle />`, finds the
  new sentence in the team bullet of the `#loop` section, asserts its exact text (AC-1),
  that it has no digit and that it is at most 35 words (`split(/\s+/).length`). It fails if the sentence is removed or
  reworded.
- AC-3: Every other sentence of the team bullet, every other item and paragraph,
  `Diagrams.tsx` and `.claude/` are unchanged: the existing tests in `articles.test.tsx`
  that pin the loop paragraph, the metered sentence and the unread-updates sentence pass
  unmodified, and `git diff main -- src/articles/site/Diagrams.tsx .claude/` is empty.
- AC-4: The header comment (lines 13 to 15) says "as of 23 October 2026"; "20 October
  2026" no longer appears in `SiteArticle.tsx`. The closing date stays
  `feedDate(feed.asOf)` (no date in the JSX), and in the built
  `dist/building-this-site/index.html` it reads 23 October 2026.
- AC-5: `src/articles/site/feed.json` has `asOf` on 2026-10-23 and only the keys
  `project`, `asOf`, `numbers`, with finite numbers; `src/articles/feeds.test.ts` and the
  feed shape test in `articles.test.tsx` pass. The feed values (including the Core Web
  Vitals share going down) are committed as the refresh wrote them, not edited.
- AC-6: Scope: `git diff --stat main` lists only `src/articles/site/SiteArticle.tsx`,
  `src/articles/site/feed.json`, `src/articles/articles.test.tsx` and this spec.
  `src/resume.ts`, `public/steven-wilssens-resume-2026.pdf`, `src/pageMeta.ts` and every
  other page are untouched.
- AC-7: Nothing private and no feed number is added:
  `git diff main -- src/articles/site/SiteArticle.tsx | grep -E '^\+[^+]' | grep -v '23 October 2026' | grep -niE 'token|secret|\bsha\b|\bmcp\b|commit|jwt|redact|fork|cost|limit|_site_update|updateName|say line|\$|[0-9]'`
  finds nothing (no tool or field names, no name-length or other limits, no numbers; the
  only added line with digits is the header comment's date).
- AC-8: `npm run lint`, `npm run test:coverage` (90% or more overall and per changed
  file) and `npm run build` pass; `npm run check:recruiter` on the built `dist/` is 80/100
  or more with no new high finding; `node scripts/resume-check.mjs` ATS stays 100/100.

## Out of scope

- Naming the MCP tools (`merge_site_update`, `request_site_update`), the `say` field,
  `updateName`, the name-length cap, the sha check or how a conflict is redone on an
  `update/` branch: internals a reader would not miss.
- The automatic, once-only redo of a conflicted update, the handling of failed checks
  (Steven's explicit yes still lets one through) and how the team's review questions
  reach the assistant: operational detail (Open question 1).
- Changes to `TeamFlowDiagram`, `LoopDiagram`, `.claude/team.md` or the admin Team page:
  the flow did not change, so no diagram or `scripts/team-manifest.mjs` change.
- Moving the merge sentence to the "Change the site, through a pull request." bullet, or
  restructuring "The loop".
- Looking into the lower Core Web Vitals share in the feed: a separate change if it keeps
  falling (raised by the recruiter).

## Recruiter impact (senior-recruiter)

**First ten seconds.** Nothing changes. The home page and its first phone screen (who
Steven is, the role he wants, location and work authorization, contact, résumé link),
the résumé PDF, contact, LinkedIn, experience, the "Ask about Steven" assistant and the
job description check are all outside the diff. `src/resume.ts`, `src/pageMeta.ts`, the
PDF and the share image are untouched.

**On a close read** (a hiring manager on `/building-this-site`):

- *Header numbers.* Before hydration the header reads from the refreshed `feed.json`:
  countries 12 → 14, pull requests merged 14 → 16, approved proposals 28 (unchanged), and
  Core Web Vitals "good" **91% → 85%**. The drop is honest, sourced from the site's own
  database, and replaced by `/api/building/site` once the page loads; nobody should
  round it up or remove it to look better. A sceptical reader trusts a number that went
  down more than one that only ever rises. It is not a finding for this change. If it
  keeps falling, the developer should look at it in a separate change (a site about a
  product leader that is slow is a credibility risk), but that is not this spec's job.
- *Closing line.* "as of …" comes from `feed.asOf` (`feedDate`), so it reads 23 October
  2026 by itself. The header comment's date (edit 1) is a source comment and is not
  rendered. No number is typed into the copy.
- *The new sentence* (edit 3). This is the only copy a reader sees change. What it
  says is useful to a hiring manager: Steven built a system where the person deciding
  is spoken to in plain language, and the only version that can go live is the one he
  actually looked at, never one still under test. That is product judgment and
  release discipline, which is exactly what a product leader's write-up should show.
  It is also backed by the code (`merge_site_update` takes the previewed `sha` and
  refuses an update whose checks are still running; failed checks need Steven's explicit
  yes, so the sentence does not claim those are refused; `functions/_lib/mcp/plain.ts`),
  so it is a claim with a source, not an outcome claim.

  The risk is length and jargon. The team bullet is already about 150 words, the
  longest in the list, and a hiring manager skims these bullets. So, my conditions:

  1. **One sentence, at most about 35 words, replacing the current "I read the preview
     and merge, from the same conversation if I like."** Do not add a second sentence.
  2. **No internal names**: not "MCP", not "sha", not "checks are still running", not
     "pull request" as the thing he gets told about. The page already explains "my
     workspace in Claude" earlier; "Claude" is enough here. Say "still being checked"
     rather than "checks running".
  3. **First person, present tense, no adjectives about itself** ("safely", "seamlessly"
     and the like read as self-promotion).

  Wording I would sign off on (35 words by `wc -w`; my first draft, with "if I like",
  was 38, not the 34 I counted, so "if I like" is dropped at reconciliation to meet the
  cap; this is the sentence fixed in AC-1):

  > I read the preview and merge from the same conversation: Claude tells me about each
  > update in plain words, not pull requests, and only the version I previewed goes
  > live, never one still being checked.

  If the PM or designer prefers different words, any version that meets the three
  conditions passes.

- *Placement.* The sentence sits in the team bullet because that is where "I read the
  preview and merge" already is; moving the merge part to the "Change the site, through a
  pull request" bullet would read more naturally but changes two bullets for one fact.
  Keep it where it is; no push for a move.
- *Diagram.* The check-in does not change the flow the diagram shows (spec, build, six
  reviews, Steven decides the merge), so no diagram change is correct. The figure's
  caption ("I answer the questions and decide the merge") still agrees with the new
  sentence.

**Risks to the bar.** No résumé, page-meta or home-page change, so the résumé ATS score
and the recruiter check should be identical; the only exposure is the article copy
becoming longer or more technical, which the three conditions above guard against. No
new number, no unsourced outcome, no change to `noindex`, title, description or og tags
of `/building-this-site`.

**Baselines (23 October 2026, this branch before the edits, no build).**

- Résumé ATS score (`node scripts/resume-check.mjs`): **100/100**, 2 pages, 357 KB,
  0 errors, 0 warnings. One open question for Steven, already known and not caused by
  this change: the (cosmos) Software Developer dates (Jan 2004 to Dec 2005) overlap with
  Info Support (Jan 2001 to Dec 2004).
- Recruiter check: `dist/` does not exist in this worktree and I did not build (a second
  build in a shared worktree races the lead's), so I ran
  `node scripts/recruiter-check.mjs --pages https://steven.wilssens.com`: **80/100**
  (0 high, 4 medium, 0 low, 11 questions only Steven can answer), main's data on the
  live pages also **80/100**, "Not worse for recruiters". The merge review reruns
  `npm run check:recruiter` against the lead's `dist/` and must show 80/100 or better
  with no new high finding.

**What a recruiter would ask that this change should answer.** "Can anything reach the
live site that Steven did not look at?" The new sentence answers it: no. Nothing else
in the change raises a question.

**Verdict: APPROVE**, on the three wording conditions above (one sentence of about 35
words or fewer, no internal names, no self-praise). A longer or jargon-heavy version is
a `major` at merge review.

## Design (ux-designer)

- **What renders differently.** Only the team bullet of "The loop" (section `06`, the
  "Put every change past a team." item of `ul.wx-steps`): its merge sentence is replaced
  by the longer agreed one. Same element and styles (`.wx-steps li`); no new component,
  token or pattern. The header comment date never reaches the page. The `feed.json`
  numbers (countries 12 to 14, good vitals 91% to 85%, pull requests merged 14 to 16,
  proposals 28) go through the existing Stats header and are replaced by
  `/api/building/site` once the page loads; all two-digit values in the same slots, so no
  width or wrap change.
- **Flow and states.** Unchanged. The prerendered HTML carries the new sentence and the
  feed numbers without JavaScript; there is no new loading, empty or error state. Long
  content: the bullet is already the longest of the five; about 25 more words add roughly
  one line at 1440 and two to three at 390 inside the existing measure. Ordinary wrapping
  prose with no unbreakable tokens, so no overflow or horizontal scroll at 390 or 320.
- **Layout, 1440 / 390, light / dark.** As on main, apart from the bullet being one to
  three lines taller; the rest of section 06 shifts down by that much. No sketch needed:
  nothing is added, moved or resized, and both themes use today's text tokens.
- **Copy.** The agreed sentence, as fixed in AC-1: "I read the preview and merge from the
  same conversation: Claude tells me about each update in plain words, not pull requests,
  and only the version I previewed goes live, never one still being checked."
  - *Length conflict (settled):* the first draft, with "if I like", was **38 words** by
    `wc -w`, over the 35-word cap. I preferred dropping "if I like" so the colon reads
    cleanly and the bullet gets shorter; AC-1 settled it that way at **35 words**, and the
    AC-2 test pins that text and cap.
  - *"in plain words" echo:* the previous bullet ends "emails me what changed, in plain
    words." The repeat sits a long bullet later and refers to a different channel, so I
    do not object; "plainly" would avoid it but is weaker. Not a blocker.
- **Read time.** `enhanceArticle` recomputes `data-read-time` from the words in
  `.wx-body` at 230 a minute; about 25 words is about 6 seconds, so the badge keeps its
  value unless the total sits on a rounding boundary (then it moves by a minute, which is
  correct). The prerendered "12 min read" fallback needs no edit.
- **Accessibility.** Nothing focusable added; keyboard path, focus order, labels,
  contrast and reduced motion unchanged.
- **Flow diagram.** No change owed, checked against `src/articles/site/Diagrams.tsx`:
  `TeamFlowDiagram` says "I merge / after the preview" and `LoopDiagram` "I merge the
  pull request / after the preview". "Only the version I previewed goes live" is that
  step; "never one still being checked" is a precondition already shown by the required
  Review check before it. `flowDescription` (the diagram's accessible text) says "Steven
  merges, and the site deploys", still true, and the caption "I answer the questions and
  decide the merge" agrees.
- **Pages to screenshot:** `building-this-site` (1440 and 390 with `--slices`), branch
  against main. Pairs for Steven: the header Stats slice (refreshed numbers) and the
  section 06 slice with the team bullet, on the phone.

**Spec verdict (ux-designer): APPROVE**, on condition that the sentence and the AC-1/AC-2
word cap agree (met: AC-1 drops "if I like", 35 words, cap 35). A text and feed refresh inside
existing components; nothing new to design, no diagram change owed.

## Threat model (security-engineer)

- **New entry points and data: none.** Static prose in a prerendered page, a source
  comment and four aggregate numbers in `feed.json`. No Pages Function, MCP tool,
  workflow, D1 query, header, dependency or model prompt changes; `/api/building/site`
  already serves the same aggregates.
- **Disclosure.** The sentence states a behaviour (Steven is told in plain words; only the
  previewed version goes live, never one still being checked), not a mechanism. It must
  not name the tools (`merge_site_update`, `request_site_update`), fields (`say`,
  `updateName`, `sha`), limits (name length, once-only redo), the `update/` branch, the
  hidden pull-request marker, `/mcp/<key>`, `ADMIN_TOKEN` or any secret. Both candidate
  wordings (with or without "if I like") name none.
- **Accuracy of the guarantee.** Overclaiming a control is itself a finding. "Never one
  still being checked" holds for the conversation path the sentence names ("from the same
  conversation"); it must not widen to "never one whose checks failed" (Steven's explicit
  yes can merge one) or to every merge path (the GitHub button pins no version, as the
  developer notes). Keep "from the same conversation" in whichever variant is chosen.
- **Feed.** Counts and a percentage over all visitors; no visitor, country list,
  transcript or dossier content. Committed as the refresh wrote it (AC-5).
- **Abuse case.** Check-in text from `sources/` (untrusted) copied into the article with
  markup or instructions: React escapes text children and no `dangerouslySetInnerHTML` is
  added, so no XSS path; the diff is reviewed before merge.
- **Controls and tests.** (1) AC-7's grep over added lines of `SiteArticle.tsx` proves no
  tool, field, limit, secret or number is added; (2) the AC-1/AC-2 exact-text test (with
  its internal-name assertion) pins the sentence so a later refresh cannot slip internals
  in unnoticed; (3) AC-6's scope check proves no function, workflow or `.claude/` file
  changes; (4) the AC-5 feed shape test keeps the feed to aggregate numbers. All four are
  already in the test plan; no new row needed.

**Spec verdict (security-engineer): APPROVE.** Nothing new is reachable; the wording
discloses no mechanism, name, limit or secret.

## Technical approach (senior-developer)

- **Files.** `src/articles/site/SiteArticle.tsx`: line 15 "20 October 2026" → "23 October
  2026" (a comment, not rendered); line 194, the one sentence swapped inside the existing
  `<li>` string, nothing else on the line. `src/articles/articles.test.tsx`: one new `it`
  beside the metered and unread-updates tests. `src/articles/site/feed.json`: committed as
  the refresh wrote it (`asOf` 2026-10-23, four finite numbers). No migration, no function,
  no new component, no dependency.
- **Facts checked.** `merge_site_update` (`functions/_lib/mcp/tools.ts:1068`) takes the
  `sha` of the version Steven looked at and GitHub merges that commit or nothing; it is
  refused while checks are still running (`standing` 'checking' before 'checks',
  tools.ts:190-196); the `say` lines in `plain.ts` speak of updates, not pull requests.
  Matches `sources/site/CLAUDE.md` "## The MCP server". "Only the version I previewed goes
  live, never one still being checked" is true for a merge from the conversation; the
  sentence keeps "from the same conversation", which bounds it (the GitHub button pins no
  sha, and nothing refuses running checks there until branch protection is on). Failed
  checks can still go live on Steven's explicit yes (`acceptFailingChecks`), so the
  sentence must not claim "never one that failed"; the agreed wording does not.
- **Existing tests.** Nothing keys on the old sentence (grep of `src/`, `scripts/`). The
  sibling tests cut sentences with `/[^.]*metered[^.]*\./` and `/[^.]*unread updates[^.]*\./`
  on the bullet's `textContent`; the new sentence has no full stop inside and neither
  keyword, so both still match exactly what they match today. The new test uses the same
  pattern (`/I read the preview and merge[^.]*\./`), `toBe` on the exact text,
  `not.toMatch(/\d/)` and `split(/\s+/).length <= 35`.
- **Diagrams.** `Diagrams.tsx` needs no change: `flowSteps` "I merge / after the preview",
  `LoopDiagram` "I merge the pull request / after the preview", `flowDescription`
  "Steven merges, and the site deploys" and the footer all stay true; no test ties them to
  the bullet's merge sentence.
- **Date.** The closing line renders `feedDate(feed.asOf)` (`wilssens/article.ts:8`, UTC,
  en-GB) at prerender and `enhanceArticle` rewrites it from `/api/building/site` after
  load; with `asOf` "2026-10-23T00:40:17.748Z" it prerenders "23 October 2026". No JSX date.
- **Word cap (settled in AC-1 at 35 words).** The first draft was 38 words (`wc -w`),
  over the cap. My view, which AC-1 adopted: drop "if I like" (35 words: "I read the preview and merge from the same
  conversation: Claude tells me about each update in plain words, not pull requests, and
  only the version I previewed goes live, never one still being checked."). It keeps the
  cap the recruiter set, keeps "from the same conversation" (the scope the claim needs) and
  reads better before the colon. Raising the cap works too; either way the PM fixes the
  sentence in AC-1 so the test pins one text.

## Test plan (senior-tester)

The word-count conflict is settled: AC-1 dropped "if I like", so the sentence is 35
words and the cap is 35. The new test asserts the exact AC-1 sentence and that cap; both
come from the final AC-1 text, so the test and the AC cannot disagree. Words are counted
as `sentence.split(/\s+/).length`, which gives the same count as `wc -w` (the
recruiter's "34" was a miscount of the 38-word first draft). The merge review fails the
change if the test's cap is higher than AC-1's.

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | New test in `src/articles/articles.test.tsx`, describe "the team diagram on /building-this-site": `it('says Steven is told about each update in plain words and only the version he previewed goes live, in one sentence without a number or an internal name', …)`. Renders `<SiteArticle />`, takes the team item (`within(#loop section).getByText('Put every change past a team.').closest('li')`), extracts `/I read the preview and merge[^.]*\./` and asserts: exact text (the AC-1 sentence as reconciled); `not.toMatch(/\d/)`; `not.toMatch(/\bMCP\b\|\bsha\b\|_site_update\|check runs\|safely\|seamlessly\|metered\|unread updates/i)`; word count within AC-1's cap; the old sentence "I read the preview and merge, from the same conversation if I like." no longer in the item. "One sentence, no second sentence": the item text contains `` `runs the team review on the pull request. ${sentence} Changes to the agent team itself` `` exactly, so nothing can be added between its neighbours. | component |
| AC-2 | The same test. Mutations it must catch: sentence removed (the `match` returns null, `![0]` throws), a word changed (exact match), a digit added, a clause dropped ("never one still being checked" missing breaks exact match). | component |
| AC-3 | Existing, unmodified: "says the loop is metered per change, with a budget, …" (line 208), "says that changes to the team reach Steven in his admin as unread updates, …" (line 241), "the pull request item says a run that changes nothing fails …" (line 187, pins the paragraph after the list) and "sits in the loop section, with the step it explains" (line 197). Plus the new test asserts the team item's `textContent` contains, in order, the four sentences before the merge sentence ("Every change, mine included, …" through "On GitHub a required Review check runs the team review on the pull request.") by `toContain` on the exact strings, so no other sentence of the bullet changes unseen. Named check: `git diff main -- src/articles/site/Diagrams.tsx .claude/` is empty, and `git diff main -- src/articles/articles.test.tsx` shows only added lines (no removed or edited existing assertion). | component + named check |
| AC-4 | Named check: `grep -c '20 October 2026' src/articles/site/SiteArticle.tsx` is 0 and `grep -c 'as of 23 October 2026' src/articles/site/SiteArticle.tsx` is 1 (the comment is not rendered, so no component test can see it). Rendered date: the new test also asserts `container.querySelector('[data-feed-date]')` has text `` `${feedDate(siteFeed.asOf)}.` `` (computed from the feed, not typed; `feedDate` is UTC, so deterministic in any time zone; `feedDate` itself is pinned in `src/articles/wilssens/article.test.ts` "feedDate"). Built page: `grep -c '23 October 2026' dist/building-this-site/index.html` is at least 1 after `npm run build`. | component + named check |
| AC-5 | Existing: "keeps every feed in the shape the pages read: a date and finite numbers" (line 70) and "keeps development costs out of this site's feed: the same four numbers, no cost figure" (line 77) in `articles.test.tsx`; `src/articles/feeds.test.ts` "site/SiteArticle.tsx yields at least one key, and every one is in its feed.json". Named check: `node -e "const f=require('./src/articles/site/feed.json'); if (Object.keys(f).join()!=='project,asOf,numbers' \|\| !f.asOf.startsWith('2026-10-23')) process.exit(1)"`, and `git diff src/articles/site/feed.json` shows exactly the refresh's values (14, 85, 28, 16). No test pins the feed values themselves, on purpose: they change with every refresh and are not the article's claim. | unit + named check |
| AC-6 | Named check: `git diff --stat main` lists only the four files. `npm test` (`src/resume.test.ts`) still matches the PDF to `src/resume.ts`. | named check |
| AC-7 | Named check: the grep in AC-7, run on the final diff, prints nothing. The new test's `\d` and internal-name assertions hold the same for the rendered sentence. | named check + component |
| AC-8 | `npm run lint`; `npm run test:coverage` (overall and per file 90% or more; `SiteArticle.tsx` changes text only, no new branch, so its numbers stay as on main; read in `coverage-summary.json`); `npm run build`; `npm run check:recruiter` 80/100 or more, no new high; `node scripts/resume-check.mjs` 100/100; `npm run check:site` passes on `dist/`. | gate |

Edge cases:

- The new sentence must end in a full stop and contain no other full stop: the existing
  metered and unread-updates tests extract `[^.]*word[^.]*\.`, and the new test extracts
  the same way. A missing final full stop would glue it to the next sentence and fail the
  unread-updates test; that is the intended guard, not a flaky failure.
- The colon in the sentence stays a colon (a full stop there would make two sentences and
  break the exact match).
- Curly versus straight apostrophes: the sentence has none; if the final wording adds one,
  the test string uses the same character as the JSX (`’`).
- Read time: `enhanceArticle` recomputes it at runtime; no test pins the site article's
  read time, and none should be added for a text refresh.
- Determinism: no timers, no network, no `Date.now`; the date comes from `feed.json`
  through a UTC formatter. No shared state; each test renders its own `<SiteArticle />`
  and Testing Library cleans up between tests.

No security control applies (static copy, no input, no endpoint); if the threat model adds
one, it gets a row here.

Coverage stays at or above 90% (statements, branches, functions, lines) and every new
or changed file is at 90% or more on its own.

## Open questions for Steven

1. Should the write-up also say that a clash with another change is redone by itself,
   once? Recommendation: no; it is operational, and the reader's point (only what he
   previewed goes live) is already made.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE | | Reconciled: all six sections present; AC-1 fixes the 35-word sentence ("if I like" dropped, "from the same conversation" kept, no claim that failed checks are refused), AC-2 caps at 35, recruiter's count corrected from 34 to 38 then 35; one open question, recommended "no", nothing waits for Steven; no diagram change, the flow did not change |
| Senior recruiter | APPROVE (wording conditions, met) | | Baselines ATS 100/100, recruiter 80/100; one sentence of 35 words, no internal names, no self-praise. After the build: ATS 100/100, recruiter 80/100 (0 high), not worse than main |
| Senior designer | APPROVE | | Text and feed refresh, no diagram change; the 38-word draft's conflict with the cap is settled by AC-1 at 35 words ("if I like" dropped) |
| Senior developer | APPROVE (feasibility) | | Feasible as a text, test and feed change; facts match tools.ts and CLAUDE.md; "if I like" dropped for the 35-word cap, as AC-1 fixed |
| Security engineer | APPROVE | | Static copy and aggregate feed only, nothing new reachable; the sentence names no tool, field, limit or secret (AC-7 grep, exact-text test); keep "from the same conversation" and do not claim failed checks are refused |
| Senior tester | APPROVE | | Every AC mapped: one new component test in `articles.test.tsx` (exact sentence, neighbours, no digit or internal name, word cap = AC-1's final cap, rendered date from `feedDate(feed.asOf)`); existing loop, feed-shape and `feeds.test.ts` tests unmodified; greps for the header date, scope and AC-7. The 38-word draft was settled by AC-1 at 35 words; the test pins that text and cap |
