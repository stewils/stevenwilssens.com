// Page titles and descriptions. The app sets them at runtime, and the build
// writes them into a static HTML file per page so link previews and crawlers
// that do not run JavaScript see the right text.

export const siteUrl = 'https://steven.wilssens.com'

export const routes = ['about', 'experience', 'recommendations', 'patents', 'honors', 'news', 'projects', 'privacy'] as const

export type Page = 'home' | (typeof routes)[number] | 'notFound'

export const pageMeta: Record<Page, { title: string; description: string }> = {
  home: { title: 'Steven Wilssens | Product leader', description: 'Steven Wilssens, product and technology leader: more than a decade at Microsoft, most recently leading Windows & Devices Data product management.' },
  about: { title: 'About | Steven Wilssens', description: 'Learn about Steven Wilssens and his approach to product, portfolio, and people leadership.' },
  experience: { title: 'Experience | Steven Wilssens', description: 'A career across product leadership, Windows & Devices, spatial audio, Azure DevOps, and software.' },
  recommendations: { title: 'Recommendations | Steven Wilssens', description: 'Recommendations from leaders, peers, and teammates who worked with Steven Wilssens.' },
  patents: { title: 'Patents | Steven Wilssens', description: 'Patents across spatial audio, media, streaming, and connected computing.' },
  honors: { title: 'Honors & awards | Steven Wilssens', description: 'Recognition for teamwork, individual excellence, and technical leadership.' },
  news: { title: 'In the News | Steven Wilssens', description: 'Coverage of Steven Wilssens and spatial audio work across Windows and Xbox.' },
  projects: { title: 'Projects & interests | Steven Wilssens', description: 'Projects where product thinking meets family, community, and the joy of making things useful.' },
  privacy: { title: 'Privacy | Steven Wilssens', description: 'What steven.wilssens.com records about visits and what it does not: first-party, cookie-free analytics hosted on Cloudflare.' },
  notFound: { title: 'Page not found | Steven Wilssens', description: 'This page does not exist on steven.wilssens.com.' },
}

// Address of a page: '/' for home, '/about' for the others.
export const pagePath = (page: Page) => page === 'home' ? '/' : `/${page}`

// Plain-text Markdown copy of each page for LLMs and AI agents, written by scripts/prerender.mjs.
export const markdownPath = (page: Page) => page === 'home' ? '/index.md' : `/${page}.md`

const person = {
  '@type': 'Person',
  '@id': `${siteUrl}/#person`,
  name: 'Steven Wilssens',
  url: `${siteUrl}/`,
  image: `${siteUrl}/profile.jpg`,
  email: 'mailto:steven@wilssens.com',
  jobTitle: 'Product leader',
  description: pageMeta.home.description,
  knowsAbout: ['Product management', 'Product strategy', 'Product leadership', 'Data platforms', 'Experimentation', 'Machine learning', 'AI', 'Telemetry', 'Spatial audio', 'Game streaming', 'Windows', 'Xbox'],
  knowsLanguage: ['nl', 'en', 'fr'],
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: 'Karel de Grote', address: { '@type': 'PostalAddress', addressCountry: 'BE' } },
    { '@type': 'Organization', name: 'Microsoft', url: 'https://www.microsoft.com/' },
  ],
  homeLocation: { '@type': 'Place', name: 'Seattle area, Washington, United States' },
  sameAs: [
    'https://www.linkedin.com/in/steven-wilssens-59495889/',
    'https://patents.justia.com/inventor/steven-wilssens',
    'https://patents.justia.com/inventor/steven-marcel-elza-wilssens',
  ],
}

// Structured data for search engines: who the site is about, where else he appears,
// what each page is, and where it sits on the site. The home page is marked as his
// profile, which Google uses for profile results; the others get breadcrumbs.
// Added to each page's HTML at build time.
export const pageJsonLd = (page: Exclude<Page, 'notFound'>) => {
  const url = `${siteUrl}${pagePath(page)}`
  const webPage = {
    '@type': page === 'home' ? 'ProfilePage' : page === 'about' ? 'AboutPage' : 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: pageMeta[page].title,
    description: pageMeta[page].description,
    inLanguage: 'en',
    isPartOf: { '@id': `${siteUrl}/#website` },
    ...(page === 'home' ? { mainEntity: { '@id': `${siteUrl}/#person` } } : { about: { '@id': `${siteUrl}/#person` }, breadcrumb: { '@id': `${url}#breadcrumb` } }),
  }
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Steven Wilssens', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: pageMeta[page].title.replace(/ \| Steven Wilssens$/, ''), item: url },
    ],
  }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      person,
      { '@type': 'WebSite', '@id': `${siteUrl}/#website`, name: 'Steven Wilssens', url: `${siteUrl}/`, inLanguage: 'en', about: { '@id': `${siteUrl}/#person` }, publisher: { '@id': `${siteUrl}/#person` } },
      webPage,
      ...(page === 'home' ? [] : [breadcrumb]),
    ],
  }
}
