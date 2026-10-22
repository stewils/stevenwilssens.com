# Team sizes on four Microsoft roles, the Azure DevOps choice, and Cosmos dates that follow Info Support

Slug: `team-sizes-azure-devops-context-and-cosm-38` · Branch: `update/team-sizes-azure-devops-context-and-cosm-38` · Status: built. `npm run resume:build` (no `--force`): "Layout: 1 bullet on the older Microsoft roles, compact type, to fit two pages." New PDF ATS 100/100, 2 pages, 0 errors, 0 warnings, no date question; `--baseline https://steven.wilssens.com/resume-report.json`: "ATS score 100 → 100: the same as the live site". `npm run check:recruiter`: 80/100 (main's data on the live pages: 80/100), 0 high, the same 4 medium findings as the baseline, 9 questions (11 before; the Cosmos overlap is gone)
Asked by Steven on 2026-10-22 (Site update, approved instruction): "Make these résumé changes in src/resume.ts (site, experience page and PDF), and change nothing else:
1. Cosmos (role key "cosmos"): change the start date from Jan 2004 to Jan 2005, so the dates read Jan 2005 - Dec 2005. Keep Info Support at Jan 2001 - Dec 2004.
2. Windows Data lead (role key "csx-data"): replace the bullet "Grew the team from one to five direct reports, leading to promotion to Principal Group Product Manager." with "Grew the team from one to five PMs, working with about 20 developers, leading to promotion to Principal Group Product Manager."
3. Group PM role (role key "windows-devices-data"): in the first bullet, after "Led a PM organization of about 20", add ", working with more than 100 developers and data scientists," keeping the rest of the bullet as is.
4. Spatial audio lead (role key "spatial-audio-lead"): add a first bullet: "Led six PMs, working with about 20 developers."
5. Azure DevOps (role key "azure-devops"): after the existing DataOps bullet, add: "Chose to stay at Microsoft rather than move to GitHub to lead the team building it."
Note: a separate run (#37, "Cosmos start date after Info Support") is making change 1 on its own; this update supersedes it."

Short spec (CLAUDE.md, team flow step 4: facts in `src/resume.ts` only). The facts come
from Steven himself in the instruction above, so they are sourced; nothing is invented.

## Problem

Readers: a recruiter or hiring manager on `/experience` or in the résumé PDF (often
forwarded, often on a phone), then a peer checking the career story.

- **Scope is invisible or understated.** Recruiters screen principal and director
  candidates on scope first. Today the Group PM role says "a PM organization of about 20"
  but not the engineering and data science organization it worked with; the Windows Data
  lead says "five direct reports" (which reads as any discipline); the spatial audio lead
  role says nothing about the team at all. The MCP recruiter lens already asks for this
  ("Scope in numbers: how many PMs, engineers and data scientists",
  `functions/_lib/mcp/tools.ts`).
- **Azure DevOps reads as a stint that did not work out.** Six months with a bullet saying
  the team building his proposal "was moved to GitHub" invites "and why didn't you go?".
  The recruiter lens flags it ("Short stint: 6 months."; "a recruiter will assume it did
  not work out").
- **The early timeline overlaps.** Cosmos (Jan 2004 - Dec 2005) overlaps Info Support
  (Jan 2001 - Dec 2004). `scripts/resume-check.mjs` and `functions/_lib/review/recruiter.ts`
  raise it as a question, the MCP flags it, and three earlier specs carried it as an open
  question. Steven has now given the correct date.

## Outcome

A recruiter sees the team Steven led and the engineering organization he worked with on
three Microsoft leadership roles, reads the Azure DevOps move as his choice, and finds a
clean, non-overlapping early timeline. On `/experience`, in the assistant and in the MCP
all five changes show. In the PDF (one bullet per older Microsoft role) three show: the
Cosmos dates, the full new Group PM bullet and the spatial audio team size; the Windows
Data and Azure DevOps changes are second bullets and do not print.

## Acceptance criteria

Data (`src/resume.ts`, the only content file that changes):

- AC-1: `cosmos.dates === 'Jan 2005 - Dec 2005'`; `info-support.dates === 'Jan 2001 - Dec 2004'` (unchanged). The string `Jan 2004` no longer appears in `experiences`.
- AC-2: `csx-data.points` is exactly, in order: the Perfect Day bullet (unchanged, first); `'Grew the team from one to five PMs, working with about 20 developers, leading to promotion to Principal Group Product Manager.'`; then the three remaining bullets unchanged. The old "direct reports" string appears nowhere in `src/`.
- AC-3: `windows-devices-data.points[0]` is exactly `'Led a PM organization of about 20, working with more than 100 developers and data scientists, initially through three people managers, then led its move to a flatter team of about 12 during Microsoft’s cost reductions; roughly half the team was promoted under my leadership.'` (curly apostrophe kept); the other bullets unchanged.
- AC-4: `spatial-audio-lead.points[0]` is exactly `'Led six PMs, working with about 20 developers.'`, followed by the five existing bullets unchanged and in order.
- AC-5: `azure-devops.points` is exactly `['Authored a DataOps product proposal compelling enough that the team building it was moved to GitHub, as the better home for the product.', 'Chose to stay at Microsoft rather than move to GitHub to lead the team building it.']`.
- AC-6: Nothing else in `src/resume.ts` changes: `profile` (incl. `teamSize`, summary), `impact` and its `backing`s, `skills`, `selectedWork` periods, other roles. `git diff main -- src/resume.ts` touches only the five lines of the roles above.

Pages and PDF:

- AC-7: The prerendered `/experience` page shows the five changes: Cosmos dates read "Jan 2005 - Dec 2005" and the page has no `Jan 2004`; the bullets in AC-2 to AC-5 appear under their roles at the stated index (Azure DevOps has exactly two items, spatial audio's first item is the team size); no `five direct reports`. Component test in `src/App.test.tsx` (lines 194-195 updated to the full AC-2 and AC-3 strings, and extended).
- AC-8: `npm run resume:build` regenerates `public/steven-wilssens-resume-2026.pdf` without `--force`; it reports ATS **100 → 100**, 2 pages, 0 ATS errors, and `node scripts/resume-check.mjs --baseline https://steven.wilssens.com/resume-report.json` exits 0 (equal to the live site). The PDF text contains `Jan 2005 - Dec 2005`, not `Jan 2004`, contains the full new Group PM first bullet (AC-3), and, under the condensed roles, `Led six PMs, working with about 20 developers.` as the spatial audio lead's printed bullet.
- AC-9: The build keeps `{ olderBullets: 1, compact: true }` or a roomier layout: its line reads "1 bullet on the older Microsoft roles", and the existing test "keeps the first bullet of every older Microsoft role" passes unedited. The layout line is recorded in this spec's Status and in the pull request. **Stop rule:** if it falls to 0 bullets or 3 pages, the build does not trim, reorder or `--force`; it reports to Steven (Open question 2).
- AC-10: `node scripts/resume-check.mjs` raises no overlap or gap question about `cosmos` or `info-support`; `dataQuestions` and `reviewForRecruiters` raise none on Steven's timeline (`src/resume.test.ts:54` and `review.test.ts:129` renamed to "raises no date question on Steven's timeline"). The rules stay tested on made-up roles: the `vi.doMock('./resume')` fixture test of `dataQuestions` in `src/resume.test.ts` (reused from `3eb71fc`, mock undone in `finally`), and the existing `recruiter-branches.test.ts` for `recruiter.ts`.
- AC-11: `interview_status` (MCP) no longer flags Cosmos as overlapping: `server.test.ts:188` asserts Cosmos's flags equal `['Company change from Info Support.']` and Info Support has no overlap or gap flag. The `cosmos` entry of `recruiterAngles` in `functions/_lib/mcp/tools.ts` ("The dates overlap with Info Support…") is removed, since it would be false; no other angle changes (Azure DevOps angle count asserted unchanged). The `recruiterLens` rules (overlap, gap, same-month and month-after boundaries, short stint, plateau, company change) are tested on made-up roles in the new `functions/_lib/mcp/recruiter-lens.test.ts`, reused as is from `3eb71fc`.
- AC-12a: Every changed or new pin asserts the full new string, in order (`toEqual` on the whole `points` array, or the DOM index), with the literal U+2019 in the Group PM bullet; a test that only checks the old string is gone does not count. The changed `points`/`dates` contain no control, zero-width or bidi characters (S-1).

Consequential changes (allowed despite "change nothing else", because the build fails or a tool states a falsehood without them):
- Reused from run #37 (`3eb71fc`, its test and angle hunks only; not its `src/resume.ts`, PDF or spec): removal of `recruiterAngles.cosmos` in `functions/_lib/mcp/tools.ts`; the new `functions/_lib/mcp/recruiter-lens.test.ts`; its hunks in `functions/_lib/mcp/server.test.ts`, `functions/_lib/review/review.test.ts` and `src/resume.test.ts` (Cosmos PDF test, the "no date question" rewrite, the `dataQuestions` fixture test).
- Written here: the pins in `src/resume.test.ts` (csx-data, windows-devices-data, new spatial-audio-lead and azure-devops pins, the Cosmos data test) and `src/App.test.tsx`; the regenerated PDF; this spec.
- Found at build: `server.test.ts` "proposes changes for Steven to approve or reject" took the spatial audio 250% bullet as `points[1]`; with the team size first it is `points[2]`, so the test now finds it by content (`includes('250%')`) and checks it starts "Grew monthly active devices". The S-1 test also allows the en dash, which is already in the unchanged csx-data "3–4%" bullet.
- Nothing else: no component, copy, `pageMeta`, share image, article, checker, dependency or orchestration file (S-2 lists the exact set).

Gates:

- AC-12: `npm test` (incl. `src/resume.test.ts`), `npm run lint`, `npm run test:coverage` (90% or more overall and per changed file) and `npm run build` pass.
- AC-13: `npm run check:recruiter` on the built `dist/` is 80 or higher (main's score), with no new high or medium finding.
- AC-14 (preview check at review): asked "How large a team has he led?", the assistant answers from `teamSize` and the bullets and keeps "working with" for the developer counts; it never says he led 100+ developers.

## Where the Cosmos date is depended on (checked)

| Place | What depends on it | Effect of Jan 2005 |
|---|---|---|
| `functions/_lib/mcp/tools.ts` `recruiterLens` | overlap flag vs the next-older role | flag disappears; Cosmos keeps only "Company change from Info Support." |
| `functions/_lib/mcp/tools.ts` `recruiterAngles.cosmos` | hand-written "dates overlap" angle | becomes false; remove (AC-11) |
| `functions/_lib/mcp/server.test.ts:188` | expects the Cosmos overlap flag | fails; rewrite to expect no overlap |
| `scripts/resume-check.mjs` `dataQuestions`, `src/resume.test.ts:54` | expects at least one gap/overlap question | Cosmos was the only one; test fails; rewrite to "none on Steven's timeline" plus a fixture test of the rules |
| `functions/_lib/review/recruiter.ts`, `review.test.ts:129` | same, in the recruiter review | same; rewrite |
| `selectedWork` periods, `education` (2000 - 2004), "20 years" in `profile`/`pageMeta.ts` | none read the Cosmos start | unchanged |
| `public/steven-wilssens-resume-2026.pdf` | prints the dates | regenerated (AC-8) |

Run #37's branch (`origin/update/cosmos-start-date-after-info-support-37`, commit `3eb71fc`) made exactly these Cosmos-related test and angle changes; the developer may reuse them.

## Out of scope

- Any other wording, ordering or trimming on the résumé, `profile.teamSize`, the summary, the home-page impact band, the About page, LinkedIn guidance, the share image.
- New recruiter angles reflecting the new facts (e.g. retiring the Azure DevOps "did not work out" angle): a follow-up once this is live, since Steven asked for no other change.
- **Overlap with run #37.** #37 changes only the Cosmos date; this pull request supersedes it. Whichever merges second conflicts on `src/resume.ts`, the PDF and the tests. Recommendation: close #37 unmerged once this one is open (`close_site_update`), not merge both. If #37 merges first, rebase this branch on main and keep this branch's content; the Cosmos parts are then already on main.

## Recruiter impact (senior-recruiter)

**Baseline (2026-10-22, this branch = main `737017c`, before the change).**
- Recruiter review: **80/100**, with 0 high, 4 medium, 0 low and 11 questions. There was no `dist/` and I did not build,
  because the PM and the designer share this worktree. I scored the live pages instead:
  `node scripts/recruiter-check.mjs --pages https://steven.wilssens.com` gives 80/100, the same as main's data on the
  live pages (80/100). The four medium findings are `scope:csx-data`, `scope:azure-devops`, `scope:spatial-audio-lead`
  (each says the role gives no team size) and `linkedin`.
- Résumé: `node scripts/resume-check.mjs` gives **ATS 100/100**: 2 pages, 0 errors, 0 warnings. It asks one question:
  the Cosmos/Info Support overlap. `--baseline https://steven.wilssens.com/resume-report.json` gives
  "100 → 100: the same as the live site".
- I could not render the changed PDF in a scratch copy: the sandbox would not run a scratch script or create a
  worktree without approval. The layout figures below are estimates. The build must confirm them (condition 1).

**First ten seconds.** Nothing changes. The home hero, the facts line ("Led teams of 10 to 20 product managers", from the
unchanged `profile.teamSize`), the impact band, the résumé link and the contact links stay as they are. The PDF header,
facts strip, summary and key achievements stay the same too.

**Close read, change by change.**
1. *Cosmos Jan 2005 - Dec 2005.* This is the change a recruiter gains most from. An overlapping timeline reads as an
   error until someone explains it. Removing the overlap also removes the only date question the résumé check and the
   recruiter review raise. No gap is created: Info Support ends Dec 2004, Cosmos runs Jan to Dec 2005 and Compuware starts
   Jan 2006. The line length is unchanged in the PDF's "Earlier career" block.
2. *csx-data, "one to five PMs, working with about 20 developers".* "PMs" is better than "direct reports" on
   discipline: it is now clearly a product team. Adding the engineering partner count gives the level a hiring manager
   looks for. The trade-off is small: "direct reports" was the plainer people-manager keyword. "Grew the team" in a
   *Lead* role still reads as people management, so I accept it. This is the second bullet of a condensed role
   (`csx-data` is the third entry in `experiences`), so it **does not print in the PDF** (only `points[0]` does). It
   reaches the site, the assistant, the MCP and LinkedIn. Correction to Open question 2: this change does not lengthen
   anything the PDF prints. Only change 3 does.
3. *windows-devices-data, "working with more than 100 developers and data scientists".* This is the strongest scope
   signal in the change, and it sits in the most recent Microsoft role, which recruiters read first. "Working with" is
   honest: it says partnership, not reporting lines. Two costs:
   (a) The bullet grows by about 60 characters and becomes the longest on the résumé. In the PDF it prints in full (the
   two latest roles never lose a bullet), probably 3 lines today and 3 or 4 after. This is the **layout risk**
   (condition 1).
   (b) The inserted clause splits "Led a PM organization of about 20" from "initially through three people managers",
   so a quick reader can attach the three managers to the 100 developers. I would put the clause after "people
   managers". Steven placed it, so this is a question, not a blocker.
4. *spatial-audio-lead, new first bullet "Led six PMs, working with about 20 developers."* This is a clear level signal,
   short, and in the past tense. In the PDF it **replaces** "Led the Microsoft Spatial Audio Platform across Windows,
   Xbox One, and new platforms." as the role's only printed bullet. The role summary ("Led audio, spatial audio, game
   streaming, xCloud…") and the 250%+ figure in the PDF's key achievements still name the product. On a résumé for
   principal and director roles, team size is the better use of that line, so I agree with the PM's recommendation in
   Open question 1. The new bullet is shorter (one line either way), so it does not add height.
5. *azure-devops, "Chose to stay at Microsoft rather than move to GitHub to lead the team building it."* This is worth
   adding. It answers the first question a recruiter asks about a role of about 5 months (Sep 2019 to Feb 2020): "why so
   short?". Read with the bullet before it, it says that his proposal was strong enough to move to GitHub, that he could
   have led the team there, and that he chose Microsoft, where his next role was a promotion track. It does not read as
   defensive, because it states a choice and gives no excuse. Two weaknesses:
   (a) "to lead the team building it" can be read as the reason he *stayed* ("stayed at Microsoft … to lead the team").
   The bullet above disambiguates it, but a skimmer may still misread it.
   (b) It does not say whether the GitHub role was actually offered. A hiring manager may ask, and Steven should have the
   one-line answer ready.
   It is the second bullet of a condensed role, so it does not print in the PDF. It is on the site and in the assistant,
   which is where the "why only five months?" question gets asked. On the designer's idea of swapping the two bullets
   so that the PDF carries the choice: I am against it. On its own, "Chose to stay at Microsoft…" would be the role's
   only printed line. It refers back to a proposal the PDF no longer shows and reads as a non-achievement. The DataOps
   proposal is the stronger single line. I agree with the designer that the Outcome sentence ("… and the PDF alike")
   overstates change 5 and the csx-data change. The PM should reword it to say that those two appear on the site and in
   the assistant.

**Sources and numbers.** "five", "about 20", "more than 100", "six" and "about 20" are scope statements inside role
bullets, in Steven's own approved wording. That is the source CLAUDE.md asks for. None of them is in `impact`, so no
`backing` changes. All of them sit inside `profile.teamSize` ("10 to 20 product managers"): PM counts of 5, 6, about 12
and about 20 agree with it, and the developer counts are explicitly "working with". The site still agrees with itself.

**Checks: expected effect.**
- ATS score: **100 → 100** expected. Titles, companies and date formats are unchanged; the Cosmos dates still parse.
  The keyword set is untouched. No line starts in the present tense ("Led", "Grew", "Chose"). The only way the score can
  fall is a third page (`pages`, an error). The layout fallback prevents that, at the cost of older bullets (condition 1).
- Recruiter review: **80 → 80** expected, with no new finding. The scope regex needs digits: "one to five PMs" and "six
  PMs" are words, and "developers" is not in `scopeWords`. So `scope:csx-data` and `scope:spatial-audio-lead` stay
  medium even though a human now reads a team size. `scope:azure-devops` stays (no team size was added). Writing the
  counts as digits ("from 1 to 5 PMs", "Led 6 PMs") would clear two medium findings (+10, to 90) and scan better on a
  résumé. That changes Steven's words, so it is a question below, not a condition. Do not change the checker.
- MCP: the PM's AC-11 already removes the stale Cosmos overlap angle in `tools.ts`. Without it the private interviewer
  would keep stating something false.

**What a recruiter would ask, and whether the change answers it.**
- "How big were his teams, and did he manage engineers?" Answered: PM counts per role, with engineering and data science
  counts marked as "working with". The assistant must keep that distinction. At merge, the answer to "How large a team
  has he led?" must not say he *led* 100+ developers (the prompt says "quote his numbers as written"; check it on the
  preview).
- "Why was Azure DevOps only five months?" Mostly answered on the site and by the assistant (see 5). The PDF does not answer it.
- "Were Cosmos and Info Support at the same time?" Answered: no.
- "Did he leave during the cost reductions?" Not touched by this change.

**Conditions for my merge sign-off (please put them in the acceptance criteria where they are not there already).**
1. `npm run resume:build` still chooses `{ olderBullets: 1, compact: true }` (or roomier). Its printed layout line says
   "1 bullet on the older Microsoft roles", the PDF stays at 2 pages, and every older Microsoft role keeps its first
   bullet (AC-9). If the longer Group PM bullet pushes it to 0 bullets, that is **worse for recruiters**: every older
   Microsoft role would lose its only bullet, including the new spatial audio team size. Stop and take it to Steven, as
   Open question 2 says. No `--force`.
2. ATS 100, equal to the live site (`--baseline`, exit 0). `check:recruiter` on the built `dist/` is 80 or higher, with
   no new high or medium finding.
3. The five texts match Steven's wording exactly, with the curly apostrophe kept in the Group PM bullet. `profile`,
   `impact` and `skills` are unchanged (AC-6).
4. On the preview, the assistant answers "How large a team has he led?" from `teamSize` and the bullets, and keeps
   "working with" for the developer counts.

**Questions for Steven (for the PM to collect; the build follows my recommendation).**
- Digits instead of words: "Grew the team from 1 to 5 PMs, …" and "Led 6 PMs, working with about 20 developers."? They
  clear two recruiter-review findings (80 to 90) and scan faster. *Recommendation: keep your words in this pull request,
  as asked; switch in a follow-up if you agree.*
- Group PM bullet: move ", working with more than 100 developers and data scientists," after "initially through three
  people managers"? That keeps the reporting line in one piece. *Recommendation: keep your placement now; consider it in
  a follow-up.*
- Azure DevOps: were you offered the role leading the team at GitHub? If you were, "Offered the lead of that team at
  GitHub; chose to stay at Microsoft." removes the double reading. *Recommendation: keep your wording now.*

**Verdict: APPROVE**, on the four conditions above. Nothing in the change makes the first screen, the paths or the
scores worse. Two things carry the real risk: the PDF layout (condition 1) and the assistant overstating the developer
counts (condition 4).

## Design (ux-designer)

**What renders differently.** Only text changes. No component, CSS, token, route or
admin change, and none is needed: every changed string goes into a list that already
exists and already handles bullets of any count and length.

- `/experience` is the only page that shows role bullets and dates (`renderExperience` in
  `src/App.tsx`: `.timeline-date`, then `.timeline-body ul > li`, 14px, `--muted`,
  line-height 1.65). `points.map` renders as many bullets as a role has, so going from one
  bullet to two (Azure DevOps) or five to six (spatial audio lead) needs no code.
- The experience graph above the timeline shows the first four-digit year of `dates`
  (`.graph-year`). The Cosmos node changes from **2004** to **2005**. Nodes are placed by
  index (`--node-index`), not by year, so nothing moves. The new label is a better read:
  Info Support (2001) and Cosmos (2005) no longer suggest an overlap.
- The home page does not show `points` or `dates`. It shows `impact`, `profile` and fixed
  overview copy, and none of those change. `/work`, `/about` and the admin don't change either.
  So `home` renders exactly as on main.
- Outside the page: the PDF (`scripts/resume.mjs`), the Ask assistant, the MCP tools and
  WebMCP read the same data. Only the PDF has a layout. See below.

**Flow, per reader.** A recruiter on `/experience` reads the roles top-down:
1. Windows & Devices Data (first role): the first bullet now names the engineering and
   data science organization next to the PM organization.
2. Windows Data: the second bullet now says "five PMs, working with about 20 developers".
3. Azure DevOps: a second bullet follows the DataOps bullet and answers "why only six
   months?" right where the question comes up.
4. Spatial audio lead: the team size is now the first bullet, before the platform bullet.
5. Cosmos: the dates read "Jan 2005 - Dec 2005", right under Info Support's "Jan 2001 - Dec 2004".
No new step, control or state.

**States.** The bullets are static data, prerendered into the HTML, so the page reads the
same without JavaScript, and there is no empty, loading or error state. Long content:
- `windows-devices-data` bullet 1: about 200 to about 255 characters. It is now the
  longest bullet on the page. That is acceptable: it is one sentence and reads in order.
- `csx-data` bullet 2: about 95 to about 125 characters.
- `spatial-audio-lead` new bullet 1: 46 characters, one line everywhere.
- `azure-devops` new bullet 2: about 85 characters.
- No unbreakable word is added (the longest is "scientists,"), so nothing scrolls sideways at 320.

**Layout.** Same in light and dark, because the text uses the existing `--muted` on
`--paper`. Nothing else changes.
- 1440: body column `minmax(0, 700px)`, about 95 characters per line at 14px. The Group PM
  bullet goes from 2 to 3 lines and the csx-data bullet from 1 to 2. The Azure DevOps item
  gains one line (about 23px) and the spatial audio item gains one. Altogether the page
  grows by about 4 lines (about 90px). The timeline is a plain vertical list, so the extra
  height only pushes later items down.
- 390: one column, about 42 characters per line. The Group PM bullet goes from about 5 to
  about 6 lines, the csx-data bullet from 3 to 3 or 4, and the Azure DevOps bullet adds 2 to 3.
  The Group PM item already holds bullets of 5 or more lines (budget, AI analytics), so the
  rhythm doesn't change.
- Sketch, 390px, the Azure DevOps item after the change (the role that changes shape most,
  from one bullet to two):

      SEP 2019 - FEB 2020
      MICROSOFT
      Principal Product Manager Lead -
      Azure DevOps
      Redmond, Washington
      Defined new products, go-to-market
      strategies, and business decisions
      for the Azure DevOps Platform.
      • Authored a DataOps product
        proposal compelling enough that
        the team building it was moved to
        GitHub, as the better home for
        the product.
      • Chose to stay at Microsoft rather   <- new, 2 to 3 lines
        than move to GitHub to lead the
        team building it.

  The two bullets read as one short story, the proposal and then his choice, and the item
  stays shorter than its neighbours. No visual change is needed to tie them together.

**Interaction side effects checked.** The graph jumps with `scrollIntoView` and
`scroll-margin-top`, and the row reveal (`clip-path`) runs per `.timeline-item`. Neither
depends on item height. Reduced motion is untouched (no new motion). The React keys are
`role-dates` and the bullet text. The Cosmos key changes with its dates and stays unique.
Every bullet in a role stays unique. Print keeps `.timeline-item { break-inside: avoid }`,
and the tallest item (Group PM, now one line taller) still fits on one printed page.

**Accessibility.** No new control, no change to focus order or labels, no new contrast
pair (`--muted` on `--paper` already passes AA in both themes). Copy: write "Microsoft’s"
in the Group PM bullet with the curly U+2019 already there (AC-3). Do not retype it
straight. The new bullets are in the past tense, like the rest of the ended roles.

**PDF (not a site layout, but the same reader).** `scripts/resume.mjs` prints the two
latest roles in full and the older Microsoft roles with their first `olderBullets` bullets.
It picks the roomiest of four layouts that fits two pages. The PM notes the current
build already uses one bullet per older role. Three things to watch, in this order:
1. **Page fit.** About 85 more characters land on the two fully printed roles (page one).
   That can push the build to `compact` type, or to zero bullets on older roles, which
   AC-9 and the "first bullet of every older Microsoft role" test forbid. The build prints
   its layout line. Record it in the PR. If it changes from main's, the recruiter weighs it
   before merge (open question 2 holds: no trimming without Steven).
2. **What drops out of the PDF.** At one bullet per older role, the spatial audio lead
   prints "Led six PMs, working with about 20 developers." in place of the platform bullet
   (open question 1). The **Azure DevOps choice does not print at all**: it is the second
   bullet. The Outcome line ("on the site, the experience page and the PDF alike") is
   therefore not true for change 5. That follows from Steven's instruction ("after the
   existing DataOps bullet"), so I don't ask for a reorder. The PM should reword the
   Outcome, or add it as an open question for Steven ("swap the two Azure DevOps bullets
   so the PDF carries your choice?"). My view: the PDF reader sees the 6-month stint and
   needs the answer most, but the order is Steven's call.
3. **The 250%+ number.** Already today, the bullet that explains it (spatial audio lead,
   "Grew monthly active devices…") is not printed at one bullet per role, and this change
   pushes it one further down. No regression, but the recruiter should know about it.

**Flow diagram.** None. The change does not touch how work flows.

**Pages to screenshot.** No layout risk at 320, 390 or 1440, so a 320 reflow shot is not
required. At review: `experience` (phone with `--slices`, and desktop), branch against main,
in one theme. Dark changes nothing, because no colours change. `home` once, to confirm it
is identical. No admin shots: no admin file changes. Before/after pairs for Steven: the
`experience` phone slices that show the Group PM and Windows Data roles, and the slice
with Azure DevOps and the spatial audio lead. Also give page 1 and page 2 of the
regenerated PDF next to main's, since that is where the layout can actually change.

**Verdict: APPROVE.** A text-only change in one existing list on `/experience`, with no
layout, state, keyboard or contrast risk on the site. Conditions: (a) the PR records the PDF
layout line, and it stays at one or more bullets per older role on two pages; (b) the PM
corrects the Outcome, or asks Steven, because the Azure DevOps choice will not print in the
PDF at the current layout.

## Threat model (security-engineer)

**New entry points and data.** None. No route, tool, binding, secret, dependency, workflow
or permission is added. The change is five fixed strings in `src/resume.ts`, their test
expectations, the regenerated PDF, and the removal of one hard-coded recruiter angle in
`functions/_lib/mcp/tools.ts` (line 85). All the text is Steven's own approved wording,
committed to the repository: trusted data, not visitor input.

**Where the text flows, and why it is safe there.**
- Site (`/experience`, prerendered): React text children, escaped; `src/resume.test.ts`
  already asserts the component uses no `dangerouslySetInnerHTML`. The new strings contain
  no `<`, `>`, `&`, backticks, Markdown or URLs.
- PDF (`scripts/resume.mjs`): plain text. The only non-ASCII character is the existing
  U+2019 in "Microsoft’s", which the PDF already prints today.
- Assistant system prompt (`functions/_lib/ask/`), MCP (public `/mcp` and private
  `/mcp/<key>`), WebMCP: the bullets are public on the site already, so nothing is
  disclosed. They are statements of fact with no instruction-like text (no "ignore",
  "you are", tool names), so they cannot act as a prompt injection. No dossier entry,
  private note, or family or colleague detail is involved; team sizes are aggregate counts
  with no names.
- Removing the Cosmos angle deletes a hard-coded string; no logic or authorization changes.

**Abuse cases considered.**
1. Hidden or bidirectional characters smuggled into résumé text, changing what the
   assistant or a recruiter reads. Control: S-1.
2. A "data-only" Site update creeping into `.github/`, `.claude/`, `CLAUDE.md` or
   `functions/` logic, which would change what runs with secrets. The instruction asks for
   none of that; AC-6 and the "Consequential changes" list bound the diff. Control: S-2.
3. The assistant overstating "working with more than 100 developers" as "led": a
   correctness risk, covered by the recruiter's condition 4, not a security one.

**Required controls and the tests that prove them** (for the test plan):
- S-1: the five roles' changed `points` and `dates` contain only printable ASCII plus
  U+2019: no control, zero-width or bidi characters (U+200B-U+200F, U+202A-U+202E,
  U+2066-U+2069). Proven by the exact-string `toEqual` tests of AC-1 to AC-5 in
  `src/resume.test.ts` (written with the literal U+2019, not a straight `'`).
- S-2: `git diff --stat origin/main...HEAD` lists only `src/resume.ts`, the PDF, the tests
  named under "Consequential changes" and in the test plan (including the new
  `functions/_lib/mcp/recruiter-lens.test.ts`), `functions/_lib/mcp/tools.ts` (one line
  removed) and this spec. Any file under `.github/`, `.claude/`, `CLAUDE.md`,
  `functions/api/`, `functions/_lib/ask/`, `wrangler.toml` or `package*.json` is a blocker.
  Reviewer check. *(PM correction: `scripts/tmp-measure.mjs` is tracked on main, not a
  scratch file of this change; it must not be touched, deleted or appear in the diff.)*
- S-3: no dependency change (`package.json` and the lock untouched), so no `npm audit` delta.

**Verdict: APPROVE.** Data-only, already-public facts, rendered as escaped text; no new
attack surface. Conditions: S-1 holds and the S-2 file list is respected at merge.

## Technical approach (senior-developer)

Feasible as written. Data only: five string edits on five lines of `src/resume.ts`, the
regenerated PDF, one line removed from `functions/_lib/mcp/tools.ts`, and tests. No
component, script, checker, dependency or migration changes.

**`src/resume.ts` (lines 9, 10, 11, 12, 17 on `737017c`).** Edit in place. Do not retype
whole lines, so the curly `’` characters elsewhere on them stay as they are.
- l.9 `windows-devices-data.points[0]`: insert `, working with more than 100 developers and data scientists,` after `Led a PM organization of about 20`. The existing comma after `20` becomes the inserted clause's first character, and `initially through…` follows the new trailing comma. The result must equal AC-3 byte for byte (274 characters, one U+2019).
- l.10 `csx-data.points[1]`: `five direct reports,` becomes `five PMs, working with about 20 developers,`. Leave the missing space before the next `'` (`…Manager.','Drove…`) alone. It is outside the asked change, and lint does not flag it.
- l.11 `azure-devops.points`: append `'Chose to stay at Microsoft rather than move to GitHub to lead the team building it.'` as the second element.
- l.12 `spatial-audio-lead.points`: prepend `'Led six PMs, working with about 20 developers.'`. Leave the escaped `platform\'s` in the last bullet untouched.
- l.17 `cosmos.dates`: `'Jan 2004 - Dec 2005'` becomes `'Jan 2005 - Dec 2005'`. That is 12 months, so `recruiterLens` raises no "Short stint" flag (the threshold is `< 12`).
- `selectedWork` l.167 ("Led the Microsoft Spatial Audio Platform across Windows and Xbox…") is a different string and does not change.

**PDF layout: prediction.** I built main's PDF to a scratch path (`node scripts/resume.mjs --out /tmp/stevenwilssens-resume/main.pdf`, which leaves the repository untouched). It prints `Layout: 1 bullet on the older Microsoft roles, compact type, to fit two pages.`, ATS 100, 2 pages. Main is therefore on the third of four fallbacks (`layouts` in `scripts/resume.mjs`). `node scripts/tmp-measure.mjs` gives a body of about 1932 px against about 1945 px for two pages, so about 13 px of headroom, less than one compact bullet line (8.7pt × 1.24 ≈ 14.4 px). Run #33 used up the rest. What changes in print:
- Group PM bullet (detailed role, always printed in full): 214 → 274 characters. A detailed bullet line holds about 100 characters (a printed line on main: "Scaled experimentation adoption across Windows, significantly reducing the number of features pulled" = 100). A greedy wrap at 98 gives **3 lines, the same as today**, and the last line is 84 characters, so about 14 characters to spare: `…developers and data scientists, / initially … about 12 during / Microsoft's cost reductions; … my leadership.`. Expected height change: 0.
- `csx-data` points[1] and `azure-devops` points[1]: not printed at `olderBullets: 1`. Change: 0.
- `spatial-audio-lead`: its single printed bullet goes from 85 characters (1 line) to 46 characters (1 line). Change: 0.
- Cosmos dates: same length, in the one-line `.early` block. Change: 0.

**Prediction:** it stays at `{ olderBullets: 1, compact: true }`, 2 pages, ATS 100 → 100, no `--force`. Confidence is high but not certain. I could not render the changed data in a scratch copy, because the sandbox refused the inline probe. If Chromium's wrap differs and the bullet takes a fourth line (+14.4 px against about 13 px), the extra line can still fall into the empty space that `break-inside: avoid` on the detailed `li` already leaves at the bottom of page 1, where the role breaks across pages. It falls to `{ olderBullets: 0 }` only when both go wrong. The build then prints `Layout: 0 bullets…`, and the test "keeps the first bullet of every older Microsoft role" fails. **Stop rule for the build:** if that happens, do not trim, reorder or `--force`. Report it, per Open question 2.

**Run #37's branch (`3eb71fc`): reusable, take the test and angle parts only.** It contains exactly the Cosmos consequences this spec lists, and its tests assert behaviour, not just strings:
- `functions/_lib/mcp/tools.ts`: removes the `cosmos:` line from `recruiterAngles`. **Reuse** (AC-11). No other angle changes.
- `functions/_lib/mcp/recruiter-lens.test.ts` (new, 53 lines): runs `recruiterLens` on made-up roles through `vi.mock('../../../src/resume')` and covers overlap, gap, same-month and month-after boundaries, short stint, plateau and company change. **Reuse as is.** It is needed: Cosmos was the only real role that took the overlap branch in `tools.ts:120`, so without it that branch loses coverage. It has to be its own file, because the mock would also replace the real data that `tools-branches.test.ts` relies on.
- `functions/_lib/mcp/server.test.ts:188`: asserts that Cosmos has exactly `['Company change from Info Support.']`, no overlap angle, and that Info Support has no overlap or gap flag. **Reuse.**
- `functions/_lib/review/review.test.ts:129`: inverts the gap and overlap expectation. Its comment points at `recruiter-branches.test.ts`, which is already on main and already covers the gap and overlap questions in `recruiter.ts` on fixtures. **Reuse.**
- `src/resume.test.ts`: adds the PDF test `prints Cosmos from Jan 2005…`, rewrites the test at l.54 to "raises no date question on Steven's timeline", and adds a `vi.doMock('./resume')` fixture test of `dataQuestions` (overlap, gap, time since the last role, unbacked number). **Reuse** these three hunks (AC-10).
- **Do not take** its `src/resume.ts` (we make that edit ourselves, with four more), its PDF (it lacks our bullets; regenerate) or its spec file.
- How: `git checkout 3eb71fc -- functions/_lib/mcp/recruiter-lens.test.ts` for the new file, and `git show 3eb71fc -- <file> | git apply` for `tools.ts`, `server.test.ts`, `review.test.ts` and `src/resume.test.ts` (on main the context lines of these hunks are the same as at `3eb71fc`'s parent). Do not cherry-pick the whole commit.

**Tests that change for the four new bullets** (the tester's plan owns the details):
- `src/resume.test.ts` l.79-87: in the csx-data pin, the second element becomes the AC-2 string. In the windows-devices-data pin (l.91 onward), `points[0]` becomes the AC-3 string; the `toContain('Microsoft’s')` check stays. Add exact pins for `spatial-audio-lead.points` (AC-4) and `azure-devops.points` (AC-5), plus a "nothing else changed" guard as the tester specifies. The PDF tests "prints the full new Group PM bullet…" and "keeps the first bullet of every older Microsoft role" read `pointsOf`/`points[0]`, so they follow the data without edits. The second one then checks that `Led six PMs, working with about 20 developers.` is in the PDF.
- `src/App.test.tsx` l.194-195: update both strings, and extend the test (or add one) for the Cosmos date, the spatial audio first bullet and the Azure DevOps second bullet on `/experience` (AC-7).
- Checked and unaffected: `webmcp.test.ts` (compares with `experiences` itself), `agent.test.ts`, `review-tools.test.ts`, `ResumePage.test.tsx`, and `review.test.ts:97` (`position:cosmos` is a "no matching position" fix from the LinkedIn fixture, matched by company and start month, so it does not depend on the date). No other test or source file contains the old strings (`grep` over `src functions scripts`).

**Coverage.** Changed files under coverage: `src/resume.ts` (data, 100%) and `functions/_lib/mcp/tools.ts` (the overlap branch stays covered by `recruiter-lens.test.ts`). `scripts/resume-check.mjs` and `functions/_lib/review/recruiter.ts`: the first is not in the coverage `include`, and the second is covered by `recruiter-branches.test.ts`. The fixture test exists for behaviour.

**Order of commands** (one tree, no parallel builds):
1. Edit `src/resume.ts` and apply the reused test and angle hunks, then update the four pins.
2. `npm run resume:build`. Read the output: ATS 100 → 100, 2 pages, 0 errors, no Cosmos question, and the layout line. Record that line in the spec Status and the pull request (AC-9).
3. `npm run lint`.
4. `npm run test:coverage` (includes `npm test`, so `src/resume.test.ts` checks the new PDF against the data).
5. `npm run build`, then `npm run check:recruiter` (80 or higher, AC-13) and `node scripts/resume-check.mjs --baseline https://steven.wilssens.com/resume-report.json` (100 → 100).
- No `node scripts/og-image.mjs`: the headline and the photo do not change.

**Verdict: APPROVE (feasible as written).** The risk is the PDF layout. I predict it holds with no height change. If it does not, the stop rule above applies.

## Test plan (senior-tester)

Checked against `main` (`737017c`). The line references in the AC are correct: `src/resume.test.ts`
56 (inside the test at 54-59), 82 and 92; `functions/_lib/review/review.test.ts:129`;
`functions/_lib/mcp/server.test.ts:188`; `src/App.test.tsx:194-195`. Only two tests pin the
old "direct reports" string (`src/resume.test.ts:82`, `src/App.test.tsx:194`). No test pins the
spatial audio "Led the Microsoft Spatial Audio Platform…" bullet or the single Azure DevOps bullet,
so those have to be added, not edited.

**Existing tests that must change (they would fail, or would pin something false):**

| Where | Today | After the change it asserts |
|---|---|---|
| `src/resume.test.ts:54-59` "raises the questions the dates and numbers leave open" | `some(/Compuware.*Microsoft\|months in between\|overlaps with/)` is `true`. Cosmos is the only match. | Rename it to "raises no date question on Steven's timeline". Assert that no question has `about` set to `cosmos` or `info-support`, and that none matches `/overlaps with\|months in between/`. Keep the `impact` assertion. Plus a **fixture test** (see N-7), because the rules must stay tested. |
| `src/resume.test.ts:79-87` csx-data `toEqual` (line 82) | the old "direct reports" bullet | the full list from AC-2, in order: Perfect Day first, then the new bullet, then the three bullets that do not change. Also rename the `describe` comment ("team growth" stays true). |
| `src/resume.test.ts:89-101` windows-devices-data `toEqual` (line 92) | first bullet without the developers clause | `points[0]` is exactly the AC-3 string. Keep `toContain('Microsoft’s')` (U+2019). The other seven bullets stay the same. |
| `src/resume.test.ts` "keeps the first bullet of every older Microsoft role" (24-29) | loops `experiences.slice(2)` Microsoft roles and checks the first 60 normalized characters of `points[0]` | **No edit.** It reads `points[0]` from the data, so it now requires "led six pms, working with about 20 developers." under the spatial audio lead. That is AC-8's printed bullet and AC-9's layout guard. It fails if the build falls back to 0 older bullets. |
| `src/resume.test.ts` "matches src/resume.ts and passes the resume checks" (15-23) | 0 errors, ≤ 2 pages, ATS 0 errors | **No edit.** It turns red until `npm run resume:build` regenerates the PDF: the role and date checks see `Jan 2005` and the bullets of the two latest roles, including the new Group PM bullet. |
| `src/resume.test.ts` "prints the full new Group PM bullet…" (31-40) | full `windows-devices-data[0]` in the PDF | **No edit.** It reads the data, so it covers AC-3 in the PDF. |
| `functions/_lib/review/review.test.ts:122-133` | `questions.some(/months in between\|What were the\|overlaps/)` is `true` | Rename it to "…raises no date question on Steven's timeline". Assert that no question has `about === 'cosmos'` and that none matches `/overlaps\|months in between/`. The rules are already covered on made-up roles in `functions/_lib/review/recruiter-branches.test.ts:56` ("asks about gaps and overlaps…"), so `recruiter.ts` keeps its branch coverage without a new file. The comment must name that file. |
| `functions/_lib/mcp/server.test.ts:188` | Cosmos has an `Overlaps with` flag | `cosmos.recruiterFlags` equals `['Company change from Info Support.']` exactly. No Cosmos angle matches `/overlap/i` (AC-11). `info-support` has no `/Overlaps\|unaccounted/` flag. Also assert that `azure-devops`'s angles are unchanged in count, because AC-11 says no other angle changes. |
| `src/App.test.tsx:186-199` "shows the team-growth bullets…" (194-195) | the old csx-data bullet, and the old Group PM bullet with `toHaveTextContent` (a substring match) | Line 194: the AC-2 string. Line 195: the AC-3 string. The old line-195 string is **not** a substring of the new one (the clause is inserted in the middle), so the test does fail on the old data. Add `expect(screen.queryByText(/five direct reports/)).toBeNull()`. |

**New assertions for the five changes** (data in `src/resume.test.ts`, page in `src/App.test.tsx`):

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | `src/resume.test.ts` "Cosmos runs Jan 2005 - Dec 2005, the month after Info Support ends": `cosmos.dates === 'Jan 2005 - Dec 2005'`, `info-support.dates === 'Jan 2001 - Dec 2004'`, and `JSON.stringify(experiences)` does not contain `Jan 2004` | unit, data |
| AC-1, AC-8 | `src/resume.test.ts` "prints Cosmos from Jan 2005" (from run #37, `3eb71fc`): the PDF text contains `jan 2005 - dec 2005` and does not contain `jan 2004` | PDF |
| AC-2 | `src/resume.test.ts` csx-data `toEqual` (changed, above). Plus: no role's points or summary in `experiences` contains `direct reports` | unit |
| AC-3 | `src/resume.test.ts` windows-devices-data `toEqual` (changed) and `toContain('Microsoft’s')` | unit |
| AC-4 | `src/resume.test.ts` "spatial-audio-lead leads with the team size": `pointsOf('spatial-audio-lead')` `toEqual` the six bullets: `'Led six PMs, working with about 20 developers.'`, then the five bullets that exist today, in their order | unit |
| AC-5 | `src/resume.test.ts` "azure-devops keeps the DataOps proposal first and adds the choice to stay": `pointsOf('azure-devops')` `toEqual` the two strings of AC-5, in that order (length 2) | unit |
| AC-6 | `src/resume.test.ts` existing tests over `profile`, `impact` and `backing` (the "impact" assertion in the questions test) and `src/App.test.tsx` home tests stay green unchanged. Plus `git diff main -- src/resume.ts` changes exactly 5 lines, one per role (each role is one line), checked by hand at review | review check |
| AC-7 | `src/App.test.tsx` "shows the team sizes, the Azure DevOps choice and the Cosmos dates on the experience page" (extends 186-199, using the existing `bulletsOf` helper): spatial audio lead `[0]` has the AC-4 text. Azure DevOps has exactly 2 list items with the AC-5 text in order. The Cosmos `.timeline-item` contains `Jan 2005 - Dec 2005` and the page has no `Jan 2004`. Lines 194 and 195 updated as above | component |
| AC-8 | `npm run resume:build` output, without `--force`: `100 → 100`, 2 pages, 0 ATS errors. `src/resume.test.ts` "keeps the first bullet of every older Microsoft role" (spatial audio prints the team size) and "prints the full new Group PM bullet…" | build + PDF |
| AC-9 | the layout line printed by `resume:build`, recorded in Status and in the pull request. "keeps the first bullet of every older Microsoft role" fails if it falls back to 0 bullets | build + PDF |
| AC-10 | `src/resume.test.ts` "raises no date question on Steven's timeline" and `review.test.ts` (changed). The rules on fixtures: the new `src/resume.test.ts` fixture test (N-7) for `dataQuestions`, and the existing `recruiter-branches.test.ts:56` for `reviewForRecruiters` | unit |
| AC-11 | `server.test.ts:188` (changed). New `functions/_lib/mcp/recruiter-lens.test.ts` (from `3eb71fc`): the `recruiterLens` overlap, gap, short-stint, plateau and company-change rules, plus the month-after and same-month boundaries, on made-up roles | unit |
| AC-12 | `npm test`, `npm run lint`, `npm run test:coverage`, `npm run build` | CI |
| AC-13 | `npm run check:recruiter` on the built `dist/`: 80 or higher, the same as main, with no new high or medium finding | gate |

**N-7, the fixture tests that keep the date rules covered.** Steven's real timeline no longer
contains an overlap. Each rule needs a test on made-up roles, or it loses its only test, or its
coverage, or both:
- `scripts/resume-check.mjs` `dataQuestions`: reuse #37's test "asks about an overlap, a gap, the
  time since the last role and an unbacked number" (`vi.doMock('./resume')` with three roles,
  `vi.resetModules()` in a `finally`). `resume-check.mjs` is not in the coverage `include`, so the
  number does not drop, but this is a gate script (CLAUDE.md, gate scripts are tested). Losing the
  only test of its overlap rule would be a `major`.
- `functions/_lib/mcp/tools.ts` `recruiterLens` (lines 120-121): today the overlap branch is covered
  only by Cosmos in `server.test.ts`, and `tools-branches.test.ts:107` covers only an unknown role.
  Add `functions/_lib/mcp/recruiter-lens.test.ts`, as in #37. That file mocks `experiences` with a
  hoisted array and keeps the rest of `src/resume` real, so it does not depend on Steven's data.
- `functions/_lib/review/recruiter.ts`: already covered by `recruiter-branches.test.ts`. No change.

**Edge cases to assert.**
- The month boundary: Cosmos starts the month after Info Support ends, and that is neither an
  overlap nor a gap. Both rules use `>` with an allowance. Assert it on the real data (Cosmos flags
  are exactly `['Company change from Info Support.']`) and in the fixture (`month-after`,
  `same-month`).
- Order, not just presence: each new bullet test uses `toEqual` on the whole `points` array, or
  checks the index in the DOM. That way, a new bullet appended last or placed first passes no test.
- The curly U+2019 in "Microsoft’s": an exact `toEqual` with the curly character, plus `toContain`.
  The PDF test normalizes quotes, so it would not catch a straight apostrophe on its own.
- The graph year: the Cosmos node on `/experience` (`.graph-year`) now reads `2005`. Add that
  assertion to the AC-7 test if the graph renders in jsdom. If it does not, the page-wide "no
  `Jan 2004`" assertion is enough, because the year is derived from `dates`.
- Determinism: every date test passes a fixed `now` (`new Date('2026-10-17')`,
  `Date.UTC(2026, 9, 17)`). No network: the PDF tests read the file in `public/`. The `doMock` in
  the `resume.test.ts` fixture must be undone in `finally`, so the later tests in that file see the
  real data again.

**Mutation checks at review.** In a scratch run, restore each old string one at a time, then put
it back: (1) Cosmos `Jan 2004`, which must turn red the data test, the PDF test,
`server.test.ts` and the two "no date question" tests; (2) "direct reports" (`resume.test.ts`,
`App.test.tsx`); (3) the Group PM bullet without the clause; (4) the six spatial audio bullets with
the new bullet moved second; (5) the two Azure DevOps bullets swapped. Each must fail at least one test.

**Coverage.** 90% or more overall and per changed file, with `perFile` enforced. The production files
that change are `src/resume.ts` (data, 100%) and `functions/_lib/mcp/tools.ts` (one array entry
removed). The risk is `tools.ts` branches, because the overlap branch at line 120 loses its only
hit. The new `recruiter-lens.test.ts` covers it, and also the gap branch at 121, which nothing
covers today. At review I read `tools.ts`, `recruiter.ts` and `resume.ts` in
`coverage-summary.json`. No new exclusion in `vitest.config.ts`.

**Verdict: APPROVE**, on two conditions: the build includes the two fixture tests (N-7), and every
changed pin asserts the new exact string with `toEqual` or `toHaveTextContent` on the full
sentence. A test that only checks that the old string is gone does not count.

## Open questions for Steven

Steven is not reachable in this run; each question carries the team's recommendation and
the build follows it. Nothing waits for him.

1. **Spatial audio in the PDF.** The PDF prints only the first bullet of older Microsoft roles, so the new first bullet "Led six PMs, working with about 20 developers." replaces "Led the Microsoft Spatial Audio Platform across Windows, Xbox One, and new platforms." in the PDF (the site keeps both; the role summary still names spatial audio, and "250%+" stays in the PDF's impact band). Keep your order? *Recommendation: yes, as instructed; team size is what recruiters screen on, and the summary carries the platform.*
2. **If the PDF no longer fits two pages at one bullet per older role** (only change 3 lengthens what the PDF prints: the Group PM bullet, 214 → 274 characters, in a fully printed role; changes 2 and 5 are second bullets that do not print), may the team shorten anything? *Recommendation: no; the build stops, the pull request says so, and you choose what to trim. No `--force`, no edits beyond your five. The developer predicts no height change.*
3. **Run #37.** Close #37 unmerged in favour of this pull request? *Recommendation: yes (see Out of scope).*
4. **Azure DevOps angle.** The MCP's recruiter angle for Azure DevOps still assumes the move "did not work out". Retire or rewrite it in a follow-up, now that the résumé says you chose to stay? *Recommendation: yes, a follow-up; not in this pull request.*
5. **Azure DevOps bullet order.** Your choice to stay is the second bullet, so it does not print in the PDF, where the 5-month stint is visible. Swap the two so the PDF carries it? The designer leaned yes; the recruiter is against (alone, "Chose to stay…" refers to a proposal the PDF no longer shows and reads as a non-achievement). *Recommendation: keep your order (DataOps proposal first), as you specified.*
6. **Digits or words for the PM counts.** "Grew the team from 1 to 5 PMs, …" and "Led 6 PMs, …" instead of "one to five" and "six"? The recruiter check's scope rule only reads digits, so `scope:csx-data` and `scope:spatial-audio-lead` stay medium findings with words (recruiter score 80); digits would clear them (about 90). *Recommendation: keep your words in this pull request; switch in a follow-up if you agree. The checker is not changed.*
7. **Placement of the "100 developers" clause.** In the Group PM bullet, ", working with more than 100 developers and data scientists," splits "a PM organization of about 20" from "initially through three people managers", so a skimmer may tie the managers to the developers. Move it after "people managers"? *Recommendation: keep your placement in this pull request; consider it in a follow-up.*
8. **The GitHub role.** Were you offered the lead of the team at GitHub? If so, a wording such as "Offered the lead of that team at GitHub; chose to stay at Microsoft." removes the reading that you stayed "to lead the team". The team does not assume either answer. *Recommendation: keep your wording in this pull request; have the one-line answer ready for interviews.*

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVED (reconciled) | | Outcome reworded for the two second bullets that do not print; open questions collected. |
| Senior recruiter | APPROVE, 4 conditions | | Build: (1) met: layout stays 1 bullet on the older Microsoft roles, 2 pages, "keeps the first bullet of every older Microsoft role" passes unedited; (2) met: ATS 100 → 100 vs the live site, `check:recruiter` 80, no new high or medium; (3) met: the five texts pinned with `toEqual` (curly U+2019 kept), `git diff origin/main -- src/resume.ts` is 5 lines; (4) open: the assistant's answer to "How large a team has he led?" is checked on the preview. |
| Senior designer | APPROVE, 2 conditions | | (a) met: layout line recorded above (and goes into the pull request); (b) met by the PM's Outcome rewording. |
| Senior developer | APPROVE (feasibility) | | The prediction held: no height change, no fallback. |
| Security engineer | APPROVE (threat model) | | S-1 tested ("keeps the changed roles free of hidden characters"); S-2 to be checked on the diff at review. |
| Senior tester | APPROVE, 2 conditions (test plan) | | (1) met: both fixture tests (`dataQuestions` via `vi.doMock`, `recruiter-lens.test.ts`); (2) met: every changed pin asserts the full new string in order. |
