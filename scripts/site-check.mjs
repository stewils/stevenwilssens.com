// Checks the built site the way a browser sees it, against web best practices, so a
// redesign cannot ship with a broken layout, an inaccessible control or a page that
// search engines read badly. Every public page and every admin page, at desktop and
// phone width:
//
//   - layout: no horizontal page scroll; on the admin exactly one scroll container
//     (the page pane) and a window that does not scroll
//   - no errors in the console, no failed requests to the site itself
//   - head: title, description, canonical, Open Graph, the page language, one h1
//   - accessibility: axe-core (WCAG 2.1 AA and its best practices); serious and
//     critical violations fail, the rest are reported
//   - Lighthouse on a sample of public pages, desktop and mobile: accessibility,
//     best practices and SEO must score 90 or more; performance is reported
//
//   npm run build && npm run check:site          (starts wrangler pages dev itself)
//   node scripts/site-check.mjs --base http://localhost:8788 --token <admin token> [--lighthouse all|sample|none] [--json out.json] [--summary file.md]
//
// The admin token comes from --token, ADMIN_TOKEN, or .dev.vars. Exit code 1 when a
// check fails. The Deploy workflow runs this after the build and before the deploy.
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import { routes } from '../src/pageMeta.ts'

const require = createRequire(import.meta.url)
const { values: options } = parseArgs({ options: {
  base: { type: 'string' },
  token: { type: 'string' },
  lighthouse: { type: 'string', default: 'sample' },
  json: { type: 'string' },
  summary: { type: 'string' },
  port: { type: 'string', default: '8788' },
} })

const viewports = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]
const publicPages = ['/', ...routes.map((route) => `/${route}`)]
const lighthouseSample = ['/', '/experience', '/about']
const minScore = { accessibility: 90, 'best-practices': 90, seo: 90 }

const readDevVars = () => {
  if (!existsSync('.dev.vars')) return {}
  return Object.fromEntries(readFileSync('.dev.vars', 'utf8').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)] }))
}
const token = options.token ?? process.env.ADMIN_TOKEN ?? readDevVars().ADMIN_TOKEN ?? ''

// --- the site: given, or served from dist by wrangler for the duration of the run
let server = null
const waitFor = async (url, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    try { const response = await fetch(url); if (response.ok) return } catch { /* not up yet */ }
    await new Promise((done) => setTimeout(done, 1000))
  }
  throw new Error(`${url} did not come up`)
}
const base = options.base ?? `http://127.0.0.1:${options.port}`
if (!options.base) {
  if (!existsSync('dist/index.html')) throw new Error('No dist/: run npm run build first')
  server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'pages', 'dev', 'dist', '--port', options.port], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
  await waitFor(`${base}/`)
}

const launch = async (args = []) => {
  let last
  for (const channel of [process.env.SITE_CHECK_BROWSER, 'msedge', 'chrome', undefined]) {
    if (channel === undefined && last === undefined && process.env.SITE_CHECK_BROWSER) continue
    try { return await chromium.launch({ ...(channel ? { channel } : {}), args }) } catch (error) { last = error }
  }
  throw last
}

// --- findings: { level: 'fail' | 'warn', page, viewport, check, message }
const findings = []
const fail = (page, viewport, check, message) => findings.push({ level: 'fail', page, viewport, check, message })
const warn = (page, viewport, check, message) => findings.push({ level: 'warn', page, viewport, check, message })
const scores = []

const debugPort = 9222 + Math.floor(Math.random() * 500)
const browser = await launch(['--no-sandbox', `--remote-debugging-port=${debugPort}`])
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

async function checkPage(context, path, viewport, { admin }) {
  const page = await context.newPage()
  const consoleErrors = []
  const failed = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('response', (response) => { if (response.url().startsWith(base) && response.status() >= 400) failed.push(`${response.status()} ${response.url().slice(base.length)}`) })
  const url = `${base}${path}`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  if (consoleErrors.length) fail(path, viewport.name, 'console', consoleErrors.slice(0, 3).join(' | '))
  if (failed.length) fail(path, viewport.name, 'requests', failed.slice(0, 3).join(', '))

  const layout = await page.evaluate(() => {
    const doc = document.documentElement
    const scrollers = [...document.querySelectorAll('*')].filter((el) => { const overflow = getComputedStyle(el).overflowY; return (overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 1 }).map((el) => ({ id: el.id, name: el.className ? `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}` : el.tagName.toLowerCase() }))
    const windowScrolls = doc.scrollHeight > doc.clientHeight + 1 && getComputedStyle(document.body).overflowY !== 'hidden'
    return { horizontal: doc.scrollWidth > doc.clientWidth + 1, scrollers, windowScrolls, h1: document.querySelectorAll('h1').length }
  })
  if (layout.horizontal) fail(path, viewport.name, 'layout', 'the page scrolls sideways')
  if (admin) {
    const nested = layout.scrollers.filter((scroller) => scroller.id !== 'scroller')
    if (nested.length) fail(path, viewport.name, 'layout', `scroll containers besides the page pane: ${nested.map((scroller) => scroller.name).join(', ')}`)
    if (layout.windowScrolls) fail(path, viewport.name, 'layout', 'the window scrolls behind the dashboard')
  }
  if (layout.h1 !== 1) fail(path, viewport.name, 'headings', `${layout.h1} h1 elements; a page has one`)

  if (!admin && viewport.name === 'desktop') {
    const head = await page.evaluate(() => {
      const meta = (selector) => document.querySelector(selector)?.getAttribute('content') ?? ''
      return { title: document.title, description: meta('meta[name="description"]'), canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '', ogTitle: meta('meta[property="og:title"]'), ogImage: meta('meta[property="og:image"]'), lang: document.documentElement.lang, viewport: meta('meta[name="viewport"]') }
    })
    if (!head.title) fail(path, viewport.name, 'head', 'no <title>')
    if (head.title.length > 70) warn(path, viewport.name, 'head', `title is ${head.title.length} characters; search engines cut it around 60`)
    if (!head.description) fail(path, viewport.name, 'head', 'no meta description')
    else if (head.description.length > 160) warn(path, viewport.name, 'head', `description is ${head.description.length} characters; search engines cut it around 155`)
    if (!head.canonical) fail(path, viewport.name, 'head', 'no canonical link')
    if (!head.ogTitle || !head.ogImage) fail(path, viewport.name, 'head', 'Open Graph title or image missing')
    if (!head.lang) fail(path, viewport.name, 'head', 'no lang attribute on <html>')
    if (!/width=device-width/.test(head.viewport)) fail(path, viewport.name, 'head', 'no responsive viewport meta')
  }

  // Evaluated rather than injected as a tag: the site's content security policy rightly blocks inline scripts.
  await page.evaluate(axeSource)
  const axe = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })
    return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length, example: violation.nodes[0]?.target?.join(' ') ?? '' }))
  })
  for (const violation of axe) {
    const message = `${violation.id} (${violation.impact}): ${violation.help}; ${violation.nodes} element${violation.nodes === 1 ? '' : 's'}, e.g. ${violation.example}`
    if (violation.impact === 'critical' || violation.impact === 'serious') fail(path, viewport.name, 'axe', message)
    else warn(path, viewport.name, 'axe', message)
  }
  await page.close()
  return { console: consoleErrors.length, failed: failed.length, axe: axe.length }
}

// Every public page, then every admin page the menu lists, at both widths.
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
  for (const path of publicPages) {
    const result = await checkPage(context, path, viewport, { admin: false })
    console.log(`${viewport.name.padEnd(7)} ${path.padEnd(24)} console ${result.console} · failed requests ${result.failed} · axe ${result.axe}`)
  }
  await context.close()

  if (!token) { warn('/admin', viewport.name, 'admin', 'no admin token (pass --token, set ADMIN_TOKEN, or put it in .dev.vars); the admin pages were not checked'); continue }
  const adminContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
  await adminContext.addInitScript((value) => { localStorage.setItem('sw-admin-token', value); localStorage.setItem('sw-analytics-ignore', '1') }, token)
  const probe = await adminContext.newPage()
  await probe.goto(`${base}/admin`, { waitUntil: 'networkidle' })
  const adminPages = await probe.evaluate(() => [...document.querySelectorAll('.tabs a[href^="#"]')].map((a) => a.getAttribute('href')))
  await probe.close()
  if (adminPages.length === 0) fail('/admin', viewport.name, 'admin', 'the dashboard did not open with the token; is ADMIN_TOKEN the same in .dev.vars?')
  for (const hash of adminPages) {
    const result = await checkPage(adminContext, `/admin${hash}`, viewport, { admin: true })
    console.log(`${viewport.name.padEnd(7)} ${`/admin${hash}`.padEnd(24)} console ${result.console} · failed requests ${result.failed} · axe ${result.axe}`)
  }
  await adminContext.close()
}

// --- Lighthouse: the categories Google rates, on a sample of public pages
if (options.lighthouse !== 'none') {
  const { default: lighthouse } = await import('lighthouse')
  const { default: desktopConfig } = await import('lighthouse/core/config/desktop-config.js')
  const pages = options.lighthouse === 'all' ? publicPages : lighthouseSample
  for (const path of pages) {
    for (const formFactor of ['desktop', 'mobile']) {
      const result = await lighthouse(`${base}${path}`, { port: debugPort, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] }, formFactor === 'desktop' ? desktopConfig : undefined)
      const categories = Object.fromEntries(Object.entries(result.lhr.categories).map(([key, category]) => [key, Math.round((category.score ?? 0) * 100)]))
      scores.push({ page: path, formFactor, ...categories })
      console.log(`lighthouse ${formFactor.padEnd(7)} ${path.padEnd(16)} performance ${categories.performance} · accessibility ${categories.accessibility} · best practices ${categories['best-practices']} · seo ${categories.seo}`)
      const failing = Object.values(result.lhr.audits).filter((audit) => audit.score !== null && audit.score < 0.5 && audit.scoreDisplayMode === 'binary').map((audit) => audit.title)
      for (const [key, minimum] of Object.entries(minScore)) if (categories[key] < minimum) fail(path, formFactor, 'lighthouse', `${key} scored ${categories[key]}, below ${minimum}: ${failing.slice(0, 4).join('; ')}`)
      if (categories.performance < 80) warn(path, formFactor, 'lighthouse', `performance scored ${categories.performance}: ${failing.slice(0, 4).join('; ')}`)
    }
  }
}

await browser.close()
if (server) server.kill()

// --- the verdict, on the console, as JSON and as a Markdown summary for the run
const fails = findings.filter((finding) => finding.level === 'fail')
const warns = findings.filter((finding) => finding.level === 'warn')
console.log('')
for (const finding of findings) console.log(`  [${finding.level}] ${finding.page} (${finding.viewport}) ${finding.check}: ${finding.message}`)
console.log(`\n${fails.length ? `${fails.length} check${fails.length === 1 ? '' : 's'} failed` : 'Every check passed'}${warns.length ? `, ${warns.length} warning${warns.length === 1 ? '' : 's'}` : ''}.`)

if (options.json) writeFileSync(resolve(options.json), JSON.stringify({ checkedAt: new Date().toISOString(), base, findings, lighthouse: scores }, null, 2))
if (options.summary) {
  const lines = [`### Site checks: ${fails.length ? `${fails.length} failed` : 'passed'}${warns.length ? `, ${warns.length} warnings` : ''}`, '']
  if (scores.length) lines.push('| Page | Form factor | Performance | Accessibility | Best practices | SEO |', '|---|---|---|---|---|---|', ...scores.map((row) => `| ${row.page} | ${row.formFactor} | ${row.performance} | ${row.accessibility} | ${row['best-practices']} | ${row.seo} |`), '')
  for (const finding of findings) lines.push(`- ${finding.level === 'fail' ? '❌' : '⚠️'} \`${finding.page}\` (${finding.viewport}) ${finding.check}: ${finding.message}`)
  appendFileSync(resolve(options.summary), lines.join('\n') + '\n')
}
if (process.env.GITHUB_ACTIONS) for (const finding of fails) console.log(`::error title=Site check failed::${finding.page} (${finding.viewport}) ${finding.check}: ${finding.message}`)
process.exitCode = fails.length ? 1 : 0
