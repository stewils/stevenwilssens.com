// Page titles and descriptions. The app sets them at runtime, and the build
// writes them into a static HTML file per page so link previews and crawlers
// that do not run JavaScript see the right text.

export const siteUrl = 'https://steven.wilssens.com'

export const routes = ['about', 'experience', 'recommendations', 'patents', 'honors', 'news', 'projects'] as const

export type Page = 'home' | (typeof routes)[number] | 'notFound'

export const pageMeta: Record<Page, { title: string; description: string }> = {
  home: { title: 'Steven Wilssens | Product leader', description: 'Independent product and technology leader beginning a new chapter after more than a decade at Microsoft, most recently leading Windows & Devices Data product management.' },
  about: { title: 'About | Steven Wilssens', description: 'Learn about Steven Wilssens and his approach to product, portfolio, and people leadership.' },
  experience: { title: 'Experience | Steven Wilssens', description: 'A career across product leadership, Windows & Devices, spatial audio, Azure DevOps, and software.' },
  recommendations: { title: 'Recommendations | Steven Wilssens', description: 'Recommendations from leaders, peers, and teammates who worked with Steven Wilssens.' },
  patents: { title: 'Patents | Steven Wilssens', description: 'Patents across spatial audio, media, streaming, and connected computing.' },
  honors: { title: 'Honors & awards | Steven Wilssens', description: 'Recognition for teamwork, individual excellence, and technical leadership.' },
  news: { title: 'In the News | Steven Wilssens', description: 'Coverage of Steven Wilssens and spatial audio work across Windows and Xbox.' },
  projects: { title: 'Projects & interests | Steven Wilssens', description: 'Projects where product thinking meets family, community, and the joy of making things useful.' },
  notFound: { title: 'Page not found | Steven Wilssens', description: 'This page does not exist on steven.wilssens.com.' },
}
