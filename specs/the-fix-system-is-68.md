# Watt Fighters write-up: the fix system is built and live

Slug: `the-fix-system-is-68` · Branch: `update/the-fix-system-is-68` · Status: built
Asked by Steven on 2026-11-02: sections 10 to 12 of the Building Watt Fighters write-up say Built where the fix system is built and live, and keep Planned only for the text messages and the timing of race messages. This update also carries the change of the open update "Fixes as pull requests in the Watt Fighters write-up" (PR 115, `update/fixes-as-pull-requ-67`) word for word; PR 115 will be closed.

Short spec: a Building write-up refresh with Steven's exact wording; no spec agents were started (Steven is not available to answer questions).

## Problem

The write-up says most of the fix system is planned. As of 2 November 2026 it is built and live, except the texts (waiting for the text message service) and the timing of race messages (the game does not time them yet).

## Acceptance criteria

- AC-1: PR 115's wording is in: the Built bullets about the pull request (sections 10 and 11), the Built bullet about the fixer closing pull requests, "or a merge" in both diagrams' decision boxes and "or a merged pull request" in their descriptions, with its tests.
- AC-2: The game's reports, the server's reports and checks, players' messages, the counting, the players' bugs switch, the loud fix (email, live after an hour unless "Let me check it first", Stop switch on to begin with), the 2 hours of watching with the red email, the emails with players and share, the urgent email, the buttons that work once for 24 hours and the 15-minute rule are Built. The game bullet ends with "The Windows and Android apps catch their own crashes too; that reaches players with their next app builds."
- AC-3: The server bullet drops "1 in 20 race messages slower than 250 ms" from the list and says in a separate sentence that it is still planned, because the game doesn't time those messages yet.
- AC-4: The text-message bullet stays Planned, keeps its limits (one an hour per problem, 6 a day, CHECK) and adds "The texts are written into the code; they start when the text message service is set up." It is the only Planned step left.
- AC-5: Every row of the switches table is Built; the first row is "Stop: every fix waits for me", Starts "On", Can it change "Yes". "Planned: the switches arrive with the features they control." becomes "They are on the admin page’s QOS tab, with the problems, the fixes and the server’s health."
- AC-6: The leadership bullet reads "The rules are built: a fix goes live on its own only when a test shows the problem, every test passes, many players have it, and it touches no protected part. Until I switch off the Stop switch, every fix still waits for me." and keeps its link. Section 10 opens "Almost all of it runs today. Each step still says which: Built or Planned." with the definitions kept.
- AC-7: The captions and the in-drawing lines say "While the Stop switch is on, every fix waits for my “Release it”." instead of "Today every fix waits for my “Release it”."
- AC-8: In the three diagrams every box, cell, pill and bracket for a built part is solid and marked Built; the text message cells (the pill and the stacked step in the hour, "A text with it" in Who decides) stay dashed and Planned. The text descriptions match. Both drawings of each diagram (desktop and phone) keep every font at 11 or more.
- AC-9: Nothing else on the site changes. The résumé does not call the fix system planned, so it is untouched.

## Recruiter impact

Recruiter impact: none for the résumé (untouched; ATS score unchanged). The write-up says what is built, with Built and Planned labels kept true.

## Design

All boxes in the flow become solid. In the hour diagram the "Email and text" moment becomes "Email" (Built) and a small dashed "Text" pill sits beside it (desktop); on the phone a dashed "Text message" step follows it inside the bracket. The loud "Fix ready" cell in Who decides reads "an email; live in an hour unless I stop it, Stop switch on: waits for me". The decision box keeps PR 115's extra line and height.

## Threat model

Static text only; nothing new reachable.

## Sign-offs

| Role | Spec | Merge |
| --- | --- | --- |
| Product manager | short spec by the lead | Review workflow |
| Recruiter | none (no résumé change) | Review workflow |
| Designer | short spec by the lead | Review workflow |
| Security | none (static text) | Review workflow |
| Tester | tests updated | Review workflow |
| Developer | built | Review workflow |
