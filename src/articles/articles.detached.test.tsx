import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Each write-up adds its reading tools (enhanceArticle) once its <article> is in the page.
// If the element is not there when the effect runs, the write-up still renders, complete
// and still, with nothing hidden. A ref that never attaches stands in for that case.
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useRef: (initial: unknown) => initial === null ? { get current() { return null }, set current(_value: unknown) { /* never attaches */ } } : react.useRef(initial) }
})
const enhanceArticle = vi.hoisted(() => vi.fn(() => () => {}))
vi.mock('./wilssens/article', async (importOriginal) => ({ ...(await importOriginal<typeof import('./wilssens/article')>()), enhanceArticle }))

const { default: WilssensArticle } = await import('./wilssens/WilssensArticle')
const { default: AIBreakerArticle } = await import('./aibreaker/AIBreakerArticle')
const { default: SiteArticle } = await import('./site/SiteArticle')
const { default: JuniorTrackCyclingArticle } = await import('./juniortrackcycling/JuniorTrackCyclingArticle')
const { default: LeoArticle } = await import('./leo/LeoArticle')

afterEach(() => cleanup())

describe('a write-up whose element is not available to enhance', () => {
  it.each([WilssensArticle, AIBreakerArticle, SiteArticle, JuniorTrackCyclingArticle, LeoArticle])('still renders, without the reading tools (%#)', (Article) => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<Article />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(enhanceArticle).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
