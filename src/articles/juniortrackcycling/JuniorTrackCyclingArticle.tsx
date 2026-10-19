import { useEffect, useRef, type ReactNode } from 'react'
import home from '../../assets/articles/juniortrackcycling/home.jpg'
import help from '../../assets/articles/juniortrackcycling/help.jpg'
import curtain from '../../assets/articles/juniortrackcycling/curtain.jpg'
import { openAsk } from '../../ask/open'
import { ArchitectureDiagram, SafetyGatesDiagram } from './Diagrams'
// The reading tools (progress bar, contents, counters, lightbox) and the styles are
// shared with the wilssens.com write-up; all the write-ups use the same .wx classes.
import { enhanceArticle } from '../wilssens/article'
import { Stats, type Stat } from '../wilssens/Stats'
import feed from './feed.json'
import '../wilssens/article.css'

// The write-up of how juniortrackcycling.com was built, linked from /projects. Facts come
// from the project's CLAUDE.md, PRODUCT.md, DESIGN.md, docs and specs, and its commit
// history as of 19 October 2026. Nothing about any rider; no usage numbers.
// Screenshots: the holding page as served, and pages from a local build of the site,
// which is not public yet.

const sections = [
  ['gap', 'A number that relegates a kid'],
  ['modes', 'Two products, one site'],
  ['data', 'Rules as data, not memory'],
  ['minors', 'Built for minors'],
  ['analysis', 'Analysis built for the boards'],
  ['coach', 'A coach inside Claude'],
  ['gates', 'You catch it, not me'],
  ['curtain', 'Behind the curtain'],
  ['building', 'How it was built'],
  ['practices', 'Best practices'],
  ['next', 'What’s next'],
] as const

const articleUrl = 'https://steven.wilssens.com/building-juniortrackcycling'
const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`

// What is built, not effort: feed.json, counted from the repository as of the last refresh.
// [key in the feed, prefix, decimals, label]
const stats: Stat[] = [['disciplines', '', 0, 'race disciplines explained, each at three levels'], ['helpTopics', '', 0, 'help pages: every number explained and dated against the code that ships'], ['mcpTools', '', 0, 'tools a rider, a parent or a coach can use from Claude'], ['testFiles', '', 0, 'test files across the site and the analysis engine']]

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

export default function JuniorTrackCyclingArticle() {
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => enhanceArticle(rootRef.current!), [])

  return <article className="wx" ref={rootRef}>
    <div className="wx-progress" aria-hidden="true"><span /></div>

    <header className="wx-hero">
      <a className="back-link" href="/projects">← Projects</a>
      <p className="wx-eyebrow">Project write-up · juniortrackcycling.com</p>
      <h1 className="is-long">Building juniortrackcycling.com</h1>
      <p className="wx-dek">A reference hub and a training platform for junior track racers and the parents behind them: rules kept as data, an analysis engine built for the velodrome, a coach that lives inside Claude, and gates at every step because the users are minors.</p>
      <p className="wx-meta">Steven Wilssens · October 2026 · <span data-read-time>14 min read</span></p>
      <Stats project="juniortrackcycling" feed={feed} items={stats} live={false} />
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
          <p>This is the largest thing I have built since leaving Microsoft: a content site and an operating platform in one codebase, four months old, not yet open. It is the closest to how I ran data products: a niche nobody served well, numbers that must be right, and users who must be protected from the product itself.</p>
          <ul>
            <li><strong>Facts as data with a date on them.</strong> A gearing limit is configuration with a last-checked date, never a number typed from memory, and every calculation on the site has a help page that a test keeps in sync with the code. <a href="#data">Rules as data</a></li>
            <li><strong>Consent and safety in the data path.</strong> No upload without consent, a second model that judges what the AI coach says to a child, and no location data in anything an app can read. <a href="#minors">Built for minors</a></li>
            <li><strong>The agent checks its own work.</strong> Layout, security and database rules are checked by scripts that must pass before a merge, and when a bug slips through, the checker is extended until it catches it. <a href="#gates">You catch it, not me</a></li>
            <li><strong>Specs before code, every time.</strong> Two hundred and eighty specs and plans, written with the AI, approved by me, executed by it, verified against the real site. <a href="#building">How it was built</a></li>
          </ul>
          <p><strong>Why a product leader still builds:</strong> this one started at home. My son races track, and the reason the site exists is on its own home page: gearing that won’t get your kid relegated. I built it with Claude Code, the way I describe in <a href="/building-this-site">the write-up about this site</a>, and it is where most of the practices in the other write-ups were first worked out.</p>
        </aside>

        <p className="wx-lede">juniortrackcycling.com is an independent reference for competitive junior track cycling in the United States, and the training platform behind it. It explains the things nobody had written down cleanly, gearing and rollout limits, equipment by age, every race discipline, the road from a local velodrome to nationals, and it gives a family two free tools a general cycling site does not have: a rollout calculator that checks a bike is legal before an official does, and ride analysis built for the boards rather than the road.</p>

        <p>It is written for the junior and the parent at a velodrome, or at the kitchen table the night before a race, trying not to be relegated over a rule nobody explained. Coaches and clubs come second. It is a small, devoted niche, and the site is meant to read as neutral and trustworthy, which is why it is deliberately not a vehicle for any one rider, including mine; his site is <a href="/building-leo">a separate project</a>.</p>

        <section aria-labelledby="gap">
          <H2 id="gap" kicker="01">A number that relegates a kid</H2>
          <p>Junior track racing has a rule most parents meet the hard way: a gear limit, measured as the distance the bike travels in one pedal stroke, that changes with age. Get it wrong and the child is relegated after the race, and nobody at the velodrome has time to explain the arithmetic. The rules exist, the tables exist, and the explanation did not, not in one place and not in plain words.</p>
          <p>That was the gap, and it set the order of work. The first commit is from 19 June 2026, and the first real work four days later was not a page: it was the analysis engine for velodrome rides, because the tools were the reason to come back, and the content was the reason to arrive. The content collections followed a week later.</p>
          <Shot src={home} width={1440} height={900} host="juniortrackcycling.com" alt="The Junior Track Cycling home page: the headline Check your rollout, Analyze your ride, a photo of a rider on a velodrome, and a Quick gear check card where an age group, a chainring and a cog give a rollout of 6.43 metres per pedal stroke, marked legal by 0.02 metres with a note to check it on your own wheel" caption="The home page, from a local build: the gear check is the first thing on the page, and its answer says how close to the limit the bike is and tells you to measure it on your own wheel." />
        </section>

        <section aria-labelledby="modes">
          <H2 id="modes" kicker="02">Two products, one site</H2>
          <p>The product document describes three modes. Persuade: the home page, which leads with the two free tools and dropped the nationals from its hero the week after the event ended. Read: the hub, four long guides, eleven disciplines each explained for a beginner, an intermediate and an advanced rider, eight equipment buyer’s guides, the nationals pages and a results archive. Operate: the platform, where a rider uploads rides, joins a club, works with a coach and, with the right consents, a weekly plan from an AI coach.</p>
          <Figure caption="The hub and the app are one static Astro site on Cloudflare Pages. Sign-in, data and storage are in Supabase; the analysis engine, the AI coach and the MCP server run on Fly.io; Claude apps reach the same data over MCP."><ArchitectureDiagram /></Figure>
          <p>The stack is locked in the project’s instructions, with the rule that the AI must not re-propose it: Astro with content collections, hand-written CSS from a small set of design tokens, islands only where a page genuinely needs them, Cloudflare Pages for the site. The platform needed more than static files, and it got exactly what it needed and no more: a Postgres database with sign-in and storage, and one Python service for the analysis and the coach. The domains stay at the registrar; nothing is hosted there.</p>
          <p>The design tokens are the lines on a velodrome: the red of the sprinter’s line, the blue of the Côte d’Azur, a near-black ink and paper. In August the display typefaces were retired for one typeface for words and a monospace face for data, the same rule as on Leo’s site; in October came a redesign under the lights, with view transitions, a command palette and a motion layer that switches itself off for anyone who asked for reduced motion.</p>
        </section>

        <section aria-labelledby="data">
          <H2 id="data" kicker="03">Rules as data, not memory</H2>
          <p>The content accuracy rule is the first non-negotiable in the instructions file: no rollout number is ever written from memory. The limits are configurable data, with the date they were last checked against the governing body’s rules, and the disclaimer that the site is not affiliated with that body is always shown. The calculator reads the data; the help page explains the calculation; the guide tells the story; none of them carries its own copy of a number.</p>
          <Shot src={help} width={1440} height={900} host="juniortrackcycling.com" alt="The Help page of Junior Track Cycling: the headline Every number, explained, a note that the help covers every feature and every calculation down to its constants, that each page shows the date it was last checked against the code that ships, and that when a number cannot be supported the site says so instead of guessing, with buttons for How we calculate and Gearing calculator math" caption="The help system, from a local build: twenty-six pages, one per feature and calculation, each with the date it was last checked against the code." />
          <p>The help system is the part I would show a hiring manager. Every feature and every calculation, down to its constants, has a help page, and each page carries the date it was last verified against the code that ships. Since September that is enforced: a pull request that changes a behaviour, a formula or a constant has to update the matching help page and bump its date, and a test fails when it does not. If a number cannot be supported, the page says so rather than guessing. The documentation cannot drift from the product because the build does not let it.</p>
        </section>

        <section aria-labelledby="minors">
          <H2 id="minors" kicker="04">Built for minors</H2>
          <p>The users are children and the people responsible for them, so the platform’s rules about consent and data are not a privacy page; they are gates in the data path. Nothing can be uploaded or analysed until consent to analyse is recorded. Consent to the AI coach is separate, and for a rider under thirteen it needs a guardian’s typed signature. A rider’s public page, which aggregates a child’s name, licence number and birth year, is indexed by search engines only when the rider opts in, with a guardian.</p>
          <Figure caption="From upload to plan, every step has a gate: consent before anything, the rider’s own review before the coach reads a ride, a second model judging the coach’s words, and a signed confirmation before an app writes."><SafetyGatesDiagram /></Figure>
          <ul className="wx-points">
            <li><strong>The coach is judged by a second model.</strong> Everything the AI coach writes for a minor passes through a safety judge, a different model that checks for advice about weight and body, fails closed, and is never asked to judge its own author’s output.</li>
            <li><strong>Review before advice.</strong> Since October the coach does not read a ride until the rider has confirmed every effort label, rated the effort and written a short debrief. The rider’s account of the ride comes before the machine’s.</li>
            <li><strong>No location leaves.</strong> Payloads to connected apps never include GPS, and a test proves it. A browser harness in the repository proves that photos of minors are stripped of their embedded location before they are stored.</li>
            <li><strong>Funnel measurement without an identifier.</strong> The site needs to know whether readers become users, and the design for that measurement keeps the promise that no visitor is identified.</li>
          </ul>
        </section>

        <section aria-labelledby="analysis">
          <H2 id="analysis" kicker="05">Analysis built for the boards</H2>
          <p>Every popular training tool assumes a road. A velodrome ride is different: short efforts at a fixed gear, standing starts, flying laps, a session made of repeats rather than one long ride. The analysis engine is a Python service, ninety-one modules, that parses the file a bike computer writes, segments a velodrome session into its efforts, classifies the session and each effort, and computes the things a coach wants: power curves, critical power and the anaerobic reserve above it, training load over days and weeks, repeatability, starts and pacing.</p>
          <p>The part I am proudest of is the corrector: a small model trained on the corrections riders make when the engine mislabels an effort, so the labelling improves from use rather than from me guessing at thresholds. It is also where the tests live: two hundred and twenty-nine Python test files with about three thousand tests, because a number on a child’s training page has to be right.</p>
          <p>The engine’s one honest limitation is in its deploy notes: it is pinned to a single machine that never stops, because its job store is in memory. That is a trade I made knowingly for a service that is not yet open, and I will unmake it when the numbers say so.</p>
        </section>

        <section aria-labelledby="coach">
          <H2 id="coach" kicker="06">A coach inside Claude</H2>
          <p>In August the platform grew an <abbr title="Model Context Protocol">MCP</abbr> server, so a rider, a parent or a coach can connect the Claude app to their own training data from the profile page. Twenty-five tools: eighteen that read, seven that write. Reading is the default. A write, planning a week, moving or skipping a workout, setting a rider’s threshold, needs a token with write scope and a two-step confirmation signed by the server and valid for ten minutes, and every write is logged and tells the rider and the guardians.</p>
          <ul className="wx-points">
            <li><strong>A skill tells Claude how to coach.</strong> It must read the rider’s profile first, because racing age and the gear limit change every answer. Adherence is counts, never a grade. Targets come from the rider’s measured ceiling, never from a percentage of a threshold. And it must say when the data has gaps.</li>
            <li><strong>Weekly planning closes the loop.</strong> The planner proposes a week, and afterwards matches each planned session to the ride that followed it, so the next plan starts from what happened, not from what was intended.</li>
            <li><strong>Previews, then confirmation.</strong> No tool that changes data acts on its first call. It returns a preview and a confirmation code; the person says yes; the second call does the work.</li>
          </ul>
          <p>The reason to build it was to find out whether an AI coach for juniors could be done responsibly. The answer so far is: only with the gates in the section above, and with them, yes. An answer about a week of training that is grounded in the actual rides, with the guard rails visible in the conversation, is a different thing from a chatbot with a training plan. Leo is on a break and about to start training again, and I am using it to build out his weekly schedule, fine-tuning the coach as we go.</p>
        </section>

        <section aria-labelledby="gates">
          <H2 id="gates" kicker="07">You catch it, not me</H2>
          <p>That heading is a section of the instructions file, and it is the rule that changed how I work with an AI agent. The agent does not ask me to check a layout; it runs a script that renders the real pages at four widths in both themes, fails on overlap, overflow, clipped text, poor contrast and console errors, and reports zero errors with screenshots before it reports anything else. Signed-in pages are checked through temporary harness pages. When a bug slips through anyway, the rule is to extend the checker and reintroduce the bug to prove the checker now catches it. The same check gates every deploy.</p>
          <ul className="wx-points">
            <li><strong>Database rules are tested.</strong> Every table gets row-level security in its own migration, and a test fails when one does not. The agent pushes migrations to the cloud itself and verifies them with live probes, because a merged-but-unpushed migration silently breaks features; it also checks migration numbers for collisions, after three collided.</li>
            <li><strong>Security is checked by a machine, twice.</strong> The database provider’s security advisor runs against a throwaway database on every pull request, against production daily, and against production again before every deploy. Reviewed exceptions live in a baseline file; nothing merges until both checks pass.</li>
            <li><strong>One full audit.</strong> On 27 August a full-surface security audit was written, every finding reproduced live, fixed in a series of pull requests and re-verified against production by the next day. It was the second audit; the first was eleven days earlier.</li>
          </ul>
          <p className="wx-callout">The agent is held to the standard I held my teams to: show me the number, show me the screenshot, and when something gets past you, fix the check before you fix the bug.</p>
        </section>

        <section aria-labelledby="curtain">
          <H2 id="curtain" kicker="08">Behind the curtain</H2>
          <p>The site is built and it is not open. Visitors see a holding page; a first group of junior riders is using the platform on the real track before the doors open, and the lock is one constant in the code that fronts every request. It is a product decision, not a technical one: a reference that promises “every number explained” has to have earned it on the boards, and a platform for minors has to be tried by families who know me before it is tried by families who do not.</p>
          <Shot src={curtain} width={1440} height={900} host="juniortrackcycling.com" alt="The Junior Track Cycling holding page as visitors see it: the words Rolling out soon over a photo of a rider on a velodrome, a line about gearing, ride analysis and the road to nationals, and a Warming up section with a waitlist" caption="What a visitor sees today. The page says what is built and that it is being ridden on the real track first; a waitlist collects the families who want in." />
        </section>

        <section aria-labelledby="building">
          <H2 id="building" kicker="09">How it was built</H2>
          <p>Four months, 2,033 commits on 82 working days, 1,227 of them co-authored with Claude. The method is the same every time: brainstorm with me, write a spec, get it approved, write a plan, execute the plan task by task with subagents, verify against the real site, commit. The repository holds a hundred and forty specs and a hundred and forty-one plans, each with its date and its status line, which is how I can write this piece without guessing. The themes by month tell the story: analysis and activities in June, clubs and admin in July, media, coaching, the MCP server and nationals in August, availability and the AI coach in September, and in October the redesign and the loads a rider carries.</p>
          <p>The instructions file grew into the product’s constitution: the locked stack, the hosting rule, the help-in-sync rule, the verification rule, the migration rule, the security gates, the content accuracy rule, the safety rules, and the order in which the site will make money if it ever does: the platform first, then equipment links, then premium content, then sponsorship, and never ads. Three project skills sit beside it: how to design a page for this site, how to verify a page visually, and how to coach from the MCP tools.</p>
        </section>

        <section aria-labelledby="practices">
          <H2 id="practices" kicker="10">Best practices</H2>
          <ol className="wx-practices">
            <li><strong>A fact is data with a date.</strong> A rule or a constant lives in one place, with the date it was last checked, and nothing else carries a copy.</li>
            <li><strong>Documentation the build enforces.</strong> A test that fails when a formula changes and its help page does not is worth more than a documentation policy.</li>
            <li><strong>Consent and safety in the data path.</strong> Gates at upload, at review, at the model and at every write, not a paragraph on a privacy page.</li>
            <li><strong>Judge the model with another model, and fail closed.</strong> When the reader is a child, a second opinion on every word is cheap.</li>
            <li><strong>Make the agent prove its work.</strong> Screenshots, zero-error checks at every width, security advisors on every pull request, and a rule to extend the checker when a bug gets through.</li>
            <li><strong>Earn the launch.</strong> A holding page and a first group of real users are better than a launch that has to be walked back.</li>
          </ol>
        </section>

        <section aria-labelledby="next">
          <H2 id="next" kicker="11">What’s next</H2>
          <p>The doors open when the riders on the track say the numbers are right. Then the funnel from reader to rider: saving a calculator setup, a newsletter on the hub pages, a sample analysis anyone can read. The weekly planner still needs workout export to the trainers people own and a scheduled re-plan, and the security backlog that every real system has is tracked in the audit and worked through in order.</p>
          <p>This write-up is refreshed from the project’s repository after every check-in; the numbers in the header are counted from it.</p>
          <div className="wx-end">
            <p>Ask the assistant something a recruiter would ask.</p>
            <div className="wx-actions">
              <button className="primary-button" type="button" onClick={() => openAsk()}>Ask about Steven</button>
              <a className="text-link" href="https://juniortrackcycling.com" target="_blank" rel="noreferrer">Visit juniortrackcycling.com ↗</a>
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
