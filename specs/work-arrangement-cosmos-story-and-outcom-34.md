# Work arrangement, the Cosmos hire, and sharper outcomes on four cases

Slug: `work-arrangement-cosmos-story-and-outcom-34` · Branch: `update/work-arrangement-cosmos-story-and-outcom-34` · Status: built
Asked by Steven on 2026-10-21 (Site update, approved instruction, exact wording): "Do NOT touch the team-size bullets on csx-data and windows-devices-data (PR #60). Do NOT change any quotes or sources (Ryan Parsell's and Amit Gupte's quotes stay exactly as they are). Profile / work arrangement: add the line "Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating." (e.g. as a work-arrangement field next to location, shown on the site and PDF). Role "cosmos": append to the summary: "Joined as a consultant from Info Support, then hired full-time." Keep the dates. Selected work "windows-quality": change the outcome to "Adopted by every Windows team, and behind the roughly 30% drop in issue days across Perfect Day scenarios." Keep the source (source field 'Amit Gupte' stays). Role "windows-devices-data": replace the bullet "Scaled experimentation adoption across Windows, significantly reducing the number of features pulled back after release." with "Scaled experimentation across Windows to hundreds of concurrent experiments, significantly reducing the number of features pulled back after release." Selected work "okr-tool": add to the outcome: "Built in six months to replace Viva Goals, Microsoft's acquired OKR product, after it was retired." Keep the existing Amit Gupte-sourced sentence wording and source. Selected work "wilssens-com": change "five sites and the family's mailboxes" to "five sites and about eight family mailboxes". Change nothing else."

## Problem

Readers, in order: a recruiter screening on a phone, often from a forwarded link; a
hiring manager comparing candidates on `/work` and the résumé PDF; a peer checking the
Windows work.

1. **Where and how he works is missing.** The site and the PDF say "Seattle,
   Washington" and his work authorization. They do not say whether he works remote or
   hybrid, travels or relocates, and that is a recruiter's first screening question. The
   site assistant and the MCP are told never to infer willingness to relocate, so today
   they can only answer "not published".
2. **The early career has a gap that looks odd.** Info Support (Jan 2001 - Dec 2004)
   and Cosmos (Jan 2004 - Dec 2005) overlap, and nothing explains why. The résumé checker
   raises it as an open question today. The real story is a consultant who was hired by
   the client.
3. **Four claims are vaguer than they need to be.** "Scaled experimentation adoption"
   has no scale. The windows-quality outcome says "data-supported decisions" but does
   not say who adopted the work or what changed. The okr-tool outcome does not say what
   was replaced or how fast. "The family's mailboxes" has no size. Each is a question a
   hiring manager would ask in the first interview.

How we know: Steven's approved instruction above, recorded through the MCP, and the
recruiter baseline in Recruiter impact. The new numbers (roughly 30%, hundreds, six
months, about eight) are **Steven's own approved word on 2026-10-21**. That is their
source under CLAUDE.md ("Steven's own word recorded in the dossier"). No colleague's
recommendation states them. The `~30%` impact tile (`backing: 'csx-data'`) has carried
`TODO(steven)` asking where that number is stated. This change states it in the
`windows-quality` case, whose role is `csx-data`. The MCP evidence tools
(`site_questions`, `site_analytics`) are not connected in this run, so they were not
read.

## Outcome

A recruiter sees in one line that Steven is Seattle-based, open to remote or hybrid and
to coordinated travel, and not relocating. They see it on the home page, in the résumé
PDF and in what an AI assistant reads. The Cosmos entry explains the overlap with Info
Support, and four claims now carry Steven's own numbers. Nothing else about Steven
changes, and the ATS score stays 100/100 without `--force`.

## Acceptance criteria

Text below is exact. Apostrophes follow the file's convention: a curly ’ (U+2019) in
prose, as in "Microsoft’s" and "family’s" today. Tests compare after normalizing
straight and curly quotes.

- AC-1 (work arrangement, data): `profile` in `src/resume.ts` has a new field
  `workArrangement` directly after `location`, whose value is exactly "Seattle-based, open
  to remote or hybrid, and to coordinated travel; not relocating." `location`,
  `workAuthorization` and `availability` are unchanged.
- AC-2 (work arrangement, site): the prerendered `dist/index.html` contains the
  `workArrangement` sentence verbatim, read from `profile` and not typed into a component.
  It renders in two places, as Design 1 and 2 describe:
  - On the home hero it is its own fourth `span` in `.hero-facts`, after the unchanged
    location and authorization fact. From 800px down to 521px it spans the full width of
    the row.
  - On `/about` (`dist/about/index.html`) it is a "Work arrangement" pair in the side
    note, right after "Based in" and before "Work authorization".
  - The contact band is unchanged.
  - No element shows the city twice. "Seattle, Washington · Seattle-based, …" in one
    element fails this criterion.
  - At 390px and 320px nothing scrolls horizontally. The first phone screen still shows
    the name, the role he wants, location and authorization, and a contact action or the
    résumé link, as on main.
  - The field is a required string, so the components render it without an empty-value
    branch.
- AC-3 (work arrangement, PDF): the text extracted from the new PDF contains the
  `workArrangement` sentence exactly once, as a second line of the "Looking for" facts
  cell, after "Looking for" and before "Scope" (Design 4). It is not in the header. The
  match runs after normalizing whitespace and joining line-break hyphens. The value goes
  through `esc()`, and the template emits the `<br>`. The contact block still passes the
  résumé check (email, phone, LinkedIn, location found).
- AC-4 (work arrangement, assistants): `workArrangement` reaches every place an
  assistant reads the profile, as its own key or line, read from `profile`:
  - The WebMCP profile (`src/webmcp.ts`).
  - The MCP `about_steven` result (owner and public), `get_resume`, and the fit-check
    `profile` object (`functions/_lib/mcp/tools.ts`).
  - The site assistant's dossier (`functions/_lib/ask/prompt.ts`), as one new line that
    quotes the field.

  A recruiter's assistant that asks "would he relocate?" gets Steven's published answer
  and does not have to infer it. Each "never infer … willingness to relocate" rule (in
  `functions/_lib/ask/prompt.ts` and `functions/_lib/mcp/tools.ts`) stays byte-identical
  to main. Quoting a published fact is not inferring.
- AC-4b (Steven's change email): `scripts/resume-mail.mjs` `profileLabels` gains
  `workArrangement: 'work arrangement'`. The email Steven gets for a résumé change then
  lists the new field, because `diffFields` only walks labelled keys.
- AC-5 (Cosmos): the `cosmos` entry's `summary` is exactly "Built and supported software
  components across C# client and Java server systems using CORBA middleware. Joined as a
  consultant from Info Support, then hired full-time." Its `dates` ("Jan 2004 - Dec
  2005"), `role`, `location` and `points` are unchanged. `/experience` shows the new
  sentence. The checker may still list the date overlap, because it compares dates and
  not text. That is not a regression.
- AC-6 (windows-quality): the `windows-quality` case's `outcome` is exactly "Adopted by
  every Windows team, and behind the roughly 30% drop in issue days across Perfect Day
  scenarios." Its `source` is still `'Amit Gupte'`. Its `title`, `period`, `role`,
  `context` and `work` are unchanged. A one-line code comment on the entry records that
  the outcome is Steven's approved word of 2026-10-21. The comment does not render.
- AC-7 (experimentation bullet): in `windows-devices-data` `points`, the item "Scaled
  experimentation adoption across Windows, significantly reducing the number of features
  pulled back after release." is replaced, in the same position (index 4), by exactly
  "Scaled experimentation across Windows to hundreds of concurrent experiments,
  significantly reducing the number of features pulled back after release." The array
  keeps 8 items, and the other 7 are byte-identical to main, including item 0 (the team
  size bullet from PR #60).
- AC-8 (okr-tool): the `okr-tool` case's `outcome` is exactly the existing text followed
  by a space and the new sentence: "The gap was closed with a functional replacement, and
  the project became the team’s working example of a modern AI development lifecycle.
  Built in six months to replace Viva Goals, Microsoft’s acquired OKR product, after it
  was retired." `source` is still `'Amit Gupte'`. Every other field, including `context`,
  is unchanged. A code comment records Steven's word for the new sentence, as in AC-6.
- AC-9 (wilssens-com): the `wilssens-com` case's `outcome` reads "Live with five sites
  and about eight family mailboxes, each site on its own isolated Worker and database;
  the design decisions are written up for hiring managers." Only that phrase changes.
  `src/articles/wilssens/feed.json` is not touched (Open question 3).
- AC-10 (nothing else): `git diff main -- src/resume.ts` shows only AC-1 and AC-5 to
  AC-9, plus the source comments and the AC-11 comment edit. Unchanged and
  byte-identical to main: `csx-data` (all five points), every `recommendations` entry
  (Ryan Parsell's and Amit Gupte's text), every `source`, `impact` (values, labels and
  `backing`), `profile.summary`, `profile.teamSize`, `skills`, `honors`, `news` and every
  other role and case. The files changed are only these:
  - `src/resume.ts` and the regenerated `public/steven-wilssens-resume-2026.pdf`.
  - The components and tools needed for AC-2 to AC-4b: `src/App.tsx`, `src/App.css` (the
    one 800px rule), `scripts/resume.mjs`, `src/webmcp.ts`,
    `functions/_lib/mcp/tools.ts`, `functions/_lib/ask/prompt.ts` (one added line; the
    rule lines unchanged) and `scripts/resume-mail.mjs` (one label).
  - Their tests and this spec.

  `public/og-image.png` is unchanged.
- AC-11 (the 30% backing): no impact tile is added or changed. The `TODO(steven)` above
  the `~30%` entry is reworded, not deleted. It now says that the number is stated in the
  `windows-quality` case (role `csx-data`) on Steven's word of 2026-10-21, and that a
  `csx-data` bullet stating it is still open (Open question 2). `backing` stays
  `'csx-data'`. The résumé check and the recruiter check report no new
  unexplained-number finding.
- AC-12 (résumé gate): `npm run resume:build` regenerated the PDF without `--force`. The
  PDF is 2 pages. The build reports a layout no tighter than main's ("1 bullet on the
  older Microsoft roles, compact type", or roomier). `node scripts/resume-check.mjs`
  reports ATS 100/100, `--baseline https://steven.wilssens.com/resume-report.json` says
  it equals the live site, and `gates` passes without `accept-lower-score`. If the new
  lines push the PDF to a tighter layout, the developer does **not** reword Steven's text,
  does not move the line into the header, and does not force. A tighter layout that still
  keeps the first bullet of every older Microsoft role (the existing test) is accepted
  and named in the pull request with before and after images of page one. A layout that
  drops those bullets fails this criterion and goes to Steven (Open question 5).
- AC-13 (PDF content): the extracted PDF text contains the new experimentation bullet
  in full under "Principal Group Product Manager - Windows & Devices Data". It contains
  the Cosmos sentence if the PDF prints early-role summaries; otherwise the test says so
  and does not assert it. It no longer contains "Scaled experimentation adoption".
- AC-14 (pages): after `npm run build`, `dist/experience/index.html` contains the new
  bullet and the Cosmos sentence. `dist/work/index.html` contains the three new outcome
  texts (AC-6, AC-8, AC-9) and still shows "As described by Amit Gupte" on
  `windows-quality` and `okr-tool`. Neither page contains "Scaled experimentation
  adoption" or "the family’s mailboxes".
- AC-15 (bars): `npm run check:recruiter` on the lead's build of `dist/` scores 80 or
  more (the main baseline) with no new high finding. `npm test` (including the
  `src/resume.test.ts` check that the PDF matches `src/resume.ts`), `npm run lint`,
  `npm run test:coverage` (90% or more overall and per changed file) and `npm run build`
  all pass.

## Out of scope

- Any change to the `csx-data` and `windows-devices-data` team-size bullets, to
  `profile.teamSize`, or to any recommendation quote or `source` value (Steven's
  instruction).
- A new impact tile for the 30% drop, or any change to the existing `~30%` tile. A
  `csx-data` bullet that states it is a follow-up for Steven (Open question 2).
- Changing how `/work` attributes outcomes ("As described by … in his recommendation")
  or the `/work` intro ("outcomes stay within what colleagues have said publicly"). This
  is a follow-up (Open question 1).
- The `/building-wilssens` mailbox count (`feed.json`, `/api/building/wilssens`). This is
  a follow-up (Open question 3).
- Changing the assistant's or the MCP's "never infer willingness to relocate" rules. They
  stay byte-identical (AC-4).
- The contact band at the bottom of every page. Its sentence already says "based in
  Seattle", and adding the line would repeat the city and overload the band (Design 3).
- JSON-LD in `src/pageMeta.ts`, which has no fitting schema.org property.
- The share image, the headline, the LinkedIn texts (`functions/_lib/review/linkedin.ts`;
  Open question 4), and the recruiter and résumé checkers.
- Agent orchestration. `/building-this-site` is not touched.

## Recruiter impact (senior-recruiter)

**Baseline (main, 2026-10-21; this branch had no diff from `origin/main` when measured):**

- `npm run check:recruiter`: **80/100** for main's data on the live pages (0 high). The local run printed 50/100 only because `dist/` was not built in this worktree: its six "new" mediums are all "page not in this deployment" / "no resume report", not content findings. The pre-merge comparison must run on the lead's build.
- `node scripts/resume-check.mjs`: **ATS 100/100**, 2 pages, 357 KB, 0 errors, 0 warnings. `--baseline https://steven.wilssens.com/resume-report.json`: 100 → 100, same as live. One open question from the checker: the Cosmos role (Jan 2004 - Dec 2005) overlaps Info Support (Jan 2001 - Dec 2004).
- Bar for the merge: recruiter check not below 80 and no new high; ATS stays 100; PDF stays 2 pages.

**What each change does for a recruiter**

1. **Work arrangement next to location** ("Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating.").
   - *First ten seconds:* this is the biggest gain in the change. Location fit is the first screen-out question after title. Today the hero line only says "Seattle, Washington · US permanent resident (green card)", so a recruiter with a role in the Bay Area or New York has to ask. The new line answers it before they write.
   - *ATS / search:* "remote" and "hybrid" are filter terms in most ATS and in LinkedIn Recruiter. Having them in the PDF text helps the résumé come up in remote and hybrid searches. Nothing is lost.
   - *Risk, "not relocating":* it does filter out relocation-only roles. That is the point, and it saves both sides a screen. Because the line starts with what he is open to and ends with the limit, it reads as clear rather than restrictive. I accept it as worded.
   - *Risk, the first screen gets busier:* at 390px the hero facts already wrap to three lines. If the designer places the line next to `profile.location`, it must not repeat the city: "Seattle, Washington · Seattle-based, open to…" reads as a mistake. Two options: give it its own `hero-facts` span, or let it stand in for the location span on the hero. That is the designer's call. Hard bar: who, role wanted, location + authorization, contact and the résumé link all stay on the first phone screen.
   - *Risk, the PDF:* the header line grows. It must stay on 2 pages and the contact block must stay extractable (the resume check verifies both).
   - *Where it must appear:* store it as one `profile` field (e.g. `workArrangement`), not as text in a component. The hero, the contact band ("based in Seattle…"), the PDF header, the MCP `profile` and the assistant then all read the same words. When asked "Where is Steven based and is he authorized to work there?", the assistant should now also say remote or hybrid, travel, and not relocating.

2. **Cosmos summary: "Joined as a consultant from Info Support, then hired full-time."**
   - Answers the overlap the résumé checker flags today (Info Support to Dec 2004, Cosmos from Jan 2004). Without it, a careful screener sees two jobs at once and asks. Dates stay as they are. This lowers the risk on a close read and changes nothing in the first ten seconds. After the build, the checker's Cosmos question may still be listed (it compares dates, not the text). That is fine and not a regression.

3. **windows-quality outcome: "Adopted by every Windows team, and behind the roughly 30% drop in issue days across Perfect Day scenarios."**
   - *Gain:* a concrete outcome in place of "data-supported decisions". Hiring managers look for this.
   - *Risk, the source:* the card prints "As described by **Amit Gupte** in his recommendation" under the outcome. Amit's recommendation says neither "every Windows team" nor 30%. A hiring manager who opens the recommendation will find the outcome attributed to him but not in his words. That is a credibility risk, the kind a sceptical reader notices. Steven said to keep the source, and the facts are his own recorded word, which CLAUDE.md accepts. So I do not block, but I ask Steven (below) and ask the developer to record the source as Steven's word in a comment next to the entry.
   - *Risk, the number:* `impact` already shows "~30% fewer issue days" backed by `csx-data` with a `TODO(steven)`, because no csx-data bullet states it. The outcome now says it in prose on the work page, which helps. But the bullets stay unchanged (Steven: nothing else), so the TODO stays open and the backing gap remains. The unexplained-number check must report no new finding. If it does, that is a regression.
   - *Risk, "every Windows team":* an absolute that interviewers will probe. Fine as Steven's word, but he should be ready to name the scope.

4. **windows-devices-data bullet: "Scaled experimentation across Windows to hundreds of concurrent experiments, …"**
   - *ATS:* the checker's keyword is "experimentation", not "experimentation adoption". The word stays in this bullet, the headline, the summary and other roles, so there is no keyword loss. "Adoption" was vague, and "hundreds of concurrent experiments" gives the scale a hiring manager asks for.
   - *Risk:* "hundreds" is a magnitude stated inside its own bullet, so it is its own backing. This is not one of the team-size bullets; the team-size bullets stay untouched as instructed.

5. **okr-tool outcome: add "Built in six months to replace Viva Goals, Microsoft's acquired OKR product, after it was retired."**
   - *Gain:* naming Viva Goals turns "an OKR tool" into something a reader can place. Viva Goals' retirement is public.
   - *Risk, the source:* same issue as item 3. Amit's recommendation covers the existing sentence ("rapidly stand up a functional replacement") but not six months or Viva Goals, and the card attributes the whole outcome to him. "Six months" next to his "rapidly" reads fine.
   - *Close read:* the context already says the tool "was being retired", and the new sentence says "after it was retired". Check the sequence is consistent in the built card (built after the retirement, or to replace it as it retired).

6. **wilssens-com outcome: "five sites and about eight family mailboxes".**
   - *Risk, a contradiction a hiring manager can see:* the card links to `/building-wilssens`, whose stats show **3** "family mailboxes hosted at Zoho" (`src/articles/wilssens/feed.json`, `mailboxes: 3`, as of 2026-10-15, live from `/api/building/wilssens`). A reader who clicks through sees 8 on one page and 3 on the next. Steven's number probably also counts forwarding addresses, but the reader cannot tell. I do not change the approved wording; I ask Steven (below). If the answer is that the feed counts only full mailboxes, the clean fix (his call) is "about eight family addresses", or a feed that counts both.

**What a recruiter would ask that the change should answer**

- "Would he relocate for the right role?" Answered: no.
- "Remote from Seattle for a company elsewhere: how often can he travel?" Partly answered ("coordinated travel"). Good enough for a first screen.
- "Why two jobs at once in 2004?" Answered by the Cosmos sentence.
- "What exactly did the 30% measure, and over what period?" Not answered on the card. This is what an interviewer will ask, and Steven should have the answer ready.

**Verdict on the spec:** `APPROVE` from the recruiter's side, on these conditions: the work arrangement is a `profile` field shown on the first phone screen without repeating the city; the PDF stays at 2 pages; ATS stays 100; the recruiter check does not drop below 80. Steven's answers to Q1 and Q2 below are needed before the merge sign-off but do not block the build.

## Design (ux-designer)

### What renders differently

One thing is new on screen: the work-arrangement line, read from a new field
`profile.workArrangement` (AC-1; 83 characters, layouts sized for up to about 100). No
component types the sentence.

Everything else only changes text in slots that exist today, with the same type, spacing
and colour:

- Cosmos summary and the experimentation bullet: `/experience` (`.timeline-body p`,
  `.timeline-body li`) and the PDF. Longer text wraps; nothing else moves. If the PDF
  falls back to `body.compact`, that is a visible change and goes in the PR (AC-12).
- The three selected-work outcomes: `/work` (`.work-list dd` under "Outcome"), with the
  "As described by" line unchanged under them. Selected work is not in the PDF. WebMCP,
  the MCP and the assistant get the new text with no UI.

### Where the work-arrangement line renders

It sits beside location, as its own line in that place's existing style. No new token,
class or component.

1. **Home hero, `.hero-facts`**: a fourth `<span>` right after the unchanged
   `{location} · {workAuthorization}` fact, in the same muted 13px/1.4 style (only the
   first fact is ink and bold). Each is a separate line, so the city never shows twice on
   one line (AC-2).

   ```
   1440, light and dark
   ┌──────────────────────────────────────────────┬──────────────────────┐
   │ lede ...                                     │ │ Open to: product   │
   │                                              │ │ leadership roles…  │
   │ [View experience] (Ask AI) Resume  email  in │ │ Principal · Group  │
   │                                              │ │ PM · led 10 to 20… │
   │                                              │ │ Seattle, Washington│
   │                                              │ │ · US permanent …   │
   │                                              │ │ Seattle-based, open│
   │                                              │ │ to remote or hybrid│
   │                                              │ │ and to coordinated │
   │                                              │ │ travel; not reloc… │
   └──────────────────────────────────────────────┴──────────────────────┘
   ```

   At 1440 the 210px column grows by about three lines (~70px) and the hero gets a little
   taller. Accept that; do not shrink the type.

   From 800px down to 521px the facts are a three-column row
   (`.hero-facts { grid-template-columns: repeat(3, 1fr) }`), where a fourth item would be
   stranded in column one of a second row. Add to the 800px query in `src/App.css`:
   `.hero-facts span:nth-child(4) { grid-column: 1 / -1; }`. At 520px and down (390, 320)
   the facts are one column already; the line is the last fact, two or three lines. The
   lede and the actions (résumé, email) stay above the facts, so the first phone screen
   keeps name, role wanted, location and authorization, and a contact action (AC-2). No
   horizontal scroll at 320.

   ```
   390, light and dark
   ┌──────────────────────────────┐
   │ (photo)                      │
   │ STEVEN WILSSENS · SEATTLE, … │
   │ Product leader who invents…  │
   │ lede…                        │
   │ [View experience] (Ask AI)…  │
   │ ──────────────────────────── │
   │ Open to: product leadership… │
   │ Principal · Group PM · led … │
   │ Seattle, Washington · US     │
   │ permanent resident (green …) │
   │ Seattle-based, open to remote│
   │ or hybrid, and to coordinated│
   │ travel; not relocating.      │
   └──────────────────────────────┘
   ```

2. **About, `.side-note`**: a new pair right after "Based in":
   `<span>Work arrangement</span><strong>{profile.workArrangement}</strong>`, then "Work
   authorization" as today. Reuses the mono green label and the 17px value. The About
   page is where a recruiter reads location and authorization as a list, so leaving it
   out there would leave that list incomplete. **PM to reconcile:** Out of scope lists
   `/about`. The change is in `src/App.tsx`, which AC-10 already allows. I recommend
   including it.

3. **Contact band** (bottom of every page): unchanged. Its sentence is built from
   availability, location and authorization. Adding an 83-character sentence makes the
   paragraph too long beside five actions, and "based in Seattle … Seattle-based" repeats
   the city. The hero and About carry the line. The recruiter suggested the contact band;
   I keep it out for these reasons.

4. **PDF, `scripts/resume.mjs`**: not in the header contact block, which is
   right-aligned in an `auto` grid column; a line that long would widen it and squeeze
   the name and headline. It goes in the facts row's first cell, "Looking for", as a
   second line after `{lookingFor} · {availability}` and a `<br>`, in the cell's 9.2pt
   ink, with no new label (AC-3, and Open question 5's fallback, used from the start):

   ```
   LOOKING FOR                          SCOPE                BACKGROUND
   Product leadership roles building    Led teams of 10 to   Product leader since
   new products, … · available now      20 product managers; 2008, software …
   Seattle-based, open to remote or     telemetry from 1.6B+
   hybrid, and to coordinated travel;   Windows devices
   not relocating.
   ```

   The widest cell (1.35fr) becomes about two lines taller. The tester checks it stays
   at 2 pages, ATS 100, and the sentence extracts once.

5. **Data only, no UI**: the WebMCP profile in `src/webmcp.ts` and the MCP profile in
   `functions/_lib/mcp/tools.ts`, next to `location` (AC-4). JSON-LD in `src/pageMeta.ts`
   has no fitting schema.org property, so it stays as it is. The share image is
   unchanged.

### States

Static text from `src/resume.ts`, prerendered: the same with and without JavaScript, with
no loading or error state. If the field is empty, the hero span, the About pair and the
PDF line are not rendered (no empty label, no stray gap). Past about 100 characters, cut
the copy with the recruiter rather than restyle.

### Light, dark, print

Reuses `--muted` (hero), `--green` and `--ink` (About) and the PDF's `--ink`. All already
pass AA in light, dark and the print palette.

### Accessibility

Plain text, no new control: the keyboard path and focus order don't change. The hero
span follows the location in DOM and reading order. No motion.

### Pages to screenshot

`home`, `about`, `experience` and `work` at 1440 and 390 (phone with `--slices`), light
and dark, plus `home` at 320 and at about 700 (the three-column row with the full-width
fourth fact), and page one of the PDF before and after. Before/after pairs for Steven:
home hero at 1440, home hero at 390, the About side note, PDF page one.

### Verdict

APPROVE: hero fourth fact (full width from 800px down to 521px), About pair after
"Based in" (the PM reconciles this with Out of scope), PDF second line in "Looking for",
not in the contact band or the PDF header.

## Threat model (security-engineer)

No new entry point, endpoint, input, token, table or tool. The change is static text in
`src/resume.ts` (written by Steven, reviewed in the pull request) and one new string
field, `profile.workArrangement`, read at build time and by existing read-only tools.

- **Data exposure.** The sentence is Steven's own approved wording about himself, meant
  for publication (site, PDF, public `/mcp` and WebMCP). It names only Seattle, which
  `profile.location` already publishes. No family member or colleague is named; "about
  eight family mailboxes" is a count, with no names or addresses. Nothing private from
  the dossier moves to a public surface. No control needed beyond keeping the field in
  `profile` (public by design), not in the dossier.
- **Assistant and MCP (prompt-injection surface).** The text is trusted first-party data
  reaching the model the same way `location` does; no visitor or third-party text is
  added, so there is no new injection path. The only behavioural risk is the model
  treating "not relocating" as licence to infer more (compensation, visa). Control: the
  existing "never infer willingness to relocate" rules in `functions/_lib/ask/prompt.ts`
  and `functions/_lib/mcp/tools.ts` stay byte-identical (AC-4, Out of scope); quoting the
  published field is allowed. Test: the AC-4 tests assert the MCP and WebMCP profile
  return the field verbatim; the existing prompt tests keep passing unchanged.
- **Rendering.** Site: rendered as a React text child (auto-escaped); no
  `dangerouslySetInnerHTML` and no Markdown path. PDF (`scripts/resume.mjs`): the field
  must go through the existing `esc()` like every other interpolated value, with the
  `<br>` emitted by the template and never placed inside the data. The sentence has no
  markup characters today, so this is defence in depth against a later edit. Test: the
  AC-3 extraction test (the sentence appears once as text) covers the happy path; the
  merge review checks the interpolation uses `esc()`.
- **Cost, auth, secrets, workflows.** No model call, route, secret or workflow changes.
  The PDF is regenerated by the existing `npm run resume:build`.

**Verdict:** `APPROVE`. Low risk; required controls: escape the field in the PDF
template and keep the relocation rules unchanged, both checked at merge review.

## Technical approach (senior-developer)

Feasible as written, with no migration, no new dependency and no Functions or D1 change.

**Data flow.** One new string, `profile.workArrangement`, in `src/resume.ts`. Every surface reads
it from there: the prerendered pages (`src/App.tsx`), the PDF (`scripts/resume.mjs`), WebMCP
(`src/webmcp.ts`) and the MCP (`functions/_lib/mcp/tools.ts`). The six text edits (AC-5 to AC-9,
AC-11) are data only. `/experience`, `/work`, the PDF early-role line, the assistant's dossier
(`functions/_lib/ask/prompt.ts` renders `item.summary`/`points`/case outcomes) and both MCPs pick
them up with no code change.

**Files to change.**
- `src/resume.ts`: `workArrangement: string` on the profile (the type is inferred from the
  object literal, so adding the key after `location` is the type change). Edit the cosmos
  `summary`, the `windows-devices-data` point at index 4, and the `windows-quality`, `okr-tool`
  and `wilssens-com` outcomes. Add the one-line "Steven's word, 2026-10-21" comments (AC-6,
  AC-8). Reword the `TODO(steven)` above `~30%` (AC-11), keeping `backing: 'csx-data'`.
- `src/App.tsx`: in `renderHome`, a fourth `<span>{profile.workArrangement}</span>` in
  `.hero-facts` after the location/authorization span. In `renderAbout`, the
  `Work arrangement` pair right after `Based in`. Both are guarded by `profile.workArrangement &&`
  (Design → States). The contact band stays unchanged.
- `src/App.css`: in the existing `@media (max-width: 800px)` rule (line 89), add
  `.hero-facts span:nth-child(4) { grid-column: 1 / -1; }`. **PM:** AC-10's file list omits
  `src/App.css` and the About pair. Add both.
- `scripts/resume.mjs` line 128 ("Looking for" cell): add `<br>${esc(profile.workArrangement)}`
  after `lookingFor · availability`, only when the field is set. Then
  `public/steven-wilssens-resume-2026.pdf`, regenerated by `npm run resume:build`.
- `src/webmcp.ts` (~line 74): `workArrangement: profile.workArrangement` next to `location`.
- `functions/_lib/mcp/tools.ts`: add `workArrangement` to the profile block (~line 339, as its
  own key rather than appended to the `location` string) and to the fit-check `profile` object
  (~line 621). The "never infer willingness to relocate" rules (lines 416, 1018) stay as they are.
- Recommended, outside AC-10's list. **PM to decide:**
  1. `scripts/resume-mail.mjs` `profileLabels`: add `workArrangement: 'work arrangement'`.
     Without it, Steven's change email does not list the new field, because `diffFields` only
     walks labelled keys.
  2. `functions/_lib/ask/prompt.ts`: it imports no `profile` field today, so the site assistant
     ("Ask about Steven") would still answer "not published" to "would he relocate?". Add one
     line to its `about` text that reads `profile.workArrangement` (not typed in). AC-4 covers
     only WebMCP and the MCP; I recommend extending it to the assistant.
- Tests: `src/resume.test.ts` (line 95 pins the old experimentation bullet; update it to the new
  text, keeping the other 7 byte-identical), `src/webmcp.test.ts` (assert `workArrangement`),
  the MCP tools test, an `App` render test for the hero span and the About pair, and the
  `scripts/resume.mjs` HTML test that the sentence appears once.

**Stays the same.** Byte-identical: the `csx-data` points and the team-size bullet
(`windows-devices-data`[0]), every `recommendations` quote, every `source`, every `impact` entry
(value, label, backing), `profile.summary`/`teamSize`/`location`/`workAuthorization`/`availability`,
`src/pageMeta.ts` JSON-LD, `public/og-image.png` (headline and photo unchanged, so no
`og-image.mjs` run), `src/articles/wilssens/feed.json`, `functions/_lib/review/` and the checkers.

**Feasibility risks.**
1. *PDF page fit.* Three things add height: about two lines in the widest facts cell, the
   longer Cosmos line in the early-roles block, and a slightly longer bullet in a detailed role,
   which never loses a bullet. The build walks `layouts` (2 → 1 older bullets → compact →
   0 bullets) and keeps the first that fits two pages. If it now lands tighter than main's, I do
   not reword or force. I report the layout it chose in the PR and under Open question 5 (AC-12).
   The other fallback, putting the line in the header, is worse for the name and headline (Design 4).
2. *resume-check.* `contact-location` still finds "Seattle, Washington". "30%" now appears in
   the outcome of a case that is not in the PDF. The PDF's only "30%" is still the
   `windows-devices-data` cost bullet, so the PDF gets no new unexplained number. The site
   recruiter check reads `/work` and `impact`: verify with `npm run check:recruiter` that it
   finds no new `unexplained-number` from the windows-quality outcome. "hundreds of concurrent
   experiments" is not a digit, so it does not trip the number checks. The early-role date
   overlap (Info Support/Cosmos) may still be listed and is not a regression (AC-5).
3. *Tests that pin texts.* `src/resume.test.ts:95` (the old bullet) is updated in the same
   commit, and `src/resume.test.ts` must pass the PDF ↔ `resume.ts` match after
   `resume:build`. Before building I will grep for "family’s mailboxes", "Scaled experimentation
   adoption" and the old outcomes in `*.test.*`, `scripts/*.test.mjs` and `src/articles/` (the
   write-ups quote cases). `functions/_lib/review/recruiter-branches.test.ts` builds its own
   profile and stays green, because the new field is optional to the checker.

## Test plan (senior-tester)

Tests compare after the `normalize` helper already in `src/resume.test.ts` (curly to
straight quotes, dashes, whitespace, lower case). No new fakes: the MCP tests use the
fake store and `call` / `publicCall` helpers in `functions/_lib/mcp/server.test.ts`, the
WebMCP tests the `modelContext` stub in `src/webmcp.test.ts`, the page tests `setPath` +
`render(<App />)` in `src/App.test.tsx`.

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | `src/resume.test.ts`, new `describe('the work arrangement')` › `it('profile.workArrangement is Steven’s sentence, right after location, and location, authorization and availability are unchanged')`: exact string; `Object.keys(profile)` has `workArrangement` at `indexOf('location') + 1`; the three other fields equal their current literals | unit |
| AC-2 | `src/App.test.tsx`, extend `it('answers the recruiter screen on the home page: …')`: `getByText(profile.workArrangement)` inside `.hero-facts`, as its own `span` after the location fact; no element's text contains both "Seattle, Washington" and "Seattle-based". Same file, extend `it('moves the honors into the About sidebar …')` for the About pair: "Work arrangement" is right after "Based in" and before "Work authorization" (kept, PM reconciliation). The contact band text is unchanged. The verbatim sentence in prerendered `dist/index.html`: the lead's `grep -c` on the built file, in the PR evidence. 390px wrap, no horizontal scroll, first phone screen: `npm run screenshots -- home about` at 390 and 320 (designer) | component / build check / ui-check |
| AC-3 | `src/resume.test.ts` › `describe('the resume PDF')`, new `it('prints the work arrangement once in the facts row and keeps the contact block')`: `pdfText()` contains `normalize(profile.workArrangement)` exactly once (split count = 2), after "looking for" and before "scope"; `analyzeResume()` has no contact finding (email, phone, LinkedIn, location). Normalize also joins a line-break hyphen (`-\s` inside a word) so a wrap in "coordinated" does not fail it | unit (on the real PDF) |
| AC-4 | `src/webmcp.test.ts` › extend `it('about_steven answers from src/resume.ts: …')`: `about.workArrangement` (or the field the developer names) equals `profile.workArrangement`. `functions/_lib/mcp/server.test.ts`: extend the owner `about_steven` test (line ~98) and the public one (line ~344) so the result carries the sentence; and a `get_resume` assertion that `profile.workArrangement` is returned. Same file: the fit-check `profile` carries it; the public `howToUse` and the system text still contain "never infer … willingness to relocate" (rule unchanged). `functions/_lib/ask/agent.test.ts`: `dossierText()` (or `systemPrompt`) contains `profile.workArrangement` exactly once, and the fit-check rule line containing "willingness to relocate" equals its main literal. Byte-identical rule lines: also the tester's diff review of `prompt.ts` and `tools.ts` | function / review |
| AC-4b | `scripts/resume-mail.test.mjs`: a profile change to `workArrangement` between before and after is listed under Profile with the label "work arrangement" | unit |
| AC-5 | `src/resume.test.ts`, new `describe('the early career')` › `it('cosmos explains the Info Support overlap and keeps its dates')`: exact `summary`; `dates`, `role`, `location`, `points` equal their current literals. `src/App.test.tsx` › `setPath('/experience')`: the sentence is on the page. `it('raises the questions the dates and numbers leave open')` keeps passing (the overlap may still be asked; not a regression) | unit / component |
| AC-6 | `src/resume.test.ts`, new `describe('the selected work outcomes')` › `it('windows-quality says who adopted it and the roughly 30%, still sourced to Amit Gupte')`: exact `outcome`, `source === 'Amit Gupte'`, `title`/`period`/`role`/`context`/`work` equal their current literals. The comment: tester reads the diff (a comment cannot be asserted; it must not render, which the `/work` test below proves by matching the outcome `dd` exactly) | unit / review |
| AC-7 | `src/resume.test.ts` › **update** `it('windows-devices-data says about 20, then about 12, …')`: index 4 becomes the new bullet, the other seven stay as the literals in that test (which already pins item 0, the PR #60 bullet). Leaving the old literal would assert stale data; changing any other item fails | unit |
| AC-8 | `src/resume.test.ts` › `describe('the selected work outcomes')` › `it('okr-tool keeps Amit’s sentence and adds the six months and Viva Goals')`: `outcome` equals old sentence + `' '` + new sentence (curly ’ in both), `source === 'Amit Gupte'`, `context` and the other fields equal their literals | unit |
| AC-9 | Same describe › `it('wilssens-com says about eight family mailboxes and nothing else changed')`: exact `outcome`. `feed.json` untouched: `git diff --name-only origin/main...HEAD` in the tester's review | unit / review |
| AC-10 | `src/resume.test.ts` › `it('csx-data keeps Perfect Day first …')` (unchanged, already pins all five points). Recommendations, `source` values, `impact`, `profile.summary`, `teamSize`, `skills`, `honors`, `news`, other roles and cases: `git diff origin/main...HEAD -- src/resume.ts` read line by line by the tester, and `git diff --name-only origin/main...HEAD` limited to the files AC-10 lists; `public/og-image.png` absent from it | review check |
| AC-11 | `src/resume.test.ts` › `it('raises the questions the dates and numbers leave open')` (unchanged: no question `about === 'impact'`) plus a new assertion in the AC-6 test that `impact` still has the `~30%` entry with `backing: 'csx-data'`. TODO wording: diff review. No new unexplained-number finding: `node scripts/resume-check.mjs` and `npm run check:recruiter` output compared with the baselines in Recruiter impact | unit / review / recruiter-check |
| AC-12 | `npm run resume:build` log (no `--force`, layout line no tighter than main's), `node scripts/resume-check.mjs --baseline https://steven.wilssens.com/resume-report.json` (100 → 100), `gates` on the PR. In tests: `it('matches src/resume.ts and passes the resume checks')` (pages ≤ 2, `ats.errors === 0`) and `it('keeps the first bullet of every older Microsoft role')` (fails on a fall back that drops bullets) | named check / unit |
| AC-13 | `src/resume.test.ts` › new `it('prints the new experimentation bullet under the Group PM role, and no longer the old one')`: the full normalized bullet lies between "principal group product manager - windows & devices data" and the next heading; `text` does not contain "scaled experimentation adoption". Cosmos: the test asserts the sentence only if `scripts/resume.mjs` prints early-role summaries, and otherwise carries a one-line comment saying the PDF does not print them (the developer states which in the PR) | unit (on the real PDF) |
| AC-14 | `src/App.test.tsx`: `/experience` shows the new bullet and the Cosmos sentence, not "Scaled experimentation adoption"; extend `it('shows the selected work from the data and AI years, each case with its source')` with the three outcomes (`getByText` with the exact strings), "As described by" + Amit Gupte on `windows-quality` and `okr-tool` (`within` each case), no "the family’s mailboxes". The built `dist/experience/index.html` and `dist/work/index.html`: the lead's `grep` in the PR evidence (the prerender uses the same `App`) | component / build check |
| AC-15 | `npm run check:recruiter` on the lead's build (≥ 80, no new high), `npm test`, `npm run lint`, `npm run test:coverage`, `npm run build` | named checks |

Edge cases and rules for the tests:

- Quotes: the source uses a curly ’ ("Microsoft’s", "family’s", "team’s"); exact-string
  tests use the curly form, PDF tests the normalized form, so a straight ' in
  `src/resume.ts` fails the exact test.
- Empty field: `workArrangement` is a required `string` in the profile type, so the
  components need no empty branch. PM decision: no guard (AC-2), which overrides the
  designer's "not rendered when empty" and the developer's `profile.workArrangement &&`.
  If a guard is added anyway, it needs a test with `vi.doMock('./resume')` and an empty
  value, or the branch drops `src/App.tsx` / `scripts/resume.mjs` below 90%.
- The PDF sentence wraps across lines in the narrow cell: the once-only count runs on
  normalized text with line-break hyphens joined, and must not match twice if the header
  also prints location.
- No snapshots, no network (`read_site_page` tests keep their fetch stub), no timers
  involved.
- No gate script changes (`scripts/*-check.mjs` untouched); if one does, it needs its
  `scripts/*.test.mjs` (a `major`).

Coverage stays at or above 90% (statements, branches, functions, lines) and every new
or changed file is at 90% or more on its own: `src/App.tsx`, `src/webmcp.ts`,
`functions/_lib/mcp/tools.ts`, `functions/_lib/ask/prompt.ts` (`scripts/resume.mjs` and
`scripts/resume-mail.mjs` are outside the coverage scope; the
PDF tests above are its check). The merge review reads them in `coverage-summary.json`.

**Verdict on the spec:** `APPROVE`. Every criterion maps to a test or a named check.
Two notes for the developer: update the existing
`windows-devices-data` literal test rather than adding a second one beside it, and
`dist/` content (AC-2, AC-14) is shown by the lead's grep on the build, backed by
component tests on the same `App`.

## Open questions for Steven

None of these block the build. Each says what the team does if Steven does not answer.

1. **The new outcomes on `/work` sit under "As described by Amit Gupte in his
   recommendation", but Amit did not say them** (recruiter R1). The new
   `windows-quality` outcome (every Windows team, roughly 30%) replaces the only sentence
   that echoed Amit ("the critical data products that measured and elevated Windows
   quality"). The `okr-tool` addition (six months, Viva Goals) is also not in his text.
   A hiring manager who opens the recommendation will see the difference. Keep the
   attribution as it is, or show your additions without his name? *Team
   recommendation:* ship your wording and keep `source` as you asked. Then, in a
   follow-up pull request, add a marker for the sentences that are your own word, so
   that the card credits only Amit's sentence to him. For `windows-quality`, append his
   line again after yours ("Colleagues describe these as the critical data products that
   measured and elevated Windows quality.").
2. **The roughly 30% now has a sentence, but not a role bullet.** Should `csx-data` get
   a bullet such as "Cut issue days by about 30% across Perfect Day scenarios", saying
   what was measured and over what period? *Team recommendation:* not in this change (you
   said change nothing else, and the PDF prints only the first `csx-data` bullet). The
   TODO stays open and points to the case.
3. **"About eight family mailboxes" against the 3 that `/building-wilssens` shows**
   (recruiter R2). The `wilssens-com` card links to the write-up, which shows 3 "family
   mailboxes hosted at Zoho" (`feed.json`, 2026-10-15, live from
   `/api/building/wilssens`). Does eight include forwarding addresses? *Team
   recommendation:* ship your wording now. If eight includes addresses that are not full
   mailboxes, say "about eight family addresses" in a follow-up. If the feed undercounts,
   fix the count on wilssens.com's side.
4. **Should the work-arrangement line also go into your LinkedIn texts?** The
   `compare_linkedin` recommended "About" is built from these fields. *Team
   recommendation:* yes, in a follow-up. This pull request exposes the field to the
   site, the PDF, WebMCP, the MCP and the site assistant.
5. **Only if the build hits it: the PDF can't keep every older role's first bullet with
   the new line.** Would you rather shorten one of your sentences or lose those bullets?
   *Team recommendation:* shorten nothing yourself until you have seen the before/after.
   The pull request waits for your answer in that case (AC-12). The line is placed in
   the "Looking for" row from the start, which is the roomiest option.

## Build note (senior-developer, 2026-10-21)

Built as specified, with one deviation in the PDF placement (Design 4, AC-3), for the
design reviewer and the PM to accept or send back:

- **PDF placement.** As specified (a `<br>` and a second line in the "Looking for" cell),
  the sentence wraps to about three lines in that 1.35fr cell. That was enough to push
  the build from main's layout ("1 bullet on the older Microsoft roles, compact type") to
  "0 bullets, compact type": every older Microsoft role lost its first bullet (Perfect
  Day, spatial audio, Azure DevOps), the case AC-12 fails. Tried without rewording,
  without the header and without `--force`: the line inline after "available now" (still
  0 bullets), a wider first cell, 1.8fr (still 0 bullets). What fits main's layout: the
  sentence as one full-width line under the three facts (`.facts .arrangement`,
  `grid-column: 1 / -1`), with the facts row gap set to `2px 16px` so the new row adds
  one text line and no gap. It is in the facts row, in the same 9.2pt ink, with no label.
  It is not in the header, and no word changed. In the extracted text it comes after
  "Background" and before the summary, not between "Looking for" and "Scope". The AC-3
  test asserts once, after "Looking for", before the summary. If the designer rejects
  it, the in-spec placement means 0 older bullets and Open question 5 goes to Steven.
- **Guards.** No empty-value guard, per the PM's decision (the field is a required string).
- **Results.** `npm run resume:build` (no `--force`): ATS 100 → 100, 2 pages, 359 KB, 0
  errors, 0 warnings, layout "1 bullet on the older Microsoft roles, compact type", the
  same as main. The checker's only question is still the Cosmos/Info Support date overlap
  (expected, AC-5). The PDF prints early-role summaries, so the AC-13 test does assert
  the Cosmos sentence. `npm run lint`: 0 errors (the warnings were already there).
  `npm run test:coverage`: 79 files, 1008 tests pass; overall 99.48 / 97.54 / 99.26 /
  99.87 (statements / branches / functions / lines). Per changed file, all ≥ 90:
  `App.tsx` 99.4 / 99.1 / 98.6 / 100, `webmcp.ts` 100 / 94.1 / 100 / 100,
  `mcp/tools.ts` 99.0 / 98.3 / 97.1 / 99.5, `ask/prompt.ts` 98.7 / 91.7 / 100 / 100,
  `resume.ts` 100. `npm run build` passes. `npm run check:recruiter`: 80/100 (main's
  data on the live pages: 80/100), 0 high, "not worse for recruiters than main".
- **dist/ greps.** The sentence appears once in `dist/index.html` and once in
  `dist/about.html`. `dist/experience.html` has the new bullet and the Cosmos sentence.
  `dist/work.html` has the three new outcomes and "As described by" four times. Neither
  file has "Scaled experimentation adoption" or "the family’s mailboxes". The prerender
  writes `<page>.html`, not `<page>/index.html` as the ACs say.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE (final, reconciled 2026-10-21) | | About pair in; contact band out; assistant dossier line and change-email label in, rules byte-identical; no empty-value guard; Open questions 1-4 are follow-ups, 5 only if the build hits it |
| Senior recruiter | APPROVE (conditions in Recruiter impact) | | Baseline 80/100 recruiter, ATS 100/100; questions R1, R2 |
| Senior designer | APPROVE (hero fourth fact, About pair, PDF "Looking for" line) | | About placement for the PM to reconcile |
| Senior developer | APPROVE (feasible; no migration, no dependency) | | PM: add src/App.css (and the About pair) to AC-10; decide on resume-mail.mjs label and ask/prompt.ts line; PDF layout fallback reported, never forced |
| Security engineer | APPROVE (no new entry point; escape the field in the PDF template, relocation rules unchanged) | | Public, first-party text only |
| Senior tester | APPROVE (test plan: AC-1 to AC-15 mapped) | | Update the existing windows-devices-data literal test; dist/ greps in PR evidence |
