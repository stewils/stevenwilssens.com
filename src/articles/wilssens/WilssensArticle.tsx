import { useEffect, useRef, type ReactNode } from 'react'
import homeSearch from '../../assets/articles/wilssens/home-search.jpg'
import helpWebsite from '../../assets/articles/wilssens/help-website.jpg'
import directory from '../../assets/articles/wilssens/directory.jpg'
import helpAssistant from '../../assets/articles/wilssens/help-assistant.jpg'
import cliOwner from '../../assets/articles/wilssens/cli-owner.jpg'
import cliAdmin from '../../assets/articles/wilssens/cli-admin.jpg'
import { ActionCardsDiagram, ArchitectureDiagram, ExperimentLoopDiagram, HelpPathDiagram, LifecycleDiagram, MailBeforeAfterDiagram, PublishGateDiagram, SafetyPillarsDiagram, ThreeWaysDiagram } from './Diagrams'
import { enhanceArticle } from './article'
import './article.css'

// The write-up of how wilssens.com was built, linked from /projects.
// Screenshots: public pages of www.wilssens.com and the two command lines' help screens.

const sections = [
  ['domain', 'A family domain'],
  ['rules', 'Rules before features'],
  ['architecture', 'The architecture'],
  ['mailbox', 'Request to mailbox'],
  ['zoho', 'Why Zoho'],
  ['websites', 'Five ways to build'],
  ['three-ways', 'Website, MCP, CLI'],
  ['assistant', 'The AI helper'],
  ['safety', 'Keeping people safe'],
  ['running', 'Running it'],
  ['experiments', 'Experiments'],
  ['practices', 'Best practices'],
  ['next', 'What’s next'],
] as const

const articleUrl = 'https://steven.wilssens.com/building-wilssens'
const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`

// Outcomes, not effort, as of 15 October 2026. [value, prefix, decimals, label]
const stats: [number, string, number, string][] = [[3, '', 0, 'family mailboxes moved off Microsoft 365'], [5, '', 0, 'websites live on the family domain'], [16, '', 0, 'questions to the help assistant this month'], [1.26, '$', 2, 'AI help cost this month, of a $25 cap']]

const Figure = ({ children, caption }: { children: ReactNode; caption: string }) => <figure className="wx-figure wx-diagram"><div className="wx-diagram-scroll">{children}</div><figcaption>{caption}</figcaption></figure>

const Shot = ({ src, alt, caption, host, terminal = false, width, height }: { src: string; alt: string; caption: string; host?: string; terminal?: boolean; width: number; height: number }) => <figure className={`wx-figure wx-shot ${terminal ? 'is-terminal' : ''}`}>
  <button className="wx-shot-frame" type="button" data-zoom={src} data-zoom-alt={alt} aria-label={`Enlarge: ${alt}`}>
    {!terminal && <span className="wx-shot-bar" aria-hidden="true"><span /><span /><span /><span className="wx-shot-url">{host}</span></span>}
    <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
    <span className="wx-zoom-hint" aria-hidden="true">⤢</span>
  </button>
  <figcaption>{caption}</figcaption>
</figure>

const H2 = ({ id, kicker, children }: { id: string; kicker: string; children: ReactNode }) => <h2 id={id} className="wx-h2"><span className="wx-kicker">{kicker}</span>{children}</h2>

export default function WilssensArticle() {
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => rootRef.current ? enhanceArticle(rootRef.current) : undefined, [])

  return <article className="wx" ref={rootRef}>
    <div className="wx-progress" aria-hidden="true"><span /></div>

    <header className="wx-hero">
      <a className="back-link" href="/projects">← Projects</a>
      <p className="wx-eyebrow">Project write-up · wilssens.com</p>
      <h1>Building wilssens.com</h1>
      <p className="wx-dek">A family name, turned into a platform: how a search box became mailboxes, websites, AI apps and a command line, and the rules that kept it safe.</p>
      <p className="wx-ticker" aria-label="name@wilssens.com"><span className="wx-ticker-names" aria-hidden="true">{['jan', 'emma', 'lotte', 'marc', 'an'].map((name) => <span key={name}>{name}</span>)}</span><span className="wx-ticker-domain" aria-hidden="true">@wilssens.com</span></p>
      <p className="wx-meta">Steven Wilssens · October 2026 · <span data-read-time>15 min read</span></p>
      <dl className="wx-stats">{stats.map(([value, prefix, decimals, label]) => <div key={label}><dt>{prefix}<span data-count={value} data-decimals={decimals}>{value.toFixed(decimals)}</span></dt><dd>{label}</dd></div>)}</dl>
      <div className="wx-actions">
        <a className="primary-button" href="https://www.wilssens.com" target="_blank" rel="noreferrer">Visit wilssens.com ↗</a>
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
          <p>The scale is my immediate family, on purpose. The point is the rigor, applied at small scale, that I’d expect from a platform team at any size.</p>
          <ul>
            <li><strong>Rules first, enforced by the system.</strong> The few rules that matter (who owns a name, what stays private) are enforced by the database, not by code review, so no later feature can break them. <a href="#rules">Rules before features</a></li>
            <li><strong>Experimentation from day one.</strong> It started as a demand test, and every feature ships switched off, with named events and a funnel, the same loop I ran for Windows. <a href="#experiments">Experiments</a></li>
            <li><strong>AI restricted by architecture, not by prompt.</strong> The assistant can only offer actions the server has vetted, and its answers are signed. Trust, safety and impersonation were designed in. <a href="#assistant">The AI helper</a> · <a href="#safety">Keeping people safe</a></li>
          </ul>
          <p><strong>Why a product leader still builds:</strong> I build to stay sharp on what my teams ship, not to replace them. I built this with Claude Code, Anthropic’s AI coding tool, in 16 days. That pace came from a written decision log the AI read at the start of every session, which is how I’d run AI-assisted work on a team too. See <a href="#practices">Best practices</a>.</p>
        </aside>

        <p className="wx-lede">Today <a href="https://www.wilssens.com" target="_blank" rel="noreferrer">www.wilssens.com</a> runs my family’s email and websites: mailboxes moved off Microsoft 365 to one automated Zoho organization, five websites live, and a help assistant that answers relatives’ questions before they reach me.</p>

        <section aria-labelledby="domain">
          <H2 id="domain" kicker="01">A domain with a family attached</H2>
          <p>wilssens.com is our family domain. Anyone named Wilssens, and their household, can claim a name on it: <code>jan@wilssens.com</code> for email, <code>jan.wilssens.com</code> for a website, or both.</p>
          <p>It started on 29 September 2026 as a demand test. There was no sign-in and no payment, just a search box and a Request button, to answer one question: will Wilssens actually want this? Two weeks later the same site sets up real mailboxes, hosts real websites, runs server code with its own databases, lets AI apps publish sites directly, and answers questions in three languages.</p>
          <Shot src={homeSearch} width={1440} height={900} host="www.wilssens.com" alt="The wilssens.com home page: a first name typed into the search shows that name@wilssens.com and name.wilssens.com are available" caption="The home page. Type a first name and the site answers as you type; here, both addresses for “emma” are free." />
          <p>This is how it was designed, what is under the hood, and the best practices behind it.</p>
        </section>

        <section aria-labelledby="rules">
          <H2 id="rules" kicker="02">Rules before features</H2>
          <p>The most important design work was not code. It was a short list of rules about names, written down early and enforced in the database, so no future feature could quietly break them.</p>
          <ul className="wx-points">
            <li><strong>A name belongs to the person it is named after,</strong> not to whoever pays. A parent managing a household can stop paying for a child’s address, but can never reassign it or read its mail. The person can always take over.</li>
            <li><strong>Your name is yours for as long as you want it, and stays protected for 24 months after you give it up.</strong> When someone deletes their last service, the name goes into quarantine: mail to it bounces and only the original owner can bring it back. After two years someone else may claim it, but never with the old mail or settings. A database trigger refuses any other outcome, whatever the application code tries.</li>
            <li><strong>No public list of names or addresses.</strong> The site shows totals only: members, people waiting, countries. A list of family email addresses is a gift to spammers, and households include children. The one exception is an opt-in directory of websites, each one switched on by its own adult owner.</li>
            <li><strong>Prices live in exactly one file.</strong> Pages, the calculator, emails and the Stripe catalogue all read from it.</li>
          </ul>
          <Figure caption="The database itself refuses to hand a name to anyone else while it is owned or in quarantine."><LifecycleDiagram /></Figure>
          <p>These rules shaped everything after. Ownership checks, quarantine, and “start clean” when a name changes hands appear again in every feature below.</p>
        </section>

        <section aria-labelledby="architecture">
          <H2 id="architecture" kicker="03">Small parts, chosen on purpose</H2>
          <p>The whole platform runs on Cloudflare plus two outside services, Zoho for mail and Stripe for payments. There are no servers to patch.</p>
          <Figure caption="People, AI apps and command lines all come in through www; visitors of a family site come in through its own subdomain. Both reach the same storage and services."><ArchitectureDiagram /></Figure>
          <div className="wx-table-wrap">
            <table className="wx-table">
              <thead><tr><th>Part</th><th>What it does</th><th>Why this one</th></tr></thead>
              <tbody>
                {[
                  ['Astro, static pages', 'Every public page in English, Flemish and French', 'Fast, cheap, nothing to run; plain scripts, no framework'],
                  ['One Cloudflare Pages Function', 'The single API: search, requests, sign-in, accounts, admin', 'One door to guard instead of many'],
                  ['Cloudflare D1 (SQLite)', 'Requests, names, sites, sessions, usage', 'Bound directly to the Function, so there is no public database endpoint to lock down'],
                  ['Cloudflare R2', 'Hosted websites and screenshots', 'One object per site version keeps every page view to two storage calls'],
                  ['A second Pages project', 'Serves every name.wilssens.com', 'Owners’ sites never run on the main site’s address'],
                  ['Workers for Platforms', 'Each site’s own server code and database', 'Hard isolation per family member'],
                  ['Zoho Mail API', 'Mailboxes, forwarding, outgoing mail', 'One organization for the whole domain, DKIM-signed'],
                  ['Turnstile, PostHog', 'Spam protection, privacy-friendly analytics', 'No cookies for analytics, no visible captcha for most people'],
                ].map(([part, what, why]) => <tr key={part}><th scope="row">{part}</th><td data-label="What it does">{what}</td><td data-label="Why this one">{why}</td></tr>)}
              </tbody>
            </table>
          </div>
          <p>Two choices did most of the work. The database is reachable only through the Function, so there is no API key to leak and no row-level security to get wrong. And every hosted site is stored as a single packed file per version, which made publishing and serving cheap and predictable at any size.</p>
          <p>Tests run against a real copy of the schema, with every migration and trigger applied, on Node’s built-in SQLite. Every push runs tests, type checks and a build; a push to main also migrates the database, deploys, and checks that the family’s existing sites still answer.</p>
        </section>

        <section aria-labelledby="mailbox">
          <H2 id="mailbox" kicker="04">One click from request to working mailbox</H2>
          <p>A visitor searches a name and presses Request; no account needed. The search answers as you type: available, already requested (join the waiting list), taken, or in quarantine until a given month. The request is saved, and confirmation emails go out in the requester’s own language.</p>
          <p>Then one function does everything: <code>approveRequest()</code>. Today I trigger it with an Approve button in the admin. Once payments are switched on, a completed Stripe checkout calls exactly the same function, so the paid path and the free path can never drift apart. It:</p>
          <ol className="wx-steps">
            <li>Retires the name, so the database will refuse it to anyone else.</li>
            <li>Creates the address at Zoho: a forwarding group for email forwarding, or a full mailbox with a temporary password.</li>
            <li>Attaches <code>name.wilssens.com</code> at Cloudflare as a redirect or an empty hosted site, and waits for the certificate.</li>
            <li>Emails the owner when each part is live, in their language.</li>
          </ol>
          <p>Each step can fail without losing the request: emails are sent in the background and logged on failure, and a “Check now” button retries anything still queued. The temporary mailbox password is never emailed; the email carries a one-time link that shows it once.</p>
          <p>Owners then manage everything on their account page: switch forwarding to a mailbox, a redirect to a hosted site, add a service, or delete their profile. Deleting goes through the same quarantine rule as everything else.</p>
        </section>

        <section aria-labelledby="zoho">
          <H2 id="zoho" kicker="05">Why Zoho, and why automate it</H2>
          <p className="wx-callout">The biggest win is not a feature. It is that family mail became easy to support and cheaper to run.</p>
          <p>Before, our addresses lived on Microsoft 365 through GoDaddy: a separate paid plan per person, extra security add-ons, and every mailbox set up by hand. By 12 October every mailbox had moved to a single Zoho organization for the whole domain, for much less than we paid before.</p>
          <Figure caption="Family mail, before and after: Microsoft 365 through GoDaddy to one automated Zoho organization."><MailBeforeAfterDiagram /></Figure>
          <p>With Zoho’s API behind the Approve button, the operator’s work shrank to almost nothing:</p>
          <ul className="wx-points">
            <li><strong>A new mailbox takes minutes.</strong> I press Approve; the address, the password link and the welcome email follow on their own, in the person’s language.</li>
            <li><strong>Help starts without me.</strong> Relatives ask the help assistant first, which knows our guides for iPhone, Outlook, Windows and Zoho’s own settings. Only what it cannot solve reaches me.</li>
            <li><strong>I can see whether things work.</strong> The admin checks every address against Zoho, visits every website address, and flags anything that does not match, before a relative notices.</li>
            <li><strong>Mail apps set themselves up.</strong> Autoconfig, autodiscover and an iPhone profile fill in the server settings, so most people never type them.</li>
          </ul>
          <p>For one person supporting a whole family, that is the difference between a hobby and a help desk.</p>
        </section>

        <section aria-labelledby="websites">
          <H2 id="websites" kicker="06">Five ways to build a website, one door to publish</H2>
          <p>The family ranges from teenagers to grandparents, so there could not be one way to make a site. There are five, and all of them end in the same function, <code>publishSite()</code>, which applies the same checks every time.</p>
          <Shot src={helpWebsite} width={1440} height={900} host="www.wilssens.com/help/website" alt="The website help centre, whose header animation shows page maker, AI app, upload and code leading to a new version that goes live" caption="The website help centre. Its header animation is the whole idea in one picture: every way in produces a new version, and that version goes live." />
          <ul className="wx-points">
            <li><strong>A page maker</strong> for people who never want to see code. Pages are stored as data, not HTML: blocks for text, photos, galleries, video, maps, timelines and more, eight themes, three languages, and up to ten pages. Photos are re-encoded in the browser, so location data never reaches the public page.</li>
            <li><strong>Editing a live site in place.</strong> If a site was built some other way, the editor loads the real site, running, and lets you click on any text or photo and change it. Sections can be moved, hidden or duplicated, and styled per screen size.</li>
            <li><strong>Upload</strong> a file, a folder or a zip.</li>
            <li><strong>Your own AI app.</strong> The site speaks MCP, the protocol AI assistants use to connect to tools. Connect Claude or ChatGPT once with a standard OAuth sign-in, then say “add a photo gallery to my site” and the assistant reads the files, edits them and publishes a private draft for you to preview. Each site gets its own connector address, so an app connected to one site can never touch another.</li>
            <li><strong>A code editor or GitHub.</strong> The wilssens command line or a starter project gives you the site as a folder, with instructions for AI coding assistants already inside, a GitHub Action that publishes on every push, and deploy keys you can revoke.</li>
          </ul>
          <p>Every version is kept and immutable, so rolling back is one click. Drafts can be previewed on the real address with a one-time link, and only in the owner’s browser.</p>
          <p>The gate in front of all five is the same. Files with API keys are refused. A page with a sign-in form naming a bank or a mail provider is held for a human to review, so a family website can never become a phishing page on a trusted domain. Every page carries a small “Report this page” line.</p>
          <Figure caption="Whichever way a site is built, it meets the same checks, so a new way of building never opens a new hole."><PublishGateDiagram /></Figure>
          <p>For the curious, a site can also run <strong>server code with its own database</strong>. Each site gets its own isolated Worker and SQLite database, its own secrets, an hourly call for scheduled work, and monthly limits with warnings at 90%. Over a limit, only the site’s API pauses; the pages keep working. It is the same Cloudflare stack a company would use, sized for one family member’s hobby.</p>
          <p>Owners can then choose to list their site in the family directory or ask to be featured on the home page. Screenshots of each site, desktop and phone, are taken automatically twice a day.</p>
          <Shot src={directory} width={1440} height={900} host="www.wilssens.com/sites" alt="The family directory, showing listed sites with desktop and phone screenshots" caption="The family directory at /sites, filtered. Every card is there because its owner switched it on; the screenshots are taken automatically." />
        </section>

        <section aria-labelledby="three-ways">
          <H2 id="three-ways" kicker="07">Three ways in: the website, AI apps and the command line</H2>
          <p>Everything an owner or an admin can do exists three times: on a web page, as tools for AI apps over MCP, and in a command line. It is built only once, on the server, and all three call it.</p>
          <Figure caption="Owners and admins each get three ways in to one set of tools on the server."><ThreeWaysDiagram /></Figure>
          <p>The rule behind it is simple: a new action is written as a server handler first, then exposed as a tool, then given a page, a command and a test, with the same checks, confirmation and wording everywhere. Tests check that the same call through MCP and through the command line reaches the same handler and gives the same answer. That means an AI app can never do more than the website allows, and a feature is never “web only” by accident.</p>
          <h3>For website owners</h3>
          <ul className="wx-points">
            <li><strong>AI apps</strong> connect to <code>www.wilssens.com/mcp</code>, or to a per-site address, with a normal OAuth sign-in. They can read files, publish drafts, preview them, put a version live, read server-code logs, query the site’s database, and see or end the owner’s own sign-ins.</li>
            <li><strong>The <code>wilssens</code> command line</strong> uses the very same tools. <code>init</code> downloads the live site as a project folder, <code>dev</code> runs it on localhost with live reload (with <code>/api/</code> going to the real server code), and <code>site deploy --draft</code> publishes a private draft with a preview link.</li>
            <li>Two things deliberately never pass through an AI chat: making a new deploy key and typing a server-code secret. Those exist only on /account and in the command line, where secrets are typed hidden.</li>
          </ul>
          <Shot terminal src={cliOwner} width={1200} height={1115} alt="The wilssens command line for website owners, showing its help screen" caption="The owners’ command line. Commands that change something are marked with a flag, and every list can also come out as JSON, YAML or CSV." />
          <h3>For admins</h3>
          <p>The same idea, with tighter locks, because these tools can approve requests, delete mailboxes and switch things off.</p>
          <ul className="wx-points">
            <li><strong>An admin MCP server</strong> at <code>/adminmcp</code> gives an AI app everything /admin can do. Approving a connection needs a fresh Zoho sign-in with two-step verification, for that very approval; an existing session is never enough. Access tokens last 15 minutes and every connection ends after 30 days.</li>
            <li><strong>Anything that cannot be undone</strong> (deleting, declining, rejecting, switching off, ending sign-ins) needs the target typed back. Database queries are read-only, one SELECT at a time, and cannot touch sign-in, key or payment tables.</li>
            <li><strong>The <code>wilssens-admin</code> command line</strong> ships as a branded Windows installer and runs every admin tool from the terminal, plus an <strong>AI analyst</strong>: Claude with the admin tools, which reads the data itself and writes a briefing on demand, traffic, sites and problems. Requesters’ emails are masked before anything reaches the model, and it can propose actions but needs a typed yes.</li>
            <li><strong>One audit log</strong> records every call, from AI apps and the command line alike, each under its own name.</li>
          </ul>
          <Shot terminal src={cliAdmin} width={1200} height={950} alt="The wilssens-admin command line, showing its security, AI analyst and admin tool commands" caption="The admin command line: incident switches, the AI analyst, and the same tools the admin MCP server offers." />
          <h3>A command line built like the good ones</h3>
          <p>The command lines borrow their habits from gh, kubectl, git and the Stripe CLI:</p>
          <ul className="wx-points">
            <li>Commands are declared as data, so help pages, argument checks and shell completion are generated and can never drift apart.</li>
            <li>Commands return data and never print it themselves: every list can come out as a table, JSON, YAML, CSV or NDJSON, filtered with <code>--fields</code> or a small jq-like <code>--query</code>.</li>
            <li>Typos get “Did you mean …?”, errors say what to do next, and exit codes are documented.</li>
            <li>A person gets pickers and y/N prompts; a script never gets asked anything and must pass <code>--yes</code>. Every action supports <code>--dry-run</code>, and actions are never retried, so nothing is approved twice.</li>
            <li><code>doctor</code> checks the version, the sign-in, the server and, for admins, whether the family’s own sites still answer.</li>
          </ul>
          <h3>Coding agents included</h3>
          <p>Tell a coding agent “set up wilssens for my website” and it can do it alone, following the <code>AGENTS.md</code> that ships with the command line. The only step that needs the person is signing in: the command prints a link and opens the browser, and the person approves it on wilssens.com. No password, token or code ever passes through the agent.</p>
        </section>

        <section aria-labelledby="assistant">
          <H2 id="assistant" kicker="08">An AI helper that is restricted by design</H2>
          <p>The only AI the site runs itself is a help assistant on every page, built on Claude. It answers “how do I add my address to Outlook on my iPhone?” in English, Flemish or French, streams its answer, and links to the guide topics it used.</p>
          <Shot src={helpAssistant} width={1440} height={900} host="www.wilssens.com/help/email" alt="The help assistant panel open beside the email help centre, with suggested questions and a Cloudflare Turnstile check" caption="The help assistant docks beside the page. Visitors without an account pass a Turnstile check first; the footer reminds people never to share a password." />
          <p>It knows only what we send it: the email and website guides, the FAQ, the privacy text and the prices, about 12,000 tokens, cached for an hour. It may also use general knowledge of the apps people actually use, because “Outlook says this is the primary account” is exactly the kind of question the guide never covers.</p>
          <p>The interesting part is what it cannot do, enforced in code rather than in the prompt:</p>
          <ul className="wx-points">
            <li><strong>It offers; it never acts.</strong> It sees only the signed-in person’s own names, services and recent site versions. When something needs doing, it offers a card under its answer, and the person does the rest (below).</li>
            <li><strong>A hidden first line</strong> in every reply says whether the question was in scope. The server reads it and strips it; off-topic questions get our fixed answer, never the model’s.</li>
            <li><strong>Signed answers.</strong> The conversation lives in the visitor’s browser, so every answer carries a signature. A conversation containing an answer the server did not sign is refused, which closes the classic trick of feeding a model a fake earlier reply.</li>
            <li><strong>Abuse detection that acts on its own.</strong> Bursts, off-topic streaks or a cost spike first restrict the assistant to account holders, then switch it off, and email me once. Only a person can switch it back on.</li>
            <li><strong>A monthly budget</strong> of $25, counted from the API’s own token numbers.</li>
          </ul>
          <Figure caption="The model writes the answer, but the server decides whether it is shown."><HelpPathDiagram /></Figure>
          <h3>Action cards: the assistant proposes, the person decides</h3>
          <p>The redesign gave the assistant a way to help with the next step, not just explain it. Ask “can I have a mailbox instead of forwarding?” and the answer comes with a card that does exactly that.</p>
          <Figure caption="Every card is checked by the server, confirmed by the person, and run through the same API as the website’s own pages."><ActionCardsDiagram /></Figure>
          <ul className="wx-points">
            <li><strong>What it can offer:</strong> check whether a name is free, request a name, sign in with an email link and code, add, switch or remove a service, change where a website address points, list a site in the directory, switch between names, put an earlier site version back, sign out, or delete a profile.</li>
            <li><strong>The server vets every card first.</strong> Owner actions are offered only to the name’s owner, a request only for a name that can be had, and never more than two cards per answer. Cards are signed with their answer, so a card the server did not offer cannot be slipped into a conversation.</li>
            <li><strong>Nothing runs on the first click.</strong> Every card opens the site’s standard confirmation window: what will happen, the price from the one pricing file, that it waits for approval, and any warning. Removing a service or deleting a profile is shown in red; what cannot be undone needs a tick, and deleting a profile needs the email typed back.</li>
            <li><strong>The card calls the same API the website’s own pages call,</strong> with the person’s own sign-in. Turnstile, consent, rate limits, ownership checks and my approval of service changes all still apply, because nothing about them is new.</li>
            <li><strong>Some things stay off the chat entirely.</strong> Publishing, deploy keys, connected apps and server-code secrets are links to /account, never cards.</li>
          </ul>
          <p>How each card ended (done, failed or cancelled) goes back with the next question, so the assistant knows whether its suggestion worked. What is kept is minimal: only questions the guide could not answer, or answers someone marked unhelpful, with email addresses, keys and passwords redacted, for 90 days. Those are the to-do list for the guide.</p>
        </section>

        <section aria-labelledby="safety">
          <H2 id="safety" kicker="09">How we keep people safe</H2>
          <p>A family domain is a trusted brand in miniature: if <code>wilssens.com</code> sends you a link, you click it. That made security a feature, not an afterthought, and the platform went through a full audit on 10 October.</p>
          <Figure caption="The platform-wide rules come first, then what they mean for children, phishing, accounts and privacy."><SafetyPillarsDiagram /></Figure>
          <ul className="wx-points">
            <li><strong>Signing in is not owning.</strong> People sign in with Zoho, or with a one-time email link or code. Every action on a name then checks ownership separately, so a relative who requested a name for someone else sees only their own request.</li>
            <li><strong>Owners’ code never runs on the main site.</strong> Every personal site lives on its own subdomain, and drafts are previewed there too, never on www, where a script could act with the owner’s account.</li>
            <li><strong>A name changing hands starts clean.</strong> Deploy keys, AI app connections, sessions and old versions of the previous owner are removed or hidden.</li>
            <li><strong>No credentials in plain text.</strong> Secrets stored in the database are encrypted; sign-in tokens and deploy keys are stored only as hashes and shown once.</li>
          </ul>
          <div className="wx-cards">
            <div className="wx-card"><h3>Children and households</h3><p>Some members are children, so the defaults assume a child could be on the other end.</p><ul><li>The family directory is for adults. A child’s site is listed only after a parent or guardian agrees, and only I can switch that on.</li><li>The Zoho organization’s contact list is hidden from every user, admins included. Zoho cannot hide one person, so nobody sees anyone.</li><li>A parent can pay for a child’s address but cannot read its mail or give the name away.</li><li>Photos added in the page maker are re-encoded in the browser, which strips location data before anything is published.</li></ul></div>
            <div className="wx-card"><h3>Phishing and impersonation</h3><p>The domain carries the family’s name, which is exactly what a scammer would want to borrow.</p><ul><li>Pages with a sign-in form naming a bank or mail provider, or a form sending data to another site, wait for a person to approve them. In the admin they are shown as text, never rendered, so a bad page never runs with admin rights.</li><li>Every hosted page carries a small “Report this page” line that reaches a real inbox.</li><li>Mail is signed and checked (DKIM, SPF, DMARC), so others cannot easily send as @wilssens.com.</li><li>The main site cannot be framed by other sites, which blocks click-jacking tricks.</li></ul></div>
            <div className="wx-card"><h3>Accounts and passwords</h3><ul><li>A new mailbox’s temporary password is never emailed. The email holds a one-time link that shows it once, within 14 days.</li><li>Sign-in links open a page with a button rather than signing in directly, because mail scanners click every link they see. Links last 15 minutes and work once.</li><li>Sign-in codes, requests and searches are rate-limited, and a wrong guess uses up a try before it is checked.</li><li>Every credential expires: browser sessions after 30 days, AI app and command-line connections after a year (30 days for admins), deploy keys after 30 to 365 days. Owners can end one or all with “Sign out everywhere”.</li><li>In an incident I can end every sign-in for one site, one person or everyone, and switch off AI apps, the command lines or deploy keys separately, in seconds. Websites, email and /admin keep working.</li></ul></div>
            <div className="wx-card"><h3>Privacy</h3><ul><li>The only public numbers are totals. There is no list of names or addresses anywhere public, and analytics use no cookies.</li><li>The help assistant keeps only questions it could not answer well, redacted, for 90 days, with no name, email or IP address.</li><li>Name searches are tied to a visitor code that changes daily and are deleted after 100 days.</li></ul></div>
          </div>
          <p>None of these are exotic. The work was in applying them consistently across every endpoint, and writing them down so future changes keep them.</p>
        </section>

        <section aria-labelledby="running">
          <H2 id="running" kicker="10">Running it: one person, one dashboard</H2>
          <p>The operator is one person, so the admin is built to answer “what needs me?” first. Its overview shows headline numbers and a <strong>Needs you</strong> list: new requests, service changes, versions held for review, sites asking to be featured. A bell in the site header shows the same counts wherever I am.</p>
          <ul className="wx-points">
            <li><strong>Every name</strong>, with its owner, email and website, plus a live check that visits each subdomain and a cross-check against Zoho for accounts nothing explains.</li>
            <li><strong>Traffic per hostname</strong>, from Cloudflare’s analytics, saved daily so history outlives Cloudflare’s 31-day window.</li>
            <li><strong>Storage</strong>: site files, database size, and each mailbox.</li>
            <li><strong>Server code capacity</strong>: what every site uses this month against the plan’s included amounts, and what it would cost if every site used its full limit.</li>
            <li><strong>The help assistant</strong>: questions, cost per day against the budget, answer speed, and the questions the guide could not answer.</li>
            <li><strong>Demand</strong>: searches, requests, referrals and the funnel between them.</li>
          </ul>
          <p>Cost discipline is built into the code, not just watched. A hosted page costs two storage calls whatever the site’s size, analytics queries are cached because each takes 10 to 25 seconds, and every AI and server-code feature has a hard limit.</p>
        </section>

        <section aria-labelledby="experiments">
          <H2 id="experiments" kicker="11">Experiments, measured with PostHog</H2>
          <p>wilssens.com began as an experiment, and the habit stuck: every feature ships with the events that will show whether anyone uses it.</p>
          <Figure caption="The experiment loop: ship it switched off, name the events, read them in the admin, decide."><ExperimentLoopDiagram /></Figure>
          <ul className="wx-points">
            <li><strong>Ship it dark.</strong> Payments, live mailbox creation, server code and the help assistant each have a switch. Server code is allowed site by site, and the help assistant can be open to everyone, to account holders only, or off.</li>
            <li><strong>Name the events up front.</strong> The name search is a funnel: search, available or taken, plans viewed, request started, request sent, shared, referred. The page maker records which of the five ways people build with, which blocks and templates they pick, and how often they ask their AI app for a change. Every event carries the page’s language.</li>
            <li><strong>Count what matters where ad blockers can’t hide it.</strong> A sent request and a request from a share link are recorded by the server, so the key numbers stay honest.</li>
            <li><strong>Read the results where decisions are made.</strong> The admin queries PostHog with HogQL, one part at a time, saves the results in the database and refreshes them in the background, so the page opens instantly.</li>
            <li><strong>Measure without watching people.</strong> No cookies, no autocapture, no session recordings, no surveys. Events hold kinds and counts, never names, text or addresses, and my own browsers are never counted.</li>
          </ul>
          <p>The result is a site where “should we keep this?” has a number behind it. PostHog’s feature flags and A/B tests are the natural next step once there are enough visitors for a test to mean something.</p>
        </section>

        <section aria-labelledby="practices">
          <H2 id="practices" kicker="12">Best practices</H2>
          <ol className="wx-practices">
            <li><strong>Write the rules down, then make the database enforce them.</strong> “A name is never given away during quarantine” is a trigger, not a code review comment. Rules that live only in people’s heads do not survive the fiftieth feature.</li>
            <li><strong>One function per outcome.</strong> Approving and paying both call <code>approveRequest()</code>; five ways of building all call <code>publishSite()</code>. Every safety check lives in exactly one place.</li>
            <li><strong>Design for both ends of the family.</strong> The same site serves a grandparent who wants a mailbox that just works and a teenager deploying from GitHub. Each gets their own path, and the paths meet at the same rules.</li>
            <li><strong>Restrict AI by architecture, not by instructions.</strong> A prompt can be talked around. A model that can only offer cards, with signed answers and a server that has the last word, cannot do much harm.</li>
            <li><strong>Keep a living record of decisions.</strong> The project has one document that states every settled decision, with its date and its reason. I built this with Claude Code, Anthropic’s AI coding tool, and that document is what kept 179 commits consistent: every session starts by reading it, and no settled decision gets re-argued.</li>
            <li><strong>Small, boring infrastructure scales down beautifully.</strong> No servers, no containers, a database that is a file. Nothing to patch, and almost nothing to pay while it is quiet.</li>
          </ol>
        </section>

        <section aria-labelledby="next">
          <H2 id="next" kicker="13">What’s next</H2>
          <p>For now, wilssens.com serves my immediate family, and every name on it is free. That is the right size for it today.</p>
          <p>The platform is ready to grow if the need ever scales beyond us. Payments through Stripe are already built and switched off; turning them on means live keys, tax and terms, not new code. Pricing, waiting lists and referrals are in place too. If more Wilssens find their way to the site and ask for a name, the platform can welcome them, and pay its own way, without a rebuild.</p>
          <div className="wx-end">
            <p>If your name is Wilssens, search for yours.</p>
            <div className="wx-actions">
              <a className="primary-button" href="https://www.wilssens.com" target="_blank" rel="noreferrer">Visit wilssens.com ↗</a>
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
