# The Costs page shows the last 30 days: cost, cost per feature, features

Slug: `costs-over-time` · Branch: `costs-over-time` · Short spec (admin only, extends `specs/dev-costs.md`)

## Problem

Steven in `/admin#costs`. Since PR 88 the team on GitHub runs on his Max plan, and his local sessions are recorded since the ingest token was renewed (2026-10-24). He wants to see at a glance, over time: what everything cost, split between the API key and the Max plan; what a feature costs, split the same way; and how many features there were. The only chart was monthly and starts with the second month, so with all data in October he saw none.

## Acceptance criteria

- AC-1: `GET /api/costs` answers `days`: the last 30 UTC days ending today, empty ones kept, each with `money` (billed, estimated, unknown), `features` (features with a run that day; `main` is none), `started` (features whose first recorded run was that day) and `startedTotal` (everything those features have cost so far). Each feature carries `firstRunAt`. (`functions/_lib/costs/views.test.ts`, "the days")
- AC-2: A card **Last 30 days** sits right after **This month**, with three charts, a bar per day: "Spent per day" stacked API key / Max plan; "Average cost of a feature, by the day it started" (`startedTotal / started`, stacked the same way); "Features per day" (worked on, with the started count in each bar's label). Each readout gives the 30-day figure. (`src/admin/CostsPage.test.tsx`, "Last 30 days")
- AC-3: The page says "API key" and "Max plan" where it said billed and estimated in the legends, the monthly table's headers and the bars' labels; a run that did not say how it was paid counts with the Max plan, and keeps its `?$` mark in the figures.
- AC-4: Without any day recorded, or from an answer without `days`, the card says "Nothing recorded in the last 30 days."

## Out of scope

Weekly or monthly cohorts, the merge date of a feature (GitHub's list carries no `merged_at` here), a time zone other than UTC.

## Sign-offs

Admin-only change; built and merged by Steven's word without the team review, after lint, `npm run test:coverage` and `npm run build` passed locally.
