// The Markdown copy of each page (index.md, llms-full.txt): the home kicker reads as one
// line with one separator, and runs of inline items still get theirs.
import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from './markdown.mjs'
import { render } from '../src/entry-server.tsx'
import { profile } from '../src/resume'

const siteUrl = 'https://steven.wilssens.com'
const page = (main) => `<html><body><main>${main}</main><footer><a href="/privacy">Privacy</a></footer></body></html>`

describe('htmlToMarkdown', () => {
  it('reads the home kicker as location · arrangement, with one separator', () => {
    const markdown = htmlToMarkdown(render('/'), siteUrl)
    expect(markdown.split('\n')).toContain(`${profile.location} · ${profile.workArrangement}`)
    expect(markdown).not.toContain(`${profile.location} · ·`)
  })

  it('keeps the separator span as text and adds no second one after it', () => {
    expect(htmlToMarkdown(page('<p><span>Seattle</span><span class="kicker-sep"> · </span><span>Remote</span></p>'), siteUrl)).toBe('Seattle · Remote\n\n---\n\n[Privacy](https://steven.wilssens.com/privacy)\n')
  })

  it('still separates other runs of inline items', () => {
    expect(htmlToMarkdown(page('<p><span>One</span><span>Two</span><a href="/three">Three</a></p>'), siteUrl)).toBe('One · Two · [Three](https://steven.wilssens.com/three)\n\n---\n\n[Privacy](https://steven.wilssens.com/privacy)\n')
  })
})
