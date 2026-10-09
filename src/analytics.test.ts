import { describe, expect, it } from 'vitest'
import { parseUserAgent, isBot } from '../functions/_lib/useragent'
import { summarizeVitals } from '../functions/_lib/vitals'
import { fillDays, formatDuration, formatVital, rateVital } from './admin/format'
import { classifyChannel } from '../functions/_lib/channel'
import { classifyLink, describeClick, removeTrackingParams } from './analytics'

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

describe('web vitals', () => {
  it('summarizes the 75th percentile and rating shares per metric and page', () => {
    const rows = [100, 200, 300, 4000].map((value, index) => ({ metric: 'LCP', value, rating: index === 3 ? 'poor' : 'good', path: index % 2 ? '/about' : '/' }))
    const summary = summarizeVitals(rows)
    expect(summary.metrics).toEqual([{ metric: 'LCP', p75: 4000, samples: 4, good: 0.75, needsImprovement: 0, poor: 0.25 }])
    expect(summary.pages).toEqual([{ path: '/', LCP: 300 }, { path: '/about', LCP: 4000 }])
  })

  it('assesses each device type and lists the elements behind slow visits', () => {
    const rows = [
      { metric: 'LCP', value: 1800, rating: 'good', path: '/', device: 'desktop', target: 'img.profile' },
      { metric: 'CLS', value: 0.02, rating: 'good', path: '/', device: 'desktop' },
      { metric: 'TTFB', value: 300, rating: 'good', path: '/', device: 'desktop' },
      { metric: 'LCP', value: 3100, rating: 'needs-improvement', path: '/', device: 'mobile', target: 'img.profile' },
      { metric: 'CLS', value: 0.01, rating: 'good', path: '/', device: 'mobile' },
      { metric: 'INP', value: 90, rating: 'good', path: '/', device: 'mobile', target: 'pointer: button' },
      { metric: 'TTFB', value: 500, rating: 'good', path: '/', device: 'mobile' },
      { metric: 'LCP', value: 1200, rating: 'good', path: '/about', device: 'tablet' },
    ]
    const summary = summarizeVitals(rows)
    expect(summary.devices).toEqual([
      { device: 'mobile', visits: 1, passes: false, LCP: 3100, CLS: 0.01, INP: 90, TTFB: 500 },
      { device: 'desktop', visits: 1, passes: true, LCP: 1800, CLS: 0.02, TTFB: 300 },
      { device: 'tablet', visits: 0, passes: null, LCP: 1200 },
    ])
    expect(summary.culprits).toEqual([{ metric: 'LCP', path: '/', target: 'img.profile', samples: 1, p75: 3100 }])
  })

  it('rates and formats values with Google thresholds', () => {
    expect(rateVital('LCP', 2400)).toBe('good')
    expect(rateVital('INP', 350)).toBe('needs-improvement')
    expect(rateVital('CLS', 0.3)).toBe('poor')
    expect(formatVital('LCP', 2400)).toBe('2.40s')
    expect(formatVital('INP', 96.4)).toBe('96ms')
    expect(formatVital('CLS', 0.042)).toBe('0.04')
  })
})

describe('traffic channels', () => {
  it('credits tagged links first, then the referring site, then direct', () => {
    expect(classifyChannel('resume', null, null)).toBe('Resume')
    expect(classifyChannel('LinkedIn', null, 'google.com')).toBe('LinkedIn')
    expect(classifyChannel('email', null, null)).toBe('Email')
    expect(classifyChannel(null, 'email', null)).toBe('Email')
    expect(classifyChannel('twitter', null, null)).toBe('Tagged')
    expect(classifyChannel(null, null, 'linkedin.com')).toBe('LinkedIn')
    expect(classifyChannel(null, null, 'lnkd.in')).toBe('LinkedIn')
    expect(classifyChannel(null, null, 'mail.google.com')).toBe('Email')
    expect(classifyChannel(null, null, 'google.co.uk')).toBe('Search')
    expect(classifyChannel(null, null, 'github.com')).toBe('Referral')
    expect(classifyChannel(null, null, null)).toBe('Direct')
  })

  it('removes tracking tags from the address bar but keeps other parameters', () => {
    window.history.replaceState({}, '', '/experience?ref=resume&utm_campaign=x&tab=2#top')
    removeTrackingParams()
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/experience?tab=2#top')
  })
})
