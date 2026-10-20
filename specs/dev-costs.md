# The admin shows what each change cost to build with Claude

Slug: `dev-costs` · Branch: `dev-costs` · Status: approved (round 3, 2026-10-19): Steven's answers, the recruiter's W-1, M-1 and M-2 and the security engineer's S-15 to S-17 are folded into the ACs; signed off by the PM, the recruiter, the designer and the security engineer
Asked by Steven on 2026-10-19: "Development cost tracking on /admin. Record what each feature costs to build with Claude", with five views: per feature, per agent, over time, waste and a budget per feature. Confirmed by Steven: admin only, never on the home page or in the public write-up's numbers; all five views.

## Problem

Steven in `/admin`. Every change now runs through a team of six agents: a spec, a build, six reviews in parallel and up to three fix rounds. That happens in two places: the Site update and Review workflows on GitHub (`anthropics/claude-code-action@v1`) and his own Claude Code sessions (`/feature`, `/team-review`). Today nothing records what any of it costs. He cannot see what a feature cost, which role costs most, whether the monthly spend is going up, or how much went into fix loops and pull requests that were closed or redone. So he cannot decide which kinds of change are worth running the full team on.

How we know: Steven's word (the ask). The action already reports `total_cost_usd`, `num_turns` and `duration_ms` in its execution file, and the local transcripts in `~/.claude/projects/<project>/` already hold per-message `usage` (input, output, cache read, cache write by 5-minute and 1-hour cache), the `gitBranch` of each message, and per subagent a `*.meta.json` with its `agentType`. Nobody reads them. No visitor, analytics or recruiter evidence applies: this is an admin-only feature, and recruiters must see no difference (Recruiter impact).

Readers: Steven, and only Steven. Recruiters and peers are served only indirectly, by one sentence in `/building-this-site` that the loop is metered (Steven agreed, Open question 1), with no numbers.

## Outcome

On `/admin#costs` Steven sees, for every feature branch, what it cost to build (spec, build, each review round, each fix round, the lead), which roles cost most, the monthly totals and their trend, what went into waste, and each figure marked as billed, estimated or unknown. A feature over the budget he set shows in **Needs you**.

```
GitHub, Review job "team" / Site update job "update"          GitHub, new job "costs" (needs it, if: always())
  claude-code-action step ─> execution file (never leaves)      permissions: {}, no checkout, no npm, /usr/bin/jq + /usr/bin/curl
  "Read what the run cost" (jq) ─> 3 numbers as job outputs ───> validates them again, posts with COSTS_INGEST_TOKEN ──┐
                                                                                                                      │
Steven's machine                                                                                                      v
  Claude Code session ends ─> SessionEnd hook (.claude/hooks/dev-costs.mjs, skipped on GitHub) ─> queue ─> POST /api/costs (ingest token only)
                             tokens per branch × batch × role × model, no text                               │ upsert, D1 dev_cost_runs
                                                                                                              v
  /admin#costs (admin bundle) <── GET /api/costs (admin token): prices (prices.ts), phases, rounds, waste at read time
                                  + pull request states from GitHub (functions/_lib/github.ts)
                              ──> POST /api/costs/budget (admin token) ─> D1 dev_cost_budgets
```

## Acceptance criteria

Terms. A **run** is one recorded use of Claude: one Claude step on GitHub, or one local Claude Code session (with its subagents). A **batch** is the subagents the lead started in one assistant message (local sessions only). A **feature** is a branch name; `main`, a detached `HEAD` and runs with no branch collect under "No feature". **Billed**: charged per token to `ANTHROPIC_API_KEY`. **Estimated**: the API-equivalent price of the tokens of a run on the Claude subscription. **Unknown**: the run cannot say which. All money is stored and computed in integer micro-dollars. A month is a calendar month in **UTC** (the admin's `monthName` and the assistant's monthly spend already use UTC; Steven's location in `src/resume.ts` is Seattle, so a fixed zone avoids the admin's per-browser offset changing past months).

The designer's D-1 to D-12, the recruiter's R-1 to R-8 and the security engineer's S-1 to S-14 are acceptance criteria as written in their sections. Where an AC below says less than an S control, the S control is the one built and tested; the ACs below have been rewritten to match.

Recording, GitHub

- AC-1: In `review.yml` (job `team`) and `site-update.yml` (job `update`), the Claude step gets an `id` (`team`, `claude`), and a step after it, `if: always()`, reads `steps.<id>.outputs.execution_file` (falling back to `$RUNNER_TEMP/claude-execution-output.json`) with `/usr/bin/jq`, takes `total_cost_usd`, `num_turns` and `duration_ms` from the **last** `type == "result"` message (also when `is_error` is true), and writes each to `$GITHUB_OUTPUT` only when it matches `^[0-9]{1,9}(\.[0-9]{1,12})?$` (S-2). A new job `costs` per workflow (`needs: team` or `needs: update`, `if: always() && needs.<job>.result != 'skipped'`, `permissions: {}`, `timeout-minutes: 5`, no checkout, no `uses:`, no npm) checks the same patterns again, converts the cost to micro-dollars, builds the body with `jq -n --arg/--argjson` and posts it with `/usr/bin/curl --fail --silent --show-error --max-time 10` (S-1, S-3). Every variable value reaches `run:` through `env:`, never `${{ }}`. `COSTS_INGEST_TOKEN` appears only in the `env:` of that one post step. A missing or unreadable execution file, a value that fails the pattern, an empty secret (no network call then), or a failing post is one `::warning::` line and exit 0; the warning never holds the secret. The execution file is never uploaded, posted or printed. (`scripts/costs-workflows.test.mjs`)
- AC-2: The billing mark of a GitHub run is computed in the `costs` job from `HAS_API_KEY: ${{ secrets.ANTHROPIC_API_KEY != '' }}` and `HAS_OAUTH: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN != '' }}` in `env:`, the same secrets the Claude step is given (if a workflow stops passing one to the Claude step, its boolean goes too): API key set (with or without the OAuth token) is `billed`, because Claude Code uses the key first and always in non-interactive mode (documented; the comment next to the step cites the Claude Code authentication docs); only the OAuth token is `estimated`; neither is `unknown`. Neither credential is passed into the `costs` job. Both workflows keep passing both credentials to the Claude step as today (Steven, Open question 2: keep the API key for now), so GitHub runs are recorded as `billed`; this change does not touch the `anthropic_api_key` or `claude_code_oauth_token` inputs. (`scripts/costs-workflows.test.mjs`)
- AC-3: Review rounds are numbered **at read time**, never stored: the Review rows of one pull request ordered by `(run_id, run_attempt)` are "Review workflow, round 1..n" (a push or a dispatch is a higher run id, a re-run a higher attempt), whatever order they arrived in. A Site update run is phase `spec+build` and never a review round; on the Features table it counts in the **Build** column and its detail line reads "Spec and build (Site update)". (`functions/_lib/costs/views.test.ts`)
- AC-4 (S-15): A GitHub run is posted as one row: `source: github`, workflow (`review` | `site-update`), job, run id, run attempt, the branch, the pull request number when there is one, the billing mark, `costMicro`, `numTurns`, `durationMs`, `endedAt`. Its role is `review-workflow` or `site-update-workflow` and its model `reported`; no token counts and no model ids cross from the execution file (S-2). Where each comes from: run id (`github.run_id`), run attempt (`github.run_attempt`), workflow and job (literals per workflow: `review`/`team`, `site-update`/`update`) from the `costs` job's own `github` context, never from a job output; Review's branch (`github.head_ref || github.ref_name`) and pull request (`github.event.pull_request.number || inputs.pr`, checked against `^[1-9][0-9]{0,5}$`) from the same context; Site update's branch from the `update` job's output, which is exactly `${{ steps.branch.outputs.branch }}` (the `branch` step runs before the Claude step), and in the `costs` job it must pass the S-8 branch rule **and** start with `update/`, otherwise one `::warning::` and no post. Site update's pull request number comes from the `pr` step, after Claude's code, so it is advisory only: the server keys Site update rows by branch, takes pull request numbers and states only from GitHub (AC-17), and numbers review rounds and counts review waste (AC-3, AC-19) only from `review` rows. From the Claude job only the three numbers of AC-1 cross. The server builds `run_key` itself (AC-12); no body carries one, and `job` must be the one that belongs to `workflow` (`review`: `team`; `site-update`: `update`), else `400`. A cancelled or timed-out Claude step writes no execution file, so its spend is not recorded; the Costs page's note and the README say so. (`scripts/costs-workflows.test.mjs`, `functions/api/costs.test.ts`)

Recording, local sessions

- AC-5: `.claude/settings.json` holds exactly `{ "hooks": { "SessionEnd": [ { "hooks": [ { "type": "command", "timeout": 5, "command": "[ \"$GITHUB_ACTIONS\" = true ] || node \"$CLAUDE_PROJECT_DIR/.claude/hooks/dev-costs.mjs\"" } ] } ] } }` and nothing else: no `permissions`, `env`, `apiKeyHelper`, `model`, status line or other hook (S-4, S-5). The script checks `GITHUB_ACTIONS` again and then does nothing. Both workflows pass `--settings '{"disableAllHooks":true}'` in `claude_args` if the developer confirms `claude-code-action` honours it (a `minor` if left out, with the reason in the pull request). The developer confirms by hand once that the command runs under Git Bash on Steven's Windows machine. (`scripts/dev-costs-hook.test.mjs`: exact keys, the guard, the path)
- AC-6: The hook reads `session_id` and `transcript_path` from stdin, and reads the transcript only when it resolves inside `projects/` of the Claude config folder (`CLAUDE_CONFIG_DIR` or `~/.claude`), and subagent files only from that session's own `subagents/` folder (S-6). It sums per **branch × batch × role × model** the five token kinds (input, output, cache read, cache write 5-minute, cache write 1-hour): per `message.id` the **last** line's usage counts (repeated lines carry growing usage); only lines whose `sessionId` is the hook's `session_id`; `<synthetic>` lines skipped; `speed: "fast"` messages kept apart as model `<id>:fast`. It sends **tokens, never a price** (F-2). (`scripts/dev-costs-hook.test.mjs`, fixtures in `scripts/fixtures/dev-costs/`)
- AC-7: Role: a subagent's `agentType` from its `.meta.json`, lower-cased; one that does not match `^[a-z][a-z0-9-]{0,40}$`, or a missing or unreadable meta file, is `unknown-agent`; the main thread is `lead` (batch 0). Batch: the lead message whose `tool_use` id is the subagent's `meta.toolUseId`, numbered in order, with that message's time as `batchAt`; a nested agent takes its parent's batch. Branch (S-17: a row's key never moves as the transcript grows): the `gitBranch` on each message; empty or `HEAD` takes the last branch seen **before** that message in the session (never the branch at session end), else the first one after it, else "No feature"; a branch that fails the S-8 branch rule is "No feature". Batch numbers, roles and models are decided by earlier lines only, so a resumed session's second post only grows existing rows or adds new ones. (`scripts/dev-costs-hook.test.mjs`: `HEAD` lines after a branch, then the session resumed on another branch; the first post's rows keep their keys in the second)
- AC-8: Billing of a local session: `estimated` when `ANTHROPIC_API_KEY` is not in the hook's environment; `unknown` when it is (an interactive session uses the key only after Steven approved it, which the hook cannot see). Never `billed`. (`scripts/dev-costs-hook.test.mjs`)
- AC-9: The payload is built field by field from an allowlist (S-6): exactly `v, source, session, startedAt, endedAt, billing, rows[]` and per row exactly `branch, role, batch, batchAt, model, input, output, cacheRead, cacheWrite5m, cacheWrite1h`; `session` only when it is a UUID. A canary string placed in the prompt, the answer, a tool input, a tool result, `cwd`, a file path and an email address in the fixtures is absent from the payload, the queue file, stdout and stderr. A session with more than 64 rows is sent in several bodies of at most 64 rows. (`scripts/dev-costs-hook.test.mjs`)
- AC-10: The hook never blocks or breaks the session: it exits 0 in every path; it writes the payload to the queue first, then sends the queue, each request with a 2.5-second timeout, inside the hook's 5 seconds; it removes what was accepted; a `429` or a network failure stays queued; any other `4xx` is dropped with one line on stderr. The queue is `.dev-costs-queue.jsonl` at the repository root, git-ignored, written through a temp file and rename, at most 200 entries or 256 KB (oldest dropped); a line that does not parse is dropped (S-11). Without `COSTS_INGEST_TOKEN` in the environment it queues and makes **no network request** at all. It posts only to `https://steven.wilssens.com/api/costs`; `COSTS_INGEST_URL` is honoured only for `http://localhost` or `http://127.0.0.1` (S-7). Nothing prints the token or the `Authorization` header. (`scripts/dev-costs-hook.test.mjs`)
- AC-11 (in scope: Steven said yes to Open question 3): `node .claude/hooks/dev-costs.mjs --backfill [--dir <folder>]` runs the same code (AC-6 to AC-10: the same allowlist, the same billing rule from the environment the backfill runs in, the same queue and caps) over every past `*.jsonl` of this repository's project folder, default the folder of `~/.claude/projects/` (or `CLAUDE_CONFIG_DIR`) named after the repository root; `--dir` is honoured only when it resolves inside that `projects/` folder (S-6), otherwise one stderr line and exit 0. It queues and sends them, and ends with one line of counts only (sessions read, rows sent, rows still queued); no path, branch or text in it. A `429` from the daily cap (AC-14) leaves the rest queued for the next session end or the next backfill. The upsert key makes a second run harmless. The lead runs it once on Steven's machine after the merge, when the secret is set (AC-33), and puts the count line in the pull request or its follow-up comment. (`scripts/dev-costs-hook.test.mjs`)

Ingest and storage

- AC-12: Migration `migrations/0013_dev_costs.sql` creates `dev_cost_runs` (unique on `run_key, branch, batch, role, model`, where `run_key` is `github:<run_id>:<attempt>:<job>` or `local:<session uuid>`) and `dev_cost_budgets`. The server builds `run_key` from the validated fields (S-15). Every write is an **upsert** on that key with bound parameters (S-16): `INSERT ... ON CONFLICT (run_key, branch, batch, role, model) DO UPDATE SET` every value column `= excluded.<column>` (never `INSERT OR IGNORE`, never a sum) `WHERE excluded.ended_at >= dev_cost_runs.ended_at`, so an older body sent late (left in the queue after a 429 or a timeout) never puts back smaller totals; one body is one `DB.batch`, all its rows or none. The same body twice gives the same rows; attempt 2 of a run is new rows; a resumed session posted again replaces its rows with the new totals (never their sum) and adds rows for any new branch, batch, role or model; a body with an `endedAt` earlier than the stored rows changes nothing. No round number and no phase is stored. (`functions/api/costs.test.ts` on the fake D1)
- AC-13: `POST /api/costs` checks, in order (S-8): the method; the host (refused on `*.pages.dev`, previews share the production D1); the secret (`503 {"error":"not configured"}` when `COSTS_INGEST_TOKEN` is unset, shorter than 32 characters or equal to `ADMIN_TOKEN`); the bearer token with `sameSecret` against `COSTS_INGEST_TOKEN` only (`401 {"error":"unauthorized"}`, the admin token included), all **before the body is read**; then `Content-Type: application/json`, the body read with a 16 KB cap on the bytes actually read (`413`, also when `Content-Length` lies or is absent), then the exact shape. The ingest token is refused (401) by `GET /api/costs`, `POST /api/costs/budget` and every other admin route; `isAdmin` is unchanged. No CORS headers, `Cache-Control: no-store` on every `/api/costs*` answer, and no other method answers 2xx. (`functions/api/costs.test.ts`)
- AC-14: The ingest refuses with `400 {"error":"invalid"}`, the same body whatever failed and nothing echoed or written, any body that is not exactly the documented shape. The caps (T-3): at most **64 rows** per body; unknown or missing keys at any level (including `__proto__`); tokens integers 0 to 10^10 per kind per row; `numTurns` integer 0 to 10,000; `durationMs` integer 0 to 86,400,000; `costMicro` integer 0 to 10^9 ($1,000) per run; pull request 1 to 10^6; run id 1 to 10^13; run attempt 1 to 100; batch 0 to 10,000; times from 2026-01-01 to now plus one day, end at or after start; branch `^[A-Za-z0-9._/-]{1,200}$` that also passes git's ref rules (no `..`, no `@{`, no leading `-` or `/`, no trailing `/` or `.lock`, no `//`); role `^[a-z][a-z0-9-]{0,40}$`; model `^[a-z0-9][a-z0-9.-]{0,63}(:fast)?$`; session a UUID; source, billing, workflow and job from fixed lists. At most **5,000 rows written per UTC day**; a body whose rows would pass it is refused whole with `429` and a fixed body, nothing written (S-16; the hook keeps it queued; a larger backfill completes over several days). Logs carry the error's class only, never the body or a header. (`functions/_lib/costs/ingest.test.ts`, `functions/api/costs.test.ts`)
- AC-15: `GET /api/costs` (admin token) answers the five views in one JSON response, with a flag for "no data yet", no session id, no secret, and from GitHub only state, number and merge SHA (S-9). `POST /api/costs/budget` (admin token) takes `{ branch, amountUsd | null }`: the S-8 branch rule; `0 < amountUsd <= 1000`; `null` removes the budget; at most 500 budgets (`400` above it); fixed error bodies. (`functions/api/costs.test.ts`)
- AC-16: Prices: one table in `functions/_lib/prices.ts`, per model and per token kind in micro-dollars per million tokens, with the pricing page URL and the date it was read, filled by the developer from that page on the day of the build (no price in this spec). Local rows are priced **at read time**, so a corrected price fixes the history; a GitHub row uses its reported cost. A model id is matched exactly, then without a date suffix; `<id>:fast` only if the table has a fast price; otherwise the row is `unpriced`: kept with its tokens, flagged in the answer and on the page, and never added as zero. The assistant's `PRICE` in `functions/_lib/ask/agent.ts` reads from the same table; `prices.ts` imports nothing from the costs module and holds no cost data. (`functions/_lib/prices.test.ts`, `functions/api/costs.test.ts`)
- AC-17: Pull request state and merge commit come from GitHub at read time through `functions/_lib/github.ts` with the server's `GITHUB_TOKEN`, never from a payload (S-10): `shapePull` gains `mergeCommit`; the pull requests are matched to features by head branch (`state=all`, 100 per page, at most 5 pages; a feature not found is "state unknown"); merged → merged with its commit; closed and named in another pull request's `site-update-request` marker as `supersedes` (`updateRequestFromBody`) → superseded by that one; closed otherwise → closed, not merged; none → no pull request yet. Without `GITHUB_TOKEN` or when GitHub fails, every state is "state unknown" and the rest of the answer is complete. (`functions/api/costs.test.ts` with the GitHub stub)

Phases, rounds and waste (computed at read time, `functions/_lib/costs/phases.ts` and `views.ts`)

- AC-18: Local phases are assigned **per feature, across all its local sessions**, over its batches in `batchAt` order (F-1, T-1; `/clear` starts a new session, so a per-session rule would call a second session's first developer run "build" again). A **team batch** has at least one of the six team roles; a batch of built-in agents only (`explore`, `general-purpose`, `unknown-agent`) is `lead`, and a built-in agent inside a team batch takes that batch's phase. A **review batch** is a team batch with four or more distinct team roles. The rule: before the build, a review batch starts `review 1` (a `/team-review` of a branch built without `/feature`) and any other team batch is `spec` (this includes the developer's feasibility pass beside security and the tester); the first batch that is a lone `senior-developer` is `build`; after the build (or a review), a lone `senior-developer` is `fix N` after review N (it joins `fix N` if one is already open); any other team batch starts `review N+1` after the build or a fix, and joins review N directly after review N (a re-review of one or two reviewers after a fix is the next round). The lead's own rows are `lead`. Every token is in exactly one phase, so the phases add up to the feature's total to the micro-dollar. (`functions/_lib/costs/phases.test.ts` with a `/feature`-shaped fixture over two sessions: spec PM + recruiter + designer, spec security + tester + developer, build, review 1 of six, fix 1, review 2 of tester + security, fix 2, review 3 of the tester alone; also a `/team-review`-only feature, a batch of `explore` alone, and a feature with no subagents)
- AC-19: Waste (F-3) is counted per place: every local fix round; every local review round after the first; every Review workflow round after the first on that pull request (the first Review workflow round after a clean local review is not waste); and all the cost of a feature whose pull request was closed, not merged, or superseded, with nothing of it counted twice. Waste is never more than the total. (`functions/_lib/costs/views.test.ts`)

The Costs page (`/admin#costs`)

- AC-20: A **Costs** entry after **Team** in the admin menu (`range: false`) and a tile on the overview; the tile line reads the cost of the current month with the billed part and how many features are over budget, in the designer's copy. (`needs.test.ts`, `Overview.test.tsx`, `Admin.test.tsx`)
- AC-21: **Features**: one row per branch, "No feature" last and without a budget, the designer's seven columns (Feature, Spec, Build, Review, Fix, Total, Budget), sortable and searchable (`DataTable`). The Total cell's second line shows billed and estimated when a feature has both; the opened row shows them again. The Feature cell shows its pull request (link) and state in words (open, merged with its merge commit as a link, closed, not merged, redone by #N, no pull request yet, state unknown). Opening a row (click, Enter or Space) shows the split by phase in run order: spec, build or "Spec and build (Site update)", each local review and fix round and each Review workflow round on its own line with the roles that ran in it, and the lead. Links are built only from `GITHUB_REPO`, a positive integer and a 40-hex SHA (S-10). (`CostsPage.test.tsx`)
- AC-22: **Roles**: **all time** (the page has no range; T-5), one row per role, always all seven (product manager, recruiter, designer, developer, security engineer, tester, lead; `—` when a role has no run), plus "Review workflow" and "Site update workflow" marked "not split by role", and one muted row "Other agents" (built-in agents such as `explore`, `general-purpose`, `unknown-agent`) only when they have runs; largest first, each with its share of all cost (shares add to 100% within rounding) and its average per feature it ran in. (`CostsPage.test.tsx`, `views.test.ts`)
- AC-23: **Over time**: the last 12 UTC months ending with the current one, empty months kept as 0, billed and estimated apart (unknown counted with estimated in the chart and apart in the table), and the change of the last full month against the month before (the current month is never compared). Bars per D-4. (`views.test.ts`: a run at 23:30 UTC on 30 September is September; `Charts.test.tsx`, `CostsPage.test.tsx`)
- AC-24: **Waste**: the three totals (fix rounds, reviews after the first, closed or redone), each with its share of all cost, and the list per feature with its reasons, per AC-19 and D-6. (`CostsPage.test.tsx`)
- AC-25: **Budget**: in each feature's row, once opened, a labelled field ("Budget for <branch>"), Save and, when one is set, Remove budget, all keyboard reachable, behaving as the designer's "Budget editing" section says. A feature whose total is over its budget (equal is not over) is listed in **Needs you** and counted in the Costs menu badge, with its name, total and budget; a feature without a budget never is. The row, the tile, Needs you and the badge update without reloading. (`needs.test.ts`: under, equal, over, none, two over; `CostsPage.test.tsx`: D-7)
- AC-26: Every estimated figure carries a visible mark and words for screen readers (`≈`, "estimated"), an unknown one `?` ("billing unknown"), and a sum that leaves out unpriced rows a `+` with the unpriced models named in the detail; all through one `formatCost` in `src/admin/format.ts` (D-2). (`format.test.ts`, `CostsPage.test.tsx`)
- AC-27: Empty (one card "No costs recorded yet" whose note says how runs get recorded and that cancelled GitHub runs are not), loading (`PageSkeleton`) and error (the banner and one card; the rest of the admin keeps working; no Needs you line from stale data) states, each with the designer's copy. Every field from the database renders as React text. (`CostsPage.test.tsx`, `Admin.test.tsx`)

Admin only (R-1, R-2, R-4, R-5, R-7, S-13)

- AC-28 (R-1): No development cost figure (amount, token count, run count or anything derived from them) appears in a public page, `dist/*.md`, `llms.txt`, the sitemap, `og:*`, JSON-LD, `src/articles/site/feed.json`, `/api/building/site` or any unauthenticated `/api/*` answer; the article header gets no new stat. (`functions/api/building/[project].test.ts` deep-equal with and without cost rows; `articles.test.tsx`; the build grep in the PR evidence)
- AC-29 (R-2, S-13): Nothing under `functions/_lib/ask/`, `functions/_lib/mcp/`, `functions/api/building/`, `functions/api/ask*`, `functions/api/mcp.ts`, `functions/api/collect.ts`, `src/webmcp.ts`, `src/ask/`, `src/articles/`, `src/main.tsx`, `src/entry-server.tsx` or the prerender scripts imports the costs modules or names their tables; the private MCP gets no costs tool in this change. On the preview, the assistant asked "How much did it cost to build this site?" says the figure is not published and gives no estimate (recruiter M-2); when the recruiter cannot run it, the merge review returns `NEEDS_STEVEN` with the question. (`scripts/costs-safety.test.mjs`, with a positive control; the preview question)
- AC-30 (R-4): The costs code is only in the admin chunk; the home page's gzip bytes (`index.html`, `main-*.js`, `analytics-*.js`) against R-4's baseline: any growth is a finding, more than 10% a `major`. (`costs-safety.test.mjs` and the build size check)
- AC-31 (R-5): `src/resume.ts`, the résumé PDF and `src/pageMeta.ts` are unchanged; `npm run check:recruiter` stays at 80/100 or above and the ATS score at 100/100. (gates)
- AC-32 (R-7): The budget alert exists only behind the admin token: no public badge, status or email. (covered by AC-13, AC-15, AC-28; `costs-safety.test.mjs`: no costs module imports the mail code)

Secrets (S-7)

- AC-33: `COSTS_INGEST_TOKEN` is a Pages secret on **Production only**, a repository Actions secret (not a Dependabot secret, not a variable) and a user environment variable on Steven's machine; never in `.claude/settings.json`, `.claude/settings.local.json` or the queue file. `.gitignore` gains `.dev-costs-queue.jsonl` and `.claude/settings.local.json`. **Set before the merge** (Steven, Open question 4): the lead generates one random value of 32 or more characters, different from `ADMIN_TOKEN`, and, with Steven's OK, sets it as the repository secret and the Production Pages secret; Steven sets the user environment variable. The value is never printed in the session, the pull request or a log. Before the merge, `gh secret list` shows `COSTS_INGEST_TOKEN` (not under Dependabot secrets), `wrangler pages secret list` for the production environment lists it and the Preview environment does not, and Steven confirms the environment variable; the pull request's checklist records the three. (`scripts/dev-costs-hook.test.mjs` reads `.gitignore`; PM check of README and of the checklist before the merge)

The orchestration and the write-up (CLAUDE.md, The team)

- AC-34: `.claude/team.md` says, under "The flow", that the team's runs are metered (GitHub runs by the `costs` job, local sessions by the SessionEnd hook) and where the figures go (`/admin#costs`), and its Mermaid chart gains one node `meter[/Runs metered: admin, Costs/]` joined by dotted links to `build`, `reviews` and `fix`, with no `%% step` line and no `you` or `gate` class; `scripts/team-manifest.test.mjs` passes.
- AC-35: `scripts/team-manifest.mjs`: `.claude/settings.json` in `ORCHESTRATION` (section `flow`) and `.claude/hooks/dev-costs.mjs` in `IGNORED` with the reason "measures the runs; hands nothing between agents or to Steven"; the coverage and real-repository tests in `scripts/team-manifest.test.mjs` pass; the Team page on the preview marks the changed sections and steps (the flow, Site update's team step, the Review workflow) New.
- AC-36 (R-3, R-6, R-8; Steven said yes to Open question 1: one sentence and one label, no numbers): "Put every change past a team." in `src/articles/site/SiteArticle.tsx` gets one sentence with no digit and no `$`, true on the day it ships: what is metered (the runs, on GitHub and in Steven's own Claude Code sessions, per change and per role), that **a change can have a budget** (not "a monthly budget": there is none), and what it is for, framing waste as what Steven learns from. The sentence, exactly (recruiter W-1: GitHub runs are not split by role, so the role clause names only Steven's sessions): "The agents' runs, on GitHub and in my own Claude Code sessions, are metered against the change they belong to, and in my sessions against the role that ran them; a change can have a budget, and the rounds that had to be redone are counted, so I can see which kind of change is worth the full team." It says neither "every" nor "all" (a cancelled run is not recorded). `TeamFlowDiagram` gets the designer's metered layer in both drawings, worded exactly "Metered: runs count against their change, and a change can have a budget" (no role in the label), still `wx-diagram--fits` at 390 and 320; `flowDescription` gains the sentence. The sentence is true on the day it ships because the secret is set in all three places before the merge (AC-33). **Merge condition (recruiter M-1):** the sentence and the label ship only when, at the merge, `gh secret list` shows the repository secret, the lead has confirmed the Production Pages secret, and the developer's by-hand Git Bash run of the hook (AC-5) is recorded in the pull request; if any of the three is missing, the sentence, the label and `flowDescription`'s addition are taken out of this pull request and wait for a follow-up, and the `/admin` page ships regardless. (`articles.test.tsx`; designer's screenshots of `building-this-site` at 320, 390 and 1440)
- AC-37: `README.md` gets a "Costs" section: the hook and its guard, the two workflow steps and the `costs` job, `COSTS_INGEST_TOKEN` and the three places it is set (Production-only Pages secret, repository secret, user environment variable), how to rotate it, the backfill command (AC-11) and that it is safe to run again, that cancelled or timed-out GitHub runs are not recorded, and how GitHub runs are billed: with both `ANTHROPIC_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN` given to the Claude step, Claude Code uses the API key, so the runs are billed; to move them to the subscription, the two Claude steps stop passing `anthropic_api_key` (the repository secret stays: `deploy.yml` and the résumé email step use it), and the figures turn estimated by themselves (AC-2).

## Out of scope

- The on-site assistant's cost: it already has its own budget on `/admin` → Ask about Steven. A link from the Costs page's note to it is in; merging the two is a follow-up.
- Claude used outside this repository: the career MCP sessions in the Claude app, claude.ai chats, the other projects (wilssens.com, AI Breaker and the rest).
- A monthly overall budget, a default budget, a "near budget" Needs you line and email alerts; only the per-feature budget in Needs you.
- A date range on the Costs page (this month / all time): a follow-up if Steven asks.
- Backfill of GitHub runs before this ships: the execution files are not kept. (Backfill of past local sessions is in, AC-11.)
- Moving the GitHub runs to the subscription (the Claude steps no longer passing `anthropic_api_key`): Steven keeps the API key for now (Open question 2); a one-line follow-up per workflow when he decides, after a month of figures.
- Splitting a GitHub run by role or by model, and its token counts: only three numbers may leave the Claude job (S-2). A follow-up if a safe way appears.
- Recording cancelled or timed-out GitHub runs: the action writes nothing for them.
- Any change to how much the team runs (fewer reviewers, cheaper models): this measures first; deciding comes after.
- A costs tool on the private MCP server.
- The robust gate split of the Review workflow (already a named follow-up in `specs/review-team.md`).

## Recruiter impact (senior-recruiter)

**Verdict on the spec (recruiter), round 2: APPROVE.** R-1 to R-8 survived reconciliation as AC-28 to AC-32 and AC-36 (checked one by one below). One wording correction to AC-36's sentence and label is required (W-1, below): it is a correction of fact, not taste, and the PM folds it into AC-36 as written here. Two merge-time conditions (M-1, M-2) are added for the review.

### What a recruiter sees differently

- **First ten seconds (home at 390px): nothing.** The Costs page, its data and its Needs you
  alert live on `/admin`, which is `noindex, nofollow`, behind the admin token and a separate
  bundle (`dist/assets/admin-*.js`, not loaded by `index.html`). The home page's first screen
  (who Steven is, the role he wants, location and work authorization, contact, résumé) must
  be byte-for-byte the same.
- **Close read: one sentence and one diagram label in `/building-this-site`, "The loop".**
  Steven said yes (Open question 1). A hiring manager for a product or engineering leadership
  role who has just read that six agents review every change asks "what does that cost you?".
  Saying the runs are metered per change, with a budget, answers it as cost discipline and
  unit-economics thinking; printing numbers would invite a debate about whether they are high
  or low that has nothing to do with hiring Steven. No numbers, no new stat, no new section.

### The write-up sentence and label (AC-36), checked

The PM's proposed sentence has no digit, no `$`, no "every" or "all", says "a change can have
a budget" (true: a per-feature budget is the only budget built), and frames the redone rounds
as what Steven learns from (R-8). One part is not true on the day it ships:

- **W-1 (required) "metered against … the role that ran them" is false for GitHub runs.**
  AC-4 and AC-22: a Review or Site update run on GitHub is one row with its reported cost,
  role `review-workflow` / `site-update-workflow`, "not split by role" (S-2 forbids anything
  finer). The sentence names GitHub and role in the same breath, so a hiring manager who opens
  the repository (the article invites it) finds the claim overstated. That is exactly the R-3
  risk. The same applies to the diagram label "runs count against their change and their role".

  Final wording for AC-36 (the article, `flowDescription`):

  > The agents' runs, on GitHub and in my own Claude Code sessions, are metered against the
  > change they belong to, and in my sessions against the role that ran them; a change can
  > have a budget, and the rounds that had to be redone are counted, so I can see which kind
  > of change is worth the full team.

  Final label for `TeamFlowDiagram` (both drawings; about 73 characters, inside the designer's
  95 wide and two lines of 44 tall):

  > Metered: runs count against their change, and a change can have a budget

  The test in AC-36 ("names per change, per role and a budget") still holds for the sentence;
  for the label it asserts per change and a budget, not role.

- **Nit, public on GitHub:** the Technical approach still says `.claude/team.md` gets "every
  run is metered" and a node `Every run metered`. AC-34 (`Runs metered: admin, Costs`) wins;
  the sentence under "The flow" in `.claude/team.md` must not say "every" either (cancelled
  runs are not recorded). The Design section's "the whole loop is metered" (reader flow) is
  superseded by AC-36's label.

### Conditions, as reconciled

| Recruiter condition | Where it is now | Survived? |
|---|---|---|
| R-1 No public cost numbers (pages, `dist/*.md`, `llms.txt`, sitemap, `og:*`, JSON-LD, feed, `/api/building/site`, unauthenticated `/api/*`, no header stat) | AC-28 with the deep-equal, `articles.test.tsx` and the build grep | Yes |
| R-2 The assistant, the public `/mcp` and WebMCP do not know the costs; the preview question | AC-29 (`functions/_lib/ask/`, `functions/_lib/mcp/`, `functions/api/mcp.ts`, `src/webmcp.ts`, `src/ask/`, prerender; positive control; preview question) | Yes |
| R-3 The sentence true on the day it ships | AC-36 (no "every"/"all"), Open question 4 (secret set before merge); W-1 above fixes the role clause | Yes, with W-1 |
| R-4 Home page weight | AC-30, baseline below | Yes |
| R-5 Résumé, PDF, `pageMeta.ts` unchanged | AC-31 | Yes |
| R-6 Diagram legible at 390 | AC-36 (`wx-diagram--fits` at 390 and 320, screenshots 320/390/1440) | Yes, stronger than asked |
| R-7 Budget alert Steven's only | AC-32 | Yes |
| R-8 Tone | AC-36 ("framing waste as what Steven learns from") | Yes |

### Merge-time conditions (for the recruiter's review of the build)

- **M-1 The sentence ships only with the recording live.** At merge, `gh secret list` shows
  `COSTS_INGEST_TOKEN` on the repository, the lead confirms the Production Pages secret, and
  the developer's by-hand Git Bash run of the hook (AC-5) is in the pull request. If any of
  the three is missing, the article sentence and the diagram label wait for a follow-up rather
  than shipping a claim that is not yet true. The `/admin` page may ship regardless.
- **M-2 R-2 on the preview.** "How much did it cost to build this site?" put to the
  assistant on the preview: it says the figure is not published, and does not estimate one.
  When the recruiter cannot run it, the merge review returns `NEEDS_STEVEN` with the question.

### Risks to the bar

| Risk | Why it matters to a recruiter | Control |
|---|---|---|
| A cost figure leaks into the feed, `/api/building/site` or the assistant | A number without context on a job-search site gets judged as "expensive" or "toy"; either distracts from Steven | AC-28, AC-29, M-2 |
| The write-up overstates the metering | A hiring manager who checks the repo finds GitHub runs are not split by role, or that cancelled runs are missing; the whole article loses credibility | AC-36 with W-1, M-1 |
| The loop section grows or the diagram crowds on a phone | "Put every change past a team" is already the longest step; busier is worse | one sentence, one label, AC-36 |
| Admin code lands in the public bundle | Slower first screen on a phone | AC-30 |

### Baseline (19 October 2026, `origin/main` at 357b10d, rechecked: main has not moved)

- `npm run check:recruiter` on main = **80/100** (0 high, 4 medium, 0 low; 11 questions for
  Steven); exit 0.
- `node scripts/resume-check.mjs --baseline https://steven.wilssens.com/resume-report.json`
  ATS = **100/100** (2 pages, 0 errors, 0 warnings), the same as the live site; exit 0.
- Home page, gzip: `main-*.js` 88,949 B, `analytics-*.js` 84,735 B, `index.html` 5,587 B.
- Expected after the change: all unchanged. Any drop, or a new high finding, is a blocker.

### What a recruiter would ask Steven that this change should answer

- "Six agents on every change: what does that cost, and how do you decide it is worth it?"
  The sentence answers that a per-change measure and a budget exist; the numbers stay his to
  share in an interview.
- "Do you own budgets in your day job?" Not answered by this change and must not be implied
  by it. If Steven wants that point made, it belongs in the dossier and `src/resume.ts` with
  a source, not in the write-up.

### Push-back for the PM (held)

- No "total cost to build this site" anywhere public, even as a proud low number: it helps
  the story, not the reader's decision, and it ages badly.
- No cost tile on the article header and no new section "What it costs".

## Design (ux-designer)

**Verdict on the spec (designer, round 2 sign-off): APPROVE.** D-1 to D-12 are kept as acceptance criteria and the three points under "For the PM to reconcile" are settled (AC-21, AC-22, AC-25, AC-36). Round 2 aligned this section with the reconciled ACs: the Site update line and the Review workflow rounds in the detail (AC-3, F-3), "state unknown" (AC-17), "Other agents" on Roles (AC-22), the cancelled-runs sentence in the notes (AC-4, AC-27), the $1,000 cap (AC-15), the waste note per place (AC-19) and the diagram label's line breaks (AC-36). AC numbers in this section are the reconciled ones. The page is built only from what the admin already has (`section.card` + `data-part`, `.stats`, `DataTable`, the `BarChart` bars, `.badge`, `.status-text`, `.ghost`/`.primary`, `PageSkeleton`, `needs.ts`); the one new pattern is the budget field, and it has a reason (the admin has no editable value today); the one new token is `--series-soft`, the second step of the green for estimated figures in the chart.

### Readers and their flow

- **Steven, on the overview.** Needs you shows a line when a feature is over its budget; the menu shows a badge on **Costs**; the Costs tile gives this month's total in one line. He clicks the line (or the tile) and lands on `#costs`.
- **Steven, on `#costs`.** He reads the month at a glance (This month), finds the change he is curious about (Features: over budget first, then the latest run first), opens its row for the phase-by-phase split and the roles, and sets or changes its budget there. Over time, Roles and Waste answer "is this getting cheaper, who costs what, what was thrown away".
- **A reader of `/building-this-site`.** Sees one quiet layer in the team diagram saying the runs are metered per change, and a change can have a budget (Steven said yes, Open question 1). No numbers, no "every" (R-1, R-3, AC-28, AC-36).

### The admin page

Menu entry after **Team** (the two belong together): `{ id: 'costs', title: 'Costs', sub: 'What each change costs to build: per feature and phase, per agent role, per month, the waste, and your budgets', range: false, badgeNote: 'over budget' }`. `range: false`: the 7/30/90 switch does not apply; Over time is monthly, everything else is all time (see "For the PM to reconcile"). Icon: a 24px path in the menu's style (a receipt), `fill: var(--green)` like every tile icon.

**How a figure says what it is (every figure, everywhere on the page, AC-26):**

- Billed (charged to the API key): `$3.20`.
- Estimated (tokens priced at API rates, runs on the subscription): `≈$3.20`. The `≈` is `aria-hidden`; a visually hidden "estimated " is read before the amount.
- Billing unknown (AC-2): `?$3.20`, read as "billing unknown, $3.20".
- A sum takes the least certain mark of its parts (billed, then estimated, then unknown), and its split is on the line under it or in the row's detail (`$1.10 billed · ≈$2.10 estimated`). One rule to learn: no mark means all of it was billed.
- Unpriced runs (AC-16) are never folded in as zero: a figure that leaves some out ends in a `+` (`≈$4.10+`, read as "plus unpriced runs"), and the detail names them: `.badge.warn` "2 runs unpriced: claude-x-1 (1.2M tokens)".
- Under a cent: `<$0.01`; nothing: `—`. Two decimals, thousands grouped. One `formatCost(micro, mark, unpriced)` helper next to `formatUsd` in `format.ts` does all of this; no component formats money by hand.
- The rule is stated once, in the This month card's note (copy below), and again as the chart's legend.

**Cards, in order (the chip bar reads: This month · Features · Over time · Roles · Waste):**

1. `data-part="This month"`, heading **This month**, with the month and year at the right of `.card-head` in the `.updated` mono style ("October 2026"). A `.stats` strip of five:
   - **Spent this month** `≈$41.20`, small: `$12.00 billed · ≈$29.20 estimated`
   - **Last month** `≈$63.10`, small: `+12% on August` / `the first month` (`trendOf`, worded like `Vs`)
   - **Features** `12`, small: `9 merged · 2 open · 1 closed`
   - **Waste** `≈$8.40`, small: `20% of this month`
   - **Over budget** `2`, small: `of 7 with a budget`; `.highlight` when above 0, like the assistant's spend tile.
   Note under the strip (`.note`), exact copy: "`$` was billed to the API key. `≈$` is an estimate: the tokens of a run on the Claude subscription, priced at Anthropic's API rates. `?$` means the run did not say which it used. Cancelled or timed-out GitHub runs are not recorded. Open a feature to set its budget." Plus a link at the end, "The assistant's own cost is on Ask about Steven." (`#assistant`; out of scope says a link is fine, and Steven will look for it here).

2. `data-part="Features"`, heading **Features**. One row per branch; runs on `main` or with no branch in one row "No feature" (muted name, always last in the API's order, no budget field). `DataTable` with 7 columns, so it stacks on a phone:

   | Column | Value (sort) | Render |
   |---|---|---|
   | Feature | branch name | `strong` branch name (wraps, `overflow-wrap: anywhere`), then a `.badge.error` "over budget" when it is; under it a `small.muted` line: `#57 merged · 3f2a1bc` (two links: the pull request, the merge commit), `#58 open`, `#55 closed, not merged`, `#54 redone by #56`, `no pull request yet`, or `state unknown` (GitHub did not answer; AC-17); then `· 14 runs · 2 days ago` (`formatAgo` of the last run). |
   | Spec | cost | cost |
   | Build | cost | cost; a Site update run counts here (AC-3) |
   | Review | cost | cost, small: `3 rounds` (local rounds and Review workflow rounds together; the detail keeps them apart) |
   | Fix | cost | cost, small: `2 rounds`; `—` when none |
   | Total | cost | strong cost; small under it, when mixed: `$5.70 billed · ≈$6.70 est.`; when over budget: `.status-text.poor` "over by $2.40" (text, not colour alone) |
   | Budget | budget, or -1 for none | `$10.00`, or `.muted` "none" |

   The lead's own cost is in Total and in the detail, not a column (it is overhead, not a phase Steven compares across features). `expand` (the existing row toggle) opens the detail row:
   ```
   ▾ dev-costs  ⟨over budget⟩
     #61 open · 23 runs · 2 days ago   ≈0.80  ≈3.10  4.50  1.20  ≈12.40  10.00
   ┌ detail (tr.detail, on --paper) ──────────────────────────────────────┐
   │ Spec            ≈$0.80   product manager · recruiter · designer …     │
   │ Build           ≈$3.10   developer                                    │
   │ Review round 1   $2.60   developer · security · tester · designer …   │
   │ Fix round 1      $1.20   developer                                    │
   │ Review round 2   $1.90   …                                            │
   │ Review workflow, round 1   $0.90   not split by role                 │
   │ Lead            ≈$2.80   handoffs, questions, the pull request        │
   │ 23 runs · 4.1M tokens in · 310k out · $5.70 billed · ≈$6.70 estimated │
   │                                                                       │
   │ Budget for dev-costs   [$ 10.00   ]  [Save]  [Remove budget]          │
   │ Over by $2.40. It shows in Needs you until the budget is raised or    │
   │ removed.                                                              │
   └───────────────────────────────────────────────────────────────────────┘
   ```
   The phases are an `ol` in run order (a Site update run reads "Spec and build (Site update)" in place of Spec and Build; "Review workflow, round N" is its own line, apart from the local "Review round N", F-3; each review and fix round on its own line; after the amount, the roles that ran in it, `small.muted`, each with its own amount on hover-free text: `security $0.40`). Amounts right-aligned with `tabular-nums`. Empty table copy: "No feature has a recorded run yet."

3. `data-part="Over time"`, heading **Over time**. The last 12 months as bars, then a `DataTable` with every month.
   - **Chart (the dataviz skill's rules):** discrete months are columns, not a line; the y axis starts at zero; gridlines solid hairlines at zero, half and a round maximum (`niceMax`), as `BarChart` draws them; months with no run keep their empty slot (AC-23). Each column is at most 24px wide (the rest of the slot is air), square at the baseline, 4px rounded at the top of the stack only, with a 2px gap in the card colour between neighbouring columns. Two stacked parts, **billed** at the bottom and **estimated** on top, separated by a 2px surface gap, never by a border. They are two steps of the site's one green, because estimated is the less certain kind of the same thing, not another entity: billed `var(--series)`, estimated a new token `--series-soft` (`#2b7f60` dark, `#7cc4a2` light; the step nearer the surface recedes). Validated with the skill's `validate_palette.js --ordinal` against `--card`: dark `#2b7f60,#3fb98a` on `#15221e` and light `#7cc4a2,#0b8a5f` on `#ffffff` pass every check (the lighter end 3.37:1 dark, 2.04:1 light). Unknown counts with estimated in the chart (it is not billed for sure) and is apart in the table. A legend is always there (two series): in the figcaption, a swatch of each colour beside the text "billed" and "estimated"; the text stays in text colours, never in the series colour. No value printed on every column: the readout and the table carry them.
   - Readout (`.chart-readout`): `Last full month ≈$63.10, +12% on the month before`. The current month is never compared (it is not over). Hover or focus on a bar: `October so far · $12.00 billed · ≈$29.20 estimated · 5 features`.
   - Axis: month short names (`Oct`); the current month keeps its plain label, and its bar's `aria-label` and readout say "so far". No projection ghost (it would read as a third kind of figure).
   - This is `BarChart` given an optional second value per bar (`estimated`), not a new chart component. Each column stays a focusable button with its `aria-label`, and keyboard focus shows the same readout as hover, as today. The hit target is the whole slot, gap included. The figure grows with its axis labels (no fixed height that crops them).
   - Before the second month with a run: no chart; `.empty` "The chart starts with the second month." above the table.
   - Table columns: Month · Billed · Estimated · Total · Features · Waste (6, stacks on a phone); `?$` and unpriced show in Estimated with their marks.

4. `data-part="Roles"`, heading **Roles**. `DataTable` with one row per role, always all seven (product manager, recruiter, designer, developer, security engineer, tester, lead), plus one row per workflow whose runs cannot be split by role ("Review workflow", "Site update workflow", AC-22), muted name with small "not split by role", and one muted row "Other agents" (built-in agents: `explore`, `general-purpose`, `unknown-agent`) only when they have runs. Largest first (the API's order; the headers sort). A role with no runs keeps its row with `—`. Columns: Role · Runs · Total · Share (of all) · Per feature (average over the features it ran in). `expand`: the role's split by phase (`Spec ≈$4.10 · Build $22.00 · Review $9.30 · Fix $6.20`), which matters for the developer (build and review mode). Note: "All time. A developer run in review mode counts under Review."

5. `data-part="Waste"`, heading **Waste**. A `.stats` strip of three (AC-19's rule): **Fix rounds** `≈$14.20`, **Reviews after the first** `$9.10`, **Closed or redone** `≈$6.00`; each small: `N% of all`. Then a `DataTable`: Feature · Why · Waste · Of its total (percent). Why is one or more badges: `.badge.warn` "2 fix rounds", `.badge.warn` "2 more reviews", `.badge.error` "closed, not merged", `.badge.info` "redone by #56". Note, exact copy: "What went into work that did not reach main as first built: every fix round, every review round after the first in the same place (your sessions, or the Review workflow on the pull request), and all of a pull request that was closed or redone. Counted to learn from, not to avoid." Empty: "No waste yet: every pull request merged after its first review."

**Overview.** Tile line (`computeSummaries.costs`, AC-20): `≈$41.20 this month ($12.00 billed) · 2 over budget`; with no feature over budget, `… · 12 features`; with no data, `No costs recorded yet`. Needs you (`computeNeeds`, page `costs`, `n` = features over budget, AC-25): one: `feature is over its budget: dev-costs, ≈$12.40 of $10.00`; several: `features are over their budget, the most over dev-costs (≈$12.40 of $10.00)`. A branch name over 40 characters is cut with `…` (`cutLine`). The menu badge is the same `n`; a screen reader hears "Costs, 2 over budget".

### Budget editing (the one new control)

- Where: in each feature's detail row, below the phases (AC-25, "in each feature's row, once opened"). Not on the "No feature" row. A `form` with a visible `label` "Budget for <branch>" (visually hidden ", in US dollars") bound to an `input type="text" inputmode="decimal" autocomplete="off"` with a `$` prefix inside the field (`aria-hidden`), a **Save** button (`.primary`, the admin's one filled button) and, only when a budget is set, **Remove budget** (`.ghost`). Not in the table cell: a field in a sortable, clickable, stacking row fights the row's click (`tr.clickable`) and the phone layout; the Budget column shows the value.
- Enter in the field submits. Escape puts back the saved value. Accepts `10`, `10.5`, `$10.50`, `10,50`. Anything else, zero, negative or above the cap of $1,000 (AC-15): the message under the field (`p.error`, its `id` in the field's `aria-describedby`, `aria-invalid="true"`), "Enter an amount in dollars, like 10 or 12.50, up to $1,000.", and focus stays in the field.
- Saving: Save reads "Saving…" with `aria-disabled="true"` (not `disabled`, so focus stays on it); then a `role="status"` line under the form: "Saved: $10.00 for dev-costs." The row's Budget and Total cells, the **Over budget** tile, Needs you and the menu badge update at once, without reloading. The row stays open and in view even if it now sorts elsewhere (the open row is keyed by branch).
- Remove: no confirm dialog (typing the amount again undoes it); after it, focus goes to the field, now empty, and the status says "Budget removed for dev-costs."
- Failure: the status line in `.status-text.poor`: "Could not save (<reason>). Your amount is still in the field." The field keeps what he typed; focus stays on Save.
- Under the form, when over: "Over by $2.40. It shows in Needs you until the budget is raised or removed." At 80% or more: "At 86% of its budget." in `.status-text.needs-improvement` (no Needs you line for that; the ask is "over"). Equal to the budget is not over (AC-25's test). A save refused because 500 budgets exist shows the same failure line with the server's reason.
- New CSS for the field, one rule set in `admin.css` next to `.tbl-search input`: `.budget-form` (flex, wrap, `gap: 8px 12px`, `align-items: end`), its `input` (the same border, background and focus outline as `.tbl-search input`, `border-radius: 8px`, `width: 11ch`, `min-height: 44px`, `font-variant-numeric: tabular-nums`) and `min-height: 44px` on its buttons.

### States

- **Loading:** `PageSkeleton what="costs"` with a chart, like the other pages.
- **Error loading (AC-27):** the shell's existing `.banner role="alert"`: "Could not load the costs (<reason>)." The rest of the admin keeps working; the Costs body shows one card **Costs could not be loaded** with "Try again later; nothing recorded is lost." The overview tile reads "Could not load the costs"; no Needs you line from stale data.
- **No data yet (AC-27):** only one card, `data-part="Costs"`, heading **No costs recorded yet**, and a `.note`: "A feature appears here after its first recorded run: the Review and Site update workflows record theirs on GitHub, and your Claude Code sessions record theirs when they end, once the ingest secret is set on GitHub, in Cloudflare and on your machine (README → Costs). Cancelled or timed-out GitHub runs are not recorded. Budgets are set per feature, so they come with the first one." No empty tables, no zero tiles, no chart frame. Tile: `No costs recorded yet`.
- **Some data:** a card with nothing in it keeps its heading and its own `.empty` line (copy above), so the chip bar does not jump between visits.
- **Very long content:** a 200-character branch wraps in the Feature cell (no ellipsis in the table, so the search matches what is seen); Needs you cuts it at 40. 100+ features: the table's built-in search (from 6 rows) and its count; no pagination. A feature with 8 rounds: its detail list grows, the row does not. Amounts up to `$9,999.99` fit the numeric columns at 1440 without wrapping.
- **No JavaScript:** the admin is client-rendered behind the token; nothing to prerender. The article diagram is SVG in the prerendered HTML and must read in full without JS (the new layer has `data-part=""` like the others: visible when `article.ts` does not run, staggered in with the rest when it does).

### Layout

1440 (menu on the left, page pane with `--gutter`):
```
┌ menu ──────┐ ┌ Costs ───────────────────────────────────────────────────────┐
│ Overview   │ │ What each change costs to build: per feature and phase, …    │
│ …          │ │ ──────────────────────────────────────────────────────────── │
│ Team       │ │ (This month)(Features)(Over time)(Roles)(Waste)  ← chip bar  │
│ Costs  (2) │ │ ┌ This month ─────────────────────────────── October 2026 ┐  │
│ Links      │ │ │ [Spent ≈41.20][Last month ≈63.10][Features 12][Waste][Over 2]│
│            │ │ │ $ was billed … ≈$ is an estimate … ?$ …                  │  │
│            │ │ └──────────────────────────────────────────────────────────┘  │
│            │ │ ┌ Features ────────────────────────────────────────────────┐  │
│            │ │ │ [Search]                                   12 features   │  │
│            │ │ │ FEATURE           SPEC  BUILD REVIEW  FIX  TOTAL  BUDGET │  │
│            │ │ │ ▸ dev-costs ⟨over budget⟩                                │  │
│            │ │ │   #61 open · 23 runs  ≈0.80 ≈3.10 4.50 1.20 ≈12.40 10.00 │  │
│            │ │ └──────────────────────────────────────────────────────────┘  │
│            │ │ ┌ Over time (full width: bars, then the month table) ──────┐  │
│            │ │ ┌ Roles ──────────────────┐ ┌ Waste ─────────────────────┐  │
└────────────┘ └──────────────────────────────────────────────────────────────┘
```
Roles and Waste sit side by side in the existing `.grid` at 1440 (both have short tables) and fall to one column where `.grid` already does.

390 (the menu becomes the top tab strip as on every page; tables of 5+ columns stack into one card per row, each value under its column's name):
```
┌───────────────────────────────┐
│ Overview Traffic … Costs (2) →│  tabs scroll sideways (existing)
│ Costs                         │
│ What each change costs …      │
│ (This month)(Features)(Ove… → │  chip bar scrolls (existing)
│ ┌ This month ───────────────┐ │
│ │ [Spent ≈$41.20][Last mo.] │ │  .stats: two a row
│ │ [Features 12][Waste ≈8.40]│ │
│ │ [Over budget 2]           │ │
│ └───────────────────────────┘ │
│ ┌ Features ─────────────────┐ │
│ │ [Search       ] 12 features│ │
│ │ ▸ dev-costs ⟨over budget⟩ │ │  one stacked card per row
│ │   #61 open · 23 runs      │ │
│ │ SPEC             ≈$0.80   │ │
│ │ BUILD            ≈$3.10   │ │
│ │ REVIEW  $4.50 · 3 rounds  │ │
│ │ FIX     $1.20 · 2 rounds  │ │
│ │ TOTAL  ≈$12.40 over by…   │ │
│ │ BUDGET           $10.00   │ │
│ │ Budget for dev-costs      │ │  (open) field 11ch; Save and
│ │ [$ 10.00  ] [Save]        │ │  Remove wrap, all 44px high
│ │ [Remove budget]           │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
```
No horizontal scroll at 390 or 320 (12 bars at 320 are still 18px wide or more). Dark is the default; Light and Auto use the same tokens (`--series-soft` is set in all three theme blocks); nothing on this page sets its own colour.

### Accessibility

- **Keyboard path on `#costs`:** menu → chip bar (each chip scrolls to its card) → Features: search → column sort buttons → each row's toggle (Enter or Space opens) → that row's pull request link and commit link (in the Feature cell, reachable with the row closed) → in an open row: the budget field, Save, Remove budget → the next row's toggle → Over time: each bar (focus shows its readout) → the month table → Roles → Waste. Focus is always the existing `--focus` outline.
- Every amount is read with its mark ("estimated $3.20", "billing unknown, $3.20", "plus unpriced runs"). The bars' `aria-label`: "October so far: $12.00 billed, estimated $29.20, 5 features". The month table under the chart holds the same numbers for anyone who does not use the chart.
- Over budget is said in words ("over budget", "over by $2.40"), never by colour alone.
- Touch targets: the budget field and buttons are 44px; on a phone the whole stacked row opens on tap (`tr.clickable`), so the small `▸` is not the only target.
- Contrast: all text is `--ink`, `--muted`, `--bad`, `--warn-ink` on `--card` or `--paper`, which pass 4.5:1 in all three themes. The estimated part is 3.37:1 on the dark card and 2.04:1 on the light one (the ordinal floor); the legend and the month table carry the values too, so colour is never the only way in.
- Reduced motion: nothing new moves; the page fade and the badge pop already stop under `prefers-reduced-motion`; the new diagram layer appears at once there, like the rest.

### The diagram on `/building-this-site` ("The loop", AC-36)

The change is to `TeamFlowDiagram` (`src/articles/site/Diagrams.tsx`), the agent flow, not `LoopDiagram`. To meet the ask (a step that shows the loop is metered) and the recruiter (no new node, no numbers, still fits a phone): one **layer under the whole flow**, because the metering applies to the spec, the build, the reviews and the fixes alike, not one box.

```
wide drawing (viewBox 760 wide; height from 484 to about 524):
  [I ask] → [Spec] → [My questions]
  [Build] → [Six reviews, in parallel …]
  [Pull request] → [I merge] → [Deploy]
  ┌──────────────────────────────────────────────────────────────┐
  │ Metered: runs count against their change,                    │  stroke var(--d-grid), no fill,
  │ and a change can have a budget                               │  11.5px var(--d-quiet), one line
  └──────────────────────────────────────────────────────────────┘
  The agents check each other; I answer the questions and decide the merge.
```
- Wide: a full-width rounded rect (x 16 to 744, 32 high, `rx 8`, stroke `var(--d-grid)` 1.25px, no fill) between the pull-request row and the footer, one centred line, 11.5px, `var(--d-quiet)`, at most about 95 characters. Tall (phone): the same layer, 276 wide, before the footer, two lines of at most 44 characters (11.5px in a 300 viewBox stays legible at 320px, R-6). AC-36's label (recruiter W-1) is 73 characters, one line wide (inside 95); on the phone it breaks after the comma, as "Metered: runs count against their change," / "and a change can have a budget" (41 and 30, inside 44). Its own `data-part=""`.
- Quieter than a step box on purpose (no `accent`, no bold title): it is a property of the whole flow, not a place where work or a decision happens; the accent stays where Steven decides.
- `flowDescription` gains the same sentence, so a screen reader hears it.
- The wording is AC-36's (R-3: true on the day it ships); the length limits and the phone line break are mine. Steven said yes to Open question 1.

### Acceptance criteria (designer)

- D-1 `#costs` sits after Team in the menu and has an overview tile; its cards are `section.card` with `data-part` "This month", "Features", "Over time", "Roles", "Waste", in that order, and the chip bar shows them.
- D-2 Every money figure on the page goes through one formatter and shows its mark (none, `≈`, `?`, trailing `+` for unpriced) with the words for screen readers; a unit test covers billed, estimated, unknown, mixed, unpriced, zero and under a cent.
- D-3 Features: the 7 columns above, the pull request and merge-commit links and states ("state unknown" included), the "No feature" row last, and the detail row with every review and fix round on its own line ("Review workflow, round N" apart from local rounds, "Spec and build (Site update)" for a Site update run), the roles that ran in it and the lead.
- D-4 Over time: billed (`--series`) and estimated (`--series-soft`) stacked columns from zero, at most 24px wide, a 2px surface gap between the parts and between columns, no border on any mark, a legend, 12 months at most with empty months kept, no chart before a second month, and the month table with every month.
- D-5 Roles: every role always has a row, plus the workflow rows that cannot be split, plus "Other agents" only when built-in agents have runs.
- D-6 Waste: the three stats and the table with the reasons as badges, and the note's copy.
- D-7 Budget: set, change and remove from the feature's detail row by keyboard alone; the validation message is tied to the field; the row, the tile, Needs you and the menu badge update without a reload; focus behaves as written above.
- D-8 Needs you and the menu badge count the features over budget with the copy above; nothing for a feature at or under its budget, or without one.
- D-9 Empty: one card, "No costs recorded yet", no empty tables or zero tiles. Error: the banner and one card, the rest of the admin working.
- D-10 No horizontal scroll at 390 and 320; every new control 44px or more on a phone; axe clean in Dark and Light (`npm run check:site`).
- D-11 `TeamFlowDiagram` has the metered layer in both drawings, no number in it, the footer still inside the viewBox, and it still fits at 390 and 320.
- D-12 One new colour token only, `--series-soft` (the estimated part, in the three theme blocks of `admin.css`, values above); the new CSS is otherwise only `.budget-form` and the stacked column part.

### Pages to screenshot (UI check, before and after)

`npm run screenshots -- --slices home building-this-site admin admin#costs` on the branch and on main; `building-this-site` and `admin#costs` at 320 too; `admin#costs` in Dark and Light; one state with a feature open and over budget, and the empty state (a fresh local database). For Steven, the pairs: `admin` (Needs you with the budget line), `admin#costs` desktop, `admin#costs` phone, `building-this-site` phone (the diagram).

### For the PM to reconcile

Settled in round 2: all three as recommended (AC-21, AC-22, AC-25), and the write-up says "a change can have a budget" (AC-36). The draft AC numbers below are kept as they were raised.

1. **AC-16 says "across the selected range"; the design has no range on this page** (`range: false`, all time, months on Over time). The 7/30/90-day switch fits visits, not features that span weeks; a feature would be cut in half by the range edge. Recommendation: AC-16 says "all time". If Steven wants a period, it is "this month / all time" on the whole page, a follow-up.
2. **AC-15 asks for billed and estimated per feature row:** the design shows them in the Total cell's second line (when mixed) and in the detail, not as two more columns, so the phase split fits a 7-column row and the phone card stays short. The AC is met as worded if "with its total, billed and estimated" allows that.
3. **AC-19 "a labelled input per row":** the field is in each feature's opened row, not in the table cell (reason above). Worded "in each feature's row, once opened", the test is the same.

Also, for the recruiter and the PM: the recruiter's suggested sentence says "a monthly budget", and a monthly budget is out of scope; the write-up and the diagram say "a change can have a budget". Cut with the PM: a separate Budgets card, a default budget (Open question 5 agrees: none), a "near budget" Needs you line, export and a date filter.

## Threat model (security-engineer)

**Verdict on the spec (security), round 2: APPROVE, with S-1 to S-17 below as acceptance criteria.** The reconciliation kept S-1 to S-14 (checked one by one against AC-1 to AC-37; dropping the per-model tokens from GitHub makes S-2 stricter, and the phase pattern of S-8 is moot now that no phase is stored). Round 2 confirms the branch route of AC-4 with the conditions of S-15 and adds S-16 and S-17 for the switch to per-row upserts; the PM folds them into AC-4, AC-7 and AC-12 (wording only, no new round of security needed).

### What is new and who can reach it

| Entry point or data | Who reaches it | Untrusted input | What it does with it |
|---|---|---|---|
| `POST /api/costs` | anyone on the internet; accepted only with `COSTS_INGEST_TOKEN` | a JSON body | writes run rows to D1, later rendered on `/admin#costs` and counted in Needs you |
| `GET /api/costs`, `POST /api/costs/budget` | the admin token (in `localStorage` in Steven's browser) | query and body; branch names already in D1 | reads every cost row; writes budgets |
| The post after "The team reviews the pull request" (Review) and "Let Claude make the change" (Site update) | runs on GitHub after the pull request's code (Review: `npm ci` with install scripts, the build, `npm test` from inside the Claude step) or after Claude's code (Site update: `npm run *` inside the step, then lint, tests and build) | the execution file (the code that ran before can overwrite it), the branch name, the pull request number | holds `COSTS_INGEST_TOKEN` and calls the ingest |
| The execution file itself | the job that wrote it | n/a | the whole session: prompts, the diff, the pull request body, tool inputs and outputs, `permission_denials` |
| The `SessionEnd` hook in `.claude/settings.json` | every machine that opens this public repository in Claude Code, and `claude-code-action` in both workflows (Review loads main's `.claude/`; Site update starts on main's) | the transcripts it reads, which hold everything said and read in a session: dossier entries, pasted job descriptions, file contents, anything typed | sums usage, posts with `COSTS_INGEST_TOKEN`, or queues to a file |
| `COSTS_INGEST_TOKEN` | three places: a Pages secret, a repository secret, Steven's machine | n/a | write-only key to cost rows |

### Abuse cases

- **A1 The ingest secret read on GitHub by code under review.** The Review `team` job runs the pull request's code before any step after it; that code can append to `$GITHUB_ENV` (`LD_PRELOAD`, `BASH_ENV`, `NODE_OPTIONS`) or `$GITHUB_PATH` (a fake `bash`, `curl`, `jq` or `node`, which the runner resolves through `PATH`), so a post step in the same job can be made to hand over its token, whatever the step's script says. Forks are not the path (their runs get no secrets); the realistic one is code that reaches a branch in this repository: a Site update built from a prompt-injected Building source (`sources/` is another repository's text) or a compromised npm dependency. Impact: fake or flooding cost rows, a false Needs you line; no read. Likely enough to design out, since a separate job removes it at no cost.
- **A2 The session leaks through the cost step.** Uploading the execution file as an artifact (public repository: any GitHub user can download artifacts) or posting the `result` message whole sends the review's or the update's transcript, including the `result` text and tool inputs, out of the run.
- **A3 The hook runs the pull request's code on GitHub.** In Review, `.claude/` is main's but `scripts/` is the pull request's: a hook in main's `settings.json` that runs `node scripts/<x>.mjs` executes the pull request's script automatically at the end of the Claude step, whose environment holds `ANTHROPIC_API_KEY` or the OAuth token and a token with `pull-requests: write`. In Site update, Claude can edit the script during the session and it then runs at session end. A script-level `GITHUB_ACTIONS` check is not enough, because the script is what the attacker edits.
- **A4 The hook sends transcript text.** A bug or a later edit that spreads a parsed message into the payload (`{...message.usage, ...}` and its neighbours) posts prompts, file contents, paths or Steven's email into D1. That includes private dossier entries read in a session.
- **A5 The ingest secret gets committed or printed.** Through `env` in the committed `.claude/settings.json`; through `.claude/settings.local.json`, which this repository's `.gitignore` does not cover (only Steven's global git ignore file does, `**/.claude/settings.local.json`); through the queue file; or through an error message.
- **A6 The token goes to code a branch controls.** The hook or the workflow posts to a URL taken from the environment or a repository file, or to a `*.pages.dev` preview, whose functions are the branch's own code (and previews share the production D1, `functions/_middleware.ts`).
- **A7 Ingest payload abuse, with or without a leaked token.** Oversized or deeply nested bodies, huge or negative numbers that skew every total, a branch or model id carrying markup (`"><img onerror=…>`) aimed at the admin page where the admin token sits in `localStorage`, SQL in a string, a flood of distinct session ids that fills D1 and slows `GET /api/costs`.
- **A8 Privileges mixed.** The admin token accepted on ingest, the ingest token accepted on a read or on any other admin route, or the two secrets set to the same value (then a leaked ingest token is the admin password).
- **A9 Script injection in the workflow.** `${{ github.event.pull_request.head.ref }}`, a job output or an execution-file value written into a `run:` script; a JSON body built by string concatenation in shell.
- **A10 The committed `settings.json` widens the CI agents.** Main's `.claude/settings.json` is loaded by `claude-code-action` in Review and Site update; a `permissions.allow`, `env` (for example `ANTHROPIC_BASE_URL`), `apiKeyHelper` or another hook in it changes what the CI agents may run, beyond the workflows' `--allowedTools`.
- **A11 A link into the admin.** A pull request or commit URL taken from the payload and used as an `href` (`javascript:` or a look-alike host).
- **A12 Costs reach the public.** Through `/api/building/site`, the feed, prerendered pages, the assistant's context or tools, the public `/mcp`, or WebMCP (`src/webmcp.ts`). Covered by R-1 and R-2; S-13 makes the test concrete.

### Required controls

- **S-1 On GitHub, the post is its own job.** In each workflow a job `costs` with `needs: team` (Review) or `needs: update` (Site update), `if: always()` (skipped for Dependabot's runs, which have no Claude step), `permissions: {}`, `timeout-minutes: 5`, on a fresh runner: no checkout, no `setup-node`, no `npm`, no artifact download, only the runner's own `jq` and `curl`. `COSTS_INGEST_TOKEN` appears in exactly one place in each workflow: the `env:` of that job's one post step; never at workflow or job level, never in a step that runs the pull request's code, never in the Claude step. No `pull_request_target` or `workflow_run` trigger is added.
- **S-2 Only numbers cross from the Claude job.** A step in the `team` or `update` job (`if: always()`, after the Claude step) reads the execution file with `jq`, takes `total_cost_usd`, `num_turns` and `duration_ms` from the last `type == "result"` message and writes each to `$GITHUB_OUTPUT` only when it matches `^[0-9]{1,9}(\.[0-9]{1,12})?$`; nothing else of the file leaves the job. The `costs` job checks the same patterns again. The execution file is never uploaded as an artifact, never posted, never printed beyond the existing permission-denial lines. Accepted residual: code under review can forge its own run's numbers; S-8's caps bound the damage.
- **S-3 No `${{ }}` in `run:` for anything that varies.** The branch, the pull request number, the run attempt and the job outputs reach the script through `env:`; the body is built with `jq -n --arg/--argjson`; `curl --fail --silent --show-error --max-time 10` posts it; every failure is a `::warning::` and `exit 0`. An empty `COSTS_INGEST_TOKEN` (fork pull requests, the secret not yet set) is a warning with no network call. The billing mark (AC-2) is computed from `${{ secrets.ANTHROPIC_API_KEY != '' }}`-style booleans in `env:`, never by passing either credential into the `costs` job. `actionlint` clean.
- **S-4 The hook script lives under `.claude/hooks/`, and the CI guard is in the command.** So the Review workflow swaps it for main's with the rest of `.claude/` (A3). The hook command in `settings.json` refuses on GitHub before any repository code starts, for example `[ "$GITHUB_ACTIONS" = true ] || node .claude/hooks/<name>.mjs` (Claude Code snapshots hooks when the session starts, so a mid-session edit of `settings.json` does not change what runs; the script checks again). The developer confirms in the pull request how the command runs on Steven's Windows machine (Git Bash) and on GitHub. If the developer confirms `claude-code-action` honours it, both workflows also pass `--settings '{"disableAllHooks":true}'` in `claude_args` (defence in depth, a `minor` if left out).
- **S-5 `.claude/settings.json` holds the hook and nothing else.** Exactly `{ "hooks": { "SessionEnd": [ … one command … ] } }`: no `permissions`, `env`, `apiKeyHelper`, `model`, status line or other hook (A10). A test asserts the exact keys and that the command contains the `GITHUB_ACTIONS` guard and a path under `.claude/hooks/`.
- **S-6 The hook sends an allowlist, built field by field.** Never spread or copy a transcript object into the payload. AC-8's exact-keys test, plus a canary test: fixture transcripts carrying a unique string in the user prompt, the assistant text, a tool input, a tool result, `cwd`, a file path and an email address; the canary must be absent from the payload, the queue file and the script's stdout and stderr. The branch goes out only when it passes the server's branch rule (S-8), otherwise as "No feature"; `session_id` only when it is a UUID. The script reads `transcript_path` only when it resolves inside the Claude config folder's `projects/` (`CLAUDE_CONFIG_DIR` or `~/.claude`), and the subagent files only from that session's own folder.
- **S-7 The ingest secret is handled as a secret.** A Pages secret on **Production only** (not Preview); a repository Actions secret (not a Dependabot secret, not a variable); on Steven's machine a user environment variable, read only as `process.env.COSTS_INGEST_TOKEN`: never in `.claude/settings.json`, never in `.claude/settings.local.json`, never in the queue file. The repository's `.gitignore` gains `.claude/settings.local.json` next to the queue file (AC-30). The hook and the workflows post only to the hard-coded `https://steven.wilssens.com/api/costs`; an override for local testing is honoured only for `http://localhost` or `http://127.0.0.1` (A6). Nothing prints the token or the `Authorization` header; errors are one fixed line. The README says how to rotate it (the three places).
- **S-8 The ingest refuses first and parses later.**
  - Order: method (`POST` only), then the token (`sameSecret` against `COSTS_INGEST_TOKEN`, before the body is read), then the body. A fixed `503 {"error":"not configured"}` when the secret is unset, shorter than 32 characters or equal to `ADMIN_TOKEN`; `401 {"error":"unauthorized"}` for a wrong or missing token, the admin token included. Refused on a `*.pages.dev` host (previews share the production D1).
  - Body: `Content-Type: application/json`; read with a cap on the bytes actually read (16 KB, not only `Content-Length`); `413` above it. Exact key sets at every level; at most 64 rows per body. Strings: branch `^[A-Za-z0-9._/-]{1,200}$` that also passes git's ref rules (no `..`, no leading `-` or `/`, no `.lock` suffix, no `//`); role `^[a-z][a-z0-9-]{0,40}$`; model `^[a-z0-9][a-z0-9.-]{0,63}$`; source, billing, workflow and job from fixed lists; phase `^(spec|build|spec\+build|lead|review [1-9][0-9]?|fix [1-9][0-9]?)$`; session id a UUID. Numbers: integers where they count (tokens 0 to 10^10, turns 0 to 10,000, duration up to 24 hours, pull request and run ids positive and bounded), cost in micro-dollars 0 to 10^9 per row ($1,000), times between 2026-01-01 and now plus one day with end at or after start. Any miss: `400 {"error":"invalid"}`, the same body whatever failed, nothing echoed.
  - Volume: at most a stated number of rows written per UTC day (the developer sizes it for Open question 3's backfill, or the backfill sends over several days); above it `429` with a fixed body. Writes are upserts on AC-10's keys, bound parameters only.
  - Logging: never the body, never the header; only the error's class.
  - No CORS headers on any `/api/costs*` route, `Cache-Control: no-store`, and no other method answers 2xx.
- **S-9 The admin routes stay the admin's.** `GET /api/costs` and `POST /api/costs/budget` check `isAdmin` before anything else, and `isAdmin` is unchanged (the ingest token never passes it). Budget: the same branch rule as S-8, an amount 0 < x <= a stated cap, a cap on how many budgets exist (refused above it), fixed error bodies. The read answer carries no secret, no session id (the page does not need it) and nothing from GitHub but state, number and merge SHA.
- **S-10 Nothing from a payload becomes markup or a link.** The Costs page renders every field as React text (no `dangerouslySetInnerHTML`, no `innerHTML`). Pull request and commit links are built only from `GITHUB_REPO`, a positive integer and a 40-hex SHA. A pull request's state and merge commit come from GitHub through `functions/_lib/github.ts` with the server's `GITHUB_TOKEN`, never from the payload; a failed lookup shows "state unknown" and the token is never in the answer.
- **S-11 The queue file is bounded and harmless.** Git-ignored, inside the repository, written atomically, holding only payloads that already passed the client-side allowlist, at most 200 entries or 256 KB (oldest dropped). A file that does not parse is discarded. Without the secret the hook makes no network request at all, so a stranger's clone of this public repository sends nothing.
- **S-12 The hook cannot hurt the session.** It exits 0 in every path, a network timeout of 3 seconds inside AC-9's 5, no prompt or question to Steven, nothing written outside the repository's queue file.
- **S-13 No path from the public side to the costs.** A test over the source: no file under `functions/_lib/ask/`, `functions/_lib/mcp/` (the private server gets no costs tool in this change either), `functions/api/building/`, `functions/api/ask*`, `functions/api/collect.ts`, `src/webmcp.ts` or `src/ask/` imports the costs module or names its tables; the only importers are `functions/api/costs*` and the admin bundle (AC-22, AC-23, R-1, R-2).
- **S-14 The workflows' rules are tested.** A script test that parses both workflow files and asserts S-1 and S-3: the secret's only reference, the `costs` job's `permissions: {}`, no checkout or `uses:` in it, no `${{ }}` inside its `run:` scripts, and the trigger lists unchanged.

### Round 2: the branch across jobs, and upserts (added after the reconciliation)

**The branch of a Site update run as a job output: confirmed, not derived again.** A step's outputs are fixed when that step ends; nothing that runs later in the job (Claude, the checks that run Claude's code, a `BASH_ENV` or `PATH` planted in `$GITHUB_ENV`) can change them, and the job output `branch` is evaluated from that fixed value. What runs before "Create the branch" is main's checkout, main's `npm ci` and the Playwright install: main's code only, the same trust as the workflow itself. Deriving it again in the `costs` job (`needs: [brief, update]`, the title's slug plus `github.run_number`) would copy the slug logic into a second place with no gain in trust, so it is not required. The run key never comes from the `update` job, so a wrong branch could only put one run's cost on the wrong feature, never overwrite another run.

- **S-15 What the `costs` job takes from where.**
  - From its own `github` context and fixed literals, never from a job output: run id (`github.run_id`), run attempt (`github.run_attempt`), workflow and job (literals per workflow: `review`/`team`, `site-update`/`update`); for Review also the branch (`github.head_ref || github.ref_name`) and the pull request (`github.event.pull_request.number || inputs.pr`), checked against `^[1-9][0-9]{0,5}$`.
  - Site update's branch: the `update` job's output is exactly `${{ steps.branch.outputs.branch }}`; in the `costs` job it must pass the S-8 branch rule **and** start with `update/`, otherwise one `::warning::` and no post.
  - Site update's pull request number comes from the `pr` step, which runs after Claude's code, so it is advisory: the server keys Site update rows by branch, takes pull request numbers and states only from GitHub (AC-17), and orders review rounds and counts review waste (AC-3, AC-19) only from `review` rows.
  - From the Claude job only the three numbers of S-2 cross; nothing else becomes a job output.
  - The server builds `run_key` itself from `source` and the validated fields (`github:<runId>:<runAttempt>:<job>`, `local:<session>`); no body carries a run key, and `job` must be the one that belongs to `workflow` (`review`: `team`; `site-update`: `update`).
- **S-16 An upsert replaces, and never with older figures.** Every write is `INSERT ... ON CONFLICT (run_key, branch, batch, role, model) DO UPDATE SET` every value column `= excluded.<column>` (not `INSERT OR IGNORE`, never `col = col + excluded.col`), `WHERE excluded.ended_at >= dev_cost_runs.ended_at`. Without that guard a body left in the queue (a 429, a timeout, the hook killed between the send and the removal, AC-10) and sent after a later one from the resumed session would put back the smaller totals. One body is one `DB.batch` (all its rows or none), and the daily cap (AC-14) refuses the whole body with `429` when its rows would pass the cap, so a body is never half written.
- **S-17 A session's rows keep their keys as its transcript grows.** Upsert without delete leaves a row standing when its key no longer appears, so a key must never move when lines are appended: a message without a branch (empty or `HEAD`) takes the last branch seen **before it** in the session (the first one after it when there is none before; "No feature" when the session has none), never the branch at session end; batch numbers, roles and models are already decided by earlier lines only. A resumed session's second post then only grows existing rows or adds new ones.

### Privacy

No visitor data, no `HASH_SALT`, nothing about anyone but Steven's own tooling. What is stored is numbers, model ids, role names, branch names, session ids and times (AC-8, S-6). Transcripts never leave Steven's machine and execution files never leave their job (S-2). Rows are Steven's working data and are kept until he deletes them; nothing is shown outside `/admin`.

### Residual risk, accepted

- Code under review can forge the numbers of its own run (S-2). Bounded by S-8; the figures are an internal measure, never a gate.
- A branch Steven checks out locally runs its own hook script with his token at session end, as it already runs its own tests. The token only writes rows, so the worst case is false figures. Rotation is in the README.
- A leaked ingest token writes false rows until it is rotated; the daily cap (S-8) and the fixed lists bound how much and what.

### Tests that prove the controls (for the test plan)

| Control | Test | Kind |
|---|---|---|
| S-1, S-3, S-14 | workflow test: the secret is referenced once per workflow, in the `costs` job's post step; that job has `permissions: {}`, no `uses:`, no `${{ }}` in `run:`; triggers unchanged; `actionlint` | script test, check |
| S-2 | extraction step over fixture execution files: valid, missing file, no `result` message, a non-numeric or injected value (`1; curl …`), a huge value; only the three numbers are written | script test |
| S-4, S-5 | `settings.json` has exactly the hook; the command holds the `GITHUB_ACTIONS` guard and a `.claude/hooks/` path; with `GITHUB_ACTIONS=true` the command starts no node process and sends nothing | script test |
| S-6 | canary test over fixture transcripts (prompt, answer, tool input and result, `cwd`, path, email): absent from payload, queue and output; `transcript_path` outside `projects/` is not read; invalid branch becomes "No feature" | script test |
| S-7 | the hook posts only to the production URL; an override to a non-local host is ignored; no token in any output on failure | script test |
| S-8 | per case: no token, admin token, wrong token (401); secret unset, short or equal to the admin token (503); `.pages.dev` host; GET or PUT (not 2xx); wrong content type; 16 KB + 1 byte with and without `Content-Length`; unknown key at each level; 65 rows; each string field with markup, `..`, a control character, over length; each number negative, non-integer, `1e309`, above its cap; time outside range; daily cap reached (429); the same body for every 400; an upsert replaces | function tests |
| S-9 | read and budget with no token, with the ingest token (401); budget branch invalid, amount 0, negative, above cap, budgets cap reached; answer has no session id | function tests |
| S-10 | a row with a branch `"><img src=x onerror=alert(1)>` (inserted directly, bypassing ingest) renders as text; links built only from number and SHA | component test |
| S-11, S-12 | queue capped at 200 and 256 KB; corrupt queue discarded; no secret, no request; network timeout keeps the payload and exits 0 within 5 s | script tests |
| S-13 | import and table-name grep over the listed public folders | unit test |
| S-15 | workflow test: the `costs` job's run id, attempt, workflow and job come from `github.*` or literals; Site update's job output `branch` is `steps.branch.outputs.branch` and the `branch` step comes before the Claude step; the inline script refuses a branch outside `update/` and a pull request that is not a number (fixtures through `bash`); ingest refuses `run_key` in a body and `workflow: review` with `job: update` | script test, function test |
| S-16 | the same body twice gives the same rows; a body with `endedAt` earlier than the stored rows changes nothing; a later one replaces (never adds); a body that would pass the daily cap writes no row | function tests on the fake D1 |
| S-17 | fixture: `HEAD` lines after a branch, then the session resumed on another branch; the first post's rows keep their branch in the second post, which only grows them | script test |

## Technical approach (senior-developer)

> **Reconciled (PM, round 2).** Where this section differs from the acceptance criteria, the criteria win: the GitHub post is a separate `costs` job (AC-1, S-1), not a step in the Claude job; only three numbers cross from the execution file, no per-model tokens (AC-4, S-2); the hook is `.claude/hooks/dev-costs.mjs`, not `scripts/dev-costs.mjs` (AC-5, S-4); bodies are at most 16 KB and 64 rows (AC-14, S-8), so writes are per-row upserts, not delete-then-insert (AC-12); `COSTS_INGEST_URL` is honoured only for localhost (AC-10, S-7). F-1 to F-5 are folded in (Reconciliation).

**Feasibility: buildable, with four amendments to the ACs (F-1 to F-4 below) and one finding Steven should hear now (F-5).** Checked on 2026-10-19 against `anthropics/claude-code-action@v1` (tag at `db77d4d`, its `action.yml`, `base-action/src/execution-file.ts`, `run-claude-sdk.ts`, `validate-env.ts`), the Claude Code docs (Authentication precedence, Hooks → SessionEnd), the Review run 39349674556 log, and the 46 local transcripts of this repository in `~/.claude/projects/e--Repos-stevenwilssens/`.

### Data flow

```
GitHub: claude-code-action step ──execution file──> "Record what it cost" step (jq + curl, inline) ──┐
Local:  Claude Code session ends ──SessionEnd hook──> scripts/dev-costs.mjs ──(queue on failure)───────┤
                                                                                                        v
                         POST /api/costs (COSTS_INGEST_TOKEN only) ──> D1 dev_cost_runs (tokens, reported cost)
                         GET  /api/costs (admin token) ──> views.ts: prices, phases, rounds, waste, budgets
                                                         + one GitHub call: pull requests by branch (state, merge commit, supersedes)
                         POST /api/costs/budget (admin token) ──> D1 dev_cost_budgets
/admin#costs (admin bundle only) <── GET /api/costs
```
(Draft diagram; the reconciled flow, with the separate `costs` job, is the one under Outcome.)

Local runs send **tokens**, never a price; the server prices them at read time from one table, so a corrected price fixes the history. GitHub runs send the action's own `total_cost_usd` (Claude Code's calculation) plus the per-model tokens beside it.

### What the action gives us (AC-1, AC-2)

- **Execution file.** `claude-code-action@v1` writes every SDK message as a JSON array to `$RUNNER_TEMP/claude-execution-output.json` and sets the output `execution_file` (`steps.<id>.outputs.execution_file`). It writes the file also when the SDK throws; a step that is **cancelled** (Review's `concurrency: cancel-in-progress`, a timeout) writes nothing, so that spend is not recorded (said on the page's empty-state note and in README; there is no number to record). The post step reads `steps.<id>.outputs.execution_file` and falls back to `$RUNNER_TEMP/claude-execution-output.json` (the sign-offs step already reads that path). Confidence: high (source read).
- **Cost.** The last `type: "result"` message carries `total_cost_usd`, `num_turns`, `duration_ms` and `modelUsage` (per model: `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`, `costUSD`). Seen in the Review run log of 2026-10-20 00:56 (`total_cost_usd: 5.6452057`, `num_turns: 16`). The log shows a sanitised copy; the file keeps the full message. That total includes the subagents the lead started (Claude Code sums the session); confidence medium-high. It is **always the API-equivalent price**, whatever the credential: it says nothing about billing.
- **Credential.** The action passes both inputs to Claude Code as `ANTHROPIC_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN` and validates only that one is present. Claude Code's documented precedence: `ANTHROPIC_API_KEY` before `CLAUDE_CODE_OAUTH_TOKEN`, and "in non-interactive mode (`-p`), the key is always used when present". The action runs Claude Code through the SDK, non-interactively. So **when both are given, the API key is used: billed.** Confidence: high (documented). The step decides at run time: `HAS_API_KEY: ${{ secrets.ANTHROPIC_API_KEY != '' }}` → `billed`, else `HAS_OAUTH` → `estimated`; cross-checked with the `apiKeySource` of the `system/init` message when the file carries it (`ANTHROPIC_API_KEY` vs `none`); when the two disagree or neither is known → `unknown`. The rule and its source go in a comment next to the step (AC-2), and as a pure function in the step's jq so a script test can drive it with fixture files.
- **F-5, for Steven now (Open question 2):** both secrets are set on the repository today (`gh secret list`: `ANTHROPIC_API_KEY` 2026-10-18, `CLAUDE_CODE_OAUTH_TOKEN` 2026-10-17), so **every Review and Site update run since 2026-10-18 has been billed to the API key, not the subscription.** If he wants the subscription, the workflows pass only `claude_code_oauth_token` (and then nothing on GitHub is billed).

### The workflow steps (AC-1, AC-3)

- `review.yml`, job `team`: the step "The team reviews the pull request" gets `id: team`. A new step **after it and before "Post the sign-offs"**: `name: Record what the review cost`, `if: always() && steps.who.outputs.dependabot != 'true'`, `continue-on-error: true`, `timeout-minutes: 1`. Env: `COSTS_INGEST_TOKEN` (secret), `EXECUTION_FILE`, `HAS_API_KEY`, `HAS_OAUTH`, `BRANCH: ${{ github.head_ref || github.ref_name }}` (a dispatched run is on the pull request's branch, already checked), `PR`. Inline bash only (`/usr/bin/jq`, `/usr/bin/curl` by absolute path, `--max-time 10`), no repository script: the job has run the pull request's code, and the post must not run it again with a secret in its environment. No file, no token, no secret → `::warning::` and exit 0. The payload holds only numbers and model ids (AC-8 applies to it too); the execution file itself is never uploaded (it holds prompts and tool output).
- `site-update.yml`, job `update`: "Let Claude make the change" gets `id: claude` (this changes the team step, so the Team page marks Site update New; intended). The same step at the **end of the job**, `if: always()`, so it has the pull request number when there is one (`${url##*/}` of `steps.pr.outputs.url`) and the branch from `steps.branch.outputs.branch`; workflow `site-update`, phase `spec+build`.
- **Rounds (AC-3) are computed on the server, at read time,** not in the workflow (a workflow has no memory of earlier runs): the Review rows of one pull request ordered by `(run_id, run_attempt)` are rounds 1..n. A re-run of the same run is a higher attempt, a push or a dispatch is a higher run id. Only runs that wrote an execution file are recorded, so only runs whose team step ran count. A pure function `reviewRounds(rows)` in `functions/_lib/costs/views.ts`, tested.
- The GitHub key is `github:<run_id>:<run_attempt>:<job>` (AC-10).

### The SessionEnd hook (AC-4 to AC-10)

- **`.claude/settings.json`** (new, committed; today there is only `settings.local.json`):
  ```json
  { "hooks": { "SessionEnd": [ { "hooks": [ { "type": "command", "timeout": 5,
    "command": "[ \"$GITHUB_ACTIONS\" = true ] || node \"$CLAUDE_PROJECT_DIR/.claude/hooks/dev-costs.mjs\"" } ] } ] } }
  ```
  The GitHub guard is in the **command**, not only in the script: in the Review job `.claude/` is main's but `scripts/` is the pull request's, and a hook inherits Claude Code's environment (the Anthropic key, the GitHub token). With the guard in main's settings file, a pull request's (or Claude's own, in Site update) edited script never runs in CI. The script checks `GITHUB_ACTIONS` again. Hook commands run through Git Bash on Windows (Steven's machine), so the POSIX test works there; to be confirmed by hand once (test plan, manual).
- **Input** (stdin JSON): `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `reason` (`clear`, `resume`, `logout`, `prompt_input_exit`, `other`). Only `session_id` and `transcript_path` are used; `cwd` and paths never leave the machine.
- **Timing.** SessionEnd hooks get 1.5 s by default; a per-hook `"timeout": 5` raises the budget to 5 s (documented, up to 60). The script first writes the payload to the queue, then sends the queue (each request `AbortSignal.timeout(2500)`), and removes what was accepted. So a kill at 5 s loses nothing.
- **Transcript format** (verified on the local files): one JSON object per line. Assistant lines: `type: "assistant"`, `message.id`, `message.model`, `message.usage` (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `cache_creation.ephemeral_5m_input_tokens`, `cache_creation.ephemeral_1h_input_tokens`, `speed`, `service_tier`, `iterations`), `gitBranch`, `sessionId`, `timestamp`, `isSidechain`. Subagents: `<transcript without .jsonl>/subagents/agent-<id>.jsonl` and `agent-<id>.meta.json` with `agentType`, `toolUseId`, `spawnDepth`, `description` (never sent).
  - **Repeats:** one API message is written as several lines (one per content block), 97 repeats in one session here, and **the repeats do not all carry the same usage** (`output_tokens` 3, 3, then 249 for one message). The rule: per `message.id`, the **last** line's usage counts (the final one). Tested with exactly that fixture.
  - Lines with model `<synthetic>` (zero usage) are skipped. Only lines whose `sessionId` is the hook's `session_id` count (a resumed session that copies history under a new id must not count it twice; none of the 46 files mixes ids today, the filter is cheap insurance).
  - `speed: "fast"` messages are kept apart as model `<id>:fast` and are `unpriced` unless the table has a fast price (never priced as standard).
  - `iterations` has only `type: "message"` entries today; the top-level usage is the sum. Anything else in it (an advisor model) is ignored with the top-level usage kept; noted for the price table.
- **Roles (AC-5):** a subagent's role is its `.meta.json` `agentType` (seen: the six team roles, `Explore`, `general-purpose`); missing or unreadable meta → `unknown-agent`. The main thread is `lead`. Each message charges the `gitBranch` it carries; `HEAD` or empty → the last branch seen in the session (the branch at session end), and if none, "No feature".
- **Batches and phases (AC-6), F-1.** A **batch** is the lead's assistant message (by `message.id`, in order) whose `tool_use` block has the id in `meta.toolUseId`: agents started in one message are one batch. A nested agent (`spawnDepth` 2) whose `toolUseId` is in another subagent's transcript takes that agent's batch. The hook sends one row per **session × branch × batch × role × model**, with the batch's time. **The phase rule runs on the server over all local rows of a branch in batch-time order, not per session:** a feature is often spread over several sessions (`/clear` starts a new session id; this spec's feasibility pass is in a different session from its build), and a per-session rule would call the developer's first run in session two "build" again. The rule, in `functions/_lib/costs/phases.ts`: before the first batch that is only `senior-developer`, every batch is `spec` (this covers the developer's feasibility pass, which runs beside security and the tester); that batch is `build`; after it, a batch with any role other than `senior-developer` is `review N` (its developer is the code reviewer); a batch of only `senior-developer` after review N is `fix N`; a lone non-developer batch after a review joins that review; anything else (an `Explore`, a `general-purpose` before any build) is `lead`. Every token is in exactly one phase. **AC-6 should say "per feature, across sessions" and AC-10's local key becomes session, branch, batch, role and model.**
- **Pricing, F-2.** AC-4 says the script turns tokens into a cost; I propose the **server** does, at read time, from one table (`functions/_lib/prices.ts`: per model input, output, cache read, cache write 5 m, cache write 1 h, in micro-dollars per token, with the pricing page URL and the date read). Same result, one table, and a corrected price fixes past rows. The script test then asserts the tokens; the price is a unit test of `prices.ts`. A model id is matched exactly, then without a date suffix; no match → `unpriced`. The developer fills the table from the pricing page on the day of the build (no number in this spec; the assistant already uses `claude-opus-5-5` at $4 / $20 per MTok, cache read $0.20, cache write 1 h $8, in `functions/_lib/ask/agent.ts`; that `PRICE` should read from the new table so there is one, but `prices.ts` holds no cost data, so AC-23's "no costs module" still holds).
- **Local billing mark.** A local session is `estimated` when `ANTHROPIC_API_KEY` is not in the hook's environment; when it is, `unknown` (in an interactive session the key is used only once Steven approved it, which the hook cannot see).
- **Queue (AC-9):** `.dev-costs-queue.jsonl` at the repository root (each worktree has its own), git-ignored, one payload per line, at most 200 lines (oldest dropped, with a stderr note), rewritten through a temp file and rename. No `COSTS_INGEST_TOKEN` in the environment → the payload is queued and nothing is sent. URL `https://steven.wilssens.com/api/costs`, `COSTS_INGEST_URL` overrides it (local dev, tests).
- **Backfill (Open question 3):** `node scripts/dev-costs.mjs --backfill` runs the same code over every `*.jsonl` in the project folder next to the current transcript (or `--dir`), queues and sends; the session key makes it safe to run twice.
- **Exit code:** always 0; errors go to stderr in one line without the payload.

### Payloads (exact keys, AC-8, AC-12)

```jsonc
// local
{ "v": 1, "source": "local", "session": "<uuid>", "startedAt": 1760900000000, "endedAt": 1760903600000, "billing": "estimated",
  "rows": [ { "branch": "dev-costs", "role": "senior-developer", "batch": 3, "batchAt": 1760901000000, "model": "claude-opus-5-5",
              "input": 12, "output": 3400, "cacheRead": 910000, "cacheWrite5m": 0, "cacheWrite1h": 31249 } ] }
// github
{ "v": 1, "source": "github", "workflow": "review", "job": "team", "runId": 39349674556, "runAttempt": 1, "branch": "dev-costs", "pr": 61,
  "billing": "billed", "costUsd": 5.6452057, "numTurns": 16, "durationMs": 418786, "endedAt": 1760921777000,
  "models": [ { "model": "claude-opus-5-5", "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 } ] }
```
`role` and `model` match `^[a-z0-9][a-z0-9.:_-]{0,63}$` (`<synthetic>` never sent), `branch` a git ref name of at most 200 characters (no `..`, `@{`, control characters, leading `-` or `/`, trailing `.lock`), `session` a UUID, at most 500 rows, body at most 64 KB; the caps on tokens and cost are the security engineer's to set.

### D1: `migrations/0013_dev_costs.sql` (AC-11)

```sql
-- What each change cost to build with Claude: one row per GitHub run and model, or per local session,
-- branch, batch of agents, role and model. Tokens always; the cost the action reported for GitHub runs.
-- Local rows are priced when read (functions/_lib/prices.ts). Admin only: nothing public reads these tables.
CREATE TABLE IF NOT EXISTS dev_cost_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,                 -- github | local
  run_key TEXT NOT NULL,                -- github:<run_id>:<attempt>:<job> | local:<session uuid>
  branch TEXT NOT NULL DEFAULT '',      -- '' and 'main' collect under "No feature" ('' not NULL: UNIQUE treats NULLs as distinct)
  pr INTEGER,                           -- github only
  workflow TEXT,                        -- review | site-update (github)
  run_id INTEGER, run_attempt INTEGER,  -- github: the round order of a pull request
  role TEXT NOT NULL,                   -- lead | agentType | the workflow's name for github rows
  batch INTEGER NOT NULL DEFAULT 0,     -- local: the lead message that started the agents; 0 for lead and github
  batch_at INTEGER NOT NULL,            -- epoch ms: order of batches across sessions
  model TEXT NOT NULL,
  billing TEXT NOT NULL,                -- billed | estimated | unknown
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_5m_tokens INTEGER NOT NULL DEFAULT 0, cache_write_1h_tokens INTEGER NOT NULL DEFAULT 0,
  reported_micro INTEGER,               -- github: total_cost_usd in micro-dollars, on the run's first model row only
  num_turns INTEGER, duration_ms INTEGER,
  started_at INTEGER NOT NULL, ended_at INTEGER NOT NULL, received_at INTEGER NOT NULL,
  UNIQUE (run_key, branch, batch, role, model)
);
CREATE INDEX IF NOT EXISTS dev_cost_runs_branch ON dev_cost_runs (branch, batch_at);
CREATE INDEX IF NOT EXISTS dev_cost_runs_ended ON dev_cost_runs (ended_at);

CREATE TABLE IF NOT EXISTS dev_cost_budgets (
  branch TEXT PRIMARY KEY,
  budget_micro INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```
**Replace, never double (AC-10):** an ingest is one `DB.batch([DELETE FROM dev_cost_runs WHERE run_key = ?, INSERT …×n])`, atomic in D1, so a resent or resumed session replaces all its rows, including a branch it no longer has. No retention limit (no personal data; tens of rows per session, well under 50k a year at Steven's pace); a monthly roll-up is the follow-up if it ever matters.

### Endpoints and modules

- `functions/_lib/env.ts`: `COSTS_INGEST_TOKEN?: string`.
- `functions/api/costs.ts`: `onRequestPost` (ingest): `sameSecret(bearer, env.COSTS_INGEST_TOKEN)` only, refused when the ingest token is unset **or equal to `ADMIN_TOKEN`** (so the admin token is never an ingest token, AC-11); 415/413/400 with fixed bodies, the `readCapped` pattern of `functions/api/team.ts` (to be shared rather than copied a third time: `functions/_lib/http.ts`). Recommended to the security engineer: refuse on `*.pages.dev` hosts (previews share the production database, `functions/_middleware.ts`) and set the Pages secret for production only. `onRequestGet` (admin token): the five views in one JSON, `no-store`, no CORS. An ingest token on GET → 401.
- `functions/api/costs/budget.ts`: `POST { branch, amountUsd | null }` (admin token); `null` clears. Pages routes `costs.ts` and `costs/budget.ts` side by side, as `ask.ts` and `ask/` already do.
- `functions/_lib/costs/ingest.ts` (exact-shape parser, pure), `store.ts` (D1: replace, list, budgets), `phases.ts` (local phase rule), `views.ts` (per feature, per role, per month for 12 months with empty months, waste, over-budget list, review rounds, billing mark of a sum: billed < estimated < unknown, unpriced kept apart), each with tests on the fake D1 (`functions/_lib/testing/d1.ts`).
- **Pull request state (AC-15, AC-18):** `GET /api/costs` makes one GitHub call through the existing `gitHubClient` (`functions/_lib/github.ts`): `pulls('all')` with `per_page=100`, and `shapePull` gains `mergeCommit` (`merge_commit_sha`). Matched to a feature by head branch; `merged` → merged with its commit; closed and another pull request's `site-update-request` marker says `supersedes: <n>` (`updateRequestFromBody`, already there) → superseded; closed otherwise → closed unmerged; none → no pull request. Without `GITHUB_TOKEN`, or when GitHub fails, the states read "unknown" and the rest of the page works. Queries per admin load: two D1 reads and one GitHub call. CPU: the rows are summed in one pass; fine for years at this grain.

### The Costs page (admin bundle only)

- `src/admin/CostsPage.tsx` (+ test): the five cards in the design's order, the budget form; `src/admin/pages.tsx` (entry after Team, receipt icon); `src/admin/types.ts` (`CostsInfo`); `src/admin/Admin.tsx` (`useApi('/api/costs')`, the budget POST, the in-place update of the row, tile, Needs you and badge); `src/admin/needs.ts` (`computeNeeds` and `computeSummaries` take `costs`; `cutLine` for branches); `src/admin/Overview.tsx` (tile); `src/admin/format.ts` (`formatCost(micro, mark, unpriced)`, D-2); `src/admin/Charts.tsx` (`BarChart` takes an optional `estimated` per bar, drawn outlined on top); `src/admin/Skeleton.tsx` (`what="costs"`); `src/admin/admin.css` (`.budget-form`, the estimated bar part). Nothing in `src/` outside `src/admin/` imports any of it; the admin entry is already its own chunk, so the home page's bytes do not change (AC-24, checked by comparing `dist/assets` with main's build).

### Orchestration, the write-up and docs (AC-27 to AC-30)

- `.claude/team.md`: one sentence under "The flow" (the team's runs are metered, without "every": a cancelled run is not recorded; GitHub runs by a step after the Claude step, local sessions by the SessionEnd hook; figures on `/admin#costs`) and in the Mermaid chart one node `meter[/Runs metered: admin, Costs/]` (AC-34) joined with dotted links (`build -.- meter`, `reviews -.- meter`, `fix -.- meter`), no `%% step` line and no `you`/`gate` class, so the step lines stay valid.
- `scripts/team-manifest.mjs`: `{ glob: '.claude/settings.json', section: 'flow' }` in `ORCHESTRATION` (it is under `.claude/**`, an audited place, so the coverage test fails without it); `scripts/dev-costs.mjs` in `IGNORED` with the reason "measures the runs; hands nothing between agents or to Steven" (it is outside the audited globs; listing it says the choice was made). The settings file's change then shows on the Team page as a flow update. `scripts/team-manifest.test.mjs` passes on the real repository (it reads JSON as text; no parser change).
- `src/articles/site/Diagrams.tsx`: `TeamFlowDiagram`, the metered layer as the design says (wide: rect y 448, height 32, footer to 508, viewBox 760×524; tall: two lines before the footer, `tallHeight` + 44), `flowDescription` gains the sentence. `src/articles/site/SiteArticle.tsx`: one sentence in "Put every change past a team", wording per R-3 ("on GitHub, and in my own Claude Code sessions through a hook", which is true once this merges and the secret is set; until Steven sets it, the sentence must not say "every"), only if Open question 1 is yes. Tests: the sentence, no digit in it, and the layer in both drawings.
- `README.md`: a "Costs" section (the hook, the two workflow steps, `COSTS_INGEST_TOKEN` as a Pages secret for production, a repository secret, and a user environment variable on Steven's machine; the backfill command; that cancelled runs are not recorded). `.gitignore`: `.dev-costs-queue.jsonl`. `vitest.config.ts`: `scripts/dev-costs.mjs` in `coverage.include` (it is a gate-like script with pure parts; the CLI wrapper is a thin `main`).
- `CLAUDE.md` needs no change unless the PM wants the hook mentioned under "The team" (a rules change would then show on the Team page; not required by any AC).

### Files

New: `migrations/0013_dev_costs.sql`; `functions/api/costs.ts`, `functions/api/costs/budget.ts`; `functions/_lib/costs/{ingest,store,phases,views}.ts`; `functions/_lib/prices.ts`; `functions/_lib/http.ts`; `scripts/dev-costs.mjs`; `.claude/settings.json`; `src/admin/CostsPage.tsx`; tests next to each, and fixtures under `scripts/fixtures/dev-costs/` (two models, a repeated message with growing usage, two subagents with meta, a /feature-shaped session, a second session on the same branch, a branch switch) and `functions/_lib/costs/fixtures/` (an execution file with init and result). Changed: `functions/_lib/env.ts`, `functions/_lib/github.ts`, `functions/api/team.ts` (shared `readCapped`), `functions/_lib/ask/agent.ts` (`PRICE` from the table), `src/admin/{Admin,pages,types,needs,Overview,format,Charts,Skeleton}.ts(x)`, `src/admin/admin.css`, `.github/workflows/review.yml`, `.github/workflows/site-update.yml`, `scripts/team-manifest.mjs`, `.claude/team.md`, `src/articles/site/{Diagrams,SiteArticle}.tsx`, `README.md`, `.gitignore`, `vitest.config.ts`. Unchanged: `src/resume.ts`, the PDF, `src/pageMeta.ts`, `feed.json`, `functions/_lib/building.ts`, the assistant's and the public MCP's code (apart from the price constant's source).

### Amendments for the PM (all folded in, round 2)

- **F-1** AC-6: phases are assigned per feature across all its local sessions (batch order), not per session; AC-10's local key is session, branch, batch, role and model.
- **F-2** AC-4/AC-7: the hook sends tokens; the server prices them from the one table at read time.
- **F-3** AC-18 and the Features table: a GitHub Review round and a local `/team-review` round are different rounds. Recommendation: "review rounds after the first" counts per place (local rounds after the first, Review workflow rounds after the first on that pull request); the first required Review run after a clean local review is not waste. The detail list shows "Review workflow, round N" apart from "Review round N".
- **F-4** AC-1: a cancelled or timed-out Claude step writes no execution file, so its spend cannot be recorded; the page and README say so. Not fixable from outside the action.
- **F-5** Open question 2 should say that, with both secrets set as they are today, the action uses the API key: every GitHub run is billed now.

### One pull request?

Yes, at the upper end: about 25 files plus tests (roughly 2,500 to 3,500 lines with fixtures). Keep it one, because the write-up's sentence and the Team page's "metered" are only true once the recording and the page ship together. If a review round shows it too large, the clean cut is recording (migration, ingest, hook, workflows, orchestration and write-up) first and the page second, with the sentence moved to the second.

## Test plan (senior-tester)

**Verdict on the spec (tester): CHANGES_REQUESTED** until T-1 and T-2 below are settled in the spec (both change what the fixtures assert); the rest of the plan stands as written.

> **Reconciled (PM, round 2):** T-1 to T-7 are settled (AC-18, AC-8, AC-14/15, AC-17, AC-22, Terms and AC-23, AC-3). The tables below use the reconciled AC numbers and file names: the hook is `.claude/hooks/dev-costs.mjs` with `scripts/dev-costs-hook.test.mjs`; there is no `scripts/cost-report.mjs` (S-1: the `costs` job has no checkout), its inline scripts are tested by `scripts/costs-workflows.test.mjs`; phases are tested on the server (`functions/_lib/costs/phases.test.ts`), prices in `functions/_lib/prices.test.ts`, validation in `functions/_lib/costs/ingest.test.ts`.

### Ground rules for every test below

- **Where the code must live so it can be tested.** The hook (`scripts/cost-hook.mjs`) and the workflow post step (`scripts/cost-report.mjs`) are scripts, not inline shell or `jq` in the YAML, each exporting pure functions plus a `main({ argv, env, stdin, fetch, root, now })` that the CLI line calls; nothing reads `process.env`, the clock, `fetch` or the home directory except through those arguments. Both go into `coverage.include` in `vitest.config.ts` next to `scripts/team-manifest.mjs` (an include, not an exclusion), so the 90% per-file bar applies to them. The price table, the ingest validation, the round, phase-and-waste rules and the month series are pure modules in `functions/_lib/costs/` with tests next to them. (File names may change in the build; the mapping below follows them.)
- **Fakes reused, none new:** `fakeD1()` and `context()` from `functions/_lib/testing/d1.ts` (every migration applied, so `0013_dev_costs.sql` runs for real); the `fetch` stub of `src/admin/Admin.test.tsx` and the GitHub stub of `functions/_lib/github.test.ts`; the fixed clock `NOW` (19 October 2026) of `src/test/admin-fixtures.ts`, which gains one builder `makeCosts(overrides)` for the `GET /api/costs` answer.
- **Fixture transcripts** are small hand-written JSONL files under `scripts/fixtures/cost-hook/` shaped like real Claude Code lines (`type`, `message.id`, `message.model`, `message.usage` with `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens`, `gitBranch`, `timestamp`, `sessionId`), with `<session>/subagents/agent-*.jsonl` and `agent-*.meta.json`. No prompt text from a real session goes into a fixture. Tests copy them to a fresh `mkdtemp` directory and point `root` and `transcript_path` there; nothing reads or writes the real `~/.claude` or the repository's queue file.
- **Expected costs are literals worked out by hand** from the table's rows (for example 1,000 output tokens of a model at $15/MTok = 15,000 micro-dollars), never recomputed with the code under test.
- **Deterministic:** `vi.useFakeTimers()` with a fixed `now` wherever time matters, `vi.stubEnv` / `vi.unstubAllEnvs()` for `GITHUB_ACTIONS` and `COSTS_INGEST_TOKEN`, a `fetch` stub that throws on any URL it was not given (no network), no shared state between tests (each builds its own `fakeD1()` and temp directory, removed in `afterEach`).

### Acceptance criteria to tests

Reconciled by the PM (round 2): the AC numbers below are the reconciled ones (the draft's numbers map as in "Reconciliation" at the end of the spec); the file names follow the Technical approach. Where the test plan's draft said the workflow post step is a repository script (`scripts/cost-report.mjs`), S-1 wins: the post runs in a `costs` job with no checkout, so its `run:` scripts are inline and are tested by executing them from the YAML (below). The hook is `.claude/hooks/dev-costs.mjs` (S-4), in `coverage.include`.

| AC | Test (file: what it asserts) | Kind |
|---|---|---|
| AC-1 | `scripts/costs-workflows.test.mjs` (reads both YAML files as text, like `team-manifest.test.mjs`): the Claude step has its `id`; the extraction step follows it with `if: always()` and reads `steps.<that id>.outputs.execution_file`; the `costs` job has `needs`, `if: always() && needs.<job>.result != 'skipped'`, `permissions: {}`, `timeout-minutes`, no `actions/checkout`, no `uses:`, no `npm`; no `${{ }}` inside any of its `run:` scripts; `COSTS_INGEST_TOKEN` referenced exactly once per workflow, in the post step's `env:`; trigger lists equal main's. Then it extracts both `run:` scripts and runs them with `bash` and `jq` against fixture execution files (`functions/_lib/costs/fixtures/`: the action's format with `system/init` and two `result` messages, the source noted), `/usr/bin/curl` replaced in the text by a stub that records its arguments and stdin: the **last** result is taken, `is_error: true` still posted; missing file, empty file, invalid JSON, no `result`, a value `1; curl evil` and a 13-digit value each give one `::warning::`, exit 0 and no post; an empty secret gives a warning and no stub call; a failing stub gives a warning and exit 0; the secret never appears in stdout or stderr. The test fails when `bash` or `jq` is missing and `CI=true`, and is skipped with a stated reason only off CI. `actionlint` on both files in CI. | workflow text test + script execution |
| AC-2 | `costs-workflows.test.mjs` "billing": `HAS_API_KEY=true` with and without `HAS_OAUTH` -> `billed`; only `HAS_OAUTH` -> `estimated`; neither -> `unknown`; the step's comment cites the Claude Code authentication docs; neither secret's value is referenced in the `costs` job. | script execution |
| AC-3 | `functions/_lib/costs/views.test.ts` "review rounds": three Review rows on PR #61 posted in the order 3, 1, 2 are rounds 1, 2, 3 by `(run_id, run_attempt)`; attempt 2 of a run is the next round; another PR starts at 1; a Site update row is `spec+build`, in the Build column, never a round. | unit |
| AC-4 | `costs-workflows.test.mjs`: the body built by the post script has exactly the GitHub keys; `pr` absent on a Site update run without a pull request; an invalid branch output is refused with a warning. `functions/api/costs.test.ts`: a GitHub body with a `models` key or token counts is refused (400). | script execution + function |
| AC-5 | `scripts/dev-costs-hook.test.mjs` "settings": `.claude/settings.json` has exactly the keys `hooks.SessionEnd[0].hooks[0].{type,timeout,command}`, `timeout` 5, the command starts with the `GITHUB_ACTIONS` guard and names `.claude/hooks/dev-costs.mjs`; running the command under `bash` with `GITHUB_ACTIONS=true` starts no node process (a marker file the script would write is absent); `main({ env: { GITHUB_ACTIONS: 'true' } })` reads no file and calls no fetch. | script unit |
| AC-6 | `dev-costs-hook.test.mjs` "sums": a main transcript and two subagents; one message id on three lines with output 3, 3, 249 counts 249 once; two models apart; the five token kinds apart; a line with another `sessionId` ignored; `<synthetic>` ignored (not `unpriced`); a `fast` message under `<id>:fast`; malformed lines skipped; no `subagents/` folder; a `transcript_path` outside `projects/` is not read. Asserts token literals; no price in the payload. | script unit |
| AC-7 | `dev-costs-hook.test.mjs` "roles, batches, branches": `agentType` of each of the six roles and `Explore` -> `explore`; a missing and a corrupt meta -> `unknown-agent`; main thread `lead` with batch 0; three agents started in one lead message share a batch and its time; a nested agent takes its parent's batch; a session moving `main` -> `dev-costs` -> `fix-x` charges each its own messages; `HEAD` and empty take the last branch; an invalid branch -> "No feature". | script unit |
| AC-8 | `dev-costs-hook.test.mjs` "billing": no `ANTHROPIC_API_KEY` -> `estimated`; with it -> `unknown`; never `billed`. | script unit |
| AC-9 | `dev-costs-hook.test.mjs` "allowlist": exact keys at both levels; the canary (prompt, answer, tool input, tool result, `cwd`, path, email) absent from payload, queue, stdout and stderr; a non-UUID session id is not sent; 70 rows go in two bodies (64 + 6). | script unit |
| AC-10 | `dev-costs-hook.test.mjs` "never in the way": no secret -> queued, fetch never called; fetch rejects, then 204 on the next run -> both sent, queue empty; a fetch that never answers is aborted at 2.5 s (fake timers) and stays queued; 429 stays queued; 400 dropped with one stderr line; 201 entries and 256 KB + 1 byte -> oldest dropped; a corrupt line dropped, the rest sent; the queue written via rename (no partial file after a thrown write); `COSTS_INGEST_URL=https://evil.example` ignored, `http://127.0.0.1:8788` honoured; no token in any output; exit 0 in every case. | script unit |
| AC-11 | `dev-costs-hook.test.mjs` "backfill": two past sessions in a temp folder are queued and sent; a second run sends the same keys. | script unit |
| AC-12 | `functions/api/costs.test.ts` "upsert": the same GitHub body twice -> one row; attempt 2 -> new row; a local session posted again with larger totals -> its rows hold the new totals, not the sum; the same session with a new branch -> old rows updated, one new row; no `round` or `phase` column exists in the migration. | function (fake D1) |
| AC-13 | `costs.test.ts`: no token, wrong token, `Basic`, token in query or cookie, the admin token -> 401 with `request.bodyUsed === false` and no query run; secret unset, 31 characters, equal to `ADMIN_TOKEN` -> 503; host `x.stevenwilssens.pages.dev` -> refused; `GET`/`PUT`/`DELETE` on ingest not 2xx; wrong content type -> 415; 16 KB + 1 byte with and without `Content-Length` -> 413; the ingest token on `GET /api/costs`, `POST /api/costs/budget`, `/api/stats`, `/api/team`, `/api/resume`, `/api/ask/admin` and the admin parts of `/api/mcp` -> 401 (looped); `no-store` and no `Access-Control-*` on every answer, errors included. | function (fake D1) |
| AC-14 | `functions/_lib/costs/ingest.test.ts`, each cap at its value (accepted) and one above (refused): 64/65 rows, tokens 10^10, turns 10,000, duration 86,400,000, `costMicro` 10^9, PR 10^6, run id 10^13, attempt 100, batch 10,000; `-1`, `1.5` for a count, `1e309`; unknown key at each level and `__proto__`; each branch case (`dev-costs`, `feature/x`, 200 accepted; 201, `..`, `@{`, leading `-` or `/`, trailing `/` or `.lock`, `//`, a space, a control character, `"><img src=x onerror=alert(1)>` refused); role and model patterns (`claude-opus-5-5:fast` accepted; `<script>`, a space, 65 characters refused); times before 2026-01-01, after now plus one day, end before start. `costs.test.ts`: every 400 has the identical body and contains none of the input; the 5,001st row of a UTC day -> 429, nothing written; a log spy sees no body. | unit + function |
| AC-15 | `costs.test.ts`: `GET` on an empty database -> the five views empty and the "no data" flag; seeded -> each view's figures as hand-worked literals; no session id in the answer; a D1 failure -> 500 with a fixed body. Budget: set, change, clear, `0`, negative, 1000 accepted, 1000.01 refused, a string, an invalid branch, the 501st budget -> 400, nothing written. | function (fake D1) |
| AC-16 | `functions/_lib/prices.test.ts`: the table names its URL and date; every model has all five kinds; each kind of one model priced to a hand-worked literal; a date-suffixed id matches its base; an unknown id and `<id>:fast` without a fast price -> `unpriced` (`null`, never `0`). `costs.test.ts`: an unpriced row is in the answer with its tokens, flagged, and not in any total; changing the table changes an old row's price. `functions/_lib/ask/agent.test.ts` still passes with `PRICE` from the table. | unit + function |
| AC-17 | `costs.test.ts` with the GitHub stub of `github.test.ts`: merged with its commit; open; closed, not merged; superseded via another pull request's marker; no pull request; a payload trying to carry a state or SHA is refused (AC-14); GitHub failing or `GITHUB_TOKEN` unset -> "state unknown" and the rest of the answer intact; pagination stops at 5 pages. | function |
| AC-18 | `functions/_lib/costs/phases.test.ts`: the two-session `/feature` fixture gives exactly spec, spec, build, review 1, fix 1, review 2, fix 2, review 3, lead, with the sum of phases equal to the total to the micro-dollar; the developer in the review batch is review, not fix; the developer in the second spec batch is spec, not build; a `/team-review`-only feature -> review 1; an `explore`-only batch -> lead; an `explore` inside a review batch -> that review; no subagents -> all lead. | unit |
| AC-19 | `views.test.ts` "waste": local fix rounds; local reviews after the first; Review workflow rounds after the first on that PR; a first Review workflow round after a clean local review is not waste; all of a closed or superseded feature, its fix rounds not counted twice; waste <= total; one review and no fix -> no waste. | unit |
| AC-20 | `needs.test.ts` "costs tile": the designer's four lines; `Overview.test.tsx`: the tile links to `#costs`; `Admin.test.tsx`: Costs after Team, no range switch on it. | unit + component |
| AC-21 | `src/admin/CostsPage.test.tsx` "Features": seven headers in order; exact `href`s of PR and commit links; each state's words including "state unknown"; "No feature" last without a budget field; the Total's second line when mixed; opening by click, Enter and Space shows every round on its own line with its roles, "Spec and build (Site update)", "Review workflow, round N" and the lead; search and sort; a branch `"><img src=x onerror=alert(1)>` inserted straight into the fake D1 renders as text. | component |
| AC-22 | `CostsPage.test.tsx` "Roles": all seven rows always, `—` for none, the two workflow rows marked "not split by role", "Other agents" only with runs, largest first, shares sum to 100% within rounding; `views.test.ts`: per-role totals and the per-feature average. | component + unit |
| AC-23 | `views.test.ts` "months": 12 UTC slots ending with the current month, empty as 0, billed, estimated and unknown apart; 23:30 UTC on 30 September is September; the last full month compared with the one before, the current month never. `Charts.test.tsx` and `CostsPage.test.tsx`: D-4. | unit + component |
| AC-24 | `CostsPage.test.tsx` "Waste": D-6. | component |
| AC-25 | `needs.test.ts` "budgets": under, equal and no budget -> nothing; over -> the line and the badge `n`; two over -> the plural line naming the most over; a 200-character branch cut at 40; loading or error -> nothing. `CostsPage.test.tsx`: D-7. | unit + component |
| AC-26 | `src/admin/format.test.ts`: D-2; `CostsPage.test.tsx`: an estimated figure's accessible name has "estimated", unknown `?$`, unpriced `+` and the warn badge naming the model and its tokens. | unit + component |
| AC-27 | `CostsPage.test.tsx`: loading, empty (exact copy including the cancelled-runs line; no table, tile or chart), error (banner and one card); `Admin.test.tsx`: `/api/costs` failing leaves the Overview and another page working and no Needs you line for costs. | component |
| AC-28 | (1) `functions/api/building/[project].test.ts`: `/api/building/site` deep-equals its answer without cost rows; (2) `src/articles/articles.test.tsx`: `feed.json`'s `numbers` keys are today's four, the header's `Stat`s unchanged; (3) build check in the PR evidence: `grep -rE "api/costs|dev_cost" dist` over HTML, MD, TXT, XML and the non-admin chunks finds nothing. | function + component + build check |
| AC-29 | `scripts/costs-safety.test.mjs` (the import walk of `team-safety.test.mjs`): none of the listed public entry points reaches `functions/_lib/costs/**`, `functions/api/costs*` or `src/admin/CostsPage.tsx`, and the table names appear in SQL only in those files and the migration; a positive control proves the walk finds a planted import; `functions/_lib/mcp/` has no costs tool. Preview: the recruiter asks the assistant R-2's question. | import-graph test + preview check |
| AC-30 | `costs-safety.test.mjs` for the source; the build size check against R-4's baseline in the PR evidence. | import-graph test + build check |
| AC-31 | `src/resume.test.ts`; `git diff --stat origin/main -- src/resume.ts src/pageMeta.ts public/steven-wilssens-resume-2026.pdf` empty; `npm run check:recruiter` >= 80; ATS 100. | gates |
| AC-32 | AC-13, AC-15, AC-28; `costs-safety.test.mjs`: no costs module imports the mail code. | function + import-graph test |
| AC-33 | `dev-costs-hook.test.mjs`: `.gitignore` has patterns matching `.dev-costs-queue.jsonl` and `.claude/settings.local.json` (read and matched in the test); `.claude/settings.json` holds no `env`; PM check of README for the three places and Production only. | script unit + PM check |
| AC-34 | `scripts/team-manifest.test.mjs` passes (every `%% step N` still resolves); `costs-workflows.test.mjs`: `.claude/team.md` names `/admin#costs` and its Mermaid block has the `meter` node with dotted links only. | script unit |
| AC-35 | `team-manifest.test.mjs` coverage and real-repository tests with `.claude/settings.json` and `.claude/hooks/dev-costs.mjs` listed; PM and designer open `/admin#team` on the preview and see the flow, Site update's team step and the Review workflow marked New. | script unit + preview check |
| AC-36 | `articles.test.tsx` "says the loop is metered": the sentence in "Put every change past a team.", no digit, no `$`, no "every"/"all", names per change, a budget, and the role only together with "in my sessions" (W-1); both drawings of `TeamFlowDiagram` hold the label "Metered: runs count against their change, and a change can have a budget" (per change and a budget, no "role") with no digit, the layer and footer inside the `viewBox`, the figure keeps `wx-diagram--fits`; `flowDescription` holds the sentence. (Steven said yes to Open question 1; if M-1 holds the sentence back, the test asserts `not.toMatch(/meter/i)` on both until the follow-up.) Screenshots at 320, 390 and 1440 (designer). | component + ui-check |
| AC-37 | PM check of `README.md`'s Costs section, point by point. | PM check |

### Designer's criteria to tests

| D | Test (file: what it asserts) | Kind |
|---|---|---|
| D-1 | `Admin.test.tsx`: Costs after Team with its sub line; `CostsPage.test.tsx`: `section.card` `data-part`s in the order This month, Features, Over time, Roles, Waste, and the chip bar lists them. | component |
| D-2 | `src/admin/format.test.ts` `formatCost`: billed `$3.20`; estimated `≈$3.20` with the `≈` `aria-hidden` and "estimated " read first; unknown `?$3.20` read "billing unknown"; a mixed sum takes the least certain mark; unpriced adds `+` read "plus unpriced runs"; `0` -> `—`; 4,000 micro-dollars -> `<$0.01`; `$9,999.99` grouped. | unit |
| D-3 | AC-21's tests, plus the lead in the detail only. | component |
| D-4 | `Charts.test.tsx`: `BarChart` with a second value draws two parts per bar from zero, the estimated part outlined, each bar a button with the `aria-label` "October so far: $12.00 billed, estimated $29.20, 5 features"; the readout compares the last full month, never the current one. `CostsPage.test.tsx`: one month of data -> no chart and "The chart starts with the second month."; empty months kept as slots; the month table has every month and its six columns. | component |
| D-5 | AC-22's test. | component |
| D-6 | `CostsPage.test.tsx` "Waste": the three stats with their shares, the reason badges ("2 fix rounds", "2 more reviews", "closed, not merged", "redone by #56"), the note's exact copy, the empty line. | component |
| D-7 | `CostsPage.test.tsx` "budget, by keyboard" (`user-event`, keyboard only): Tab to a row, Enter opens it, Tab to "Budget for dev-costs", type `$10,50`, Enter -> `POST /api/costs/budget` with 10.5, Save shows "Saving…" with `aria-disabled="true"` and keeps focus, then "Saved: $10.50 for dev-costs." in `role="status"`, and the row's Budget and Total cells, the Over budget tile, Needs you and the menu badge change **without another GET** (fetch calls counted); Escape puts back the saved value; `0`, `-1`, `abc`, `1000.01` -> the message, `aria-invalid="true"`, the message's `id` in `aria-describedby`, focus still in the field, no POST; Remove -> focus to the empty field and "Budget removed for dev-costs."; a failing POST -> "Could not save (…)", the typed amount kept, focus on Save; the open row stays open after its sort position changes. | component |
| D-8 | AC-25's tests and the badge's accessible name "Costs, 2 over budget". | unit + component |
| D-9 | AC-27's tests. | component |
| D-10 | `npm run check:site -- --token <local admin token>` on a local build with seeded costs: no horizontal scroll at 390, axe clean in Dark and Light. 320 and 44px targets: the designer's screenshots, plus a CSS test in `costs-safety.test.mjs` that `.budget-form input` and its buttons have `min-height: 44px`. | site-check + ui-check + CSS test |
| D-11 | AC-36's diagram assertions. | component |
| D-12 | `costs-safety.test.mjs`: the custom properties defined in `src/admin/admin.css` and `src/index.css` are the same set as on main (listed in the test), and the new rules are `.budget-form` and the estimated bar part; designer's review of the diff. | CSS test + review |

### Threat-model controls

| S | Where it is tested |
|---|---|
| S-1, S-3, S-14 | AC-1, AC-2 (`costs-workflows.test.mjs`), `actionlint` in CI |
| S-2 | AC-1 (the extraction script run on fixtures; only three numbers in `$GITHUB_OUTPUT`), AC-4 |
| S-4, S-5 | AC-5 |
| S-6 | AC-6, AC-7, AC-9 |
| S-7 | AC-10 (URL), AC-33, the README check (AC-37) |
| S-8 | AC-13, AC-14 |
| S-9 | AC-13, AC-15 |
| S-10 | AC-17, AC-21 (markup as text, links from number and SHA) |
| S-11, S-12 | AC-10 |
| S-13 | AC-29 |

### Coverage

`npm run test:coverage` stays at 90% or more for statements, branches, functions and lines overall and for every file on its own, including the new `.claude/hooks/dev-costs.mjs` once it is in `coverage.include` (the `costs` job's inline scripts are outside coverage and are executed by `costs-workflows.test.mjs`). Files expected to be new or changed and read in `coverage-summary.json` at review: `functions/_lib/costs/*`, `functions/api/costs.ts`, `functions/api/costs/budget.ts`, `src/admin/CostsPage.tsx`, `src/admin/needs.ts`, `src/admin/format.ts`, `src/admin/Charts.tsx`, `src/admin/Admin.tsx` / `pages.tsx`, `src/admin/Overview.tsx`, `src/articles/site/SiteArticle.tsx`, `src/articles/site/Diagrams.tsx`, `scripts/team-manifest.mjs`, `functions/_lib/prices.ts`, the hook. No new exclusion.

### Spec points the tests depend on

- **T-1 (major) AC-6's phase rule misplaces the developer twice.** The flow has a `senior-developer` before the build (it writes "Technical approach" in the spec, in parallel with security and the tester) and one in every review batch (code review in review mode). Read literally, "subagents before the first senior-developer build are spec; the first build is build" makes the approach run the build, and "each senior-developer run after review N is fix N" makes the code reviewer a fix. The rule has to work by batches, not roles alone, for example: a batch is the subagents the lead launched together (same lead message, or overlapping in time); the spec batches are the ones before the first batch that is a lone `senior-developer`; that lone batch is `build`; a batch of two or more reviewers after it is `review N`; a lone `senior-developer` after review N is `fix N`. The PM and the developer write the rule into AC-6; the fixture follows it.
- **T-2 (major) Local sessions have no billing rule.** AC-2 covers GitHub only. The hook needs one too: Steven's sessions on the subscription are `estimated`, a session with `ANTHROPIC_API_KEY` is `billed`, and the hook must say how it tells them apart or store `unknown`. Without the rule there is nothing for AC-20's marks to test on local runs.
- **T-3 (minor) The caps need numbers in the threat model** (body bytes, cost per run, tokens per kind, budget), so the boundary tests can assert cap and cap + 1.
- **T-4 (minor) Where the pull request states come from** (merged, closed, superseded, merge commit): GitHub at read time (then the GitHub-failure case in AC-13 applies) or posted by the workflows. The Technical approach should say.
- **T-5 (minor) AC-16 "across the selected range"** conflicts with the design's `range: false`; the plan tests all time, as the designer recommends. The PM rewords AC-16.
- **T-6 (minor) Which clock decides a run's month** (UTC, or Steven's time zone as the rest of the admin does with `tz`). The month-boundary test pins the answer.
- **T-7 (nit) Rounds are numbered at read time by start time**, so a late post never misnumbers a round (AC-3's test asserts it); the Technical approach should not store a round number at ingest.

## Open questions for Steven

1. **The write-up.** May "The loop" in `/building-this-site` and its diagram say, in one sentence and one label with no number, that the agents' runs are metered per change and per role and that a change can have a budget (AC-36)? Recommendation: yes; it answers "what do six agents on every change cost you?" and CLAUDE.md asks the write-up to follow every orchestration change. If no, nothing public changes and the spec records your exception.
2. **GitHub billing.** Both `ANTHROPIC_API_KEY` (set 2026-10-18) and `CLAUDE_CODE_OAUTH_TOKEN` (2026-10-17) are on the repository, and Claude Code uses the API key when both are present, so every Review and Site update run since 2026-10-18 has been billed to the API key, not your subscription. Keep it that way, or drop one secret? Recommendation: keep it as it is in this change (the runs show as billed), and decide after a month of figures. Do not delete the repository's `ANTHROPIC_API_KEY` to switch: `deploy.yml` and the résumé email step of `site-update.yml` use it. Switching to the subscription means the two Claude steps stop passing `anthropic_api_key` (a one-line change each, a follow-up); the `costs` job's billing rule follows what the Claude step is given (AC-2), so the figures turn estimated by themselves.
3. **Backfill.** Read your past local sessions of this repository once (`--backfill`), so the page starts with history? Recommendation: yes; only the numbers in AC-9 leave your machine, and a second run changes nothing.
4. **The ingest secret.** Set `COSTS_INGEST_TOKEN` (a new random value of 32+ characters, not the admin token) as a Production-only Pages secret, a repository secret and a user environment variable on your machine, before the merge? Recommendation: yes, before the merge, so the write-up's sentence is true on the day it ships; until it is set nothing is recorded and nothing fails.
5. **Default budget.** None for features you have not given one? Recommendation: none; Needs you then means you set a limit and it was passed.

**Steven's answers (2026-10-19):** 1. Yes, one sentence and one label, no numbers. 2. Keep the API key for now; GitHub runs show as billed. 3. Yes, backfill. 4. Yes, set `COSTS_INGEST_TOKEN` before the merge (the lead generates the value and sets the repository and Pages secrets with Steven's OK; Steven sets the user environment variable). 5. No default budget. All five are folded into the acceptance criteria (Reconciliation, round 3); no open question is left.

## Reconciliation (product manager, round 2)

How the team's input was folded in. Where two sections disagreed, the security control won over a weaker criterion, and the spec now says one thing.

| Point | Decided | Where |
|---|---|---|
| Designer minors | AC-22 is all time (`range: false`); AC-21 shows billed and estimated in the Total cell's second line and the opened row; AC-25's budget field is in the opened row; the write-up and diagram say "a change can have a budget", not "a monthly budget" | AC-21, AC-22, AC-25, AC-36 |
| T-1 + F-1 phases | Assigned per feature across all its local sessions, by batch in `batchAt` order; a lone `senior-developer` after the spec is build, a team batch of four or more roles is a review, a lone developer after review N is fix N; a smaller batch after a fix is the next review round | AC-18 |
| Local key (F-1) | session, branch, batch, role, model | AC-12 |
| T-2 local billing | `estimated` without `ANTHROPIC_API_KEY` in the hook's environment, `unknown` with it; never `billed` | AC-8 |
| T-3 caps | 16 KB read, 64 rows a body (a big session is sent in several bodies), integer caps per field, $1,000 a run, budgets 0 < x <= $1,000 and at most 500, 5,000 rows a UTC day | AC-14, AC-15 |
| T-4 pull request state | From GitHub at read time via `functions/_lib/github.ts`, never from a payload | AC-17 |
| T-5 | AC-22 all time | AC-22 |
| T-6 month clock | UTC (as `monthName` and the assistant's spend; `profile.location` is Seattle, not Belgium) | Terms, AC-23 |
| T-7 rounds | Computed at read time; no round or phase stored | AC-3, AC-12, AC-18 |
| S-1 vs the developer's "later step in the same job" | Security wins: a separate `costs` job with `permissions: {}`, no checkout; only three numbers cross as job outputs; the execution file is never uploaded. The branch crosses too: Review takes it from the `github` context, Site update from its `branch` step, which runs before Claude, checked again in the `costs` job (the security reviewer confirms this in the review) | AC-1, AC-4 |
| S-2 vs the developer's per-model tokens from GitHub | Security wins: no model ids or token counts from the execution file; a GitHub run is one row with its reported cost | AC-4, Out of scope |
| Tester's `scripts/cost-report.mjs` vs S-1 (no checkout) | The `costs` job's scripts are inline; the test executes them from the YAML with `bash` and `jq` on fixtures, and fails in CI if either is missing | AC-1, test plan |
| S-4 hook path | `.claude/hooks/dev-costs.mjs` (not `scripts/`), guard in the command, `settings.json` holds only the hook | AC-5 |
| S-7 URL override | Only `localhost` / `127.0.0.1` | AC-10 |
| S-8 vs the developer's 500 rows / 64 KB and its role/model patterns | Security's 16 KB and 64 rows; role lower-cased to the security pattern; model pattern takes a fixed `:fast` suffix | AC-9, AC-14 |
| Replace semantics | Upsert per row (the developer's delete-then-insert does not work across several bodies; a resumed session only adds to its transcript, so no row needs deleting) | AC-12 |
| S-8 503 / `*.pages.dev` / Production only | In | AC-13, AC-33 |
| `.claude/settings.local.json` | Into `.gitignore` | AC-33 |
| F-2 | The hook sends tokens; the server prices at read time from `functions/_lib/prices.ts` | AC-6, AC-16 |
| F-3 waste per place | Local rounds after the first; Review workflow rounds after the first on that pull request | AC-19 |
| F-4 cancelled runs | Not recorded; page note and README say so; the write-up avoids "every" | AC-4, AC-27, AC-36, AC-37 |
| F-5 | Open question 2 rewritten | Open questions |
| Built-in agents | `explore`, `general-purpose`, `unknown-agent` count under "Other agents" on Roles and take their batch's phase | AC-18, AC-22 |

Round 3 (Steven's answers and the spec sign-offs, 2026-10-19):

| Point | Decided | Where |
|---|---|---|
| Open question 1 (yes) | The sentence and the label are in, no longer conditional | AC-36 |
| Open question 2 (keep the API key) | GitHub runs keep both credentials and are recorded as billed; moving to the subscription is a follow-up | AC-2, AC-37, Out of scope |
| Open question 3 (yes) | `--backfill` is in scope, with the S-6 path rule on `--dir`, a counts-only summary line, and the daily cap leaving the rest queued | AC-11, AC-37, Out of scope |
| Open question 4 (yes) | The secret is set in all three places before the merge, the value never printed; the checklist records it | AC-33, AC-36 |
| Open question 5 | No default budget (already out of scope) | Out of scope |
| Recruiter W-1 | GitHub runs are not split by role: the role clause names only Steven's sessions; the label drops the role; the Design section's label and phone break follow (41 and 30 characters) | AC-36, Design, Test plan |
| Recruiter M-1, M-2 | The sentence and label ship only with the secrets set and the hook's Git Bash run recorded, else they wait and the admin ships; the assistant on the preview says the build cost is not published | AC-36, AC-29 |
| "Every run metered" in the Technical approach | AC-34's "Runs metered" wins; the `team.md` sentence avoids "every" | AC-34, Technical approach |
| Security S-15 | Run id, attempt, workflow, job from the `costs` job's `github` context; Site update's branch a job output checked with the S-8 rule and `update/`; its pull request number advisory; the server builds `run_key` | AC-4, AC-12 |
| Security S-16 | `ON CONFLICT ... DO UPDATE SET = excluded.*` guarded by `ended_at`; one body one `DB.batch`; the daily cap refuses a whole body | AC-12, AC-14 |
| Security S-17 | A message without a branch takes the last branch before it, else the first after it, else "No feature" | AC-7 |
| S-8's `phase` pattern | No body carries a phase (AC-12, AC-14's exact shape refuses the key); the pattern in S-8 is not built | AC-14 |

Draft AC numbers used in the Recruiter, Design, Threat model and Technical approach sections map to the reconciled ones as follows: 1→1, 4; 2→2; 3→3; 4→6; 5→7; 6→18; 7→16; 8→9; 9→10; 10→12; 11→13; 12→14; 13→15; 14→20; 15→21; 16→22; 17→23; 18→19, 24; 19→25; 20→26; 21→27; 22→28; 23→29; 24→30; 25→31; 26→32; 27→34; 28→35; 29→36; 30→33, 37.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE (round 3, 2026-10-19) | | Steven's answers folded in; W-1, M-1, M-2, S-15 to S-17 in the ACs |
| Senior recruiter | APPROVE (round 2), with W-1 | | W-1 in AC-36; M-1 and M-2 are merge conditions (AC-36, AC-29) |
| Senior designer | APPROVE (round 2) | | Label and phone break updated to W-1 by the PM |
| Senior developer | (feasibility) | | F-1 to F-5 folded in (round 2) |
| Security engineer | APPROVE (round 2), with S-15 to S-17 | | Folded into AC-4, AC-7, AC-12, AC-14 |
| Senior tester | (test plan) | | |
