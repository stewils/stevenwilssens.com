import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
// Refresh the screenshots on /projects: node scripts/capture-projects.mjs
// Uses the installed Microsoft Edge (no browser download). Visits send Do Not
// Track and set the sites' opt-out keys, so they stay out of their analytics.
const OUT = fileURLToPath(new URL('../src/assets/projects', import.meta.url));
const sites = [
  ['https://www.wilssens.com/', 'wilssens'],
  ['https://juniortrackcycling.com/', 'juniortrackcycling'],
  ['https://leo.wilssens.com/', 'leo'],
  ['https://steven.wilssens.com/', 'steven'],
];
const b = await chromium.launch({ channel: 'msedge' });
const optOut = () => {
  try { for (const k of ['sw-analytics-ignore', 'leo-analytics-ignore', 'wilssens-analytics-ignore', 'jtc-analytics-ignore']) localStorage.setItem(k, '1'); } catch {}
  Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
};
for (const [site, name] of sites) {
  for (const [kind, opts] of [
    ['desktop', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }],
    ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }],
  ]) {
    const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce', colorScheme: 'light', extraHTTPHeaders: { DNT: '1' } });
    await ctx.addInitScript(optOut);
    const p = await ctx.newPage();
    await p.goto(site, { waitUntil: 'networkidle', timeout: 45000 });
    await p.evaluate(() => document.fonts.ready);
    // Load lazy images by scrolling through, then back to the top.
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
    await p.waitForTimeout(1500);
    const h = await p.evaluate(() => document.documentElement.scrollHeight);
    const path = `${OUT}/${name}-${kind}.jpg`;
    if (kind === 'desktop') await p.screenshot({ path, type: 'jpeg', quality: 72, fullPage: true, clip: { x: 0, y: 0, width: 1280, height: Math.min(h, 3200) } });
    else await p.screenshot({ path, type: 'jpeg', quality: 72 });
    console.log(name, kind, 'page height', h);
    await ctx.close();
  }
}
await b.close();
