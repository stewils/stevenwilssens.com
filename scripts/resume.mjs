// Builds the resume PDF from src/resume.ts, the same data the site shows, so the two
// never drift. Renders an HTML resume in Chromium (the installed Microsoft Edge, or
// the Playwright Chromium in CI), then runs scripts/resume-check.mjs on the result and
// on the current PDF. The new file only replaces the current one when it scores at
// least as well; --force overrides, --out writes elsewhere, --html keeps the HTML.
//
//   npm run resume:build            (node scripts/resume.mjs)
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import { education, experiences, honors, impact, languages, profile, skills } from '../src/resume.ts'
import { grantedPatents, patentApplications } from '../src/patents.ts'
import { analyzeResume, extractPdf, formatReport, resumePath } from './resume-check.mjs'

const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// Fonts are inlined: a page set with setContent() has no origin, so file:// URLs would not load.
const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(resolve('node_modules', pkg, 'files', file)).toString('base64')}`

// The two most recent roles in full, the Microsoft years before that with their best
// bullets, and the Belgian years in one line each. The resume must fit two pages: the
// build renders the layouts below in order and keeps the first that does, so the two
// latest roles never lose a bullet when the data grows; older roles and type do.
export const layouts = [
  { olderBullets: 2, compact: false },
  { olderBullets: 1, compact: false },
  { olderBullets: 1, compact: true },
  { olderBullets: 0, compact: true },
]
const detailed = experiences.slice(0, 2)
const condensed = experiences.slice(2).filter((item) => item.company === 'Microsoft')
const early = experiences.slice(2).filter((item) => item.company !== 'Microsoft')
const granted = grantedPatents.flatMap((item) => item.records).length
const published = patentApplications.flatMap((item) => item.records).length

const role = (item, points, kind = '') => `<article class="role${kind ? ` ${kind}` : ''}">
  <div class="when">${esc(item.dates)}</div>
  <div>
    <h3>${esc(item.role)}</h3>
    <p class="where">${esc(item.company)} · ${esc(item.location.replace(/^.*· /, ''))}</p>
    <p class="summary">${esc(item.summary)}</p>
    ${points.length ? `<ul>${points.map((point) => `<li>${esc(point)}</li>`).join('')}</ul>` : ''}
  </div>
</article>`

export const resumeHtml = ({ olderBullets = 2, compact = false } = layouts[0]) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(profile.name)} · Resume</title>
<meta name="author" content="${esc(profile.name)}">
<meta name="description" content="${esc(profile.resumeHeadline)}">
<style>
@font-face { font-family: 'Manrope'; font-weight: 200 800; src: url('${font('@fontsource-variable/manrope', 'manrope-latin-wght-normal.woff2')}') format('woff2'); }
@font-face { font-family: 'DM Mono'; font-weight: 400; src: url('${font('@fontsource/dm-mono', 'dm-mono-latin-400-normal.woff2')}') format('woff2'); }
@font-face { font-family: 'DM Mono'; font-weight: 500; src: url('${font('@fontsource/dm-mono', 'dm-mono-latin-500-normal.woff2')}') format('woff2'); }
@page { size: Letter; margin: 0.45in 0.55in 0.42in; }
:root { --ink: #172121; --muted: #5b6765; --green: #096b50; --line: #d9e1dc; --soft: #eef4f0; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: 'Manrope', 'Segoe UI', sans-serif; color: var(--ink); font-size: 9.2pt; line-height: 1.28; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
a { color: inherit; text-decoration: none; }
p, ul { margin: 0; }
/* No letter-spacing on the uppercase labels and headings: PDF parsers (applicant tracking systems) read spaced capitals letter by letter, "E X P E R I E N C E", and lose the section. */
.mono { font-family: 'DM Mono', monospace; font-size: 7.4pt; text-transform: uppercase; color: var(--green); }
header { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: end; padding-bottom: 11px; border-bottom: 2px solid var(--ink); }
header h1 { margin: 0 0 3px; font-size: 25pt; font-weight: 800; letter-spacing: -0.8pt; line-height: 1; }
header .headline { font-size: 11.6pt; font-weight: 700; color: var(--green); letter-spacing: -0.2pt; }
header .contact { text-align: right; font-size: 8.6pt; line-height: 1.55; color: var(--muted); }
header .contact strong { color: var(--ink); font-weight: 600; }
/* The work arrangement wraps inside the width the other contact lines set, rather than widening the column and squeezing the headline. */
header .contact .arrangement { display: block; width: 0; min-width: 100%; }
.facts { display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: 16px; padding: 9px 0 4px; font-size: 9.2pt; line-height: 1.35; }
.facts .mono { display: block; margin-bottom: 2px; }
section { margin-top: 8px; break-inside: auto; }
h2 { display: flex; align-items: center; gap: 10px; margin: 0 0 6px; font-family: 'DM Mono', monospace; font-size: 7.6pt; font-weight: 500; text-transform: uppercase; color: var(--green); }
h2::after { content: ''; flex: 1; height: 1px; background: var(--line); }
.summary-text { font-size: 9.9pt; line-height: 1.45; }
.impact { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.impact div { padding: 6px 9px 7px; background: var(--soft); border-radius: 4px; break-inside: avoid; }
.impact strong { display: block; font-size: 14pt; font-weight: 800; letter-spacing: -0.5pt; color: var(--green); line-height: 1.1; }
.impact span { display: block; margin-top: 2px; font-size: 8pt; line-height: 1.3; color: var(--muted); }
.skills { display: flex; flex-wrap: wrap; gap: 4px 5px; }
.skills span { padding: 2px 7px; border: 1px solid var(--line); border-radius: 999px; font-size: 8.3pt; font-weight: 600; }
.role { display: grid; grid-template-columns: 1.3in 1fr; gap: 12px; padding: 5px 0 5px; border-top: 1px solid var(--line); break-inside: avoid; }
.role:first-of-type { border-top: 0; padding-top: 0; }
/* The two latest roles carry every bullet; one may run over a page break between bullets rather than leave half a page empty. */
.role.detailed { break-inside: auto; }
.role.detailed li { break-inside: avoid; }
.role.detailed .where, .role.detailed .summary { break-after: avoid; }
.when { font-family: 'DM Mono', monospace; font-size: 7.6pt; color: var(--muted); padding-top: 2px; white-space: nowrap; }
h3 { margin: 0; font-size: 10.8pt; font-weight: 700; letter-spacing: -0.2pt; line-height: 1.25; }
.where { margin: 1px 0 4px; font-size: 8.8pt; color: var(--muted); }
.summary { font-size: 9.1pt; }
.role ul { margin: 3px 0 0; padding-left: 13px; }
.role li { margin: 0.5px 0; padding-left: 2px; font-size: 8.8pt; line-height: 1.27; }
.early { display: grid; gap: 5px; }
.early div { display: grid; grid-template-columns: 1.3in 1fr; gap: 12px; font-size: 9.3pt; line-height: 1.35; break-inside: avoid; }
.early strong { font-weight: 700; }
.early .where { display: inline; margin: 0; }
.foot { display: grid; grid-template-columns: 1.15fr 1fr 1.2fr; gap: 18px; font-size: 9pt; line-height: 1.38; }
.foot strong { display: block; font-weight: 700; }
.foot small { color: var(--muted); }
.foot ul { padding-left: 13px; }
.foot li { margin: 1px 0; }
.foot .honors { line-height: 1.45; }
/* The compact layout, used only when the roomier one runs past two pages. */
body.compact { font-size: 9.2pt; line-height: 1.25; }
body.compact section { margin-top: 7px; }
body.compact .summary-text { font-size: 9.5pt; line-height: 1.38; }
body.compact .summary { font-size: 9.1pt; }
body.compact .role { padding: 4px 0 4px; }
body.compact .role li { font-size: 8.7pt; line-height: 1.24; }
body.compact .early div { font-size: 9pt; line-height: 1.3; }
body.compact .foot { font-size: 8.7pt; }
</style></head>
<body class="${compact ? 'compact' : ''}">
<header>
  <div>
    <h1>${esc(profile.name)}</h1>
    <div class="headline">${esc(profile.resumeHeadline)}</div>
  </div>
  <div class="contact">
    <strong>${esc(profile.location)}</strong> · ${esc(profile.workAuthorization)}<br>
    <span class="arrangement">${esc(profile.workArrangement)}</span>
    <a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a> · ${esc(profile.phone)}<br>
    <a href="${esc(profile.linkedin)}">${esc(profile.linkedin.replace(/^https:\/\/www\.|\/$/g, ''))}</a> · <a href="${esc(profile.site)}">${esc(profile.site.replace(/^https:\/\//, ''))}</a><br>
    For AI assistants: <a href="${esc(profile.mcp)}">${esc(profile.mcp.replace(/^https:\/\//, ''))}</a> (read-only MCP)
  </div>
</header>
<div class="facts">
  <div><span class="mono">Looking for</span>${esc(profile.lookingFor)} · ${esc(profile.availability.toLowerCase())}</div>
  <div><span class="mono">Scope</span>Led teams of ${esc(profile.teamSize)}; telemetry from 1.6B+ Windows devices</div>
  <div><span class="mono">Background</span>Product leader since 2008, software engineer and team lead before that</div>
</div>

<section>
  <h2>Summary</h2>
  <p class="summary-text">${esc(profile.summary)}</p>
</section>

<section>
  <h2>Key achievements</h2>
  <div class="impact">${impact.map(({ value, label }) => `<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('')}</div>
</section>

<section>
  <h2>Skills</h2>
  <div class="skills">${skills.map((skill) => `<span>${esc(skill)}</span>`).join('')}</div>
</section>

<section>
  <h2>Experience</h2>
  ${detailed.map((item) => role(item, item.points, 'detailed')).join('')}
  ${condensed.map((item) => role(item, item.points.slice(0, olderBullets))).join('')}
</section>

<section>
  <h2>Earlier career · Belgium</h2>
  <div class="early">${early.map((item) => `<div><span class="when">${esc(item.dates)}</span><p><strong>${esc(item.role)}</strong>, ${esc(item.company)} <span class="where">· ${esc(item.location)}</span><br>${esc(item.summary)}</p></div>`).join('')}</div>
</section>

<section class="foot">
  <div><h2>Education</h2><strong>${esc(education.degree)}</strong>${esc(education.school)} <small>· ${esc(education.dates)}</small><br><br><strong>Languages</strong>${esc(languages)}</div>
  <div><h2>Honors</h2><p class="honors">${honors.map(([title, issued]) => `${esc(title.replace(/^Microsoft /, '').replace(/^Most Valuable Professional \(MVP\)/, 'Microsoft MVP'))} <small>(${esc(issued.replace(/^Issued by Microsoft · (\w+ )?/, ''))})</small>`).join(' · ')}</p></div>
  <div><h2>Patents and press</h2><strong>${granted} granted US patents, ${published} published applications</strong>Spatial audio, streaming, media and device telemetry (Microsoft). Press: Forbes, Windows Central; Build 2016 speaker. <a href="${esc(profile.site)}/patents">${esc(profile.site.replace(/^https:\/\//, ''))}/patents</a></div>
</section>
</body></html>`

const launch = async () => {
  const channel = process.env.RESUME_BROWSER_CHANNEL
  const attempts = channel ? [{ channel }] : [{ channel: 'msedge' }, { channel: 'chrome' }, {}]
  let lastError
  for (const options of attempts) {
    try { return await chromium.launch(options) } catch (error) { lastError = error }
  }
  throw new Error(`No Chromium found. Install Microsoft Edge or run: npx playwright-core install chromium\n${lastError}`)
}

export async function buildResume({ out = resumePath, force = false, html = null } = {}) {
  const dir = resolve(tmpdir(), 'stevenwilssens-resume')
  mkdirSync(dir, { recursive: true })
  const candidate = resolve(dir, `resume-${Date.now()}.pdf`)
  const browser = await launch()
  let layout = layouts[0]
  try {
    const page = await browser.newPage()
    // Roomiest layout first; the first one that fits two pages wins.
    for (const option of layouts) {
      layout = option
      const markup = resumeHtml(option)
      await page.setContent(markup, { waitUntil: 'load' })
      await page.evaluate(() => document.fonts.ready)
      await page.pdf({ path: candidate, format: 'Letter', printBackground: true, preferCSSPageSize: true })
      if (html) writeFileSync(html, markup)
      if ((await extractPdf(candidate)).pages.length <= 2) break
    }
  } finally {
    await browser.close()
  }
  const next = await analyzeResume(candidate)
  const current = existsSync(out) ? await analyzeResume(out) : null
  const sameBytes = current && readFileSync(out).length === readFileSync(candidate).length && readFileSync(out).equals(readFileSync(candidate))
  const better = !current || next.score >= current.score
  const replaced = (better || force) && !sameBytes
  if (replaced) copyFileSync(candidate, out)
  return { candidate, out, replaced, forced: force && !better, unchanged: Boolean(sameBytes), next, current, layout }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null }
  const result = await buildResume({ out: value('--out') ? resolve(value('--out')) : resumePath, force: args.includes('--force'), html: value('--html') ? resolve(value('--html')) : null })
  if (result.current) console.log(`Current resume\n${formatReport(result.current)}\n`)
  console.log(`New resume\n${formatReport(result.next)}\n`)
  if (result.layout !== layouts[0]) console.log(`Layout: ${result.layout.olderBullets} bullet${result.layout.olderBullets === 1 ? '' : 's'} on the older Microsoft roles${result.layout.compact ? ', compact type' : ''}, to fit two pages.`)
  if (result.unchanged) console.log('The PDF is already up to date.')
  else if (result.replaced) console.log(`${result.forced ? 'Forced: ' : ''}Wrote ${result.out} (score ${result.current ? `${result.current.score} → ` : ''}${result.next.score}).`)
  else { console.error(`Not replaced: the new resume scores ${result.next.score}, the current one ${result.current.score}. Fix the findings above or pass --force.`); process.exitCode = 1 }
  if (result.next.errors) { console.error('The new resume does not match src/resume.ts (see the errors above).'); process.exitCode = 1 }
}
