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

    expect(screen.getByRole('heading', { name: 'Product leadership for the next chapter.' })).toBeInTheDocument()
    expect(screen.getByText('250%+')).toBeInTheDocument()
    expect(screen.getByText('1B+')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Leadership that turns ambiguity into momentum.' })).toBeInTheDocument()
    expect(screen.getByText('Executive communication')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Email Steven/ })).toHaveAttribute('href', 'mailto:steven@wilssens.com')
    expect(screen.getByRole('link', { name: /Connect on LinkedIn/ })).toHaveAttribute('href', 'https://www.linkedin.com/in/steven-wilssens-59495889/')
  })

  it.each([
    ['/about', 'About'],
    ['/experience', 'Experience'],
    ['/recommendations', 'Recommendations'],
    ['/patents', 'Patents'],
    ['/honors', 'Honors & awards'],
    ['/news', 'In the News'],
    ['/projects', 'Projects & interests'],
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

    fireEvent.click(screen.getByRole('button', { name: /Scroll to Lead Developer and Team Lead/ }))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('exposes all news article links', () => {
    setPath('/news')
    render(<App />)

    expect(screen.getAllByRole('link', { name: 'Read article ↗' })[0]).toHaveAttribute('href', 'https://na.alienwarearena.com/ucf/show/1987916/boards/gaming-news/News/all-xbox-one-consoles-to-get-dolby-atmos-audio-upmixing')
    expect(screen.getAllByRole('link', { name: 'Read article ↗' })).toHaveLength(5)
  })

  it('exposes both external project links', () => {
    setPath('/projects')
    render(<App />)

    expect(screen.getAllByRole('link', { name: 'Visit project ↗' })[0]).toHaveAttribute('href', 'https://juniortrackcycling.com')
    expect(screen.getAllByRole('link', { name: 'Visit project ↗' })[1]).toHaveAttribute('href', 'https://leo.wilssens.com')
  })
})
