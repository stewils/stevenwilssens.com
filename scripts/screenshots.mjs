// Screenshots for the designer's sign-off: the pages a change touches, at desktop and
// phone width, in the light and the dark theme, full page. The designer reads the PNGs
// (and those of main, with --out to another folder) and compares them.
//
//   npm run build && node scripts/screenshots.mjs home experience admin#resume
//   node scripts/screenshots.mjs --slices home        (also screen-sized slices, phone at 2x)
//   node scripts/screenshots.mjs --base https://<branch>.stevenwilssens.pages.dev --token <t> --out shots/branch home
//
// Without --base it serves dist with wrangler on --port for the run (like
// scripts/site-check.mjs) and stops it afterwards, also on Ctrl-C or SIGTERM; it refuses
// a port that is already in use, so it never photographs a stale server. The admin needs
// the local D1 migrated once: npx wrangler d1 migrations apply stevenwilssens-analytics --local.
// The theme is the site's own choice in localStorage (sw-theme, sw-admin-theme), not the
// browser's colour scheme; a light shot identical to its dark one fails the run.
// GET /api/ask answers { ready: true } in the shots, so the "Ask about Steven" button
// shows as on the live site (locally and in CI the model key is missing); questions
// (POST) still reach the server. --slices takes each screen by scrolling to it, so fixed
// and sticky parts (the Ask button, an article's contents bar) sit where a visitor sees them.
// Admin pages (/admin…) need a token: --token, or for a local server ADMIN_TOKEN or
// .dev.vars (never sent to another host; the rules are in scripts/screenshots-options.mjs,
// with tests). A shot of the admin sign-in card fails the run.
// Writes <out>/<page>-<desktop|phone>-<light|dark>.png, with --slices also
// <page>-<viewport>-<theme>-<n>.png per screen height; default out is screenshots/ (ignored by git).
// Errors print one line ("screenshots: …") and exit 1.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import { parseDevVars, resolveOptions } from './screenshots-options.mjs'

const fail = (message) => { console.error(`screenshots: ${message}`); process.exit(1) }

let options, base, paths, token
try {
  const parsed = parseArgs({ allowPositionals: true, options: {
    base: { type: 'string' },
    token: { type: 'string' },
    out: { type: 'string', default: 'screenshots' },
    port: { type: 'string', default: '8789' },
    slices: { type: 'boolean', default: false },
  } })
  options = parsed.values
  const devVars = existsSync('.dev.vars') ? parseDevVars(readFileSync('.dev.vars', 'utf8')) : {}
  ;({ base, paths, token } = resolveOptions({ ...options, positionals: parsed.positionals, env: process.env, devVars }))
} catch (error) {
  fail(error.message)
}
const viewports = [{ name: 'desktop', width: 1440, height: 900, scale: 1 }, { name: 'phone', width: 390, height: 844, scale: options.slices ? 2 : 1 }]

const portInUse = (port) => new Promise((done) => {
  const socket = connect({ host: '127.0.0.1', port: Number(port) })
  socket.once('connect', () => { socket.destroy(); done(true) })
  socket.once('error', () => done(false))
})

let server = null
const stopServer = () => {
  if (!server || server.exitCode !== null) return
  // wrangler starts workerd underneath: stop the whole tree, or it keeps the port.
  if (process.platform === 'win32') {
    try { execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* already gone */ }
  } else {
    try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill() }
  }
}
// `finally` does not run on a signal: stop the server here, or it keeps the port.
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.once(signal, () => { stopServer(); process.exit(code) })

const launch = async () => {
  let last
  for (const channel of [process.env.SITE_CHECK_BROWSER, 'msedge', 'chrome', undefined]) {
    try { return await chromium.launch({ ...(channel ? { channel } : {}), args: ['--no-sandbox'] }) } catch (error) { last = error }
  }
  throw last
}

// The assistant's status says ready, so its button renders; a question (POST) goes to the server as usual.
const askReady = (route) => route.request().method() === 'GET'
  ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ready: true, siteKey: null }) })
  : route.continue()

const shoot = async (browser) => {
  const taken = new Map()
  for (const viewport of viewports) for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.scale, colorScheme: scheme, reducedMotion: 'reduce' })
    await context.addInitScript(({ scheme, token }) => {
      localStorage.setItem('sw-analytics-ignore', '1')
      localStorage.setItem('sw-theme', scheme)
      localStorage.setItem('sw-admin-theme', scheme)
      if (token) localStorage.setItem('sw-admin-token', token)
    }, { scheme, token })
    await context.route((url) => url.pathname === '/api/ask', askReady)
    const page = await context.newPage()
    for (const path of paths) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch(() => {})
      await page.waitForTimeout(400)
      if (path.startsWith('/admin') && await page.locator('input[placeholder="Admin token"]').isVisible()) {
        throw new Error(`${path} shows the admin sign-in card: the token was refused (is it this server's ADMIN_TOKEN?)`)
      }
      const name = `${(path.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-') || 'home').replace(/-$/, '')}-${viewport.name}`
      const file = join(options.out, `${name}-${scheme}.png`)
      const image = await page.screenshot({ fullPage: true })
      writeFileSync(file, image)
      console.log(file)
      const other = taken.get(name)
      if (other && other.equals(image)) throw new Error(`${name}: the light and the dark shot are identical, so the theme did not switch`)
      taken.set(name, image)
      if (options.slices) {
        // One screen at a time, scrolled to as a visitor would: fixed and sticky parts are
        // drawn where they really are. The browser stops the last scroll at the bottom.
        const height = await page.evaluate(() => document.documentElement.scrollHeight)
        for (let y = 0, n = 1; y < height; y += viewport.height, n++) {
          const slice = join(options.out, `${name}-${scheme}-${n}.png`)
          await page.evaluate((top) => new Promise((done) => {
            window.scrollTo({ top, left: 0, behavior: 'instant' })
            requestAnimationFrame(() => requestAnimationFrame(done))
          }), y)
          await page.waitForTimeout(100)
          await page.screenshot({ path: slice })
          console.log(slice)
        }
      }
    }
    await context.close()
  }
}

mkdirSync(options.out, { recursive: true })
let browser = null
try {
  if (!options.base) {
    if (!existsSync('dist/index.html')) throw new Error('No dist/: run npm run build first')
    if (await portInUse(options.port)) throw new Error(`Port ${options.port} is already in use (an earlier server?): stop it or pass --port`)
    // No shell: then the pid is wrangler's own, and stopServer can end it with its children.
    server = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'pages', 'dev', 'dist', '--port', options.port], { stdio: 'ignore', detached: process.platform !== 'win32' })
    for (let i = 0; ; i++) {
      try { if ((await fetch(`${base}/`)).ok) break } catch { /* not up yet */ }
      if (server.exitCode !== null) throw new Error(`wrangler exited with code ${server.exitCode}`)
      if (i > 60) throw new Error(`${base} did not come up`)
      await new Promise((done) => setTimeout(done, 1000))
    }
  }
  browser = await launch()
  await shoot(browser)
} catch (error) {
  console.error(`screenshots: ${error.message}`)
  process.exitCode = 1
} finally {
  await browser?.close()
  stopServer()
}
