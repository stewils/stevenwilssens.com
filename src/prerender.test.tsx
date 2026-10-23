// @vitest-environment node
// What the prerender writes into dist/ is what a reader without JavaScript (and a crawler) gets.
import { describe, expect, it } from 'vitest'
import { render } from './entry-server'
import { profile } from './resume'

describe('the prerendered pages', () => {
  it('prerenders the work arrangement on /about', () => {
    const html = render('/about')
    expect(html).toContain('<span>Work arrangement</span>')
    expect(html).toContain(`<strong>${profile.workArrangement}</strong>`)
    expect(html).toContain('Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating.')
  })
})
