import { describe, expect, it } from 'vitest'
import { isBot, parseUserAgent } from './useragent'

const chromeWindows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.90 Safari/537.36'
const edge = `${chromeWindows} Edg/129.0.2792.79`
const safariIphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const safariIpad = 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'
const chromeAndroidPhone = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
const androidTablet = 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Safari/537.36'
const firefoxMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0'
const operaLinux = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0'
const chromebook = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

describe('bots', () => {
  it('treats an empty user agent and scripts as bots, browsers as people', () => {
    expect(isBot('')).toBe(true)
    expect(isBot('curl/8.4.0')).toBe(true)
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(isBot('python-requests/2.31')).toBe(true)
    expect(isBot(chromeWindows)).toBe(false)
  })
})

describe('parsing a user agent', () => {
  it('names the browser, its major version, the system and the device', () => {
    expect(parseUserAgent(chromeWindows)).toEqual({ browser: 'Chrome', browserVersion: '129', os: 'Windows', device: 'desktop' })
    expect(parseUserAgent(edge)).toMatchObject({ browser: 'Edge', browserVersion: '129' })
    expect(parseUserAgent(safariIphone)).toEqual({ browser: 'Safari', browserVersion: '18', os: 'iOS', device: 'mobile' })
    expect(parseUserAgent(safariIpad)).toMatchObject({ os: 'iOS', device: 'tablet' })
    expect(parseUserAgent(chromeAndroidPhone)).toEqual({ browser: 'Chrome', browserVersion: '129', os: 'Android', device: 'mobile' })
    expect(parseUserAgent(androidTablet)).toEqual({ browser: 'Samsung Internet', browserVersion: '25', os: 'Android', device: 'tablet' })
    expect(parseUserAgent(firefoxMac)).toEqual({ browser: 'Firefox', browserVersion: '131', os: 'macOS', device: 'desktop' })
    expect(parseUserAgent(operaLinux)).toEqual({ browser: 'Opera', browserVersion: '114', os: 'Linux', device: 'desktop' })
    expect(parseUserAgent(chromebook)).toMatchObject({ os: 'ChromeOS' })
  })

  it('falls back to Other for what it does not know', () => {
    expect(parseUserAgent('')).toEqual({ browser: 'Other', browserVersion: '', os: 'Other', device: 'desktop' })
    expect(parseUserAgent('SomeTV/1.0')).toEqual({ browser: 'Other', browserVersion: '', os: 'Other', device: 'desktop' })
  })
})
