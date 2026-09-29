import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { pageMeta, personJsonLd, routes, siteUrl, type Page } from './src/pageMeta.ts'

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Writes one HTML file per route (plus 404.html, sitemap.xml and robots.txt) so
// crawlers and link previews that do not run JavaScript get each page's own metadata.
const staticPages = (): Plugin => {
  let outDir = 'dist'
  let serverBuild = false
  return {
    name: 'static-pages',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); serverBuild = Boolean(config.build.ssr) },
    closeBundle() {
      if (serverBuild) return
      const template = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      const render = (page: Page, path: string) => {
        const { title, description } = pageMeta[page]
        const url = `${siteUrl}${path}`
        let html = template
          .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
          .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*/g, `$1${escapeHtml(description)}`)
          .replace(/(<meta (?:property|name)="(?:og:title|twitter:title)" content=")[^"]*/g, `$1${escapeHtml(title)}`)
          .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
          .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
        if (page === 'notFound') html = html.replace(/<link rel="canonical"[^>]*>\s*/, '').replace('<meta name="viewport"', '<meta name="robots" content="noindex" />\n    <meta name="viewport"')
        return html
      }
      // Structured data about Steven goes on the home page only.
      const jsonLd = `  <script type="application/ld+json">${JSON.stringify(personJsonLd).replace(/</g, '\\u003c')}</script>\n  </head>`
      writeFileSync(resolve(outDir, 'index.html'), render('home', '/').replace('</head>', () => jsonLd))
      for (const route of routes) writeFileSync(resolve(outDir, `${route}.html`), render(route, `/${route}`))
      writeFileSync(resolve(outDir, '404.html'), render('notFound', '/404'))

      const today = new Date().toISOString().slice(0, 10)
      const urls = ['', ...routes].map((route) => `  <url><loc>${siteUrl}/${route}</loc><lastmod>${today}</lastmod></url>`).join('\n')
      writeFileSync(resolve(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
      writeFileSync(resolve(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), staticPages()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', admin: 'admin.html' },
    },
  },
})
