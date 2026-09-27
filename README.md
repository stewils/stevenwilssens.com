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
| `src/pageMeta.ts` | Routes plus each page's title and description |
| `src/analytics.ts` | Browser tracker: pageviews, time on page, scroll depth, clicks, Core Web Vitals |
| `src/admin/` | The `/admin` analytics dashboard (separate Vite entry, `admin.html`) |
| `functions/api/collect.ts` | `POST /api/collect`: validates events, adds location/network/device, writes to D1 |
| `functions/api/stats.ts` | `GET /api/stats?days=30&tz=<minutes>`: dashboard data, requires `Authorization: Bearer <ADMIN_TOKEN>` |
| `migrations/` | D1 schema migrations |
| `public/` | Static files, including the resume PDF and the 1200×630 `og-image.png` |
| `vite.config.ts` | Also generates one HTML file per route with its own metadata, plus `404.html`, `sitemap.xml`, and `robots.txt` |

### Adding a page

Add the route to `routes` and its title/description to `pageMeta` in `src/pageMeta.ts`, then render it in `App.tsx`. The build creates the static HTML file and sitemap entry automatically.

### Updating the resume

Replace `public/steven-wilssens-resume-2026.pdf` (keep the filename, or update `resumeUrl` in `App.tsx`) and push.

## Deployment

Pushing to `main` runs lint, tests, and the build in GitHub Actions (`.github/workflows/deploy.yml`) and deploys to the `stevenwilssens` Cloudflare Pages project. Pull requests run the checks without deploying.

- The workflow needs the `CLOUDFLARE_API_TOKEN` repository secret (Cloudflare "Edit Cloudflare Workers" token template).
- Manual deploy: `npm run deploy` (requires `wrangler login`).
- `steven.wilssens.com` is a Pages custom domain. DNS for `wilssens.com` is at GoDaddy, with a `CNAME steven → stevenwilssens.pages.dev` record.
- Unknown paths return `404.html` with a 404 status.

## Analytics

Events are stored in the `stevenwilssens-analytics` D1 database (binding `DB`, see `wrangler.jsonc`). No cookies are used; a visitor is a SHA-256 hash of IP + user agent + `HASH_SALT` + the date, so visitors cannot be followed across days. Obvious bots are dropped. Signing in to `/admin` marks that browser to be excluded from tracking.

Pages Function secrets (set with `npx wrangler pages secret put <NAME> --project-name stevenwilssens`, then redeploy):

| Secret | Purpose |
|---|---|
| `ADMIN_TOKEN` | Password for `/admin` and `/api/stats` |
| `HASH_SALT` | Secret salt for the daily visitor hash |

Schema changes: add a numbered file to `migrations/`, then apply it to production **before** deploying code that uses it:

```sh
npm run db:migrate
```

Ad-hoc queries:

```sh
npx wrangler d1 execute stevenwilssens-analytics --remote --command "SELECT path, COUNT(*) FROM events WHERE type = 'pageview' GROUP BY path"
```
