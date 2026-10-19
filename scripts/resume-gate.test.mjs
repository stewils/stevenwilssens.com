// The resume gate's exit code (scripts/resume-gate.mjs): what --fail-on-drop lets through.
import { describe, expect, it } from 'vitest'
import { gateExit, unavailableMessages } from './resume-gate.mjs'

const baseline = (change) => ({ source: 'https://steven.wilssens.com/resume-report.json', score: 100 - change, change, lower: change < 0 })
const report = (extra = {}) => ({ errors: 0, baseline: null, ...extra })

describe('the resume gate with --fail-on-drop', () => {
  const gate = (r, baselineRequested = true) => gateExit({ report: r, baselineRequested, failOnDrop: true })

  it('fails on a drop', () => {
    expect(gate(report({ baseline: baseline(-1) }))).toBe(1)
  })

  it('passes an equal or a higher score', () => {
    expect(gate(report({ baseline: baseline(0) }))).toBe(0)
    expect(gate(report({ baseline: baseline(5) }))).toBe(0)
  })

  it('refuses to compare when the baseline could not be read', () => {
    expect(gate(report({ baseline: null }))).toBe(2)
  })

  it('passes when no baseline was asked for', () => {
    expect(gate(report(), false)).toBe(0)
  })

  it('fails on errors in the PDF, whatever the baseline', () => {
    expect(gate(report({ errors: 2, baseline: baseline(3) }))).toBe(1)
    expect(gate(report({ errors: 1 }))).toBe(1)
  })
})

describe('the resume check without --fail-on-drop', () => {
  it('only fails on errors: a drop and an unreadable baseline are warnings', () => {
    expect(gateExit({ report: report({ baseline: baseline(-4) }), baselineRequested: true })).toBe(0)
    expect(gateExit({ report: report(), baselineRequested: true })).toBe(0)
    expect(gateExit({ report: report({ errors: 1 }) })).toBe(1)
  })
})

describe('the message when the baseline is unavailable', () => {
  it('names the source, and adds an error annotation in GitHub Actions', () => {
    const [text, ...rest] = unavailableMessages('https://nonexistent.invalid/x.json')
    expect(text).toContain('https://nonexistent.invalid/x.json could not be read')
    expect(rest).toEqual([])
    const lines = unavailableMessages('base.json', { githubActions: true })
    expect(lines[1]).toBe(`::error title=Resume baseline unavailable::${lines[0]}`)
  })
})
