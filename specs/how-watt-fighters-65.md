# Watt Fighters write-up: how problems are found and fixed, with what is built and what is planned

Slug: `how-watt-fighters-65` · Branch: `update/how-watt-fighters-65` · Status: built
Asked by Steven on 1 November 2026: "Add a new part to the Building Watt Fighters write-up (`src/articles/wattfighters/WattFightersArticle.tsx`, diagrams in `src/articles/wattfighters/Diagrams.tsx`): how problems are found and fixed, when a fix may go live on its own, and how the alerts work. Steven asked for it with diagrams." Full ask: `/tmp/ask-wf65.md`.

## Problem

Readers of `/building-wattfighters` (recruiters and hiring managers, then peers) see how the game was built but not how Steven keeps it working: how a problem is found, who may ship a fix, and what happens when a machine is wrong. That is the judgment a product leader is hired for. The risk in telling it is overclaiming: much of the system is written down with numbers chosen but not built, and a reader (or a peer checking) must never take a plan for a running system. Steven's word is the only source for the system and its thresholds.

## Outcome

A reader gets three new sections with three diagrams that say, step by step, what runs today and what is planned, and one new bullet in the leadership box that links to them. Nothing in the text or the diagrams reads as if a fix goes live on its own today.

## Acceptance criteria

Serves recruiters and hiring managers first (a clear, honest picture of how he leads), peers second.

- AC-1: Three new sections follow "09 What the AI got wrong", headed exactly "10 Keeping it working: from a problem to a fix", "11 When a fix may go live on its own", "12 The alerts, and the bell" (number style as the other headings), each with an id the page can link to.
- AC-2: "The estimate" is now 13, the practices section 14 and the next section 15; no heading, "On this page" entry, code comment (for example "the estimate in section 10"), test or other list in the repository still uses the old numbers.
- AC-3: "On this page" lists 10, 11, 12 in order after 09, each linking to its section, with the renumbered 13, 14, 15 after them.
- AC-4: The "What this shows about how I lead products" box has one more bullet, exactly: "Safe speed needs rules for when a machine may ship. A fix goes live on its own only when a test shows the problem, every test passes, many players have it, and it touches no protected part. Everything else waits for me." followed by the link "Keeping it working" whose href is the id of section 10.
- AC-5: In the text, every step and list item in sections 10 to 12 starts with a bold "Built." or "Planned." exactly as the ask lists them. Built: Steven's marks in debug mode and the note on the admin page, sent to the fixer; the fixer (a Claude Code session, every 5 minutes, in a clean copy of the code) writing a failing test, then the fix, with every test passing; the fix waiting on its own branch for "Release it" on the admin page; releases at most once an hour, bundled, every test run; a GitHub issue per mark, commented when a fix is ready and closed when it is live; emails when a fix is ready, can't be made, is live or fails to go live; the list of protected parts. Planned: everything else in the ask (game, Windows and Android errors and crashes; server errors, health checks and the outside check; counting players hit; players' messages sorted by Claude; text messages; the one-hour automatic go-live; the 2-hour watch and going back; a second Claude check). Headings carry no label.
- AC-6: Diagram 1, "From a problem to a fix": two twin SVGs (`wx-flow-wide` left to right, `wx-flow-tall` top to bottom on a phone), boxes in order Sources (four lines) → Count → Fixer → Decision ("see Who decides") → Release → Watching 2 hours, ending in two branches ("gone: issue closed, test stays" and "new loud problem: old version back"). Built boxes are solid with the word "Built"; Planned boxes are dashed with the word "Planned"; Sources shows Steven's marks "Built" and the other three lines "Planned"; Count Planned, Fixer Built, Decision Built (waits for Steven) with its automatic path Planned, Release Built, Watching Planned.
- AC-7: Diagram 2, "Who decides": a 2x2 grid (rows Quiet / Loud, columns "Fix ready" / "Can't fix") under a band "Touches a protected part: always waits for Steven". Quiet+ready "Waits for your Release it" (Built); Loud+ready "Email and text; live in an hour unless he stops it" (Planned, noting that today every fix waits); Quiet+can't "Email with why" (Built); Loud+can't "Urgent email and text" with the email marked Built and the text Planned in the cell.
- AC-8: Diagram 3, "The hour": wide and tall twins with the seven points in order (problem turns loud, fix ready, email and text with the hour starting, other fixes join the bundle at least 15 minutes before the end, "Let me check it first" stops it at any time, live at 60 minutes, 2 hours of watching). Every point is Planned (dashed) except the bundling and the once-an-hour rule, which are Built (solid, labelled).
- AC-9: Every diagram has `role="img"`, a `<title>`, a `<desc id>` referenced by `aria-describedby` that states the order and the Built/Planned split, `<g data-part="">` per part, colours from `var(--d-*)`, the visible word "Built" or "Planned" inside each box (never colour or outline alone), text no smaller than 11px, and the same copy as the section's prose.
- AC-10: Under each diagram an HTML legend explains the marks: solid "Built, working today" and dashed "Planned, written down, not built"; its swatches are `aria-hidden` and the words carry the meaning.
- AC-11: Every number is exactly as in the ask: 5 minutes; 3 people; 5% in the last hour; 10% in the last 24 hours; at least 5 people; 20% in the hour or 10% in the day for a bug players write about (a switch, off to begin with); 10 frames a second for 10 seconds; 5 seconds frozen; 2% errors on a route; 1 in 20 answers slower than 2 seconds; 1 in 20 race messages slower than 250 ms; 5% of online riders dropped; every minute for the outside check; more than 10 files or 300 lines; 1 hour; 15 minutes; 2 hours; 24 hours for email links; at most one text an hour per problem and 6 a day; 8 seconds for the bell. A test or review compares them with the ask.
- AC-12: The protected parts are a real list of the six items in the ask, followed by the sentence that a fix needing a new app build can't go out on its own; the examples of emails and the bell paragraph (what the bell shows, 8-second pop-up never over a race, its results or an online room, "A young rider") are present, the bell marked Built and texts Planned, emails Built.
- AC-13: The switches table (`wx-table-wrap` / `wx-table`, columns Switch, Starts, Can it change, `data-label` on the cells) has exactly the seven rows of the ask. Marking is per row: the five switches of planned features (second Claude check, off; players' bugs to the fixer, off; a loud problem needs 5 people, on; a problem counts from 3 people, on; go back to the old version on a new loud problem, on) are marked Planned and captioned "Planned: the switches arrive with the features they control"; the two "On, can't be switched off" rows (protected parts wait for review; at most one release an hour) belong to built rules and are marked Built. The text says each change is logged and emailed.
- AC-14: No text names the laptop or the repository (the fixer is "a Claude Code session", "a clean copy of the code"). `src/resume.ts`, the résumé PDF and every page other than `/building-wattfighters` are unchanged; the Markdown copy is regenerated by the build, not edited.
- AC-15: Light and dark themes and 320, 390 and 1440px: the tall twin shows on a phone and the wide one on desktop, no horizontal scroll, the table stacks as cards on a phone, "Planned" text meets 4.5:1 contrast, `--d-warn` is not used for Planned, and the diagram parts are visible without JavaScript. `npm run lint`, `npm run test:coverage` and `npm run build` pass.

Resolved by the product manager (the designer asked the lead): the table is not captioned wholesale as Planned; the ask calls these safeguards of a planned system, but two are built rules, so each row is marked (AC-13).

## Out of scope

- Building any planned part (error reporting, health checks, counting, text messages, the automatic go-live, the watch and rollback, the second check).
- Any change to the résumé, other pages, the assistant, the admin or the workflows.
- Hand-editing the Markdown copies.
- Naming the laptop or repository; adding screenshots of the admin page.

## Recruiter impact (senior-recruiter)

- Condition for the recruiter's approval of the spec: every step and every box is marked Built or Planned, and the lead bullet does not read as if the automatic go-live already runs.
- Risks: page length of an already long write-up (three sections and three diagrams); the thresholds are sourced only to Steven's word, so they stay worded as his rules, not measured results.
- Baseline: live site 100/100 and résumé ATS 100/100. `npm run check:recruiter` on main needs `dist/` built; run without it, it gave 70 only because of that.

## Design (ux-designer)

(Designer's section only; the lead merges the rest of the spec around it.)

**Verdict: APPROVE_WITH_CHANGES if the rules below are followed.**

### Conventions
- Colours `var(--d-*)`, `<g data-part="">` per part, `fontSize` 13 / 11.5 (never below 10 on a 320px screen), `role="img"`, `<title>` plus `<desc id>` and `aria-describedby`, as `TeamFlowDiagram`. Each diagram also has its text in the section (the prose and list are the text alternative; the `desc` states the same order and the Built/Planned split).
- Built = solid outline, tint fill, text "Built". Planned = dashed outline (`strokeDasharray="5 4"`), no fill, text "Planned" in the box. Never colour alone. The label is a visible 11px word inside each box, not only in the `desc`.
- Legend under each diagram (HTML, not SVG, so it reflows): solid swatch "Built, working today", dashed swatch "Planned, written down, not built". Swatches are inline SVG, `aria-hidden`; words carry the meaning.
- Prose: each step/list item starts "Built." or "Planned." in bold; a heading carries no label. Headings, exact: "Keeping it working: from a problem to a fix", "When a fix may go live on its own", "The alerts, and the bell". Section numbers 10, 11, 12; "The estimate" becomes 13 and onwards (renumber "On this page", comments, tests).

### Diagram 1, "From a problem to a fix"
- Wide: `wx-flow-wide`, viewBox 760x330. Six boxes left to right: Sources (4 stacked lines inside, 150 wide) → Count → Fixer → Decision ("see Who decides") → Release → Watching 2 hours (ending in two small branches: "gone: issue closed, test stays" / "new loud problem: old version back"). Arrows as `Arrow` marker.
- Tall: `wx-flow-tall`, viewBox 300 wide, boxes 276 wide stacked 20px apart (about 300x980), same copy. Sources box lists the four sources, each with its own tag ("Steven's marks: Built", the other three "Planned").
- Per box: Sources split by line; Count Planned; Fixer Built; Decision Built (waits for Steven) with the automatic path Planned; Release Built; Watching Planned.

### Diagram 2, "Who decides"
- Single SVG, viewBox 440x300 (scales to 320px with text at 11.5 min of 11.5x(320/440)... so keep it at 360 wide: use viewBox 360x300 and no twin). 2x2 grid, row heads Quiet / Loud, column heads "Fix ready" / "Can't fix"; a band across the top, "Touches a protected part: always waits for Steven", with a lock-free text mark. Cells: Quiet+ready "Waits for your Release it" (Built); Loud+ready "Email and text; live in an hour unless he stops it" (Planned, dashed; "today every fix waits"); Quiet+can't "Email with why" (Built); Loud+can't "Urgent email and text" (email Built, text Planned: say so in the cell).
- Protected-parts list after it as a real `<ul>`, then the sentence on app builds.

### Switches table
`wx-table-wrap` / `wx-table`, columns Switch · Starts · Can it change. Rows exactly the seven from the ask; `data-label` on the two td. "On, can't be switched off" in plain text. Header row hidden on phone by the existing CSS. Add "Built/Planned" to the first column only if the switches are not built: mark the table caption once ("Planned: the switches arrive with the features they control") if so; ask the lead to confirm.

### Diagram 3, "The hour"
- Wide: viewBox 760x240, a horizontal line with 7 ticks: problem loud → fix ready → email and text (hour starts) → bundle joins (15 minutes before the end) → "Let me check it first" stops it at any time (a bracket above) → 60 minutes goes live → 2 hours of watching. Planned dashed except "other fixes bundle" and "once an hour" (solid, labelled Built).
- Tall: viewBox 300x560, vertical line on the left, labels to the right, same copy.

### States and themes
- No-JS: prerendered, diagrams are static SVG; the on-scroll stagger from `article.ts` is only an enhancement, so parts must be visible without it (check `.wx-diagram` rules).
- Light and dark: dashed stroke uses `--d-edge`; "Planned" text `--d-quiet` is 4.5:1 or better on both (verify with axe); no `--d-warn` for Planned, so it is not read as an error.
- Reduced motion: staggering already respects it; do not add new motion.
- Keyboard: nothing in the diagrams is interactive; "Keeping it working" link in the box goes to the first heading's id, and Tab order stays in reading order. The legend and table are plain content.
- Long content: table cells wrap; on a phone the stacked cards apply at the existing breakpoint.

### To screenshot
`npm run screenshots -- --out screenshots/branch --slices building-wattfighters`, and main on 8790; also 320px, light and dark. Check the three diagrams, the legend, the table and the box bullet link.

## Threat model (security-engineer)

- New attacker-reachable surface: none (static JSX prose and inline SVG; no route, Function, D1 query or input; links are in-page anchors).
- The risk that matters is what the page says in public: nothing planned (automatic go-live, texts, rollback, crash reports, sorting players' messages) may read as live. Not on the page: secrets, tokens, internal hostnames, phone numbers, the laptop or the repository, player names. `support@wattfighters.com` is the only address, published at Steven's request.
- Controls: a test that every planned item carries "Planned" and the legend renders; a text check for the forbidden words; title and desc on every SVG; the reviewer reads the page against the Built/Planned list. Verdict: approved.

## Technical approach (senior-developer)

- Files: `WattFightersArticle.tsx`, `Diagrams.tsx`, `articles.test.tsx`, one heading check in `App.test.tsx`. The Markdown copy is generated at build; nothing else lists the sections.
- Article: three entries after `wrong` (ids `fixing`, `alone`, `alerts`); renumber 10 to 15 and the file comment; brief bullet linking `#fixing`; `wx-table` with `data-label` for the switches.
- Diagrams: local `Arrow`; a `StatusBox` (Built solid and tinted, Planned dashed, always the word inside) and an HTML legend; diagrams 1 and 3 as twin wide/tall SVGs from one step array with distinct marker and desc ids; diagram 2 also a twin pair (CSS gives SVGs a 640px minimum width on phones). Verdict: feasible.
- As built: the legend needed three rules in `src/articles/wilssens/article.css` (`.wx-legend`, new class only; the swatch rule outranks the phone rule that gives diagram SVGs 640px). Diagram 1's wide twin runs in two rows (sources, count, fixer; then decision, release, watching and its two branches) so the text stays at 11px or more. The diagrams speak in Steven's first person, like the prose ("waits for my Release it", "always waits for me"). Where a built step depends on a planned one, the planned part is split out and marked: emails are Built, but the count and share in them, the urgent mark when loud, and the email buttons (links that work once and for 24 hours) are Planned (see question 2); the bundle and one release an hour are Built, the 15-minute cut-off Planned. The static read time is 21 min, what `article.ts` computes from the page (diagram text included), so it does not jump on load.

## Test plan (senior-tester)

| Theme | Test | Kind |
|---|---|---|
| Section order, numbers, TOC ids and text match headings | `App.test.tsx` Watt Fighters heading test; `articles.test.tsx` TOC test | component |
| Diagrams: name, description, wide and tall twins | `articles.test.tsx` new "Watt Fighters diagrams" | component |
| Built/Planned label on every step, legend, dashed Planned | new tests | component |
| Exact numbers present | new test over the text | component |
| No "laptop" or repository name | new test on textContent incl. title/desc | component |
| Box bullet link target exists | new test | component |
| Switches table rows and states | new test | component |
| Coverage 90%+ overall and per file | `npm run test:coverage` | gate |

Verdict: approved with these tests.

## Open questions for Steven

1. Are the seven safeguard switches on the admin page built yet? The ask lists the features they control as planned and does not say. The write-up marks the table per row: the two that "can't be switched off" (protected parts wait for review; at most one release an hour) as Built, the other five as Planned. Recommendation: keep that until you confirm, then change the labels.
2. Do the buttons in today's emails ("Release it") already work as one-time links valid for 24 hours? The ask lists emails as built but does not name the buttons, so the write-up marks them Planned. Recommendation: say so and the label becomes Built for "Release it" ("Let me check it first" stays Planned with the hour).

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | approved | | no open fact missing apart from question 1 |
| Senior recruiter | approved, on condition every step is marked Built or Planned | | |
| Senior designer | approved with changes (phone layout for diagram 2) | | |
| Senior developer | approved (feasibility) | | |
| Security engineer | approved (threat model) | | |
| Senior tester | approved with conditions (the new tests) | | |
