# Test run of the Site update workflow from a branch: one sentence in README.md

Slug: `test-run-site-update-team-from-a-branch-28` · Branch: `update/test-run-site-update-team-from-a-branch-28` · Status: built
Asked by Steven on 19 October 2026: "This is a test of the Site update workflow; its pull request will be closed without merging. Append the sentence 'Tested from a branch on 19 October 2026.' to the end of the first paragraph of README.md. Change nothing else."

## Problem

Steven (the only reader here) wants to see the Site update workflow run the team end to
end when started from a branch: spec, build, reviews, pull request. He needs a change
small enough that its outcome is unambiguous and harmless. No visitor, recruiter or
peer is affected: README.md is not rendered on the site, and the pull request is closed
without merging, so nothing deploys.

## Outcome

The workflow produces a pull request whose only change is one appended sentence in
README.md, so Steven can judge the workflow by its handoffs, not by the content.

## Acceptance criteria

- AC-1: In README.md, line 3 (the paragraph starting "Personal resume site for Steven
  Wilssens:") ends with `Cloudflare D1. Tested from a branch on 19 October 2026.` — the
  new sentence follows the existing final period after a single space, on the same line.
- AC-2: The paragraph stays one line; no line is added, removed or reflowed in README.md
  (`git diff -U0 origin/main...HEAD -- README.md` shows one hunk, `@@ -3 +3 @@`, with
  exactly one removed and one added line; the file keeps LF line endings and its
  trailing newline).
- AC-3: Apart from README.md and this spec (plus the reviewers' `.review/` reports if
  the flow writes them), `git diff --name-only origin/main...HEAD` lists no other file:
  no change to `src/`, `functions/`, `public/`, `.claude/`, workflows or scripts.
- AC-4: `npm run lint`, `npm run test:coverage` (which runs the whole `npm test` suite
  and the 90% thresholds) and `npm run build` pass on the branch as on main. README.md
  is named in `scripts/building-brief.test.mjs` and `scripts/team-manifest.test.mjs`
  only as a fixture; neither fails on the new sentence.
- AC-5: The recruiter bar holds trivially: after the lead's build (`dist/` present),
  `npm run check:recruiter` scores the same as main (80/100 at the baseline below) with
  no new high or medium finding, and `node scripts/resume-check.mjs` gives the same ATS
  score as main (100/100), because no page, `src/resume.ts` or PDF changed.
- AC-6: The merge verdicts are consistent with a README-only change: the recruiter, the
  tester, the security engineer, the code reviewer and the PM each return `APPROVE` with
  the evidence of the commands above (the recruiter and the tester never use
  `NOT_APPLICABLE`, `.claude/team.md`); the designer returns `NOT_APPLICABLE` with the
  one sentence "no rendered file changed" when AC-3 holds. If AC-3 fails, every
  reviewer returns `CHANGES_REQUESTED` on the extra files.

## Out of scope

- Any other edit to README.md (wording, links, layout) or any other file.
- Merging: the pull request is closed without merging, so no deploy, no Team page update
  and no `building-notify.yml` refresh of `/building-this-site` (README.md is one of its
  sources, but that only triggers on a push to main).
- Updating `/building-this-site` or the Mermaid chart in `.claude/team.md`: the
  orchestration does not change.

## Recruiter impact (senior-recruiter)

Nothing changes for a recruiter, in the first ten seconds or on a close read. The site
does not serve README.md. Its text is not in any page, `dist/*.md`, the résumé PDF,
`resume-report.json` or the assistant's context. The pull request is closed without
merging, so nothing deploys.

- First screen at 390px (who Steven is, the role, location and authorization, contact,
  résumé link): unchanged. No page, `src/resume.ts`, `src/pageMeta.ts` or `public/` file
  changes.
- Recruiter paths (résumé PDF, contact, LinkedIn, experience, Ask about Steven, job
  description check), search and link previews, page weight: unchanged for the same
  reason.
- No claim or number is added. The new sentence is a test note in a developer file that
  no recruiter sees.
- The only risk to the bar is scope creep. If the diff touches anything beyond
  README.md, this spec and `.review/` (AC-3), the change goes back.

Baseline on main (20 October 2026, before the build):

- Résumé, `node scripts/resume-check.mjs`: ATS score 100/100, 2 pages, 0 errors,
  0 warnings. One open question for Steven, known and unrelated to this change: cosmos
  (Jan 2004 to Dec 2005) overlaps Info Support (Jan 2001 to Dec 2004).
- Recruiter check, `npm run check:recruiter`: main's data on the live pages scores
  80/100. The local run scored 50/100 only because this worktree had no `dist/` yet. Its
  six new medium findings all say a page or the résumé report is "not in this
  deployment". At merge review, after the lead's build, the score must equal main's
  80/100 with no new high or medium finding (AC-5).

Questions a recruiter would put to Steven: none come from this change.

At merge review I run both checks and confirm the file list in AC-3. My verdict there is
not `NOT_APPLICABLE`: I approve with the evidence that the checks did not move.

Verdict: APPROVE.

## Design (ux-designer)

Nothing renders differently, so there is no UI to design.

- Evidence: README.md is not an input to the site build. Of `src/`, `functions/`,
  `public/`, `index.html`, `admin.html` and `vite.config.ts`, only
  `src/articles/sources.json` mentions it, as a path the Site update workflow reads when
  it refreshes `/building-this-site`; its content is never imported or prerendered. The
  other references are two tests that use the name as a fixture and the path filter of
  `building-notify.yml`, which fires only on a push to main (this pull request is closed
  without merging).
- Flow, states (empty, loading, error, very long content, no JavaScript), layout at 1440
  and 390 in light and dark, the three admin themes, copy, keyboard path, focus,
  contrast and reduced motion: unchanged on every page and admin part.
- Flow diagram: none; the orchestration does not change, so the chart in
  `.claude/team.md` and `/building-this-site` stay as they are.
- Pages to screenshot: none. At the UI check, if `git diff --name-only origin/main...HEAD`
  lists only README.md, this spec and `.review/` reports, the merge verdict is
  `NOT_APPLICABLE`. If any file under `src/`, `public/`, `index.html` or `admin.html`
  appears in that list, the change went beyond the ask and goes back.

Verdict: APPROVE (no rendered change).

## Threat model (security-engineer)

No new entry point, data, route, tool, dependency, secret or permission. One sentence of
static text in a developer file.

- Where README.md goes: not into any page, Function, the assistant's context or the MCP
  server. It is a source of `/building-this-site` (`src/articles/sources.json`), so its
  text reaches Claude Code's prompt in the Site update workflow, but only after a push to
  main (`building-notify.yml`); this pull request is closed unmerged. The sentence is
  Steven's own fixed text, with no instructions, `${{ }}`, shell or Markdown/HTML that
  could act as prompt or script injection.
- Abuse case that matters: scope creep. A run that, beyond the ask, touches
  `.github/workflows/`, `.claude/`, `CLAUDE.md`, `functions/` or adds a secret is a
  blocker regardless of intent. Control: AC-3 (the file list) plus AC-2 (one changed
  line); at merge review I also grep the diff for tokens and keys.
- Required tests: none beyond AC-2 and AC-3 in the test plan.

Verdict: APPROVE.

## Technical approach (senior-developer)

Feasible exactly as written. One targeted edit, no code, no test, no dependency.

- **Change:** in README.md line 3, replace the trailing `stored in Cloudflare D1.` with
  `stored in Cloudflare D1. Tested from a branch on 19 October 2026.` (one space, same
  line, no reflow). The file keeps its trailing newline; no other line moves (AC-1, AC-2).
- **What reads README.md, and why none of it breaks:**
  - `scripts/building-brief.test.mjs:25` only asserts the *string* `'CLAUDE.md README.md docs'`,
    the source list from `src/articles/sources.json`; it never opens the file.
  - `scripts/team-manifest.test.mjs:127,180,464` write their own `README.md` into
    throwaway git fixtures as an unrelated file; they never read the real one. The
    real-repository test (`coverageGaps` over `git ls-files`, line 793) only flags files
    matching `AUDITED` (`.claude/**` and the gate scripts); README.md is neither in
    `ORCHESTRATION` nor needs to be in `IGNORED`, so the manifest and the Team page are
    unaffected.
  - `src/articles/sources.json` names README.md as a source of `/building-this-site`;
    the Site update workflow copies it into `sources/` only on a Building refresh, never
    at build time. Nothing in `src/`, `functions/`, `vite.config.ts` or the prerender
    imports it, so `dist/` is byte-identical to main's.
  - `.github/workflows/building-notify.yml:12` has README.md in its path filter, but it
    fires on a push to main only; this pull request is closed unmerged (and even on a
    merge, a refresh would be the expected, harmless outcome).
- **Checks before hand-over:** `npm run lint`, `npm run test:coverage`, `npm run build`.
  No `resume:build` (no `src/resume.ts` change), no `og-image` (headline and photo
  unchanged). Coverage is unaffected: no source file changes.
- **Risks:** only scope creep (an editor reflowing the paragraph or adding a line); the
  builder verifies with `git diff origin/main -- README.md` (one `-`, one `+`) and
  `git diff --name-only origin/main...HEAD` (AC-3).

Verdict: APPROVE (feasible as written).

## Test plan (senior-tester)

No production code, test, script or config changes, so no new unit test is written:
there is no behaviour to assert beyond the text of one line, and a test that pins a
README sentence would be a test of the fixture, not of the site. Each criterion is
verified by a named command at merge review instead; each fails visibly if the
criterion breaks.

| AC | Test (file, name) or check | Passes when | Kind |
|---|---|---|---|
| AC-1 | `sed -n 3p README.md \| grep -c 'Cloudflare D1\. Tested from a branch on 19 October 2026\.$'` | prints `1` (the sentence ends line 3, after the existing period and one space) | manual check |
| AC-2 | `git diff --numstat origin/main...HEAD -- README.md` and `git diff -U0 origin/main...HEAD -- README.md` | numstat is 1 added, 1 removed for `README.md`; the only hunk is `@@ -3 +3 @@` | manual check |
| AC-3 | `git diff --name-only origin/main...HEAD \| grep -v -e '^README\.md$' -e '^specs/test-run-site-update-team-from-a-branch-28\.md$' -e '^\.review/'` | prints nothing (exit 1 from grep) | manual check |
| AC-4 | `npm run lint`, `npm run test:coverage` (runs `npm test`'s suite), `npm run build`; in `npm test`, `scripts/building-brief.test.mjs` and `scripts/team-manifest.test.mjs` | all exit 0. Both scripts use `README.md` only as a fixture name or fixture content (`'# Site\n'`), never the real file's text, so the new sentence cannot move them; `team-manifest.test.mjs`'s read of the real repository passes because README.md is not an orchestration file | unit / build |
| AC-5 | `npm run check:recruiter` (after the lead's build, `dist/` present) and `node scripts/resume-check.mjs` | recruiter score equals main's 80/100 with no new high or medium finding; résumé ATS score 100/100, unchanged; `src/resume.test.ts` (in `npm test`) still passes, so the PDF matches `src/resume.ts` | recruiter-check |
| AC-6 | the verdict blocks in `.review/test-run-site-update-team-from-a-branch-28/*-r<n>.md` | five `APPROVE` (code, security, tester, recruiter, PM) and the designer's `NOT_APPLICABLE` with its one sentence, each with an EVIDENCE line naming the command it ran | manual check (PM) |

Coverage: `npm run test:coverage` is unaffected. README.md is outside the coverage
`include` in `vitest.config.ts` (`src/`, `functions/` and four scripts), no covered file
changes, and `vitest.config.ts` itself is untouched, so no exclusion is added. At merge
review I run it with `--coverage.reportsDirectory=.review/<slug>/cov-tester` and confirm
the overall and per-file thresholds pass as on main; there is no changed file to read
per-file numbers for.

Gate scripts: none changed (`scripts/*-check.mjs`, `recruiter-compare.mjs`,
`resume-gate.mjs` untouched), so no `scripts/*.test.mjs` is owed.

Threat-model controls: none introduced by this change; no refusal path to test.

Edge cases checked at merge review:

- The sentence lands in a new paragraph or a new line (fails AC-1 and AC-2).
- Trailing whitespace, a double space or a missing final period (the AC-1 regex is
  anchored to `D1\. Tested … 2026\.$`).
- Line endings: the file keeps LF; `git diff` showing the whole file changed would mean
  a CRLF rewrite (fails AC-2's numstat).
- Scope creep: a stray `dist/`, lockfile, PDF or `og-image.png` regeneration in the
  diff (fails AC-3).
- The date is Steven's verbatim "19 October 2026", not the run date.

Verdict: APPROVE.

## Open questions for Steven

None that block the build. Steven is not available, so nothing waits for him: the build
proceeds on each recommendation below, and he can overrule either by replying on the
pull request.

1. Should the sentence go on the same line as the paragraph or on a new line within it?
   Recommendation: the same line, after one space, so the paragraph stays one line and
   the diff is a single changed line (AC-1, AC-2).
2. The ask is dated "19 October 2026" while the run happens on 20 October 2026; keep the
   date as written? Recommendation: yes, use Steven's text verbatim.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE | | README-only test change |
| Senior recruiter | APPROVE | | |
| Senior designer | APPROVE | | |
| Senior developer | APPROVE | | |
| Security engineer | APPROVE | | |
| Senior tester | APPROVE | | |
