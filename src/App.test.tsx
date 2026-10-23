import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { about, experiences, profile } from './resume'

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
    // Three hero facts, as the designer signed off: the work arrangement is on the kicker line instead (D-23).
    const facts = [...document.querySelectorAll('.hero-facts > span')].map((span) => span.textContent)
    expect(facts).toHaveLength(3)
    expect(facts[2]).toBe('Seattle, Washington · US permanent resident (green card)')
    expect(screen.getByRole('heading', { name: 'Hiring a product leader for data, experimentation or AI?' })).toBeInTheDocument()
    expect(screen.getByText(/Available now, based in Seattle, Washington, a US permanent resident/)).toBeInTheDocument()
    expect(screen.getAllByText(/choosing my next/).length).toBeLessThanOrEqual(1)
  })

  it('puts the work arrangement next to the location on the first screen, and in the contact band', () => {
    const { container } = render(<App />)

    // The kicker reads as one phrase in the HTML; CSS puts the arrangement on its own line.
    expect(container.querySelector('.hero-kicker')!.textContent).toBe(`${profile.name} · ${profile.location} · ${profile.workArrangement}`)
    expect(container.querySelector('.kicker-sep')!.textContent).toBe(' · ')
    expect(container.querySelector('.hero-arrangement')!.textContent).toBe(profile.workArrangement)
    expect([...container.querySelectorAll('.hero-facts span')].map((span) => span.textContent)).toEqual([`Open to: ${profile.lookingFor[0].toLowerCase()}${profile.lookingFor.slice(1)}`, `Principal · Group PM · led ${profile.teamSize}`, `${profile.location} · ${profile.workAuthorization}`])
    const band = within(screen.getByRole('heading', { name: 'Hiring a product leader for data, experimentation or AI?' }).closest('section')!).getByText(/^Available now/)
    expect(band.textContent!.startsWith(`${profile.availability}, based in ${profile.location}, a US permanent resident. ${profile.workArrangement}. Email me,`)).toBe(true)
    expect(band.textContent!.startsWith('Available now, based in Seattle, Washington, a US permanent resident. Hybrid or remote, across time zones. Email me,')).toBe(true)
    // Twice on the home page, counting each element by its own text: the kicker line and the band.
    const own = (element: Element) => [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join('')
    expect([...container.querySelectorAll('*')].filter((element) => own(element).toLowerCase().includes(profile.workArrangement.toLowerCase()))).toHaveLength(2)
    // The facts for a close read stay on the About page.
    for (const value of [profile.citizenship, profile.travel, profile.employers, profile.relocation]) expect(container.textContent).not.toContain(value)
  })

  it('shows the selected work from the data and AI years, and a source only where the case has one', () => {
    setPath('/work')
    render(<App />)
    const card = (title: string) => screen.getByRole('heading', { name: title }).closest('article') as HTMLElement

    expect(screen.getByRole('heading', { name: 'Selected work' })).toBeInTheDocument()
    // Windows quality is in Steven's own words: the measured outcome, no attribution and no empty meta row.
    const quality = card('Windows quality, measured from preview channels to retail')
    expect(within(quality).getByText('Adopted by every Windows team, and behind the roughly 30% drop in issue days across Perfect Day scenarios.')).toBeInTheDocument()
    expect(within(quality).queryByText(/As described by/)).toBeNull()
    expect(within(quality).queryByRole('link', { name: 'Amit Gupte' })).toBeNull()
    expect(quality.querySelector('.work-meta')).toBeNull()
    // The forecast and the OKR tool keep Amit Gupte's attribution.
    for (const title of ['Forecasting how a Windows AI feature would land', 'An OKR tool, rebuilt with AI when the old one retired']) {
      const other = card(title)
      expect(within(other).getByText(/As described by/)).toBeInTheDocument()
      expect(within(other).getByRole('link', { name: 'Amit Gupte' })).toBeInTheDocument()
    }
    expect(within(card('An OKR tool, rebuilt with AI when the old one retired')).getByText(/Built in six months to replace Viva Goals, Microsoft’s acquired OKR product, after it was retired\.$/)).toBeInTheDocument()
    // A card with a link and no source keeps its meta row, with the link only.
    const audio = card('Spatial audio, from a Windows feature to a platform')
    expect(within(audio).getByText('Monthly active devices playing spatial audio grew more than 250% in 18 months, and the work produced 19 granted US patents.')).toBeInTheDocument()
    expect(audio.querySelector('.work-meta')).toHaveTextContent('See the patents →')
    expect(within(audio).queryByText(/As described by/)).toBeNull()
    expect(screen.getByRole('link', { name: /Read the write-up/ })).toHaveAttribute('href', '/building-wilssens')
  })

  it('moves the honors into the About sidebar with the hiring logistics', () => {
    setPath('/about')
    render(<App />)

    expect(screen.getByText('Seattle, Washington')).toBeInTheDocument()
    const honorItems = within(screen.getByRole('list', { name: 'Honors and awards' })).getAllByRole('listitem')
    expect(honorItems).toHaveLength(5)
    expect(honorItems[0]).toHaveTextContent('Selected for Microsoft’s High Potential (HiPo) program')
    expect(honorItems[0]).toHaveTextContent('Issued by Microsoft')
    // The logistics as one group, in the order a recruiter's screen asks them.
    const aside = document.querySelector('aside.side-note')!
    const labels = [...aside.querySelectorAll(':scope > span')].map((span) => span.textContent)
    expect(labels.slice(labels.indexOf('Based in'), labels.indexOf('Education') + 1)).toEqual(['Based in', 'Work authorization', 'Work arrangement', 'Travel', 'Employers', 'Relocation', 'Education'])
    const valueOf = (label: string) => [...aside.querySelectorAll(':scope > span')].find((span) => span.textContent === label)!.nextElementSibling!.textContent
    expect(valueOf('Work authorization')).toBe(`${profile.workAuthorization} · ${profile.citizenship}`)
    expect(valueOf('Work authorization')).toBe('US permanent resident (green card) · Belgian citizen (EU)')
    expect(valueOf('Work arrangement')).toBe(profile.workArrangement)
    expect(valueOf('Travel')).toBe(profile.travel)
    expect(valueOf('Travel')).toBe('Open to coordinated travel')
    expect(valueOf('Employers')).toBe(profile.employers)
    expect(valueOf('Relocation')).toBe(profile.relocation)
  })

  it('lists five honors on /honors, the HiPo selection first with "Issued by Microsoft" as its line', () => {
    setPath('/honors')
    const { container } = render(<App />)

    const list = container.querySelector('.archive-list.honor')!
    const titles = within(list as HTMLElement).getAllByRole('heading', { level: 2 })
    expect(titles).toHaveLength(5)
    expect(titles[0]).toHaveTextContent('Selected for Microsoft’s High Potential (HiPo) program')
    expect(titles[0].nextElementSibling).toHaveTextContent(/^Issued by Microsoft$/)
    expect(titles[1]).toHaveTextContent('Microsoft Lighthouse Award for Teamwork')
  })

  it('renders the About copy from src/resume.ts, the first paragraph as the green opening', () => {
    setPath('/about')
    const { container } = render(<App />)

    expect(container.querySelector('.page-heading p')).toHaveTextContent(about.intro)
    const paragraphs = [...container.querySelectorAll('.reading-main p')]
    expect(paragraphs.map((paragraph) => paragraph.textContent)).toEqual(about.paragraphs)
    expect(paragraphs.map((paragraph) => paragraph.className)).toEqual(about.paragraphs.map((_, index) => (index === 0 ? 'intro-paragraph' : '')))
  })

  it('names the latest Microsoft role in the About side note, not the first entry', () => {
    setPath('/about')
    render(<App />)

    expect(screen.getByText('Principal Group Product Manager, Microsoft')).toBeInTheDocument()
    expect(experiences[0].key).not.toBe('windows-devices-data')
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

  it('shows the team-growth bullets under the Windows Data roles on the experience page', () => {
    setPath('/experience')
    render(<App />)

    const bulletsOf = (role: string) => within(screen.getByRole('heading', { name: role }).closest('.timeline-item') as HTMLElement).getAllByRole('listitem')
    const lead = bulletsOf('Principal Product Manager Lead - Windows Data')
    expect(lead[0]).toHaveTextContent(/^Redefined Windows quality measurement .* Perfect Day metric/)
    expect(lead[1]).toHaveTextContent('Grew the team from one to five direct reports, leading to promotion to Principal Group Product Manager.')
    expect(bulletsOf('Principal Group Product Manager - Windows & Devices Data')[0]).toHaveTextContent('Led a PM organization of about 20, initially through three people managers, then led its move to a flatter team of about 12 during Microsoft’s cost reductions; roughly half the team was promoted under my leadership.')
    expect(screen.queryByText(/Led a PM organization of 10 to 20/)).toBeNull()
    expect(screen.queryByText(/designed its move to a flatter structure/)).toBeNull()
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

  it('says on /privacy what the assistant keeps, for how long, and what it removes', () => {
    setPath('/privacy')
    render(<App />)
    const text = screen.getByText(/If you use “Ask about Steven”/).textContent
    expect(text).toContain('kept for 90 days with the same daily code')
    expect(text).toContain('Email addresses, phone numbers and keys are removed first')
    expect(text).toContain('kept only as its length and first words')
    expect(text).toContain('requirements the site does not cover are kept, without the posting')
    expect(text).toContain('After 90 days everything is deleted, except the questions I have answered or set aside: of those only the question itself stays')
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

  it('overlays a scroll arrow on the graph only toward roles that are out of view', () => {
    setPath('/experience')
    const scrollBy = vi.fn()
    window.HTMLElement.prototype.scrollBy = scrollBy
    Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 1180 })
    Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 600 })
    render(<App />)

    // The hidden arrow has no accessible name while it is aria-hidden, so it is found by its class.
    const back = document.querySelector('.graph-arrow-back') as HTMLElement
    const forward = screen.getByRole('button', { name: 'Earlier roles' })
    expect(back).toHaveAttribute('aria-label', 'More recent roles')
    expect(back).toHaveAttribute('aria-hidden', 'true')
    expect(back).not.toHaveClass('is-shown')
    expect(forward).toHaveClass('is-shown')

    fireEvent.click(forward)
    expect(scrollBy).toHaveBeenCalledWith({ left: 480, behavior: 'smooth' })

    const scroller = document.querySelector('.graph-scroll') as HTMLElement
    Object.defineProperty(scroller, 'scrollLeft', { configurable: true, value: 580 })
    fireEvent.scroll(scroller)
    expect(back).toHaveClass('is-shown')
    expect(forward).not.toHaveClass('is-shown')

    delete (window.HTMLElement.prototype as { scrollWidth?: unknown }).scrollWidth
    delete (window.HTMLElement.prototype as { clientWidth?: unknown }).clientWidth
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
