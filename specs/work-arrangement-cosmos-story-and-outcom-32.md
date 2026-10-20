# Work arrangement next to location, and sharper outcomes on four stories

Slug: `work-arrangement-cosmos-story-and-outcom-32` · Branch: `update/work-arrangement-cosmos-story-and-outcom-32` · Status: built
Asked by Steven on 2026-10-20 (approved exact wording, data only): add a work-arrangement field
("Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating.") next to
location on the site and PDF; append "Joined as a consultant from Info Support, then hired
full-time." to the Cosmos summary; reword the `windows-quality`, `okr-tool` and `wilssens-com`
outcomes and one `windows-devices-data` bullet as worded below; change nothing else.

## Problem

Recruiters screen on logistics first: "is he remote, will he relocate, will he travel?" Today
the site and the résumé say only `Seattle, Washington`, so a recruiter for a remote or
out-of-state role has to ask, or guesses and moves on. On a close read, hiring managers meet
three outcomes that are vaguer than what Steven can stand behind (Windows quality has no
number, the OKR tool has no timeline or context, wilssens.com says "the family's mailboxes"),
an experimentation bullet that says "adoption" without scale, and a Cosmos role that overlaps
the Info Support dates (2004) with no explanation. Source: Steven's own word in this request.

## Outcome

A recruiter sees where Steven works and how (remote, hybrid, travel, no relocation) beside his
location on the site and in the PDF, and the four stories and the Cosmos role read with the
concrete facts Steven approved, with no other change to the record.

## Acceptance criteria

Data lives only in `src/resume.ts`; no component hard-codes the wording.

- AC-1: `profile` has a work-arrangement field (e.g. `workArrangement`) whose value is exactly
  `Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating.`
- AC-2: The prerendered home page and `/about` show that text next to the location (the home
  hero facts line and the About "Based in" block), read from `profile`, without JavaScript.
- AC-3: The regenerated PDF (`npm run resume:build`) shows the same text in the contact/header
  block next to the location; `src/resume.test.ts` passes (PDF matches `src/resume.ts`).
- AC-4: Experience `cosmos` summary is exactly `Built and supported software components across
  C# client and Java server systems using CORBA middleware. Joined as a consultant from Info
  Support, then hired full-time.`; its dates stay `Jan 2004 - Dec 2005`, its points unchanged.
- AC-5: Selected work `windows-quality` outcome is exactly `Adopted by every Windows team, and
  behind the roughly 30% drop in issue days across Perfect Day scenarios.`; `source` stays
  `Amit Gupte`; title, context, work, period, role unchanged. Built exactly as Steven worded it
  ("change the outcome to …", "Keep the source", "Change nothing else"); the recruiter's
  attribution concern goes to him as open question 2, and the team does not override his
  explicit instruction. If he picks the recommended option, it is a one-line follow-up.
- AC-6: In `windows-devices-data` points, `Scaled experimentation adoption across Windows,
  significantly reducing the number of features pulled back after release.` is replaced by
  `Scaled experimentation across Windows to hundreds of concurrent experiments, significantly
  reducing the number of features pulled back after release.`, in the same position. The team-size
  bullet (`Led a PM organization of 10 to 20, …`) is byte-identical to main.
- AC-7: Selected work `okr-tool` outcome keeps its existing sentence word for word and adds
  `Built in six months to replace Viva Goals, Microsoft's acquired OKR product, after it was
  retired.` (team's recommendation: new sentence first, existing sentence after, so the outcome
  leads with the fact; typographic apostrophe `’` to match the file's style is acceptable).
  `source` stays `Amit Gupte`.
- AC-8: Selected work `wilssens-com` outcome reads `Live with five sites and about eight family
  mailboxes, each site on its own isolated Worker and database; …` with the rest unchanged.
- AC-9: Nothing else in `src/resume.ts` changes: `git diff main -- src/resume.ts` shows only the
  lines for AC-1, AC-4 to AC-8. The `csx-data` bullets, every `recommendations` quote (Ryan
  Parsell, Amit Gupte included), every `source`, and `impact` are unchanged.
- AC-10: The "roughly 30%" is a number in a selected-work outcome, not in `impact`, so the
  `impact[].backing` rule does not apply to it; it is sourced by Steven's word in this request.
  The existing `impact` entry `~30%` (backing `csx-data`) and its `TODO(steven)` comment stay as
  they are (adding a `csx-data` bullet is out of scope; see open question 1). The recruiter check
  reports no new "unexplained number" finding compared with main.
- AC-11: `npm run resume:build` keeps the ATS score at 100/100 and replaces the PDF without
  `--force`; `npm run check:recruiter` is not lower than main.
- AC-12: No consumer spreads `profile`, so each one that lists profile fields by name gets
  `workArrangement` added by hand, with the value read from `profile` (never retyped):
  - `src/webmcp.ts` (the profile/about payload, ~l.74): `src/webmcp.test.ts` asserts
    `about.workArrangement === profile.workArrangement`.
  - `functions/_lib/mcp/tools.ts`, both `about_steven` spots (the location line ~l.339 and the
    profile object ~l.621): `functions/_lib/mcp/server.test.ts` (owner and public `about_steven`
    cases) asserts the response contains `profile.workArrangement`.
  - `scripts/resume-mail.mjs` `profileLabels`: add `workArrangement: 'work arrangement'`, so the
    email to Steven reports a change to the field.
  - `functions/_lib/ask/prompt.ts`: import `profile` and add one sentence to the `about` text built
    from `profile.workArrangement` (e.g. `Work arrangement: ${profile.workArrangement}`), so the
    assistant can answer "will he relocate?" with the approved line. This is in scope as part of
    "shown on the site". Keep it to that one added line: the rest of the hard-coded `about` text
    (including "based in the Seattle area (Redmond, Washington)") stays as it is.
    `functions/_lib/ask/agent.test.ts` asserts `systemPrompt(...)` contains `profile.workArrangement`.
  `npm run lint`, `npm run test:coverage` (90%+ overall and per changed file), `npm run build` pass.

## Out of scope

- Any other copy, layout or design change; any change to quotes, sources, dates or the team-size
  bullets on `csx-data` and `windows-devices-data` (PR #60). One allowed exception: in
  `src/App.css`, the `@media (max-width: 800px)` `.hero-facts` rule goes from `repeat(3, 1fr)` to
  `repeat(2, 1fr)` (a 2 × 2 grid), because a fourth fact would otherwise wrap alone at 521 to
  800px (Design 1). No other CSS changes.
- Adding a `csx-data` bullet stating the ~30% (follow-up if Steven wants it; open question 1).
- Changing the `windows-quality` source, the "As described by …" line or the `/work` intro
  (open question 2).
- Regenerating the share image (headline and photo unchanged).
- Changes to the assistant prompt or MCP tool descriptions beyond carrying the field (AC-12's one
  added line in `prompt.ts`); reading the assistant's location from `profile` is a follow-up.
- `renderContactBand`, `functions/_lib/review/recruiter.ts` and `scripts/resume-check.mjs`
  (no new missing-field check or finding).

## Recruiter impact (senior-recruiter)

**First ten seconds.** The hero facts line and the PDF header gain the answer recruiters ask
first after location: remote or hybrid yes, travel yes, relocation no. That puts a remote or
out-of-state role in or out of the pile without a call. This is the most useful line in the
change. Risks: (1) at 390px the longer facts line must not push the contact or résumé link
below the first phone slice; the designer checks the first `home` slice and I will tick who,
role, location + authorization, contact and résumé at merge. (2) `Seattle, Washington` next to
`Seattle-based, …` repeats Seattle. Steven approved the exact words, so keep them, but show the
arrangement as its own item (a separate fact or line), not glued onto the location string.
(3) In the PDF, keep `Seattle, Washington` as its own token, so ATS parsers still read the city
and state as the location, and the résumé stays at 2 pages.

**Close read.** Better on balance. The Cosmos line answers the 2004 overlap a sceptical
reader spots in the dates (`resume-check` still asks that question, because it only looks at
dates; expected, not a regression). "Hundreds of concurrent experiments" gives scale where the
bullet said only "adoption". "Built in six months to replace Viva Goals" gives the OKR story
a timeline and context. "About eight family mailboxes" is honest about a small family platform.
All of these are Steven's recorded word in this request, which CLAUDE.md accepts as a source.
None of these numbers is in `impact`, so `backing` does not apply.

**One credibility risk to resolve before the build (CHANGES_REQUESTED).** `/work` prints
"As described by Amit Gupte in his recommendation" under every outcome whose `source` is
Amit Gupte, and the page intro says "outcomes stay within what colleagues have said
publicly" (`src/App.tsx`). AC-5 replaces the whole `windows-quality` outcome, so the one
sentence Amit's quote supports ("the critical data products that measured and elevated
Windows quality") disappears. The page would then credit Amit with "adopted by every Windows
team" and "the roughly 30% drop", and his recommendation says neither. AC-7 has the same
problem on a smaller scale: Amit does not mention "six months" or "Viva Goals". A hiring
manager who clicks through to the recommendation finds the mismatch, and that costs more trust
than the number gains. The spec needs one of these, decided by Steven (the PM adds it as an
open question; I recommend the first):

1. Keep the `windows-quality` outcome as Steven worded it, then append the existing sentence
   `Colleagues describe these as the critical data products that measured and elevated Windows quality.`
   so the attribution points at words Amit actually wrote. For `okr-tool` the existing Amit
   sentence stays, which is acceptable.
2. Or drop `source` from `windows-quality` (it then reads as Steven's own claim, which it is).

Either way, the 30% now appears on `/work` without a role bullet behind it. Open question 1
(a `csx-data` bullet) is the real fix and should come soon, because the home-page `~30%`
already carries a `TODO(steven)` for the same gap.

Keep the "Ask about Steven" answers in mind: once the field exists, "Where is he based, will
he relocate?" should answer with the new line word for word (AC-12). I will ask that on the
preview at merge.

**Baseline (this branch = main, 2026-10-20).**

- `node scripts/resume-check.mjs`: ATS 100/100, 2 pages, 0 errors, 0 warnings; 1 question
  (Cosmos/Info Support overlap). With `--baseline` live: 100 → 100, same as live.
- `npm run check:recruiter`: 50/100 locally, but that is only because `dist/` was not built
  (all five pages and the résumé report show as "not in this deployment"). Main's data on the
  live pages scores **80/100**; that is the bar. At merge I compare against a built `dist/`.

**Verdict on the spec: CHANGES_REQUESTED.** One thing only: add the attribution decision
above (an AC or a Steven question with the team's default). Everything else approved.

## Design (ux-designer)

There is no new component, token or motion. The arrangement shows as its own item next to the
location in three places. All three are plain prerendered text read from `profile.workArrangement`,
in the exact wording Steven approved. The repeated "Seattle" is accepted (recruiter risk 2), and
`Seattle, Washington` stays its own token everywhere. The other edits (Cosmos, the bullet, three
outcomes) are copy changes in the existing components, with no design work.

**1. Home, hero facts (`renderHome` in `src/App.tsx`, `.hero-facts`).** Add a fourth `<span>`
right after the location + authorization span: `<span>{profile.workArrangement}</span>`. Do not
put it inside the third span with a nested span. `.hero-facts span:first-child` would match the
nested span and turn it bold ink. The new span inherits `--muted` at 13px/1.4. The third span keeps
its exact text, so the exact-text match in `App.test.tsx` still holds.

```
1440 (210px column, border-left)        390 (<=520px: one column, border-top)
| Open to: product leadership… (ink)     ─────────────────────────────────
|                                        Open to: product leadership roles…
| Principal · Group PM · led 10…         Principal · Group PM · led 10 to 20…
|                                        Seattle, Washington · US permanent
| Seattle, Washington · US               resident (green card)
| permanent resident (green card)        Seattle-based, open to remote or
|                                        hybrid, and to coordinated travel;
| Seattle-based, open to remote          not relocating.
| or hybrid, and to coordinated
| travel; not relocating.
```

- 1440: about 3 to 4 lines in the 210px column. It sits beside the lede and the actions, and the
  hero grows by about one line.
- 521 to 800px (the `@media (max-width: 800px)` block in `src/App.css`): `.hero-facts` is
  `repeat(3, 1fr)` there, so a fourth item would wrap alone under the first. Change that one
  declaration to `grid-template-columns: repeat(2, 1fr)` for a 2 × 2 grid. This is the only CSS
  change on the site, and it is needed to place the new item (a narrow exception to "no layout
  change").
- 390 and 320: one column, under the existing `<=520px` rule. The block grows by about 3 lines
  and a 12px gap. `.hero-facts` comes after `.hero-actions` in the DOM and on screen, so the
  résumé link, email and LinkedIn do not move in the first phone slice (recruiter risk 1).
- Long text wraps freely: nothing sets `nowrap`, clamps or truncates it. There is no horizontal
  scroll at 320.

**2. About, side note (`renderAbout`, `.side-note`).** Add a pair right after "Based in", in the
existing label and value pattern: `<span>Work arrangement</span><strong>{profile.workArrangement}</strong>`.
It uses the existing styles (17px value, 22px gap). It wraps to about 3 lines in the aside column
at 1440. On the phone the aside stacks under the article as it does today.

**3. PDF header (`scripts/resume.mjs`, `header .contact`).** Insert the arrangement right after
`<strong>Seattle, Washington</strong> · US permanent resident (green card)<br>` and before the email
line: `<span class="arrangement">${esc(profile.workArrangement)}</span>`. It is `--muted` and sits
outside the `<strong>`, and it needs no `<br>` because the span is a block. The header column is
`auto` (max-content), so this 83-character line would widen the column and squeeze the headline.
Add `header .contact .arrangement { display: block; width: 0; min-width: 100%; }`. The line then
wraps (about 2 lines, right-aligned) inside the width the existing contact lines already set. The
developer checks three things: the PDF stays at 2 pages, the headline stays on one line, and the
sentence extracts as one piece of text (ATS). If it reaches 3 pages, bring it back to the team.
Do not use `--force`.

**States and themes.** The data is static, so there is no loading, empty or error state. All
three placements are in the prerendered HTML or the PDF and do not need JavaScript. In light and
dark the text uses `--muted` on `--paper`, the same pair as the neighbouring facts, which already
passes AA at 13px. The PDF is light only.

**Accessibility.** The change is plain text with no control. Keyboard and focus are unchanged,
and nothing moves for reduced motion. A screen reader reads the hero facts in DOM order (open to,
scope, location, arrangement) and reads the About pair label first, then value, like its
neighbours. axe must stay clean.

**Screenshots at merge, against main.**
- `home` and `about` at 1440 and 390 (`--slices`), light and dark.
- `home` at 320 and at about 700px (the 2 × 2 grid).
- `experience` and `work` for the copy edits.
- Page 1 of `public/steven-wilssens-resume-2026.pdf`.

**Verdict on the spec: APPROVED** for design, with the three placements above. The recruiter's
attribution point needs no layout change under either option. Option 1 adds one sentence to a
`/work` outcome card, which already wraps freely.

## Threat model (security-engineer)

**Entry points and data.** None new. The change adds one fixed string (`profile.workArrangement`)
and edits existing fixed strings in `src/resume.ts`, written by Steven and reviewed in the pull
request. No route, tool, D1 table, binding, secret, dependency, workflow, header or third-party
script changes. The data is already public: the site, the PDF, the public MCP and WebMCP serve
`profile`. The new line says where Steven works and how, which he approved for publication. The
`wilssens-com` "about eight family mailboxes" wording adds a count, but no names or addresses.

**Where the string goes.** Home and `/about` render it as a JSX text child, which React escapes.
The PDF template must pass it through the existing `esc()` in `scripts/resume.mjs`, as the design
says. Consumers pick `profile` fields one by one (`src/webmcp.ts` ~l.74,
`functions/_lib/mcp/tools.ts` ~l.339 and ~l.621). So the field reaches WebMCP and the public MCP
only where the developer adds it, and the assistant does not get it until its prompt is changed.
That is fine: it is public, non-personal data in the same read-only outputs as `location`. It must
not be added to a write-tool path or to anything the private dossier feeds.

**Abuse cases.** Stored XSS: not reachable, because the string is fixed, written by Steven and
escaped everywhere it is shown. Prompt injection through the assistant or MCP context: not
reachable, because the text is Steven's own plain facts. Privacy: no new personal data; his travel
and relocation preference is a disclosure he approved.

**Required controls (already in place; keep them).**
- No `dangerouslySetInnerHTML` for the new text; React text children only.
- `esc(profile.workArrangement)` in the PDF HTML.
- The public MCP and WebMCP get only `src/resume.ts` data; this change adds no dossier entry to them.

**Tests that prove them (for the test plan).** The exact-text assertions for AC-2
(`App.test.tsx` / prerender) show it renders as text. `src/resume.test.ts` (AC-3) shows the PDF
carries the exact string. Where the field is added to WebMCP or MCP outputs, their tests assert
the exact value. Nothing security-specific beyond that.

**Verdict on the spec: APPROVED.** No new attack surface; a data-only change of public facts.

## Technical approach (senior-developer)

Feasible as written. It is a data change plus three small render changes. There is no new
dependency, no migration and no Functions behaviour change.

**Data flow.** `src/resume.ts` `profile.workArrangement` (an inferred object literal, so there is
no type to widen: `typeof profile` picks it up) → prerendered `App.tsx` (home, About) →
`scripts/resume.mjs` (PDF) → the consumers that already list profile fields by name (below).
Consumers that spread or stringify `profile` get it for free.

**Files to change.**
- `src/resume.ts`: add `workArrangement` right after `workAuthorization`. Make the AC-4 to AC-8 edits
  in place (`cosmos.summary`, one `windows-devices-data` point, the `windows-quality`, `okr-tool`
  and `wilssens-com` outcomes). Use `’` in "Microsoft’s" to match the file.
- `src/App.tsx`: `renderHome` gets a 4th `<span>` in `.hero-facts`. `renderAbout` gets a
  `Work arrangement` pair after "Based in" (Design 1 and 2). Leave `renderContactBand` as is (not in the ACs).
- `src/App.css`: the `@media (max-width: 800px)` `.hero-facts` rule changes from `repeat(3, 1fr)` to `repeat(2, 1fr)`.
- `scripts/resume.mjs`: add the `.arrangement` span after the location line, plus the
  `header .contact .arrangement` rule (Design 3). The `width: 0; min-width: 100%` trick works in
  Chromium's print layout. The headline sits in the `1fr` column, so it is not squeezed.
- `public/steven-wilssens-resume-2026.pdf`, `public/resume-report.json` (if tracked): regenerate with `npm run resume:build`. Never edit them by hand.
- Consumers that list fields by name: `src/webmcp.ts:74` (profile tool payload),
  `functions/_lib/mcp/tools.ts:339` and `:621` (the location line and the profile object), and
  `scripts/resume-mail.mjs:123` `profileLabels` (add `workArrangement: 'work arrangement'`). Without
  that label, `diffFields` iterates labels only, so the email to Steven would not mention the
  new field. Optional, not required: `functions/_lib/review/recruiter.ts:61` (the missing-field
  check) and `scripts/resume-check.mjs:134` (a `contact-arrangement` warn, lens `site`, not `ats`,
  so the score cannot move). I recommend leaving both alone in this change.
- **Gap in AC-12 / the recruiter's "Ask about Steven" check:** the site assistant does **not** read
  `profile`. `functions/_lib/ask/prompt.ts:40` has its own hard-coded `about` text ("based in the
  Seattle area (Redmond, Washington)") and imports no `profile`. As written, AC-12 is met
  only for WebMCP and the MCP. For the assistant to answer "will he relocate?" with the
  approved line, `prompt.ts` must import `profile` and add one sentence built from
  `profile.location`, `profile.workAuthorization` and `profile.workArrangement` to the `about`
  section. That is one line plus a test in `functions/_lib/ask/prompt.test.ts`. I recommend it,
  and it fits AC-12's "carry the field without per-consumer wording". The PM should state it in AC-12 or move it out of scope.
- Tests: `src/App.test.tsx` (home hero and About show the exact `profile.workArrangement` text),
  `src/webmcp.test.ts`, the MCP tools test for the profile payload, and the `resume-mail`
  diff test if one exists for profile labels. `src/resume.test.ts` covers the PDF.

**Risks.**
- *PDF pages.* The header grows by about 2 lines at 8.6pt (roughly 22px). Page 1 has the most
  slack after the latest-role bullets. The bullet edit adds about 4 words, and Cosmos (page 2)
  adds one sentence. If `resume:build` reports 3 pages, stop and bring it back. No `--force`, no font-size games.
- *Text extraction.* The wrapped line comes out of the PDF with a line break. `normalize` in
  `resume-check.mjs` collapses whitespace, so a substring match on the sentence still holds.
  `Seattle, Washington` stays its own `<strong>`, so `contact-location` (ATS) is unaffected.
  The ATS score should stay 100.
- *Checks.* `resume-check` scans dates and `impact` for questions, not `selectedWork`, so "roughly 30%"
  and "six months" add no unexplained-number finding (AC-10). The Cosmos overlap question stays
  (`resume.test.ts:29` expects it).
- *Prerender and hydration.* All of it is static text from the same module on the server and the
  client, so there is no mismatch risk.
- *Share image.* `og-image.mjs` uses `profile.location` and the headline only, so it does not change.

**On the recruiter's attribution concern (`windows-quality`, source Amit Gupte).** Engineering
can build any of the options in minutes. Each is a one-line data change, with no component
change. But this is a content decision, and Steven has already made it explicitly: "change the
outcome to …", "Keep the source", "Change nothing else." Option 1 (append the Amit sentence)
departs from his exact outcome wording. Option 2 (drop `source`) contradicts "Keep the source".
Changing the generic "As described by …" line or the `/work` intro ("outcomes stay within what
colleagues have said publicly") is a component copy change that affects every card, which is
outside "change nothing else". My view: build AC-5 exactly as Steven worded it, and put the
recruiter's point to him once as an open question, with the mismatch spelled out and option 1
as the team's suggested wording. If he picks it, it is a one-line follow-up. The team should not
override his explicit instruction on its own. The recruiter's verdict then depends on that
answer, not on the build.

## Test plan (senior-tester)

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | `src/App.test.tsx` › new `it('tells a recruiter how Steven works next to where he lives')`: asserts `profile.workArrangement` is the literal approved sentence (a typo in the data fails the test). The literal sentence goes only in the test, never in a component. | unit |
| AC-2 (DOM) | Same test: on `/`, `getByText(<literal>)` is its own element inside `.hero-facts` and is a sibling of `Seattle, Washington · US permanent resident (green card)`. The existing exact-text assertion stays as it is, so gluing the text onto the location string fails. On `/about`, the term `Work arrangement` is followed by `<strong>` holding the literal. | component |
| AC-2 (no JS) | New `src/prerender.test.tsx` (`// @vitest-environment node`) › `it('puts the work arrangement in the prerendered home and About HTML')`: calls `render('/')` and `render('/about')` from `src/entry-server.tsx` and checks that the HTML string contains the sentence. There is no SSR test today; this one fails if the field were only filled in after hydration. | unit (node) |
| AC-3 | `src/resume.test.ts` › new `it('prints the work arrangement beside the location in the PDF header')`: `extractPdf(resumePath)` gives page 1 text, and its normalized text contains `profile.location` and `profile.workArrangement` as separate pieces, with location first. Pages stay at most 2. Required because `resume-check.mjs` does not look for the arrangement, so the existing drift test would pass without it. Plus `npm run resume:build` (2 pages, ATS 100). | unit + check |
| AC-4 | `src/App.test.tsx` › new `it('explains the Cosmos years on the experience page')`: on `/experience`, `getByText(/Joined as a consultant from Info Support, then hired full-time\./)` and `Jan 2004 - Dec 2005`. PDF: the same new `resume.test.ts` case checks that the full Cosmos summary is in the PDF text. `resume-check` compares only the first 50 characters of an older role's summary, so a missing tail would not be caught there. | component + unit |
| AC-5 | Extend `App.test.tsx` › `'shows the selected work from the data and AI years, each case with its source'`: on `/work`, the outcome text in the `Windows quality…` card is the approved sentence. Whatever source line the recruiter's open attribution decision leaves (Amit's sentence appended, or no source) is asserted inside that card. | component |
| AC-6 | `App.test.tsx` › new `it('gives experimentation its scale on the latest role')`: on `/experience`, `hundreds of concurrent experiments` is present and `Scaled experimentation adoption` is absent. Position and the team-size bullet: `resume-check` `point-windows-devices-data` (first 60 characters of every bullet of the two latest roles) via `src/resume.test.ts` › `'matches src/resume.ts…'`, plus the `git diff` check in AC-9. | component + unit |
| AC-7 | Same `/work` test: the OKR card's outcome starts with `Built in six months to replace Viva Goals` and still contains the old sentence word for word (read from `selectedWork` in the test, not retyped). | component |
| AC-8 | Same `/work` test: the `wilssens.com` card contains `about eight family mailboxes` and no longer contains `the family's mailboxes`. | component |
| AC-9 | Named check: `git diff origin/main -- src/resume.ts` shows only the AC-1 and AC-4 to AC-8 lines. I read it at merge, because no unit test can prove that nothing else changed. The existing `App.test.tsx` and `resume.test.ts` assertions on quotes, `impact` (`250%+`, `1.6B+`) and sources stay green. | review check |
| AC-10 | `src/resume.test.ts` › `'raises the questions the dates and numbers leave open'` still asserts that no question is `about === 'impact'`. Plus `npm run check:recruiter` against built `dist/`: no new unexplained-number finding compared with main. | unit + check |
| AC-11 | `npm run resume:build` without `--force` (ATS 100/100, PDF replaced). `npm run check:recruiter` at or above main's 80/100 on built `dist/`. CI `gates`. | check |
| AC-12 | `src/webmcp.test.ts`: add `expect(about.workArrangement).toBe(profile.workArrangement)`. `functions/_lib/mcp/server.test.ts` (the `about_steven` cases at lines ~98 and ~344, owner and public): the response includes `profile.workArrangement`. Site assistant: `functions/_lib/ask/agent.test.ts` › `systemPrompt(...)` `toContain(profile.workArrangement)`. Plus `npm run lint`, `npm run test:coverage`, `npm run build`. | unit + check |

**Edge cases.** 390/320px wrapping and the 2×2 grid at 521–800px are checked with the
designer's screenshots, not in jsdom. A typographic `’` in AC-7: the test reads the old
sentence from `selectedWork`, and the new sentence is matched up to `Viva Goals`, so either
apostrophe passes. Dark theme does not apply (text only).

**Findings for the developer (the AC-12 assumption does not hold).**
- `major`: no consumer spreads `profile`. `src/webmcp.ts:69-77`, `functions/_lib/mcp/tools.ts:339`
  and `:621`, and `scripts/resume-mail.mjs` `profileLabels` each pick fields one by one, so
  each needs `workArrangement` added explicitly, or it never reaches them.
- `major`: `functions/_lib/ask/prompt.ts` does not import `profile` at all. Its `about` text
  hard-codes "based in the Seattle area (Redmond, Washington)". Unless the prompt reads
  `profile.workArrangement`, the assistant cannot answer "will he relocate?" with the approved
  line (the recruiter's merge check). Reading the location from `profile` too is a scope
  question for the PM.
- `minor`: `scripts/resume-check.mjs` does not check the arrangement in the PDF. The plan covers
  this in `resume.test.ts` rather than changing the gate script. If the developer adds a
  `contact-arrangement` finding there instead, `scripts/resume-check.test.mjs` needs a case for it.

Coverage stays at or above 90% (statements, branches, functions, lines) and every new
or changed file is at 90% or more on its own. The only production files that change are
`src/resume.ts`, `src/App.tsx`, `src/App.css`, `src/webmcp.ts`, `scripts/resume.mjs`,
`functions/_lib/mcp/tools.ts` and `functions/_lib/ask/prompt.ts`. Each is already covered by
the tests above. No new coverage exclusion is allowed.

**Verdict on the spec: APPROVED for test,** provided AC-12 lists the consumers above
explicitly (PM/developer). Every AC has a test or a named check that fails if the AC breaks.

## Open questions for Steven

None block this change; the team proceeds with its recommendation.

1. Should a `csx-data` bullet state the ~30% drop in issue days, so the `impact` number and the
   new outcome have a role bullet behind them and the `TODO(steven)` can go? Recommendation: yes,
   in a follow-up with your exact wording; this change leaves the bullets alone as you asked.
2. On `/work`, the `windows-quality` card keeps `source: Amit Gupte`, so it prints "As described
   by Amit Gupte in his recommendation" under your new outcome ("Adopted by every Windows team,
   and behind the roughly 30% drop in issue days across Perfect Day scenarios."), but Amit's
   recommendation says neither "every Windows team" nor "30%"; a hiring manager who checks it
   finds the mismatch. Which do you want? (1) keep your outcome and append `Colleagues describe
   these as the critical data products that measured and elevated Windows quality.` (words Amit
   wrote); (2) drop `source` so it reads as your own claim; (3) leave it as built.
   Recommendation: option 1. Built as you worded it until you answer; either change is a
   one-line follow-up. (The `okr-tool` card is fine: Amit's sentence stays beside the new one.)

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVED | | Reconciled: AC-5 built as Steven worded it, attribution to Steven as open question 2 (recommend option 1); AC-12 names each consumer incl. one line in `prompt.ts`; 2×2 hero-facts grid at <=800px is the one allowed CSS exception |
| Senior recruiter | CHANGES_REQUESTED → resolved as open question 2 | | Attribution of the `windows-quality` outcome to Amit Gupte put to Steven with option 1 recommended (an open question, as the recruiter asked as one alternative); not yet re-read by the recruiter. Merge check asks the assistant "will he relocate?" on the preview |
| Senior designer | APPROVED | | Home hero 4th fact (+2×2 at <=800px), About "Work arrangement" pair, PDF header line that wraps without widening |
| Senior developer | APPROVED (feasibility) | | Built as specified: ATS 100 → 100, 2 pages, PDF replaced without `--force`; `check:recruiter` 80/100 (main's live data 80/100); lint, `test:coverage` (99.5% statements, every file at 90%+) and build green |
| Security engineer | APPROVED | | No new entry point; fixed public text, escaped by React and by `esc()` in the PDF |
| Senior tester | APPROVED | | Every AC mapped. AC-12 must name each consumer (webmcp, MCP `about_steven`, ask prompt, resume-mail) because none of them spreads `profile` |
