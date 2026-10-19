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
- AC-8: `/privacy` says what the assistant keeps and for how long.

## Out of scope

Following a person across days (the visitor code rotates daily on purpose); logging questions that were turned away by the limits or the human check.

## Recruiter impact (senior-recruiter)

One paragraph on `/privacy`. The assistant's answers and the résumé do not change.

## Design (ux-designer)

A `section.card` with `data-part="People"` first on the assistant page, built from the existing stats grid, `TrendChart` and `DataTable`. Empty, unreadable-log and capped states each have their own sentence.

## Threat model (security-engineer)

Questions are text typed by strangers, shown only on `/admin` behind the admin token and rendered as text. Redaction removes email addresses, phone numbers, API keys, JWTs and bearer tokens. No IP address is stored.
