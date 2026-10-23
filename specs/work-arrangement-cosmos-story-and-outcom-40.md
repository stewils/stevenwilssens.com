# Work arrangement, the Cosmos story and the outcomes behind two projects, in Steven's approved words

Slug: `work-arrangement-cosmos-story-and-outcom-40` · Branch: `update/work-arrangement-cosmos-story-and-outcom-40` · Status: built
Asked by Steven on 2026-10-21 (approved proposals via the MCP; replaces PR #65).

## Problem

Readers: recruiters and hiring managers first (screening calls, comparing candidates),
then peers reading the selected work.

- **Work arrangement is missing.** The site and PDF say where Steven is (`profile.location`,
  "Seattle, Washington") but not whether he will work remote, hybrid, travel or relocate.
  That is one of the first screening questions; today a recruiter has to email or ask the
  assistant, and the assistant has nothing to answer from.
- **Cosmos overlaps Info Support** (Jan 2004 - Dec 2005 vs Jan 2001 - Dec 2004) with no
  explanation; a careful reader sees two jobs at once.
- **Three outcomes undersell or blur the work**: the Windows quality outcome is generic;
  "Scaled experimentation adoption" has no scale; the OKR tool's "What I did" does not say
  what it replaced or how fast; "the family's mailboxes" gives no size.

Source: Steven's approved proposals (exact wording below), decided 2026-10-21. This
replaces PR #65, which put the Viva Goals sentence in the outcome; Steven decided it is his
own words and belongs in What I did.

## Outcome

A recruiter sees on the About page, the PDF header and in the assistant's answers that
Steven is Seattle-based, open to remote or hybrid and coordinated travel, not relocating;
and reads the Cosmos, Windows quality, experimentation, OKR tool and wilssens.com entries
in Steven's approved words. Nothing else about Steven changes.

## Acceptance criteria

All text is exact, including the typographic apostrophe `’` where shown. All edits are in
`src/resume.ts`; the PDF is regenerated with `npm run resume:build` (not `--force`).

- AC-1: `profile.workArrangement` equals
  `Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating.`
  `profile.location` stays `Seattle, Washington`.
- AC-2: The prerendered `/about` side note shows the work arrangement as its own labelled
  row next to "Based in" (label and placement per Design), and the text appears in the
  built `dist/about/index.html` without JavaScript.
- AC-3: The work arrangement sentence is on page 1 of
  `public/steven-wilssens-resume-2026.pdf`, before `Summary` (in the facts strip's
  "Looking for" cell, per Design), and the PDF stays 2 pages.
- AC-4: The assistant's prompt (`functions/_lib/ask/prompt.ts` who-block), the WebMCP
  profile tool (`src/webmcp.ts`) and the MCP profile/fit output
  (`functions/_lib/mcp/tools.ts`, where location and work authorization go) include the
  work arrangement; a test asserts each contains the exact sentence.
- AC-4b: The "never infer … willingness to relocate" rules (`functions/_lib/ask/prompt.ts`
  rules, `functions/_lib/mcp/tools.ts` `check_fit.howTo` and `publicInstructions`) are
  reworded so the assistant may quote the stated work arrangement verbatim and still never
  infers beyond it (remote, hybrid, travel, relocation), mirroring the work-authorization
  clause; no other rule is loosened (security's conditions in the Threat model apply). A
  test asserts each rule text allows quoting the stated arrangement and still forbids
  inferring beyond it.
- AC-4c: `scripts/resume-mail.mjs` `profileLabels` has `workArrangement: 'work arrangement'`,
  so the deploy email to Steven reports a change to the field; `scripts/resume-mail.test.mjs`
  covers it in the profile case.
- AC-5: The `cosmos` summary is
  `Built and supported software components across C# client and Java server systems using CORBA middleware. Joined as a consultant from Info Support, then hired full-time.`
  Its dates stay `Jan 2004 - Dec 2005`; its points are unchanged.
- AC-6: The `windows-quality` outcome is
  `Adopted by every Windows team, and behind the roughly 30% drop in issue days across Perfect Day scenarios.`
  Its `source` stays `Amit Gupte`; title, period, context and work are unchanged.
- AC-7: In `windows-devices-data`, the bullet
  `Scaled experimentation adoption across Windows, significantly reducing the number of features pulled back after release.`
  is replaced, in the same position, by
  `Scaled experimentation across Windows to hundreds of concurrent experiments, significantly reducing the number of features pulled back after release.`
  `src/resume.test.ts` expects the new bullet; the other seven bullets (including the
  team-size bullet) are byte-identical to main.
- AC-8: The `okr-tool` `work` is
  `With a member of my team, ideated and stood up a working replacement from scratch using AI coding tools, rather than waiting for a procurement cycle. Built in six months to replace Viva Goals, Microsoft’s acquired OKR product, after it was retired.`
  Its `outcome` and `source` (`Amit Gupte`) are byte-identical to main.
- AC-9: The `wilssens-com` outcome reads
  `Live with five sites and about eight family mailboxes, each site on its own isolated Worker and database; the design decisions are written up for hiring managers.`
  This is Steven's approved wording, built as instructed; the recruiter's concern that
  `/building-wilssens` shows 3 mailboxes is Open question 6, not a merge condition.
- AC-10: Nothing else changes: `git diff main -- src/resume.ts` touches only the lines for
  AC-1, AC-5 to AC-9; every recommendation, quote, `source`, `impact` entry (including the
  `~30%` item and its `TODO(steven)`), the csx-data bullets and the team-size bullets are
  unchanged. A test or the diff review confirms it.
- AC-11: `src/resume.test.ts` passes (PDF matches `src/resume.ts`); the résumé ATS score is
  not lower than main's; `npm run check:recruiter` is not lower than main's;
  `npm run lint`, `npm run test:coverage` (90% overall and per changed file) and
  `npm run build` pass.

## Out of scope

- Any change to the team-size bullets (csx-data, windows-devices-data), to any quote,
  recommendation or `source`, and to the `impact` list or its `~30%` `TODO(steven)`.
- Changing how a `source` is labelled on the Work page ("As described by … in his
  recommendation") — see Open question 1; a follow-up if Steven agrees.
- Showing the work arrangement on the home hero or the contact band (the hero facts are
  already dense on a phone); a follow-up if the recruiter or designer asks for it.
- Adding `workArrangement` to the MCP About/résumé proposals (`ResumeData`), the LinkedIn
  comparison or the recruiter review's required fields; a follow-up so Steven can edit the
  field through the MCP. (The `resume-mail.mjs` label is in scope, AC-4c: a label, not a
  fact.)
- The share image (headline and photo unchanged).
- No orchestration change, so `/building-this-site` is not touched.

## Recruiter impact (senior-recruiter)

**First ten seconds (home, 390px): unchanged.** Nothing on the home hero moves; who
Steven is, the role, Seattle plus green card, contact and the résumé link stay where
they are. Keeping the work arrangement off the hero (Out of scope) is acceptable: the
hero already answers "where can he work" with location and authorization, and the new
line reaches the reader where the screening question is asked: About, page 1 of the PDF
and the assistant.

**Close read, change by change**

| Change | What it does for a recruiter | Risk |
|---|---|---|
| Work arrangement (About, PDF page 1, assistant, MCP) | Answers the second screening question (remote, hybrid, travel, relocation) without an email. "Not relocating" is a filter, and an honest one: it saves a wasted screen on both sides. The PDF is what gets forwarded, so the line on page 1 is the change that counts most. I agree with Design's placement in the "Looking for" cell: it reads as one thought there. | Page 1 grows by about two lines and could push to a third page (AC-3 guards it). The repeated "Seattle" on About is fine because each row is labelled. "Coordinated travel" is unusual phrasing but clear enough; accepted as Steven's words. |
| Cosmos: "Joined as a consultant from Info Support, then hired full-time." | Explains the 2004 overlap that `resume-check` asks about today; a sceptical reader no longer sees two jobs at once. Also shows a client converting a consultant into a hire, which is a credibility signal. | The dates still overlap by a full year (Info Support runs to Dec 2004). The sentence covers that, but the checker's date question will probably still be listed (it is a question, not a scored finding). Nothing to fix in this PR. |
| windows-quality outcome | Replaces a generic outcome with adoption and a result. | **Credibility.** The card prints "As described by Amit Gupte in his recommendation" under it, and his text says neither "every Windows team" nor ~30%. A hiring manager who clicks through finds a quote that doesn't say this, and that looks worse than having no number. The ~30% also has no csx-data bullet (impact TODO). Built as instructed, but I hold it as Open questions 1 and 2. The source label fix should be the first follow-up, not a someday. |
| windows-devices-data bullet: "hundreds of concurrent experiments" | Gives the experimentation claim a scale, and a hiring manager reads it as platform-level. Drops the weaker word "adoption". | "Hundreds" is a range, not a number, so it isn't an unexplained metric for the checker. A recruiter will ask "how many, and how many teams?". Steven should have a figure ready (dossier, Open question 3). "Significantly reducing" is still unquantified; unchanged from main. |
| okr-tool work: built in six months to replace Viva Goals | A recognisable product name and a timeframe make the story concrete, and the name is a keyword. | The same "As described by Amit Gupte" label sits under the card. His text says "rapidly"; "six months" and "Viva Goals" are Steven's own words. That's lower risk than windows-quality because it is the What I did field, but it is the same follow-up. |
| wilssens-com: "about eight family mailboxes" | Gives the hosting claim a size. | **Contradiction one click away.** The card links to `/building-wilssens`, whose stats show `mailboxes` from `src/articles/wilssens/feed.json` = **3** (as of 2026-10-15) and then the live API. "About eight" next to a live "3" reads as inflation. Before merge, either the feed is confirmed to count something else (Zoho org mailboxes vs family members), or Steven confirms the live number has reached about eight. If neither, the card should say "the family’s mailboxes" as on main. **This is a merge condition for my sign-off.** |

**Pushback on the PM.** The ask is Steven's approved wording, and most of it helps the
reader decide. Two items help the story more than the decision: the ~30% under someone
else's name, and a mailbox count the write-up contradicts. I don't block the spec on
the first, because Steven chose it and the PM recorded it as Open questions 1 and 2. I
do require the second to be reconciled before merge. Question for Steven (for the PM to
carry into Open questions): *the card will say "about eight family mailboxes", while
`/building-wilssens` shows 3 from its feed and then the live count. Which is right, and
do they count the same thing?* Recommendation: make the two agree before merge, and keep
main's wording if the live count is not about eight.

**What a recruiter will ask that this should answer:** "Would he relocate for the right
role?" (answered: no). "Remote only, or hybrid in Seattle?" (answered: either). "Is he
available now?" (already `profile.availability`). "How many experiments, how many
teams?" (needs Steven's number in the dossier).

**Baseline (2026-10-22, this branch = main):**
- `node scripts/resume-check.mjs`: **ATS 100/100**, 2 pages, 0 errors, 0 warnings; one
  question (Cosmos and Info Support overlap).
- `npm run check:recruiter`: **80/100** for main's data on the live pages (the reference
  the gate compares with). The local run printed 50/100 only because there is no `dist/`
  yet (every page "not in this deployment"). Compare the built branch with 80.

**Bar for the build:** ATS stays 100/100 on 2 pages (no `--force`). `check:recruiter`
is not below main, with no new high finding and every new medium explained. The home
first screen at 390px is unchanged. The new sentence appears on page 1 of the PDF text
and in `dist/about/index.md`. The assistant answers "Will he relocate / work remote?"
from `workArrangement` on the preview. The wilssens-com mailbox figure agrees with the
write-up.

**Verdict on the spec: APPROVED with one merge condition.** The mailbox figure must agree
with `/building-wilssens` (or revert to main's wording). Open questions 1 and 2 stay
recorded as follow-ups.

## Design (ux-designer)

One new piece of UI: a labelled work-arrangement line. Everything else is new text in
existing components with no layout change.

**Where the line goes**

| Surface | Decision | Why |
|---|---|---|
| About side note | New row `Work arrangement` directly after `Based in`, before `Work authorization` | The side note is the site's labelled fact list; the three "can we hire him here" facts sit together |
| PDF | Second line of the **Looking for** cell in the facts strip under the header, not in the right-aligned contact block | The contact block is an `auto` grid column (`header { grid-template-columns: 1fr auto }`); its widest line today is about 62 characters. An 82-character sentence widens that column by a third and squeezes the name and headline, or wraps ragged-right. The facts strip is part of the header area a recruiter reads first, and "what he wants, when, and how" reads as one thought |
| Home hero facts | No change | Three short facts at 13px that stack on a phone (`@media (max-width: 520px)`); an 82-character fourth fact would be the longest thing in the hero |
| Contact band | No change | Its sentence already gives availability, location and authorization; another clause makes it a run-on. A follow-up if `site_questions` keeps asking |

PM: AC-3 says "in the header area (with location and work authorization)". Please read it
as "in the header or the facts strip directly under it" (or reword it so); the test can
assert the sentence is in the PDF text on page 1, before `Summary`.

**About side note (desktop 1440 and phone 390, light and dark)**

```
 Desktop (side column, ~300px)        Phone (full width, below the text)
 | MOST RECENTLY                       | BASED IN
 | Principal Group PM, Microsoft       | Seattle, Washington
 | LOOKING FOR                         | WORK ARRANGEMENT
 | Product leadership roles ...        | Seattle-based, open to remote or
 | BASED IN                            | hybrid, and to coordinated travel;
 | Seattle, Washington                 | not relocating.
 | WORK ARRANGEMENT                    | WORK AUTHORIZATION
 | Seattle-based, open to remote       | US permanent resident (green card)
 | or hybrid, and to coordinated
 | travel; not relocating.
 | WORK AUTHORIZATION
 | US permanent resident (green card)
```

- Markup: the existing pair, `<span>Work arrangement</span><strong>{profile.workArrangement}</strong>`.
  No new CSS, class or token: `.side-note span` (DM Mono 11px, `--green`, uppercase) and
  `.side-note strong` (17px, `margin-bottom: 22px`). Three lines at desktop, two to three
  on a phone; about 80px added to the side note.
- Copy: label `Work arrangement`; value verbatim from `profile.workArrangement`, trailing
  period included (it is a sentence, and transforming it in the component would drift from
  what the PDF and the assistant say). The repeated "Seattle" under `Based in` is
  accepted: each row stands alone when scanned.
- States: static, prerendered text, identical without JavaScript. No empty state: the
  field is required in `profile`, so the row always renders. Long content wraps inside the
  column; no `white-space: nowrap`, so nothing overflows at 320px.
- Accessibility: no new control, so the keyboard path and focus order are unchanged. Read
  order is label then value, like the other rows. Contrast reuses tokens that already pass
  in both themes. No motion.

**PDF facts strip**

```
LOOKING FOR                         SCOPE                  BACKGROUND
Product leadership roles ... ·      Led teams of ...;      Product leader since 2008, ...
available now                       telemetry from 1.6B+
Seattle-based, open to remote or
hybrid, and to coordinated travel;
not relocating.
```

- `<div><span class="mono">Looking for</span>… · available now<br>${esc(profile.workArrangement)}</div>`:
  same ink and size as the cell, no new class. The strip grows by about two lines (~24pt);
  check the résumé keeps its page count (AC-3) and that `compact` does not switch on where
  it did not before.

**Text-only changes, no layout change**: the Cosmos summary (Experience timeline
`.timeline-body p`, PDF early roles), the `windows-quality` and `wilssens-com` outcomes and
the `okr-tool` "What I did" (Work page `.work-list dd`, max-width 720px), and the reworded
experimentation bullet (Experience timeline `li`, PDF role bullets). Each grows by a line
or two at most and wraps in its existing container.

**To check once built** (screenshots branch vs main, `--slices`): `home` (must be
unchanged), `about`, `experience`, `work`, at 1440 and 390 in light and dark, plus `about`
at 320 (reflow). On About: the new row sits between `Based in` and `Work authorization`
with the same 22px rhythm, wraps without overflow, label in green mono and value in ink in
both themes. On Experience and Work: no horizontal scroll, no lone word on a last line that
breaks a card's rhythm. PDF page 1 rendered to PNG (`pdftoppm -r 110 -f 1 -l 1`), branch vs
main: header unchanged, facts strip cells top-aligned, page count unchanged. No admin part
changes.

## Threat model (security-engineer)

**Entry points and data.** None new. No route, tool, binding, secret, dependency or
workflow changes. The new data is one static string, `profile.workArrangement`, that
Steven wrote and approved. It sits in `src/resume.ts` and ships in the bundle. It is
already public by intent (About, PDF, assistant, WebMCP, public `/mcp`). It holds no PII
beyond the city that `profile.location` already publishes, and nothing about family or
colleagues. The "about eight family mailboxes" count says nothing about who they are; no
names, addresses or domains are added.

**Where the string goes, and the control at each sink**

| Sink | Risk | Control (exists or required) |
|---|---|---|
| PDF template, `scripts/resume.mjs` (HTML put together as a string and rendered in Chromium) | HTML injection if the field is interpolated raw. The value is static, but a later MCP proposal could make it writable | Required: interpolate as `profile.workAuthorization` is today, i.e. `esc(profile.workArrangement)` (`esc` covers `& < > "`). Never raw |
| `/about` side note (React) | XSS | React text node, `<strong>{profile.workArrangement}</strong>`, no `dangerouslySetInnerHTML` (`src/resume.test.ts` already asserts this for the component) |
| Assistant who-block, `functions/_lib/ask/prompt.ts` line 1 | Prompt-structure spoofing: a line break or marker in the value could pose as a prompt line | Static, author-controlled. Required: the value is a single line with no markup. A test asserts `workArrangement` has no `\n`, `<`, `>`, `[` or backtick (the same bar as the About copy's plain-text validator). Add `workArrangement` to `WhoData` |
| WebMCP `src/webmcp.ts`, MCP `functions/_lib/mcp/tools.ts` (profile and fit output, public and private) | Exposure | Public data, returned as JSON fields; no new tool and no change to authorization |
| `/about` Markdown copy (`dist/about/index.md`) | Markdown injection | Plain sentence; the prerender's existing handling applies |

**Abuse cases considered**
- *Prompt injection via the field:* only through a commit to `src/resume.ts`. That path
  already passes the PR review and `gates`, so there is no new attacker path.
- *MCP writes to the field:* out of scope, and correctly so. `ResumeData` in
  `functions/_lib/mcp/proposals.ts` and `aboutFields` do not get `workArrangement`, so no
  proposal or `request_site_update` can set it in this change. The follow-up that makes it
  editable (Open question 5) must, in its own threat model: run the value through the
  plain-text validator (`checkAboutText` rules: one line, no markup or hidden characters,
  a length cap of 160 characters, say), keep it behind the keyed `/mcp/<key>` only, and
  keep the `esc()` and React-text sinks above.
- *Integrity (not a vulnerability, recorded for the follow-up):* the About guard in
  `functions/_lib/mcp/about.ts` (line 87) checks a sentence with `relocat…` only against
  `profile.location`. An About proposal saying "open to relocating" that names Seattle
  would pass and contradict `workArrangement`. The follow-up should add a side-note rule
  for `remote|hybrid|on-site|relocat\w*|travel` that checks against `workArrangement`.
  It does not block this change: proposals come only from Steven's keyed workspace, and he
  approves each one.
- *Assistant rules (AC-4b):* rewording "never infer willingness to relocate" must still
  forbid inference beyond the stated sentence: quote `workArrangement` verbatim, never
  extend it (no "would relocate for the right role", no "open to on-site").

**Tests that prove the controls (for the test plan)**
- T-S1: `scripts/resume.mjs` interpolates `profile.workArrangement` only through `esc()`.
  Either a source assertion (every occurrence is wrapped in `esc(`), or render with a stub
  value `a<b>&"c` and assert the HTML contains `a&lt;b&gt;&amp;&quot;c`.
- T-S2: `profile.workArrangement` is one line with no `\n`, `<`, `>`, `[`, backtick or
  zero-width/bidi characters, and at most 160 characters.
- T-S3: `whoStevenSection` line 1 contains the exact sentence, and the section's line
  count is unchanged (no extra line injected).
- T-S4: The existing `dangerouslySetInnerHTML` assertion still covers the About component.
- T-S5: `ResumeData`, `roleFields` and `aboutFields` do not include `workArrangement`
  (keeps the scope explicit until the follow-up).

**Verdict: APPROVED.** Low risk: static, public, author-controlled text with no new
surface. The conditions are T-S1 (escaping in the PDF) and T-S2 (single-line plain text
for the prompt). Making the field writable through the MCP needs its own threat model.

## Technical approach (senior-developer)

Data change plus one field threaded through five readers. No new dependency, migration,
route, CSS or component.

**Files and changes**

| File | Change |
|---|---|
| `src/resume.ts` | `profile`: add `workArrangement: 'Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating.'` right after `location`. `cosmos.summary`: append ` Joined as a consultant from Info Support, then hired full-time.` (AC-5). `windows-quality.outcome` → AC-6 text. `windows-devices-data.points[4]` → AC-7 text, same index. `okr-tool.work`: append ` Built in six months to replace Viva Goals, Microsoft’s acquired OKR product, after it was retired.` (curly `’`, AC-8). `wilssens-com.outcome`: `the family’s mailboxes` → `about eight family mailboxes` (AC-9, held by the recruiter's merge condition). Nothing else; `git diff` must show exactly six changed lines in the data. |
| `src/App.tsx` (`renderAbout`, line 114) | Insert `<span>Work arrangement</span><strong>{profile.workArrangement}</strong>` between the `Based in` and `Work authorization` pairs. Prerendered like the rest of the side note; `scripts/markdown.mjs` carries it into `dist/about/index.md` with no change. |
| `scripts/resume.mjs` (facts strip, line 128) | `Looking for` cell becomes `…${esc(profile.availability.toLowerCase())}<br>${esc(profile.workArrangement)}</div>`, per Design. The contact block (line 121) is untouched. |
| `functions/_lib/ask/prompt.ts` | `WhoData.profile` gains `workArrangement: string`; the who-line becomes `… Based in ${location}. Work arrangement: ${workArrangement.replace(/\.$/, '')}. Looking for: …` (strip-then-add so the sentence's own period never doubles; the output still contains `Work arrangement: ${profile.workArrangement}` verbatim). The call at line 54 passes `profile` already, so it type-checks once the field exists. `check_fit` gets it for free: its `record` is `dossierText`, which starts with this block. |
| `functions/_lib/ask/prompt.ts` (rules, line 161), `functions/_lib/mcp/tools.ts` (`check_fit.howTo` line 450, `publicInstructions` line 1060) | Today: "Never infer … willingness to relocate". Now that it is published, keep the ban on inferring but say it may be quoted, mirroring the work-authorization clause, e.g. "never go beyond the work arrangement the dossier states (remote, hybrid, travel, relocation)". Without this the model may answer "not shown" to the exact question the change exists for. Small wording change; security should confirm it does not loosen anything else. |
| `src/webmcp.ts` (`about_steven`, line 75) | Add `workArrangement: profile.workArrangement` after `location`; add "work arrangement" to the tool description ("where he is, how he works, his work authorization…"). |
| `functions/_lib/mcp/tools.ts` | `about_steven` (line 373): a separate `workArrangement: profile.workArrangement` field next to `location` (not appended to the `location` string, which stays `location · authorization` for anything parsing it). `get_resume` (line 657): add `workArrangement` to `profile`. Both public and owner modes. |
| `functions/_lib/mcp/proposals.ts` `ResumeData` | **No change.** It lists the profile fields a proposal can edit; `liveResume()` passes the real `profile`, which has extra keys and still satisfies the type structurally. Adding the field would force every fixture (`proposals.test.ts`, `proposals-branches.test.ts`, `about.test.ts`) to grow and imply MCP editing, which is out of scope (Open question 5). |
| `scripts/resume-mail.mjs` `profileLabels` (line 123) | **Recommend adding** `workArrangement: 'work arrangement'`, against the Out of scope line. `diffFields` reports only labelled keys, so without it the deploy email to Steven omits the main change of this PR. One entry; extend the profile case in `scripts/resume-mail.test.mjs`. PM to confirm; if declined, the email simply stays silent on it. |
| Not changed | `functions/_lib/review/recruiter.ts` required fields, `linkedin.ts`, `about.ts` (its `relocat\w*` pattern still checks an About proposal against `location`; fine until Open question 5), `pageMeta.ts`, OG image (headline and photo unchanged). |

**Tests** (the tester's plan is the list; the code side): `src/resume.test.ts` line 96
pin to the new bullet plus the new pins; `src/App.test.tsx` About case; 
`functions/_lib/ask/agent.test.ts` lines 44 and 48 (the exact who-line, add the field to the
value loop) and any assertion on the old "willingness to relocate" wording;
`src/webmcp.test.ts`; `functions/_lib/mcp/server.test.ts` for `about_steven` (public and
owner) and `get_resume`. No fixture that builds a `ResumeData` or `WhoData` by hand needs
the field except `agent.test.ts`'s `who`, which spreads the real `profile`.

**Risks**

- **PDF layout, not page count.** `buildResume` walks `layouts` until the PDF fits two
  pages, so the page count holds by construction; what can move is the layout. The PDF
  grows by about four lines (two in the facts strip, about one each for the longer Cosmos
  summary and experimentation bullet). Main already prints one bullet per older role
  (comment at `src/resume.test.ts:25`), so the fallback is to `compact` type, then to zero
  older bullets. Zero bullets fails `keeps the first bullet of every older Microsoft role`;
  `compact` fails no test. The build must compare the `Layout:` line `npm run resume:build`
  prints with main's and report any change to the designer as a finding, not ship it
  silently (no `--force`). I could not render here (Chromium needs approval in this
  session), so the headroom is unmeasured. If it does tip, the decision goes back to Design
  (e.g. a wider `Looking for` column in `.facts`, or tighter strip padding), never a cut to
  Steven's text.
- **resume-check.** No new digits enter the PDF (`hundreds`, `six months` and `about eight`
  are words, and the selected-work entries are not in the PDF), so no new unexplained-number
  finding; tense stays past. The Cosmos/Info Support overlap question stays listed (dates
  unchanged) and `raises the questions the dates and numbers leave open` keeps passing.
  ATS should stay 100.
- **Coverage.** Every change is a field read with no new branch; `scripts/resume.mjs` is
  outside coverage and guarded by the PDF tests.
- **Double period / punctuation drift.** The value is a sentence ending in `.`; the prompt
  strips and re-adds it, the About row and PDF print it verbatim. Any future edit that drops
  the period still renders correctly.

**Verdict: FEASIBLE as written.** Two items for the PM: reword AC-3 to "page 1, before
`Summary`" (Design's and the tester's reading), and decide the one-line `resume-mail.mjs`
label. One build-time gate: the résumé layout must not change from main's.

## Test plan (senior-tester)

Every test reads the value from `src/resume.ts` *and* checks the exact approved string
once, so the test goes red if someone retypes the text in a component or changes the
wording. Literal strings appear only in the `src/resume.test.ts` pins. No network, no
snapshots, no timers.

| AC | Test (file › name) | What it asserts (would fail if…) |
|---|---|---|
| AC-1 | `src/resume.test.ts` › new `describe('the profile')` › `states the work arrangement in Steven's words and keeps the location` | `profile.workArrangement` `toBe` the exact AC-1 sentence; `profile.location` `toBe('Seattle, Washington')` |
| AC-2 | `src/App.test.tsx` › `moves the honors into the About sidebar with the hiring logistics` (extend) | The side note (`container.querySelector('.side-note')`) has the labels in order `…Based in, Work arrangement, Work authorization…` (read the `span` texts) and the `strong` after `Work arrangement` has `textContent === profile.workArrangement` (period included) |
| AC-2 (no JS) | New `src/prerender.test.tsx` (`// @vitest-environment node`) › `prerenders the work arrangement on /about` | `render('/about')` from `src/entry-server.tsx` contains `Work arrangement` and the sentence. Plus named check after `npm run build`: `grep -F` the sentence in `dist/about/index.html` and `dist/about/index.md` |
| AC-3 | `src/resume.test.ts` › `the resume PDF` › new `prints the work arrangement on page 1, before the summary` | `normalize(pages[0])` contains `normalize(profile.workArrangement)` and its index is below the index of `summary`; `pages.length` stays 2 (already in `matches src/resume.ts…`). The existing `keeps the first bullet of every older Microsoft role` catches a fallback to the 0-bullet layout caused by the two extra lines |
| AC-4 assistant | `functions/_lib/ask/agent.test.ts` › the who-block tests (lines ~44-48, update) | The exact `lines[1]` string includes `Work arrangement: ${profile.workArrangement}` right after `Based in …`; the loop over profile values includes `profile.workArrangement`; and one `toContain` of the literal sentence |
| AC-4 WebMCP | `src/webmcp.test.ts` › `about_steven answers from src/resume.ts…` (extend) | `about.workArrangement` `toBe(profile.workArrangement)` |
| AC-4 MCP | `functions/_lib/mcp/server.test.ts` › `serves the résumé data, recommendations, patents and press` (extend) | `about_steven` output (`location` or a new `workArrangement` field) contains the sentence, and `get_resume`'s `profile.workArrangement` equals it; the public-mode `about_steven` (line ~376 test) contains it too, since recruiters' assistants call that one |
| AC-5 | `src/resume.test.ts` › new `describe('Steven's approved entries')` › `cosmos explains the overlap` | `summary` `toBe` the AC-5 text; `dates` `toBe('Jan 2004 - Dec 2005')`; `points` `toEqual` main's two (literal) |
| AC-6 | same describe › `windows-quality outcome` | `outcome` exact; `source` `toBe('Amit Gupte')`; `title`, `period`, `context`, `work` `toEqual` main's literals |
| AC-7 | `src/resume.test.ts` › `windows-devices-data says about 20…` (line 96) | Line 96 becomes the new bullet; the `toEqual` of all eight in order proves position and the seven unchanged bullets byte for byte. The PDF test `matches src/resume.ts` (site lens) proves the PDF carries it |
| AC-8 | same describe › `okr-tool what I did` | `work` exact, contains `Microsoft’s` (curly); `outcome` and `source` equal main's literals |
| AC-4b (added at reconcile) | `functions/_lib/ask/agent.test.ts` and `functions/_lib/mcp/server.test.ts` (rule-text cases) | The prompt rules, `check_fit.howTo` and `publicInstructions` allow quoting the stated work arrangement and still forbid inferring beyond it; any old assertion on "willingness to relocate" is updated, not deleted |
| AC-4c (added at reconcile) | `scripts/resume-mail.test.mjs` › profile case (extend) | A change to `profile.workArrangement` is reported with the label `work arrangement` |
| T-S1 (security) | `src/resume.test.ts`: every `profile.workArrangement` in `scripts/resume.mjs` is wrapped in `esc(` | Fails if the PDF template interpolates the field raw |
| T-S2 (security) | `src/resume.test.ts`: `profile.workArrangement` is one line, ≤160 characters, no `<`, `>`, `[`, backtick or zero-width/bidi characters | Fails if the field could pose as prompt structure |
| T-S3 (security) | `functions/_lib/ask/agent.test.ts`: the who-line contains the exact sentence; the section's line count is unchanged | Fails on an injected extra line |
| AC-9 | same describe › `wilssens-com outcome` | `outcome` exact. The mailbox figure vs `src/articles/wilssens/feed.json` is Open question 6 for Steven, not a test or a merge condition |
| AC-10 | `git diff main -- src/resume.ts` read in review (named check) + existing `csx-data keeps Perfect Day first…` pin + a new `leaves the impact numbers and the recommendations as they were` | Diff touches only the AC-1, AC-5-AC-9 lines. New test: `impact` `toEqual` main's list (value, label, backing) and every `recommendations` tuple `[name, title, text]` equals main's (a SHA-256 of `JSON.stringify(recommendations)` pinned in the test keeps it short); the `~30%` `TODO(steven)` is checked in the diff (comments are not testable) |
| AC-11 | `npm test` (`src/resume.test.ts`), `npm run resume:build` (ATS 100/100, 2 pages, no `--force`), `npm run check:recruiter` on the built branch (not below 80), `npm run lint`, `npm run test:coverage`, `npm run build` | — |

**Threat model controls:** the security section was empty when this was written; each
refusal path it adds gets a row here before the build starts. Expected: none beyond
text escaping. The PDF builds HTML with `esc(...)` and React escapes the side note; the
prerender test above is enough because the sentence holds no `<`, `&` or quotes.

**Edge cases**
- Curly `’` (AC-8): the PDF test compares through `normalize`; the data pin keeps `’`.
- Page-1 growth: the PDF must stay at 2 pages and must not switch to `compact` or to fewer
  older bullets (both covered above). If it does, that is a design finding, not `--force`.
- The contact band and the hero must not change (Out of scope): the existing
  `Available now, based in Seattle, Washington, a US permanent resident` assertion in
  `App.test.tsx` stays as is.
- The resume-check date question about Cosmos stays listed (recruiter): do not weaken
  `raises the questions the dates and numbers leave open`.
- About proposals do not cover `workArrangement` (Out of scope): no test change in
  `functions/_lib/mcp/about*.test.ts` or `proposals*.test.ts`; if the developer adds the
  field to `ResumeData`, those tests need its refusal paths.

**Coverage:** changed production files are `src/resume.ts`, `src/App.tsx`, `src/webmcp.ts`,
`functions/_lib/ask/prompt.ts`, `functions/_lib/mcp/tools.ts` (all in `vitest.config.ts`
coverage) and `scripts/resume.mjs` (not in coverage; guarded by the PDF tests). Each change is
a field read with no new branch, so per-file numbers should not move; the build is checked
at 90% overall and per file with `npm run test:coverage`. No new exclusion.

**Verdict on the spec: APPROVED.** Every acceptance criterion maps to a test or a named
check that fails if it breaks. Two notes for the build: AC-3 is tested as "page 1, before
`Summary`" (Design's reading), and AC-10's comment-level guard (the `TODO(steven)`) is a
diff check because comments cannot be tested.

## Open questions for Steven

Steven is not available; nothing waits for him. Each question records the team's
recommendation and the build follows his instruction as given.

1. The new `windows-quality` outcome is your wording, but the Work page still prints
   "As described by Amit Gupte in his recommendation" under it, and his recommendation does
   not mention "every Windows team" or the ~30%. Should the source label stay?
   *Recommendation:* build as instructed (keep the source) now; in a follow-up, either drop
   `source` from this case or label it "Recommendation: Amit Gupte" so a hiring manager who
   clicks through does not find a quote that does not say this.
2. The ~30% now appears in a selected-work outcome, but the `impact` item still has its
   `TODO(steven)` because no csx-data bullet states it. Should a csx-data bullet carry it?
   *Recommendation:* yes, in a separate change you word yourself; this PR leaves the
   impact item and its TODO as they are.
3. "Hundreds of concurrent experiments" and "about eight family mailboxes" are new
   numbers from your approved wording. Are they recorded in the dossier?
   *Recommendation:* record both in the dossier with your confirmation, so the assistant
   and the recruiter review can back them.
4. Should the work arrangement also show on the home page hero facts or the contact band?
   *Recommendation:* not now; About, the PDF and the assistant cover the screening
   question without crowding the phone hero. Revisit if `site_questions` keeps asking.
5. Should `workArrangement` become editable through your MCP proposals like location?
   *Recommendation:* yes, as a follow-up.
6. The wilssens.com card now says "about eight family mailboxes" (your approved wording,
   built as instructed), but the `/building-wilssens` page it links to shows 3 mailboxes
   (`src/articles/wilssens/feed.json`, 2026-10-15, then the live count). Do the two count
   different things (for example provisioned family mailboxes vs the feed's metric), or
   should the wording change?
   *Recommendation (team, raised by the recruiter):* confirm which is right before or soon
   after merge; if they measure different things, say so in the feed's label or the
   write-up; if the live count is not about eight, go back to "the family’s mailboxes" as
   on main.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVED | | |
| Senior recruiter | APPROVED | | Mailbox count moved to Open question 6 |
| Senior designer | APPROVED | | After AC-3 was reworded to "page 1, before `Summary`" |
| Senior developer | APPROVED (feasible) | | Build: the two-line "Looking for" cell tipped the PDF from main's layout (1 bullet on the older roles, compact type) to 0 bullets; fixed without cutting text by `body.compact .facts { padding: 7px 0 3px; line-height: 1.25; }` in `scripts/resume.mjs` (compact only, the strip follows the compact body's line-height). Layout now equals main's. For the designer to confirm on the PDF page-1 render |
| Security engineer | APPROVED | | Conditions T-S1, T-S2 (both tested in `src/resume.test.ts`) |
| Senior tester | APPROVED | | |
