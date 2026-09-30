import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { pageMeta, personJsonLd, routes, siteUrl, type Page } from './src/pageMeta.ts'

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Writes one HTML file per route (plus 404.html, sitemap.xml, robots.txt and _headers) so
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

      // Security and caching headers for Cloudflare Pages. The content security policy
      // allows the small inline scripts in <head> (theme, row reveal) by hash only.
      const inlineScripts = new Set(readdirSync(outDir).filter((file) => file.endsWith('.html')).flatMap((file) => readFileSync(resolve(outDir, file), 'utf8').split('<script>').slice(1).map((part) => part.slice(0, part.indexOf('</script>')))))
      const scriptHashes = [...inlineScripts].map((code) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`)
      const csp = [
        "default-src 'self'",
        `script-src 'self' ${scriptHashes.join(' ')}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join('; ')
      const headers = [
        '/*',
        '  Strict-Transport-Security: max-age=31536000',
        '  X-Frame-Options: DENY',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
        `  Content-Security-Policy: ${csp}`,
        '',
        '# Vite fingerprints these file names, so they never change.',
        '/assets/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '',
      ]
      writeFileSync(resolve(outDir, '_headers'), headers.join('\n'))
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
