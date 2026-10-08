// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver, …) which pages changed in
// this deploy: the ones scripts/lastmod.mjs dated today. Runs after each production deploy.
import { readFileSync } from 'node:fs'

const key = '0b29f322c0bdc0189e374361135bd650'
const host = 'steven.wilssens.com'

const sitemap = readFileSync('dist/sitemap.xml', 'utf8')
const today = new Date().toISOString().slice(0, 10)
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].filter((match) => match[2] === today).map((match) => match[1])
if (urlList.length === 0) {
  console.log('IndexNow: no pages changed')
  process.exit(0)
}

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList }),
})
console.log(`IndexNow: ${response.status} ${response.statusText} for ${urlList.length} URLs`)
if (!response.ok && response.status !== 202) process.exitCode = 1
