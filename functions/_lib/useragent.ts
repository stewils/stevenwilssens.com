export type ParsedAgent = { browser: string; browserVersion: string; os: string; device: 'desktop' | 'mobile' | 'tablet' }

const botPattern = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|axios|node-fetch|go-http|java\/|httpclient|scrapy|monitor|uptime/i

export const isBot = (userAgent: string) => !userAgent || botPattern.test(userAgent)

const browsers: [string, RegExp][] = [
  ['Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
  ['Opera', /(?:OPR|Opera)\/([\d.]+)/],
  ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
  ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
  ['Safari', /Version\/([\d.]+).*Safari/],
]

const systems: [string, RegExp][] = [
  ['iOS', /iPhone|iPad|iPod/],
  ['Android', /Android/],
  ['Windows', /Windows/],
  ['macOS', /Mac OS X|Macintosh/],
  ['ChromeOS', /CrOS/],
  ['Linux', /Linux/],
]

export const parseUserAgent = (userAgent: string): ParsedAgent => {
  const browserMatch = browsers.find(([, pattern]) => pattern.test(userAgent))
  const version = browserMatch ? userAgent.match(browserMatch[1])?.[1] ?? '' : ''
  const os = systems.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? 'Other'
  const device = /iPad|Tablet|Android(?!.*Mobile)/.test(userAgent) ? 'tablet' : /Mobi|iPhone|iPod/.test(userAgent) ? 'mobile' : 'desktop'
  return { browser: browserMatch?.[0] ?? 'Other', browserVersion: version.split('.')[0], os, device }
}
