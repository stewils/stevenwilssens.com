import { describe, expect, it } from 'vitest'
import { parseUserAgent, isBot } from '../functions/_lib/useragent'
import { fillDays, formatDuration } from './admin/format'
import { classifyLink, describeClick } from './analytics'

describe('click tracking', () => {
  it('classifies links by what they do', () => {
    expect(classifyLink('/steven-wilssens-resume-2026.pdf', true, 'steven.wilssens.com')).toBe('download')
    expect(classifyLink('mailto:steven@wilssens.com', false, 'steven.wilssens.com')).toBe('email')
    expect(classifyLink('https://www.linkedin.com/in/x', false, 'steven.wilssens.com')).toBe('outbound')
    expect(classifyLink('/experience', false, window.location.host)).toBe('internal')
  })

  it('describes a click with its label and surrounding section', () => {
    document.body.innerHTML = '<section><h2>Start a conversation</h2><a href="mailto:steven@wilssens.com"><span>Email Steven ↗</span></a></section><header><button>Menu</button></header>'
    expect(describeClick(document.querySelector('span')!)).toEqual({ category: 'email', label: 'Email Steven ↗', target: 'mailto:steven@wilssens.com', context: 'Start a conversation' })
    expect(describeClick(document.querySelector('button')!)).toEqual({ category: 'button', label: 'Menu', target: null, context: 'Header' })
    expect(describeClick(document.querySelector('h2')!)).toBeNull()
  })
})

describe('user agent parsing', () => {
  it('recognizes common browsers and devices', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0')).toEqual({ browser: 'Edge', browserVersion: '141', os: 'Windows', device: 'desktop' })
    expect(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1')).toEqual({ browser: 'Safari', browserVersion: '19', os: 'iOS', device: 'mobile' })
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 16; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36')).toMatchObject({ browser: 'Chrome', os: 'Android', device: 'tablet' })
  })

  it('filters crawlers and scripts', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
    expect(isBot('curl/8.9.1')).toBe(true)
    expect(isBot('')).toBe(true)
    expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15')).toBe(false)
  })
})

describe('dashboard formatting', () => {
  it('fills days without traffic with zeros', () => {
    const days = fillDays([{ day: '2026-09-26', pageviews: 3, visitors: 2 }], 3, new Date(2026, 8, 27, 12))
    expect(days).toEqual([
      { day: '2026-09-25', pageviews: 0, visitors: 0 },
      { day: '2026-09-26', pageviews: 3, visitors: 2 },
      { day: '2026-09-27', pageviews: 0, visitors: 0 },
    ])
  })

  it('formats durations compactly', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(42_000)).toBe('42s')
    expect(formatDuration(83_000)).toBe('1m 23s')
  })
})
