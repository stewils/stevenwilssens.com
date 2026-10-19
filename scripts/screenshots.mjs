// Screenshots for the designer's sign-off: the pages a change touches, at desktop and
// phone width, in the light and the dark theme, full page. The designer reads the PNGs
// (and those of main, with --out to another folder) and compares them.
//
//   npm run build && node scripts/screenshots.mjs home experience admin#resume
//   node scripts/screenshots.mjs --base https://<branch>.stevenwilssens.pages.dev --out shots/branch home
//
// Without --base it serves dist with wrangler for the run (like scripts/site-check.mjs).
// Admin pages (/admin…) use the token from --token, ADMIN_TOKEN or .dev.vars. Writes
// <out>/<page>-<desktop|phone>-<light|dark>.png; default out is screenshots/ (ignored by git).
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'

const { values: options, positionals } = parseArgs({ allowPositionals: true, options: {
  base: { type: 'string' },
  token: { type: 'string' },
  out: { type: 'string', default: 'screenshots' },
  port: { type: 'string', default: '8789' },
} })
// Without the leading slash too (experience, admin#resume): Git Bash rewrites /experience into a Windows path.
const paths = (positionals.length ? positionals : ['/']).map((path) => path === 'home' ? '/' : path.startsWith('/') ? path : `/${path}`)
const viewports = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]

const devVars = existsSync('.dev.vars') ? Object.fromEntries(readFileSync('.dev.vars', 'utf8').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])) : {}
const token = options.token ?? process.env.ADMIN_TOKEN ?? devVars.ADMIN_TOKEN ?? ''

let server = null
const base = options.base ?? `http://127.0.0.1:${options.port}`
if (!options.base) {
  if (!existsSync('dist/index.html')) throw new Error('No dist/: run npm run build first')
  server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'pages', 'dev', 'dist', '--port', options.port], { stdio: 'ignore', shell: process.platform === 'win32' })
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/`)).ok) break } catch { /* not up yet */ }
    if (i > 60) throw new Error(`${base} did not come up`)
    await new Promise((done) => setTimeout(done, 1000))
  }
}

const launch = async () => {
  let last
  for (const channel of [process.env.SITE_CHECK_BROWSER, 'msedge', 'chrome', undefined]) {
    try { return await chromium.launch({ ...(channel ? { channel } : {}), args: ['--no-sandbox'] }) } catch (error) { last = error }
  }
  throw last
}

mkdirSync(options.out, { recursive: true })
const browser = await launch()
try {
  for (const viewport of viewports) for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme, reducedMotion: 'reduce' })
    await context.addInitScript((value) => { localStorage.setItem('sw-analytics-ignore', '1'); if (value) localStorage.setItem('sw-admin-token', value) }, token)
    const page = await context.newPage()
    for (const path of paths) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch(() => {})
      await page.waitForTimeout(400)
      const name = (path.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-') || 'home').replace(/-$/, '')
      const file = join(options.out, `${name}-${viewport.name}-${colorScheme}.png`)
      await page.screenshot({ path: file, fullPage: true })
      console.log(file)
    }
    await context.close()
  }
} finally {
  await browser.close()
  server?.kill()
}
