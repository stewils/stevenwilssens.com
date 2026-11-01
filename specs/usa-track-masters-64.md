# Watt Fighters write-up: name the USA Track Masters national title

Slug: `usa-track-masters-64` · Branch: `update/usa-track-masters-64` · Status: built
Asked by Steven on 2026-11-01: "Name Steven's national title exactly in the Building Watt Fighters write-up … he is a USA Track Masters national champion, after ten years as a professional track racer."

Short spec: a write-up wording change with Steven's exact text; no spec agents were started.

## Problem

The write-up says "a national track champion" and "won a national title" without naming the title. Steven confirmed it is a USA Track Masters national title.

## Outcome

A reader sees the exact title in the "What this shows" box and in section 01.

## Acceptance criteria

- AC-1: The box reads "Ten years as a professional track racer and a USA Track Masters national title meant …".
- AC-2: Section 01 reads "I raced track for ten years as a professional, I am a USA Track Masters national champion, and I now have a son who races."
- AC-3: Nothing else changes; the résumé and PDF are untouched. The assistant's prompt does not mention Steven's racing record, so it is unchanged.

## Out of scope

The résumé, the assistant prompt, every other page.

## Recruiter impact

Recruiter impact: positive and small; the claim is now specific and checkable. Résumé and ATS score untouched (100/100).

## Design

Nothing renders differently beyond the two sentences.

## Threat model

None: static text.

## Technical approach

`src/articles/wattfighters/WattFightersArticle.tsx`, two strings.

## Test plan

Existing tests; lint, coverage and build run.

## Open questions for Steven

None.

## Sign-offs

| Role | Spec | Build |
|---|---|---|
| Product manager | not run (short spec) | |
| Senior recruiter | not run (short spec) | |
| UX designer | not run (short spec) | |
| Security engineer | not run (short spec) | |
| Senior tester | not run (short spec) | |
| Senior developer | built | |
