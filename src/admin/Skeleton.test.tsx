import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CardSkeleton, PageSkeleton, Shimmer } from './Skeleton'

afterEach(cleanup)

describe('loading placeholders', () => {
  it('tells screen readers what is loading and draws three placeholder cards', () => {
    const { container } = render(<PageSkeleton what="visitor data" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading visitor data…')
    expect(container.querySelectorAll('section.card')).toHaveLength(3)
    expect(container.querySelectorAll('.shimmer-chart')).toHaveLength(1)
  })

  it('draws lines instead of a chart when asked', () => {
    const { container } = render(<PageSkeleton what="the résumé report" chart={false} />)
    expect(container.querySelector('.shimmer-chart')).toBeNull()
    expect(container.querySelectorAll('.shimmer:not(.shimmer-title)')).toHaveLength(4 + 4 + 3)
  })

  it('keeps its own class names tidy', () => {
    const { container } = render(<><Shimmer /><Shimmer className="kpi" /><CardSkeleton lines={2} /></>)
    expect(container.querySelectorAll('span')[0].className).toBe('shimmer')
    expect(container.querySelectorAll('span')[1].className).toBe('shimmer kpi')
    expect(container.querySelector('section')).toHaveAttribute('aria-hidden', 'true')
  })
})
