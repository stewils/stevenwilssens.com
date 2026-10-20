// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PRICE } from './ask/agent'
import { costOf, PRICES, PRICES_READ, PRICING_URL, priceOf, type Tokens } from './prices'

const none: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }

describe('the price table', () => {
  it('names the page it was read from and the day', () => {
    expect(PRICING_URL).toBe('https://platform.claude.com/docs/en/about-claude/pricing')
    expect(PRICES_READ).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('has all five kinds of token for every model, as whole micro-dollars per million tokens', () => {
    for (const [model, price] of Object.entries(PRICES)) {
      expect(Object.keys(price).sort(), model).toEqual(['cacheRead', 'cacheWrite1h', 'cacheWrite5m', 'input', 'output'])
      for (const value of Object.values(price)) expect(Number.isSafeInteger(value) && value > 0, model).toBe(true)
    }
  })

  it('prices each kind of token of claude-opus-5-5 at the page’s rate, worked out by hand', () => {
    // $4 input, $20 output, $0.20 cache read, $5 5-minute write, $8 1-hour write per MTok.
    expect(costOf('claude-opus-5-5', { ...none, input: 1_000_000 })).toBe(4_000_000)
    expect(costOf('claude-opus-5-5', { ...none, output: 1000 })).toBe(20_000)
    expect(costOf('claude-opus-5-5', { ...none, cacheRead: 910_000 })).toBe(182_000)
    expect(costOf('claude-opus-5-5', { ...none, cacheWrite5m: 2000 })).toBe(10_000)
    expect(costOf('claude-opus-5-5', { ...none, cacheWrite1h: 31_249 })).toBe(249_992)
    expect(costOf('claude-fable-5-1', { input: 12, output: 3400, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 })).toBe(170_120)
  })

  it('matches a date-suffixed id to its base, and a fast id only to a fast price', () => {
    expect(priceOf('claude-opus-4-8-20260801')).toBe(PRICES['claude-opus-4-8'])
    expect(priceOf('claude-opus-5-5:fast')).toBe(PRICES['claude-opus-5-5:fast'])
    expect(priceOf('claude-opus-5-5-20261001:fast')).toBe(PRICES['claude-opus-5-5:fast'])
    expect(priceOf('claude-fable-5-1:fast')).toBeNull()
  })

  it('has no price, never zero, for a model it does not list', () => {
    expect(priceOf('claude-x-1')).toBeNull()
    expect(costOf('claude-x-1', { ...none, output: 5 })).toBeNull()
    expect(priceOf('__proto__')).toBeNull()
    expect(costOf('claude-opus-5-5', none, {})).toBeNull()
  })

  it('is what the assistant counts its own spend with', () => {
    expect(PRICE).toEqual({ input: 4, output: 20, cacheRead: 0.2, cacheWrite: 8 })
  })
})
