# Steven's product team reviews every change before it reaches main

Slug: `review-team` · Branch: `review-team` · Status: built
Asked by Steven on 2026-10-19: "make sure a senior developer make sure that you are always doing a code review before a check-in is merged into main. make sure there is also a senior security engineer that does a security review. make sure there is also a senior tester, that makes sure the unit tests are written and we have above 90% test coverrage. Make sure there is a senior PM that makes sure there is a spec that hands things of to a senior developer when working on a feature. they work with a senior designer to make sure the UI looks good. The senior designer is also a user experience expert that signs off on the design but also checks the UI before allowing a merge to main. They all work together when I kick off an ask." Then: "since this is my site for work make sure you have a senior recruiter that checks the specs and the implementation and the bar is that it needs to make the site not worse for recruiters, works with the PM on the spec, signs off on the merge to main as well". Then: "make sure the agent interaction is set up as good an agentic as possible". Decisions: enforcement by Claude plus a CI gate with branch protection on main (protection applied after this merges); coverage backfilled to 90% before the gate goes on.

> Written after the build, by the product manager in `/team-review` round 1, from Steven's ask and the diff `main...review-team` (base 11917ba). The recruiter, design, threat-model, technical and test-plan sections were not written before the build; the round 1 reviews stand in for them.

## Problem

Changes reach `main` (and so production, which recruiters read) from three places: Steven's Claude Code sessions, the MCP server's `request_site_update`, and the Building write-up refreshes. Nothing checks them before the merge except `npm test` and the Site checks: no spec, no code or security review, no coverage bar, no one judging the change from a recruiter's seat or the UI by eye. Steven wants a standing team that does this every time, works together from one ask, and can block a merge.

## Outcome

Every change to `main` has a spec, is built by a senior developer from it, and is signed off by a code reviewer, a security engineer, a tester (90%+ coverage), a designer (UI) and a recruiter (not worse for recruiters), both in Claude Code and in a required GitHub check. Steven starts it with one ask and sees the questions once and the pull request with the sign-offs.

## Acceptance criteria

- AC-1: `.claude/agents/` has six roles with the duties Steven named: `senior-developer` (code review before merge, as a fresh instance), `security-engineer` (security review), `senior-tester` (tests written, 90%+ coverage), `product-manager` (spec that hands off to the developer), `ux-designer` (signs off the design and checks the UI before merge), `senior-recruiter` (checks spec and implementation, works with the PM on the spec, signs off the merge; bar: not worse for recruiters).
- AC-2: `/feature <ask>` runs the roles together from one ask: PM, recruiter and designer on the spec in parallel; security, tester and developer add their sections; Steven's open questions asked once; build by the developer from the approved spec; six reviews in parallel by fresh instances; a bounded fix loop; a pull request with the sign-off table.
- AC-3: `/team-review [PR|branch]` runs the gate on any branch or pull request and has the PM write an after-the-fact spec when none exists.
- AC-4: Every pull request into `main` runs the Review workflow: `gates` (lint, coverage at 90%+, build, recruiter check against main) and `team` (the six reviews), which fails when any role asks for changes and posts the sign-offs on the pull request.
- AC-5: Pull requests opened by the Site update workflow (MCP asks and Building write-up refreshes) get the Review and Site checks too, and that workflow builds with `npm run test:coverage`.
- AC-6: `npm run test:coverage` passes with 90% or more statements, branches, functions and lines over `src/` and `functions/`, enforced by thresholds in `vitest.config.ts`, before the gate is turned on.
- AC-7: `npm run check:recruiter` exits non-zero when the recruiter score drops below main or a new high finding appears.
- AC-8: `npm run screenshots -- <pages>` captures public and admin pages at 1440 and 390, light and dark, for the designer.
- AC-9: Every review ends with one machine-readable verdict block; reports go to `.review/<slug>/` (ignored by git); at most three fix rounds; disagreements and `NEEDS_STEVEN` go to Steven; the lead never overrides a reviewer.
- AC-10: `CLAUDE.md` and `README.md` describe the team, the commands and the bars.
- AC-11 (after merge, by Steven): branch protection on `main` requires the contexts `gates`, `team` and `check` (Site checks).
- AC-12: Asks from the MCP and Building refreshes get the spec inside the Site update workflow: the PM, recruiter and designer write `specs/<branch>.md` (security, tester and developer add their sections), the developer builds from it with tests, open questions go into the spec and the pull request body, and the pull request links the spec. The hidden markers and the workflow inputs are unchanged; text copied into the body (the instruction, the open questions) cannot open or close an HTML comment, and the MCP reads the last marker in the body, which is the workflow's own.
- AC-13: In CI, `NEEDS_STEVEN` is cleared by Steven replying on the pull request: the Review run passes the repository owner's comments (only his, and only those nobody else edited last) to the reviewers as decisions; they never clear a blocker or a major.
- AC-14: Dependabot's own pull requests (opened by Dependabot, on a `dependabot/` branch, the head commit by Dependabot) run `gates`; the `team` job reports success with "skipped for a dependency update". Anything else, a commit pushed onto such a pull request included, gets the full team.
- AC-15: `gates` fails when the résumé's ATS score drops below the live site's, unless the repository owner put the label `accept-lower-score` on the pull request (the last time it was added, he added it), and fails too when the live site's report cannot be read (exit 2), so an outage never passes as "not lower".
- AC-16: The checkers come from main, the data from the pull request: `gates` runs main's `scripts/recruiter-check.mjs` with `recruiter-compare.mjs`, `resume-check.mjs` with `resume-gate.mjs` (each pair only when main has both) and `functions/_lib/review/` on the pull request's `src/resume.ts`, PDF and build (the bootstrap pull request, when main lacks a pair, uses its own). The team reviews by main's `CLAUDE.md` and `.claude/`; any other `CLAUDE.md`, `CLAUDE.local.md`, `.mcp.json` or `.claude/` folder is main's or removed. The reviewing model may write only under `.review/` and run a fixed list of commands; a `.review/result.json` in the pull request is discarded before the review.

## Out of scope

- Applying branch protection (AC-11 is done after the merge, outside the diff).
- Showing the team's sign-offs in `/admin` or in the MCP tools (`site_update_status`, `merge_site_update`): follow-up.
- Seeding the local D1 in CI so admin screenshots show data: follow-up.
- The MCP reading the `team` check and the sign-offs (`site_update_status`, `merge_site_update`, `wait_for_site_update`): follow-up.

Named follow-ups from the review rounds (each its own change):

- **Recruiter check, HTML stage**: `scripts/recruiter-check.mjs` reads the `.md` pages only. Add the recruiter's paths in `dist/*.html`: the résumé link resolves to a file starting with `%PDF`, no `noindex` on a public page, `<title>`, description and `og:` tags present, and a full diff of every page's `.md` against main.
- **Screenshots `--state`** (assistant open, phone menu open, keyboard focus), together with seeding the local D1 (above).
- **The assistant declines work authorization and availability** (`functions/_lib/ask/prompt.ts:127` forbids speculating about them, and the model applies it to `profile.workAuthorization` and `profile.availability`, which the site states). Needs Steven to confirm both facts may be stated by the assistant; then a spec and a test asking both questions.
- **The phone first screen** (390x844): the green card and "Open to" sit below the fold, and the résumé and email links are cut by the bottom edge. A design spec.
- **The desktop contact band**: "Connect on LinkedIn" runs past the grid's right edge at 1440.
- **`/api/collect` rate limit** (pre-existing).
- **The MCP reading the Review run** (the `team` check and its comment) in `site_update_status` and `merge_site_update`.
- **A trivial-change path in CI**: a typo or one fact gets a lighter review than the six reviewers.
- **Scrubbing the API key from child processes** in the Review workflow (the reviewers' `npm test` and `npm run lint` run the branch's code with the key in the environment; acceptable today because fork pull requests get no secrets and the only same-repository authors are Steven and the Site update job).

## Recruiter impact (senior-recruiter)

Not written before the build; see `.review/review-team/senior-recruiter-r1.md`. Nothing a visitor sees changes; `npm run check:recruiter` on the branch = 80/100 (main: 80/100).

## Design (ux-designer)

Not written before the build; no public or admin UI changes in the diff.

## Threat model (security-engineer)

Not written before the build; see `.review/review-team/security-engineer-r1.md` (new workflow with secrets and `pull-requests: write`, Claude Code with tools in CI).

## Technical approach (senior-developer)

As built: agents, skills and `team.md` under `.claude/`; `review.yml`; `scripts/recruiter-check.mjs`, `scripts/screenshots.mjs`; coverage thresholds in `vitest.config.ts`; backfilled tests.

## Test plan (senior-tester)

| AC | Test or check | Kind |
|---|---|---|
| AC-1..3, AC-9, AC-10 | Read of `.claude/`, `CLAUDE.md`, `README.md` | review |
| AC-4, AC-5 | Review workflow run on this pull request; Site update dispatch lines | CI |
| AC-6 | `npm run test:coverage` | unit |
| AC-7 | `npm run check:recruiter` on the build | recruiter-check |
| AC-8 | `npm run screenshots -- home admin#resume` | site-check |
| AC-12 | The first MCP ask after the merge: its pull request links `specs/<branch>.md`; `updateRequestFromBody` and `resumeScoreFromBody` read the workflow's own (last) marker when an earlier one is planted in the copied text (`functions/_lib/github.test.ts`) | unit + CI |
| AC-15 | The exit decision of the ATS gate: drop, equal, higher, an unreadable baseline (exit 2) and errors, with and without `--fail-on-drop` (`scripts/resume-gate.test.mjs`); the recruiter gate's exit codes 0, 1 and 2 (`scripts/recruiter-check.test.mjs`); the Review run on this pull request, whose gates step fails on exit 1 and 2 | unit + CI |
| AC-13, AC-14, AC-16 | Read of `review.yml`; the Review run on this pull request and on the first Dependabot pull request; `python -c 'import yaml'` parse of the workflows and `bash -n` of their scripts | CI |

## Open questions for Steven

All answered by Steven on 2026-10-19, in round 1:

1. When a reviewer returns `NEEDS_STEVEN` in CI, how do you want to clear it: a comment on the pull request that the next run reads, a label, or merging as admin?
   **Answered: Steven replies on the pull request.** The Review run reads the comments of the repository owner only and gives them to the reviewers as decisions; they never clear a blocker (AC-13; `review.yml`, team-review skill "In CI").
2. Should asks from the MCP (`request_site_update`) get the PM, recruiter and designer spec before Claude builds, inside the Site update workflow, or is the review gate on the pull request enough?
   **Answered: the full spec, inside the Site update workflow**, following the `/feature` flow without stopping for Steven; his questions go into the spec and the pull request body (AC-12; `site-update.yml`).
3. Dependabot pull requests cannot read the Anthropic secret, so the `team` check fails on them: skip the team review for Dependabot (gates only), or add the secret to Dependabot secrets?
   **Answered: gates only.** The `team` job passes with "skipped for a dependency update" (AC-14).
4. (Raised by the recruiter) Should a lower ATS score fail `gates`, or only warn?
   **Answered: it fails, with the label `accept-lower-score` as Steven's override** (AC-15; documented in `CLAUDE.md`).

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE r2 (written after the build; Steven's four answers are AC-12..AC-16) | APPROVE r2 | AC-1..AC-10 and AC-12..AC-16 met in code; AC-11 pending (lead applies branch protection after the merge with Steven's go-ahead); AC-4, 12, 13, 14 still to be seen on a real GitHub run |
| Senior recruiter | | | |
| Senior designer | | | |
| Senior developer | (feasibility) | | |
| Security engineer | (threat model) | | |
| Senior tester | (test plan) | | |
