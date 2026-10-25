import { formatTime } from './format'
import { Markdown } from './markdown'
import { resumePdf } from './ResumePage'
import type { Draft, DraftSummary } from './types'

// Every address for running the site, in one place. Cloudflare's ":account" links open
// in the signed-in account; nothing here is a secret.
const site = 'https://steven.wilssens.com'
const repo = 'https://github.com/stewils/stevenwilssens.com'
const groups: { title: string; links: [string, string, string][] }[] = [
  { title: 'The site', links: [
    ['Home', site, 'What recruiters see'],
    ['Résumé PDF', `${site}${resumePdf}`, 'Generated from src/resume.ts by npm run resume:build'],
    ['Résumé report', `${site}/resume-report.json`, 'The score and findings of the live résumé, written by the build'],
    ['Markdown copies', `${site}/llms.txt`, 'The short guide to the site for LLMs, with a Markdown copy of every page'],
    ['Sitemap', `${site}/sitemap.xml`, 'Every page with its last change'],
  ] },
  { title: 'Cloudflare', links: [
    ['Pages project', 'https://dash.cloudflare.com/?to=/:account/pages/view/stevenwilssens', 'Deployments, previews, custom domain, secrets'],
    ['D1 database', 'https://dash.cloudflare.com/?to=/:account/workers/d1', 'stevenwilssens-analytics: events, crawls, the dossier, proposals, scores'],
    ['Web Analytics', 'https://dash.cloudflare.com/?to=/:account/web-analytics', "Cloudflare's own visitor numbers, for comparison"],
  ] },
  { title: 'GitHub', links: [
    ['Repository', repo, 'The code and the data'],
    ['Deploy runs', `${repo}/actions/workflows/deploy.yml`, 'Every push: lint, tests, build, résumé score against the live site, deploy'],
    ['Site update runs', `${repo}/actions/workflows/site-update.yml`, 'Claude Code editing the site on a branch from an MCP request'],
    ['Pull requests', `${repo}/pulls`, 'Site updates waiting for your review and merge'],
  ] },
  { title: 'Profiles', links: [
    ['LinkedIn', 'https://www.linkedin.com/in/steven-wilssens', 'Must tell the same story as the site; compare_linkedin in the MCP checks'],
  ] },
  { title: 'Outside checks', links: [
    ['PageSpeed Insights', `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(site)}`, "Google's lab and field speed report"],
    ['Rich results test', `https://search.google.com/test/rich-results?url=${encodeURIComponent(site)}`, 'Whether Google reads the structured data'],
    ['Google Search Console', 'https://search.google.com/search-console', 'Search queries, indexing, Core Web Vitals as Google sees them'],
    ['Bing Webmaster Tools', 'https://www.bing.com/webmasters', 'Indexing at Bing (and so Copilot and ChatGPT search)'],
    ['LinkedIn Post Inspector', `https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(site)}`, 'How a link to the site previews on LinkedIn'],
  ] },
]

// What /api/drafts answered: the list, or why not (null while it loads); and the opened draft the same way.
export type DraftsState = { list: DraftSummary[] } | { error: string } | null
export type DraftState = { draft: Draft } | { error: string } | null

// One draft, opened from Links → Drafts (#links?read=<slug>): its text comes from the database
// with the admin token, never from the bundle.
function DraftReader({ slug, state }: { slug: string; state: DraftState }) {
  return (
    <section className="card" data-part="Draft">
      <p><a href="#links">← All links and drafts</a></p>
      {state === null && <p className="empty">Loading the draft…</p>}
      {state && 'error' in state && <p className="empty">{state.error === 'HTTP 404' ? `There is no draft called ${slug}.` : `The draft could not be loaded (${state.error}).`}</p>}
      {state && 'draft' in state && (
        <article className="draft">
          <div className="card-head"><h2>{state.draft.title}</h2></div>
          <p className="draft-meta">Draft, only for you · updated {formatTime(state.draft.updatedAt)}</p>
          <Markdown source={state.draft.body} />
        </article>
      )}
    </section>
  )
}

function Drafts({ state }: { state: DraftsState }) {
  return (
    <section className="card" data-part="Drafts">
      <div className="card-head"><h2>Drafts</h2></div>
      <p className="note">Only for you: the text is kept in the database and read with your admin token, not published on the site.</p>
      {state === null && <p className="empty">Loading the drafts…</p>}
      {state && 'error' in state && <p className="empty">The drafts could not be loaded ({state.error}).</p>}
      {state && 'list' in state && (state.list.length === 0 ? <p className="empty">No drafts yet.</p> : (
        <ul className="linklist">
          {state.list.map((draft) => (
            <li key={draft.slug}><a href={`#links?read=${draft.slug}`}><strong>{draft.title}</strong><small>{draft.summary}</small><code>updated {formatTime(draft.updatedAt)}</code></a></li>
          ))}
        </ul>
      ))}
    </section>
  )
}

export function LinksPage({ drafts = null, reading = null, draft = null }: { drafts?: DraftsState; reading?: string | null; draft?: DraftState } = {}) {
  if (reading) return <DraftReader slug={reading} state={draft} />
  return (
    <>
      <Drafts state={drafts} />
      {groups.map((group) => (
        <section className="card" key={group.title} data-part={group.title}>
          <div className="card-head"><h2>{group.title}</h2></div>
          <ul className="linklist">
            {group.links.map(([name, url, what]) => (
              <li key={url}><a href={url} target="_blank" rel="noreferrer"><strong>{name} ↗</strong><small>{what}</small><code>{url.replace(/^https:\/\//, '')}</code></a></li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
