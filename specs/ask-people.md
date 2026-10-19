# The assistant page shows how many people asked and what they asked

Slug: `ask-people` · Branch: `ask-people` · Status: built
Asked by Steven on 2026-10-19: "make sure that when we look at the AI assistant page, we have the equivalent of visitors, i want to see how many different people actually used the ask about steven feature" and "and see what questions they asked".

## Problem

`/admin` → Ask about Steven counted questions and cost per day, and kept only the questions the assistant could not answer. Steven could not tell whether 30 questions came from one curious recruiter or from fifteen, nor read what people actually asked.

## Outcome

Steven sees, for the chosen range (at most 90 days), how many different people used the assistant, counted the way Traffic counts visitors, and every question each of them asked with the answer.

## Acceptance criteria

- AC-1: Every question answered by the assistant is logged in `ask_log` with the analytics' daily visitor code (`functions/_lib/visitor.ts`, the same hash as `collect.ts`), the page, the outcome, the network and the redacted question and answer. (`agent.test.ts`, `visitor.test.ts`)
- AC-2: A job description pasted for a fit check is logged as its length and first words only. (`agent.test.ts`, the fit check)
- AC-3: Nothing is logged on preview deployments; under Global Privacy Control or Do Not Track nothing is kept at all, including `ask_questions`. (`agent.test.ts`)
- AC-4: Entries older than 90 days are deleted, and the admin API never sends more than 90 days. (`store.test.ts`, `admin.test.ts`)
- AC-5: A failure to write or read the log never breaks an answer or the admin page. (`agent.test.ts`, `admin.test.ts`, `AssistantPage.test.tsx`)
- AC-6: The **People who asked** card shows people, questions per person, follow-ups, job checks, people per day, and a row per person with their questions; a row opens (by click, or by keyboard on its button) to the answers and that day's visit. (`AssistantPage.test.tsx`, `DataTable.test.tsx`)
- AC-7: The overview tile says how many people asked in the range. (`needs.test.ts`)
- AC-8: `/privacy` says what the assistant keeps and for how long, and after 90 days only the question of a closed question is left (`App.test.tsx`, `store.test.ts`); the panel says "Questions are kept 90 days" with a link to `/privacy` (`AskAssistant.test.tsx`).

## Out of scope

Following a person across days (the visitor code rotates daily on purpose); logging questions that were turned away by the limits or the human check.

## Recruiter impact (senior-recruiter)

One paragraph on `/privacy`. The assistant's answers and the résumé do not change.

## Design (ux-designer)

A `section.card` with `data-part="People"` first on the assistant page, built from the existing stats grid, `TrendChart` and `DataTable`. Empty, unreadable-log and capped states each have their own sentence.

## Threat model (security-engineer)

Questions are text typed by strangers, shown only on `/admin` behind the admin token and rendered as text. Redaction removes email addresses, phone numbers, API keys, JWTs and bearer tokens. No IP address is stored.

## Test plan (senior-tester)

| AC | Test |
|---|---|
| AC-1 | `agent.test.ts` logs every question with the visitor code (equal to `visitorHash` for that browser and day), answer redaction; `visitor.test.ts` fixed vector |
| AC-2 | `agent.test.ts` logs only the opening of a pasted posting (longer than the cut, a later phrase absent) |
| AC-3 | `agent.test.ts` previews, GPC, DNT, no `HASH_SALT`; GPC keeps no `ask_questions` row and no voted-down answer |
| AC-4 | `store.test.ts` retention in both stores; `collect.test.ts` daily cleanup; `admin.test.ts` 90-day read and answer cap |
| AC-5 | `agent.test.ts` failing log write; `admin.test.ts` unreadable log; `AssistantPage.test.tsx` unreadable and capped states |
| AC-6 | `AssistantPage.test.tsx`; `DataTable.test.tsx` Enter and Space, row button names |
| AC-7 | `needs.test.ts` 1 person, 2 people, 365 and 1 day |
| AC-8 | `App.test.tsx` privacy paragraph; `store.test.ts` closed questions after 90 days; `AskAssistant.test.tsx` panel line |

Coverage stays at 90% or more per file (`npm run test:coverage`).

## Open questions

Answered by Steven on 2026-10-19:
1. Keep questions linked to the day's visit 90 days. Yes.
2. Closed (answered or dismissed) questions after 90 days: keep only the question; drop the assistant's answer, the page, the country and the network.
3. The panel says "Questions are kept 90 days" with a link to `/privacy`. Yes.
4. The assistant on the preview answers correctly and streams to the end. Checked by Steven.

## Sign-offs

The Review workflow's sign-off table on pull request #51 is the record; this spec is approved when every role there approves.
