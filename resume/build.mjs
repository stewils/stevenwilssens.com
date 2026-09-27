// Renders resume/resume.html to the public resume PDF using the locally
// installed Microsoft Edge. Run with `npm run resume`, then commit the PDF.
import { chromium } from 'playwright-core'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(import.meta.url), '../..')
const source = resolve(root, 'resume/resume.html')
const output = resolve(root, 'public/steven-wilssens-resume-2026.pdf')

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage()
await page.goto(pathToFileURL(source).href, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.pdf({ path: output, format: 'Letter', printBackground: true, preferCSSPageSize: true })
await browser.close()
console.log(`Wrote ${output}`)
