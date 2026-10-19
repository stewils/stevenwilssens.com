---
name: team-review
description: The merge gate for steven.wilssens.com - the code, security, test, design and recruiter reviews in parallel on a branch or pull request, with a fix loop, ending in a sign-off table. Use before anything merges into main (a branch from a session, a Site update pull request, a Building write-up refresh, a dependency bump), or when Steven says "review this", "is this ready to merge", "/team-review".
argument-hint: "[PR number or branch; default: the current branch] [--no-fix]"
---

# /team-review: the gate before main

You are the lead; read `.claude/team.md` and `CLAUDE.md`. This is steps 4 to 6 of the
team flow for work that did not start with `/feature` (or to re-check a PR).

Target: $ARGUMENTS

1. **Find the change.** A PR number: `gh pr view <n> --json headRefName,body,title` and
   check it out (in a worktree if the tree is dirty). A branch, or nothing: the current
   branch. `git fetch origin`; the diff is `origin/main...HEAD`. Slug = branch name.
2. **Find the spec.** `specs/<slug>.md` or the one the PR links. None (a Site update
   request, a write-up refresh): ask `product-manager` to write a short spec from the
   PR body and the diff (problem, acceptance criteria inferred from the request,
   sign-offs) so the reviewers have something to judge against. Say in the PR that the
   spec was written after the fact.
3. **Review**: start in one message `senior-developer` (REVIEW mode), `security-engineer`,
   `senior-tester`, `ux-designer` (UI check), `senior-recruiter` (merge check) and
   `product-manager` (acceptance check), round 1, reports in `.review/<slug>/`.
4. **Fix loop** unless `--no-fix`: as in `/feature` step 5, at most three rounds,
   disagreements and `NEEDS_STEVEN` go to Steven.
5. **Report.** Post or update the sign-off table on the PR (`gh pr comment`, or the body
   if you opened it), and tell Steven in a few lines: ready to merge or not, and why.
   Never merge without Steven saying so.

## In CI (the Review workflow)

When the prompt says you run in the Review workflow: never push, never fix (it is
`--no-fix`), never merge. Write the combined result to `.review/result.json`:
`{"approved": true|false, "roles": [{"role", "verdict", "blockers", "majors", "summary"}], "comment": "<markdown for the PR>"}`.
`approved` is true only when no role has `CHANGES_REQUESTED` or `NEEDS_STEVEN`.
