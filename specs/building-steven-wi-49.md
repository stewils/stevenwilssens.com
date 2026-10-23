# Building this site: the loop says the conversation merges exactly the version I previewed

Slug: `building-steven-wi-49` · Branch: `update/building-steven-wi-49` · Status: built
Asked by Steven (Site update workflow, Building refresh): "Refresh the Building write-up about steven.wilssens.com (/building-this-site, src/articles/site/SiteArticle.tsx) after a check-in on stewils/stevenwilssens.com: 'Merge mcp-plain-english: your MCP talks to you in plain English about site updates'."

## Problem

Peers and hiring managers read section 06 of `/building-this-site` ("The loop") to judge
how much control Steven keeps over an AI that edits his site. The check-in `b4982f2`
(merged 22 October 2026, spec `specs/mcp-plain-english.md`) changed, among the
source-of-truth files, only the `## The MCP server` paragraph of `CLAUDE.md`
(`git diff 4db9d97 b4982f2 -- CLAUDE.md`): the site-update tools now talk to Steven in
plain English (each update has a human name, no pull requests, runs or branches in the
answers), and merging from the conversation takes the version Steven previewed and
merges that one or nothing, refusing an update whose checks are still running or failed.

The write-up's bullet "Put every change past a team" (`SiteArticle.tsx`, section 06)
says only "I read the preview and merge, from the same conversation if I like." That is
still true, but it leaves out the guarantee a sceptical reader would ask about: can the
conversation merge something other than what he looked at? That is a decision about
control, the theme of the section, so it is worth one clause. The rest is not: the
human names and the plain-English answers are what the email in bullet 4 already
promises ("in plain words"), and the one automatic redo of a conflict is too much
detail for this section.

Nothing else disagrees. The check-in touched no file under `.claude/`, no workflow and
not the `## The team` section of `CLAUDE.md`, so this is not an orchestration change: the
Mermaid chart in `.claude/team.md`, the Team page and the diagrams stay. `LoopDiagram`
("I merge the pull request / after the preview") and `TeamFlowDiagram` ("I merge / after
the preview"; "I answer the questions and decide the merge") in
`src/articles/site/Diagrams.tsx` agree with the check-in. The header comment already says
23 October 2026 and the closing section's date comes from `feed.json` `asOf`
(2026-10-23). `sources/` was not provided to this run; the check-in was read from git.

## Outcome

A reader of "The loop" learns, in one sentence, that Steven's private MCP merges exactly
the version he previewed or nothing, never while the checks are still running, and after
a failed check only when he explicitly says yes. It is clear that the private MCP, not
the public read-only `/mcp` of section 05, is what merges.

Final wording (reconciled; a new sentence inserted directly after "I read the preview and
merge, from the same conversation if I like." and before "Changes to the agent team
itself…", which both stay exactly as they are):

> My private MCP merges exactly the version I previewed, or nothing; never while the
> checks are still running, and after a failed check only with my explicit yes.

28 words, no full stop inside, no digits. Why this form (resolving the sections below):

- Failed checks: `merge_site_update` merges after failed checks when Steven explicitly
  accepts them (`acceptFailingChecks`, `functions/_lib/mcp/tools.ts` l.1258), so the
  draft's "never one whose checks … failed" (and the designer's "never while … have
  failed") was false. Running checks have no override (l.1257); "the version I previewed,
  or nothing" holds (l.1247-1249, l.1273). This settles security rule 1 and the
  developer's risk 1.
- A new sentence, not an extended one: `src/articles/articles.test.tsx:165` expects
  "I read the preview and merge, from the same conversation if I like." with its full
  stop, and lines 235 and 268 split the bullet on full stops. The line 165 test is left
  unchanged (this supersedes the test plan's note about dropping its `.`).
- Subject "My private MCP": the recruiter's risk 3 and security rule 4. "MCP" is allowed
  only as "private MCP" (AC-4).
- "with my explicit yes" in place of the developer's "if I still say yes": "say" is a
  field name the AC-4 test bans as a word.
- The plain-English naming is dropped: with it the sentence goes over the 30-word cap
  (the recruiter's fallback; the bullet-4 email already promises "plain words").

## Acceptance criteria

- AC-1: `git diff main -- src/` changes only `src/articles/site/SiteArticle.tsx` (in it
  only the `<li>` that starts "Put every change past a team", section 06) and
  `src/articles/articles.test.tsx` (the one new test of AC-5a, nothing else). No other
  file under `src/`, `.claude/`, `.github/`, `scripts/` or `public/` changes;
  `src/resume.ts`, `Diagrams.tsx`, `feed.json`, the header comment and the closing
  section are unchanged.
- AC-2: In that bullet, exactly one new sentence is inserted directly after "I read the
  preview and merge, from the same conversation if I like." (kept verbatim, full stop
  included) and before "Changes to the agent team itself…". The new sentence is the
  Final wording in *Outcome*: "My private MCP merges exactly the version I previewed, or
  nothing; never while the checks are still running, and after a failed check only with
  my explicit yes." It contains no full stop other than its last character. It does not
  name updates in plain words and does not mention the automatic redo of a conflict.
- AC-3: Every other sentence of the bullet is unchanged, verbatim and in the same order
  (the existing line 165, "metered" and "unread updates" tests pass unmodified).
- AC-4: The new sentence names the private MCP as its subject and contains no digits, no
  URL, no tool, argument or field names (`merge_site_update`, `updateName`, `say`,
  `acceptFailingChecks`, `acceptLowerScore`, `confirm`, `recheck`), and none of "sha",
  "commit", "head", "MCP tool", "check run", "branch", "redo", "conflict", "/mcp/",
  "gates", "ADMIN_TOKEN", "token", "key", "pull request". "MCP" appears only in "private
  MCP". About failed checks it uses none of "never", "cannot", "safely", "guaranteed",
  and it claims nothing about GitHub enforcing the checks.
- AC-5: The bullet grows by at most 30 words (measured on its text content, main against
  the branch); the Final wording adds 28.
- AC-5a: A new test in `src/articles/articles.test.tsx` ("the team diagram on
  /building-this-site") isolates the sentence after "from the same conversation if I
  like." (asserting the match is not null) and asserts AC-2's content (private MCP,
  "exactly the version I previewed", "or nothing", "still running", "failed check only
  with my explicit yes"), AC-4's banned terms and digits, and AC-5's word cap against
  main's count hard-coded with a comment. Its name does not say "never … after they
  failed" (e.g. "says the private MCP merges exactly the version I previewed or nothing,
  not while checks run, and after a failed check only with my yes").
- AC-6: `npm run lint`, `npm run test:coverage` (90% or more) and `npm run build` pass;
  the built `/building-this-site` page contains the new sentence.
- AC-7: `npm run check:recruiter` and the résumé ATS score are not lower than main's.

## Out of scope

- Describing the human update names, the plain-English answers or the automatic redo of
  a conflict in more detail.
- Any change to the diagrams, the Team page, `.claude/team.md` or "The loop" beyond the
  one sentence.
- Other sections and other Building write-ups.

## Recruiter impact (senior-recruiter)

- **First ten seconds:** nothing changes. Home, résumé, contact, experience, the assistant and the job description check are untouched; the edit is one clause in section 06 of `/building-this-site`, read by hiring managers and engineering or product leads checking whether Steven builds AI systems with real controls.
- **Close read:** "I read the preview and merge" invites the question "merge what?". The new wording answers it: the merge is tied to the exact version Steven previewed and is refused while checks run or after they failed. That supports the callout "a person decides before anything ships"; credibility, not self-promotion, as long as it stays plain.
- **Risks to the bar:**
  1. Internal terms: none of `merge_site_update`, sha, commit, head commit, check runs, `updateName`, `update/` branch, or the conflict redo may reach the page. Use "the version I previewed" and "its checks are still running or have failed".
  2. Length: the bullet is already the longest in the section; add 30 words at most, no new paragraph. If it reads as a wall at 390px, drop the "plain English" half, not the "exact version" half.
  3. Which MCP: the article has a public read-only MCP (section 05) and the private one (section 06). The new text must make clear it is the *private* MCP that merges, or a reader may think the public server can change the site.
  4. Sourcing: no numbers, no "safely"/"never fails"; the behaviour is documented in CLAUDE.md and implemented in `functions/_lib/mcp/plain.ts` and `tools.ts`.
  5. No diagram change: Steven still decides the merge; the TeamFlowDiagram caption stays true.
- **Baseline:** `node scripts/resume-check.mjs` ATS = **100/100** (2 pages, 0 errors, 0 warnings; one standing question on the Cosmos/Info Support date overlap, unaffected). `npm run check:recruiter` without a local build = 50/100, an artefact of the missing `dist/` ("page not in this deployment", "no resume report"); the reference is **80/100** for main's data on the live pages, and the merge review runs it on a build and expects no lower and no new high or medium findings.
- **Before merge:** `dist/building-this-site.md` has the new clause and no internal terms; the assistant check runs (a write-up changed) and answers as on main ("did not run" is not a pass).
- **Verdict: APPROVE**, provided the wording stays plain, at most 30 added words, names the private MCP, and carries no internal terms.

## Design (ux-designer)

- **What renders differently:** one bullet in section 06 ("Put every change past a team") grows by one sentence. No new component, token or layout; the existing `li`/`strong` styles of `.wx-steps`.
- **Copy (designer's recommendation):** keep the existing sentence and add a short second one rather than a longer clause: "My private MCP names each update in plain English and merges exactly the version I previewed, or nothing, and never while its checks are still running or have failed." No "pull request", "sha", "check runs" or conflict redo.
- **Diagrams: no change.** `LoopDiagram` ("I merge the pull request / after the preview", aria-label "after Steven merges it") and `TeamFlowDiagram` ("I merge / after the preview", `flowDescription` "Steven merges, and the site deploys", caption "I answer the questions and decide the merge.") still agree: the check-in makes the merge stricter, it adds or removes no step and does not change who decides. Crowding "exact version, checks green" into a 13px box would cost more than it gives; the prose carries it.
- **States:** prerendered static text, the same without JavaScript; no empty, loading or error state involved.
- **Layout:** 1440 light/dark: about 1 to 2 more lines. 390 light/dark: about 4 to 5 more lines, still readable, no horizontal scroll.
- **Accessibility:** no new control; focus, keyboard path, contrast and reduced motion unchanged.
- **Pages to screenshot:** `building-this-site` (the slice with section 06, phone and desktop), branch against main, at the UI check.
- **Verdict: APPROVE.**

## Threat model (security-engineer)

- **Surface:** none new. One sentence of prerendered prose in `SiteArticle.tsx`; no route, tool, data, input, dependency or workflow change. Nothing untrusted reaches it.
- **Disclosure:** the article already says the site has a private MCP server (the lede, the assistant caption) and that Steven merges from the conversation; the clause adds a behaviour, not a capability. What would help an attacker stays off the page: the private address and its key (`/mcp/<key>`), tool and argument names (`merge_site_update`, `confirm`, `sha`, `acceptFailingChecks`, `acceptLowerScore`, `recheck`), secret and token names (`ADMIN_TOKEN`, the GitHub App), check names (`gates`, `team`, `check`), and the branch-protection state (`tools.ts` l.1251: "until branch protection holds every merge to the checks, this is where they hold"; a gap not to advertise).
- **Accuracy against `functions/_lib/mcp/tools.ts` (`merge_site_update`):** "exactly the version I previewed or nothing" holds: without `sha` nothing merges (l.1247), a different head returns "changed since" (l.1249), the merge is pinned to that commit and GitHub's 409 is refused (l.1266, l.1273). "Not while the checks are still running" holds, with no override (l.1257; `blocked` at l.1255). **"Never one whose checks failed" overclaims:** after being told, Steven can put it live anyway with `acceptFailingChecks: true` (l.1258), and a lower résumé score with `acceptLowerScore` (l.1250). The wording in *Outcome*, AC-2 and the designer's copy ("never while its checks ... have failed") must change; this agrees with the developer's finding, and the developer's 28-word sentence meets every rule below.
- **Controls (wording rules, checked at merge review):**
  1. Failed checks are a stop Steven can overrule, not a hard guarantee: "...and after a failed check only if I still say yes" (the developer's wording) or equivalent.
  2. No "never", "cannot", "safely" or "guaranteed" about failed checks, and no claim that GitHub enforces the checks; the stop described is the conversation's.
  3. None of the names listed under *Disclosure*, no URL, no key, no digits. AC-4's forbidden list gains `acceptFailingChecks`, `confirm`, `/mcp/`, `gates`, `ADMIN_TOKEN`, "token" and "key".
  4. The subject is "the conversation" or "my private MCP", never a bare "MCP" that a reader could take for the public read-only `/mcp`. "Private MCP" discloses nothing new (the lede already says it); whether AC-4 admits it is the PM's call, not a security one.
- **Tests:** the tester's new AC-4 test, with the regex extended by the terms of rule 3, on the new text; `dist/building-this-site.md` searched for the same terms after the build; a reviewer's read of the sentence against `tools.ts` l.1246-1266 for rules 1 and 2. The tester's proposed test name ("never ... after they failed") should follow rule 1 too. No unit test of code: no code path.
- **Verdict: APPROVE**, on condition of rule 1. The *Outcome* wording as drafted overstates the failed-checks stop; shipped as is, it is a `major` at merge review.

## Technical approach (senior-developer)

Feasible as one text edit; no code, no new test file.

- **Where:** `src/articles/site/SiteArticle.tsx` line 194, the `<li>` "Put every change past a team." in section 06. Insert one new sentence directly after "I read the preview and merge, from the same conversation if I like." and before "Changes to the agent team itself…". Plain text inside the existing `<li>`, no new element, curly apostrophes as the bullet already uses (`’`).
- **Add a sentence, do not extend the existing one.** `src/articles/articles.test.tsx:165` asserts `toContain('I read the preview and merge, from the same conversation if I like.')` with the full stop (specs/mcp-prs-flow.md, AC-12). Turning that full stop into a semicolon, as in the PM's proposed wording, breaks the test. The designer's form (a second sentence) keeps it green. Lines 235 and 268 split the bullet on full stops to find the "metered" and "unread updates" sentences. A new sentence with no "metered" or "unread updates" in it, and no full stop inside it, leaves both tests alone.
- **The claim, checked against `functions/_lib/mcp/tools.ts` on this branch** (after mcp-prs-flow, mcp-plain-names `23bb94c`/`b832f6e` and `dc30907`): `merge_site_update` needs `sha` and merges with `github.merge(number, seen)` pinned to that commit. If the head differs, or GitHub answers 409, it returns `changedSincePreview` and nothing goes live (l.1247-1249, 1273-1276). "The version I previewed, or nothing" is true. While checks are running it is refused with no override (`where === 'checking'`, l.1257). A `blocked` pull request is always refused (l.1255). **Failed checks are not an absolute refusal.** They are refused unless `acceptFailingChecks: true`, which the tool asks for only after Steven has been told which checks failed and still wants the update live (l.1258, description l.1197). The PM's "never one whose checks are still running or failed" and the designer's "never while its checks are still running or have failed" would therefore be false. A true wording with 28 words, within AC-5: "The conversation merges exactly the version I previewed, or nothing; never while its checks are still running, and after a failed check only if I still say yes." "My private MCP" in place of "The conversation" (30 words) answers the recruiter's risk 3, but AC-4 allows only "preview" and "checks" as new technical words, so "MCP" breaks it. Adding "names each update in plain words" pushes the sentence over 30 words, so leave it out (AC-2 allows that, and it is the recruiter's fallback). The PM settles the wording and how AC-4 treats "MCP"; AC-2 should say "refuses while checks are running; after failed checks, only with my explicit yes" in place of "does not merge an update whose checks … failed".
- **What stays:** `src/articles/site/Diagrams.tsx` (both diagrams and their descriptions still say Steven merges after the preview), `src/articles/site/feed.json`, the header comment's date (23 October 2026) and the closing date from `feed.asOf`. `src/resume.ts`, the PDF and `og-image.png` are untouched, so there is no `resume:build` or `og-image.mjs`.
- **Markdown copy and the assistant:** none to edit by hand. `scripts/prerender.mjs` renders the page and writes `dist/building-this-site.md` through `htmlToMarkdown`, plus `llms-full.txt`. `functions/api/ask.ts` reads `/building-this-site.md` from the static assets at request time (`functions/api/ask.test.ts:64-72`), so the assistant knows the new sentence once the change is deployed. AC-6 checks `dist/building-this-site.md` and `dist/building-this-site/index.html` after `npm run build`.
- **Tests:** none asserts the new text. The tester may add one `it` in the `the team diagram on /building-this-site` describe: the bullet contains the new sentence, no digits, and none of the AC-4 terms. That is coverage-neutral, because `SiteArticle.tsx` is already covered and the change adds no branch.
- **Risks:** (1) An inaccurate failed-checks claim. This is the main one, see above. (2) A full stop inside the new sentence (for example "e.g.") would break the sentence-splitting regexes at l.235 and l.268. (3) Length at 390px, the recruiter's concern. (4) `building-notify.yml` does not fire, because only `src/` changes and no orchestration file does. This is not an orchestration change, so `scripts/team-manifest.mjs` is not involved.

## Test plan (senior-tester)

`src/articles/articles.test.tsx` › "the team diagram on /building-this-site" already reads
this bullet in four tests. One of them **will break, and must be updated, not removed**:
"still says the merge is mine…" (line 165) expects
`'I read the preview and merge, from the same conversation if I like.'` with the full
stop, and the proposed wording turns that stop into `;`. Drop only the trailing `.` from
that expectation, which keeps the clause and the guard. The "metered" (line 236) and
"unread updates" (line 269) tests split the bullet on `.`, so they keep checking that
AC-3's neighbouring sentences are unchanged, as long as the new text puts no `.` inside
them.

**One new test is wanted** in the same `describe`, in the style of "says that changes to
the team reach Steven…". Without it AC-2, AC-4 and AC-5 could break with every check
green: `toContain` on the old clause passes whatever comes after it. Proposed name:
`'says the conversation merges exactly the version I previewed or nothing, never while checks run or after they failed, in plain words'`.
It renders `<SiteArticle />`, takes the `li` of "Put every change past a team.", and:

- isolates the sentence with `/I read the preview and merge[^.]*\./`, then asserts it
  matches `/exactly the version I previewed/`, `/or nothing/` and
  `/still running|running/` together with `/failed/` (regexes, not one exact string, so
  the designer's two-sentence variant also passes; if the developer uses a second
  sentence, the test takes the two sentences after "own checks.");
- asserts that the new text does not match
  `/\d|merge_site_update|updateName|\bsay\b|\bsha\b|commit|\bhead\b|MCP tool|check run|branch|redo|conflict/i`;
- asserts that the whole bullet has no digit (it has none on main);
- asserts the whole bullet's word count (`textContent.trim().split(/\s+/)`) is
  `<= 175 + 30`. 175 is main's count, which I counted by hand: check it against main's
  text when writing the test and hard-code it with a comment, as at line 295.

| AC | Test (file, name) or check | Kind |
|---|---|---|
| AC-1 | `git diff --stat main -- src/ .claude/ .github/ scripts/ public/` lists only `src/articles/site/SiteArticle.tsx` (plus `articles.test.tsx` for the test); the diff shows the one `<li>` changed. Existing diagram tests ("draws the flow across and stacked…", "the Pull request box…", the `LoopDiagram` labels at line 170) and `feeds.test.ts` stay green. | reviewer + existing tests |
| AC-2 | New test (above): kept clause, "exactly the version I previewed", "or nothing", running/failed; the updated line 165 test keeps the first-person clause. | new + updated test |
| AC-3 | Existing "metered" (exact sentence) and "unread updates" (exact sentence) tests; "sits in the loop section…" for the `strong` title; reviewer reads the diff for the first four sentences. | existing tests + reviewer |
| AC-4 | New test: the term and digit regex on the new text. | new test |
| AC-5 | New test: word count `<= 175 + 30`. | new test |
| AC-6 | `npm run lint`; `npm run test:coverage`: 90% or more overall and per file, `SiteArticle.tsx` at 90% or more on all four metrics (a text change with no new branch, so no movement is expected); `npm run build`, then `grep -l "exactly the version I previewed" dist/building-this-site/index.html dist/building-this-site.md`; `npm run check:site`. | commands |
| AC-7 | `npm run check:recruiter` (on the build) no lower than main; `git diff main -- src/resume.ts public/steven-wilssens-resume-2026.pdf` is empty, so `src/resume.test.ts` and the ATS score (100) do not move. The assistant check runs because a write-up changed ("did not run" is not a pass). | commands |

Edge cases. The `’` in "request’s" and any curly quotes in the new text must not break
the matchers, so use regexes. A `;` or `,` inside the new clause is fine, but a `.` inside
it would break the sentence isolation: the test should fail loudly rather than match the
wrong text, so assert the match is not null first. "MCP" alone is allowed (AC-4 bans only
"MCP tool"; the recruiter asks for "private MCP"), so do not put a bare `MCP` in the
regex. The test is a plain render: no timers, no network, no shared state.

Verdict: APPROVED, on condition that the new test lands with the change and the line 165
expectation is updated rather than deleted.

## Open questions for Steven

None. The wording follows CLAUDE.md and `tools.ts` and discloses no new capability
(security); the team settled it. Steven can still change or drop the sentence by
replying on the pull request before he merges.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | approved (reconciled) | | Final wording and AC-2/AC-4/AC-5a supersede the drafts in the sections above |
| Senior recruiter | APPROVE | | Plain wording, at most 30 added words, names the private MCP, no internal terms |
| Senior designer | APPROVE | | No diagram change; screenshot section 06 of `building-this-site` at the UI check |
| Senior developer | feasible | | One new sentence after "from the same conversation if I like.", no code path |
| Security engineer | APPROVE (on wording rule 1) | | Failed checks are a stop Steven can overrule; the Final wording meets the rules |
| Senior tester | APPROVED (with the new test) | | Line 165 test kept unchanged (a new sentence, not an extended one); AC-5a test added |
