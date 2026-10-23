# Building this site: the assistant section says the dashboard counts the people who asked

Slug: `building-steven-wi-46` · Branch: `update/building-steven-wi-46` · Status: built
Asked by Steven (Site update workflow, Building refresh): "Refresh the Building write-up about steven.wilssens.com (/building-this-site, src/articles/site/SiteArticle.tsx) after a check-in on stewils/stevenwilssens.com: 'Merge ask-people: the assistant page shows how many different people used Ask about Steven and what each of them asked'."

## Problem

Peers and hiring managers read `/building-this-site` to judge how Steven measures what he
ships. The check-in `357b10d` (merged 19 October 2026, spec `specs/ask-people.md`)
changed what the assistant keeps and what Steven sees: every question now goes to
`ask_log` with the analytics' daily visitor code, redacted, with the answer beside it,
kept 90 days; nothing is logged on previews, and nothing at all is kept when the browser
sends Global Privacy Control or Do Not Track; a pasted job description is kept only as
its length and first words; `/admin` → Ask about Steven → **People who asked** counts
people (once a day, like visitors) and lists what each asked (README.md, "Log" bullet).

The write-up's section 05 ("An assistant that knows only what I published") still says,
at `SiteArticle.tsx` line 182, "Questions, cost, votes and the unanswered questions go
to the dashboard, …". That sentence is no longer the whole story in two ways a reader
cares about:

- the measurement story: Steven can now tell whether thirty questions came from one
  curious recruiter or fifteen, the same "how many people" view the tracker gives page
  views (section 03, line 146);
- disclosure: a recruiter who uses the assistant is now logged (redacted, 90 days), and
  the article's analytics paragraph (line 146) already sets the precedent of saying
  plainly what is kept and when nothing is.

Nothing else in the article contradicts the check-in. The check-in changed only
`README.md` among the orchestration and source-of-truth files (no change to `CLAUDE.md`
or `.claude/`), so the loop, the team flow and their diagrams (`Diagrams.tsx`:
`LoopDiagram`, `TeamFlowDiagram`) are unchanged. The `sources/` folder was missing in
this run; the check-in was read from git (`git diff 357b10d^1 357b10d -- README.md
CLAUDE.md .claude`) and `specs/ask-people.md`.

## Outcome

A reader of section 05 learns, in one or two plain first-person sentences, that the
dashboard also shows how many different people asked and what each asked, that the log
is kept 90 days, and that nothing is kept when the browser asks not to be tracked.

## Final wording (settled at reconciliation; build this text)

Replace the text of the `<p>` at main's line 182 with exactly this (typographic
punctuation as in the rest of the file; the link is a plain `<a href="/privacy">`, as
at line 146, no class):

```tsx
<p>Questions, cost, votes and the unanswered questions go to the dashboard, which also shows how many different people asked, counted once a day like visitors, and what each of them asked. I keep the log of questions and answers 90 days, and nothing at all when the browser <a href="/privacy">asks not to be tracked</a>. The numbers that matter are public, here, straight from the database. I measured what I shipped at Microsoft; the assistant gets the same treatment, including the numbers that do not flatter it.</p>
```

84 words against main's 44 (+40). Based on the recruiter's suggestion, with one change:
"I keep that log 90 days" becomes "I keep the log of questions and answers 90 days", so
the 90 days is tied to a log the sentence names (C-2) and matches `/privacy` ("your
questions and its answers are kept for 90 days"), without claiming everything is deleted.
The link text "asks not to be tracked" is the recruiter's and is accepted by the designer
and security: it says what the link explains, and is not "here".

## Acceptance criteria

- AC-1: `git diff main -- src/` changes only `src/articles/site/SiteArticle.tsx` (the
  paragraph at line 182 of main: section 05, the `<p>` between `</ul>` and
  `<ReportCard />`) and `src/articles/articles.test.tsx` (the new test, AC-13).
  `Diagrams.tsx`, `feed.json`, the header comment and every other file under `src/` are
  unchanged. No file under `.claude/`, `.github/` or `scripts/` changes (this is not an
  orchestration change, so "The loop", `TeamFlowDiagram` and the Mermaid chart stay as
  they are).
- AC-2: The new paragraph, in first person, says that the dashboard shows how many
  different people asked, "counted once a day like visitors", and what each of them
  asked.
- AC-3: The new paragraph says the log of questions and answers is kept 90 days, and
  that nothing at all is kept when the browser asks not to be tracked, with those words
  linked to `/privacy` (`<a href="/privacy">asks not to be tracked</a>`).
- AC-4: The paragraph keeps its existing claims, in this order: questions, cost, votes
  and the unanswered questions on the dashboard (with the people count and the 90 days
  right after); the public numbers here, straight from the database; the Microsoft
  measurement line last, ending "the numbers that do not flatter it", directly above
  `<ReportCard />`.
- AC-5: No number from `src/articles/site/feed.json` or `/api/ask/report` is typed into
  the text, and no figure is added that the article did not already state: the only
  digits in the paragraph are `90`. "90 days" is a retention rule (README, `/privacy`),
  not a feed number.
- AC-6: Nothing private is added: no table, binding, environment variable, secret, salt,
  module or migration name (`ask_log`, `ask_questions`, `ask_hits`, `HASH_SALT`,
  `ASK_BUDGET_USD`, `visitor.ts` …), no budget amount or limit value beyond what the
  article already says, no redaction pattern list, and no visitor's question, company,
  count or date of use.
- AC-7: The paragraph grows by at most 40 words (the final wording adds exactly 40; the
  test allows main's count + 45 for typographic slack); section 05 stays exactly one
  `<p>` between the `<ul>` and the report card.
- AC-8: The header comment (line 15) keeps "20 October 2026", matching `feed.json`
  `asOf` (`2026-10-20…`); the closing "as of" date still renders from `feed.asOf`.
- AC-9: `npm run lint`, `npm run test:coverage` (90% or more overall and per changed
  file, `SiteArticle.tsx` on all four metrics) and `npm run build` pass; the
  prerendered `dist/building-this-site/index.html` and `dist/building-this-site.md`
  carry "different people", and in the Markdown copy the AC-6 pattern finds nothing in
  the paragraph and the `/privacy` link resolves.
- AC-10: `npm run check:recruiter` scores no lower than on main (80/100 on the
  recruiter's baseline) with no new high finding; the résumé ATS score is unchanged
  (100/100; `src/resume.ts` and the PDF untouched).
- AC-11: The privacy claim is no broader than the code: the paragraph does not contain
  "anonymous", "unique people", "deleted" or "everything is deleted", and does not say
  nothing is kept past 90 days. Previews and pasted job descriptions are not mentioned
  (Q2).
- AC-12: The only link added is the internal `/privacy` as a plain `<a>`; no external
  `href`, no `dangerouslySetInnerHTML`, no new import.
- AC-13: A new test in `src/articles/articles.test.tsx`, "the assistant section says the
  dashboard counts the people who asked, kept 90 days, nothing kept when the browser asks
  not to be tracked", renders `<SiteArticle />` and asserts on the `<p>` before the
  report card in the `#assistant` section: first person; `/different people/`,
  `/once a day/`, `/what each/`, `/90[ -]days?/`, a link to `/privacy` whose text matches
  `/asks not to be tracked/`; the kept claims `/Questions, cost, votes and the unanswered
  questions/`, `/straight from the database/`, `/numbers that do not flatter it/` (and
  that the Microsoft sentence ends the paragraph); no match for
  `/ask_log|ask_questions|ask_hits|HASH_SALT|ASK_BUDGET|visitor\.ts|migration|USD|\$/`
  nor `/anonymous|unique people|deleted/i`; digits equal `['90']`; exactly one `<p>`
  between the `<ul>` and the report card; word count at most main's + 45. Regexes, not
  exact strings, so curly quotes do not break it.

Reconciliation notes: AC-3 now ties the 90 days to the log (recruiter, security C-2,
developer), not to "the questions"; AC-7's "about 40 words" (PM) and the tester's
"main's + 45" are both kept, as target and test tolerance; the link text is settled as
"asks not to be tracked" (the recruiter's wording, which the designer and security
accept; the developer's "privacy page" was an example, not a requirement); the tester's
edge case "no `/privacy` link fails AC-3" stands, so the link is required, not
optional. AC-11 to AC-13 fold in security C-1 to C-5 and the tester's new test.

## Out of scope

- Any diagram change: the loop diagram shows the unanswered questions, which did not
  change; the team flow did not change.
- Changing the report card (`ReportCard`, `/api/ask/report`) to show a people count; a
  public "people who asked" number would be a feature with its own spec (follow-up, if
  Steven wants it).
- Rewriting section 03's analytics paragraph or the `/privacy` page (already updated by
  `ask-people`).
- `feed.json` values and the closing paragraph.

## Recruiter impact (senior-recruiter)

**Baseline (main `9336a39`, 23 October 2026).**

- `npm run check:recruiter`: main's data on the live pages scores **80/100**. The same
  run scores this worktree 50/100 only because `dist/` was not built when I ran it
  (every page "not in this deployment", no résumé report): that is the missing build,
  not the content. After the build, the branch must score 80/100 or more with no new
  high finding.
- Résumé ATS score (`node scripts/resume-check.mjs`, and `--baseline` against the live
  report): **100/100**, 2 pages, 0 errors, 0 warnings, "the same as the live site". One
  open question for Steven (cosmos 2004–2005 overlapping Info Support), unchanged and
  out of scope here.

**First ten seconds.** Nothing changes. The paragraph sits in section 05 of
`/building-this-site`, far below the fold. The home page, the résumé PDF, contact,
LinkedIn, experience, the assistant and the job description check are untouched.
`src/resume.ts`, `src/pageMeta.ts` and the PDF are not in the diff (AC-1, AC-10), so the
page's title, description and share image stay as they are.

**Close read.** This page is read by a hiring manager or a peer judging how Steven
measures what he ships. The sentence helps, for two reasons:

- *Measurement.* "How many different people asked" is the question a product leader
  should ask of a feature, because counting questions alone flatters it. It matches
  section 03's visitor count and the paragraph's own "numbers that do not flatter it".
  That is good for credibility, and it adds no number (AC-5).
- *Disclosure.* A recruiter who uses the assistant is the person being logged. Saying
  so, with the 90 days and the opt-out, is what a careful hiring manager expects from
  someone who has shipped products that handle personal data, and it matches the
  analytics paragraph. Leaving it out would be the less credible choice.

**Risks to the bar.**

- *"What each of them asked" can read as watching recruiters.* This is the one phrase a
  sceptical reader could take badly ("does he see that I asked about salary, and who I
  am?"). The facts answer that: a daily code, no IP address, email addresses and phone
  numbers redacted, nobody followed across days (`specs/ask-people.md`). Keep the
  wording neutral and short, and let the link to `/privacy` carry the detail. Do not
  write "anonymous" or "unique people": a hashed daily code is neither, and either word
  would overstate it.
- *Accuracy against `/privacy`* (the developer's point, which I share): questions Steven
  has answered or set aside keep the question past 90 days. So the 90 days should
  attach to the log, not to "the questions", or a careful reader who opens `/privacy`
  finds the two pages disagree.
- *Length.* Section 05 is already dense, so about 40 words is the ceiling (AC-7). No new
  bullet and no number.
- *Tone.* No self-praise ("a powerful dashboard…"). State plainly what is kept, like the
  rest of the page.

**Suggested wording** (first person, about 38 added words, keeps every AC-4 claim):

> Questions, cost, votes and the unanswered questions go to the dashboard, which also
> shows how many different people asked, counted once a day like visitors, and what each
> of them asked. I keep that log 90 days, and nothing at all when the browser
> [asks not to be tracked](/privacy). The numbers that matter are public, here, straight
> from the database. I measured what I shipped at Microsoft; the assistant gets the same
> treatment, including the numbers that do not flatter it.

**What a recruiter would ask, and whether the change answers it.**

1. "If I ask the assistant about Steven, is my question kept?" Yes, for 90 days, and not
   at all when the browser opts out. Answered.
2. "Does he see who I am?" The paragraph does not say. `/privacy` does (no IP address, a
   daily code, contact details redacted), and the link gets there in one click. That is
   enough.
3. "How many people have used it?" Deliberately not public (out of scope, Q3). That is
   fine: the report card already gives the public numbers, and a public people count is
   a separate decision with its own spec.

**Pushback on the criteria.** None. AC-2 and AC-3 are about what the reader learns, not
about making Steven look good. I agree with the recommendations on Q2 (leave how pasted
job descriptions are kept to `/privacy`) and Q3 (no public people count in this change).

**Verdict: APPROVE (spec).** Before merge I will check that the built
`dist/building-this-site.md` carries the sentence, that the `/privacy` link resolves,
that `check:recruiter` is no lower than 80/100 with no new high finding, and that the
ATS score is still 100.

## Design (ux-designer)

**What renders differently: one paragraph's text, nothing else.** The change replaces the
words inside an existing `<p>` in section 05 of `/building-this-site`
(`SiteArticle.tsx` line 182 on main, the paragraph before `<ReportCard />`). The element,
its place in the section and its styling stay as they are: it has no class and inherits
`.wx-body p` (17px, line-height 1.75, `margin: 0 0 22px`, inside the 780px `.wx-body`
column, `src/articles/wilssens/article.css`). No component, token, diagram (`LoopDiagram`,
`TeamFlowDiagram`), screenshot, report card, TOC entry or heading changes, so the layout
at 1440px and 390px, in light and dark, is main's with a taller paragraph. The only
possible new element is an inline link to `/privacy` (the AC-3 option); it takes the
existing `.wx-body a` style (`var(--green)`, underline offset 3px), already used in
section 03 and throughout the article in both themes. No new token or pattern.

**Layout sketch (390px, section 05, after the change)**

```
05  An assistant that knows only what I published
[intro paragraph]
[Ask panel screenshot]
- Its knowledge is ...          (4 bullets, unchanged)
Questions, cost, votes and the unanswered     <- same <p>, ~13-15 lines
questions go to the dashboard ... how many       instead of ~8
different people asked and what each asked
... 90 days ... nothing at all when the
browser asks not to be tracked ... the
numbers that do not flatter it.
[ReportCard]                                  <- unchanged, moves down
```

At 1440px the paragraph runs at the 780px measure (about 12-14 words a line): 6-8 lines
instead of about 4.

**Reading on a phone.** Today the paragraph is about 55 words; at the AC-7 cap it is
about 95. At 390px with 17px type that is roughly 7 words a line, so 13-15 lines, some
400px tall: under one screen, and shorter than the section 06 paragraph at line 200
(about 150 words), so it does not break the article's rhythm. Two asks to the writer
(the recruiter's suggested wording already meets both): (1) keep the order "what reaches
the dashboard, then what is public, then the Microsoft line", with the people count and
the retention up front, so "the numbers that do not flatter it" still lands last,
directly above the report card it introduces; (2) say the privacy part in one short
clause, not a list, and keep section 05 one paragraph before the card (AC-7). If the
draft runs long, cut words, not the disclosure.

**States.** The page is prerendered: the new sentence is in the static HTML and in
`/building-this-site.md` with no JavaScript (AC-9); nothing in it depends on loading, an
error or the feed. No long unbreakable tokens are added (no table or variable names,
AC-6), so no overflow at 320px.

**Keyboard, focus, screen readers, motion.** No new control. If the `/privacy` link is
added it is one more Tab stop in reading order, after the bullets and before the report
card, with the site's existing visible focus style. Its text must say what it explains
("asks not to be tracked" or "privacy page"), never "here", so it reads on its own in a
screen reader's link list. No motion is added; reduced motion is unaffected.

**At the UI check.** Diff-only: `git diff --name-only origin/main...HEAD` touches only
`SiteArticle.tsx` (and its test) under `src/`, and the change sits inside that `<p>`. One
390px slice of section 05 on the branch is enough to confirm the length; no full
before/after set is needed.

**Verdict: APPROVED.** A text-only refresh with no visual, interaction or accessibility
surface beyond one paragraph's length, which stays within one phone screen.

## Threat model (security-engineer)

**Scope.** Copy only: one public `<p>` in section 05 of `SiteArticle.tsx`. No new route,
tool, binding, table, header, script or dependency; no change to `functions/`, the
assistant prompt code, the MCP server or a workflow. The write-up is one of the
assistant's knowledge sources (read from its Markdown copy), so the sentence reaches the
model as public text; it says nothing `/privacy` does not already say publicly.

**New entry points and data.** None. The only new "data" is a public statement about how
assistant questions are kept, so the risks are disclosure of internals and a privacy
claim that does not match the code.

**Abuse cases.**
1. *Internal disclosure.* The sentence names the log table (`ask_log`), the salt
   (`HASH_SALT`), the visitor-code module, the budget variable or amount, or limits
   beyond what the article already states (thirty questions an hour, twelve turns, a
   thousand characters, "a monthly budget" with no amount). That helps an attacker aim
   cost abuse or reason about the hash construction. Likelihood low; impact low to
   moderate.
2. *Privacy claim broader than reality.* Calling the log "anonymous", saying
   "everything is deleted after 90 days", or stating the opt-out more broadly than GPC or
   DNT would promise more than the code does: the daily visitor code makes the log
   pseudonymous, not anonymous, and questions Steven answered or set aside keep the
   question text past 90 days (`/privacy`: "except the questions I have answered or set
   aside: of those only the question itself stays"). A recruiter relying on a false
   claim is a trust and GDPR-transparency problem. Likelihood moderate (an easy wording
   slip).
3. *Visitor exposure.* Quoting or paraphrasing a real visitor's question, or giving a
   people count or date that could point at one company. Likelihood low.
4. *Contradiction.* The write-up, README "Log" bullet, `/privacy` and the panel line
   (`AskAssistant.tsx`: "Questions are kept 90 days") disagree on retention or opt-out.

**Consistency check against the sources (done on main).**
- README "Log": redacted, daily visitor code, answer beside it, 90 days, nothing (not
  even `ask_questions`) under GPC or DNT, not on previews; `/admin` "People who asked"
  counts people once a day and lists what each asked.
- `/privacy` (`renderPrivacy` in `src/App.tsx`): questions and answers kept 90 days with
  the same daily code, emails, phone numbers and keys removed first, "so I can see how
  many people use it"; with GPC or DNT "nothing is recorded".
- The planned claim (questions kept redacted with a daily visitor code for 90 days,
  nothing kept under GPC/DNT, the admin counts the people who asked and what each asked)
  matches both. The admin view is private to Steven; saying it exists discloses no data.
  Not mentioning previews is fine (the preview has no assistant). The recruiter's
  suggested wording ("I keep that log 90 days, and nothing at all when the browser asks
  not to be tracked", linked to `/privacy`) meets C-1 to C-5 below.

**Required controls (wording rules for the paragraph).**
- C-1: No identifier from code or config: no table, binding, env var, secret, salt,
  module or migration name; no budget amount or new limit value (AC-6).
- C-2: The 90 days attaches to the log (questions and answers), never "everything is
  deleted after 90 days"; never "anonymous" or "unique people" (say "counted once a day,
  like visitors"). "Redacted" is accurate if used; do not list the redaction patterns.
- C-3: The opt-out is "nothing is kept" when the browser sends Global Privacy Control or
  Do Not Track (or "asks not to be tracked" linked to `/privacy`), no narrower or
  broader.
- C-4: No visitor's question, company, count or date of use in the text.
- C-5: Any link is the internal `/privacy` as a plain `<a href="/privacy">` (as at line
  146); no external URL, no `dangerouslySetInnerHTML`. The text is static JSX that React
  escapes, so there is no XSS path.

**Tests that prove each control (for the test plan).**
- T-C1: the tester's new `articles.test.tsx` case already asserts the paragraph does not
  match `/ask_log|HASH_SALT|ASK_BUDGET|\$/`; widen it to
  `/ask_log|ask_questions|ask_hits|HASH_SALT|ASK_BUDGET|visitor\.ts|migration|USD|\$/`.
  After the build, the same pattern finds nothing in the paragraph in
  `dist/building-this-site.md`. `git diff main -- src/` touches only that `<p>` (AC-1).
- T-C2/T-C3: the same test checks "90 days" and GPC/DNT or a `/privacy` link (AC-3), and
  adds a negative match on `/anonymous|unique people|everything is deleted/i`; the
  reviewer reads the sentence against README "Log" and `/privacy`.
- T-C4: the test's "only digits are `90`" check (AC-5) also covers counts and dates.
- T-C5: the diff adds no `dangerouslySetInnerHTML`, no external `href`, no import
  (reviewer check).

**Verdict: APPROVED**, with C-1 to C-5 as wording rules the build and the merge review
check. Not `NOT_APPLICABLE`: the sentence is a public privacy claim, so whether it is
accurate matters for security and privacy; but there is no code path and no reachable
vulnerability.

## Technical approach (senior-developer)

Feasible as written: a copy edit to one JSX paragraph, no logic, no new dependency.

**The change.** `src/articles/site/SiteArticle.tsx` line 182 only: the `<p>` in section 05
between `</ul>` and `<ReportCard />`. Rewrite its text inside the same `<p>`; keep it one
element so section 05 stays one paragraph before the card (AC-7). Follow section 03
(line 146) for the disclosure idiom and, if the opt-out is phrased as "asks not to be
tracked", a plain `<a href="/privacy">privacy page</a>` like line 146 (no `text-link`
class inside prose). Use typographic quotes/apostrophes as the rest of the file does.
Nothing else under `src/` changes: not `Diagrams.tsx`, not `feed.json`, not the header
comment at line 15 (keeps "20 October 2026", AC-8).

**What regenerates the text, what asserts it.**

- The Markdown copy `/building-this-site.md` is not committed: `scripts/prerender.mjs`
  writes it into `dist/` at `npm run build` with `htmlToMarkdown` from the prerendered
  HTML, as it does `llms-full.txt`. It picks up the new sentence by itself (AC-9 is
  checked on `dist/building-this-site.md` after the build). An inline `<a>` becomes a
  Markdown link with an absolute `siteUrl` href; nothing to hand-edit.
- The assistant reads that Markdown copy as its knowledge of the write-up
  (`functions/_lib/ask/agent.ts`, `scripts/assistant-export.ts`), so after deploy it can
  tell a reader the questions are kept 90 days and not at all under GPC/DNT. That is true
  and public (`/privacy` already says it), so it is wanted, not a risk. Because the change
  touches a write-up, the Review workflow runs the assistant check on it; no reviewer
  should ask Steven for one.
- No test asserts this paragraph's text: a search for "dashboard", "do not flatter" and
  "Questions, cost" finds it only in `SiteArticle.tsx` and this spec. The tests on the
  article (`src/articles/articles.test.tsx`: title, feed URL, `ReportCard`, team diagram;
  `src/App.test.tsx` route) do not read section 05's prose. `src/articles/feeds.test.ts`
  reads only `const stats` tuples and `feed.numbers.<key>`, so plain text (including
  "90 days") cannot trip it; adding a `feed.numbers` read here is out of scope and would
  break AC-5. `functions/api/ask.test.ts`, `agent.test.ts` and
  `scripts/assistant-export.test.ts` use fixture Markdown, not the real copy.
- Coverage: `SiteArticle.tsx` is already rendered in full by `articles.test.tsx`; a text
  change adds no branch, so per-file coverage is unchanged. No new test is required for
  the build to pass; whether to add a text assertion for AC-2/AC-3 is the tester's call
  (a `render(<SiteArticle />)` + `getByText(/90 days/)` style check would be cheap).

**Risks.**

- Accuracy against `/privacy` (`src/App.tsx`): the privacy page says questions and
  answers are kept 90 days "except the questions I have answered or set aside: of those
  only the question itself stays". So the paragraph must say questions are *kept 90 days*
  (true for the log), not "nothing is kept past 90 days" or "everything is deleted after
  90 days", which would contradict the privacy page.
- "Counted once a day, like visitors": accurate (daily visitor code, the same as the
  tracker), but it must not imply a person is recognised across days; "counted once a
  day" or "the same daily count as visitors" is fine; "unique people" is not.
- Previews log nothing; the write-up need not say so (the preview has no assistant).
- No private name (`ask_log`, `HASH_SALT`, migration number) in the prose (AC-6); the
  README wording is the source, not the text to copy.
- Merge risk: low. Another refresh editing the same line would conflict textually; a
  rebase on main before the build resolves it.

Commands for the build: `npm run lint`, `npm run test:coverage`, `npm run build`, then
check `dist/building-this-site.md` and `dist/building-this-site/index.html` (or the
prerendered path) contain the new sentence; `npm run check:recruiter` for AC-10. No
`resume:build` and no `og-image` (neither `src/resume.ts` nor the photo changes).

## Test plan (senior-tester)

No existing test reads the section 05 paragraph (`src/articles/articles.test.tsx` covers
the report card, the diagrams and the loop sentences; `feeds.test.ts` covers the stats
tuples only). One new test is justified, in the same style as "says that changes to the
team reach Steven…": without it, AC-2 to AC-7 could break with every check still green.

| AC | Check |
|---|---|
| AC-1 | `git diff --stat main -- src/` lists only `src/articles/site/SiteArticle.tsx`; the diff shows one `<p>` changed (reviewer check). Existing diagram tests in `articles.test.tsx` ("the team diagram on /building-this-site") stay green. |
| AC-2, AC-3, AC-4, AC-6, AC-7 | New: `src/articles/articles.test.tsx` › "the assistant section says the dashboard counts the people who asked, kept 90 days, nothing kept when the browser asks not to be tracked". Renders `<SiteArticle />`, takes the `<p>` before the report card in the section of `#assistant` (or its heading): matches first person (`\bI\b\|my`), `/different people/`, `/once a day/`, `/what each/`, `/90 days/`, `/Global Privacy Control\|Do Not Track\|asks not to be tracked/` (and, for the last, a link to `/privacy`); keeps `/Questions, cost, votes and the unanswered questions/`, `/straight from the database/`, `/numbers that do not flatter it/`; does not match `/ask_log\|HASH_SALT\|ASK_BUDGET\|\$/`; section has exactly one `<p>` between the `<ul>` and the report card; word count at most main's + 45. |
| AC-5 | Same new test: the only digits in the paragraph are `90` (`text.match(/\d+/g)` equals `['90']`). Existing `feeds.test.ts` › "reads the stats tuples and the feed.numbers keys…" stays green. |
| AC-8 | Reviewer check that line 15 still says "20 October 2026"; existing `articles.test.tsx` › "keeps every feed in the shape the pages read" covers `feed.asOf`; the closing date renders from `feed.asOf` (unchanged code). |
| AC-9 | `npm run lint`; `npm run test:coverage` with `SiteArticle.tsx` at 90% or more on all four metrics (text-only change, no new branch); `npm run build`, then `grep -l "different people" dist/building-this-site/index.html` and the page's Markdown copy in `dist/`; `npm run check:site`. |
| AC-10 | `npm run check:recruiter` no lower than main; `git diff main -- src/resume.ts public/steven-wilssens-resume-2026.pdf` empty, so `src/resume.test.ts` and the ATS score are unchanged. |

Edge cases: the "asks not to be tracked" wording without a `/privacy` link fails AC-3;
a "90-day" spelling must still match (`/90[ -]days?/`); curly quotes and the `’` in the
paragraph must not break the matchers (use regexes, not exact strings, except for the
kept Microsoft sentence). No timers, network or shared state: the test is a plain render.

Verdict: APPROVED, on condition the new test lands with the change.

## Open questions for Steven

Steven is not reachable in this run; each question carries the recommendation the team
builds on.

1. The refresh instruction dates the write-up 19 October 2026, but the header comment
   already says 20 October 2026 (a later refresh) and `feed.json` `asOf` is 2026-10-20.
   Which date stands? Recommendation: keep 20 October 2026; moving it back would make
   the comment disagree with the feed the closing date renders from.
2. Should the write-up say how the assistant's log treats a pasted job description
   (kept only as its length and first words)? Recommendation: no, to keep the paragraph
   short; `/privacy` says it, and the 90 days and the opt-out are what a reader needs.
3. Should the public report card also show how many people have asked? Recommendation:
   not in this refresh; if yes, a separate spec (it adds a public number).

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE | | Reconciled once: final wording settled; ACs 3, 4, 6, 7 tightened, AC-11 to AC-13 added; Q1 to Q3 carry recommendations. |
| Senior recruiter | APPROVE (spec) | | Baseline check:recruiter 80/100, ATS 100/100; no "anonymous"/"unique people"; 90 days tied to the log. |
| Senior designer | APPROVED | | Text-only; order ends on the Microsoft line above the card; link text descriptive; one 390px slice at the UI check. |
| Senior developer | Feasible as written | | One `<p>` in `SiteArticle.tsx`; Markdown copy regenerates at build; the assistant check runs in CI. |
| Security engineer | APPROVED (C-1 to C-5 as wording rules) | | Public privacy claim; no code path; folded into AC-6, AC-11, AC-12. |
| Senior tester | APPROVED, on condition the new test lands with the change | | New test in `src/articles/articles.test.tsx` (AC-13). |
