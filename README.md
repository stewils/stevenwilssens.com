# steven.wilssens.com

Personal resume site for Steven Wilssens: a React + TypeScript + Vite single-page app hosted on Cloudflare Pages, with first-party, cookie-free analytics stored in Cloudflare D1.

- **Site:** https://steven.wilssens.com (also served at https://stevenwilssens.pages.dev)
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
| `src/resume.ts` | The résumé data: roles (each with a stable `key`), honors, recommendations, press. Shared with the MCP server |
| `src/pageMeta.ts` | Routes plus each page's title and description |
| `src/analytics.ts` | Browser tracker: pageviews, time on page, scroll depth, clicks, Core Web Vitals |
| `src/admin/` | The `/admin` analytics dashboard (separate Vite entry, `admin.html`) |
| `functions/api/collect.ts` | `POST /api/collect`: validates events, adds location/network/device, writes to D1 |
| `functions/api/stats.ts` | `GET /api/stats?days=30&tz=<minutes>`: dashboard data, requires `Authorization: Bearer <ADMIN_TOKEN>` |
| `functions/api/mcp.ts` | `GET /api/mcp`: the MCP links, dossier counts, recent questions, messages and résumé proposals for the dashboard (admin token) |
| `functions/mcp.ts`, `functions/mcp/[[path]].ts` | `/mcp` and `/mcp/<owner key>`: the MCP server, implemented in `functions/_lib/mcp/` |
| `migrations/` | D1 schema migrations |
| `public/` | Static files, including the resume PDF and the 1200×630 `og-image.png` |
| `vite.config.ts` | Also generates one HTML file per route with its own metadata, plus `404.html`, `sitemap.xml`, and `robots.txt` |
| `scripts/prerender.mjs` | Fills each page's HTML with its content, and writes a Markdown copy of each page (`/about.md`, …) plus `llms.txt` and `llms-full.txt` for LLMs |

### Adding a page

Add the route to `routes` and its title/description to `pageMeta` in `src/pageMeta.ts`, then render it in `App.tsx`. The build creates the static HTML file and sitemap entry automatically.

### Updating the resume

The resume is exported from a resume builder. Replace `public/steven-wilssens-resume-2026.pdf` with the new export (keep the filename, or update `resumeUrl` in `App.tsx`) and push.

## MCP server

`https://steven.wilssens.com/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server (Streamable HTTP, stateless, JSON responses, no sign-in). A recruiter adds it to Claude (Settings → Connectors → Add custom connector) or Claude Code (`claude mcp add --transport http steven-wilssens https://steven.wilssens.com/mcp`) and asks anything about Steven's work. The answers come from two places:

- `src/resume.ts` and `src/patents.ts`: the roles, honors, recommendations, patents and press, exactly as on the site.
- The **dossier**: facts and stories Steven records in interview sessions, stored in the `dossier` table. Only entries marked `public` are served to recruiters.

The same URL with the owner key in the path, `/mcp/<MCP_OWNER_KEY>` (shown on `/admin`), unlocks the owner tools. Adding that link to Claude and asking it to interview you runs the interview: `interview_status` shows which roles and topics are still empty, `save_entry` stores each answer (private by default), and at the end of a session `get_resume` plus `propose_resume_change` turn the new material into concrete résumé edits that you approve or reject in the conversation (`review_resume_proposal`). Approved proposals are listed on `/admin` and by `list_resume_proposals`; apply them by hand to `src/resume.ts` and the PDF, then mark them `applied`.

Every public tool call is logged in `dossier_questions` (tool, query, hit count, country, network; no IP), and `leave_message` stores notes from recruiters in `dossier_messages`. Both show on `/admin` and through the owner tool `recent_activity`. Public connections are limited to 120 calls and 5 messages an hour. A `GET /mcp` in a browser shows a short explanation page.

Local run: add `MCP_OWNER_KEY=<anything>` to `.dev.vars`, apply the migrations locally, then `npm run build && npx wrangler pages dev`. Tests: `functions/_lib/mcp/server.test.ts`.

## Deployment

Pushing to `main` runs lint, tests, and the build in GitHub Actions (`.github/workflows/deploy.yml`) and deploys to the `stevenwilssens` Cloudflare Pages project. Pull requests run the checks without deploying.

- The workflow needs the `CLOUDFLARE_API_TOKEN` repository secret (Cloudflare "Edit Cloudflare Workers" token template).
- Manual deploy: `npm run deploy` (requires `wrangler login`).
- `steven.wilssens.com` is a Pages custom domain. DNS for `wilssens.com` is at GoDaddy, with a `CNAME steven → stevenwilssens.pages.dev` record.
- Unknown paths return `404.html` with a 404 status.

## Analytics

Events are stored in the `stevenwilssens-analytics` D1 database (binding `DB`, see `wrangler.jsonc`). No cookies are used; a visitor is a SHA-256 hash of IP + user agent + `HASH_SALT` + the date, so visitors cannot be followed across days. Obvious bots are dropped from visitor stats; instead, `functions/_middleware.ts` records requests from search engines, AI crawlers and other bots in the `crawls` table (bot name, path, status, country, network; no IP), shown in the dashboard's Crawlers section. Signing in to `/admin` marks that browser to be excluded from tracking.

Pages Function secrets (set with `npx wrangler pages secret put <NAME> --project-name stevenwilssens`, then redeploy):

| Secret | Purpose |
|---|---|
| `ADMIN_TOKEN` | Password for `/admin` and `/api/stats` |
| `HASH_SALT` | Secret salt for the daily visitor hash |
| `MCP_OWNER_KEY` | Unlocks the owner (interview) tools of the MCP server at `/mcp/<MCP_OWNER_KEY>`; shown on `/admin` |

Schema changes: add a numbered file to `migrations/`, then apply it to production **before** deploying code that uses it:

```sh
npm run db:migrate
```

Ad-hoc queries:

```sh
npx wrangler d1 execute stevenwilssens-analytics --remote --command "SELECT path, COUNT(*) FROM events WHERE type = 'pageview' GROUP BY path"
```
