// Screenshots for the designer's sign-off: the pages a change touches, at desktop and
// phone width, in the light and the dark theme, full page. The designer reads the PNGs
// (and those of main, with --out to another folder) and compares them.
//
//   npm run build && node scripts/screenshots.mjs home experience admin#resume
//   node scripts/screenshots.mjs --slices home        (also screen-sized slices, phone at 2x)
//   node scripts/screenshots.mjs --base https://<branch>.stevenwilssens.pages.dev --token <t> --out shots/branch home
//
// Without --base it serves dist with wrangler on --port for the run (like
// scripts/site-check.mjs) and stops it afterwards; it refuses a port that is already in
// use, so it never photographs a stale server. The admin needs the local D1 migrated
// once: npx wrangler d1 migrations apply stevenwilssens-analytics --local.
// The theme is the site's own choice in localStorage (sw-theme, sw-admin-theme), not the
// browser's colour scheme; a light shot identical to its dark one fails the run.
// Admin pages (/admin…) need a token: --token, or for a local server ADMIN_TOKEN or
// .dev.vars (never sent to another host). A shot of the admin sign-in card fails the run.
// Writes <out>/<page>-<desktop|phone>-<light|dark>.png, with --slices also
// <page>-<viewport>-<theme>-<n>.png per screen height; default out is screenshots/ (ignored by git).
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'

const { values: options, positionals } = parseArgs({ allowPositionals: true, options: {
  base: { type: 'string' },
  token: { type: 'string' },
  out: { type: 'string', default: 'screenshots' },
  port: { type: 'string', default: '8789' },
  slices: { type: 'boolean', default: false },
} })
// Without the leading slash too (experience, admin#resume): Git Bash rewrites /experience into a Windows path.
const paths = (positionals.length ? positionals : ['/']).map((path) => path === 'home' ? '/' : path.startsWith('/') ? path : `/${path}`)
const viewports = [{ name: 'desktop', width: 1440, height: 900, scale: 1 }, { name: 'phone', width: 390, height: 844, scale: options.slices ? 2 : 1 }]

const base = options.base ?? `http://127.0.0.1:${options.port}`
const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)
const devVars = existsSync('.dev.vars') ? Object.fromEntries(readFileSync('.dev.vars', 'utf8').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])) : {}
// The implicit token only goes to a local server: a branch preview runs that branch's code.
const token = options.token ?? (local ? process.env.ADMIN_TOKEN ?? devVars.ADMIN_TOKEN : undefined) ?? ''
if (!token && paths.some((path) => path.startsWith('/admin'))) {
  throw new Error(local ? 'Admin pages need a token: pass --token, set ADMIN_TOKEN or put it in .dev.vars' : `Admin pages on ${base} need --token (the local token is only used for a local server)`)
}

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

const launch = async () => {
  let last
  for (const channel of [process.env.SITE_CHECK_BROWSER, 'msedge', 'chrome', undefined]) {
    try { return await chromium.launch({ ...(channel ? { channel } : {}), args: ['--no-sandbox'] }) } catch (error) { last = error }
  }
  throw last
}

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
        const height = await page.evaluate(() => document.documentElement.scrollHeight)
        for (let y = 0, n = 1; y < height; y += viewport.height, n++) {
          const slice = join(options.out, `${name}-${scheme}-${n}.png`)
          await page.screenshot({ path: slice, fullPage: true, clip: { x: 0, y, width: viewport.width, height: Math.min(viewport.height, height - y) } })
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
} finally {
  await browser?.close()
  stopServer()
}
