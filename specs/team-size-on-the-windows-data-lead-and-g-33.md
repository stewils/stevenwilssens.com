# Team size on the Windows Data Lead and Group PM roles

Slug: `team-size-on-the-windows-data-lead-and-g-33` · Branch: `update/team-size-on-the-windows-data-lead-and-g-33` · Status: built (`npm run resume:build`: ATS 100 → 100, "Layout: 1 bullet on the older Microsoft roles, compact type, to fit two pages.", no `--force`)
Asked by Steven on 2026-10-20 (Site update, approved instruction): "1) Role "csx-data" (Principal Product Manager Lead - Windows Data, Feb 2020 - Dec 2024): add a new SECOND bullet directly after the existing first bullet "Redefined Windows quality measurement around end-to-end scenarios like gaming and the shell, creating the Perfect Day metric for issue-free user days.": "Grew the team from one to five direct reports, leading to promotion to Principal Group Product Manager." The Perfect Day bullet must stay first, so the PDF (which prints only the first bullet of older roles) keeps explaining Perfect Day. 2) Role "windows-devices-data": replace the bullet "Led a PM organization of 10 to 20, initially through three people managers, and designed its move to a flatter structure; roughly half the team was promoted under my leadership." with "Led a PM organization of about 20, initially through three people managers, then led its move to a flatter team of about 12 during Microsoft's cost reductions; roughly half the team was promoted under my leadership." Leave summary, profile teamSize and skills unchanged. Change nothing else. Replaces PR #60 (same change, Perfect Day bullet kept first). ATS score must stay 100/100; never --force."

## Problem

Readers: a recruiter or hiring manager reading `/experience` or the résumé PDF (often
forwarded, often on a phone), and a peer checking the career story.

Today the two Windows Data roles do not show how Steven's team grew. The Lead role
(`csx-data`, Feb 2020 - Dec 2024) says nothing about people leadership, so a reader
cannot see the path from Lead to Principal Group Product Manager, the step a hiring
manager for a group PM or director role looks for first. The recruiter review flags it
(`scope:csx-data`: the role gives no team size; baseline 80/100, see Recruiter impact).
The Group PM role (`windows-devices-data`) gives a range ("10 to 20") and "designed its
move to a flatter structure". That is vague on size, and it hides that the reshaping
happened during Microsoft's cost reductions, which a recruiter will ask about anyway.

How we know: Steven's approved instruction (above), recorded through the MCP, and the
recruiter review. PR #60 made the same change but put the new bullet first in
`csx-data`. `csx-data` is the third entry in `experiences`, so it is a condensed role in
the PDF, which prints only `points.slice(0, olderBullets)`, today 1. Putting the new bullet first would
drop the Perfect Day definition from the PDF, while the home page impact numbers (`+5%`
and `~30%`, both backed by `csx-data`) still name Perfect Day.

## Outcome

On `/experience`, a recruiter sees that Steven grew his team from one to five direct
reports and was promoted to Principal Group Product Manager. They also see that he then led an
organization of about 20 and reshaped it to about 12 during cost reductions. The PDF
shows the sharper Group PM bullet and still defines Perfect Day. Nothing else about
Steven changes, the PDF keeps its current layout, and the ATS score stays 100/100.

## Acceptance criteria

- AC-1: In `src/resume.ts`, the `csx-data` entry's `points` has exactly five items. Item
  0 is unchanged ("Redefined Windows quality measurement around end-to-end scenarios like
  gaming and the shell, creating the Perfect Day metric for issue-free user days."). Item
  1 is exactly "Grew the team from one to five direct reports, leading to promotion to
  Principal Group Product Manager.". Items 2 to 4 are the previous items 1 to 3,
  unchanged and in the same order.
- AC-2: In `src/resume.ts`, the `windows-devices-data` entry's `points` keeps its length
  (8) and order. Item 0 is exactly "Led a PM organization of about 20, initially through
  three people managers, then led its move to a flatter team of about 12 during
  Microsoft’s cost reductions; roughly half the team was promoted under my leadership.",
  with a curly apostrophe (U+2019) in "Microsoft’s", like the existing Windows K2 bullet.
  Items 1 to 7 are unchanged.
- AC-3: `git diff main -- src/resume.ts` touches only those two `points` arrays.
  `profile.summary`, `profile.teamSize` ("10 to 20 product managers"), `skills`
  (including "Leading PM organizations of 10 to 20, including managers of managers"),
  `impact` (no value, label or `backing` changes), `selectedWork` and every other entry
  are byte-identical to main, so the diff shows exactly two changed lines. No file
  changes other than `src/resume.ts`, `public/steven-wilssens-resume-2026.pdf`, the
  tests in the test plan (`src/resume.test.ts`, `src/App.test.tsx`) and this spec. The
  résumé report goes to `dist/` and is not tracked.
- AC-4: `npm run resume:build` regenerated the PDF without `--force`, and no commit
  message gives a force reason. The build prints "Layout: 1 bullet on the older Microsoft
  roles, compact type", not "0 bullets". The PDF is 2 pages. The new test "keeps the first
  bullet of every older Microsoft role" passes.
  If the build falls back to 0 bullets instead, the developer does **not** reword
  Steven's approved text and does not use `--force`. The branch keeps his wording exactly
  as he wrote it. The fallback goes into the pull request and into Open question 4, with
  the measurement and the shorter wording as the team's recommendation. Merging then waits
  for Steven's answer: the new test fails, and the recruiter's merge sign-off is held.
- AC-5: `node scripts/resume-check.mjs` on the branch reports ATS 100/100, and `node
  scripts/resume-check.mjs --baseline https://steven.wilssens.com/resume-report.json`
  says it equals the live site and exits 0. The `gates` job passes without the
  `accept-lower-score` label.
- AC-6: In the text extracted from the new PDF, the first bullet under "Principal
  Product Manager Lead - Windows Data" is still the Perfect Day bullet. Under "Principal
  Group Product Manager - Windows & Devices Data" the new "Led a PM organization of about
  20 … about 12 during Microsoft’s cost reductions" bullet appears in full (after
  normalizing whitespace and quotes). The "one to five direct reports" bullet is expected
  not to appear at the 1-bullet layout, but no test asserts that it is missing. A roomier
  layout that printed it would be fine.
- AC-7: On `/experience` (the `App` render and the prerendered
  `dist/experience/index.html` after `npm run build`), both new bullets appear under
  their roles, with the Perfect Day bullet first and the team-growth bullet second under
  Principal Product Manager Lead - Windows Data. The page no longer contains "Led a PM
  organization of 10 to 20" or "designed its move to a flatter structure".
- AC-8: `npm run check:recruiter` on the built `dist/` scores 80 or higher (the main
  baseline) with no high finding. The five new tests in the test plan exist and pass. So
  do `npm test` (including the existing `src/resume.test.ts` check that fails when the PDF
  does not match `src/resume.ts`), `npm run lint`, `npm run test:coverage` (90% or more
  overall and per changed file) and `npm run build`.

## Out of scope

- `profile.teamSize`, `profile.summary` and the "Leading PM organizations of 10 to 20"
  skill. Steven asked to leave them unchanged, and "about 20" and "about 12" sit inside
  that range. The home page copy that reads `teamSize`, and `src/App.test.tsx` that
  asserts it, stay as they are.
- Changing the recruiter checker so that "direct reports" or worded numbers clear
  `scope:csx-data`. If needed, that belongs in a separate pull request (Open question 2).
- The existing `TODO(steven)` on the `~30%` impact number. It is a separate question.
- `public/og-image.png` (headline and photo unchanged). No code changes to the
  assistant, WebMCP or the MCP server, which all read `src/resume.ts`.
- Closing PR #60. That is the lead's or Steven's call (Open question 1).
- Agent orchestration, so `/building-this-site` is not touched.
- Follow-up (developer): `recruiterAngles['csx-data']` in `functions/_lib/mcp/tools.ts`
  asks "why no promotion earlier?", and the new bullet partly answers it. It stays as it
  is because Steven asked to change nothing else. If he wants the MCP's angle updated,
  that is a separate pull request.
- Follow-up (tester): `scripts/resume-check.mjs` does not check the older roles' first
  bullets, so a fallback to `{ olderBullets: 0 }` passes the checker and `gates`. The
  AC-4 test covers it in this change. Moving that check into the checker, with a
  `scripts/resume-check.test.mjs` case so that it shows on `/admin` → Résumé, is a checker
  change for a separate pull request.

## Recruiter impact (senior-recruiter)

**Baseline (2026-10-20, this branch = main, before the change).**
- Recruiter review: **80/100**: 0 high, 4 medium, 0 low, 11 questions. No `dist/` existed yet, so I scored
  the live pages: `node scripts/recruiter-check.mjs --pages https://steven.wilssens.com` gives
  80/100, the same as main's data on the live pages (80/100). (`npm run check:recruiter` without
  a build gives 50/100. That only says that the pages are missing from `dist/`, so it is not a baseline.)
  The four medium findings are `scope:csx-data`, `scope:azure-devops`, `scope:spatial-audio-lead`
  (each says the role gives no team size) and `linkedin` (not imported).
- Résumé: `node scripts/resume-check.mjs` gives **ATS 100/100**, 2 pages, 0 errors, 0 warnings.
  `--baseline https://steven.wilssens.com/resume-report.json` gives "100 → 100: the same as the live site".
- PDF layout today (`node scripts/tmp-measure.mjs`): the roomy layouts run to 3 pages, so the
  PDF is already on the third fallback, `{ olderBullets: 1, compact: true }`. That layout fills
  about 1918 of about 1945 px, which leaves about 27 px (one or two lines of compact type) of headroom. The only
  fallback left is `{ olderBullets: 0, compact: true }`.

**First ten seconds.** Nothing changes. The home hero, the facts line ("Led teams of 10 to 20 product
managers", from the unchanged `profile.teamSize`), the impact numbers, the résumé link and the contact
links are all as they are. The PDF's header, facts strip, summary and key achievements are also unchanged.

**Close read on `/experience`.** This is where the change earns its place:
- *windows-devices-data*: "10 to 20" becomes a story a hiring manager can check: about 20 PMs
  through three people managers, then a flatter team of about 12 through a cost-reduction period,
  and about half the team promoted. "Led its move" is stronger and more accurate than "designed its
  move". The numbers fit inside the "10 to 20" that the facts line, the summary and the skills give,
  so the site still agrees with itself. The bullet still meets the scope check
  (`PM organization of about 20` and `team of about 12` both match `scopeWords`).
- *csx-data*: "one to five direct reports" and a promotion to Principal Group PM are the level
  signals recruiters screen for: people management, growing a team, and promotion on merit. It also agrees with the
  timeline, because the next role, from Dec 2024, carries that title. "Direct reports" and "promotion" are words
  recruiters search for. Both bullets are Steven's own approved wording, which is the source
  CLAUDE.md asks for. No home-page number (`impact`) changes, so no `backing` changes.
- Tone: both bullets are in the past tense and sized to the role. Neither reads as self-promotional:
  the promotion is stated as a result of the team growing, not as a boast.

**In the PDF.** The designer's note needs a correction: only windows-devices-data is a "detailed" role
(`experiences.slice(0, 2)` is independent-ai-builder and windows-devices-data). csx-data is a
*condensed* role and prints `points.slice(0, olderBullets)`, which today is **only its first bullet** (Perfect Day).
- The new csx-data bullet will **not** appear in the PDF. It goes on the site, into the assistant's
  prompt (`functions/_lib/ask/prompt.ts` lists every point), into the MCP tools and into the LinkedIn texts.
  That is acceptable: Perfect Day stays first, as Steven asked, so the PDF loses nothing. But on the PDF the team size for 2020-2024
  rests on the facts line alone. The "+5%" key achievement's backing bullet ("Drove measurable quality gains…") was already
  out of the PDF before this change. This change does not make that worse.
- The changed windows-devices-data bullet prints in full (the checker fails the PDF if a bullet of the two
  latest roles is missing). It grows from about 168 to about 215 characters, which is likely 3 lines instead of 2 on page one.
  **This is the risk:** one more line uses most of the about 27 px of headroom. If the build falls to
  `{ olderBullets: 0 }`, **every older Microsoft role loses its only bullet** (Perfect Day, spatial audio,
  Azure DevOps…). The ATS score would not move, because older bullets are not scored, but the résumé
  would read thinner to a hiring manager. That is worse for recruiters, so it is a blocker.

**ATS and recruiter-score risk.**
- ATS score: no expected change. The role titles, companies and dates are untouched. The required keywords
  (experimentation, machine learning, telemetry, roadmap, strategy, product manager, data platform, A/B, AI)
  are in other lines. The scope regex (`\d+ to \d+ product managers`) is still met by the facts line.
- Recruiter score: expected to stay **80**. `scope:csx-data` does **not** clear. "from one to five direct
  reports" uses words, not digits, and "direct reports" is not in `scopeWords`. A human reads the
  scope at once, but the checker and the MCP's `review_for_recruiters` will keep asking Steven for the
  csx-data team size. That is an open question, not a reason to block (see below). Do not change the checker in this change.

**What a recruiter would ask, and whether the change answers it.**
- "How big was the team, and were these managers of managers?" Yes: about 20, through three people managers,
  then about 12, flat.
- "Was he part of the cost reductions? Why did he leave in Sep 2026?" "During Microsoft's cost reductions" invites
  this question. The bullet frames him as the leader who reshaped the org, which is the right framing. The
  assistant should give a consistent answer if asked why he left. No change needed here, but the
  reviewer should put the question to the preview's assistant.
- "When was he promoted to Group PM?" Answered by the bullet together with the Dec 2024 start of the next role.

**Conditions for my merge sign-off (please add them to the acceptance criteria).**
1. `npm run resume:build` still chooses `{ olderBullets: 1, compact: true }`: it prints "Layout: 1 bullet on the
   older Microsoft roles, compact type", not "0 bullets". The PDF stays at 2 pages, and the first bullet of every older
   Microsoft role is still in it. If the build falls back to 0 bullets, stop and ask Steven before merging (for example, a shorter
   wording such as dropping "under my leadership", or `--force` with his reason).
2. The ATS score is 100, equal to the live site (`--baseline https://steven.wilssens.com/resume-report.json`, exit 0).
   `check:recruiter` on the built `dist/` is 80 or higher, with no new high finding.
3. Perfect Day stays the first csx-data bullet. The two new texts match Steven's wording exactly (with the
   curly apostrophe the designer asks for).
4. `profile.teamSize`, the summary and the skills are unchanged, and no number in `impact` changes.

**Pushback, mild.** Putting the team-growth bullet second splits "Perfect Day defined" from "Perfect Day
improved 5%". A reader would follow the story better with the outcome bullet second and team growth third.
Steven asked for second, and the PDF prints neither, so I would not hold the change on it. I list it as a question.

**Open questions for Steven (for the PM to collect).**
- Were the five direct reports all product managers? If they were, "Grew the team from 1 to 5 product managers, leading to promotion
  to Principal Group Product Manager" says the same thing and clears `scope:csx-data`. Digits also scan
  better for applicant tracking systems and recruiters. Keeping "one to five direct reports" is fine: the score stays at 80.
- Should the csx-data team-growth bullet go after "Drove measurable quality gains…" (third) instead of second?

**Verdict: APPROVE**, on the conditions above.

## Design (ux-designer)

**What renders differently.** Only text changes. No component, CSS, token or route changes.
Role bullets (`experiences[].points`) appear in one place on the site: the timeline on
`/experience` (`renderExperience` in `src/App.tsx`: `.timeline-body ul > li`, 14px, `--muted`,
line-height 1.65, 7px between items). The home page, `/work` and the other pages do not
show `points` (home shows `impact`, `/work` shows `selectedWork`), so they stay the same.
Outside the page, the same bullets go into the résumé PDF (these two roles are the two
"detailed" roles in `scripts/resume.mjs`), the Ask assistant's prompt, the MCP tools and
the LinkedIn comparison. None of those is a page layout, but see the PDF note below.

**Flow, per reader.** A recruiter on `/experience` reads the Windows & Devices Data role
first. Its first bullet is now the "about 20 … about 12" line. The Windows Data role comes
second, and the new team-growth bullet sits right after the Perfect Day bullet, before the
quality-gains bullet. No new step, control or state.

**States.** No empty, loading or error state is involved. The bullets are static data,
prerendered into the HTML, so the page shows the new text the same way without JavaScript.
Long content: the replaced bullet grows from about 165 to about 215 characters. The new
bullet is about 98.

**Layout.**
- 1440 (light, dark): the body column is `minmax(0, 700px)`. At 14px the replaced bullet
  wraps to 3 lines instead of 2, and the new bullet takes 1 to 2 lines. The two items grow
  by about 2 to 3 lines in total (about 45 to 70px). The timeline is a plain vertical list,
  so the extra height only pushes later items down.
- 390 (light, dark): each item becomes one column (`grid-template-columns: 1fr`). The
  replaced bullet wraps to about 6 lines. Bullets in the same role are already that long
  (the budget and AI-analytics bullets are longer). No unbreakable word is added (the
  longest is "Microsoft’s"), so there is no horizontal scroll at 390 or 320.
- Sketch, 390px, the csx-data item after the change:

      FEB 2020 - DEC 2024
      MICROSOFT
      Principal Product Manager Lead -
      Windows Data
      Redmond, Washington
      Built data products that told ...
      • Redefined Windows quality ...
        ... issue-free user days.
      • Grew the team from one to five    <- new, 2 to 3 lines
        direct reports, leading to
        promotion to Principal Group
        Product Manager.
      • Drove measurable quality gains ...
      • Provided the data behind ...
      • Built the alerting dashboards ...

**Interaction side effects checked.** The experience graph above the timeline jumps to an
item with `scrollIntoView` and `scroll-margin-top: 200px`. The row reveal animates each
`.timeline-item` with `clip-path`. Neither depends on the item's height, so a taller item
changes nothing. Reduced motion is not affected (no new motion). Print keeps
`.timeline-item { break-inside: avoid }`, and an item about 45px taller still fits on a page.

**Accessibility.** No new control, no change to focus order, no new label. The text uses the
existing `--muted` on `--paper` in both themes, which already passes AA on this page. The
copy is plain and in the past tense, which fits both roles having ended (Sep 2026 and
Dec 2024). Typographic note for the developer: bullets on the site use a curly apostrophe
("Microsoft’s" in the Windows K2 bullet). Write "Microsoft’s cost reductions" with U+2019,
not a straight `'`, so all the bullets match.

**PDF (for the developer and recruiter, not a site layout).** Both roles are the "detailed"
roles on page one of the résumé. About 150 more characters can push `scripts/resume.mjs`
to a fallback layout (fewer bullets on the older Microsoft roles, or compact type) to stay
on two pages. `npm run resume:build` prints the layout it chose. If it falls back, the
recruiter should weigh that trade-off before merge.

**Flow diagram.** None needed: this change does not touch how work flows.

**Pages to screenshot.** None required: there is no layout risk at 320, 390 or 1440. For
Steven's before/after, `experience` (phone, `--slices`) is the one page that shows the new
bullets.

**Verdict:** APPROVE. Text-only change that renders in one existing list on `/experience`,
with no layout, state, keyboard or contrast risk. One condition: use a curly apostrophe in
"Microsoft’s".

## Threat model (security-engineer)

**New attack surface: none.** No endpoint, Function, tool, input, token, secret, workflow,
dependency or D1 table is added or changed. The change is two static strings in
`src/resume.ts`, Steven's approved wording committed to the repository, not visitor input.

**Where the strings flow, and why each sink is safe.**
- Site HTML (`/experience`, prerendered): rendered as React text children, which are
  escaped. Nothing in `src/` passes `points` to `dangerouslySetInnerHTML`.
- PDF (`scripts/resume.mjs`): every point goes through `esc()` before it reaches the HTML
  that becomes the PDF. The new text has no markup characters anyway.
- Assistant prompt (`functions/_lib/ask/prompt.ts`), MCP tools (public `/mcp` and
  `/mcp/<key>`), WebMCP and the LinkedIn comparison: they already serve all of
  `experiences` as public data. The strings hold no instructions and nothing that should
  stay private, so they open no prompt-injection or exfiltration path. The rule that only
  `public` dossier entries reach the assistant is untouched.

**Privacy.** The text names no colleague, report or family member, and no internal detail
beyond a publicly reported fact ("Microsoft’s cost reductions"), in Steven's own approved
words. The team sizes are his own career facts, approved by him for publishing.

**Required controls.** No new ones. The existing controls stay: React escaping, `esc()` in
the PDF renderer, and the file scope in AC-3 (only `src/resume.ts`, the PDF, the generated
report and this spec change). At merge review I check that the diff stays within AC-3, so
no code, workflow or dependency rides along with the data.

**Tests.** AC-3 (diff scope) and AC-7 (the prerendered `/experience` shows the text as
plain text) cover this. No new security test is needed.

**Verdict:** APPROVE.

## Technical approach (senior-developer)

**Feasible as written. A data-only change: two string edits in `src/resume.ts`, then the
generated PDF. No code, no test code, no migration, no new dependency.**

**Files that change (and only these, AC-3).**
- `src/resume.ts`, line 9 (`windows-devices-data`): `points[0]` replaced by Steven's text,
  verbatim, with U+2019 in "Microsoft’s". The strings in this file are single-quoted and the
  same entry already holds "Microsoft’s" and "team’s" with U+2019, so the curly apostrophe
  needs no escaping and matches its neighbours. Items 1 to 7 untouched.
- `src/resume.ts`, line 10 (`csx-data`): Steven's new bullet inserted as `points[1]`,
  verbatim; the Perfect Day bullet stays `points[0]`, the other three move down one.
- `public/steven-wilssens-resume-2026.pdf`, regenerated by `npm run resume:build`, no
  `--force`.
- This spec. The résumé report is written to `dist/resume-report.json` by `npm run build`
  and is not tracked, so it is not part of the diff. `scripts/lastmod.mjs` writes only to `dist/`.

**Data flow, nothing to change downstream.** Everything that shows bullets reads
`experiences` at build or request time: the `/experience` timeline (prerendered, so AC-7 is
checked in `dist/experience/…html`), the PDF, the Ask assistant's prompt
(`functions/_lib/ask/prompt.ts`), the MCP tools (`get_role`, `review_for_recruiters`), the
LinkedIn texts (`functions/_lib/review`) and WebMCP (`src/webmcp.ts`). I checked for
anything pinned to the old text or to a bullet's position: no source or test contains
"designed its move", "PM organization of 10 to 20" or "Perfect Day metric" outside
`src/resume.ts`, and the tests that read `points[0]` (`functions/_lib/review/review.test.ts:104`,
`functions/_lib/mcp/review-tools.test.ts:173`) take it from `experiences` at run time, so they
follow the new text. `impact` keeps `backing: 'csx-data'` / `'windows-devices-data'`; keys are
unchanged, so the dossier, proposals and `syncProposals` are unaffected (PR #60's approved
proposals, if any, will be marked applied once this is live, which is the intent).

**What stays the same.** `profile` (summary, `teamSize`), `skills`, `impact`, `selectedWork`,
every other role, `src/pageMeta.ts`, `public/og-image.png` (headline and photo unchanged),
all components and Functions. Coverage cannot move: no executable line changes.

**PDF layout: how the build decides, and the risk.**
- `scripts/resume.mjs` renders `layouts` in order (`{2,roomy}`, `{1,roomy}`, `{1,compact}`,
  `{0,compact}`) and keeps the first that extracts to 2 pages or fewer. Today it lands on
  `{ olderBullets: 1, compact: true }` with about 27 px of headroom (recruiter's measurement).
- The csx-data insertion cannot affect that layout: `csx-data` is `experiences[2]`, a
  condensed role printing `points.slice(0, 1)`, which is still Perfect Day. The new bullet only
  enters the PDF at `olderBullets: 2`, which already overflows.
- The risk is entirely the `windows-devices-data` bullet, a detailed role printed in full on
  page one: 177 characters become 215 (+38). In compact type (8.7pt, line-height 1.24, a text
  column of about 7.4in − 1.3in − 12px ≈ 570px, roughly 95 to 100 characters a line) that is 2
  lines becoming 3, i.e. one extra line of about 14.4 px. Against ~27 px of headroom it should
  fit with ~13 px to spare. It is not certain: condensed roles have `break-inside: avoid`, so a
  page break can waste more than the total-height arithmetic suggests. Only the build decides.
- The build does not protect against the fallback by itself: at `{ olderBullets: 0 }` the ATS
  score does not drop (older bullets are not scored), so `resume:build` would still replace the
  PDF, `src/resume.test.ts` would still pass (it checks match, ≤2 pages, ATS errors) and
  `gates` would still pass. The guard is the build's printed line and the PDF text (AC-4, AC-6),
  which the builder must read and report, and the recruiter re-checks at merge.
- If it falls back: the builder does **not** reword. Steven approved this exact wording, so the
  change stops there with the measurement (`node scripts/tmp-measure.mjs` before and after: body
  height per layout and the page break) and the choice goes to Steven (Open question 4). Note
  for the PM: Open question 4's recommendation ("shorten the wording") is Steven's call to make,
  not something the build applies on its own. No `--force` in any case.

**Build order.** Edit `src/resume.ts` → `npm run resume:build` (read the "Layout:" line; it
must say "1 bullet on the older Microsoft roles, compact type") → `node
scripts/resume-check.mjs` and `--baseline https://steven.wilssens.com/resume-report.json`
(100, equal, exit 0) → `npm run lint`, `npm run test:coverage`, `npm run build` →
`npm run check:recruiter` on `dist/` (≥ 80) → grep the PDF text and
`dist/experience` HTML for AC-6 and AC-7.

**Out of scope, noticed.** `recruiterAngles['csx-data']` in `functions/_lib/mcp/tools.ts`
asks "why no promotion earlier?"; the new bullet partly answers it. Steven asked to change
nothing else, so it stays; a follow-up if he wants the MCP's angle updated.

## Test plan (senior-tester)

Only data changes (`src/resume.ts`) plus the generated PDF. No production code changes,
so no new function, branch or gate script needs a test. What can break is the text, its
order and the PDF layout, and today nothing would catch some of that. The existing tests
miss three things:
- `analyzeResume` (in `src/resume.test.ts`, "matches src/resume.ts…") compares only the
  first 60 characters of each bullet of the two latest roles.
- Its `normalize` turns `’` into `'`, so a straight apostrophe would still pass.
- It never looks at the older roles' bullets, so a fall back to `olderBullets: 0` (which
  drops Perfect Day from the PDF) passes `npm test` today.

The developer adds the tests below in the build. They go into existing files and reuse
what is already there (`extractPdf` from `scripts/resume-check.mjs`, `setPath` and
`render(<App />)` from `src/App.test.tsx`). No new fakes are needed and nothing touches
the network.

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | **New** in `src/resume.test.ts`, `describe('the Windows Data roles')`, `it('csx-data keeps Perfect Day first and adds the team growth second')`. `expect(experiences.find((e) => e.key === 'csx-data')!.points).toEqual([...])` with the exact five strings in order: Perfect Day, "Grew the team from one to five direct reports, leading to promotion to Principal Group Product Manager.", then the previous items 1 to 3 (keep the en dash in "3–4%"). Fails if the new bullet moves to first place (PR #60), if a word changes, or if an old bullet is dropped or reordered. | unit |
| AC-2 | **New**, same `describe`, `it('windows-devices-data says about 20, then about 12, with a curly apostrophe')`. `toEqual` on the full eight-item `points` array, item 0 exactly as in AC-2. Add `expect(points[0]).toContain('Microsoft’s')` so the U+2019 requirement is visible in the test name and the failure message (`normalize` in resume-check hides a straight `'`). | unit |
| AC-3 | `git diff origin/main...HEAD --stat` lists only `src/resume.ts`, `public/steven-wilssens-resume-2026.pdf`, the résumé report if the build writes one, the spec and the test files above. `git diff origin/main...HEAD -- src/resume.ts` shows exactly two changed lines (the `windows-devices-data` and `csx-data` entries). Already guarded: `src/App.test.tsx` asserts "led 10 to 20 product managers" (`profile.teamSize`), and `src/resume.test.ts` "raises the questions…" asserts that every `impact` number still has a `backing`. Do **not** add tests that pin `summary`, `skills` or `impact` text: they would only duplicate the data. The diff is the check. | named check (reviewers) |
| AC-4 | **New** in `src/resume.test.ts`, `the resume PDF`, `it('keeps the first bullet of every older Microsoft role')` (30 s timeout like its neighbour). `extractPdf(resumePath)`, collapse whitespace and map `’`→`'`, `–`→`-` (the same mapping as `normalize`, which is not exported; do it in the test, do not change the script). Then, for each `experiences.slice(2).filter((e) => e.company === 'Microsoft')`, expect the text to contain `points[0].slice(0, 60)`. This fails when the build falls back to `{ olderBullets: 0 }`, which is the recruiter's blocker, and it keeps guarding later changes. Named checks too: `npm run resume:build` output contains "Layout: 1 bullet on the older Microsoft roles, compact type" (not "0 bullets"); `git log origin/main..HEAD` has no "Forced"/force reason. Already covered: 2 pages (`report.pages <= 2` in "matches src/resume.ts…"). | unit + named check |
| AC-5 | `node scripts/resume-check.mjs` → ATS 100/100. `node scripts/resume-check.mjs --baseline https://steven.wilssens.com/resume-report.json` → "100 → 100", exit 0. The `gates` job on the pull request is green without `accept-lower-score`. The comparison logic is already tested in `src/resume.test.ts` ("says when a change would lower the score…") and `scripts/resume-gate.test.mjs`. No gate script changes, so no new script test. | named check |
| AC-6 | **New**, same `describe` as AC-4, `it('prints the full new Group PM bullet and Perfect Day first under the Lead role')`. In the normalized PDF text: (a) the whole of `windows-devices-data` `points[0]` appears (normalized), not only 60 characters. (b) Find the index of "principal product manager lead - windows data". The first bullet text after it is the Perfect Day bullet: its index is greater than the heading's, and it comes before the next role's title, "principal product manager lead - azure devops". Do **not** assert that "one to five direct reports" is missing: a roomier layout that prints it would be better for readers, not a bug. The AC's "expected not to appear" is noted by hand from the `resume:build` output. | unit |
| AC-7 | **New** in `src/App.test.tsx`, `it('shows the team-growth bullets under the Windows Data roles on the experience page')`. `setPath('/experience')`, `render(<App />)`. Get the heading "Principal Product Manager Lead - Windows Data", take its timeline item (`closest('.timeline-item')`) and its `listitem`s: item 0 is the Perfect Day text, item 1 the "one to five direct reports" bullet. Under "Principal Group Product Manager - Windows & Devices Data", item 0 is the "about 20 … about 12 during Microsoft’s cost reductions" bullet. `screen.queryByText(/Led a PM organization of 10 to 20/)` and `/designed its move to a flatter structure/` are null. The prerender uses the same `App` (`src/entry-server.tsx`), so this covers the HTML. Named check after the lead's build: `grep -c "one to five direct reports" dist/experience/index.html` ≥ 1 and `grep -c "designed its move" dist/experience/index.html` = 0. | component + named check |
| AC-8 | `npm run check:recruiter` on the built `dist/` ≥ 80 with 0 high (baseline 80, 0 high, from the recruiter section). `npm test`, `npm run lint`, `npm run test:coverage` (≥ 90% overall and per file; `src/resume.ts` is a data module and stays at 100%), `npm run build`. The existing "matches src/resume.ts and passes the resume checks" fails on a stale PDF: the first 60 characters of the new Group PM bullet differ from the old one, so `point-windows-devices-data` is raised. | named check |

**Edge cases and how they are covered**
- Curly vs straight apostrophe in "Microsoft’s": exact `toEqual` and `toContain('’')`
  (AC-2). The site renders the data as it is (AC-7), so a straight `'` would show on
  `/experience` even though the PDF check passes.
- En dash in "3–4%" survives the move to item 3: exact `toEqual` (AC-1).
- The new bullet put first (the PR #60 mistake): AC-1 and the AC-6 order check both fail.
- Layout fallback to 0 older bullets: AC-4's new test fails, and the build output shows it.
- Stale PDF (data changed, `resume:build` not run): existing "matches src/resume.ts…" fails.
- Bullets that wrap across lines or pages in the PDF: the test collapses whitespace first,
  as `analyzeResume` does.

**Determinism.** These tests read only committed files: `src/resume.ts` and the
committed PDF. No clock, no network (the live baseline URL is used only in the AC-5 named
check, never in vitest) and no shared state. The PDF tests reuse `extractPdf` and the
existing 30 s timeout.

**Gap for later (minor, for the developer, not this change).** `scripts/resume-check.mjs`
does not check the older roles' first bullets. The AC-4 test covers that here. Moving it
into the checker is a checker change, so it goes in a separate pull request with a
`scripts/resume-check.test.mjs` case, and it would then also show on `/admin` → Résumé.

Coverage stays at or above 90% (statements, branches, functions, lines) and every new
or changed file is at 90% or more on its own.

## Open questions for Steven

None of these blocks the change. Each has the team's recommendation, which applies unless
Steven says otherwise on the pull request.

1. Should PR #60 be closed once this pull request is open? Recommendation: yes, close it
   as replaced by this one, because it would drop the Perfect Day definition from the PDF.
2. Were the five direct reports all product managers? If so, "Grew the team from 1 to 5
   product managers, leading to promotion to Principal Group Product Manager" would clear
   the recruiter review's `scope:csx-data` and scan better. Recommendation: ship your
   approved wording now. If you confirm, the digit version is a one-line follow-up.
3. Should the team-growth bullet go third, after "Drove measurable quality gains…", so
   that Perfect Day defined and Perfect Day improved stay together? Recommendation: keep
   it second as you asked. The PDF shows neither bullet, so only `/experience` is
   affected.
4. Only if the build reports a fall back to 0 bullets on the older roles: should the
   Group PM bullet be shortened (for example, by dropping "under my leadership"), or should
   your wording stay and the thinner PDF be accepted? The build does not reword your
   approved text on its own and never uses `--force`. It ships your wording as you wrote
   it and reports the fallback here and in the pull request. Recommendation: approve the
   shorter wording, so that every older Microsoft role keeps its first bullet in the PDF.
   The developer and the recruiter expect the current layout to hold (about 13 px to spare).
5. Should `teamSize` and the skill line keep "10 to 20" now that the bullets say "about
   20" and "about 12"? Recommendation: keep them, as you asked.
6. Should the new bullet name the year of the promotion? Recommendation: no. The Group
   PM role's Dec 2024 start date already shows it.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE (reconciled) | | AC-1 to AC-8 agree with the test plan and the technical approach. The recruiter's conditions are AC-4, AC-5 and AC-8, and the designer's U+2019 is AC-2. On a fallback to 0 bullets, Steven's wording ships unchanged, with no reword and no `--force`, and the fallback is reported to him (Open question 4). Follow-ups are under Out of scope. Open questions 1 to 6 do not block |
| Senior recruiter | APPROVE | | Baseline: recruiter 80/100, ATS 100/100. The PDF must stay on the 1-bullet compact layout and not fall back to 0 bullets |
| Senior designer | APPROVE | | Text only; `/experience` timeline; curly apostrophe in "Microsoft’s" |
| Senior developer | APPROVE | | Feasible as written: two strings in `src/resume.ts` plus the regenerated PDF, no code. Risk: the Group PM bullet adds ~1 compact line (~14 px) to page one against ~27 px headroom; a fall to 0 bullets is not caught by tests or `gates`, so the build's Layout line is checked and, if it falls back, reported to Steven, never reworded or forced |
| Security engineer | APPROVE | | Data-only change, no new attack surface; escaped in HTML and PDF; already-public data in assistant and MCP; diff must stay within AC-3 |
| Senior tester | APPROVE | | Test plan maps AC-1 to AC-8. Five new tests are required in the build: exact `points` arrays for `csx-data` and `windows-devices-data`, PDF keeps every older Microsoft role's first bullet, PDF order and full Group PM bullet (`src/resume.test.ts`); `/experience` bullets (`src/App.test.tsx`). Missing any of them is a merge blocker |
