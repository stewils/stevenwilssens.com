import { describe, expect, it } from 'vitest'
import { identifyCrawler, isCrawlTarget } from './crawlers'

describe('identifying a crawler', () => {
  it('names the known crawlers with their operator and purpose', () => {
    expect(identifyCrawler('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot')).toEqual({ name: 'ChatGPT-User', operator: 'OpenAI', category: 'ai-assistant' })
    expect(identifyCrawler('Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)')).toEqual({ name: 'ClaudeBot', operator: 'Anthropic', category: 'ai-training' })
    expect(identifyCrawler('Mozilla/5.0 (compatible; OAI-SearchBot/1.0)')).toMatchObject({ name: 'OAI-SearchBot', category: 'ai-search' })
    expect(identifyCrawler('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toEqual({ name: 'Googlebot', operator: 'Google', category: 'search' })
    expect(identifyCrawler('Mozilla/5.0 (compatible; Google-InspectionTool/1.0)')).toMatchObject({ name: 'Google-InspectionTool' })
    expect(identifyCrawler('LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)')).toEqual({ name: 'LinkedInBot', operator: 'LinkedIn', category: 'social' })
    expect(identifyCrawler('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)')).toEqual({ name: 'AhrefsBot', operator: 'Ahrefs', category: 'seo' })
    expect(identifyCrawler('Yeti/1.1 (+http://naver.me/spd)')).toMatchObject({ name: 'Yeti', operator: 'Naver' })
  })

  it('returns null for a regular browser', () => {
    expect(identifyCrawler('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36')).toBeNull()
  })

  it('names unknown bots and scripts from their user agent', () => {
    expect(identifyCrawler('')).toEqual({ name: 'No user agent', operator: null, category: 'other' })
    expect(identifyCrawler('Mozilla/5.0 (compatible; FancyNewBot/0.1)')).toEqual({ name: 'FancyNewBot', operator: null, category: 'other' })
    expect(identifyCrawler('curl/8.4.0')).toEqual({ name: 'curl', operator: null, category: 'other' })
    expect(identifyCrawler(`${'x'.repeat(80)}bot`)?.name).toHaveLength(60)
  })

  it('takes the first word when no bot, crawl or spider word is there', () => {
    expect(identifyCrawler('1.0 / 2.0 / 3 ?')).toBeNull()
    expect(identifyCrawler('123 (456) java/')).toEqual({ name: 'java', operator: null, category: 'other' })
  })
})

describe('what a crawl records', () => {
  it('keeps pages, robots.txt, the sitemap and the resume', () => {
    for (const path of ['/', '/about', '/robots.txt', '/sitemap.xml', '/llms.txt', '/about.md', '/steven-wilssens-resume-2026.pdf']) expect(isCrawlTarget(path)).toBe(true)
  })

  it('leaves out assets, the API and the MCP path that carries the owner key', () => {
    for (const path of ['/assets/index-abc.js', '/api/track', '/mcp/secret-key', '/mcp', '/main.js', '/style.CSS', '/font.woff2', '/profile.jpg', '/og-image.png', '/icon.svg', '/favicon.ico', '/site.webmanifest']) expect(isCrawlTarget(path)).toBe(false)
  })
})
