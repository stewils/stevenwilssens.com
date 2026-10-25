-- Drafts only Steven reads, in /admin → Links → Drafts (#links?read=<slug>). The text lives here and
-- not in the repository (which is public) or the admin bundle (which anyone can download): only
-- GET /api/drafts, with the admin token, serves it. Rows are written with wrangler d1 execute.
-- body is Markdown: ## and ### headings, paragraphs, - lists, > quotes, ``` blocks, **bold**, `code`
-- and [links](https://…), read by src/admin/markdown.tsx.
CREATE TABLE IF NOT EXISTS admin_drafts (
  slug TEXT PRIMARY KEY CHECK (slug GLOB '[a-z0-9]*' AND length(slug) <= 80),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
