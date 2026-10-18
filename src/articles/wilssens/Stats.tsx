// The headline numbers of a Building write-up. The page carries the figures from the
// last refresh (feed.json next to the article, written by the Site update workflow);
// when the project has a live feed, article.ts fetches today's from /api/building/<project>
// and counts each figure on to it. [key in the feed, prefix, decimals, label]
export type Feed = { asOf: string; numbers: Record<string, number> }
export type Stat = [string, string, number, string]

export function Stats({ project, feed, items, live = true }: { project: string; feed: Feed; items: Stat[]; live?: boolean }) {
  return <dl className="wx-stats" data-feed={live ? `/api/building/${project}` : undefined}>{items.map(([key, prefix, decimals, label]) => {
    const value = feed.numbers[key] ?? 0
    return <div key={key}><dt>{prefix}<span data-count={value} data-stat={key} data-decimals={decimals}>{value.toFixed(decimals)}</span></dt><dd>{label}</dd></div>
  })}</dl>
}
