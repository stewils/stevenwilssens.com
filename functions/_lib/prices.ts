// Anthropic's API prices, per model and per kind of token, in micro-dollars per million
// tokens ($4 / MTok is 4_000_000). The one price table: the assistant's own spend
// (functions/_lib/ask/agent.ts) and the admin's development costs both read it. Prices only,
// no cost data. Read from the pricing page on the date below; when a price changes, change it
// here and every figure priced from tokens follows, history included.
export const PRICING_URL = 'https://platform.claude.com/docs/en/about-claude/pricing'
export const PRICES_READ = '2026-10-19'

export type TokenKind = 'input' | 'output' | 'cacheRead' | 'cacheWrite5m' | 'cacheWrite1h'
export type Price = Record<TokenKind, number>
export type Tokens = Record<TokenKind, number>

// 5-minute cache writes are 1.25x input, 1-hour writes 2x; cache reads as the page lists them.
// Fast mode (Opus only) has its own base prices, with the caching multipliers on top.
export const PRICES: Record<string, Price> = {
  'claude-fable-5-1': { input: 10_000_000, output: 50_000_000, cacheRead: 250_000, cacheWrite5m: 12_500_000, cacheWrite1h: 20_000_000 },
  'claude-fable-5': { input: 10_000_000, output: 50_000_000, cacheRead: 1_000_000, cacheWrite5m: 12_500_000, cacheWrite1h: 20_000_000 },
  'claude-opus-5-5': { input: 4_000_000, output: 20_000_000, cacheRead: 200_000, cacheWrite5m: 5_000_000, cacheWrite1h: 8_000_000 },
  'claude-opus-5-5:fast': { input: 8_000_000, output: 40_000_000, cacheRead: 400_000, cacheWrite5m: 10_000_000, cacheWrite1h: 16_000_000 },
  'claude-opus-5': { input: 5_000_000, output: 25_000_000, cacheRead: 500_000, cacheWrite5m: 6_250_000, cacheWrite1h: 10_000_000 },
  'claude-opus-4-8': { input: 5_000_000, output: 25_000_000, cacheRead: 500_000, cacheWrite5m: 6_250_000, cacheWrite1h: 10_000_000 },
  'claude-sonnet-5-5': { input: 2_000_000, output: 10_000_000, cacheRead: 100_000, cacheWrite5m: 2_500_000, cacheWrite1h: 4_000_000 },
}

// The price of a model id: exactly, then without a date suffix (claude-x-20260101). A fast
// id (<id>:fast) has a price only when the table lists one; never the standard price.
export const priceOf = (model: string, table: Record<string, Price> = PRICES): Price | null => {
  if (Object.hasOwn(table, model)) return table[model]
  const [id, speed] = model.split(':')
  const base = id.replace(/-\d{8}$/, '') + (speed === undefined ? '' : `:${speed}`)
  return Object.hasOwn(table, base) ? table[base] : null
}

// What the tokens cost in micro-dollars, or null when the model has no price (never 0).
export const costOf = (model: string, tokens: Tokens, table: Record<string, Price> = PRICES): number | null => {
  const price = priceOf(model, table)
  if (!price) return null
  const kinds: TokenKind[] = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h']
  return Math.round(kinds.reduce((sum, kind) => sum + tokens[kind] * price[kind], 0) / 1_000_000)
}
