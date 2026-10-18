// Page titles and descriptions. The app sets them at runtime, and the build
// writes them into a static HTML file per page so link previews and crawlers
// that do not run JavaScript see the right text.

export const siteUrl = 'https://steven.wilssens.com'

export const routes = ['about', 'experience', 'work', 'recommendations', 'patents', 'honors', 'news', 'projects', 'building-wilssens', 'building-aibreaker', 'building-this-site', 'privacy'] as const

export type Page = 'home' | (typeof routes)[number] | 'notFound'

export const pageMeta: Record<Page, { title: string; description: string }> = {
  home: { title: 'Steven Wilssens | Principal product leader, data and AI', description: 'Steven Wilssens, principal product leader for data, experimentation and AI: nearly 20 years at Microsoft, most recently leading Windows & Devices Data product management.' },
  about: { title: 'About | Steven Wilssens', description: 'Learn about Steven Wilssens and his approach to product, portfolio, and people leadership.' },
  experience: { title: 'Experience | Steven Wilssens', description: 'A career across product leadership, Windows & Devices, spatial audio, Azure DevOps, and software.' },
  work: { title: 'Selected work | Steven Wilssens', description: 'Selected work from Steven Wilssens’s data and AI chapter at Microsoft, 2020 to 2026: Windows quality data products, experimentation and AI for Windows development, an OKR tool rebuilt with AI, plus wilssens.com and the spatial audio platform.' },
  recommendations: { title: 'Recommendations | Steven Wilssens', description: 'Recommendations from leaders, peers, and teammates who worked with Steven Wilssens.' },
  patents: { title: 'Patents | Steven Wilssens', description: 'Patents across spatial audio, media, streaming, and connected computing.' },
  honors: { title: 'Honors & awards | Steven Wilssens', description: 'Recognition for teamwork, individual excellence, and technical leadership.' },
  news: { title: 'In the News | Steven Wilssens', description: 'Coverage of Steven Wilssens and spatial audio work across Windows and Xbox.' },
  projects: { title: 'Projects & interests | Steven Wilssens', description: 'Projects where product thinking meets family, community, and the joy of making things useful.' },
  'building-wilssens': { title: 'Building wilssens.com | Steven Wilssens', description: 'How wilssens.com was designed and built: a family domain with automated Zoho mailboxes, five ways to build a website, AI apps over MCP, two command lines, a restricted AI help assistant, and the rules that keep a family safe.' },
  'building-aibreaker': { title: 'Building AI Breaker | Steven Wilssens', description: 'Why and how AI Breaker, the off switch for AI on Windows, was built: the research on how many people are wary of AI and why holding the switch calms, four levels, a service that writes every change down before making it, proof from Windows’ own logs, undo built first, and AI-assisted development run like a team.' },
  'building-this-site': { title: 'Building steven.wilssens.com | Steven Wilssens', description: 'How steven.wilssens.com is built and run like a product: one data file behind the pages, the résumé PDF, the Markdown for AI and the assistant; a scored quality gate on the résumé; cookie-free analytics that count people, search engines and AI crawlers apart; an assistant that knows only what is published; and a loop where Claude interviews Steven, reviews the site like a recruiter and opens pull requests.' },
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
  jobTitle: 'Principal product leader',
  description: pageMeta.home.description,
  knowsAbout: ['Product management', 'Product strategy', 'Product leadership', 'Data platforms', 'Experimentation', 'Machine learning', 'AI', 'Telemetry', 'Spatial audio', 'Game streaming', 'Windows', 'Xbox'],
  knowsLanguage: ['nl', 'en', 'fr'],
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: 'Karel de Grote', address: { '@type': 'PostalAddress', addressCountry: 'BE' } },
    { '@type': 'Organization', name: 'Microsoft', url: 'https://www.microsoft.com/' },
  ],
  homeLocation: { '@type': 'Place', name: 'Seattle, Washington, United States' },
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
      ...(page === 'building-wilssens' ? [{ '@type': 'Article', '@id': `${url}#article`, headline: 'Building wilssens.com: a family name, turned into a platform', description: pageMeta[page].description, datePublished: '2026-10-15', inLanguage: 'en', author: { '@id': `${siteUrl}/#person` }, publisher: { '@id': `${siteUrl}/#person` }, mainEntityOfPage: { '@id': `${url}#webpage` }, about: { '@type': 'WebSite', name: 'wilssens.com', url: 'https://www.wilssens.com/' } }] : []),
      ...(page === 'building-aibreaker' ? [{ '@type': 'Article', '@id': `${url}#article`, headline: 'Building AI Breaker: the off switch for AI on Windows', description: pageMeta[page].description, datePublished: '2026-10-17', inLanguage: 'en', author: { '@id': `${siteUrl}/#person` }, publisher: { '@id': `${siteUrl}/#person` }, mainEntityOfPage: { '@id': `${url}#webpage` }, about: { '@type': 'SoftwareApplication', name: 'AI Breaker', url: 'https://aibreaker.org/', operatingSystem: 'Windows 11', applicationCategory: 'UtilitiesApplication' } }] : []),
      ...(page === 'building-this-site' ? [{ '@type': 'Article', '@id': `${url}#article`, headline: 'Building steven.wilssens.com: a résumé run like a product', description: pageMeta[page].description, datePublished: '2026-10-17', inLanguage: 'en', author: { '@id': `${siteUrl}/#person` }, publisher: { '@id': `${siteUrl}/#person` }, mainEntityOfPage: { '@id': `${url}#webpage` }, about: { '@id': `${siteUrl}/#website` } }] : []),
    ],
  }
}
