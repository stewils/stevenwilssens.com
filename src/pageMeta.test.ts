import { describe, expect, it } from 'vitest'
import { markdownPath, originTrialTokens, pageJsonLd, pageMeta, pagePath, routes, siteUrl, type Page } from './pageMeta'

type Node = Record<string, unknown> & { '@type': string; '@id'?: string }
const graph = (page: Exclude<Page, 'notFound'>) => pageJsonLd(page)['@graph'] as Node[]
const ofType = (page: Exclude<Page, 'notFound'>, type: string) => graph(page).filter((node) => node['@type'] === type)

describe('page metadata', () => {
  it('gives every page a title that names Steven and a description a search result can show', () => {
    for (const page of ['home', ...routes, 'notFound'] as Page[]) {
      expect(pageMeta[page].title, page).toMatch(/Steven Wilssens/)
      expect(pageMeta[page].description.length, page).toBeGreaterThan(30)
    }
  })

  it('addresses the home page as / and the others by name, with a Markdown copy beside each', () => {
    expect(pagePath('home')).toBe('/')
    expect(pagePath('experience')).toBe('/experience')
    expect(markdownPath('home')).toBe('/index.md')
    expect(markdownPath('building-leo')).toBe('/building-leo.md')
  })

  it('carries an origin trial token for WebMCP with an expiry date', () => {
    expect(originTrialTokens.length).toBeGreaterThan(0)
    for (const token of originTrialTokens) expect(Date.parse(token.expires)).not.toBeNaN()
  })
})

describe('structured data for search engines', () => {
  it('marks the home page as Steven\'s profile, without breadcrumbs', () => {
    const ld = pageJsonLd('home')
    expect(ld['@context']).toBe('https://schema.org')
    const page = ofType('home', 'ProfilePage')[0]
    expect(page).toMatchObject({ url: `${siteUrl}/`, mainEntity: { '@id': `${siteUrl}/#person` } })
    expect(ofType('home', 'BreadcrumbList')).toHaveLength(0)
    expect(ofType('home', 'Person')[0]).toMatchObject({ name: 'Steven Wilssens', email: 'mailto:steven@wilssens.com' })
    expect(ofType('home', 'Article')).toHaveLength(0)
  })

  it('marks /about as the about page and other pages as plain web pages, each with a breadcrumb back to the profile', () => {
    expect(ofType('about', 'AboutPage')).toHaveLength(1)
    const page = ofType('patents', 'WebPage')[0]
    expect(page).toMatchObject({ url: `${siteUrl}/patents`, about: { '@id': `${siteUrl}/#person` }, breadcrumb: { '@id': `${siteUrl}/patents#breadcrumb` } })
    const crumbs = ofType('patents', 'BreadcrumbList')[0].itemListElement as { position: number; name: string; item: string }[]
    expect(crumbs).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Steven Wilssens', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Patents', item: `${siteUrl}/patents` },
    ])
  })

  it('adds an Article to each Building write-up, about the project it describes', () => {
    const about = (page: Exclude<Page, 'notFound'>) => ofType(page, 'Article')[0].about
    expect(about('building-wilssens')).toMatchObject({ url: 'https://www.wilssens.com/' })
    expect(about('building-aibreaker')).toMatchObject({ '@type': 'SoftwareApplication', name: 'AI Breaker' })
    expect(about('building-this-site')).toEqual({ '@id': `${siteUrl}/#website` })
    expect(about('building-juniortrackcycling')).toMatchObject({ url: 'https://juniortrackcycling.com/' })
    expect(about('building-leo')).toMatchObject({ url: 'https://leo.wilssens.com/' })
    for (const page of ['building-wilssens', 'building-aibreaker', 'building-this-site', 'building-juniortrackcycling', 'building-leo'] as const) {
      const article = ofType(page, 'Article')[0]
      expect(article.description, page).toBe(pageMeta[page].description)
      expect(Date.parse(article.datePublished as string), page).not.toBeNaN()
    }
    expect(ofType('privacy', 'Article')).toHaveLength(0)
  })
})
