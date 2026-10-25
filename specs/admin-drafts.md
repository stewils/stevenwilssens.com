# Drafts only Steven reads, on the Links page; the split by payment in the overview

Slug: `admin-drafts` · Branch: `costs-split` · Short spec (admin only)

## Problem

Steven in `/admin`. He wants to read drafts (the first: how the agent costs grew and what fixed them) before deciding whether they go on the site, from a link on `/admin#links`, and nobody else may read them. The repository is public and the admin bundle can be downloaded by anyone, so the text cannot live in either. He also could not see, at a glance, what building with Claude cost on the API key and on the Max plan.

## Acceptance criteria

- AC-1: `migrations/0015_admin_drafts.sql` adds `admin_drafts` (slug, title, summary, Markdown body, updated_at). Rows are written with `wrangler d1 execute`; no code path writes them.
- AC-2: `GET /api/drafts` (admin token) lists the drafts newest first without their bodies; `?slug=` answers one with its body, 404 for a missing or malformed slug; 401 without the token, before touching D1; no-store. (`functions/api/drafts.test.ts`)
- AC-3: `/admin#links` starts with a **Drafts** card linking each draft to `#links?read=<slug>`, which opens it in the admin with a way back. The list is asked for only on the Links page and a body only when opened. Loading, failure, none and missing each say so. (`src/admin/StatsPages.test.tsx`, `src/admin/Admin.test.tsx`)
- AC-4: The Markdown is rendered as React elements, never as HTML: headings, paragraphs, lists, quotes, ``` blocks for diagrams, tables, bold, code, and links only to `https://`. (`src/admin/markdown.tsx`)
- AC-5: The overview's headline numbers include **API key this month** and **Max plan this month**; the Costs tile and the Costs page's This month card name both, and a split figure reads "API key" and "Max plan". (`src/admin/Overview.test.tsx`, `src/admin/CostsPage.test.tsx`, `src/admin/costs.test.ts`)

## Out of scope

Editing drafts in the admin, publishing a draft to the site (that goes through the team like any page).

## Sign-offs

Admin-only change; merged by Steven's word without the team review, after lint, `npm run test:coverage` and `npm run build` passed locally.
