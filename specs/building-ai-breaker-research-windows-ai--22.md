# Building AI Breaker: the header numbers survive a refresh that only brings visitor countries

Slug: `building-ai-breaker-research-windows-ai--22` · Branch: `update/building-ai-breaker-research-windows-ai--22` · Status: draft
Asked by Steven on 2026-10-19 (Building write-up refresh, short spec per `.claude/team.md` step 4): refresh `/building-aibreaker` after stewils/ai-breaker check-in `cca451e` "Research: Windows AI not yet covered (agent connectors, Settings agent, Chrome suggestions)".

## Problem

Readers: a recruiter or hiring manager opening `/building-aibreaker` (often from a forwarded link, on a phone), and a peer checking how much of AI Breaker is built.

1. **The check-in itself changes nothing a reader would miss.** `cca451e` is research plus a new product-manager to-do in `how-it-works.html` ("Decide the Windows AI research"): proposals to turn off agent connectors (`ConfigureAgentConnectors`), the Settings AI agent (`DisableSettingsAgent`) and Chrome suggestions. Nothing is decided or shipped, and the effects still need a Copilot+ PC to prove. The write-up describes what is built and proven, so the article text and diagrams stay as they are. The header comment already says "as of 19 October 2026"; "What's next" has no date to update.
2. **The refresh broke the article's header.** The Site update workflow fetched the live numbers (`/api/building/aibreaker`, from `https://aibreaker.org/api/building`) and wrote `src/articles/aibreaker/feed.json` with only `visitorCountries30d`. That dropped `levels`, `settingsCovered`, `settingsDocumented`, `chatbotDomainsBlocked` and `clicksToUndo`. AI Breaker's endpoint (`sources/aibreaker/website/functions/api/building.ts`) says those product facts "come from the repository, not from here" and has only ever served visitor countries. With this feed, the header (`Stats`, `?? 0`) reads "0 levels", "0 of undefined documented AI settings…", "0 chatbot domains", "0 click to undo". On the first screen a recruiter would see a project that looks empty and a page that looks broken. Nothing in CI catches it today.

The repository still backs the numbers: AI Breaker's `CLAUDE.md` (four levels, one-click undo) and `specs/l1-l2-effect-tests.md` (Level2Catalog has 36 entries, 26 domains).

## Outcome

`/building-aibreaker` shows the same four header numbers as before the refresh, with the refresh's date and visitor countries. A later refresh that drops a number the article reads fails CI and does not ship zeros.

## Acceptance criteria

- AC-1: `src/articles/aibreaker/feed.json` has `numbers.levels`, `numbers.settingsCovered`, `numbers.settingsDocumented`, `numbers.chatbotDomainsBlocked` and `numbers.clicksToUndo` with the values in `git show HEAD:src/articles/aibreaker/feed.json` (4, 36, 37, 26, 1 at the time of writing). It also keeps this refresh's `asOf` and `visitorCountries30d`, and no new keys or values are typed in.
- AC-2: The prerendered `/building-aibreaker` header (`npm run build`, then the built HTML) reads "4 levels…", "36 of 37 documented AI settings…", "26 chatbot domains…" and "1 click to undo…". The page contains no "undefined", and no header stat renders as 0.
- AC-3: A test in `src/articles/articles.test.tsx` fails when any key an article's header `Stats` reads, or a feed key used in a stat label (`settingsDocumented`), is missing from that article's `feed.json` or is not a number. It covers every article with a `feed.json` (aibreaker, juniortrackcycling, leo, site, wilssens), not only AI Breaker. Deleting `levels` from the AI Breaker feed by hand makes it fail.
- AC-4: `AIBreakerArticle.tsx`, its diagrams and every other page are unchanged. `src/resume.ts`, the résumé PDF and `.github/` are untouched (`git diff --stat origin/main` lists only `src/articles/aibreaker/feed.json`, `src/articles/articles.test.tsx` and this spec).
- AC-5: `npm run lint`, `npm run test:coverage` (90% or more overall and per changed file) and `npm run build` pass. `npm run check:recruiter` and the résumé ATS score are not lower than on main.

## Out of scope

- Fixing the root cause in `.github/workflows/site-update.yml`. It replaces the feed's numbers wholesale with the live ones; it should merge the live numbers into the committed ones. `.github` is off-limits for a write-up refresh, so this is open question 1 and a follow-up pull request.
- Writing the Windows AI research (agent connectors, Settings agent, Chrome suggestions) into the article. It goes in when AI Breaker decides and ships it, at a later refresh.
- Making `Stats` hide a stat or show a dash when its key is missing, instead of 0. AC-3 stops this at CI. A rendering fallback is a possible follow-up (open question 2).
- Any change to the other Building write-ups, the admin, `src/resume.ts` or the résumé.

## Recruiter impact (senior-recruiter)

**First ten seconds.** Nothing changes against main or production: `/building-aibreaker` keeps its header "4 levels · 36 of 37 documented AI settings … covered · 26 chatbot domains blocked … · 1 click to undo". The home page, the résumé, contact, LinkedIn, experience, the assistant and the job description check are not touched. The new research (agent connectors, Settings agent, Chrome suggestions) stays out of the article, which is right: it is an undecided to-do, and a recruiter who reads "covers X" and then hears "not yet" stops trusting the rest.

**What the regression would have cost (the feed as the refresh wrote it).** The header is the first thing on the page, usually reached from the home page's "Read how it was built" link or a forwarded URL. It would have read "0 levels", "0 of undefined documented AI settings…", "0 chatbot domains blocked…", "0 click to undo". To a hiring manager that says two bad things in one glance: the product is empty, and a candidate who presents himself as a product leader shipped a visibly broken page. "undefined" is the worst of it. It is built into the label when the page is built (`AIBreakerArticle.tsx`, a template string), so the live fetch in `src/articles/wilssens/article.ts` can never repair it. The zeros would stay too, because AI Breaker's endpoint serves only `visitorCountries30d`. Readers without JavaScript, link previews and AI agents reading the Markdown copy (`dist/building-aibreaker.md`) would get the same zeros. Nothing catches it today: the recruiter check reads the home, about, experience, work and recommendations pages, not the Building write-ups, and the ATS score does not see them. So this would have shipped with every gate green. Restoring the feed and adding the CI test (AC-3) is the right fix.

**Risks to the bar.**
- A number without a source: none new. AC-1 restores the values committed before the refresh, so nothing is typed in. On a close read a sceptical reader may ask where "of 37" comes from. The spec cites AI Breaker's repository for 36 settings and 26 domains, but not for 37 documented. That is not a regression, but the developer should name the file that backs 37 in the pull request (or the spec), so the next refresh can check it instead of trusting the old value.
- Résumé score and recruiter review: no change possible, since `src/resume.ts`, the PDF and the reviewed pages are untouched (AC-4).
- Busier, slower or more self-promotional: no. No copy, layout or bundle change.
- Ask for AC-2: also check `dist/building-aibreaker.md` (the copy the assistant and agents read) for "0 levels" and "undefined", not only the HTML.

**Pushback on the PM.** None needed. Every criterion serves the reader's decision. I support open question 2: when a key is missing, a stat that disappears is invisible to a recruiter, while "0 levels" reads as broken. Treat it as a near-term follow-up, not a someday item, because the root cause in `site-update.yml` (open question 1) can still produce this for any write-up whose project serves only some of its numbers.

**What a recruiter would ask, and whether the page answers it.** "Is AI Breaker real, and is it used?" The four header numbers answer it. Visitor countries are in the feed but not shown in this header, which is fine. "What did Steven do himself, and what did the agents do?" The article already answers this, and the change leaves it alone.

**Baseline (2026-10-19, on this branch before the fix; `src/resume.ts`, the PDF and `src/pageMeta.ts` are identical to origin/main).**
- `npm run check:recruiter`: main's data on the live pages = **80/100**. The branch side read 50/100 only because no `dist/` had been built yet (six "page not in this deployment" findings), so it does not measure the change. The merge check compares against a built `dist/`.
- `node scripts/resume-check.mjs`: ATS **100/100**, 2 pages, 0 errors, 0 warnings. With `--baseline https://steven.wilssens.com/resume-report.json`: "100 → 100: the same as the live site". One standing question for Steven (cosmos 2004–2005 overlapping Info Support 2001–2004), unrelated to this change.

**Verdict on the spec: APPROVE.** Not worse for recruiters than main, and it prevents a broken first impression that no current gate catches. Conditions for the merge check: AC-2 holds in the built HTML and the Markdown copy, and both checks match the baseline above.

## Design (ux-designer)

**Nothing renders differently from main.** The article text, the layout, the CSS and the diagrams (`Diagrams.tsx`) are untouched. With the fix, `feed.json` carries the same five product numbers as on main (4, 36, 37, 26, 1); only `asOf` and `visitorCountries30d` change, and neither is printed on the page (`asOf` is not shown; visitor countries are not one of the four header stats). So the prerendered header, its labels and its `data-count` values are the same as main's. The test added for AC-3 renders nothing. This is a data-integrity fix, not a UI change: no new component, token or pattern.

**The broken state the fix prevents** (the branch before the fix, at every viewport and in both themes, with or without JavaScript, since the zeros are in the prerendered HTML):

```
 main / with the fix                         refresh as written (broken)
 +---------------------------------------+   +---------------------------------------+
 | 4   levels, from nothing blocked to   |   | 0   levels, from nothing blocked to   |
 |     full lockdown                     |   |     full lockdown                     |
 | 36  of 37 documented AI settings in   |   | 0   of undefined documented AI        |
 |     Windows, Office and browsers ...  |   |     settings in Windows, Office ...   |
 | 26  chatbot domains blocked in three  |   | 0   chatbot domains blocked in three  |
 |     browsers, proven on Home and Pro  |   |     browsers, proven on Home and Pro  |
 | 1   click to undo everything, even    |   | 0   click to undo everything, even    |
 |     when the app won't open           |   |     when the app won't open           |
 +---------------------------------------+   +---------------------------------------+
   (4-up row at 1440, stacked at 390)
```

This is the first screen a recruiter sees under the title. "0 levels" and "0 click to undo" say the product does nothing. "of undefined" is a visible code leak, and screen readers read it out too, because the `dd` is read as written. The count-up does not save it. `article.ts` counts each `[data-count]` to its prerendered value (0). The live call to `/api/building/aibreaker` returns only `visitorCountries30d`, so nothing raises the other stats. With reduced motion the zeros simply stay. That makes this a blocker-class regression on a recruiter-facing page, and AC-2 and AC-3 are the right guards.

**States**
- Prerendered, no JavaScript: the four numbers from `feed.json`, final and still. This is the state that matters, and it matches main.
- JavaScript with motion: the numbers count up from 0 to the same values when they scroll into view (existing behaviour). The live feed serves no product numbers, so it changes none of them and nothing jumps after the count.
- Reduced motion: no count. The numbers show as prerendered (the existing `reducedMotion()` path in `article.ts`).
- Live endpoint down or slow: no change. The prerendered numbers stand.
- Empty or very long content: does not apply. No copy changes, and the labels are the same length as on main.

**Layout, tokens, accessibility**: unchanged from main. The header is the same `.wx-stats` `dl`/`dt`/`dd` with the existing article tokens in light and dark, and it reflows the same at 390 and 320. There is no new focusable element, so the keyboard path and focus order are main's. Contrast is unchanged.

**On open question 2** (hide a stat when its key is missing): from the design side, yes, hiding beats "0" or a dash. On a résumé site a dash reads as "unknown", which is barely better. That follow-up must check `.wx-stats` with three items at 1440 (no hole in the row) and at 390.

**Flow diagram**: none. This changes no reader path and no agent flow. The root-cause fix in `site-update.yml` (open question 1) is an orchestration change, and that pull request brings the diagram updates.

**Pages to screenshot** at the UI check: `building-aibreaker` (desktop and phone with `--slices`, light and dark) against main's build, expecting identical header stats. The before/after pair for Steven is the first phone slice of `building-aibreaker` in `screenshots/main` and `screenshots/branch`, which should match. `home` is not needed, because nothing it reads changed.

**Verdict: APPROVE.** The fix restores main's rendering and adds a CI guard. The only design work left is confirming the screenshots are identical at merge.

## Threat model (security-engineer)

<!-- security-engineer fills this in -->

## Technical approach (senior-developer)

<!-- senior-developer fills this in -->

## Test plan (senior-tester)

<!-- senior-tester fills this in -->

## Open questions for Steven

Steven is not available. Nothing in this pull request waits for him, and each question has the team's recommendation.

1. Should the Site update workflow merge the live numbers from `/api/building/<project>` into the committed `feed.json`, rather than replacing them, so that numbers the project's site does not serve survive a refresh? **Recommendation:** yes, in a separate pull request that changes `site-update.yml`. That is an orchestration change, so it also updates `/building-this-site` and the Team page.
2. When a feed key is missing at runtime, should `Stats` leave that stat out instead of showing 0? **Recommendation:** yes, as a small follow-up. A missing number should disappear quietly rather than read as "0 levels". The CI test in AC-3 stays the main guard.
3. Should the write-up mention the Windows AI research once AI Breaker decides it? **Recommendation:** only when something ships and is proven on a Copilot+ PC. Until then it is a to-do, not an outcome.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE | | Short spec (refresh); text unchanged, feed restored, CI guard added |
| Senior recruiter | APPROVE | | Not worse than main; prevents a "0 levels / of undefined" header no gate catches today; AC-2 should also check the Markdown copy; name the source of 37 |
| Senior designer | APPROVE | | Renders as main once feed.json is restored; the broken state ("0 levels", "of undefined") is a blocker the fix and AC-3 prevent |
| Senior developer | (feasibility) | | |
| Security engineer | (threat model) | | |
| Senior tester | (test plan) | | |
