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
| `src/resume.ts` | The résumé data: roles (each with a stable `key`), honors, recommendations, press. Shared with the MCP server |
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

The resume is exported from a resume builder. Replace `public/steven-wilssens-resume-2026.pdf` with the new export (keep the filename, or update `resumeUrl` in `App.tsx`) and push.

## MCP server

`/mcp/<MCP_OWNER_KEY>` is a private [Model Context Protocol](https://modelcontextprotocol.io) server (Streamable HTTP, stateless, JSON responses) for one person: Steven. The link is shown on `/admin`; without the key, `/mcp` is a 404. Added to Claude (Settings → Connectors → Add custom connector) or Claude Code (`claude mcp add --transport http my-career <link>`), it is a workspace for talking through his career that builds on what is already there:

- **What is published**: `about_steven`, `read_site_page` (the Markdown copies of the site's pages that the build writes, including the Building wilssens.com write-up, read through the `ASSETS` binding), `get_role`, `get_recommendations`, `get_patents_and_press`, `get_resume` (the entries in `src/resume.ts`).
- **The dossier** (`dossier` table): facts and stories Steven records, one per entry, with a role key, topic, visibility and tags. `interview_status` shows which roles and topics are still empty and suggests questions; `save_entry`, `update_entry`, `delete_entry`, `list_entries`, `search_dossier`, `export_dossier` manage it. Entries are private by default; `public` means a recruiter-facing assistant on the site may use them later (that assistant is not built yet; it will work like the help assistant on wilssens.com: a server-side Claude call with the public dossier as a cached system prompt, never this MCP).
- **The résumé** (`resume_proposals` table): at the end of a session Claude compares the dossier with `get_resume` and calls `propose_resume_change` for each concrete edit (exact current text, proposed text, why). Steven approves or rejects in the conversation (`review_resume_proposal`); `/admin` and `list_resume_proposals` show what is approved or waiting. Approved changes are applied by hand to `src/resume.ts` and the PDF, then marked `applied`.

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

Schema changes: add a numbered file to `migrations/`, then apply it to production **before** deploying code that uses it:

```sh
npm run db:migrate
```

Ad-hoc queries:

```sh
npx wrangler d1 execute stevenwilssens-analytics --remote --command "SELECT path, COUNT(*) FROM events WHERE type = 'pageview' GROUP BY path"
```
