// Sets each sitemap <lastmod> to the date the page's content last changed, rather than
// the build date. Compares every built page with the live one: unchanged pages keep the
// date from the live sitemap, changed or new pages get today. Google ignores lastmod on
// sites where it moves on every deploy, and IndexNow (scripts/indexnow.mjs) submits only
// the pages dated today. Runs after scripts/prerender.mjs.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve('dist')
const sitemapPath = resolve(dist, 'sitemap.xml')
const today = new Date().toISOString().slice(0, 10)

// Cloudflare's email obfuscation rewrites addresses in the live pages: the hex string
// is a key byte followed by the address, each byte XORed with the key.
const decodeEmail = (hex) => {
  const bytes = hex.match(/../g).map((pair) => parseInt(pair, 16))
  return String.fromCharCode(...bytes.slice(1).map((byte) => byte ^ bytes[0]))
}
const undoEmailProtection = (html) => html
  .replace(/<(a|span) [^>]*data-cfemail="([0-9a-f]+)"[^>]*>[^<]*<\/\1>/g, (_, tag, hex) => decodeEmail(hex))
  .replace(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/g, (_, hex) => `mailto:${decodeEmail(hex)}`)

// What a reader or crawler sees: title, description, structured data and page body.
// Leaves out script and stylesheet links, whose file names change with every code change.
const fingerprint = (source) => {
  const html = undoEmailProtection(source)
  const parts = [
    html.match(/<title>[^<]*<\/title>/)?.[0],
    html.match(/<meta name="description"[^>]*>/)?.[0],
    html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/)?.[0],
    html.slice(html.indexOf('<div id="root">'), html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, ''),
  ]
  return createHash('sha256').update(parts.join('\n').replace(/\s+/g, ' ')).digest('hex')
}

const fetchText = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  return response.ok ? response.text() : null
}

const sitemap = readFileSync(sitemapPath, 'utf8')
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
const liveSitemap = await fetchText(new URL('/sitemap.xml', urls[0]).href).catch(() => null)
const liveDates = new Map([...(liveSitemap ?? '').matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((match) => [match[1], match[2]]))

let changed = 0
const dates = await Promise.all(urls.map(async (url) => {
  const path = new URL(url).pathname
  const file = resolve(dist, path === '/' ? 'index.html' : `${path.slice(1)}.html`)
  const live = await fetchText(url).catch(() => null)
  if (live && liveDates.has(url) && fingerprint(live) === fingerprint(readFileSync(file, 'utf8'))) return liveDates.get(url)
  changed++
  return today
}))

let index = 0
writeFileSync(sitemapPath, sitemap.replace(/(<loc>[^<]+<\/loc>)<lastmod>[^<]*<\/lastmod>/g, (_, loc) => `${loc}<lastmod>${dates[index++]}</lastmod>`))
console.log(`Sitemap: ${changed} of ${urls.length} pages changed${liveSitemap ? '' : ' (live sitemap unavailable, dated all pages today)'}`)
