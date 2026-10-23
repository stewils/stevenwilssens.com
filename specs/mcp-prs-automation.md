# Your MCP's content changes fix themselves, redo themselves and go live by themselves; everything else still waits for you

Slug: `mcp-prs-automation` · Branch: `mcp-prs-automation` · Status: draft (follow-up of `specs/mcp-prs-flow.md`; starts once that one has merged)
Asked by Steven on 2026-10-20: "make sure that the pipeline is set up so that those changes from the MCP aren't blocked and go through quickly"

## Problem

**Who.** Steven, through his MCP server; indirectly every recruiter, who reads the older
version of his record while an approved change waits.

**What he runs into once `mcp-prs-flow` has shipped.** The checks attach and he can merge
in one call, but three waits remain (causes 3 and 4 of `specs/mcp-prs-flow.md`, plus his
click):

1. When the Review workflow's team asks for changes on a Site update pull request (#61
   security; #62 designer and recruiter), nothing in CI makes them; the pull request
   waits until he starts a session.
2. Every update that touches `src/resume.ts` regenerates the same PDF, so when one
   merges the others conflict (#60 vs #62; #59 vs #61). The redo exists
   (`merge_site_update` with `redo: true`) but only on his word, after a failed merge.
3. A fully green content change still waits for his `merge_site_update`.

**How we know.** The lead's checks of 2026-10-20 (`gh pr view`, the run lists for #59 to
#62) and Steven's own answers of 2026-10-20: auto-merge yes, content only, `AUTO_MERGE`
on from the start, the label `hold`, the rules always wait for him.

## Outcome

A Site update pull request that only changes content (résumé data and PDF, article content
and feeds, `pageMeta`, specs) is fixed in CI when the team asks for changes (at most three
rounds), redone from main when another update merged first, and merges by itself once
every required check is green and all six reviewers approve, unless it is on `hold`.
Anything else (code, the admin, the assistant, headers, dependencies, the rules) waits for
Steven's merge, and he is told what went live and asked only what CI cannot settle.

## Acceptance criteria

These start from the criteria agreed in `specs/mcp-prs-flow.md` (there AC-16 to AC-25)
and carry Steven's decisions of 2026-10-20 and the controls security required (C5 to
C10 in that spec's threat model). The team reviews them again before the build.

The fix loop in CI.

- AC-1 (was AC-16): When the Review workflow's team returns `CHANGES_REQUESTED` on a Site
  update pull request (one the App opened), a fix run starts on the same branch without
  anyone starting it: `senior-developer` in build mode fixes every `blocker` and `major`
  and fixes or answers each `minor` (team.md step 7), runs lint, tests with coverage and
  the build, and the `publish` job pushes with the App token, which starts the review
  again. Only the reviewers who asked for changes review again, plus the tester when code
  changed; the others' verdicts carry over only when every commit since is a `Fix-round`
  commit by the App's bot.
- AC-2 (was AC-17): At most 3 fix rounds per pull request, counted from the `Fix-round: n`
  trailer on the App's commits (never from labels or comments), so re-running a job does
  not reset the count. After round 3 with a `blocker` or `major` open, on a finding
  disputed twice, or on any `NEEDS_STEVEN`, no fix run starts: one comment with the open
  points (both positions and the lead's recommendation), `team` stays failing, and
  `site_update_status` and the admin's **Needs you** (`src/admin/needs.ts`) show it.
- AC-3 (was AC-18): The fix run takes its findings only from the Review run's artifact
  (`team-review/result.json`) of main's workflow definition whose `head_sha` is the pull
  request's current head; pull request comments are never fix input (the owner's unedited
  replies only as answers). It never starts on a pull request that is not the App's own
  (head repository this one, branch `update/*`, author and every commit the App's bot) or
  that carries `hold`. The App token never shares a job with Claude (the `update` /
  `publish` split). A fix diff that touches `.github/`, `.claude/`, any `CLAUDE.md`,
  `scripts/*-check.mjs`, `*-gate.mjs`, `*-compare.mjs`, `functions/_lib/review/`,
  `vitest.config.ts`, `package.json`, `package-lock.json`, `migrations/`,
  `wrangler.toml` or `public/_headers` is refused and the run says so on the pull
  request. A fix may not change a word about Steven in `src/resume.ts` that he did not
  approve; such a finding waits for him.

The redo on conflict, one at a time.

- AC-4 (was AC-19): After every push to main, and after each Site update run ends, the
  oldest open Site update pull request of the App's that now conflicts with main is
  redone from main: a change request by `workflow_dispatch` of `site-update.yml` with the
  marker's title, instruction, proposals and `supersedes`; a Building refresh by
  `repository_dispatch` `building-source-changed` with the marker's `project` and the
  project's current main SHA (built in `mcp-prs-flow` AC-7). The old pull request is
  closed with a pointer to the new one, and its résumé proposals move with it. The redo
  workflow serialises the redos itself (at most one per trigger, and only when no Site
  update run is queued or running), because the `site-update` concurrency group drops a
  pending run instead of queueing it.
- AC-5 (was AC-20): At most one redo per pull request per commit on main and at most 2 in
  a row for the same request (walked through the `supersedes` chain); then a comment and
  **Needs you**. A daily cap on Claude runs across Site update, fix and redo (a repository
  variable) is checked before the Claude step. No redo for a pull request on hold, not the
  App's own, or with a commit by anyone else. A Building refresh is not redone when main
  already has the same write-up refreshed from a newer source commit (`sourceSha`): the
  old pull request is closed with that reason.
- AC-6 (was AC-21): `site_update_status` lists a redone pull request with its new number
  and the reason (the designer's wording in `mcp-prs-flow`, "MCP wording"), and
  `merge_site_update` with `redo: true` keeps working for a redo Steven asks for.

Auto-merge, content only.

- AC-7 (was AC-22): A Site update pull request merges by itself, by a merge job on main's
  definition holding the App token, with
  `gh pr merge --merge --match-head-commit <sha>` and the pull request title as the
  message, only when all of these hold on that exact head SHA: author the App, branch
  `update/*`, same repository, every commit by the App's bot; not a draft; `gates`,
  `team` and `check` succeeded on that SHA; the team's verdicts for that SHA are six
  `APPROVE` (or `NOT_APPLICABLE` where allowed) and no `NEEDS_STEVEN`; the spec has no
  unanswered open question; `mergeStateStatus` is `CLEAN`; `AUTO_MERGE` is `on`; and
  **every changed path is in the content allowlist**: `src/resume.ts`,
  `public/steven-wilssens-resume-2026.pdf`, `public/og-image.png`, `src/articles/**`
  content and `feed.json`, `src/pageMeta.ts`, `specs/**`. GitHub's native auto-merge is
  not used.
- AC-8 (was AC-23): It never merges by itself, and a test covers each case, when: a path
  is outside the allowlist (`functions/`, `src/admin/`, `src/ask/`, `src/webmcp.ts`,
  `index.html`, `public/_headers`, dependencies, migrations, workflows, `.claude/`,
  `CLAUDE.md`, the checkers: the rules always wait for Steven); `accept-lower-score` is on
  it or the ATS score is lower than live or the live report cannot be read (a lower score
  is Steven's call, merged with `acceptLowerScore: true`); `check:recruiter` is lower or
  has a new high or medium finding; the `src/resume.ts` diff is not word for word the
  approved proposals in the marker, has a `TODO(steven)` or a number without
  `impact[].backing`; any latest verdict is `CHANGES_REQUESTED` or `NEEDS_STEVEN`, or is
  on an older head; it carries `hold`; it is not the App's own; it is superseded.
- AC-9 (was AC-24): Steven can stop it. The label `hold` (from anyone: holding is always
  safe) stops a pull request's auto-merge, fix runs and redos until it is removed; the
  repository variable `AUTO_MERGE` (`on` when this ships, `off` stops every pull
  request) is the switch for all. The MCP can put `hold` on a pull request. Every Site
  update pull request body says in its first lines whether it will merge by itself (only
  content) or waits for him, and how to stop it.
- AC-10 (was AC-25): Steven is told what went live. On an auto-merge the pull request gets
  "Merged by itself: checks green and six approvals on <sha>"; Deploy's "resume is live"
  email says it merged by itself, with the revert command; `site_update_status` and
  `wait_for_site_update` report "merged automatically at <time>"; the MCP texts that say
  a change "goes live only when he merges" say what is true now. Proposals are marked
  applied as on a manual merge. After deploy, the recruiter check and the ATS score run on
  production; if either is worse, the merge is reverted and Steven is told.

The write-up, as in `mcp-prs-flow` AC-11 to AC-14: `.claude/team.md` (step 7: the fix loop
in CI; step 9: what merges by itself and what waits; the chart: `pr` gains the fix member,
`pr -- all green --> deploy`, `pr -- waits for Steven --> merge`, the redo back to build,
still 10 top-level nodes, per the designer's drawing in `mcp-prs-flow`), CLAUDE.md "## The
team" and "## Working on a branch" ("Merging is Steven's decision" changes to the rule
above), `/building-this-site` ("I merge" becomes "Merge: by itself when all is green, or by
me when it waits", the "I decide" box, `LoopDiagram`), and `functions/_lib/ask/prompt.ts`'s
line about who merges. New workflows (`site-update-fix.yml`, `site-update-redo.yml`,
`site-update-merge.yml`) go into `ORCHESTRATION`, `building-notify.yml` and
`src/articles/sources.json`.

## Out of scope

- Auto-merge of anything outside the content allowlist, and of any pull request not
  opened by the App (sessions, `/feature`, Dependabot).
- Rebasing a conflicting branch; a conflict is always a redo from main.
- A delay before the auto-merge; `hold` is the stop.

## Recruiter impact (senior-recruiter)

To write. Starting point: the recruiter's merge conditions and never-auto-merge list in
`specs/mcp-prs-flow.md` ("Scope change relayed by the coordinator"); see open question 1.

## Design (ux-designer)

To write. Starting point: the designer's chart, article diagrams and MCP wording for
auto-merge, the fix loop and the redo in `specs/mcp-prs-flow.md`, and the condition that a
pull request waiting for Steven shows in **Needs you**.

## Threat model (security-engineer)

To write. Starting point: T4 to T10 and controls C5 to C10 in `specs/mcp-prs-flow.md`.

## Technical approach (senior-developer)

To write. Starting point: "Priorities 3 to 5: design" in `specs/mcp-prs-flow.md`, with its
corrections (b) and (c).

## Test plan (senior-tester)

Moved from `specs/mcp-prs-flow.md` and bound to this spec's AC-1 to AC-10. The rule for
all three automations: every decision (fix again or stop, redo or not, merge or not) is a
pure function with a unit test per refusal and per positive case; the workflow only
gathers GitHub's data, calls it with main's code and acts; a workflow-reading test (the
style of `scripts/site-update-workflow.test.mjs`) pins the trigger, the token and the
guards. A decision written only in shell is a `major`. Fakes: `fakeGitHub`
(`functions/_lib/mcp/tools-branches.test.ts`), `fakeFetch` (`functions/_lib/github.test.ts`),
the fixture repository of `scripts/team-manifest.test.mjs`; fake timers for every wait
(the 5 s `mergeable` re-read). Live checks are recorded in the pull request's *Evidence*;
one not yet run is an open point at merge.

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | Fix decision (in the round/guard script) unit tests: "starts a fix after CHANGES_REQUESTED on the head of an App pull request"; "waits while gates, team or check on that SHA is still running"; "does nothing on a stale head SHA". Carry-over in `review.yml`'s verdict reading: "approved roles carry over only when every commit since is a Fix-round commit by the App's bot" (one commit by anyone else and every role reviews again); "the tester reviews again when code changed". `site-update-fix-workflow.test.mjs`: `workflow_run` of Review and Site checks, `types: [completed]`; the fix step is the team step's twin (same `--allowedTools`, no bypass flag, same turn and time limits; "the team step's powers do not grow" runs on it; `resume:build --force` not allowed); the `update`/`publish` pair is the reusable workflow, not a copy; `concurrency: site-update-fix-<pr>`, cancel off. Live: one pull request with `CHANGES_REQUESTED` gets a `Fix-round: 1` commit and a second Review run; both recorded | Unit + Workflow + Live |
| AC-2 | Unit: "counts rounds from Fix-round trailers on the App's commits" (a trailer on someone else's commit, a label or a comment saying round 1 neither resets nor ends the count; a re-run does not reset it); "round 4 never starts: one comment with the open points, both positions and the recommendation"; "NEEDS_STEVEN stops at once"; "a finding disputed twice stops". `src/admin/needs.ts` test "a Site update pull request that stopped shows in Needs you"; `tools-branches.test.ts` "site_update_status names the open points after round 3" | Unit |
| AC-3 | Unit: "reads findings only from team-review/result.json of a run of main's definition whose head_sha is the pull request's head" (an artifact from a run of the branch's own `review.yml`, from another SHA, or comment text is refused); "the owner's unedited replies are passed as answers, nothing else from comments"; refusals: not the App's author, a commit by anyone else, a fork, a branch outside `update/`, `hold`. Deny-list on the fix diff, one case per path: `.github/`, `.claude/`, any `CLAUDE.md`, `scripts/*-check.mjs`, `*-gate.mjs`, `*-compare.mjs`, `functions/_lib/review/`, `vitest.config.ts`, `package.json`, `package-lock.json`, `migrations/`, `wrangler.toml`, `public/_headers` (also a rename into one), plus a positive case; "a fix that changes a word about Steven in src/resume.ts he did not approve is refused". Workflow: findings reach Claude as a file read as data, never `${{ }}` of comment or artifact text in a `run:` block (a `blocker`); the App token only in `publish` | Unit + Workflow |
| AC-4 | Redo decision (`scripts/site-update-redo.mjs`) unit tests: "picks the oldest open App pull request that is dirty"; "reads mergeable twice, 5 s apart, and never redoes on null" (fake timers); "starts nothing while a Site update run is queued or running"; "at most one per trigger"; "a change request is redone by workflow_dispatch with title, instruction, proposals and supersedes; a Building refresh by repository_dispatch building-source-changed with project and the project's main SHA"; "the old pull request is closed with a pointer and its proposals move". Workflow: `push` to `main` and `workflow_run` of Site update completed; no fan-out of dispatches. Live: two conflicting résumé edits; one merges, the other is redone and the old one closed; both recorded | Unit + Workflow + Live |
| AC-5 | Unit: "at most one redo per pull request per main SHA" (the `redo-of: <pr> main: <sha>` line, read only from the App's own comments); "at most 2 in a row along the supersedes chain, then a comment and Needs you"; "the daily cap is checked before the Claude step" (cap reached: no Claude run, one line); refusals: `hold`, not the App's, a commit by anyone else; "a Building refresh already on main from a newer sourceSha is closed with that reason, not redone" | Unit |
| AC-6 | `tools-branches.test.ts` "site_update_status lists a redone pull request with its new number and the reason, in the designer's wording"; existing "merge_site_update redo: true" tests stay | Unit |
| AC-7 | Merge decision unit tests: "merges when every condition holds on that exact head SHA" and one refusal per condition: author not the App; branch not `update/*`; another repository; a commit by anyone else; a draft; `gates`, `team` or `check` missing, running or failed on that SHA; verdicts not six `APPROVE` (or allowed `NOT_APPLICABLE`) for that SHA, or any `NEEDS_STEVEN`; verdicts from a run of the branch's own `review.yml` rather than main's (the `team-verdicts` marker alone is not trusted for a merge); an unanswered open question; `mergeStateStatus` not `CLEAN`; `AUTO_MERGE` not `on`; a path outside the content allowlist. Positive cases: a résumé bullet and its PDF; feed numbers in a write-up; a spec. `site-update-merge-workflow.test.mjs`: `workflow_run` of Review and Site checks, main's definition, `environment: site-update-app`; `gh pr merge --merge --match-head-commit <sha>` with the title as subject, never squash, rebase, `--admin` or `--auto`; `allow_auto_merge` not used. Live: one content pull request merges by itself; the run, the merge commit and the green checks on that SHA recorded | Unit + Workflow + Live |
| AC-8 | Merge decision unit tests, one per never-merge case: each path class outside the allowlist (`functions/`, `src/admin/`, `src/ask/`, `src/webmcp.ts`, `index.html`, `public/_headers`, dependencies, migrations, workflows, `.claude/`, `CLAUDE.md`, the checkers); `accept-lower-score` present; ATS lower than live; the live report unreadable; `check:recruiter` lower, or a new high or a new medium; the `src/resume.ts` diff not word for word the marker's approved proposals (an extra word, a reordered bullet), a `TODO(steven)`, a number without `impact[].backing`; a latest verdict `CHANGES_REQUESTED`, `NEEDS_STEVEN` or on an older head (after a fix round the old approvals do not count); `hold`; not the App's; superseded (read from the single-pull call just before acting, not the list). If Steven answers open question 1 yes, one case per `profile` field, a role added, removed or retitled, a date, and a new number | Unit |
| AC-9 | Unit: "hold from anyone stops merge, fix and redo" (one test per decision function); "AUTO_MERGE off stops every merge". `tools-branches.test.ts` "the MCP puts hold on a pull request" (Steven's token). `site-update-workflow.test.mjs` "the pull request body says in its first lines whether it merges by itself and how to stop it", and the body's verdict comes from the same allowlist function (one source for the rule) | Unit + Workflow |
| AC-10 | Unit: "comments Merged by itself: checks green and six approvals on <sha>"; Deploy's email test "says it merged by itself, with the revert command" when `merged_by` is the bot, and not otherwise; `tools-branches.test.ts` "site_update_status and wait_for_site_update report merged automatically at <time>" and "proposals are marked applied as on a manual merge"; every MCP text that said "goes live only when he merges" is asserted changed. After deploy: "a worse recruiter check or ATS score on production reverts and tells Steven" (decision unit test, plus a workflow test on the revert step's condition and token). Live: the first auto-merge's email and the after-deploy scores recorded | Unit + Workflow + Live |
| Write-up | `team-manifest.test.mjs`: step 7 and step 9 text; the chart's `pr` has the fix member, `pr -- all green --> deploy`, `pr -- waits for Steven --> merge`, the redo edge back to build, still 10 top-level nodes; "a siteUpdate entry without steps counts every change" and one block per `siteUpdate` file; the three new workflows in `ORCHESTRATION`, `building-notify.yml` and `sources.json`. `articles.test.tsx`: the merge step reads "by itself when all is green, or by me when it waits", across and stacked. The prompt test checks `prompt.ts`'s line about who merges | Unit |

**Edge cases.** A fix, a redo and a merge never run on the same pull request at once
(each workflow's `concurrency` keys on the pull request, and each decision reads the
head SHA and state just before acting). A redo of a pull request that a fix run is
pushing to is refused (the head moved). Two quick merges into main do not redo one pull
request twice. The `site-update` concurrency group drops pending runs, so the tests
assert the redo workflow never dispatches while one is pending.

Coverage stays at or above 90% (statements, branches, functions, lines), and every new
or changed file is at 90% or more on its own: the fix round/guard script,
`scripts/site-update-redo.mjs`, the merge decision, `functions/_lib/github.ts`,
`functions/_lib/mcp/tools.ts`, `src/admin/needs.ts`, each script added to the coverage
`include`, none excluded.

## Open questions for Steven

Decided on 2026-10-20: auto-merge yes, content only on the allowlist above; `AUTO_MERGE` on
once this ships; the stop label is `hold`; changes to the rules always wait for him.

1. **Inside `src/resume.ts`, should some content still wait for your merge: `profile`
   (headline, location, work authorization, availability, team size, contact), a role
   added, removed or retitled or its dates, and a new or changed number?** The recruiter
   recommends yes: one wrong first-screen fact costs a call, and an approved typo or
   bullet wording would still merge by itself. Recommendation: yes for `profile`, roles
   and dates, and new numbers; everything else in the allowlist merges by itself.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | | | |
| Senior recruiter | | | |
| Senior designer | | | |
| Senior developer | (feasibility) | | |
| Security engineer | (threat model) | | |
| Senior tester | (test plan drafted 2026-10-20) | | Rows bound to AC-1 to AC-10; review again with the threat model and the answer to question 1 |
