// Renders public/og-image.png, the 1200×630 picture link previews show, from the
// same profile data as the site. Run it after changing the headline or the photo:
//   node scripts/og-image.mjs
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { profile } from '../src/resume.ts'

const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
// Inlined: a page set with setContent() has no origin, so file:// URLs would not load.
const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(resolve('node_modules', pkg, 'files', file)).toString('base64')}`
const photo = `data:image/jpeg;base64,${readFileSync(resolve('public/profile.jpg')).toString('base64')}`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Manrope'; font-weight: 200 800; src: url('${font('@fontsource-variable/manrope', 'manrope-latin-wght-normal.woff2')}') format('woff2'); }
@font-face { font-family: 'DM Mono'; font-weight: 500; src: url('${font('@fontsource/dm-mono', 'dm-mono-latin-500-normal.woff2')}') format('woff2'); }
html, body { margin: 0; }
body { width: 1200px; height: 630px; display: grid; grid-template-columns: 420px 1fr; align-items: center; background: #f4f6f1; color: #172121; font-family: 'Manrope', sans-serif; overflow: hidden; position: relative; }
body::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 22px; background: #0f4a38; }
.photo { justify-self: center; width: 280px; height: 280px; border-radius: 50%; border: 8px solid #dbeae5; object-fit: cover; box-shadow: 0 18px 50px rgba(15, 74, 56, .18); }
.copy { padding-right: 70px; }
.kicker { font-family: 'DM Mono', monospace; font-size: 20px; letter-spacing: 2.5px; text-transform: uppercase; color: #096b50; }
h1 { margin: 10px 0 14px; font-size: 76px; font-weight: 800; letter-spacing: -3px; line-height: 1; }
p { margin: 0; font-size: 31px; line-height: 1.3; color: #4f5a59; }
.url { margin-top: 34px; font-size: 26px; font-weight: 700; color: #172121; }
</style></head><body>
<img class="photo" src="${photo}" alt="">
<div class="copy">
  <div class="kicker">${esc(profile.headline.split(' for ')[0])} · ${esc(profile.location)}</div>
  <h1>${esc(profile.name)}</h1>
  <p>Data, experimentation and AI. Formerly leading Windows &amp; Devices Data at Microsoft.</p>
  <div class="url">${esc(profile.site.replace(/^https:\/\//, ''))}</div>
</div>
</body></html>`

const browser = await chromium.launch({ channel: process.env.RESUME_BROWSER_CHANNEL || 'msedge' }).catch(() => chromium.launch())
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: resolve('public/og-image.png'), type: 'png' })
await browser.close()
console.log('Wrote public/og-image.png')
