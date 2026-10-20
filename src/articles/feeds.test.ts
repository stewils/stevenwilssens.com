// Every number a Building write-up shows is in its feed.json: the first string of each tuple
// in `const stats: Stat[]` and every `feed.numbers.<key>` the article reads. The header shows
// 0 for a missing key, so a refresh that drops one (AI Breaker's live feed sends only
// visitorCountries30d) fails here, in npm test, where the refresh's pull request shows it.
// The sources are read as text, so the components need no extra export.
import { describe, expect, it } from 'vitest'

const sources = import.meta.glob<string>('./*/*Article.tsx', { query: '?raw', import: 'default', eager: true })
const feeds = import.meta.glob<{ numbers: Record<string, number> }>('./*/feed.json', { import: 'default', eager: true })
const articles = Object.keys(sources).sort().map((path) => [path.slice(2), path.split('/')[1]] as const)

// The keys an article reads from its feed.
const keysOf = (source: string) => {
  const stats = /const stats: Stat\[\] = (\[[^\n]*\])\s*\n/.exec(source)?.[1] ?? ''
  const fromStats = [...stats.matchAll(/\[\s*'([A-Za-z][A-Za-z0-9]*)'\s*,\s*'[^']*'\s*,\s*\d+\s*,/g)].map((match) => match[1])
  const fromText = [...source.matchAll(/\bfeed\.numbers\.([A-Za-z][A-Za-z0-9]*)/g)].map((match) => match[1])
  return [...new Set([...fromStats, ...fromText])]
}

describe('the Building write-ups read only numbers their feed has (AC-8)', () => {
  it('finds every article', () => {
    expect(articles.map(([path]) => path)).toEqual(['aibreaker/AIBreakerArticle.tsx', 'juniortrackcycling/JuniorTrackCyclingArticle.tsx', 'leo/LeoArticle.tsx', 'site/SiteArticle.tsx', 'wilssens/WilssensArticle.tsx'])
  })

  it.each(articles)('%s yields at least one key, and every one is in its feed.json', (path, name) => {
    const keys = keysOf(sources[`./${path}`])
    expect(keys.length, `${path}: no stats keys found; was \`const stats: Stat[]\` reworded?`).toBeGreaterThan(0)
    const feed = feeds[`./${name}/feed.json`]
    expect(feed, `${name}/feed.json`).toBeDefined()
    const missing = keys.filter((key) => !Object.hasOwn(feed.numbers, key))
    expect(missing, `${name}/feed.json lacks what ${path} shows`).toEqual([])
  })

  it('reads the stats tuples and the feed.numbers keys, and nothing from a reworded declaration', () => {
    const source = "const stats: Stat[] = [['levels', '', 0, 'levels'], ['cost', '$', 2, `of ${feed.numbers.budget} cap`]]\nconst x = feed.numbers.extra\n"
    expect(keysOf(source)).toEqual(['levels', 'cost', 'budget', 'extra'])
    expect(keysOf("const items: Stat[] = [['levels', '', 0, 'levels']]\n")).toEqual([])
  })
})
