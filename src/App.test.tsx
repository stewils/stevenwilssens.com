import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const setPath = (path: string) => {
  window.history.pushState({}, '', path)
}

describe('resume site', () => {
  beforeEach(() => setPath('/'))
  afterEach(() => {
    cleanup()
    setPath('/')
  })

  it('shows the homepage positioning, impact proof, and contact actions', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Steven Wilssens' })).toBeInTheDocument()
    expect(screen.getByText('Product leader who invents new products, using data, experimentation and AI as tools.')).toBeInTheDocument()
    expect(screen.getByText('250%+')).toBeInTheDocument()
    expect(screen.getByText('1.6B+')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Leadership that turns ambiguity into momentum.' })).toBeInTheDocument()
    expect(screen.getByText('Data and experimentation products')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Email Steven/ })).toHaveAttribute('href', 'mailto:steven@wilssens.com')
    expect(screen.getByRole('link', { name: /Connect on LinkedIn/ })).toHaveAttribute('href', 'https://www.linkedin.com/in/steven-wilssens-59495889/')
  })

  it('answers the recruiter screen on the home page: scope, location, work authorization, availability', () => {
    render(<App />)

    expect(screen.getByText(/led 10 to 20 product managers/)).toBeInTheDocument()
    expect(screen.getByText('Seattle, Washington · US permanent resident (green card)')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hiring a product leader for data, experimentation or AI?' })).toBeInTheDocument()
    expect(screen.getByText(/Available now, based in Seattle, Washington, a US permanent resident/)).toBeInTheDocument()
    expect(screen.getAllByText(/choosing my next/).length).toBeLessThanOrEqual(1)
  })

  it('shows the selected work from the data and AI years, each case with its source', () => {
    setPath('/work')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Selected work' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Windows quality, measured from preview channels to retail' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'An OKR tool, rebuilt with AI when the old one retired' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Amit Gupte' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Read the write-up/ })).toHaveAttribute('href', '/building-wilssens')
  })

  it('moves the honors into the About sidebar with the hiring logistics', () => {
    setPath('/about')
    render(<App />)

    expect(screen.getByText('US permanent resident (green card)')).toBeInTheDocument()
    expect(screen.getByText('Seattle, Washington')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Honors and awards' })).getAllByRole('listitem')).toHaveLength(4)
  })

  it('features the wilssens.com write-up on the home page', () => {
    render(<App />)

    const featured = screen.getByRole('region', { name: 'Building wilssens.com' })
    expect(within(featured).getByRole('link', { name: /Read the write-up/ })).toHaveAttribute('href', '/building-wilssens')
  })

  it('lists AI Breaker under Projects with a link to its write-up', () => {
    setPath('/projects')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'AI Breaker' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Read how it was built/ }).map((link) => link.getAttribute('href'))).toEqual(['/building-wilssens', '/building-aibreaker', '/building-juniortrackcycling', '/building-leo', '/building-this-site'])
  })

  it('renders the Junior Track Cycling write-up with its gates and its local-build screenshots', () => {
    setPath('/building-juniortrackcycling')
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Building juniortrackcycling.com' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Built for minors/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /You catch it, not me/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Visit juniortrackcycling.com ↗' })).toHaveAttribute('href', 'https://juniortrackcycling.com')
    expect(screen.getByRole('link', { name: 'a separate project' })).toHaveAttribute('href', '/building-leo')
  })

  it('renders the leo.wilssens.com write-up with its rules first', () => {
    setPath('/building-leo')
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Building leo.wilssens.com' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /The rules came first/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Four games/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Visit leo.wilssens.com ↗' })).toHaveAttribute('href', 'https://leo.wilssens.com')
    expect(document.querySelector('.wx-stats')).not.toHaveAttribute('data-feed')
  })

  it('renders the AI Breaker write-up with its research and sections', () => {
    setPath('/building-aibreaker')
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Building AI Breaker' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Half the country would rather not/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pew Research Center, August 2026' })).toHaveAttribute('href', expect.stringContaining('pewresearch.org'))
    expect(screen.getAllByRole('link', { name: /Visit aibreaker.org/ })[0]).toHaveAttribute('href', 'https://aibreaker.org')
  })

  it('offers the resume PDF as a download from the home page', () => {
    render(<App />)

    const links = screen.getAllByRole('link', { name: /Download resume/ })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/steven-wilssens-resume-2026.pdf')
      expect(link).toHaveAttribute('download', 'Steven Wilssens Resume 2026.pdf')
    }
  })

  it('offers the resume PDF on the experience page', () => {
    setPath('/experience')
    render(<App />)

    const heading = screen.getByRole('heading', { name: 'Experience' }).parentElement!
    expect(within(heading).getByRole('link', { name: /Download resume/ })).toHaveAttribute('href', '/steven-wilssens-resume-2026.pdf')
  })

  it('highlights colleague quotes on the home page', () => {
    render(<App />)

    const quotes = screen.getByRole('region', { name: 'What colleagues say' })
    expect(within(quotes).getByText(/He leads by building rather than just delegating/)).toBeInTheDocument()
    expect(within(quotes).getByRole('link', { name: /Read all 8 recommendations/ })).toHaveAttribute('href', '/recommendations')
  })

  it('links each patent to its Justia record, granted patents first', () => {
    setPath('/patents')
    render(<App />)

    const links = screen.getAllByRole('link', { name: /on Justia Patents/ })
    expect(links).toHaveLength(26)
    expect(links[0]).toHaveAttribute('href', 'https://patents.justia.com/patent/12436860')
    expect(within(screen.getByRole('region', { name: /Granted patents/ })).getAllByRole('link', { name: /on Justia Patents/ })).toHaveLength(19)
    expect(screen.getByRole('link', { name: 'US 2018/0315437 on Justia Patents' })).toHaveAttribute('href', 'https://patents.justia.com/patent/20180315437')
    expect(screen.getByText('19 granted US patents and 7 published applications', { exact: false })).toBeInTheDocument()
  })

  it('defaults to dark mode, switches to light, and remembers the choice', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('sw-theme')).toBe('light')

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    localStorage.removeItem('sw-theme')
    delete document.documentElement.dataset.theme
  })

  it('keeps the experience timeline in sync with the selected role', () => {
    setPath('/experience')
    render(<App />)

    const nodes = screen.getAllByRole('button', { name: /^Go to/ })
    fireEvent.click(nodes[3])
    expect(nodes[3]).toHaveAttribute('aria-pressed', 'true')
    expect(nodes[0]).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a not-found page for unknown paths', () => {
    setPath('/does-not-exist')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(document.title).toBe('Page not found | Steven Wilssens')
  })

  it('treats generated .html paths as their page', () => {
    setPath('/about.html')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
  })

  it.each([
    ['/about', 'About'],
    ['/experience', 'Experience'],
    ['/work', 'Selected work'],
    ['/recommendations', 'Recommendations'],
    ['/patents', 'Patents'],
    ['/honors', 'Honors & awards'],
    ['/news', 'In the News'],
    ['/projects', 'Projects & interests'],
    ['/privacy', 'Privacy'],
  ])('renders the %s page', (path, heading) => {
    setPath(path)
    render(<App />)

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('updates SEO title and description for the current page', () => {
    setPath('/experience')
    document.head.innerHTML = '<meta name="description" content="">'
    render(<App />)

    expect(document.title).toBe('Experience | Steven Wilssens')
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', expect.stringContaining('spatial audio'))
  })

  it('links navigation to real paths', () => {
    render(<App />)

    const navigation = within(screen.getByRole('navigation'))
    expect(navigation.getByRole('link', { name: 'Experience' })).toHaveAttribute('href', '/experience')
    expect(navigation.getByRole('link', { name: 'Selected work' })).toHaveAttribute('href', '/work')
    expect(navigation.queryByRole('link', { name: 'Honors' })).not.toBeInTheDocument()
    expect(navigation.getByRole('link', { name: 'In the News' })).toHaveAttribute('href', '/news')
    expect(navigation.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects')
  })

  it('expands and collapses a complete recommendation', () => {
    setPath('/recommendations')
    render(<App />)

    const moreButton = screen.getAllByRole('button', { name: 'more' })[0]
    expect(moreButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(moreButton)
    expect(screen.getByRole('button', { name: 'less' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Steven’s straightforward style made working with him/)).toBeInTheDocument()
  })

  it('links recommendation authors to their LinkedIn profiles', () => {
    setPath('/recommendations')
    render(<App />)

    expect(screen.getByRole('link', { name: /Jayant Arora/ })).toHaveAttribute('href', 'https://www.linkedin.com/in/arorajayant/')
    expect(screen.getByRole('link', { name: /Varnitha Sonnegowda/ })).toHaveAttribute('href', 'https://www.linkedin.com/in/varnitha/?skipRedirect=true')
  })

  it('scrolls from a graph node to its matching experience entry', () => {
    setPath('/experience')
    const scrollIntoView = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /Go to.*Lead Developer and Team Lead/ }))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('exposes all news article links', () => {
    setPath('/news')
    render(<App />)

    expect(screen.getAllByRole('link', { name: 'Read article ↗' })[0]).toHaveAttribute('href', 'https://na.alienwarearena.com/ucf/show/1987916/boards/gaming-news/News/all-xbox-one-consoles-to-get-dolby-atmos-audio-upmixing')
    expect(screen.getAllByRole('link', { name: 'Read article ↗' })).toHaveLength(5)
  })

  it('links every project to its site', () => {
    setPath('/projects')
    render(<App />)

    const links = screen.getAllByRole('link', { name: 'Visit project ↗' })
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['https://wilssens.com', 'https://aibreaker.org', 'https://juniortrackcycling.com', 'https://leo.wilssens.com'])
  })

  it('lists this site as a project without linking away to it', () => {
    setPath('/projects')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'steven.wilssens.com' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Visit steven\.wilssens\.com/ })).not.toBeInTheDocument()
  })

  it('renders the write-up about this site with its sections, numbers and links', () => {
    setPath('/building-this-site')
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Building steven.wilssens.com' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /One file, five outputs/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /The loop: interview, review, edit, merge/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'privacy page' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'wilssens.com' })).toHaveAttribute('href', '/building-wilssens')
    expect(screen.getByRole('link', { name: /Download the résumé/ })).toHaveAttribute('href', '/steven-wilssens-resume-2026.pdf')
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument()
    expect(document.title).toBe('Building steven.wilssens.com | Steven Wilssens')
  })
})
