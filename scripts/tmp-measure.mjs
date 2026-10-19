import { chromium } from 'playwright-core'
import { layouts, resumeHtml } from './resume.mjs'
import { extractPdf } from './resume-check.mjs'

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }))
const page = await browser.newPage()
for (const option of layouts) {
  await page.setContent(resumeHtml(option), { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.emulateMedia({ media: 'print' })
  await page.setViewportSize({ width: Math.round((8.5 - 1.1) * 96), height: 1000 })
  const sizes = await page.evaluate(() => [...document.querySelectorAll('header, .facts, section')].map((el) => `${el.tagName}.${el.className}:${Math.round(el.getBoundingClientRect().height)}`))
  await page.pdf({ path: '/tmp/stevenwilssens-resume/measure.pdf', format: 'Letter', printBackground: true, preferCSSPageSize: true })
  const pdf = await extractPdf('/tmp/stevenwilssens-resume/measure.pdf')
  console.log(JSON.stringify(option), 'pages', pdf.pages.length, 'body', await page.evaluate(() => document.body.scrollHeight), 'page height ~', Math.round((11 - 0.87) * 96 * 2))
  console.log('  ', sizes.join(' | '))
  pdf.pages.forEach((p, i) => { const t = JSON.stringify(p); console.log(`  page ${i + 1}: ${t.slice(0, 120)} ... ${t.slice(-200)}`) })
}
await browser.close()
