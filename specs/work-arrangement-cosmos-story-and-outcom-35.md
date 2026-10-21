# Work arrangement, the Cosmos hire, and sharper outcomes on four stories

Slug: `work-arrangement-cosmos-story-and-outcom-35` · Branch: `update/work-arrangement-cosmos-story-and-outcom-35` · Status: built
Asked by Steven on 2026-10-21 (Site update, approved instruction, exact wording; replaces PR #65): "Do NOT touch the team-size bullets on csx-data and windows-devices-data; do NOT change any quotes or sources. Profile / work arrangement: add "Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating." Role "cosmos": append to the summary: "Joined as a consultant from Info Support, then hired full-time." Selected work "windows-quality": outcome becomes "Adopted by every Windows team, and behind the roughly 30% drop in issue days across Perfect Day scenarios." Role "windows-devices-data": replace "Scaled experimentation adoption across Windows, significantly reducing the number of features pulled back after release." with "Scaled experimentation across Windows to hundreds of concurrent experiments, significantly reducing the number of features pulled back after release." Selected work "okr-tool": append to the work field: "Built in six months to replace Viva Goals, Microsoft's acquired OKR product, after it was retired." Selected work "wilssens-com": "five sites and the family's mailboxes" -> "five sites and about eight family mailboxes". Change nothing else."

## Problem

Readers: a recruiter screening on a phone (first question: can he work where we are?),
a hiring manager reading `/work` and the PDF for scale and outcomes, and a peer checking
the story.

- Work arrangement: the site and PDF say "Seattle, Washington" and nothing about remote,
  hybrid, travel or relocation, so a recruiter for a non-Seattle role must ask, or
  screens Steven out.
- Cosmos (2004 - 2005) overlaps Info Support (2001 - 2004) with no explanation; a close
  reader sees two employers at once.
- `windows-quality` has a qualitative outcome only. The `~30%` home-page number has no
  role bullet backing it (the `TODO(steven)` in `src/resume.ts` above `impact`).
- "Scaled experimentation adoption" gives no scale; `okr-tool` does not say what was
  replaced or how fast; `wilssens-com` says "the family's mailboxes" without a size.

How we know: Steven's approved instruction above, with his exact wording.

## Outcome

A recruiter sees in the first screen and on the PDF header that Steven is Seattle-based,
open to remote or hybrid and to travel, and not relocating. The Cosmos overlap explains
itself, and four stories carry concrete scale in Steven's words. Nothing else changes,
and the ATS score stays 100/100.

## Acceptance criteria

Strings are exact. Apostrophes follow the file's convention: curly (U+2019) in
"Microsoft’s", as in the existing entries.

- AC-1: `profile` in `src/resume.ts` gets a new field `workArrangement` with exactly
  "Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating.".
  `location` stays "Seattle, Washington".
- AC-2: The work arrangement text appears, read from `profile.workArrangement` (no
  hard-coded copy, as a JSX text node), in Steven's exact wording:
  - home: a fourth `<span>` in `.hero-facts`, after the unchanged location · work
    authorization span; the 521-800px `.hero-facts` rule in `src/App.css` becomes
    `repeat(2, 1fr)` (the only CSS change);
  - `/about` side note: the pair "Work arrangement" / the text, between "Based in" and
    "Work authorization";
  - PDF: its own line in `header .contact` under the location line, through `esc()`. If
    that makes the layout step down from main's, it moves into the "Looking for" cell of
    `.facts` instead; type is not shrunk;
  - present in the prerendered `dist/index.html` and `dist/about/index.html`.
  On a 390px screen the line is on the home page without horizontal scrolling, and the
  résumé link, email and LinkedIn stay above the fold.
- AC-3: Wherever `workAuthorization` is exposed as a profile field to tools
  (`src/webmcp.ts` `about_steven`, `functions/_lib/mcp/tools.ts` `about_steven` and
  `get_resume`), `workArrangement: profile.workArrangement` is added beside it, with
  the `ctx.mode` gating unchanged. `scripts/resume-mail.mjs` `profileLabels` gets
  `workArrangement: 'work arrangement'` so Steven's résumé email reports the new line.
- AC-4: `cosmos.summary` is exactly the current summary followed by a space and "Joined
  as a consultant from Info Support, then hired full-time.". `cosmos.dates` stays "Jan
  2004 - Dec 2005"; the summary appears on `/experience` and in the PDF's Earlier career
  section.
- AC-5: `selectedWork` `windows-quality`: `outcome` is exactly "Adopted by every Windows
  team, and behind the roughly 30% drop in issue days across Perfect Day scenarios.";
  `source` stays "Amit Gupte"; other fields unchanged.
- AC-6: `windows-devices-data.points[4]` is exactly "Scaled experimentation across
  Windows to hundreds of concurrent experiments, significantly reducing the number of
  features pulled back after release."; the array keeps its length (8), order and every
  other item, including item 0 (team size). The bullet appears in full in the PDF text.
- AC-7: `selectedWork` `okr-tool`: `work` is exactly the current text followed by a
  space and "Built in six months to replace Viva Goals, Microsoft’s acquired OKR product,
  after it was retired."; `outcome` and `source` ("Amit Gupte") unchanged.
- AC-8: `selectedWork` `wilssens-com`: `outcome` reads "Live with five sites and about
  eight family mailboxes, each site …"; the rest of the sentence unchanged.
- AC-9: `git diff main -- src/resume.ts` touches only the lines above. `csx-data` points,
  `windows-devices-data.points[0]`, `impact` (including the `~30%` entry and its TODO
  comment), `recommendations`, every `source`, `teamSize`, `summary`, `skills` are
  byte-identical to main. Changed files are limited to `src/resume.ts`, the PDF,
  `src/App.tsx`, `src/App.css`, `scripts/resume.mjs`, `src/webmcp.ts`,
  `functions/_lib/mcp/tools.ts`, `scripts/resume-mail.mjs`, their tests, and this spec.
  Security controls C1-C4 hold: the PDF interpolates only `esc(profile.workArrangement)`
  (C1); the site renders it as JSX text, with no new `dangerouslySetInnerHTML` (C2); the
  tool objects add only that key (C3); nothing under `functions/api/**`,
  `functions/_lib/ask/**`, `.github/workflows/**`, headers/CSP, and no dependency changes
  (C4).
- AC-10: `npm run resume:build` regenerated the PDF without `--force`; the PDF is 2
  pages; `node scripts/resume-check.mjs` reports ATS 100/100 and `--baseline
  https://steven.wilssens.com/resume-report.json` exits 0. If the added header text
  pushes the layout to fewer older-role bullets than main, Steven's wording is not
  shortened; the team reports the layout change in the pull request and the recruiter
  judges it.
- AC-11: `src/resume.test.ts` asserts the new strings (it already pins
  `windows-devices-data` points and must be updated), and `npm run lint`,
  `npm run test:coverage` (90% overall and per changed file) and `npm run build` pass.
  `npm run check:recruiter` is not lower than main.

## Out of scope

- Resolving the `~30%` impact TODO or moving its `backing` (Open question 1).
- Changing any quote, recommendation, or `source`, and the `/work` intro copy.
- `functions/_lib/ask/agent.ts` line 208 ("scaled experimentation adoption across
  Windows"), a hand-written paraphrase in the assistant prompt (Open question 3).
- Regenerating `public/og-image.png` (headline and photo unchanged).
- Any change to the LinkedIn comparison or recruiter-check rules for the new field.

## Recruiter impact (senior-recruiter)

**First ten seconds (home, 390px).** The one question this answers is the one I screen on first:
can he work where the role is? Today the hero says "Seattle, Washington · US permanent resident
(green card)" and stops, so a recruiter with a New York or remote role has to guess or write.
After the change, "open to remote or hybrid, and to coordinated travel; not relocating" settles it.
"Not relocating" narrows the field, but saying it up front saves both sides a screening call. I
would not push back on it.

**Close read.**
- `/experience` and the PDF's Earlier career: the Cosmos line explains the 2004 overlap with Info
  Support. That is the date question a background check raises, and the résumé check asks it today.
  The checker reads dates, so it may still list the question; read it as answered.
- Windows `windows-devices-data` bullet: "hundreds of concurrent experiments" gives the scale the
  old bullet lacked, in the bullet the PDF shows in full. "Experimentation" was already in it, so
  ATS keyword coverage does not change.
- `okr-tool`: "Viva Goals" is a name hiring managers recognize. "Six months" is plain and believable.
- `windows-quality`: the outcome goes from a soft line to a claim of adoption plus a number. This is
  stronger, and also the riskiest line in the change (see below).

**Risks to the bar.**
1. **The source line under `windows-quality` overstates the source.** `/work` prints "As described by
   Amit Gupte in his recommendation" under the outcome. His recommendation supports "critical data
   products and rhythms that measured and elevated Windows quality". It does not say "every Windows
   team" or "30%". A hiring manager who opens the quote finds neither. Steven's approved wording is a
   valid source under CLAUDE.md, but the credit line attributes it to Amit. That is the PM's Open
   question 2. I would rather fix it in this PR than in a follow-up. Acceptable to ship as instructed,
   but say it in the PR.
2. **The 30% still has no role bullet.** The `impact` TODO stays. Today's checks pass with it, so this
   is not a regression. Now that the number appears in two places, a recruiter is more likely to ask
   "30% of what, measured how?" (PM's Open question 1).
3. **"About eight family mailboxes" against the write-up's own number.** The `wilssens-com` card
   links to `/building-wilssens`. That page renders mailboxes from `src/articles/wilssens/feed.json`
   (`"mailboxes": 3` at the 2026-10-15 refresh) and then from the live API. A reader who clicks
   through sees "about eight" on the card and "3" on the article. That contradiction costs more
   credibility than the extra detail adds. Also, "about" is an odd hedge for a count Steven controls
   (Open question 5).
4. **A busier first screen.** The sentence is 70 characters. On the hero-facts line, concatenated
   after "Seattle, Washington · US permanent resident (green card)", it says Seattle twice and wraps
   to three lines at 390px. My preference to the designer: give it its own fact line, keep Steven's
   words exactly, and keep the résumé link, email and LinkedIn inside the first phone screen. If the
   résumé link or contact drops below the fold, that is a blocker at merge.
5. **PDF header length.** A third header line can push the PDF to 3 pages or make the layout drop
   older-role detail. The PDF must stay 2 pages at ATS 100 (AC-10). At merge I will compare which
   roles keep bullets with main.
6. **The assistant cannot answer the new fact.** The assistant does not read `profile`.
   `functions/_lib/ask/prompt.ts` hard-codes "based in the Seattle area (Redmond, Washington)". Ask
   "Is he open to remote?" and it has nothing to go on, while the page says yes. This is not a
   regression, since the assistant never knew it, and the PM scoped assistant changes out. But it is
   the second question every recruiter asks the assistant after location (Open question 6). The
   WebMCP and MCP profile objects do get the field (AC-3). Good.

**Baselines (2026-10-21, this branch = main).**
- `node scripts/resume-check.mjs`: ATS **100/100**, 2 pages, 357 KB, 0 errors, 0 warnings. One
  question: the Cosmos/Info Support overlap, which this change answers in text.
- `npm run check:recruiter`: **80/100** for main's data on the live pages. The local run printed
  50/100 only because there was no `dist/` (each page "not in this deployment"). That figure is not
  a baseline. At merge the run must be against the lead's build and must not be below 80 with no new
  high finding.

**What a recruiter would ask Steven that this should answer.** Remote across US time zones or
Pacific only? How much travel is "coordinated" (for example, quarterly on-sites)? Would he relocate
for an exceptional role, or is "not relocating" firm? The wording answers the last one. The first
two are for the assistant and a call, not the hero.

**Verdict on the spec: APPROVE**, on these conditions, checked at merge:
- (a) The work arrangement is visible on the 390px home first screen with the résumé link, email
  and LinkedIn still above the fold.
- (b) The PDF stays 2 pages at ATS 100 without `--force`.
- (c) The PR body names risks 1 and 3 so Steven decides them knowingly. If the mailbox count and the
  write-up feed disagree when this ships, I will raise it as a major at merge unless Steven confirms
  the figure.

**Notes for Open questions for Steven** (the PM numbers and merges them):

5. (Recruiter) `wilssens-com` will say "about eight family mailboxes", but `/building-wilssens`
   (linked from that card) shows the mailbox count from its feed: 3 at the 2026-10-15 refresh.
   Which is right? Do the two count different things (accounts vs. provisioned mailboxes)? Can the
   card give the exact number instead of "about"? Recommendation: one number that matches the
   write-up, or wording that makes clear what is counted.
6. (Recruiter) The "Ask about Steven" assistant does not read `profile`, so it cannot answer "Is he
   open to remote?" although the page now does. Should the assistant's prompt get location, work
   arrangement and availability from `profile`? Recommendation: yes, as a follow-up through the
   full team flow; it changes the assistant, so you would put the three recruiter questions to the
   preview.
7. (Recruiter) A recruiter will ask next: remote across US time zones or Pacific hours? Roughly how
   much travel is "coordinated"? Is "not relocating" firm even for an exceptional role? Optional:
   record your answers in the dossier so the assistant and the MCP can give them.

## Design (ux-designer)

**What renders differently.** One new element: the work-arrangement line
(`profile.workArrangement`, copy exactly "Seattle-based, open to remote or hybrid, and to
coordinated travel; not relocating.", 75 characters; it may not grow past about 90, or the
home fact column runs to four lines). Everything else is copy in existing slots, with no
style change: the cosmos summary (`/experience` timeline, PDF Earlier career), the
windows-quality outcome and okr-tool work text (`/work` `.work-list` `dd`), the
windows-devices-data bullet (`/experience` `.timeline-body ul`, PDF bullets), the
wilssens-com outcome. No slot truncates, so long copy only wraps.

**Wording.** The line ships in Steven's exact wording, because his approval covers that
exact text. The shorter wording below stays an open question and does not block this change.

**Where the line goes.** Next to location wherever location and work authorization appear
together. No new token, class or component.

1. Home hero, `.hero-facts` (`renderHome`): a fourth `<span>` after
   `{profile.location} · {profile.workAuthorization}`, same muted 13px style; the location
   span stays as is. At 801-1440px the facts are a 210px column, so the line wraps to three
   lines; fine. Between 521 and 800px the facts are `repeat(3, 1fr)`, so a fourth item would
   sit alone on a second row: change that rule (`src/App.css` line 90) to `repeat(2, 1fr)`,
   a 2 x 2 grid. At 520px and below it is already one column. This is the only CSS change.
2. About, `.side-note` (`renderAbout`): a label/value pair between "Based in" and "Work
   authorization": `<span>Work arrangement</span><strong>{profile.workArrangement}</strong>`.
3. Résumé PDF (`scripts/resume.mjs`, `header .contact`): its own line under the location
   line, muted like the others. The contact column is `1fr auto`, so its longest line sets
   its width: check that the headline stays on one line and the PDF stays two pages. If it
   does not fit, append it to the "Looking for" cell in `.facts` instead; do not shrink type.
4. Contact band (every page): unchanged; it already says "based in Seattle, Washington".

```
Home 1440 (hero right column, 210px)        Home 390 (one column, under lede)
| Open to: product leadership roles ...     Open to: product leadership ...
| Principal · Group PM · led ...            Principal · Group PM · led ...
| Seattle, Washington · US permanent        Seattle, Washington · US
|   resident (green card)                     permanent resident (green card)
| Seattle-based, open to remote or          Seattle-based, open to remote or
|   hybrid, and to coordinated travel;        hybrid, and to coordinated
|   not relocating.                           travel; not relocating.

About aside                                 PDF header, right-aligned
  BASED IN / Seattle, Washington              Seattle, Washington · US permanent resident (green card)
  WORK ARRANGEMENT / Seattle-based, ...       Seattle-based, open to remote or hybrid, ...; not relocating.
  WORK AUTHORIZATION / US permanent ...       steven@wilssens.com · ...
```

**States.** Static, prerendered text: no loading, error or empty state, identical without
JavaScript. **Contrast:** existing `--muted` and `--ink` tokens, AA in light and dark.
**Accessibility:** no control, no change to focus order, no motion.

**Pages to screenshot** (branch vs main, phone slices, plus 320px for home and about):
`home`, `about`, `experience`, `work`, `projects`. Before/after pairs for Steven: home hero
facts (desktop and phone), about aside, page 1 of the PDF. No admin part changes.

**Verdict on the spec: APPROVE**, conditions: the one CSS rule, and the PDF header width check.

## Threat model (security-engineer)

**Scope.** Copy edits in `src/resume.ts` and one new string field, `profile.workArrangement`,
rendered on home and `/about`, prerendered into `dist/`, written into the PDF header and
returned by `src/webmcp.ts` and `functions/_lib/mcp/tools.ts` (`about_steven`, `get_resume`).
No new route, tool, input, storage, secret, dependency or workflow; every value is a
committed constant, so no visitor or model text reaches these paths. The field goes to
anonymous MCP clients and WebMCP, which is intended: the same text is on the home page.

**Abuse cases considered.**
1. Markup injection into the PDF if the field skips `esc()` in the HTML template (low risk
   today, the control costs nothing).
2. XSS on the site only with `dangerouslySetInnerHTML` or a Markdown renderer; JSX text is escaped.
3. Privacy: the published sentence is exactly Steven's approved wording; nothing from the
   dossier (compensation, start date, reasons for not relocating) goes into `profile` or tool
   output. "About eight family mailboxes" is a count only.
4. Tool output drift: no owner-only fields move into the public branch of `about_steven`.

**Required controls.**
- C1: `scripts/resume.mjs` interpolates the field only through `esc(profile.workArrangement)`.
- C2: Home and `/about` render it as a JSX text node.
- C3: The MCP and WebMCP profile objects add only `workArrangement: profile.workArrangement`;
  the `ctx.mode` gating in `about_steven` is unchanged.
- C4: No files under `functions/api/**`, `functions/_lib/ask/**`, `.github/workflows/**`,
  CSP/headers, and no dependency change.

**Tests that prove them.** T1 (C1): the PDF text test shows the field (and review checks
`esc()` in the diff). T2 (C3): `src/webmcp.test.ts` and `functions/_lib/mcp/server.test.ts`
assert the field equals `profile.workArrangement`; public `about_steven` still has no
`waitingFromTheSite`. T3 (C2, C4): at merge, the diff stat shows no workflow, API, ask, header
or dependency files and no new `dangerouslySetInnerHTML`.

A future change that feeds `profile` into the assistant needs its own threat model.

**Verdict on the spec: APPROVE.** Low risk; C1 to C4 checked at merge.

## Technical approach (senior-developer)

**Data.** In `src/resume.ts`, add `workArrangement` to `profile` right after
`workAuthorization` (an untyped object literal, so the type follows; `ResumeData.profile` in
`functions/_lib/mcp/proposals.ts` is unaffected). Then the five literal edits of AC-4 to AC-8,
with U+2019 in "Microsoft’s", and nothing else (AC-9).

| File | Change |
|---|---|
| `src/resume.ts` | New `profile.workArrangement`; the five text edits. |
| `src/App.tsx` `renderHome` | Fourth `<span>{profile.workArrangement}</span>` in `.hero-facts`, after location · authorization. Not joined onto the location string. |
| `src/App.tsx` `renderAbout` | `<span>Work arrangement</span><strong>{profile.workArrangement}</strong>` between Based in and Work authorization. |
| `src/App.css` | ≤800px rule `.hero-facts { grid-template-columns: repeat(2, 1fr) }` (was 3). |
| `scripts/resume.mjs` header | `${esc(profile.workArrangement)}<br>` under the location line; fallback the `.facts` Looking for cell if the layout steps down. |
| `src/webmcp.ts` `about_steven` | `workArrangement: profile.workArrangement` beside `workAuthorization`. |
| `functions/_lib/mcp/tools.ts` ~339 and ~621 | `workArrangement` key beside `location` / in the `get_resume` profile; the `location` string stays. |
| `scripts/resume-mail.mjs` `profileLabels` | `workArrangement: 'work arrangement'` (required: the diff walks the labels only, so without it Steven's résumé email would omit the new line). |
| `public/steven-wilssens-resume-2026.pdf` | `npm run resume:build`, no `--force`. |
| Tests | per the test plan. |

**Data flow.** `profile.workArrangement` feeds the React pages (prerendered), the PDF (checked
by `resume-check.mjs` and `src/resume.test.ts`), WebMCP, the MCP tools, and the résumé mail
diff. It appears nowhere else as a literal.

**What stays the same.** `location`, `workAuthorization`, `impact` (with the `~30%` TODO),
recommendations, sources, team size, skills, `csx-data`, `windows-devices-data.points[0]`,
the OG image, the assistant prompt, `review/linkedin.ts`, the contact checks. No D1, endpoint
or dependency change.

**Feasibility risks.**
1. PDF layout: `scripts/resume.mjs` picks the first of four layouts that fits two pages; a
   wider header can push it a step down. Compare the `Layout:` line with main's; if older-role
   first bullets drop, move the line to `.facts` and report it.
2. ATS: no check reads the field; location and authorization stay on their header line, so
   100/100 should hold.
3. `check:recruiter` likely rises: its "Remote, hybrid or on-site, and would you relocate?"
   question is answered once `/about` says remote/hybrid/relocat.
4. Responsive: the 390px screenshot must keep the résumé link, email and LinkedIn above the fold.

**Feasibility verdict: FEASIBLE as written.**

## Test plan (senior-tester)

The new strings are pinned once, as literals, in `src/resume.test.ts`; component and tool
tests compare against `profile.workArrangement`, so they prove the value comes from the data.

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | `src/resume.test.ts` › the exact `workArrangement` string, `location` unchanged | unit |
| AC-2 home | `src/App.test.tsx` › home recruiter-screen test gets `getByText(profile.workArrangement)`; the existing `'Seattle, Washington · US permanent resident (green card)'` assertion stays | component |
| AC-2 /about | `src/App.test.tsx` › About sidebar test: the `aside` contains `profile.workArrangement` | component |
| AC-2 prerender | after `npm run build`: `grep -F "not relocating" dist/index.html dist/about/index.html` | named check |
| AC-2 PDF | `src/resume.test.ts` › `pdfText()` contains `normalize(profile.workArrangement)` | unit (PDF) |
| AC-2 no hard-coded copy | `grep -rn "not relocating" src functions scripts` matches only `src/resume.ts` and tests | named check |
| AC-2 390px | `npm run screenshots -- home about` at 390px vs main; résumé link, email, LinkedIn above the fold | ui-check |
| AC-3 WebMCP | `src/webmcp.test.ts` › `about.workArrangement` is `profile.workArrangement` | unit |
| AC-3 MCP | `functions/_lib/mcp/server.test.ts` › `about_steven` and `get_resume` return `workArrangement` | unit |
| AC-3 mail | `scripts/resume-mail.test.mjs` › an added work arrangement is reported | unit |
| AC-4 | `src/resume.test.ts` › cosmos summary ends with the new sentence, dates unchanged; PDF text contains it | unit |
| AC-5 | `src/resume.test.ts` › windows-quality outcome `toBe` the new text, source "Amit Gupte" | unit |
| AC-6 | `src/resume.test.ts` › the pinned 8-item `windows-devices-data` array with item 4 new; PDF contains it in full | unit + PDF |
| AC-7 | `src/resume.test.ts` › okr-tool `work` = old text + new sentence with U+2019; outcome and source unchanged | unit |
| AC-8 | `src/resume.test.ts` › wilssens-com outcome starts "Live with five sites and about eight family mailboxes, each site" | unit |
| AC-9 | existing csx-data test; `git diff origin/main -- src/resume.ts` and `--name-only` | unit + named check |
| AC-10 | existing `matches src/resume.ts and passes the resume checks` and older-role first-bullet tests; `npm run resume:build` without `--force`; ATS 100 | unit + named check |
| AC-11 | `npm run lint`, `npm run test:coverage`, `npm run build`, `npm run check:recruiter` ≥ main | named checks |

Coverage stays at or above 90% (statements, branches, functions, lines) and every new or
changed file (`src/App.tsx`, `src/webmcp.ts`, `functions/_lib/mcp/tools.ts`) is at 90% or more
on its own. Make `workArrangement` a required field (no optional branch). No gate script changes.

**Verdict on the spec: APPROVE**, with `resume-mail` `profileLabels` added (AC-3/AC-9) and the
apostrophe note fixed.

## Open questions for Steven

1. The `~30%` impact number is backed by `csx-data`, whose bullets do not state it (the
   `TODO(steven)` stays). The new `windows-quality` outcome now states it, and that story
   has `role: 'csx-data'`. Is the TODO resolved, or should a `csx-data` bullet say it?
   Recommendation: treat it as resolved in a follow-up by removing the TODO, since the
   story under that role now explains the number; left untouched here as instructed.
2. `/work` shows "As described by Amit Gupte in his recommendation" under each story with
   a source, and its intro says outcomes stay within what colleagues have said publicly.
   The new `windows-quality` outcome is your wording (adoption by every team, the 30%
   drop), not Amit's. Keep the attribution as instructed, or show it differently?
   Recommendation: keep it now; in a follow-up, let a story mark the outcome as your own
   words so the credit line only appears beside text a colleague said.
3. The assistant prompt (`functions/_lib/ask/agent.ts`) still paraphrases "scaled
   experimentation adoption across Windows". Update it to "hundreds of concurrent
   experiments"? Recommendation: yes, in a follow-up (you said change nothing else).
4. Should the recruiter review and résumé check treat `workArrangement` as a required
   contact fact, like location and work authorization? Recommendation: yes, as a
   follow-up, so the field cannot silently drop off the PDF.
5. `wilssens-com` will say "about eight family mailboxes", but `/building-wilssens`
   (linked from that card) shows the mailbox count from its feed: 3 at the 2026-10-15
   refresh. Which is right, and do they count different things? Recommendation: your
   approved wording ships as is; the pull request flags the mismatch so you either
   confirm the figure or give one exact number (or wording that says what is counted)
   that matches the write-up.
6. The "Ask about Steven" assistant does not read `profile` (its prompt hard-codes
   location), so it cannot answer "Is he open to remote?" though the page now does.
   Recommendation: yes, feed location, work arrangement and availability from `profile`
   in a follow-up through the full team flow (it changes the assistant).
7. Recruiters will ask next: remote across US time zones or Pacific hours only, how much
   travel "coordinated" means, and whether "not relocating" is firm. Recommendation:
   record your answers in the dossier (optional) so the assistant and MCP can give them;
   nothing on the page changes.
8. The work-arrangement line is 75 characters and wraps to three lines in the home fact
   column; a shorter version (for example dropping "Seattle-based," since location is on
   the line above) would read faster. Recommendation: your approved wording ships as is;
   tell us if you want a shorter one later.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE | | Reconciled; open questions 1-8 do not block. |
| Senior recruiter | APPROVE | | Conditions: 390px first screen, PDF 2 pages at ATS 100, PR names the attribution and mailbox risks. |
| Senior designer | APPROVE | | Conditions: the one CSS rule, the PDF header width check. |
| Senior developer | FEASIBLE | | As written. |
| Security engineer | APPROVE | | C1-C4 checked at merge. |
| Senior tester | APPROVE | | `resume-mail` added, apostrophe note fixed. |
