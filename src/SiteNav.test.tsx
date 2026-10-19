import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SiteNav from './SiteNav'
import type { Page } from './pageMeta'

const items: [Page, string][] = [['about', 'About'], ['experience', 'Experience'], ['work', 'Selected work'], ['recommendations', 'Recommendations'], ['patents', 'Patents']]

// jsdom lays nothing out: every label is given a width, the nav a width, and ResizeObserver
// is a stub the test can fire, so the "fit" logic runs as it does in a browser.
let navWidth = 1000
let resize: (() => void) | null = null
const observe = vi.fn()
const disconnect = vi.fn()

beforeEach(() => {
  navWidth = 1000
  resize = null
  observe.mockReset()
  disconnect.mockReset()
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe = observe; disconnect = disconnect })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => navWidth)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const links = () => screen.getByRole('navigation', { name: 'Main' }).querySelectorAll(':scope > a')
const shownLabels = () => [...links()].map((link) => link.textContent)

describe('SiteNav', () => {
  it('shows every link when they fit and marks the current page', () => {
    render(<SiteNav items={items} page="work" />)
    expect(shownLabels()).toEqual(['About', 'Experience', 'Selected work', 'Recommendations', 'Patents'])
    expect(screen.getByRole('link', { name: 'Selected work' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'About' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('button', { name: /More|Menu/ })).not.toBeInTheDocument()
    expect(observe).toHaveBeenCalled()
  })

  it('moves what does not fit into More, always keeping the current page in view', async () => {
    navWidth = 400 // three links of 100px and the More button
    render(<SiteNav items={items} page="patents" />)
    expect(shownLabels()).toEqual(['About', 'Experience', 'Patents'])
    const more = screen.getByRole('button', { name: 'More' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    const panel = document.getElementById(more.getAttribute('aria-controls')!)!
    expect(panel).toBeVisible()
    expect([...panel.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual(['/work', '/recommendations'])
    await userEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'false')
  })

  it('collapses to a single Menu on phones, and grows back when the window widens', () => {
    navWidth = 150
    render(<SiteNav items={items} page="about" />)
    expect(shownLabels()).toEqual([])
    expect(screen.getByRole('navigation')).toHaveClass('menu-only')
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
    navWidth = 1000
    act(() => resize!())
    expect(shownLabels()).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
  })

  it('closes the menu on Escape (focus back on the button), on a click outside, and when focus leaves it', async () => {
    navWidth = 150
    render(<><SiteNav items={items} page="about" /><p>Outside</p><button type="button">Elsewhere</button></>)
    const menu = screen.getByRole('button', { name: 'Menu' })

    await userEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(menu).toHaveFocus()

    await userEvent.click(menu)
    fireEvent.pointerDown(screen.getByRole('link', { name: 'About' }))
    expect(menu).toHaveAttribute('aria-expanded', 'true') // inside the menu: stays open
    fireEvent.pointerDown(screen.getByText('Outside'))
    expect(menu).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(menu)
    fireEvent.blur(menu, { relatedTarget: screen.getByRole('link', { name: 'About' }) })
    expect(menu).toHaveAttribute('aria-expanded', 'true') // focus moved within the menu
    fireEvent.blur(menu, { relatedTarget: screen.getByRole('button', { name: 'Elsewhere' }) })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
  })

  it('refits once the web fonts are in, and stops observing when it goes away', async () => {
    let fontsReady: () => void = () => {}
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((resolve) => { fontsReady = resolve }) } })
    try {
      const view = render(<SiteNav items={items} page="about" />)
      expect(shownLabels()).toHaveLength(5)
      navWidth = 400
      await act(async () => { fontsReady(); await Promise.resolve() })
      expect(shownLabels()).toHaveLength(3)
      view.unmount()
      expect(disconnect).toHaveBeenCalled()
    } finally {
      Reflect.deleteProperty(document, 'fonts')
    }
  })

  it('shows every link and measures nothing in a browser without ResizeObserver', () => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'ResizeObserver')
    navWidth = 150
    render(<SiteNav items={items} page="about" />)
    expect(shownLabels()).toHaveLength(5)
  })
})
