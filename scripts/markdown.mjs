// Turns a prerendered page into Markdown for LLMs and AI agents. Written for this site's own
// markup only: headings, paragraphs, lists, links, quotes and emphasis. Used by scripts/prerender.mjs.

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code) => code[0] !== '#' ? entities[code] ?? match : String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))))

const convert = (html, siteUrl) => html
  .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g, (_, inner) => `\n\n${convert(inner, siteUrl).trim().split('\n').map((line) => `> ${line}`.trimEnd()).join('\n')}\n\n`)
  .replace(/<a [^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, text) => {
    const label = text.replace(/<[^>]+>/g, '').trim()
    return href.startsWith('#') ? label : `[${label}](${decode(href).startsWith('/') ? siteUrl : ''}${decode(href)})`
  })
  .replace(/<\/?strong>/g, '**')
  .replace(/<cite>/g, ' — ')
  .replace(/<h([1-6])[^>]*>/g, (_, level) => `\n\n${'#'.repeat(Number(level))} `)
  .replace(/<\/h[1-6]>/g, '\n\n')
  .replace(/<li[^>]*>/g, '\n- ')
  .replace(/<\/?(?:p|div|section|article|aside|figure|figcaption|ul|ol|main|footer)\b[^>]*>/g, '\n\n')
  .replace(/<[^>]+>/g, ' ')

export const htmlToMarkdown = (html, siteUrl) => {
  const content = [html.match(/<main\b[^>]*>([\s\S]*)<\/main>/)?.[1], html.match(/<footer>[\s\S]*<\/footer>/)?.[0]]
  if (!content[0] || !content[1]) throw new Error('htmlToMarkdown: no <main> or <footer>')
  const markdown = convert(content.join('<p>---</p>')
    .replace(/<!-- -->/g, '')
    // Controls, icons, images, and decorative numbers and initials.
    .replace(/<(button|svg)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<(span|div) class="(?:section-number|archive-index|avatar)"[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<a class="back-link"[^>]*>[\s\S]*?<\/a>/g, '')
    .replace(/<img[^>]*>/g, '')
    // Experience: put each role's heading before its company and dates.
    .replace(/<div class="timeline-date">([^<]*)<\/div><div class="timeline-body"><span class="company-label">([^<]*)<\/span>(<h2>[\s\S]*?<\/h2>)/g, '$3<p>$2 · $1</p>')
    // Separate runs of inline items, such as patent records and link rows.
    .replace(/<\/(span|a)>(?=<(?:span|a)\b)/g, '</$1> · '), siteUrl)
  return decode(markdown)
    .replace(/\s*[↗→↓]/g, '')
    .split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim().replace(/^(?:· ?)+/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n'
}
