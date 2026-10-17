// The questions the panel offers before the first one is typed. A few fit the
// page the reader is on; the rest fill up from the pool, so no two pages start
// the same way.
export type Suggestion = { text: string; pages?: string[] }

export const pool: Suggestion[] = [
  { text: 'What did Steven do at Microsoft most recently?', pages: ['home', 'about'] },
  { text: 'What kind of role is he looking for?', pages: ['home', 'about'] },
  { text: 'How does he lead product teams?', pages: ['home', 'recommendations', 'about'] },
  { text: 'Give me the short version of his career.', pages: ['experience', 'home'] },
  { text: 'Why did he move from spatial audio to data?', pages: ['experience'] },
  { text: 'What are his biggest results, with numbers?', pages: ['experience', 'home'] },
  { text: 'What do people who reported to him say?', pages: ['recommendations'] },
  { text: 'What are his patents about?', pages: ['patents'] },
  { text: 'How does he use AI in his own work?', pages: ['projects', 'building-wilssens', 'building-aibreaker', 'building-this-site', 'about'] },
  { text: 'What is wilssens.com and why did he build it?', pages: ['projects', 'building-wilssens'] },
  { text: 'What is AI Breaker and why did he build it?', pages: ['projects', 'building-aibreaker'] },
  { text: 'Which awards has he received?', pages: ['honors'] },
  { text: 'What was the press coverage about?', pages: ['news'] },
  { text: 'Is he a fit for a Director of Product, Data Platform role?', pages: ['home', 'experience'] },
  { text: 'How can I get in touch with him?' },
]

export const pickSuggestions = (page: string, count = 4): string[] => {
  const fitting = pool.filter((item) => item.pages?.includes(page))
  const rest = pool.filter((item) => !item.pages?.includes(page))
  // Rotate the remainder by day so returning readers see something new.
  const offset = Math.floor(Date.now() / 86_400_000) % Math.max(rest.length, 1)
  const rotated = [...rest.slice(offset), ...rest.slice(0, offset)]
  return [...fitting, ...rotated].slice(0, count).map((item) => item.text)
}
