// @vitest-environment node
// The build writes these strings as the static HTML of each page, so what is here is
// what a recruiter (or a crawler) reads before any JavaScript runs.
import { describe, expect, it } from 'vitest'
import { render } from './entry-server'
import { profile } from './resume'

describe('the prerendered pages', () => {
  it('puts the work arrangement in the prerendered home and About HTML', () => {
    const home = render('/')
    expect(home).toContain(`<span>${profile.workArrangement}</span>`)
    expect(home.indexOf(profile.workArrangement)).toBeGreaterThan(home.indexOf('US permanent resident (green card)</span>'))
    expect(render('/about')).toContain(`<span>Work arrangement</span><strong>${profile.workArrangement}</strong>`)
  })
})
