import { resumePdf } from './ResumePage'

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

export function LinksPage() {
  return (
    <>
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
