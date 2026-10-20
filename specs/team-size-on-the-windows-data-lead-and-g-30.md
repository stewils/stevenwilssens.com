# Team size on the Windows Data Lead and Group PM roles says what grew and what changed

Slug: `team-size-on-the-windows-data-lead-and-g-30` · Branch: `update/team-size-on-the-windows-data-lead-and-g-30` · Status: built (2026-10-20; reconciled by the PM on 2026-10-20)
Asked by Steven on 2026-10-20 (approved proposal, through the MCP): "1) Role "csx-data" (Principal Product Manager Lead - Windows Data, Feb 2020 - Dec 2024): add a new first bullet: "Grew the team from one to five direct reports, leading to promotion to Principal Group Product Manager." 2) Role "windows-devices-data": replace the bullet "Led a PM organization of 10 to 20, initially through three people managers, and designed its move to a flatter structure; roughly half the team was promoted under my leadership." with: "Led a PM organization of about 20, initially through three people managers, then led its move to a flatter team of about 12 during Microsoft's cost reductions; roughly half the team was promoted under my leadership." Leave the summary, profile teamSize and skills unchanged. Change nothing else. The ATS score must stay 100/100; never --force."

Trivial change (two roles' bullets in `src/resume.ts` and the regenerated PDF): short spec per `.claude/team.md` step 4.

## Problem

A hiring manager comparing candidates for a group PM or director role screens on people
leadership first: how big the team was, whether the candidate grew it, and how they
handled a reorganization. Today Steven's two latest roles answer that badly:

- **Principal Product Manager Lead - Windows Data (`csx-data`, Feb 2020 - Dec 2024)** has
  no people-leadership bullet at all. The four bullets are about quality measurement, so a
  reader sees an individual-contributor-sounding role and cannot tell how Steven got from
  "PM Lead" to "Principal Group PM" in the next role.
- **Principal Group Product Manager (`windows-devices-data`, Dec 2024 - Sep 2026)** says
  "a PM organization of 10 to 20 ... designed its move to a flatter structure". "10 to 20"
  reads as vague (which was it?), and "designed" undersells it: Steven led the move, and
  it happened during Microsoft's cost reductions, which is the context a hiring manager
  needs to read a shrinking team correctly rather than as a demotion or a loss.

Evidence: Steven's own word, in the approved proposal quoted above (the dossier is the
source for these facts; nothing here is inferred). These bullets appear on `/experience`
(every bullet of every role), in the MCP server's and WebMCP's role data, in the
assistant's context and in the résumé PDF, all read from `src/resume.ts`.

**What the PDF prints, and the trade-off this change makes there.** The PDF prints every
bullet only for the two latest roles (`experiences.slice(0, 2)` in `scripts/resume.mjs`:
`independent-ai-builder` and `windows-devices-data`). `csx-data` is the third role and is
condensed: it prints its first `olderBullets` bullets in array order. The developer
measured that main's PDF already uses layout 3 of 4, "1 bullet on the older Microsoft
roles, compact type" (`olderBullets: 1, compact: true`), ATS 100/100, two pages. So:

- `windows-devices-data`: the new bullet replaces the old one in the PDF, in full.
- `csx-data`: today the PDF prints only "Redefined Windows quality measurement ... Perfect
  Day metric ...". With the new first bullet it prints only "Grew the team from one to five
  direct reports ...". The Key achievements strip still prints "+5% Perfect Day improvement
  for Windows gaming" and "~30% fewer issue days across Perfect Day scenarios" (both
  `backing: 'csx-data'`), but nothing in the PDF defines Perfect Day any more. No check
  catches this (`resume-check.mjs` checks only that the impact value is printed).
- The site is unaffected: `/experience` still shows all five `csx-data` bullets, and
  `backing` is still met there.

The PDF gains the promotion line a group-PM screen looks for and loses the definition behind
two of its own headline numbers. Steven's instruction says "new first bullet" and he is
not available, so the team builds it first, as instructed, and puts the trade-off to him
as open question 7 with a recommendation. If `npm run resume:build` falls further back
to the 0-bullet layout (`olderBullets: 0`, which would strip every older Microsoft role of
its only bullet) or the ATS score drops below 100, the builder stops: no data change
beyond the instruction, no reordering or trimming of other bullets, never `--force`, and
the result is reported to the lead for Steven.

Readers served: recruiters and hiring managers (the first and closest read of the two
latest roles); peers checking his work see the same history.

## Outcome

On the site and in the résumé, the Windows Data Lead role shows that Steven grew his team
from one to five direct reports and was promoted for it, and the Group PM role gives a
concrete size (about 20, then about 12) and the reason the team became flatter.

## Acceptance criteria

Each one checked against `src/resume.ts`, the regenerated PDF and the built pages.

- AC-1: In `src/resume.ts`, the `points` of the experience with `key: 'csx-data'` start
  with exactly "Grew the team from one to five direct reports, leading to promotion to
  Principal Group Product Manager." followed by its four existing bullets, unchanged and
  in their current order (5 bullets total).
- AC-2: In `src/resume.ts`, the `points` of `key: 'windows-devices-data'` contain exactly
  "Led a PM organization of about 20, initially through three people managers, then led
  its move to a flatter team of about 12 during Microsoft's cost reductions; roughly half
  the team was promoted under my leadership." in the first position, where the old bullet
  was; the string "Led a PM organization of 10 to 20" appears nowhere in `src/resume.ts`;
  the other seven bullets are unchanged and in the same order. The apostrophe follows the
  file's existing convention (the other bullets use the typographic `’`, e.g.
  "Microsoft’s high-profile push"); either form satisfies this criterion as long as the
  PDF and the site show the same text.
- AC-3: `git diff main -- src/resume.ts` touches only those two `points` arrays: `profile`
  (including `summary` and `teamSize: '10 to 20 product managers'`), `skills`, `impact`,
  `selectedWork`, the role titles, dates, summaries and every other experience are
  byte-for-byte unchanged. No other file under `src/` or `functions/` changes, and no
  component hard-codes either bullet.
- AC-4: `public/steven-wilssens-resume-2026.pdf` is regenerated by `npm run resume:build`
  (not by hand, not with `--force`; its output says "Wrote ..." and has no "Forced:"
  line). The PDF's extracted text (tester's check C-2) contains the full new
  `windows-devices-data` bullet and "Grew the team from one to five direct reports, leading
  to promotion to Principal Group Product Manager.", and does not contain "PM organization
  of 10 to 20". `src/resume.test.ts` passes; it proves only that the PDF carries the first
  60 characters of the `windows-devices-data` bullet. It does not check `csx-data`
  bullets at all (condensed role, index 2), so the `csx-data` bullet's presence in the PDF
  is proven by C-2 alone.
- AC-5: `node scripts/resume-check.mjs --baseline https://steven.wilssens.com/resume-report.json`
  on the new PDF reports an ATS score of 100/100 (100 → 100), the PDF is still at most two
  pages, and there is no new `point-windows-devices-data`, `tense-*` or `pages` finding
  compared with main. (The checker does not test `csx-data` bullets, so a
  `point-csx-data` finding can never fire and is not evidence for this criterion.)
- AC-6: The built `/experience` page (prerendered HTML in `dist/`) shows the new
  `csx-data` bullet as the first bullet of that role and the new `windows-devices-data`
  bullet in place of the old one.
- AC-7: `npm run check:recruiter` is not lower than on main.
- AC-8: `npm run lint`, `npm run test:coverage` (90% or more overall) and `npm run build`
  pass. No test changes are expected; if a test asserts the old bullet text, it is updated
  to the new text and nothing else.
- AC-9: No change to `.claude/`, the workflows or the gate scripts, so `/building-this-site`
  and the Team page need no update (stated so the PM's check can confirm it).
- AC-10 (designer, with the recruiter's addition): the pull request states the layout
  (`olderBullets`, `compact`) that `npm run resume:build` picked on main and on the branch
  (its `Layout:` line; no line means `olderBullets: 2`), and which `csx-data` and
  `spatial-audio-lead` bullets each PDF prints. Expected from the developer's measurement:
  main and branch both at "1 bullet on the older Microsoft roles, compact type"; `csx-data`
  prints "Redefined Windows quality measurement ..." on main and "Grew the team from one to
  five direct reports ..." on the branch; `spatial-audio-lead` prints "Led the Microsoft
  Spatial Audio Platform ..." on both. Evidence: the tester's C-4 (layout on both) with C-2
  run on both PDFs.
- AC-11 (stop rule): the branch PDF is not at layout `olderBullets: 0` and its ATS score is
  100. If either fails after the two instructed edits, the builder makes no further data
  change (no reordering, no trimming, no `--force`), keeps or reverts the PDF as
  `resume:build` leaves it, and reports the `Layout:` line and the score to the lead; the
  change then waits for Steven.

Evidence for the PR: the tester's named checks C-1 (the data), C-2 (the PDF text), C-3
(the built `/experience` page) and C-4 (the layout on main and the branch), with their
output, as listed in the Test plan.

## Out of scope

- `profile.teamSize` ("10 to 20 product managers"), `profile.summary` ("I lead teams of 10
  to 20 product managers") and the home page's "led 10 to 20 product managers" stay as they
  are, by Steven's instruction. Whether they should move to "up to 20" is an open question
  below, a follow-up if he says yes.
- `skills`, `impact`, `selectedWork`, the role titles and dates.
- A `selectedWork` entry or an impact number for the team growth or the promotion.
- Regenerating the share image (headline and photo unchanged).
- Any change to the LinkedIn comparison; Steven updates LinkedIn himself.

## Recruiter impact (senior-recruiter)

**First ten seconds: no change.** Neither bullet is on the home page. The 390px first
screen (who he is, the role he wants, Seattle and the green card, contact, the résumé
link) and the hero's "led 10 to 20 product managers" are untouched. The paths a recruiter
uses (résumé PDF, contact, LinkedIn, experience, the assistant, the job description check)
keep their links; only the text behind two of them changes.

**Close read (`/experience`, the PDF, the assistant): better.** I would have asked for this
before forwarding him to a hiring manager for a group PM or director role.

- `csx-data` today reads like a senior IC role with "Lead" in the title: four quality
  bullets, no people. The new bullet answers what every hiring manager asks of a "PM Lead
  → Group PM" step: did he grow a team, and was he promoted for it. It also explains the
  title change on the timeline (Dec 2024) instead of leaving it to be decoded.
- `windows-devices-data`: "10 to 20" read as a hedge and "designed its move to a flatter
  structure" as advisory. "About 20, through three people managers, then a flatter team of
  about 12 during Microsoft's cost reductions" gives a peak size, shows managers of
  managers, and puts the shrink in context, so 20 → 12 does not read as a demotion or
  attrition. "Led" is stronger than "designed" and is Steven's word.
- Sources: both bullets are Steven's recorded word (the approved proposal). No new number
  goes on the home page or into `impact`, so no `backing` is needed. The promotion is
  checkable on the timeline (the next role, "Principal Group Product Manager", starts Dec
  2024). Tense: "Grew" and "Led" are past and in neither checker's present-tense list.
- Consistency: the summary, `teamSize` and skills keep "10 to 20 product managers". That
  stays true (about 12 to about 20) and now reads as the range, with the bullet as the
  detail; not a contradiction a sceptical reader would catch.
- The assistant reads `src/resume.ts`, so "How large a team has he led?" should now answer
  about 20 PMs through three managers, then about 12, and one to five direct reports in
  the Windows Data role. The only hard-coded "10 to 20" under `functions/_lib/ask/` is the
  local `ASK_MOCK` canned answer (`agent.ts`, `mockStream`), never served in production;
  no assistant change is needed. I put the three questions to the preview at merge.

**Push-back on the PM: none on the wording.** "Leading to promotion" could read as
self-promotional, but it carries what a recruiter uses (level progression), so it earns
its place. The unchanged "roughly half the team was promoted" now follows two sizes, and a
hiring manager may ask "half of 20 or of 12?"; an interview question, not a blocker
(question 6). The Problem section's "both roles are the two most recent, so all their
bullets are printed" is wrong, as the designer found: the two detailed roles in the PDF are
`independent-ai-builder` and `windows-devices-data`; `csx-data` is condensed. PM to fix.

> PM reconciliation note: the developer measured that main's PDF is already at
> `olderBullets: 1, compact`, so the "`olderBullets: 2`" case below does not exist today
> and the "`olderBullets: 1`" case is the status quo. On the branch `csx-data` prints only
> "Grew the team ..." and Perfect Day loses its PDF definition (the recruiter's "worse"
> case). The 250%+ for `spatial-audio-lead` is already unexplained in main's PDF and is
> not caused by this change. Steven's "first bullet" instruction is built as given; the
> trade-off is open question 7. See the Problem section.

**The PDF trade-off the designer raised (my call as the recruiter).** In the PDF,
`csx-data` prints only its first `olderBullets` bullets, so the new first bullet pushes one
out:

- **At `olderBullets: 2` (acceptable, build as asked).** The PDF prints "Grew the team ..."
  and "Redefined ... Perfect Day metric for issue-free user days" and drops "Drove
  measurable quality gains ... about 5%". The strip's "+5% Perfect Day improvement for
  Windows gaming" stays readable on its own, because its label says what it measures and
  the bullet above defines Perfect Day. The site still prints every bullet, and `backing`
  is still met. For someone screening for a group PM, a people-growth line in the third
  role is worth more than a second Perfect Day line. Not worse.
- **If the build falls back to `olderBullets: 1` (worse, a merge finding).** `csx-data`
  then prints only "Grew the team ...", so "Perfect Day" (two numbers in the Key
  achievements strip) is defined nowhere in the PDF. Every older Microsoft role also loses
  a bullet, and `spatial-audio-lead` loses "Grew monthly active devices ... more than
  250%", which explains the strip's 250%+. That makes three strip numbers unexplained in
  the document recruiters forward. If main is already at `olderBullets: 1`, only the
  `csx-data` swap is new, and Perfect Day losing its definition is still a finding. In
  either case the developer must not trim bullets or use `--force`: the PR goes back to
  Steven with question 7.
- So I support the designer's AC-10 and add a condition to it: the PR states the layout
  `npm run resume:build` chose on main and on the branch, and the `csx-data` and
  `spatial-audio-lead` bullets each PDF prints.

**Baseline and expected effect** (run today on this branch, which is still main at
08852fd: no change made yet)

| Check | Baseline | Expected after | Why |
|---|---|---|---|
| `npm run check:recruiter` | **80/100** (main's data on the live pages: 0 high, 4 medium: `scope:csx-data`, `scope:azure-devops`, `scope:spatial-audio-lead`, `linkedin` not imported; 11 questions) | **80/100**, not worse | `windows-devices-data` still meets the scope rule ("PM organization of about 20", "team of about 12"). `scope:csx-data` stays open: the rule (`functions/_lib/review/recruiter.ts`, `scopeWords`) needs digits ("5 product managers", "team of 5") and "one to five direct reports" is in words. See question 5. |
| `node scripts/resume-check.mjs` | **ATS 100/100**, 2 pages, 0 errors, 0 warnings; `--baseline` live: 100 → 100, the same | **100/100**, provided it stays at two pages | Every `windows-devices-data` bullet is printed and checked (`point-*`). The résumé scope warning still matches "10 to 20 product managers" in the summary. A third page would be an `ats` error; `resume:build` would then refuse to replace the PDF, and AC-4 and AC-5 fail, which is the right outcome. |

Without a `dist/`, `npm run check:recruiter` prints 50/100: five "page not in this
deployment" findings and no résumé report. That reflects the missing build, not the data.
The merge comparison runs on the lead's build. Weight, meta tags, the share image and the
first screen do not change.

**Verdict on the spec: APPROVED_WITH_CONDITIONS.** (1) The PM corrects the Problem
section on what the PDF prints. (2) AC-10 is adopted with the `spatial-audio-lead`
addition above. (3) A fall-back to `olderBullets: 1` caused by this change is treated as
worse, and the PR goes to Steven (question 7) instead of being worked around.

## Design (ux-designer)

Content only: no component, class, token or stylesheet changes. Two bullet strings in
`src/resume.ts` render through the existing markup on `/experience` and in the PDF. What
follows is what renders differently, and one PDF consequence the team must weigh.

**Where the text renders**

| Surface | Markup / style (unchanged) | `windows-devices-data` | `csx-data` |
|---|---|---|---|
| `/experience` timeline | `.timeline-body ul/li` in `src/App.css` (14px, line-height 1.65, `--muted`, column max 700px) | all 8 bullets, new one first | all 5 bullets, new one first |
| Résumé PDF | `scripts/resume.mjs`: `.role.detailed` vs condensed `.role li` (8.8pt) | detailed role: every bullet printed | **condensed role: only the first `olderBullets` (2, 1 or 0) printed** |
| Home, graph nodes, other pages | do not read `points` | no change | no change |
| MCP, WebMCP, assistant, LinkedIn compare | text, not layout | new text | new text |

Correction for the Problem section (PM to fix): the PDF's two detailed roles are
`experiences.slice(0, 2)`, i.e. `independent-ai-builder` and `windows-devices-data`.
`csx-data` is the third role and is printed condensed, so not all its bullets are printed.
For the same reason `resume-check.mjs` only checks bullets of the first two roles
(`index < 2`), so a `point-csx-data` finding (AC-5) can never fire; it is not evidence
either way.

**What changes in the PDF (the one real design consequence)**

The condensed `csx-data` role prints its *first* bullets. Putting the new bullet first
pushes the Perfect Day bullets down:

> PM reconciliation note: main is measured at `olderBullets 1`, compact (the bottom row of
> the sketch), so on the branch Perfect Day is no longer defined in the PDF. The
> `olderBullets 2` row is kept for reference only. Built as instructed; open question 7.

```
main, layout olderBullets 2             branch, layout olderBullets 2
• Redefined Windows quality ...         • Grew the team from one to five ...
  Perfect Day metric ...                • Redefined Windows quality ...
• Drove measurable quality gains,         Perfect Day metric ...
  Perfect Day improving about 5% ...    (the +5% bullet is no longer printed)

layout olderBullets 1                   layout olderBullets 1
• Redefined ... Perfect Day ...         • Grew the team from one to five ...
                                        (Perfect Day is no longer printed at all)
```

The PDF's Key achievements strip prints "+5% Perfect Day improvement for Windows gaming"
and "~30% fewer issue days across Perfect Day scenarios", both `backing: 'csx-data'`.
On the branch, the bullet that explains +5% leaves the PDF in every layout, and with one
older bullet the term "Perfect Day" is printed in the strip with nothing in the PDF
explaining it. The site is unaffected (it prints every bullet). No check catches this:
`resume-check.mjs` only tests that the impact *value* is in the PDF.

This is a content trade-off for the recruiter and Steven, not a layout fix. Options, in
the order I recommend:
1. Build as asked, and the developer reports in the PR which layout `npm run resume:build`
   chose on main and on the branch and which `csx-data` bullets each PDF prints (AC
   below), so the recruiter judges the PDF with the real result in hand.
2. If the recruiter finds the unexplained +5% worse than the missing promotion line in the
   PDF, put the new bullet *second* (after "Redefined ..."). That departs from Steven's
   "first bullet" wording, so it is his call, recorded as an open question, not done
   silently.

Proposed acceptance criterion (PM to adopt or reject): **AC-10:** the PR states the layout
(`olderBullets`, `compact`) `npm run resume:build` picked on main and on the branch, and
the `csx-data` bullets each PDF prints.

**Line lengths and wrapping**

Bullet lengths: old Group PM bullet about 170 characters, new about 214 (+44); new
`csx-data` bullet about 103. Estimates with Manrope at the styles above:

| Surface | Chars per line (approx.) | Group PM bullet | New `csx-data` bullet |
|---|---|---|---|
| `/experience` 1440 (700px column, 14px) | 95-100 | 2 lines → 3 | 2 lines (1 + a short tail) |
| `/experience` 390 (333px after 20px shell padding, 17px indent) | 45-48 | 4 lines → 5 | 3 lines |
| `/experience` 320 (WCAG reflow, 263px) | 36-38 | 5 lines → 6 | 3 lines |
| PDF (about 5.8in bullet column, 8.8pt) | 90-100 | 2 lines → 3 | 2 lines |

So the Group PM role grows by one line everywhere and the `csx-data` role by one bullet.
On the site that is a few pixels of extra page height, nothing else: no long unbreakable
tokens (the longest word is "Principal"/"leadership"), `minmax(0, 700px)` and the 1fr
phone column wrap normally, no horizontal scroll at 390 or 320. The new `csx-data` bullet
may end in a one- or two-word widow at 1440 ("Manager." alone); acceptable for a list of
bullets, and `text-wrap: pretty` is not worth a new rule for one line.

In the PDF the extra line in the detailed role plus the new condensed bullet add roughly
two lines. The build tries the roomier layout first and falls back (`olderBullets` 2 → 1,
then compact) when the résumé runs past two pages, so this can tip the whole PDF into
the next layout and take a bullet away from *every* older Microsoft role, not just this
one. That is the second reason for AC-10. The two-page limit itself holds (AC-5).

**States**

- Empty, loading, error: none; static text, prerendered into `dist/experience/index.html`.
- No JavaScript: identical to the hydrated page (the bullets are in the prerendered HTML;
  the experience graph above them is unchanged).
- Very long content: covered above; the longest bullet on the page stays the
  "Shifted the team to AI-driven analytics ..." one.
- Light and dark: same tokens (`--muted` for list text), so contrast is exactly what main
  has; nothing to check beyond the screenshot.

**Copy**

Exactly the strings in AC-1 and AC-2. Use the typographic apostrophe in "Microsoft’s",
as every other bullet in the file does; a straight `'` would be the only one on the page
and in the PDF. Both bullets keep the existing pattern: past-tense verb first, one
sentence, ending with a period. "about 20 ... about 12" reads cleanly; no change to the
wording from me.

Consistency note for the recruiter, not a design blocker: the home hero facts still say
"led 10 to 20 product managers" (`profile.teamSize`) above a bullet that now says "about
20, then about 12". Both are true; open question 1 already covers it.

**Accessibility**

No interactive element changes: keyboard path, focus order, labels and reduced motion are
as on main. The list stays a real `ul > li`, so screen readers announce "list, 5 items" for
`csx-data` and "8 items" for the Group PM role.

**Flow diagram**: not applicable; no change to the agent flow or a reader's path.

**Pages to screenshot**: `experience` at 1440 and 390 (`--slices`), branch against main,
to confirm the wrapping above, plus the PDF's page with the older Microsoft roles before
and after (the real point of this review). `home` and `admin` do not render these strings
and need no shots. Before/after pairs for Steven: the `/experience` phone slice with the
Group PM role, the `/experience` phone slice with the Windows Data Lead role, and the PDF
experience section.

**Verdict (spec)**: APPROVED_WITH_CONDITIONS. Layout is safe. Conditions: the Problem
section's "both roles ... all their bullets are printed" is corrected (`csx-data` is
condensed in the PDF); AC-10 (or an equivalent line in the test plan) records the PDF
layout and the printed `csx-data` bullets on main and the branch; and the PDF trade-off
(the new first bullet displaces the +5% Perfect Day bullet that backs a Key achievements
number) goes to the recruiter and, if they find it worse, to Steven as an open question.

## Threat model (security-engineer)

Content only: two bullet strings in `src/resume.ts` and the PDF that `npm run resume:build`
regenerates from it. No route, tool, input, token, table, header, dependency or workflow
changes, so the attack surface is the same as main. Where the text goes, and what I checked:

| Sink | How the bullet reaches it | Risk | Holds because |
|---|---|---|---|
| `/experience` (prerendered + hydrated) | React text node from `experiences[].points` | XSS | React escapes text; no `dangerouslySetInnerHTML` on `points`; neither string contains `<`, `>`, `&` or a URL |
| Résumé PDF | `scripts/resume.mjs` builds HTML for the headless browser | HTML injection in the render | every point goes through `esc(point)` (line 43); the source is Steven's own committed file, not visitor input |
| Public `/mcp`, `/mcp/<key>`, WebMCP (`src/webmcp.ts`) | role data returned as JSON | data exposure | `src/resume.ts` is public by design; nothing leaves that is not already on `/experience` |
| Assistant (`functions/_lib/ask/prompt.ts`) | role bullets go into the system context | prompt injection, cost | the text is first-party and trusted and carries no instructions; it adds about 60 tokens to the context, negligible next to the existing rate and cost limits |
| `syncProposals` (`functions/_lib/mcp/proposals.ts`) | compares the deployed points with Steven's approved proposal | a proposal wrongly marked applied or left open | `norm` maps `’` to `'`, so the typographic apostrophe (Q4) still matches his proposal; this is about integrity, not security |

**Privacy and sensitivity.** Only `public` dossier facts may reach the site and the
assistant. Both bullets are Steven's own words, in a proposal he approved for publication,
so publishing them is his decision, not an inference. They name no colleague, report or
family member. "Five direct reports", "three people managers" and "roughly half the team
was promoted" are counts, and in a team of about 12 to 20 people they identify no one.
"Microsoft's cost reductions" points to Microsoft's publicly reported layoffs and describes
Steven's own team, with no figures, dates, org names or internal plans. No action needed.
At merge, reviewers flag any extra detail in the diff beyond the two approved strings.

**Abuse cases considered and ruled out.** No untrusted input is added, so no injection
path opens. The bullets are committed as literals, not built from the dispatch payload at
run time. No secret or token is near the diff.

**Required controls (all existing, none new)**

- C-1: the diff touches only `src/resume.ts` (the two `points` arrays) and
  `public/steven-wilssens-resume-2026.pdf` (plus this spec). Proof: AC-3 and AC-9.
- C-2: the committed strings are exactly the two approved bullets. Proof: AC-1 and AC-2.
- C-3: the PDF comes only from `npm run resume:build`. Proof: AC-4 and `src/resume.test.ts`.
- C-4: rendering still escapes the text. Proof: the existing suites pass unchanged (AC-8).

**Verdict (spec): APPROVED.**

## Technical approach (senior-developer)

**Files to change** (nothing else):

- `src/resume.ts` line 10 (`csx-data`): prepend "Grew the team from one to five direct
  reports, leading to promotion to Principal Group Product Manager." to `points`.
- `src/resume.ts` line 9 (`windows-devices-data`): replace `points[0]` with the new Group
  PM bullet, typographic `’` in "Microsoft’s" (file convention). `syncProposals` matches
  the approved proposal either way: `norm()` in `functions/_lib/mcp/proposals.ts` folds
  `’` to `'`, so the proposal is marked applied once deployed.
- `public/steven-wilssens-resume-2026.pdf`: regenerated by `npm run resume:build`, never
  `--force`.

**Data flow, what stays the same.** Every consumer reads `points` from `src/resume.ts`:
`/experience` (all bullets), `scripts/resume.mjs` (PDF), the MCP and WebMCP role data, the
assistant context, the LinkedIn comparison. No component, test, fixture, workflow or
generated file hard-codes the old bullet (searched the repository outside `node_modules`
and `dist`: the old text occurs only in `src/resume.ts` and this spec). Tests that touch
these bullets read them by index from the data (`review-tools.test.ts`
`experiences[1].points[0]`, `review.test.ts` `points[0]` of `windows-devices-data`) and
follow the change; the `'Led a PM organization of 12.'` in `review-tools.test.ts` is a
fixture proposal, not the real bullet. No migration, no D1, no new dependency, no
`impact`/`backing` change (`+5%` and `~30%` keep `backing: 'csx-data'`; the site still
prints every bullet). Checkers: "Grew" and "Led" are not in `presentTense`
(`scripts/resume-check.mjs:63`, `functions/_lib/review/recruiter.ts:23`); the first 60
characters of the new Group PM bullet contain no apostrophe, so the `point-*` match is
not sensitive to the `’` choice.

**How the PDF picks bullets (the designer's question), and what main does today.**
`scripts/resume.mjs` prints `experiences.slice(0, 2)` (`independent-ai-builder`,
`windows-devices-data`) in full, and every later Microsoft role with
`points.slice(0, olderBullets)`, i.e. its *first* bullets by array order; there is no
ranking. `buildResume` tries `layouts` in order (`{2,false}`, `{1,false}`, `{1,compact}`,
`{0,compact}`) and keeps the first that fits two pages.

I ran `node scripts/resume.mjs --out /tmp/main-resume.pdf` on this branch (still main's
data): **main already uses layout 3 of 4, `olderBullets: 1, compact: true`** ("Layout: 1
bullet on the older Microsoft roles, compact type"), ATS 100/100, 2 pages. So the
designer's and recruiter's "olderBullets: 2" scenario does not exist today; their
"olderBullets: 1" case is the status quo. Consequences on the branch, with certainty:

- `csx-data` prints exactly one bullet in the PDF. Today that is "Redefined Windows quality
  measurement ... Perfect Day metric ..."; on the branch it becomes "Grew the team from one
  to five direct reports ...". The PDF's Key achievements strip still prints "+5% Perfect
  Day improvement for Windows gaming" and "~30% fewer issue days across Perfect Day
  scenarios", and nothing in the PDF defines Perfect Day any more. No check fails on this
  (`resume-check.mjs` only verifies the impact *value* appears and that `backing` is set).
  By the recruiter's condition (3) this is a finding and question 7 applies; it is a
  content decision, not something to engineer around.
- `spatial-audio-lead` already prints only "Led the Microsoft Spatial Audio Platform ..."
  on main, so the 250%+ is already unexplained in the PDF today. Not caused by this change;
  noted so nobody attributes it to it.

**Risk of a further fallback to `{olderBullets: 0, compact: true}`.** Net height change in
the compact layout: the Group PM bullet goes from about 170 to 214 characters, about 2 to 3
lines in the detailed column (+1 line, about 11pt at 8.7pt × 1.24); the condensed
`csx-data` line swaps a 150-character bullet (2 lines) for a 103-character one (1 to 2
lines), 0 to -1 line. Net 0 to +1 line. It tips only if page 2 of main's PDF has less than
one line to spare, which I could not measure in this session (running a scratch build with
the changed data needed approval). If it does tip, every older Microsoft role loses its
only bullet, a clear regression for recruiters, and `resume:build` will say so in its
`Layout:` line. The builder must then stop and hand it to the PM and recruiter (question
7), not trim other bullets or `--force`. Moving the new bullet second (Q7's recommendation)
would not help with *that* case; at `olderBullets: 1` it would only restore the Perfect Day
definition and drop the promotion line from the PDF.

**Build steps.** Edit the two `points`; `npm run resume:build` and record its full output
(the `Layout:` line is AC-10's evidence; main's is "1 bullet ..., compact type"); confirm
"Wrote ... (score 100 → 100)" without "Forced:"; `npm run lint`, `npm run test:coverage`,
`npm run build`; then the tester's C-1 to C-4. No share image (headline and photo
unchanged).

**Feasibility verdict: buildable as written.** One correction the spec needs before the
build: the Recruiter impact and Design sections assume main is at `olderBullets: 2`; it is
at `olderBullets: 1, compact`. The PM should restate the trade-off with that fact: building
as asked removes the only PDF line that defines Perfect Day (recruiter's "worse" case), so
either Steven accepts it, or question 7's alternative (new bullet second in `points`, which
also changes the order on `/experience` and departs from his "first bullet") is his call.
Steven is not available and the ask says first, so I build it first and flag it in the PR
unless the PM decides otherwise.

## Test plan (senior-tester)

Content only: no code under `src/` or `functions/` changes apart from data in
`src/resume.ts`, and no gate script changes, so no new test file and no new
`scripts/*.test.mjs` are required. What already exists and what it does and does not
catch:

**What the existing tests catch, and what they miss**

- `src/resume.test.ts` › "the resume PDF" › "matches src/resume.ts and passes the resume
  checks" runs `analyzeResume()` (`scripts/resume-check.mjs`) on the committed PDF and
  fails on any `error`. For bullets it checks **only the first two roles** (`index < 2`)
  and **only the first 60 characters** of each bullet (`point.slice(0, 60)`, normalised
  for apostrophes, dashes and whitespace).
  - `windows-devices-data` (index 1): a stale PDF fails the test, because the new
    bullet's first 60 characters ("Led a PM organization of about 20, initially through
    three p") are not in the old PDF. A wording slip *after* character 60 ("then led its
    move to a flatter team of about 12 during Microsoft’s cost reductions …") is **not**
    caught.
  - `csx-data` (index 2): **not covered.** The test checks only its title, company, dates
    and summary. If the bullet were added to `src/resume.ts` and the PDF not regenerated,
    or the bullet were missing from the PDF, `npm test` would still pass. So AC-4's
    "`src/resume.test.ts` passes" alone does not prove the `csx-data` bullet is in the PDF;
    the named check C-1 below does.
  - For the same reason AC-5's "no new `point-csx-data` finding" can never fire (the
    designer said the same); it is harmless but is not evidence.
- No test asserts the old bullet text. The only "10 to 20" strings in tests are the home
  hero (`src/App.test.tsx`, from `profile.teamSize`, unchanged) and fixtures in
  `review-tools.test.ts`, `review.test.ts`, `resume-mail.test.mjs`, `building-brief.test.mjs`
  and `agent.test.ts` that use their own strings. Tests that read the real bullets
  (`review-tools.test.ts` `experiences[1].points[0]`, `review.test.ts` `points[0]` of
  `windows-devices-data`, `linkedin-branches.test.ts`) read them from `src/resume.ts` and
  follow the change. So AC-8's "no test changes" should hold; a test edited to pass is a
  finding.

**Is a new test warranted?** No test pinning the exact two bullets. A unit test that
repeats strings from `src/resume.ts` asserts the data equals itself, has to be edited at
every wording change, and protects nothing the named checks below do not. The real gap is
general, not this change's: the PDF-drift test does not look at the condensed roles
(`csx-data` and older) at all. Closing it means changing `scripts/resume-check.mjs`, a
gate script, which is out of scope for a content-only change; it is a follow-up (finding
below).

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | C-1 (`csx-data` points: 5, the new one first, the four old ones in order, read from `src/resume.ts`); the reviewer diffs `git diff origin/main -- src/resume.ts` | named check |
| AC-2 | C-1 (`windows-devices-data` points: 8, new one at index 0, old text absent); `src/resume.test.ts` › "matches src/resume.ts and passes the resume checks" (first 60 characters in the PDF) | named check + unit |
| AC-3 | `git diff --stat origin/main...HEAD` lists only `src/resume.ts`, the PDF and the spec; `git diff origin/main...HEAD -- src/resume.ts` shows exactly two changed `points` lines (lines 9 and 10 today); `grep -rn "about 12 during\|one to five direct" src functions --include=*.tsx` finds nothing | named check |
| AC-4 | `npm run resume:build` output ("Wrote …", no "Forced:"); `src/resume.test.ts` › "matches src/resume.ts and passes the resume checks"; C-2 (extracted PDF text) | build + unit + named check |
| AC-5 | `node scripts/resume-check.mjs --baseline https://steven.wilssens.com/resume-report.json` (100 → 100, `pages` 2, no new `tense-*` or `pages` finding); `src/resume.test.ts` asserts `pages <= 2` and `ats.errors === 0` | resume check + unit |
| AC-6 | C-3 on `dist/experience/index.html` | site-check |
| AC-7 | `npm run check:recruiter` on the lead's build: 80/100 or more (baseline in the recruiter section) | recruiter-check |
| AC-8 | `npm run lint`; `npm run test:coverage` (90% overall and per file; `src/resume.ts` is data and stays at 100%); `npm run build`; `git diff --name-only origin/main...HEAD -- '*.test.*'` is empty | CI |
| AC-9 | `git diff --name-only origin/main...HEAD -- .claude .github scripts` is empty | named check |
| AC-10 (designer, recruiter) | C-4: the `Layout:` line `npm run resume:build` prints (no line = `olderBullets: 2`) on main and on the branch, and the `csx-data` and `spatial-audio-lead` bullets C-2 finds in each PDF, written into the PR | named check |

**Named checks** (run from the repository root; results go into the PR evidence)

- **C-1, the data** (Node 22.18+ loads `src/resume.ts` directly, as `resume-check.mjs` does):
  `node --input-type=module -e "const {experiences} = await import('./src/resume.ts'); for (const k of ['csx-data', 'windows-devices-data']) { const r = experiences.find((e) => e.key === k); console.log(k, r.points.length); r.points.forEach((p, i) => console.log(i, p)) }"`.
  Expect `csx-data 5` with "Grew the team from one to five direct reports, leading to
  promotion to Principal Group Product Manager." at 0 and "Redefined …", "Drove …",
  "Provided …", "Built …" at 1 to 4; `windows-devices-data 8` with the new bullet at 0 and
  "Owned strategy and roadmap …" at 1. `grep -c "PM organization of 10 to 20" src/resume.ts`
  prints 0; `grep -c "'10 to 20 product managers'" src/resume.ts` prints 1 (teamSize kept).
- **C-2, the PDF.**
  `node --input-type=module -e "const {extractPdf, resumePath} = await import('./scripts/resume-check.mjs'); const t = (await extractPdf(resumePath)).text.replace(/\s+/g, ' ').replace(/’/g, \"'\"); for (const s of ['Grew the team from one to five direct reports, leading to promotion to Principal Group Product Manager.', \"then led its move to a flatter team of about 12 during Microsoft's cost reductions; roughly half the team was promoted under my leadership.\", 'PM organization of 10 to 20', 'Redefined Windows quality measurement', 'Drove measurable quality gains', 'Grew monthly active devices playing spatial audio']) console.log(t.includes(s) ? 'present' : 'absent ', s)"`.
  Expect the first two present, "PM organization of 10 to 20" absent; the last three
  feed AC-10 (at the measured `olderBullets: 1, compact`: on the branch "Redefined",
  "Drove" and "Grew monthly" all absent; on main "Redefined" present, the other two absent). If a bullet wraps with a hyphen in the extracted text, search a shorter
  fragment and say so.
- **C-3, the page.** `grep -o "Grew the team from one to five direct reports[^<]*" dist/experience/index.html`
  and `grep -o "Led a PM organization of about 20[^<]*" dist/experience/index.html` each
  print the full bullet; `grep -c "PM organization of 10 to 20" dist/experience/index.html`
  prints 0. Order: in that file the new `csx-data` bullet comes right after the
  `csx-data` summary and before "Redefined Windows quality measurement".
- **C-4, the layout.** In a separate worktree of `origin/main`
  (`git worktree add /tmp/main origin/main`), run `npm run resume:build -- --out /tmp/main.pdf`;
  on the branch, `npm run resume:build`. Record each run's `Layout:` line (no line means
  `olderBullets: 2`) and run C-2 on both PDFs (`extractPdf('/tmp/main.pdf')` for main).

**Commands, in order**: `npm run resume:build` (never `--force`), C-1, C-2,
`node scripts/resume-check.mjs --baseline https://steven.wilssens.com/resume-report.json`,
`npm run lint`, `npm run test:coverage`, `npm run build`, C-3, `npm run check:recruiter`,
C-4.

**Edge cases**

- Apostrophe: either `’` or `'` in "Microsoft’s" passes `resume-check` (it normalises
  both); C-2 normalises too. The PDF and the page must show the same character (C-3 with
  the full bullet).
- Two pages: main is already at `olderBullets: 1`, compact; the new text adds net 0 to +1
  PDF line. AC-10 records the layout; a fall-back to `olderBullets: 0` or a lower ATS
  score triggers AC-11's stop rule (back to Steven). A third page is an `ats` error: `resume:build` refuses to replace
  the PDF and `src/resume.test.ts` fails, which is the right outcome.
- Stale PDF: committing `src/resume.ts` without the PDF fails `src/resume.test.ts` through
  the `windows-devices-data` bullet only; the `csx-data` half is caught by C-2, not by
  `npm test`.
- Past tense: both bullets start with "Grew"/"Led"; `tense-*` stays clean (AC-5).
- Determinism: nothing new; `src/resume.test.ts`'s `dataQuestions` uses a fixed date, and
  `analyzeResume()` reads only the committed PDF (no network).

**Finding for a follow-up (developer, minor, not this change):** `scripts/resume-check.mjs:151`
checks the bullets of the two latest roles only, so the PDF-drift test in
`src/resume.test.ts` misses a stale or missing bullet in any condensed role (`csx-data` and
older), and a change after the first 60 characters of a detailed bullet. Fix: record the
chosen layout in the PDF (e.g. its metadata) and check the first `olderBullets` bullets of
each condensed role, with a case in `src/resume.test.ts` (or a `scripts/resume-check.test.mjs`)
that fails on a PDF missing a condensed role's first bullet.

Coverage stays at or above 90% (statements, branches, functions, lines) and every new
or changed file is at 90% or more on its own.

### Build evidence (senior-developer, 2026-10-20)

Built first as instructed: the two `points` edits in `src/resume.ts` (lines 9 and 10, typographic
`’` in "Microsoft’s") and the PDF regenerated by `npm run resume:build`. Nothing else changed
(`git status`: `src/resume.ts`, the PDF, this spec). AC-11's stop rule did not trigger.

- **`npm run resume:build`** (no `--force`): current PDF on the new data 1 `site` error (the
  stale `windows-devices-data` bullet, expected); new PDF "ATS score 100/100, 2 pages, 356 KB,
  0 errors, 0 warnings"; "Layout: 1 bullet on the older Microsoft roles, compact type, to fit
  two pages."; "Wrote …/public/steven-wilssens-resume-2026.pdf (score 100 → 100)". No
  "Forced:" line. The only question is the existing `cosmos` / Info Support date overlap.
- **C-1, the data:** `csx-data 5`: 0 "Grew the team from one to five direct reports, leading
  to promotion to Principal Group Product Manager.", 1 "Redefined …", 2 "Drove …",
  3 "Provided …", 4 "Built …". `windows-devices-data 8`: 0 the new bullet, 1 "Owned strategy
  and roadmap …", 2 to 7 unchanged. "PM organization of 10 to 20" in `src/resume.ts`: 0;
  `'10 to 20 product managers'`: 1 (teamSize kept). "about 12 during" / "one to five direct"
  under `src` and `functions` (`.ts`/`.tsx`): only `src/resume.ts`.
- **C-2, the PDF** (branch): present "Grew the team from one to five direct reports, leading to
  promotion to Principal Group Product Manager."; present "then led its move to a flatter team
  of about 12 during Microsoft's cost reductions; roughly half the team was promoted under my
  leadership."; absent "PM organization of 10 to 20"; absent "Redefined Windows quality
  measurement"; absent "Drove measurable quality gains"; present "Led the Microsoft Spatial
  Audio Platform"; absent "Grew monthly active devices playing spatial audio". No hyphenated
  wraps; the full strings matched.
- **`node scripts/resume-check.mjs --baseline https://steven.wilssens.com/resume-report.json`:**
  ATS 100/100, 2 pages, 0 errors, 0 warnings; "ATS score 100 → 100: the same as the live
  site." No `point-*`, `tense-*` or `pages` finding.
- **C-3, the page:** the prerendered page is `dist/experience.html` (not
  `dist/experience/index.html` as written above). It carries both full bullets, with the
  typographic `’` as in the PDF; "PM organization of 10 to 20" does not occur; order in the
  file: `csx-data` summary, then "Grew the team …", then "Redefined Windows quality
  measurement".
- **C-4, the layout** (main measured by building main's `src/resume.ts`, identical to
  `origin/main` at 08852fd, to `/tmp/main.pdf` with `--out`; the branch data was restored
  afterwards and `git diff` shows only the two `points`):

  | | Layout line | ATS | `csx-data` prints | `spatial-audio-lead` prints |
  |---|---|---|---|---|
  | main | 1 bullet on the older Microsoft roles, compact type | 100/100, 2 pages | "Redefined Windows quality measurement …" | "Led the Microsoft Spatial Audio Platform …" |
  | branch | 1 bullet on the older Microsoft roles, compact type | 100/100, 2 pages | "Grew the team from one to five direct reports …" | "Led the Microsoft Spatial Audio Platform …" |

  As predicted: the layout holds, the PDF's `csx-data` line is now the promotion, and
  Perfect Day is no longer defined in the PDF (Q7).
- **`npm run lint`:** 0 errors (existing warnings in admin and assistant files only).
- **`npm run test:coverage`:** 79 files, 993 tests passed; total statements 99.48%,
  branches 97.54%, functions 99.26%, lines 99.87%; `src/resume.ts` 100%. No test file changed.
- **`npm run build`:** passes; 16 pages prerendered; the built résumé report 100/100, 2 pages.
- **`npm run check:recruiter`:** 80/100 (main's data on the live pages: 80/100), "Not worse
  for recruiters than main's data on the live pages."

## Open questions for Steven

Steven is not available; the build follows his instruction as given and does not wait on
these. Each has the team's recommendation. Numbering is kept stable because the sections
above refer to it; question 7 is the one that matters most for this pull request.

1. The Group PM bullet now says "about 20 ... then about 12", while `profile.teamSize`, the
   summary and the home page still say "10 to 20 product managers"; keep them, or change
   them to "up to 20 product managers" in a follow-up? Recommendation: keep them for now,
   as instructed; "10 to 20" still covers both numbers and the recruiter check's scope
   rule matches it, so a follow-up is optional.
2. Did the promotion to Principal Group Product Manager happen at the end of the `csx-data`
   role (Dec 2024, the start of `windows-devices-data`), so the new bullet and the next
   role's start date tell the same story? Recommendation: assume yes, since the next role
   starts that month; no change needed either way.
3. Should the team growth ("one to five direct reports") also be added to the
   `windows-quality` selected work, which already says "Led the PM team"? Recommendation:
   no; the role bullet is enough and selected work is out of scope.
4. Your text has a straight apostrophe in "Microsoft's"; may the bullet use the
   typographic "Microsoft’s" like every other bullet in the file? Recommendation: yes, and
   the build does so; the words are unchanged, and `syncProposals` still marks your
   proposal applied (it folds `’` to `'`).
5. (Recruiter) Were the five direct reports in the Windows Data role all product managers?
   If so, "Grew the team from 1 to 5 product managers, leading to promotion to Principal
   Group Product Manager." says who the team was, puts the number in digits so a skimming
   eye catches it, and closes the recruiter review's `scope:csx-data` finding (80 → 85).
   Recommendation: a follow-up wording change only if Steven confirms. This change ships
   his exact words.
6. (Recruiter) "Roughly half the team was promoted": half of the about 20, or of the about
   12? Recommendation: no change now. Steven should have the answer ready, because a
   hiring manager will ask.
7. (Recruiter, designer, developer; merged) The PDF prints one bullet per older Microsoft
   role (main's layout already). With "Grew the team ..." first, the PDF's `csx-data` line
   is the promotion and Perfect Day is no longer defined anywhere in the PDF, while its
   Key achievements strip still shows "+5%" and "~30%" Perfect Day numbers (the site is
   unaffected). Keep it first as you asked, or move it to second place, after "Redefined
   ... Perfect Day metric ..."? Recommendation: move it second, in a follow-up once you
   confirm. The PDF then keeps the definition behind two of its headline numbers, the
   promotion stays visible in the PDF through the next role's title and Dec 2024 start, and
   no claim is cut. Note that `points` order drives both the site and the PDF, so on
   `/experience` it would also be the second bullet. This pull request ships it first, as
   instructed. (The 250%+ for `spatial-audio-lead` is already unexplained in main's PDF;
   not caused by this change.)

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVED | | Reconciled: Problem corrected (only `independent-ai-builder` and `windows-devices-data` print every bullet; main is at `olderBullets: 1, compact`, so the PDF's `csx-data` line becomes the promotion and Perfect Day loses its PDF definition). Built first as instructed; trade-off is Q7 with a recommendation. AC-4/AC-5 no longer lean on `src/resume.test.ts` or `point-csx-data` for `csx-data`; AC-10 (layout and printed bullets on main and branch) and AC-11 (stop at `olderBullets: 0` or a lower ATS score, never `--force`) added; C-1 to C-4 are the PR evidence. |
| Senior recruiter | APPROVED_WITH_CONDITIONS | | Problem section corrected on what the PDF prints; AC-10 with `spatial-audio-lead`; a fall-back to `olderBullets: 1` goes to Steven (Q7). Baseline: recruiter 80/100, ATS 100/100. |
| Senior designer | APPROVED_WITH_CONDITIONS | | Layout safe, content only. Conditions now addressed: Problem section corrected (`csx-data` is condensed in the PDF), AC-10 adopted, and the displaced Perfect Day line put to Steven as Q7. Screenshots at merge: `experience` 1440 and 390, branch against main, plus the PDF's older-roles page. |
| Senior developer | APPROVED_WITH_CONDITIONS | | Buildable as written; no code, test or fixture hard-codes the old bullet. Main's PDF is already at `olderBullets: 1, compact`, so the new first `csx-data` bullet replaces the only PDF line defining Perfect Day (recruiter's "worse" case, Q7): PM restates the trade-off. Fallback to `olderBullets: 0` (net 0 to +1 line) not measured; if `resume:build` reports it, stop and escalate, no `--force`. |
| Security engineer | APPROVED | | Content only, no new surface. Both bullets are wording Steven approved for publication, with no names and nothing confidential. At merge: confirm the diff is only the `src/resume.ts` points and the regenerated PDF (C-1 to C-3). |
| Senior tester | APPROVED_WITH_CONDITIONS | | No new test: a test repeating the two strings proves nothing. `src/resume.test.ts` catches a stale PDF only through the `windows-devices-data` bullet (first 60 characters); the `csx-data` bullet (condensed role, index 2) is checked by no test, so C-1 to C-4 must appear in the PR evidence. AC-5's `point-csx-data` cannot fire. Follow-up (developer, minor): `resume-check.mjs` should check the bullets printed for condensed roles. |
