# steven.wilssens.com

Personal resume site for Steven Wilssens: a React + TypeScript + Vite single-page app hosted on Cloudflare Pages, with first-party, cookie-free analytics stored in Cloudflare D1.

- **Site:** https://steven.wilssens.com (https://stevenwilssens.pages.dev and every name under wilssens.net redirect to it)
- **Analytics dashboard:** https://steven.wilssens.com/admin (token protected)

## Development

```sh
npm install
npm run dev        # Vite dev server (analytics is disabled outside production builds)
npm test           # Vitest
npm run lint       # oxlint
npm run build      # type-check app + functions, build to dist/
```

To run the production build locally with the Pages Functions and a local D1 database:

```sh
npx wrangler d1 migrations apply stevenwilssens-analytics --local
printf 'ADMIN_TOKEN=local-test-token\nHASH_SALT=local-salt\n' > .dev.vars   # gitignored
npm run build && npx wrangler pages dev
```

## Project layout

| Path | What it is |
|---|---|
| `src/App.tsx` | The whole site: pages, content, and routing (`pageFromLocation`) |
| `src/resume.ts` | Everything about Steven: `profile` (headline, summary, location, authorization, contact), roles (each with a stable `key`), `impact`, `skills`, `selectedWork`, honors, recommendations, press. The site, the resume PDF, the MCP server and the site assistant all read it |
| `scripts/resume.mjs`, `scripts/resume-check.mjs` | Build the resume PDF from `src/resume.ts` and analyse it (see Updating the resume) |
| `functions/_lib/review/` | The recruiter review and the LinkedIn import and comparison behind the MCP tools |
| `.github/workflows/site-update.yml` | Claude Code changes the site on a branch and opens a pull request, started from the MCP server |
| `src/pageMeta.ts` | Routes plus each page's title and description |
| `src/analytics.ts` | Browser tracker: pageviews, time on page, scroll depth, clicks, Core Web Vitals |
| `src/admin/` | The `/admin` analytics dashboard (separate Vite entry, `admin.html`) |
| `functions/api/collect.ts` | `POST /api/collect`: validates events, adds location/network/device, writes to D1 |
| `functions/api/stats.ts` | `GET /api/stats?days=30&tz=<minutes>`: dashboard data, requires `Authorization: Bearer <ADMIN_TOKEN>` |
| `functions/api/mcp.ts` | `GET /api/mcp`: the owner link, dossier counts and résumé proposals for the dashboard (admin token) |
| `functions/mcp.ts`, `functions/mcp/[[path]].ts` | `/mcp/<owner key>`: the private MCP server, implemented in `functions/_lib/mcp/` |
| `migrations/` | D1 schema migrations |
| `public/` | Static files, including the resume PDF and the 1200×630 `og-image.png` |
| `vite.config.ts` | Also generates one HTML file per route with its own metadata, plus `404.html`, `sitemap.xml`, and `robots.txt` |
| `scripts/prerender.mjs` | Fills each page's HTML with its content, and writes a Markdown copy of each page (`/about.md`, …) plus `llms.txt` and `llms-full.txt` for LLMs |

### Adding a page

Add the route to `routes` and its title/description to `pageMeta` in `src/pageMeta.ts`, then render it in `App.tsx`. The build creates the static HTML file and sitemap entry automatically.

### Updating the resume

The resume PDF is generated from `src/resume.ts`, the same data the site shows, so the two cannot drift:

```sh
npm run resume:build   # renders public/steven-wilssens-resume-2026.pdf in the installed Edge (or Playwright's Chromium)
npm run resume:check   # the analysis alone, on the current PDF
node scripts/og-image.mjs   # the 1200×630 share image, after a headline or photo change
```

`scripts/resume.mjs` renders an HTML resume to PDF, then runs `scripts/resume-check.mjs` on the new and the current file: pages, extractable text and glyphs, contact details, headline, every role and date, the bullets of the two latest roles, tense of past roles, team size, ATS keywords, numbers without a backing bullet, plus the questions the dates raise (gaps, overlaps). A new PDF only replaces the current one when its score does not drop (`--force` overrides). `src/resume.test.ts` fails when the PDF no longer matches the data, and the build writes the report to `dist/resume-report.json` for the MCP server's `check_resume`. Fix findings in the data, never in the PDF.

## Ask about Steven: the assistant on the site

A floating "Ask about Steven" button on every page (and "Ask AI about my work" in the hero) opens a panel where recruiters and hiring managers ask anything about Steven's work. Built the way the help assistant on wilssens.com is:

- **Server** (`functions/_lib/ask/`): `POST /api/ask` streams an answer from Claude (`claude-opus-5-5`, effort low, server-side fallback on a refusal) as Server-Sent Events (`meta`, `delta`…, `done`). The system prompt (`prompt.ts`) is built from `src/resume.ts`, `src/patents.ts` and the **public** dossier entries, so the assistant knows only what Steven published; it is byte-stable and cached by the API for an hour. Every reply starts with a hidden first line the server strips: `[[in: role:csx-data, site:patents]]` (the sections it rests on, shown as links), `[[in: none]]` (in scope but not covered: saved to `ask_questions` as a gap) or `[[out]]` (off topic: our own fixed answer, the model's text is never shown). Answers are signed (HMAC with `HASH_SALT`) so the browser can send the conversation back and vote without forging an earlier answer.
- **Limits**: 30 questions an hour per IP (salted hash, `ask_hits`), 1000-character questions, 12 turns, and a monthly budget (`ASK_BUDGET_USD`, default $25) counted from the API's token usage in `ask_daily`. Optional Turnstile human check when `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY` are set. `GET /api/ask` tells the page whether the assistant is on; the button only appears when it is.
- **Browser** (`src/ask/`): React panel docked beside the page from 1200 px (the page moves over), an overlay on tablets, a bottom sheet on phones; streaming with a caret, suggestions that fit the page, sources as links, Copy, thumbs up/down (`POST /api/ask/feedback`), conversation kept in `sessionStorage` across pages. Markdown is rendered through `markdown.ts`: bold, lists and links only, links only to the site, the résumé, LinkedIn, Justia and Steven's email.
- **Dashboard**: `/admin` shows this month against the budget, questions per day, votes, and the questions the dossier could not answer; the same list reaches the MCP interview as `askedOnTheSite`, so the next session fills the gaps.
- **Local**: `ASK_MOCK=1` in `.dev.vars` streams canned answers without an API call; with `ANTHROPIC_API_KEY` set it calls Claude.

## MCP server

`/mcp/<MCP_OWNER_KEY>` is a private [Model Context Protocol](https://modelcontextprotocol.io) server (Streamable HTTP, stateless, JSON responses) for one person: Steven. The link is shown on `/admin`; without the key, `/mcp` is a 404. Added to Claude (Settings → Connectors → Add custom connector) or Claude Code (`claude mcp add --transport http my-career <link>`), it is a workspace for talking through his career that builds on what is already there:

- **What is published**: `about_steven`, `read_site_page` (the Markdown copies of the site's pages that the build writes, including the Building wilssens.com write-up, read through the `ASSETS` binding), `get_role`, `get_recommendations`, `get_patents_and_press`, `get_resume` (the entries in `src/resume.ts`).
- **The dossier** (`dossier` table): facts and stories Steven records, one per entry, with a role key, topic, visibility and tags. `interview_status` shows which roles and topics are still empty and suggests questions; `save_entry`, `update_entry`, `delete_entry`, `list_entries`, `search_dossier`, `export_dossier` manage it. Entries are private by default; `public` means a recruiter-facing assistant on the site may use them later (that assistant is not built yet; it will work like the help assistant on wilssens.com: a server-side Claude call with the public dossier as a cached system prompt, never this MCP).
- **The résumé** (`resume_proposals` table): at the end of a session Claude compares the dossier with `get_resume` and calls `propose_resume_change` for each concrete edit (exact current text, proposed text, why). A proposal can target any part of a role (`field`: title, company, dates, location, summary, or a bullet point) or a whole role (`field: role`: add with `role: new-role` and the entry as JSON, replace, or remove), so dates, titles and missing or obsolete roles are handled the same way. Steven approves or rejects in the conversation (`review_resume_proposal`); `/admin` and `list_resume_proposals` show what is approved or waiting. Approved changes go to the site through `request_site_update` (below), then are marked `applied`.
- **The recruiter's seat** (`functions/_lib/review/`): `review_for_recruiters` reads the published pages, the resume report the build wrote and the LinkedIn import, and returns findings (what a recruiter trips over, why it matters, the fix: scope numbers, unexplained impact numbers, tense, gaps and overlaps, hiring logistics, proof from the wrong chapter, a resume that drifted from the site) plus the questions only Steven can answer. `check_resume` is the resume analysis on its own.
- **LinkedIn** (`linkedin_profile` table): LinkedIn has no API, so `save_linkedin_profile` takes the profile as text (LinkedIn → More → Save to PDF, or the page copied) or the CSV files of LinkedIn's data export (Profile, Positions, Skills, Education, Languages; the reliable route). `compare_linkedin` then lists, per difference, what LinkedIn says, what the site says, why a recruiter cares, and the exact text to paste into LinkedIn.
- **Changing the site** (`functions/_lib/github.ts`): `request_site_update` starts the **Site update** GitHub workflow (`.github/workflows/site-update.yml`), where Claude Code applies the brief on a branch (facts in `src/resume.ts`, `npm run resume:build`, lint, tests, build) and opens a pull request; `site_update_status` shows runs and open pull requests with their preview links; `merge_site_update` merges one into `main` (production) and only runs with Steven's explicit confirmation. Needs the `GITHUB_TOKEN` Pages secret (a fine-grained token with Actions: write, Contents: read, Pull requests: write on this repository; `GITHUB_REPO` overrides the default `stewils/stevenwilssens.com`) and, in the repository's Actions secrets, `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` for Claude Code. The workflow uses the built-in `GITHUB_TOKEN` for everything else and dispatches the Deploy workflow for its branch itself, so the pull request gets a preview; the repository setting "Allow GitHub Actions to create and approve pull requests" must be on.

The server's `instructions` (in `functions/_lib/mcp/tools.ts`) tell Claude how to run a session: read what exists before asking, one question at a time, save as it goes, third-person entries, visibility rules, then the résumé proposals.

Local run: add `MCP_OWNER_KEY=<anything>` to `.dev.vars`, apply the migrations locally, then `npm run build && npx wrangler pages dev`. Tests: `functions/_lib/mcp/server.test.ts`.

## Deployment

Pushing to `main` runs lint, tests, and the build in GitHub Actions (`.github/workflows/deploy.yml`) and deploys to the `stevenwilssens` Cloudflare Pages project. Pull requests run the checks without deploying.

- The workflow needs the `CLOUDFLARE_API_TOKEN` repository secret (Cloudflare "Edit Cloudflare Workers" token template).
- Manual deploy: `npm run deploy` (requires `wrangler login`).
- `steven.wilssens.com` is a Pages custom domain, as are `steven.wilssens.net`, `www.wilssens.net` and `wilssens.net`: `functions/_middleware.ts` answers anything under `wilssens.net` with a 301 to the same path on `steven.wilssens.com` (`functions/_lib/hosts.ts`), so the old blog domain points at the current site. Both zones' DNS is on Cloudflare, each name a `CNAME → stevenwilssens.pages.dev`.
- Unknown paths return `404.html` with a 404 status.

## Analytics

Events are stored in the `stevenwilssens-analytics` D1 database (binding `DB`, see `wrangler.jsonc`). No cookies are used; a visitor is a SHA-256 hash of IP + user agent + `HASH_SALT` + the date, so visitors cannot be followed across days. Obvious bots are dropped from visitor stats; instead, `functions/_middleware.ts` records requests from search engines, AI crawlers and other bots in the `crawls` table (bot name, path, status, country, network; no IP), shown in the dashboard's Crawlers section. Signing in to `/admin` marks that browser to be excluded from tracking.

Pages Function secrets (set with `npx wrangler pages secret put <NAME> --project-name stevenwilssens`, then redeploy):

| Secret | Purpose |
|---|---|
| `ADMIN_TOKEN` | Password for `/admin` and `/api/stats` |
| `HASH_SALT` | Secret salt for the daily visitor hash |
| `MCP_OWNER_KEY` | The key to the private MCP server at `/mcp/<MCP_OWNER_KEY>`; shown on `/admin` |
| `GITHUB_TOKEN` | Lets the MCP server start the Site update workflow and read runs and pull requests (fine-grained token: Actions write, Contents read, Pull requests write) |
| `GITHUB_REPO` | Optional; defaults to `stewils/stevenwilssens.com` |

Repository Actions secrets (GitHub → Settings → Secrets and variables → Actions): `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` for Claude Code in the Site update workflow, and `MAIL_APP_PASSWORD`, a Zoho app password for steven@wilssens.com, so the workflows can email Steven when a pull request carries an updated resume (`scripts/send-mail.py`, from the Site update workflow) and when a deploy to `main` changed the resume PDF or `src/resume.ts` (from the Deploy workflow). Without the password the steps print a notice and the workflows still pass. A mailbox in Zoho's EU data centre needs the repository variable `MAIL_SMTP_HOST=smtp.zoho.eu`.

Schema changes: add a numbered file to `migrations/`, then apply it to production **before** deploying code that uses it:

```sh
npm run db:migrate
```

Ad-hoc queries:

```sh
npx wrangler d1 execute stevenwilssens-analytics --remote --command "SELECT path, COUNT(*) FROM events WHERE type = 'pageview' GROUP BY path"
```
