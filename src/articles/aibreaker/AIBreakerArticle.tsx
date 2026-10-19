import { useEffect, useRef, type ReactNode } from 'react'
import home from '../../assets/articles/aibreaker/home.jpg'
import proof from '../../assets/articles/aibreaker/proof.jpg'
import undo from '../../assets/articles/aibreaker/undo.jpg'
import { ConcernChart, FeedDiagram, JournalFlowDiagram, LayersDiagram, LevelsDiagram, ProcessDiagram } from './Diagrams'
// The reading tools (progress bar, contents, counters, lightbox) and the styles are
// shared with the wilssens.com write-up; both articles use the same .wx classes.
import { enhanceArticle } from '../wilssens/article'
import { Stats, type Stat } from '../wilssens/Stats'
import feed from './feed.json'
import '../wilssens/article.css'

// The write-up of why and how AI Breaker (aibreaker.org) was built, linked from /projects.
// Facts come from the project's own decision log and specs as of 19 October 2026;
// survey figures are cited inline. Screenshots: public sections of aibreaker.org.

const sections = [
  ['fear', 'Half the country is wary'],
  ['control', 'Why a switch calms'],
  ['levels', 'Four positions'],
  ['architecture', 'The helper writes first'],
  ['mechanisms', 'Documented controls only'],
  ['proof', 'Proof from Windows'],
  ['undo', 'Undo was built first'],
  ['testing', 'Proven before claimed'],
  ['feed', 'A list that stays current'],
  ['website', 'The website'],
  ['building', 'How it was built'],
  ['practices', 'Best practices'],
  ['next', 'What’s next'],
] as const

const articleUrl = 'https://steven.wilssens.com/building-aibreaker'
const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`

// What is built and proven, not effort: feed.json, from the project's specs as of the last refresh
// (aibreaker.org/api/building adds what its database knows). [key in the feed, prefix, decimals, label]
const stats: Stat[] = [['levels', '', 0, 'levels, from nothing blocked to full lockdown'], ['settingsCovered', '', 0, `of ${feed.numbers.settingsDocumented} documented AI settings in Windows, Office and browsers covered`], ['chatbotDomainsBlocked', '', 0, 'chatbot domains blocked in three browsers, proven on Windows Home and Pro'], ['clicksToUndo', '', 0, 'click to undo everything, even when the app won’t open']]

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

const Source = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>

export default function AIBreakerArticle() {
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => rootRef.current ? enhanceArticle(rootRef.current) : undefined, [])

  return <article className="wx" ref={rootRef}>
    <div className="wx-progress" aria-hidden="true"><span /></div>

    <header className="wx-hero">
      <a className="back-link" href="/projects">← Projects</a>
      <p className="wx-eyebrow">Project write-up · aibreaker.org</p>
      <h1>Building AI Breaker</h1>
      <p className="wx-dek">The off switch for AI on Windows: why a product for people who are wary of AI starts with the research on fear and control, and how it was built so that every claim can be checked and every change undone.</p>
      <p className="wx-meta">Steven Wilssens · October 2026 · <span data-read-time>21 min read</span></p>
      <Stats project="aibreaker" feed={feed} items={stats} />
      <div className="wx-actions">
        <a className="primary-button" href="https://aibreaker.org" target="_blank" rel="noreferrer">Visit aibreaker.org ↗</a>
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
          <p>AI Breaker is a paid Windows app, in testing now, for a group most AI products ignore: the half of adults who would rather have less of it. It is the project where I apply what I learned building decision systems for Windows to a product of my own.</p>
          <ul>
            <li><strong>Start from a human insight, then check it against the research.</strong> Fear falls when people hold the switch. The surveys say how many people need one. <a href="#fear">Half the country is wary</a> · <a href="#control">Why a switch calms</a></li>
            <li><strong>Trust is a feature you build, not a claim you make.</strong> Only controls Microsoft documents, proof from Windows’ own logs, an undo that was built before anything else, and “blocked” said only after it was seen to stop. <a href="#proof">Proof from Windows</a> · <a href="#testing">Proven before claimed</a></li>
            <li><strong>AI-assisted development run like a team.</strong> A written context file, specs with numbered acceptance criteria, agents in the roles of product manager, designer, testers, copy checker, reviewer and a skeptic that tries to disprove every serious finding, checks that a script enforces, and a log of 140 dated decisions. <a href="#building">How it was built</a></li>
          </ul>
          <p><strong>Why a product leader still builds:</strong> to stay sharp on what my teams ship, and because the judgment calls in this one, scope, honesty about limits, what to charge for, are product calls. I built it with Claude Code, Anthropic’s AI coding tool, starting on 10 October 2026.</p>
        </aside>

        <p className="wx-lede"><a href="https://aibreaker.org" target="_blank" rel="noreferrer">AI Breaker</a> turns off the AI on a Windows 11 PC from one window, in four levels, shows what each level will stop before it is applied, proves afterwards that it worked, and puts everything back in one click. It costs $19 once. It exists because of a simple observation about fear.</p>

        <section aria-labelledby="fear">
          <H2 id="fear" kicker="01">Half the country would rather not</H2>
          <p>AI arrived on Windows from every direction at once: Copilot, Recall, AI in Paint and Notepad, AI in Edge, Chrome, Firefox and Office, chatbot sites and apps, and AI engines hidden inside ordinary programs. Nobody asked for most of it, and a large share of people do not want it. The numbers are not a niche.</p>
          <Figure caption="Pew Research Center. US adults surveyed June 2026 (3,488 adults) and 2021; the 25-country median comes from surveys in January to April 2025."><ConcernChart /></Figure>
          <ul className="wx-points">
            <li><strong>52% of US adults are more concerned than excited</strong> about the growing use of AI in daily life, up from 37% in 2021. Only 9% are more excited than concerned. For the first time a majority of adults under 30 (55%) say the same. <Source href="https://www.pewresearch.org/short-reads/2026/08/18/young-adults-in-the-us-are-increasingly-wary-of-ai-concerned-it-will-take-jobs/">Pew Research Center, August 2026</Source></li>
            <li><strong>About six in ten want more control</strong> over how AI is used in their lives. Only 17% are comfortable with the control they have. At the same time nearly three quarters would let AI help at least a little with daily tasks: people want a dial, not a ban. <Source href="https://www.pewresearch.org/science/2025/09/17/how-americans-view-ai-and-its-impact-on-people-and-society/">Pew Research Center, September 2025</Source></li>
            <li><strong>It is not only America.</strong> Across 25 countries the median share more concerned than excited is 34%, and about half of adults in the United States, Italy, Australia, Brazil and Greece. In no country do more than three in ten say they are mainly excited. <Source href="https://www.pewresearch.org/global/2025/10/15/how-people-around-the-world-view-ai/">Pew Research Center, October 2025</Source></li>
            <li><strong>Nervousness matches excitement worldwide.</strong> Across 30 countries, 53% say products and services using AI make them nervous, against 52% who say they are excited. <Source href="https://www.ipsos.com/en-us/ipsos-ai-monitor-2025">Ipsos AI Monitor, June 2025</Source></li>
          </ul>
          <p>Those people have no product. The AI industry builds for the enthusiasts; the free alternatives for everyone else are registry scripts with no proof, no undo and no upkeep. Turning AI off on a Windows PC today means hunting through dozens of settings in Windows, Office and every browser, and doing it again after each update.</p>
        </section>

        <section aria-labelledby="control">
          <H2 id="control" kicker="02">Why a switch calms</H2>
          <p className="wx-callout">Fear shrinks when you hold the switch. People do not need AI gone. They need to know they can stop it, in one place, and check that it stopped.</p>
          <p>That is the belief behind the product, and it is older than AI. In the stress experiments David Glass and Jerome Singer published in <em>Urban Stress</em> (1972), people worked through tasks while loud, unpredictable noise played. One group was given a button that would stop the noise and asked not to use it. Almost nobody pressed it. Yet the group with the button made fewer errors and persisted longer afterwards than the group without one. The button changed nothing about the noise. It changed how much the noise cost them.</p>
          <p>The same pattern runs through the surveys above: the majority who want “more control” are not the same people who want AI gone. They want a say. So AI Breaker is not a ban. It is a switch with four positions, a preview of what each one will stop, and a record anyone can check. The off switch only earns trust if it is:</p>
          <ul className="wx-points">
            <li><strong>Legible.</strong> One place, plain language, no hunting through settings. The standard I wrote down: a 70-year-old who is afraid of AI should be comfortable using it.</li>
            <li><strong>Verifiable.</strong> Proof it is actually off: a log of what was blocked and when, drawn from Windows’ own records rather than from us.</li>
            <li><strong>Durable.</strong> Updates cannot silently turn AI back on. Drift is detected and reported; a tamper lock is on the roadmap.</li>
            <li><strong>Honest about scope.</strong> It says exactly what each level covers and what it does not. A row only says “blocked” after the feature has been seen to stop.</li>
          </ul>
          <p>Every decision below was measured against those four words. When a cheaper option failed one of them, the project took the more expensive one. That is also what makes it worth paying for: the free tweaks already offer the cheap version.</p>
        </section>

        <section aria-labelledby="levels">
          <H2 id="levels" kicker="03">Four positions, one switch</H2>
          <p>Levels, not a hundred toggles. Each level includes the ones below it, every level says up front what will stop working, and every level is reversible with one click. Windows itself keeps working at every level; only AI features stop.</p>
          <Figure caption="The four levels as shipped in the app and on aibreaker.org. Level 3 is shown as “coming in a later update” until its proofs are complete."><LevelsDiagram /></Figure>
          <Shot src={home} width={1920} height={1200} host="aibreaker.org" alt="The aibreaker.org home page: the headline “The off switch for AI on Windows.” beside a demo of the switch set to Level 2, with the AI features it blocks crossed out" caption="The home page lets visitors move the switch and watch the list change before they join the waitlist. The demo uses the same wording as the app: Enabled or Blocked, and “Always on” for Defender." />
          <p>Three rules shaped the levels. Microsoft Defender’s own AI-based malware protection is never touched, at any level, and the app has no toggle for it at all. Nothing that uninstalls a component is used, because a one-click undo cannot cleanly reverse it. And the option that turns off Windows’ own built-in AI is never on by default and carries an accessibility warning, because it removes face sign-in, voice typing, live captions and the natural Narrator voices some people depend on.</p>
          <p>Anyone can also flip a single item on top of a level. That makes the setting “Custom (based on Level 2)”, the same idea as a browser’s Standard, Strict and Custom. One decision I made against the first design: when a setting on the PC is already stricter than what AI Breaker would write, it is left alone, and when it is looser, AI Breaker writes the stricter value and records the old one. If a person decides to turn something off, there is no reason to turn it back on.</p>
        </section>

        <section aria-labelledby="architecture">
          <H2 id="architecture" kicker="04">The window never touches Windows</H2>
          <p>The app is three programs with clear roles. The window people see runs without elevated rights and cannot change anything. A background service, running as SYSTEM, owns every change, the record of it, and the undo. A small command line talks to the same service and also carries the rescue tool, which works with the service stopped.</p>
          <Figure caption="The app and the command line ask; only the service changes Windows, and only targets in its own catalog."><ProcessDiagram /></Figure>
          <ul className="wx-points">
            <li><strong>Authorization comes from the plan, not from the caller.</strong> The service works out what a request would change, under a lock, and only then decides who may do it. Anyone can look. Any administrator can block more without a prompt, because tightening cannot hurt the owner. Blocking less (undo, enabling an item, the panic button) needs Windows’ own approval prompt, so neither malware nor another user can quietly loosen it.</li>
            <li><strong>The service only writes targets in its built-in catalog.</strong> The update feed can add domains, app identities and prebuilt policies, never a registry target. A tampered journal cannot widen what the engine will touch.</li>
            <li><strong>Local only.</strong> The pipe between window and service refuses remote clients, takes one JSON line in and one out, and identifies the caller from Windows, not from what the caller says.</li>
          </ul>
          <p>It is .NET 10 and C#: a WinUI 3 app, a Windows service, the command line, a WiX installer and PowerShell tooling for the test machines. About 25,000 lines of application code and 6,500 lines of tests, in a week.</p>
        </section>

        <section aria-labelledby="mechanisms">
          <H2 id="mechanisms" kicker="05">Only the controls Microsoft documents</H2>
          <p>A security product that uses hacks gets flagged as malware, and deserves to be. AI Breaker uses only the controls Microsoft, Google and Mozilla document for IT departments, cites the documentation next to every setting in the code, and marks anything unverified as such until a test proves it.</p>
          <Figure caption="Several supported controls layered, because each one has a gap the next one covers."><LayersDiagram /></Figure>
          <ul className="wx-points">
            <li><strong>Never the hosts file.</strong> The obvious shortcut for blocking chatbot sites is one Microsoft calls unsupported, and one Defender resets as a hijack. Browser block lists, per-app firewall rules and DNS rules do the same job in a supported way, and they are written for all three browsers whether installed or not, so a browser installed later is covered.</li>
            <li><strong>Never Microsoft’s servers.</strong> Microsoft says it cannot support cutting Copilot off from the network, so Copilot is contained with policy settings and by stopping the app from starting, Microsoft’s own recommended method. A protected list in the app (Microsoft, Defender, activation, our own update hosts) cannot be overridden by the feed.</li>
            <li><strong>No kernel driver.</strong> Blocking model files on disk would need one. Windows’ App Control refuses to run the AI engines themselves, which gets most of the value with none of the risk.</li>
            <li><strong>A guided step counts as a gap.</strong> Telling a person where to click in Settings is as much a failure as “not covered”. A feature without an obvious switch gets research for a control the app can enforce itself, and a broader one with a plainly explained side effect wins: Copilot Discover is stopped by turning off the whole Widgets board, with the same Microsoft app-blocking rule used for the Copilot app, after every policy route failed on Home or Pro. Only when every route is ruled out, in writing, does the app show the exact Settings path, and it never writes an undocumented registry value instead.</li>
          </ul>
          <p>The hardest finding came early: Windows Home has the tool that applies App Control policies but not the tool that builds them. So policies are built off-device, one per app, delivered in the signed feed, and only applied on Home. Exempting an app means removing its policy, because in App Control a deny always wins and cannot be undone by adding an allow.</p>
        </section>

        <section aria-labelledby="proof">
          <H2 id="proof" kicker="06">Proof from Windows, not from us</H2>
          <p>A person who is afraid of AI will not take a vendor’s word that it is off. So the activity log shows two things, and both can be checked without AI Breaker.</p>
          <Shot src={proof} width={1920} height={981} host="aibreaker.org" alt="The Activity section of aibreaker.org: a sample log with rows such as “Ollama blocked from starting, Code Integrity 3077”, “chatgpt.com connection blocked, Firewall 5157” and “AI Breaker recorded the original settings, Change journal”" caption="Every block carries the number of the Windows record that proves it, so the most skeptical person in the house can look it up in Event Viewer and find the same thing." />
          <ul className="wx-points">
            <li><strong>What Windows blocked,</strong> taken from Windows’ own event logs: Code Integrity for an engine that was refused, the firewall for a connection that was dropped, AppLocker for an app that did not start. Each entry shows the event number so it can be found in Event Viewer. The service keeps a copy, so the history survives when Windows’ own log wraps.</li>
            <li><strong>What AI Breaker changed,</strong> from its own journal: time, setting, before and after, who asked, and whether it was done from the window or the command line. The log can be exported.</li>
            <li><strong>Blocks are visible on purpose.</strong> A blocked site shows the browser’s own “blocked by your organization” page rather than a broken connection, and the app explains that wording before it appears. Firewall drop auditing is switched on so that network blocks show up in Windows’ log too, and switched back on undo.</li>
          </ul>
          <p>This is the third of three ship gates, next to code signing of every file and clean Defender and SmartScreen results on a fresh machine. No release goes out without all three, every release, not just the first.</p>
        </section>

        <section aria-labelledby="undo">
          <H2 id="undo" kicker="07">Undo was built first</H2>
          <p>Everything AI Breaker does changes Windows as SYSTEM. People will only trust that if they can always get back to where they started, with one click, even when the app itself is broken. So the first code written was the journal and the rollback, and no feature that changes Windows was started before the harness proved they worked.</p>
          <Figure caption="Every change is recorded as pending before it is made, and undone in reverse order from the recorded state."><JournalFlowDiagram /></Figure>
          <Shot src={undo} width={1920} height={1151} host="aibreaker.org" alt="The Undo section of aibreaker.org: six promises in a grid: one-click undo, panic button, works even if the app won’t open, tamper lock (coming), no surprise restarts, cleans up after itself" caption="The promises on the website are the acceptance criteria of the foundation spec, in plain words." />
          <ul className="wx-points">
            <li><strong>One-click undo and a panic button.</strong> Go back a level, or remove everything in one step, no questions asked. The journal is written to disk atomically, with a backup, and archived after a clean rollback.</li>
            <li><strong>A rescue that needs nothing.</strong> The command line’s recovery mode stops the service and undoes every change locally. A sweep also finds AI Breaker’s own firewall, DNS and App Control rules by name, so recovery works even if the journal is lost. A plain-text recovery file in the data folder lists the manual steps for anyone who prefers them.</li>
            <li><strong>A change that fails part-way undoes its own completed steps</strong> automatically, and the uninstaller undoes everything before it removes a file.</li>
            <li><strong>No surprise restarts.</strong> Before anything is applied, each change says whether it works now, after closing an app, or after a restart, and a banner tracks what is still pending until Windows confirms it happened.</li>
          </ul>
        </section>

        <section aria-labelledby="testing">
          <H2 id="testing" kicker="08">Proven in virtual machines, claimed on real hardware</H2>
          <p>Nothing that changes Windows ever runs on my own PC. Two Hyper-V virtual machines, one Windows 11 Home and one Pro, each with a clean checkpoint, run every test: a harness restores the checkpoint, copies the build in, runs the steps, collects the logs and Windows’ events, and reverts. The rule is written into the project’s instructions, and the tester agent can only run tests through that harness.</p>
          <ul className="wx-points">
            <li><strong>Every acceptance criterion passes on Home and Pro,</strong> or is marked “not applicable on Home”. Most buyers run Home, and Home is where tools go missing.</li>
            <li><strong>Rollback is tested after every apply.</strong> A change is not done until the machine is back to its clean state.</li>
            <li><strong>Unit tests on fakes are not enough.</strong> About 500 of them run on the dev PC, and then a smoke test launches every published binary read-only, because a build that passes its tests and crashes on start is not ready.</li>
            <li><strong>“Blocked” only once seen.</strong> Virtual machines prove that settings are set, journaled and undone. Features that only exist on Copilot+ PCs, such as Recall and Click to Do, are claimed only after they are seen to stop on a real Copilot+ PC. Until that session runs, those rows cannot say blocked.</li>
          </ul>
          <p>As of this writing, Level 2 blocks 26 chatbot domains in Edge, Chrome and Firefox on both editions with exact undo; App Control blocks AI engines on Home without a restart, 42 of 42 test steps; and the installer installs, upgrades and uninstalls cleanly. Level 1’s 36 settings are built, and most of their per-feature proofs are still to run. The website says exactly that.</p>
        </section>

        <section aria-labelledby="feed">
          <H2 id="feed" kicker="09">The paid value is a list that stays current</H2>
          <p>New AI apps, sites and Windows settings appear every month. A one-off script goes stale; the maintained list is what the $19 buys, together with the preview, the proof and the undo. Keeping that list current is a commitment, so the upkeep is designed as a system rather than a chore.</p>
          <Figure caption="From a new AI app version to a signed update on every PC, with evidence at each step and a person in the middle."><FeedDiagram /></Figure>
          <ul className="wx-points">
            <li><strong>A signed feed.</strong> The list that tells a SYSTEM service what to block has to be provably ours. Releases are signed with hardware-backed keys, the app pins the public keys, a feed can never add a key, and versions only move forward, so an attacker cannot roll a PC back to an older, weaker list. Anyone can verify a feed file from the command line.</li>
            <li><strong>Tightening applies itself; loosening waits.</strong> A release that blocks more is applied and shown in Activity. Anything that would block less waits for the person’s next level change.</li>
            <li><strong>Honest expiry, and a clear line for what is paid.</strong> The first year of new AI coverage is included. Blocking anything new needs a current licence, in the beta too; without one the app shows what it would block, and that is the trial. After the year, everything already blocked stays blocked, undo and the panic button always work, security and compatibility fixes keep coming, and the window says when the list froze and that blocking more needs a licence.</li>
            <li><strong>A rule station.</strong> A second desktop runs the routine part on a schedule: it finds new versions of catalog apps, packages and tests them in the virtual machines, and opens a pull request with the evidence. I review and sign; the station cannot. Its research agent has no rights to the virtual machines and no GitHub token, and every job it runs is listed in a weekly digest.</li>
          </ul>
        </section>

        <section aria-labelledby="website">
          <H2 id="website" kicker="10">The website practises what the app preaches</H2>
          <p><a href="https://aibreaker.org" target="_blank" rel="noreferrer">aibreaker.org</a> is a separate product in the same repository: plain HTML and CSS on Cloudflare Pages with no build step, a few Pages Functions for the waitlist and visit counting, and a small database. It had to be as trustworthy as the app, because it is the first thing a wary buyer sees.</p>
          <ul className="wx-points">
            <li><strong>It loads nothing from other servers.</strong> No CDNs, no Google Fonts, no third-party analytics, no cookies. A content security policy enforces it, and the footer says so, so the promise and the code have to stay in step.</li>
            <li><strong>Visits are counted the way this site counts them:</strong> a visitor is a hash of address, browser, a secret and the date, so nobody can be followed across days; no IP address is stored; Do Not Track and Global Privacy Control mean nothing is sent; everything is deleted after 13 months.</li>
            <li><strong>The copy is governed by the product rules.</strong> Only what the app does or is proven to do; planned things say Planned; “Level 2”, never “L2”; no Microsoft logos and no implied endorsement; the FAQ is repeated word for word in the page’s structured data; and a plain-text summary is published for AI assistants.</li>
            <li><strong>An internal “How AI Breaker works” page</strong> for an executive, a product manager and a developer, each with a to-do list, lives behind the admin token and is updated with every product change. It is where this write-up’s facts come from.</li>
          </ul>
        </section>

        <section aria-labelledby="building">
          <H2 id="building" kicker="11">How it was built: a team of agents, one decision log</H2>
          <p>I built AI Breaker with Claude Code, starting on 10 October 2026, the way I would run a small product team, because the failure mode of AI-assisted work is not bad code. It is forgetting a decision, re-arguing it, and shipping something that quietly contradicts last week.</p>
          <ul className="wx-points">
            <li><strong>One context file, read at the start of every session.</strong> What we are building, the market, pricing, the levels, the technical approach with its known findings, the brand, the legal constraints, the ship gates, the roadmap, how to work with me, and a log of every decision with its date and reason. 140 entries so far. A decision that is superseded says what replaced it, and every agent reads the last two weeks of the log first, so last week’s decision beats a month-old spec.</li>
            <li><strong>Specs with numbered acceptance criteria,</strong> 33 of them, each naming the roadmap phase, what it depends on, the trust property it serves, the enforced routes it researched, its UI states and its open questions with a recommendation. I approve a spec before anything is built, one question at a time.</li>
            <li><strong>Roles, as agents, each with its own instructions, tools and model.</strong> A product-manager agent writes the spec. A designer agent covers every state of a screen against the design rules. The main session builds. A tester agent verifies each criterion in the Home and Pro virtual machines; an extension tester does the same in Edge and Chrome; a copy checker reads every word a person will see. A code-reviewer agent reads the diff cold. Judgment roles run on the most capable model at high effort; the testers, whose job is to follow the criteria and report evidence, run on a faster one. The tester and reviewer get the spec, not the builder’s explanation of the code.</li>
            <li><strong>Results as data, and a skeptic before any rework.</strong> The tester writes a verdict file (each criterion, Home and Pro, the evidence, what it could not verify) and the reviewer returns typed findings. Every blocking finding then goes to a fresh agent whose only job is to refute it, so a plausible-but-wrong finding dies before it costs a rebuild. The whole chain, spec gate to close-out, is a saved workflow that runs in the same order every time.</li>
            <li><strong>A definition of done that a script enforces.</strong> Every criterion on both editions, rollback to clean, analyzer clean, installer builds, the published binaries launch, the decision log and the internal page are updated, and never weaken or delete a failing check to get a pass. The parts a script can check (the version number moved, every test file actually runs, the internal page and its to-dos moved with the change) run before every push and on every pull request. On its first run it found a test file the build had silently stopped running.</li>
            <li><strong>Shared machines, shared like a lab.</strong> Several sessions often work at once, so each works in its own branch and worktree, and the test harness holds a lock on each virtual machine and waits for free memory: a second session waits its turn instead of restoring a checkpoint under someone else’s test.</li>
            <li><strong>The AI that reads is not the code that acts.</strong> On the build station, a research agent that reads untrusted web pages gets no shell, no repository and no keys; it writes proposals in its own folder, and a deterministic runner validates them, runs the tests and opens draft pull requests for me.</li>
            <li><strong>Permissions granted one at a time, in writing.</strong> The AI may run the VM harness on my PC; it may set up the test machines; it may set up the rule station with me present. Each exception is dated and scoped in the context file, and the default stays “never change the host”.</li>
          </ul>
          <p>Pushback is part of the process. The first version of the app was, in my words, “read only”: you could pick a level but not find the button that applied it. The designer agent’s spec names the four reasons why and the one-sentence fix, and the app was rebuilt around a single Review page whose Apply button is the only thing that changes anything.</p>
        </section>

        <section aria-labelledby="practices">
          <H2 id="practices" kicker="12">Best practices</H2>
          <ol className="wx-practices">
            <li><strong>Build for the people the industry forgot.</strong> Half of adults are wary of AI and most want more control. A dial they can trust is a product; a lecture about the benefits is not.</li>
            <li><strong>Make control real, not decorative.</strong> The button in the noise experiment worked because it would have worked. Every switch in AI Breaker is backed by a documented control, a journal entry and a Windows event that proves it.</li>
            <li><strong>Build the undo before the feature.</strong> A tool that changes a system as SYSTEM earns trust through the way back, not the way in. Rollback, panic and recovery were written and harness-tested before any level existed.</li>
            <li><strong>Say “not covered” rather than pretend.</strong> A row that cannot be proven says so. A list that can go stale says when it froze. A feature that needs a restart says so before the click.</li>
            <li><strong>Write the rules once, then let the system enforce them.</strong> The catalog of targets the service may touch, the protected list of hosts the feed may never block, and the authorization computed from the plan are code, not reminders.</li>
            <li><strong>Run AI like a team, with a written memory and checks it can’t argue with.</strong> Roles, specs, a skeptic for every serious finding, a definition of done enforced by a script, and a dated decision log kept 129 commits consistent in nine days. The same practices run a human team.</li>
          </ol>
        </section>

        <section aria-labelledby="next">
          <H2 id="next" kicker="13">What’s next</H2>
          <p>AI Breaker is in testing. The website takes a waitlist, and nothing is sold until the ship gate is met: a real code-signing certificate, clean Defender and SmartScreen results on a fresh machine, and the Copilot+ PC session that proves the rows which can only be proven there. A closed beta for people whose PCs fill the gaps in our test coverage comes before the paid launch, and a lawyer reviews the agreements before anything ships.</p>
          <p>The business version, for schools and small companies that want “approved AI” rather than “no AI”, is designed into the foundation so it needs no rewrite: policy keys, an event channel, a silent installer. The biggest risk is on the record too: Microsoft shipping its own off switch. The answer is coverage of third-party AI, proof and undo, which a native toggle will not offer.</p>
          <div className="wx-end">
            <p>If you would rather hold the switch, the waitlist is open.</p>
            <div className="wx-actions">
              <a className="primary-button" href="https://aibreaker.org" target="_blank" rel="noreferrer">Visit aibreaker.org ↗</a>
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
