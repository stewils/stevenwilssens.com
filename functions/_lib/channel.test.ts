import { describe, expect, it } from 'vitest'
import { classifyChannel } from './channel'

describe('traffic channels', () => {
  it('lets a ?ref= or utm_source tag win over the referrer', () => {
    expect(classifyChannel('resume', null, 'www.google.com')).toBe('Resume')
    expect(classifyChannel(' CV ', null, null)).toBe('Resume')
    expect(classifyChannel('li', null, null)).toBe('LinkedIn')
    expect(classifyChannel('Signature', null, null)).toBe('Email')
    expect(classifyChannel('github', null, 'www.linkedin.com')).toBe('Tagged')
  })

  it('treats utm_medium=email as email when no source is tagged', () => {
    expect(classifyChannel(null, 'Email', 'example.com')).toBe('Email')
    expect(classifyChannel('  ', ' email ', null)).toBe('Email')
    expect(classifyChannel(null, 'social', null)).toBe('Direct')
  })

  it('groups referrers into LinkedIn, email, search and other sites', () => {
    expect(classifyChannel(null, null, 'www.linkedin.com')).toBe('LinkedIn')
    expect(classifyChannel(null, null, 'lnkd.in')).toBe('LinkedIn')
    expect(classifyChannel(null, null, 'mail.google.com')).toBe('Email')
    expect(classifyChannel(null, null, 'outlook.office365.com')).toBe('Email')
    expect(classifyChannel(null, null, 'www.google.co.uk')).toBe('Search')
    expect(classifyChannel(null, null, 'search.brave.com')).toBe('Search')
    expect(classifyChannel(null, null, 'news.ycombinator.com')).toBe('Referral')
    expect(classifyChannel(null, null, 'notlinkedin.com')).toBe('Referral')
  })

  it('calls a visit without tag or referrer direct', () => {
    expect(classifyChannel(null, null, null)).toBe('Direct')
    expect(classifyChannel(null, null, '')).toBe('Direct')
  })
})
