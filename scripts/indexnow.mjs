// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver, …) that every page in
// the sitemap may have changed. Runs after each production deploy.
import { readFileSync } from 'node:fs'

const key = '0b29f322c0bdc0189e374361135bd650'
const host = 'steven.wilssens.com'

const sitemap = readFileSync('dist/sitemap.xml', 'utf8')
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList }),
})
console.log(`IndexNow: ${response.status} ${response.statusText} for ${urlList.length} URLs`)
if (!response.ok && response.status !== 202) process.exitCode = 1
