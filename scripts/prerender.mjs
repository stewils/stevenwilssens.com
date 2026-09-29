// Fills each built page's <div id="root"> with its rendered content, so search
// engines and link previews that do not run JavaScript still see the full page.
// Runs after `vite build` (client) and `vite build --ssr src/entry-server.tsx --outDir dist-ssr`.
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const dist = resolve('dist')
const ssrDir = resolve('dist-ssr')
const { render } = await import(pathToFileURL(resolve(ssrDir, 'entry-server.js')).href)

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
