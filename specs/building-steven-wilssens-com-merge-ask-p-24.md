# /building-this-site says what the assistant keeps of each question, and for how long

Slug: `building-steven-wilssens-com-merge-ask-p-24` · Branch: `update/building-steven-wilssens-com-merge-ask-p-24` · Status: draft
Asked by Steven on 19 October 2026 (Building write-up refresh): refresh /building-this-site after the check-in "Merge ask-people: the assistant page shows how many different people used Ask about Steven and what each of them asked".

## Problem

Readers: peers checking Steven's work (first), recruiters and hiring managers who open the write-up from the home page (second). Section 05 of `/building-this-site` ("An assistant that knows only what I published", `src/articles/site/SiteArticle.tsx`) says questions, cost, votes and the unanswered questions go to the dashboard, but not what is kept of a question, with what, for how long, or that nothing is kept from browsers that send Global Privacy Control or Do Not Track. Since the ask-people merge (`sources/site.log`, `sources/site.diff`) every question is kept for 90 days with the analytics' daily anonymous visitor code, redacted, so the admin can show how many different people asked and what; nothing is kept on previews or under GPC/DNT; a pasted job description is kept only as its length and first words; the panel links to `/privacy`. The write-up no longer matches the site. A peer who reads section 04 (the tracker keeps nothing from GPC/DNT visitors) and then section 05 has no way to tell whether the assistant follows the same rule.

## Outcome

Section 05 tells the reader, in one sentence, that each question is kept for 90 days with the day's anonymous visitor code so Steven sees how many different people asked and what, and that nothing is kept from browsers that send GPC or DNT. It matches what the site does and what `/privacy` says.

## Acceptance criteria

- AC-1: In `src/articles/site/SiteArticle.tsx`, section 05 (`id="assistant"`), the paragraph that starts "Questions, cost, votes and the unanswered questions go to the dashboard" (or the sentence added right after it in the same paragraph) says (a) a question is kept for 90 days, (b) with that day's anonymous visitor code, (c) so Steven sees how many different people asked and what they asked, and (d) nothing is kept from browsers that send Global Privacy Control or Do Not Track. Checked by reading the diff and the built `dist/building-this-site/index.html`.
- AC-2: The change adds one or two sentences to that paragraph and nothing else in the article: no new section, list item, image or diagram; `TeamFlowDiagram` and the other sections unchanged (`git diff main -- src/articles/site/SiteArticle.tsx` shows only that paragraph, and the header comment date if it moves).
- AC-3: The new text contains no private detail: no table or column names (`ask_log` or others), no secret, key, token, hashing or salt detail, no cost or budget figure, no visitor text or example question.
- AC-4: No number from `src/articles/site/feed.json` is typed into the article text; the only number added is the retention period "90 days", which is a rule in the code (and on `/privacy`), not a feed value. The closing section's date still comes from `feed.asOf`.
- AC-5: The new sentence agrees with the rest of the write-up and with `/privacy`: it does not contradict section 04 (GPC/DNT, nothing kept), or the fit-check bullet in section 05 (it does not claim the posting is kept in full; if it mentions the posting, it says only its length and first words are kept). The retention period and the GPC/DNT rule match the `/privacy` page copy in `src/App.tsx` (`grep -n "90 days" src/App.tsx` finds the same period).
- AC-6: `src/resume.ts`, `public/steven-wilssens-resume-2026.pdf`, `public/og-image.png`, `.claude/`, the workflows and every file other than `src/articles/site/SiteArticle.tsx`, `src/articles/site/feed.json` (numbers only, from the refresh) and this spec are unchanged against main (`git diff --stat main`).
- AC-7: `npm run lint`, `npm run test:coverage` (90% or more overall and per changed file) and `npm run build` pass; `npm run check:recruiter` is not lower than on main.

## Out of scope

- Any change to the assistant, `ask_log`, the admin "People who asked" page or `/privacy`; they shipped in the ask-people merge.
- A new paragraph or diagram on what the admin's assistant page shows; follow-up only if Steven wants the admin described in the write-up.
- Section 06 ("The loop") and the team diagrams: the orchestration did not change in this check-in.
- Other Building write-ups and every other page.

## Recruiter impact (senior-recruiter)

## Design (ux-designer)

## Open questions for Steven

None. The change restates what the merged code and `/privacy` already say; nothing waits for Steven.

## Sign-offs

| Role | Spec | Merge | Notes |
|---|---|---|---|
| Product manager | APPROVE | | One sentence in section 05; AC-1 to AC-7. |
| Senior recruiter | | | |
| Senior designer | | | |
| Senior developer | (feasibility) | | |
| Security engineer | (threat model) | | |
| Senior tester | (test plan) | | |
