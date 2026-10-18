// The headline numbers of a Building write-up. The page carries the figures from the
// last refresh (feed.json next to the article, written by the Site update workflow);
// once it loads, article.ts fetches the live ones from /api/building/<project> and counts
// each figure on to today's value. [key in the feed, prefix, decimals, label]
export type Feed = { asOf: string; numbers: Record<string, number> }
export type Stat = [string, string, number, string]

export function Stats({ project, feed, items }: { project: string; feed: Feed; items: Stat[] }) {
  return <dl className="wx-stats" data-feed={`/api/building/${project}`}>{items.map(([key, prefix, decimals, label]) => {
    const value = feed.numbers[key] ?? 0
    return <div key={key}><dt>{prefix}<span data-count={value} data-stat={key} data-decimals={decimals}>{value.toFixed(decimals)}</span></dt><dd>{label}</dd></div>
  })}</dl>
}
