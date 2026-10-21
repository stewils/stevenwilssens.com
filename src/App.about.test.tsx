// The About page renders whatever the data holds as text: markup stays text, two equal
// paragraphs both render, and only the first one is the green opening.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./resume', async (importOriginal) => {
  const real = await importOriginal<typeof import('./resume')>()
  return { ...real, about: { intro: 'An <i>intro</i> line.', paragraphs: ['<img src=x onerror=alert(1)>', 'Twice.', 'Twice.', 'A [link](https://x) and <b>x</b>.'] } }
})

afterEach(() => { cleanup(); window.history.pushState({}, '', '/') })

describe('the About page', () => {
  it('renders About paragraphs as text, keeps the green style on the first, and keys by index', () => {
    window.history.pushState({}, '', '/about')
    const { container } = render(<App />)
    const main = container.querySelector('.reading-main')!
    const paragraphs = [...main.querySelectorAll('p')]
    expect(paragraphs.map((paragraph) => paragraph.textContent)).toEqual(['<img src=x onerror=alert(1)>', 'Twice.', 'Twice.', 'A [link](https://x) and <b>x</b>.'])
    expect(paragraphs.map((paragraph) => paragraph.classList.contains('intro-paragraph'))).toEqual([true, false, false, false])
    expect(main.querySelector('img, b, a')).toBeNull()
    expect(container.querySelector('.page-heading p')!.textContent).toBe('An <i>intro</i> line.')
    expect(container.querySelector('.page-heading i')).toBeNull()
  })
})
