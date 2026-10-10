// Fills each built page's <div id="root"> with its rendered content, so search
// engines and link previews that do not run JavaScript still see the full page.
// Also writes a Markdown copy of each page plus llms.txt and llms-full.txt for LLMs.
// Runs after `vite build` (client) and `vite build --ssr src/entry-server.tsx --outDir dist-ssr`.
import { appendFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { htmlToMarkdown } from './markdown.mjs'

const dist = resolve('dist')
const ssrDir = resolve('dist-ssr')
const { render, markdownPath, pageMeta, pagePath, routes, siteUrl } = await import(pathToFileURL(resolve(ssrDir, 'entry-server.js')).href)

const pages = readdirSync(dist).filter((file) => file.endsWith('.html') && file !== 'admin.html')
for (const file of pages) {
  const path = file === 'index.html' ? '/' : `/${file.replace(/\.html$/, '')}`
  const target = resolve(dist, file)
  const html = readFileSync(target, 'utf8')
  if (!html.includes('<div id="root"></div>')) throw new Error(`${file}: no empty root to fill`)
  writeFileSync(target, html.replace('<div id="root"></div>', () => `<div id="root">${render(path)}</div>`))
}
rmSync(ssrDir, { recursive: true, force: true })
console.log(`Prerendered ${pages.length} pages`)

// Markdown copies. Each one names its HTML page as canonical, so search engines index the page, not the copy.
const linked = ['home', ...routes]
const shortTitle = (page) => page === 'home' ? 'Profile' : pageMeta[page].title.replace(/ \| Steven Wilssens$/, '')
const markdown = Object.fromEntries(linked.map((page) => {
  const html = readFileSync(resolve(dist, page === 'home' ? 'index.html' : `${page}.html`), 'utf8')
  return [page, htmlToMarkdown(html, siteUrl)]
}))
const headers = ['', '# Markdown copies of the pages, for LLMs.']
for (const page of linked) {
  writeFileSync(resolve(dist, markdownPath(page).slice(1)), markdown[page])
  headers.push(markdownPath(page), `  Link: <${siteUrl}${pagePath(page)}>; rel="canonical"`, '  Content-Type: text/markdown; charset=utf-8')
}
appendFileSync(resolve(dist, '_headers'), `${headers.join('\n')}\n`)

// llms.txt (https://llmstxt.org): a short guide to the site with links to the Markdown copies.
const resumePath = readFileSync(resolve(dist, 'index.html'), 'utf8').match(/href="(\/[^"]+\.pdf)"/)?.[1]
if (!resumePath) throw new Error('llms.txt: no resume link on the home page')
const entry = (page) => `- [${shortTitle(page)}](${siteUrl}${markdownPath(page)}): ${pageMeta[page].description}`
const llms = [
  '# Steven Wilssens',
  '',
  `> ${pageMeta.home.description}`,
  '',
  `This is Steven Wilssens's personal site at ${siteUrl}/. Each page below is also available as Markdown; ${siteUrl}/llms-full.txt has all of them in one file. Contact: steven@wilssens.com.`,
  '',
  '## Pages',
  '',
  ...linked.filter((page) => page !== 'privacy').map(entry),
  `- [Resume (PDF)](${siteUrl}${resumePath}): Steven Wilssens's full resume.`,
  '',
  '## Optional',
  '',
  entry('privacy'),
  '',
]
writeFileSync(resolve(dist, 'llms.txt'), llms.join('\n'))
writeFileSync(resolve(dist, 'llms-full.txt'), linked.map((page) => `<!-- ${siteUrl}${pagePath(page)} -->\n\n${markdown[page]}`).join('\n\n'))
console.log(`Wrote ${linked.length} Markdown pages, llms.txt and llms-full.txt`)
