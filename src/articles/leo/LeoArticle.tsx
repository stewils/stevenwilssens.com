import { useEffect, useRef, type ReactNode } from 'react'
import home from '../../assets/articles/leo/home.jpg'
import games from '../../assets/articles/leo/games.jpg'
import partners from '../../assets/articles/leo/partners.jpg'
import { openAsk } from '../../ask/open'
import { BuildFlowDiagram, PublishRulesDiagram } from './Diagrams'
// The reading tools (progress bar, contents, counters, lightbox) and the styles are
// shared with the wilssens.com write-up; all the write-ups use the same .wx classes.
import { enhanceArticle } from '../wilssens/article'
import { Stats, type Stat } from '../wilssens/Stats'
import feed from './feed.json'
import '../wilssens/article.css'

// The write-up of how leo.wilssens.com was built, linked from /projects. Facts come from
// the project's CLAUDE.md, its design spec, deploy notes and commit history as of
// 18 October 2026; nothing about Leo beyond what his own site publishes.
// Screenshots: public pages of leo.wilssens.com.

const sections = [
  ['rules', 'The rules came first'],
  ['separate', 'Separate on purpose'],
  ['static', 'Static, dark, kinetic'],
  ['real', 'Real results only'],
  ['games', 'Four games'],
  ['shipping', 'Shipping without a slip'],
  ['building', 'How it was built'],
  ['practices', 'Best practices'],
  ['next', 'What’s next'],
] as const

const articleUrl = 'https://steven.wilssens.com/building-leo'
const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`

// What is on the site, not effort: feed.json, from the repository as of the last refresh.
// [key in the feed, prefix, decimals, label]
const stats: Stat[] = [['sections', '', 0, 'sections, from a palmares laid out like a start list to a games arcade'], ['games', '', 0, 'browser games about the sport, playable without an install or an account'], ['roadRidesPublished', '', 0, 'road rides published: a GPS trace of a minor never reaches the build'], ['contactRoutes', '', 0, 'way to get in touch, and it goes to a parent']]

const Figure = ({ children, caption }: { children: ReactNode; caption: string }) => <figure className="wx-figure wx-diagram"><div className="wx-diagram-scroll" role="group" aria-label={caption} tabIndex={0}>{children}</div><figcaption>{caption}</figcaption></figure>

const Shot = ({ src, alt, caption, host, width, height }: { src: string; alt: string; caption: string; host: string; width: number; height: number }) => <figure className="wx-figure wx-shot">
  <button className="wx-shot-frame" type="button" data-zoom={src} data-zoom-alt={alt} aria-label={`Enlarge: ${alt}`}>
    <span className="wx-shot-bar" aria-hidden="true"><span /><span /><span /><span className="wx-shot-url">{host}</span></span>
    <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
    <span className="wx-zoom-hint" aria-hidden="true">⤢</span>
  </button>
  <figcaption>{caption}</figcaption>
</figure>

const H2 = ({ id, kicker, children }: { id: string; kicker: string; children: ReactNode }) => <h2 id={id} className="wx-h2"><span className="wx-kicker">{kicker}</span>{children}</h2>

export default function LeoArticle() {
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => rootRef.current ? enhanceArticle(rootRef.current) : undefined, [])

  return <article className="wx" ref={rootRef}>
    <div className="wx-progress" aria-hidden="true"><span /></div>

    <header className="wx-hero">
      <a className="back-link" href="/projects">← Projects</a>
      <p className="wx-eyebrow">Project write-up · leo.wilssens.com</p>
      <h1 className="is-long">Building leo.wilssens.com</h1>
      <p className="wx-dek">A sponsor-facing site for an eleven-year-old track racer, where the rules for publishing about a minor were written before the first page, and enforced in the build rather than in good intentions.</p>
      <p className="wx-meta">Steven Wilssens · October 2026 · <span data-read-time>10 min read</span></p>
      <Stats project="leo" feed={feed} items={stats} live={false} />
      <div className="wx-actions">
        <button className="primary-button" type="button" onClick={() => openAsk()}>Ask the assistant about my work</button>
        <a className="text-link" href={linkedInShare} target="_blank" rel="noreferrer">Share on LinkedIn ↗</a>
        <button className="text-link wx-copy" type="button" data-copy={articleUrl}>Copy link</button>
      </div>
    </header>

    <div className="wx-layout">
      <div className="wx-toc" role="navigation" aria-label="On this page">
        <details open>
          <summary>On this page</summary>
          <ol>{sections.map(([id, label]) => <li key={id}><a href={`#${id}`} data-toc={id}>{label}</a></li>)}</ol>
        </details>
      </div>

      <div className="wx-body">
        <aside className="wx-brief" aria-labelledby="brief">
          <h2 id="brief">What this shows about how I lead products</h2>
          <p>The smallest site I run has the strictest rules, because its subject is my son. It is a good test of a habit: write the constraints first, put them in the code, and let the design be bold inside them.</p>
          <ul>
            <li><strong>Safety as data selection, not display.</strong> What must never be published is excluded where the data is chosen and where the build runs, so no template can leak it. <a href="#rules">The rules came first</a></li>
            <li><strong>Separate what must not be confused.</strong> A neutral community site and an athlete’s promotion share a family, not a codebase, a domain or a project. <a href="#separate">Separate on purpose</a></li>
            <li><strong>Accuracy over polish.</strong> Real results only, placeholders a parent confirms, bike parts that stay unconfirmed until verified. <a href="#real">Real results only</a></li>
            <li><strong>A build that cannot ship a mistake.</strong> A separate type gate, a deploy that refuses to run without its secrets, and media that fails the build if it cannot be cleaned. <a href="#shipping">Shipping without a slip</a></li>
          </ul>
          <p><strong>Why a product leader still builds:</strong> I built this with Claude Code, after <a href="/building-wilssens">wilssens.com</a> and alongside <a href="/building-juniortrackcycling">juniortrackcycling.com</a>, and this one has a reader who matters more than any recruiter: a parent deciding whether the person behind a site about a child can be trusted.</p>
        </aside>

        <p className="wx-lede">leo.wilssens.com is a media kit for Leo, a junior track sprinter: results, race reports, photos, training rides from the velodrome, four games he is credited with on the site, and a page for the sponsors a season of racing needs. It is a static Astro site on Cloudflare, a small Worker behind it, and eight weeks of evenings between a design spec on 20 August 2026 and the last commit in mid October.</p>

        <p>Everything about it follows from one fact: the subject is a minor. That fact sets who can be contacted, what can be shown, what can never be shown, and how the site is built so that the second list stays empty by construction.</p>

        <section aria-labelledby="rules">
          <H2 id="rules" kicker="01">The rules came first</H2>
          <p>Before the first page, the design spec and the project’s instructions file fixed the safety rails, and they have not moved since. Every sponsorship conversation goes to a parent, through one address; there is no way to reach Leo through the site. Results, palmares and action photos are fine. His school, home town, training schedule and location are never published. Race reports are written after an event, never as a calendar of where he will be. Season goals name major public events only.</p>
          <Figure caption="Inputs pass through filters that live in the data selection and the build. What is on the bottom row never enters the build at all."><PublishRulesDiagram /></Figure>
          <p>The rule I care most about is where those rules live. The site shows training rides from the velodrome, pulled at build time from the training platform I describe in <a href="/building-juniortrackcycling">the other write-up</a>. A road ride is a GPS trace of a child, so road rides are excluded when the rides are selected, not hidden when they are displayed: a template cannot show a ride the build never received. Dates are published at day precision only. Every photo and video the build fetches is stripped of its metadata, the EXIF and XMP blocks and the location boxes inside video files, and nothing fetched is ever served byte for byte. Instagram posts are synced into a database as unapproved and wait for a parent’s approval before the site or the media endpoint can publish them, and the sync asks for no location fields.</p>
          <p>The analytics follow the same thinking: no IP addresses, no full browser strings, visitor identifiers protected with a keyed hash, Do Not Track honoured, nothing kept beyond thirteen months, and a privacy page that says so in plain words. There are no accounts and no comments.</p>
        </section>

        <section aria-labelledby="separate">
          <H2 id="separate" kicker="02">Separate on purpose</H2>
          <p>Leo’s site began as a planned page at wilssens.com/leo, listed as the second property of the junior track cycling hub. On 20 August 2026 I decided it would be neither: its own repository, its own Cloudflare Pages project, its own address. The hub must read as a neutral community resource; this site is one rider’s promotion. The moment they share code or a domain, the hub looks like a vehicle for him, and its credibility is its value.</p>
          <p>Separate does not mean disconnected. The site lives at a wilssens.com name, as every family site does, with DNS still at the registrar and a single record pointing at Cloudflare. It reads the training platform’s activity API at build time for the rides page, with a key, and its first palmares entry was copied from the hub’s nationals results rather than typed. It borrows two patterns from this site: the admin sign-in behind a token and the deploy-token setup.</p>
          <Shot src={home} width={1440} height={900} host="leo.wilssens.com" alt="The leo.wilssens.com home page: a photo of Leo riding on a velodrome, his name in large type, the outlined initials LW, a line reading national-level junior track sprinter, a View results button, an About Leo paragraph in his own words and a card with his 6th place in the 500 m time trial at the junior track nationals" caption="The home page. One accent colour, one typeface for words and a monospace face for anything that is data, and a result card laid out like a start list." />
        </section>

        <section aria-labelledby="static">
          <H2 id="static" kicker="03">Static, dark, kinetic</H2>
          <p>The stack is locked in the instructions file so that nobody, including the AI I build with, re-proposes it: Astro, strict TypeScript, static output only, no server adapter, and no client-side framework islands at all. The interactivity that exists, a gallery lightbox, the mobile menu, the games, is plain scripts, and since October the build hashes every inline script into the Content Security Policy header, so a script the build did not write does not run. Content is three Markdown collections, palmares, stories and albums, with a schema that makes a draft the default.</p>
          <ul className="wx-points">
            <li><strong>Dark only, one accent.</strong> A near-black background, one acid yellow for emphasis, one red. No light theme to maintain. Tokens live in one file and components use only the variables.</li>
            <li><strong>Mono means data.</strong> Inter for everything written; JetBrains Mono only for values a reader treats as data: times, points, positions, years in tables. A monospace label is a bug. Headings are sentence case, with hierarchy from weight and size, not capitals.</li>
            <li><strong>Two signatures.</strong> A giant outlined mark in the hero, a race number in the spec and his initials since September, and a palmares laid out like a start list. The velodrome photo and the animated hero came later; the rules about what moves did not change.</li>
          </ul>
          <p>Static output is a safety decision as much as a performance one. There is no server rendering a page with a child’s data on request; there are files, produced by a build I can read, from inputs I chose.</p>
        </section>

        <section aria-labelledby="real">
          <H2 id="real" kicker="04">Real results only</H2>
          <p>A media kit is a document a sponsor may check. The accuracy rules are short and absolute. Results are real and never rounded; the palmares holds three entries from one season, including a sixth place in the 500 metre time trial at the junior track nationals, timed to the thousandth, and a thirteenth in the omnium that a less honest site would have left out. Everything marked as a placeholder, the contact address, the bio, the photos, the season goals, must be confirmed by a parent before the address is announced, and the checklist for that is in the deploy notes.</p>
          <p>The bike page lists the parts of his bike, and each entry stays marked unconfirmed until the exact part is verified. The rule says never to infer a component from a photo. In the training-ride game described below, the fastest times on each segment are real fastest times from real players, not invented ones. None of this is hard; it is the discipline of saying less than you could.</p>
          <Shot src={partners} width={1440} height={900} host="leo.wilssens.com" alt="The Partners page of leo.wilssens.com: Partner with Leo, three value propositions for a sponsor, a note that all partnership conversations go through Leo’s parent or guardian, four season goals for 2027 and a Get in touch section" caption="The sponsor page: what a partner gets, four public goals for next season, and the one sentence that is not negotiable." />
        </section>

        <section aria-labelledby="games">
          <H2 id="games" kicker="05">Four games</H2>
          <p>The games are the part of the site a sponsor will not read and the part Leo opens first. The site credits them to him, and they are about the sport he races: Ride Day, an arcade satire of the training ride where you dodge car doors, dogs and potholes across eight days and chase the fastest time on each segment; a match sprint standoff that follows the real start rules and the sprinters’ lane; an elimination race; and a points race. They run in the browser on their own pages, with a keyboard on a computer and touch on a phone, no install and no account.</p>
          <Shot src={games} width={1440} height={900} host="leo.wilssens.com" alt="The Games page of leo.wilssens.com: a large outlined 04 beside the word games, and the first game, Ride Day, described as an arcade satire of the training ride, with a pixel-art road scene, eight days a week, three lives and a top-ten high-score table" caption="Ride Day, the first of the four: procedural pixel art on one canvas, sound from the Web Audio API, and no new dependency added to the site." />
          <p>Technically they are the most code on the site: pixel art drawn procedurally on a small canvas, sound synthesised rather than loaded, and the high-score tables and segment records kept in the Worker’s database, falling back to the device when the table cannot be reached. A day after the fourth game shipped, the four were packaged as one free desktop game with Electron, in its own folder that imports the web code rather than copying it, where the track games unlock after a week of Ride Day. Leo keeps giving me feedback on them. He likes the games and he is an honest critic, and it has been fun to watch him look at a product with the candour a young person brings.</p>
        </section>

        <section aria-labelledby="shipping">
          <H2 id="shipping" kicker="06">Shipping without a slip</H2>
          <p>On a site like this the expensive mistake is not a bug; it is a deploy that publishes something it should not, or an empty build that wipes what was there. The pipeline is built against both.</p>
          <Figure caption="Content, athlete data and the training platform’s API go through one build into static files. A push to main is checked, built and tested before a deploy that refuses to run without its secrets."><BuildFlowDiagram /></Figure>
          <ul className="wx-points">
            <li><strong>A separate type gate.</strong> The Astro build ignores type errors, so the type check is its own required step, and the instructions file says why, so nobody removes it to save a minute.</li>
            <li><strong>A deploy that refuses.</strong> Since 28 September, deploys run from GitHub Actions after the checks pass, and the deploy step stops if the Cloudflare token or the training platform’s credentials are missing: an empty build cannot replace the live site. Before that, the honest note in the commit history says, pushes to main did not deploy at all.</li>
            <li><strong>Media that fails the build.</strong> If a photo or video cannot be parsed well enough to strip its metadata, the build fails rather than ships it.</li>
            <li><strong>One server, behind a proxy.</strong> The only server code is a Worker for the Instagram sync, the analytics, the admin page and the game scores, with its own database. It has no public address of its own; the site reaches it through Pages Functions on the same origin, and the admin sits behind a long token.</li>
          </ul>
          <p>In October the dependencies went through a security audit that cleared every finding outside the development tools, and the framework moved a major version in the same change. The parked list in the instructions file records the one upgrade that was tried and reverted, and why, so it is not tried again blind.</p>
        </section>

        <section aria-labelledby="building">
          <H2 id="building" kicker="07">How it was built</H2>
          <p>The first two commits, on 20 August 2026, are a design spec marked approved and an implementation plan of ten tasks, from scaffold to the first push. Code came third. The spec fixed the purpose, the safety rails, the stack and the design system; the plan was written for an agent to execute task by task, with a commit after each. The next day’s commit is a verification report: the checks that ran, what the rendered HTML was searched for, one heading per page, no scripts, the current page marked in the navigation, and screenshots from a headless browser.</p>
          <p>Across 126 commits on 16 working days, most written with Claude Code and for a few weeks in late August and September with GitHub Copilot, the instructions file grew into the real product document: what is settled, what is parked, the trap in the local network setup that rewrites the lockfile, and the rule that it must be checked after every install. The busiest day was 6 October, when three of the four games arrived in thirty-two commits.</p>
          <p className="wx-callout">The instructions file is the contract. It says what may never be published, what is settled, and what is parked. The AI reads it before every session, and so do I.</p>
        </section>

        <section aria-labelledby="practices">
          <H2 id="practices" kicker="08">Best practices</H2>
          <ol className="wx-practices">
            <li><strong>Write the safety rules before the first page, then put them in the data path.</strong> Exclude at selection and at build time; never rely on a template to hide something.</li>
            <li><strong>Keep promotion and community apart.</strong> Separate repository, project and domain, so neither can be mistaken for the other.</li>
            <li><strong>Lock the stack in writing.</strong> Settled decisions, with dates, that an AI assistant is told not to re-propose. It saves every session from starting with a debate.</li>
            <li><strong>Make the build the gate.</strong> A type check that cannot be skipped, a deploy that refuses without its secrets, media that fails the build when it cannot be cleaned.</li>
            <li><strong>Say less than you could.</strong> Real results, confirmed facts, unconfirmed parts marked as such. A sponsor who finds one invention stops trusting the rest.</li>
            <li><strong>Keep a parked list.</strong> What was tried and reverted, and why, next to what is deferred, so good ideas are not re-litigated and bad ones are not retried blind.</li>
          </ol>
        </section>

        <section aria-labelledby="next">
          <H2 id="next" kicker="09">What’s next</H2>
          <p>Before the address is announced to anyone, the placeholders go: a real contact address for a parent, a bio he has read, a photograph of the bike. The Instagram sync waits for storage to be switched on and the approval step to be used for real. The sponsor page gets a downloadable deck. And the open design question from the parked list, whether the palmares should lead with the strongest result or the latest, is his to answer, not mine.</p>
          <p>This write-up is refreshed from the project’s repository after every check-in; the numbers in the header are counted from it.</p>
          <div className="wx-end">
            <p>Ask the assistant something a recruiter would ask.</p>
            <div className="wx-actions">
              <button className="primary-button" type="button" onClick={() => openAsk()}>Ask about Steven</button>
              <a className="text-link" href="https://leo.wilssens.com" target="_blank" rel="noreferrer">Visit leo.wilssens.com ↗</a>
              <a className="text-link" href={linkedInShare} target="_blank" rel="noreferrer">Share on LinkedIn ↗</a>
              <a className="text-link" href="/projects">More projects →</a>
            </div>
          </div>
        </section>
      </div>
    </div>

    <dialog className="wx-lightbox" aria-label="Enlarged screenshot"><form method="dialog"><button type="submit" aria-label="Close">×</button></form><img alt="" /></dialog>
  </article>
}
