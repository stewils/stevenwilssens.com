// TEMPORARY (deleted before hand-over): renders every resume layout for main's data and the
// branch's, and prints the page count and how full the last page is.
const repo = '/home/runner/work/stevenwilssens.com/stevenwilssens.com'
const { chromium } = await import(`${repo}/node_modules/playwright-core/index.mjs`)
const { resumeHtml, layouts } = await import(`${repo}/scripts/resume.mjs`)
const { profile, experiences } = await import(`${repo}/src/resume.ts`)
const { extractPdf } = await import(`${repo}/scripts/resume-check.mjs`)

const branch = { arrangement: profile.workArrangement, cosmos: experiences.find((e) => e.key === 'cosmos').summary, bullet: experiences.find((e) => e.key === 'windows-devices-data').points[4] }
const main = { arrangement: '', cosmos: 'Built and supported software components across C# client and Java server systems using CORBA middleware.', bullet: 'Scaled experimentation adoption across Windows, significantly reducing the number of features pulled back after release.' }
const noStrip = { ...branch, arrangement: '' }
const variants = { main, noStrip, branch }
const set = (v) => { profile.workArrangement = v.arrangement; experiences.find((e) => e.key === 'cosmos').summary = v.cosmos; experiences.find((e) => e.key === 'windows-devices-data').points[4] = v.bullet }
let browser
for (const options of [{ channel: 'msedge' }, { channel: 'chrome' }, {}]) { try { browser = await chromium.launch(options); console.log('browser', JSON.stringify(options), browser.version()); break } catch {} }
const page = await browser.newPage()
const css = process.argv[2] ?? ''
for (const [name, v] of Object.entries(variants)) {
  set(v)
  for (const layout of layouts) {
    await page.setContent(resumeHtml(layout).replace('</style>', `${css}</style>`), { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.pdf({ path: '/tmp/measure-out.pdf', format: 'Letter', printBackground: true, preferCSSPageSize: true })
    const pdf = await extractPdf('/tmp/measure-out.pdf')
    console.log(name, JSON.stringify(layout), 'pages', pdf.pages.length, 'last page chars', pdf.pages.at(-1).length, 'tail', JSON.stringify(pdf.pages.at(-1).slice(-60)))
  }
}
await browser.close()
