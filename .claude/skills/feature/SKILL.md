---
name: feature
description: Run Steven's product team on an ask for steven.wilssens.com - spec with the product manager, recruiter and designer; build by the senior developer; parallel review by code, security, test, design and recruiter; fix loop; pull request with sign-offs. Use when Steven asks for a feature, a change to the site or the admin, or says "kick off", "/feature", "have the team do".
argument-hint: <the ask, in Steven's words>
---

# /feature: the team builds an ask

You are the lead. You run the flow in `.claude/team.md`; read it now, and `CLAUDE.md`.
You coordinate, you do not do the roles' work, and you never override a reviewer. Keep
Steven's context small: he sees the questions, the spec summary, and the PR.

The ask: $ARGUMENTS

## 0. Intake

- `git fetch origin && git log --oneline -5 origin/main`: main moves while you work.
- If the working tree has changes that are not yours, work in a worktree:
  `git worktree add -b <slug> ../stevenwilssens-<slug> origin/main`. Otherwise
  `git switch -c <slug> origin/main`.
- Pick a short kebab-case slug. Classify the ask: surfaces touched (public pages, admin,
  `src/resume.ts`, Pages Functions, assistant, MCP, workflows) and size (trivial / normal).
  Trivial = one fact, a typo, a dependency bump: short spec, same reviews.
- `mkdir -p .review/<slug>`.

## 1. Spec (parallel, then reconcile)

Start these three in one message, in parallel:
- `product-manager`: "Write specs/<slug>.md for: <ask>. Surfaces: <…>. Fill Problem,
  Outcome, Acceptance criteria, Out of scope, Open questions."
- `senior-recruiter`: "Write the Recruiter impact section of specs/<slug>.md for: <ask>,
  with today's baseline scores. The PM is writing the rest in parallel; edit only your
  section (create the file from specs/TEMPLATE.md if it is not there yet)."
- `ux-designer`: same, for the Design section (or NOT_APPLICABLE with the reason when
  nothing renders).

Then, in parallel: `security-engineer` (Threat model), `senior-tester` (Test plan),
`senior-developer` in BUILD mode, *feasibility only, no code* (Technical approach).
Each also returns a verdict on the spec so far.

Then `product-manager`: "Reconcile specs/<slug>.md: resolve contradictions, make every
acceptance criterion testable and mapped in the test plan, collect open questions."
Repeat once if the PM, recruiter or designer still asks for changes.

## 2. Steven

Show Steven: the spec's Outcome and acceptance criteria in a few lines, and the open
questions together (AskUserQuestion when they have clear options; plain questions when
they need facts). Record his answers in the spec. Facts about Steven he gives you also
belong in the dossier: suggest `save_entry` if the MCP is connected. If he changes the
scope, send the spec back to the PM. Spec status → approved once the PM, recruiter and
designer approve and the questions are answered.

## 3. Build

`senior-developer`, BUILD mode: "Implement specs/<slug>.md on branch <slug> in <path>.
Commit when lint, test:coverage and build pass." Read its summary; if it stopped on a
spec problem, go back to step 1 for that point only.

## 4. Review (parallel, fresh instances)

Start all of these in one message:
- `senior-developer`, REVIEW mode, round N
- `security-engineer`, round N
- `senior-tester`, round N
- `ux-designer`, UI check, round N
- `senior-recruiter`, merge check, round N
- `product-manager`, acceptance check, round N

Each gets: the slug, the branch/worktree path, the round, and "write your report to
.review/<slug>/<role>-r<N>.md and return the verdict block". Parse the verdict blocks.
An `APPROVE` with blocker or major findings counts as `CHANGES_REQUESTED`; a sign-off
without evidence goes back to that reviewer once.

## 5. Fix loop (at most 3 rounds)

If anyone asked for changes: `senior-developer` BUILD mode, "fix round N: read
.review/<slug>/*-r<N>.md, fix every blocker and major, fix or answer every minor, add a
Response section to each report, commit." Then re-run only the reviewers who asked for
changes, plus `senior-tester` (code changed), as round N+1.

Two reviewers who contradict each other, or a finding the developer disputes twice:
stop and put both positions to Steven in a few sentences, with your recommendation.
`NEEDS_STEVEN` from any reviewer: same. After round 3 with open blockers: stop, report.

## 6. Pull request

When every role approves (or is `NOT_APPLICABLE` with a reason):
- Fill the spec's Sign-offs table (verdict, round, one-line note) and set status built;
  commit it on the branch with the code.
- `git push -u origin <slug>`; `gh pr create --base main` with a body that has: what
  changes for the reader (two or three sentences), a link to the spec, the sign-off
  table, the evidence (coverage numbers, recruiter score vs main, ATS score vs main,
  screenshots looked at), minors deferred with reasons, and the preview
  `https://<slug>.stevenwilssens.pages.dev`. End with the attribution line.
- The Review workflow re-runs the gates on GitHub. Tell Steven the PR link, the preview,
  and that it merges when CI is green and he says so.

## 7. Merge (only when Steven says so)

`gh pr checks <n>` all green, every sign-off APPROVE, then
`gh pr merge <n> --merge --subject "Merge <slug>: <what changed for the reader>"`.
Spec status → merged in a follow-up only if Steven asks; the PR is the record.
Remove the worktree if you made one.
