import { useEffect, useRef, useState, type ReactNode } from 'react'
import askPanel from '../../assets/articles/site/ask-panel.jpg'
import pullRequest from '../../assets/articles/site/pull-request.jpg'
import { openAsk } from '../../ask/open'
import { LoopDiagram, ResumeGateDiagram, SourceOfTruthDiagram, TeamFlowDiagram } from './Diagrams'
// The reading tools (progress bar, contents, counters, lightbox) and the styles are
// shared with the wilssens.com write-up; both articles use the same .wx classes.
import { enhanceArticle, feedDate } from '../wilssens/article'
import { Stats, type Stat } from '../wilssens/Stats'
import feed from './feed.json'
import '../wilssens/article.css'

// The write-up of how this site is built and run, linked from /projects. Numbers come
// from the site's own analytics database, the résumé checker and the MCP server as of
// 19 October 2026; update them together with the date in the closing section.

const sections = [
  ['source', 'One file, five outputs'],
  ['gate', 'A gate on the résumé'],
  ['readers', 'Three kinds of readers'],
  ['machines', 'Readable by AI'],
  ['assistant', 'The assistant'],
  ['loop', 'The loop'],
  ['practices', 'Best practices'],
  ['next', 'What’s next'],
] as const

const articleUrl = 'https://steven.wilssens.com/building-this-site'
const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`

// Outcomes, not effort: the site's live numbers (feed.json as of the last refresh, today's from
// /api/building/site once the page loads). [key in the feed, prefix, decimals, label]
const stats: Stat[] = [['countries', '', 0, 'countries visitors have come from'], ['vitalsGoodPercent', '', 0, 'percent of loading, response and stability measurements rated good'], ['proposalsApproved', '', 0, 'résumé changes approved through the interview loop'], ['pullRequestsMerged', '', 0, 'pull requests opened by Claude Code from a conversation and merged']]

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

// The assistant's report card, live from /api/ask/report (functions/_lib/ask/report.ts):
// aggregates over its whole life, cached ten minutes. Prerendered pages and readers
// without JavaScript get the sentence instead.
type Report = { since: string | null; questions: number; answered: number; gaps: number; gapsCovered: number; gapsOpen: number; helpful: number; unhelpful: number; costMicro: number; costPerAnswerMicro: number | null; publicNotes: number }
const usd = (micro: number) => `$${(micro / 1_000_000).toFixed(2)}`
export function ReportCard() {
  const [report, setReport] = useState<Report | null>(null)
  useEffect(() => {
    if (typeof fetch !== 'function') return
    let cancelled = false
    fetch('/api/ask/report').then(async (response) => (response.ok ? response.json() : null)).then((data: Report | null) => { if (!cancelled && data && typeof data.questions === 'number') setReport(data) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  if (!report) return <p className="wx-report-wait">The numbers load here from the site’s own database: questions asked, the share answered with sources, the gaps and how many I have since covered, the votes and the cost.</p>
  const inScope = report.answered + report.gaps
  const since = report.since ? new Date(`${report.since}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null
  return <figure className="wx-figure wx-report" aria-label="The assistant’s report card">
    <dl className="wx-report-grid">
      <div><dt>{report.questions.toLocaleString('en-US')}</dt><dd>questions{since ? ` since ${since}` : ''}</dd></div>
      <div><dt>{inScope ? `${Math.round((report.answered / inScope) * 100)}%` : '—'}</dt><dd>answered with sources, of the questions in scope</dd></div>
      <div><dt>{report.gaps.toLocaleString('en-US')}</dt><dd>{report.gaps === 1 ? 'time' : 'times'} my notes had no answer</dd></div>
      <div><dt>{report.gapsCovered.toLocaleString('en-US')}</dt><dd>{report.gapsCovered === 1 ? 'question' : 'questions'} from readers I answered since, as public notes · {report.gapsOpen} waiting</dd></div>
      <div><dt>{report.helpful} / {report.unhelpful}</dt><dd>votes, helpful / not helpful</dd></div>
      <div><dt>{report.costPerAnswerMicro === null ? '—' : usd(report.costPerAnswerMicro)}</dt><dd>per answer · {usd(report.costMicro)} in all</dd></div>
    </dl>
    <figcaption>Live from the site’s own database, refreshed every ten minutes. A gap is a question in scope that my notes could not answer; each one reaches me in the private MCP, and my answer becomes a note the assistant uses from then on.</figcaption>
  </figure>
}

export default function SiteArticle() {
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => enhanceArticle(rootRef.current!), [])

  return <article className="wx" ref={rootRef}>
    <div className="wx-progress" aria-hidden="true"><span /></div>

    <header className="wx-hero">
      <a className="back-link" href="/projects">← Projects</a>
      <p className="wx-eyebrow">Project write-up · steven.wilssens.com</p>
      <h1 className="is-long">Building steven.wilssens.com</h1>
      <p className="wx-dek">A résumé run like a product: one source of truth for the pages, the PDF and the AI; a scored gate on the résumé; readers counted, machines included; and a loop that turns a recruiter’s unanswered question into a pull request.</p>
      <p className="wx-meta">Steven Wilssens · October 2026 · <span data-read-time>12 min read</span></p>
      <Stats project="site" feed={feed} items={stats} />
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
          <p>A résumé site is a small product with a demanding user: a recruiter with eight seconds and a hiring manager with a sceptical question. I ran it the way I ran data products at Microsoft.</p>
          <ul>
            <li><strong>One source of truth, enforced by tests.</strong> Every fact about me lives in one file; the pages, the PDF, the Markdown for AI and the assistant are built from it, and the build fails when they drift. <a href="#source">One file, five outputs</a></li>
            <li><strong>Quality as a score, not an opinion.</strong> A checker reads the résumé as a recruiter, an applicant tracking system and an editor would, and a new version has to score at least as well as the old one. <a href="#gate">A gate on the résumé</a></li>
            <li><strong>Measure the readers before deciding.</strong> People, search engines and AI crawlers are counted apart, without cookies, and the AI readers get their own format. <a href="#readers">Three kinds of readers</a></li>
            <li><strong>AI with guardrails, and a person deciding.</strong> The assistant knows only what I published. Every change goes through a team of AI agents with a spec, the same checks as me and reviewers who did not write it, and I merge. <a href="#loop">The loop</a></li>
          </ul>
          <p><strong>Why a product leader still builds:</strong> I built this with Claude Code, Anthropic’s AI coding tool, alongside <a href="/building-wilssens">wilssens.com</a>, <a href="/building-aibreaker">AI Breaker</a>, <a href="/building-juniortrackcycling">Junior Track Cycling</a> and <a href="/building-leo">leo.wilssens.com</a>. Those write-ups are about rules, safety and trust. This one is about feedback loops: how a site about a career learns what its readers need and fixes itself.</p>
        </aside>

        <p className="wx-lede">This site went live on 26 September 2026, two weeks after my last day at Microsoft. It is a React site prerendered to static HTML on Cloudflare, with its own analytics, a generated résumé, a private MCP server and an AI assistant, and the whole thing is run from one data file and one Claude conversation.</p>

        <p>It is for recruiters and hiring managers, who arrive from a LinkedIn message or a search and decide in seconds. What they look for first is not a story: level, team size, location, work authorization, availability, and a résumé they can forward. Those are in the hero on every device, and the résumé is one click away on every page. The sceptic who asks “15% of what, measured how?” is the second reader; search engines and AI assistants are the third, and both get their own sections below.</p>

        <section aria-labelledby="source">
          <H2 id="source" kicker="01">One file, five outputs</H2>
          <p>The rule that shaped the codebase is the one I would set for any data product: a fact lives in exactly one place. Here that place is a single TypeScript file, <code>src/resume.ts</code>: my profile, every role with a stable key, the impact numbers, skills, selected work, honors, education, recommendations and press. No component hard-codes a fact about me.</p>
          <Figure caption="The pages, the résumé PDF, the Markdown copies, the assistant’s knowledge and the MCP server are all built from the same file."><SourceOfTruthDiagram /></Figure>
          <ul className="wx-points">
            <li><strong>The résumé PDF is generated,</strong> never edited. A script renders it from the file in a headless browser, and a test extracts the PDF’s text and checks that every role, date and recent bullet is in it. The résumé a recruiter forwards cannot say something different from the site.</li>
            <li><strong>The assistant and the MCP server import the same file.</strong> When a bullet changes, the assistant’s answers change in the next deploy, without anyone rewriting a prompt. The LinkedIn share image is generated from the headline and the photo for the same reason.</li>
          </ul>
          <p>This is unremarkable engineering, and that is the point. A résumé in Word, a site in a page builder and a LinkedIn profile edited by hand drift apart within a month, and recruiters notice drift before they notice design.</p>
        </section>

        <section aria-labelledby="gate">
          <H2 id="gate" kicker="02">A gate on the résumé</H2>
          <p>A résumé is judged by three readers with different eyes: a recruiter skimming for level and scope, an applicant tracking system extracting text and keywords, and an editor who notices a present-tense verb in a role that ended. The build has a checker that reads the PDF as all three.</p>
          <Figure caption="The résumé build scores the new PDF and the current one, and only replaces the file when the score does not drop."><ResumeGateDiagram /></Figure>
          <p>It checks that the text is extractable without icon-font glyphs, that the file is two pages or fewer, that the contact details, headline, every role, company and date match the site, that the bullets of the two latest roles match word for word, that past roles are in the past tense, that a team size and the keywords recruiters search for appear, and that every number on the home page has a bullet behind it. Errors cost 25 points and warnings 5. A new PDF only replaces the current one when its score does not drop, and overriding that needs a reason in the commit message.</p>
          <p>The gate earned its keep on its first day. The first batch of résumé changes from the loop described below added scope and outcomes to my latest role, and the PDF ran one line onto a third page. The checker scored it 65 out of 100, the test went red, and main stopped deploying:</p>
          <pre className="wx-pre" tabIndex={0} aria-label="Output of the résumé checker"><span className="is-quiet">$ npm run resume:check</span>{'\n'}public/steven-wilssens-resume-2026.pdf: score 65/100, 3 pages, 346 KB, 1 error, 2 warnings{'\n'}  <span className="is-bad">[error]</span> 3 pages; a resume for a principal role is two at most.{'\n'}  <span className="is-quiet">[2 warnings: key numbers with no role bullet behind them in src/resume.ts; both numbers have since been replaced]</span></pre>
          <p>The fix was a layout one, an hour later: a compact honors line, a shorter patents note and a smaller bottom margin brought the PDF back to two pages at a score of 90. The checker was not touched, and since then the score of every résumé that goes live is kept, so the dashboard shows whether a change made it better or worse. The two warnings were fair too: those numbers had been on my résumé for years with no bullet behind them, and I have since replaced them with the Perfect Day numbers from my Windows Data role.</p>
        </section>

        <section aria-labelledby="readers">
          <H2 id="readers" kicker="03">Three kinds of readers, counted apart</H2>
          <p>I did not add a third-party analytics script. The site has its own tracker, a few hundred lines, that records page views, time on page, scroll depth, clicks and Core Web Vitals into a Cloudflare D1 database: no cookies, no stored IP addresses, nothing kept past 13 months, and nothing at all from visitors who send Global Privacy Control or Do Not Track. The <a href="/privacy">privacy page</a> says exactly this, in plain words.</p>
          <p>The part I would not get from an off-the-shelf tool is the second table: every request from a crawler, logged separately with the bot’s name, the company behind it, its category and the network it came from, so a faked user agent shows up as a mismatch.</p>
          <div className="wx-table-wrap"><table className="wx-table">
            <thead><tr><th scope="col">Readers</th><th scope="col">Since</th><th scope="col">Count</th><th scope="col">What they went for</th></tr></thead>
            <tbody>
              <tr><th scope="row">People</th><td data-label="Since" className="is-nowrap">27 Sep</td><td data-label="Count">62 visitors, 135 page views</td><td data-label="What they went for">Two thirds of views on the home page, then Experience, Recommendations and Patents. Desktop first, phones close behind.</td></tr>
              <tr><th scope="row">Search engines</th><td data-label="Since" className="is-nowrap">12 Oct</td><td data-label="Count">113 requests</td><td data-label="What they went for">Bing most of all, then Google and Apple. The sitemap, then every page.</td></tr>
              <tr><th scope="row">AI crawlers</th><td data-label="Since" className="is-nowrap">12 Oct</td><td data-label="Count">68 requests</td><td data-label="What they went for">Anthropic’s Claude for users and for training, OpenAI’s search bot and GPTBot, Amazon. The robots file and sitemap first, then the home page and the Markdown copies.</td></tr>
              <tr><th scope="row">Scripts and probes</th><td data-label="Since" className="is-nowrap">12 Oct</td><td data-label="Count">391 requests</td><td data-label="What they went for">No user agent, curl, or a bare “Mozilla”. Kept apart so they never count as readers.</td></tr>
            </tbody>
          </table></div>
          <p>Three weeks is too early for conclusions, but two things already changed what I did. AI crawlers fetch the Markdown copies of the pages, which told me the next section was worth doing. And almost every loading, responsiveness and stability measurement is rated good, on phones as well as desktops (the header has the share), so performance work can wait. The numbers are read on a private dashboard, behind a token: the decision and the number behind it on one screen, the same habit as at Microsoft.</p>
        </section>

        <section aria-labelledby="machines">
          <H2 id="machines" kicker="04">Readable by AI, on purpose</H2>
          <p>When a recruiter asks an AI assistant “who is Steven Wilssens”, the answer depends on what the assistant could read. A single-page app that renders in the browser gives it very little. So the build does the work up front.</p>
          <ul className="wx-points">
            <li><strong>Every page is prerendered to its own HTML file</strong> with its title, description and structured data: who I am, what each page is, where it sits on the site, and that this write-up is an article. Google uses the profile markup for people results.</li>
            <li><strong>Every page also exists as Markdown.</strong> The build converts the prerendered HTML into <code>/about.md</code>, <code>/experience.md</code> and so on, served with a canonical link back to the page, plus an <code>llms.txt</code> index and one file with every page. A model reading the Markdown gets the content without the navigation and the icons.</li>
            <li><strong>The sitemap tells the truth about dates.</strong> A page’s last-modified date is when its content changed, not when the site was last deployed, and each production deploy pings the search engines through IndexNow.</li>
            <li><strong>The site is also an MCP server.</strong> <a href="/mcp">steven.wilssens.com/mcp</a> is a read-only <abbr title="Model Context Protocol">MCP</abbr> server a recruiter can add to their own Claude or any other client: the résumé, every role, the recommendations, the patents and my public notes as tools, plus a fit check that hands their assistant my whole record and the rules for an honest comparison. It knows nothing I have not published, it cannot write, and every call is logged by tool and query so I can see what assistants ask.</li>
          </ul>
          <p>None of this is visible to a person, which is why it is easy to skip. The crawler log is what makes it worth doing: within five days, the AI crawlers were fetching the Markdown copies. The MCP server is the same idea one step further: a recruiter who runs an assistant over candidates should not have to scrape my site to put me in it.</p>
        </section>

        <section aria-labelledby="assistant">
          <H2 id="assistant" kicker="05">An assistant that knows only what I published</H2>
          <p>Every page has an “Ask about Steven” button. It opens a panel where a recruiter can ask anything about my work and get a short answer with links to the pages it rests on. Like the help assistant on wilssens.com, it is restricted by what it is given, not by what it is told.</p>
          <Shot src={askPanel} width={1440} height={900} host="steven.wilssens.com" alt="The steven.wilssens.com home page with the Ask about Steven panel open beside it: a greeting, four suggested questions and an input field" caption="The assistant docks beside the page on a wide screen and the page moves over. The suggestions change with the page the reader is on." />
          <ul className="wx-points">
            <li><strong>Its knowledge is the data file, my public notes and the write-ups.</strong> The system prompt is built from the same file as the site, the patents list, the dossier entries I marked public and the Building write-ups, read in full from their Markdown copies. It contains nothing I have not published.</li>
            <li><strong>Every answer starts with a hidden line</strong> the server strips: the sections it rests on, shown to the reader as links; “none”, when my notes do not cover the question, which saves it as a gap; or “out”, for anything off topic, where the reader sees a fixed sentence and the model’s text is never shown.</li>
            <li><strong>Answers are signed,</strong> so nobody can send the assistant an earlier answer it did not give. <strong>Limits are in the code:</strong> thirty questions an hour per visitor, twelve turns, a thousand characters, an optional human check, and a monthly budget counted from the provider’s own token usage. When the budget is spent the button disappears and the site keeps working.</li>
            <li><strong>It checks a job description against my record.</strong> Paste a posting and it answers in a fixed shape: which requirements my record covers, with the role or page that backs each; which it covers partly; which it does not show at all, even when they are probably true; and the questions an interviewer should ask me. The “not shown” list is the point. Every other candidate’s AI says yes to everything; this one is told that a plausible guess is not a fact. The requirements it could not match reach me the same way the unanswered questions do.</li>
          </ul>
          <p>Questions, cost, votes and the unanswered questions go to the dashboard, and the numbers that matter are public, here, straight from the database. I measured what I shipped at Microsoft; the assistant gets the same treatment, including the numbers that do not flatter it.</p>
          <ReportCard />
        </section>

        <section aria-labelledby="loop">
          <H2 id="loop" kicker="06">The loop: interview, review, edit, merge</H2>
          <p>The part of this site I am most pleased with is not on the site. It is a private <abbr title="Model Context Protocol">MCP</abbr> server, reachable only through a link I have, that turns Claude into a workspace for my career. Connected to the Claude app, it does four things, and a team of agents checks the result.</p>
          <ul className="wx-steps">
            <li><strong>Interview me like a sceptical recruiter.</strong> It reads what is already published, so it never asks what the site answers. It knows which roles have no numbers, which stints are short and where dates overlap, and asks one question at a time. Every answer becomes a dossier entry, private by default. The questions the site’s assistant could not answer, and the requirements from pasted job descriptions that my record does not show, come first: when a session starts it tells me how many are waiting, I answer them one by one, and each answer becomes a public note the assistant uses from then on.</li>
            <li><strong>Review the site from a recruiter’s seat.</strong> A review tool reads the published pages, the résumé report and an import of my LinkedIn profile, and returns findings with why a recruiter cares and what fixes it: a leadership role with no team size, an unexplained number, a gap, a LinkedIn headline that says something else. It scores the whole, and the score is what I work against.</li>
            <li><strong>Propose résumé changes and record my decisions.</strong> At the end of a session Claude compares the dossier with the résumé and proposes concrete edits: the current text, the new text, the notes it rests on. I approve or reject each one; the header counts the approved ones, and the ones I rejected overstated.</li>
            <li><strong>Change the site, through a pull request.</strong> An approved batch goes to GitHub Actions, where an agent first writes a spec for it, then Claude Code edits the data file on a branch, rebuilds the résumé through the gate, runs the lint, tests and build, opens a pull request, starts the preview and emails me what changed, in plain words. Questions only I can answer go into the spec and the pull request.</li>
            <li><strong>Put every change past a team.</strong> Every change, mine included, goes through Claude Code agents in six roles. A product manager writes the spec, a recruiter holds the bar that the site never gets worse for recruiters, a designer signs off on the design and compares screenshots of the built pages with main, and a developer builds it. Then fresh agents that did not write the code review it: a code reviewer, a security engineer, and a tester who holds every file at 90% test coverage. Findings go back to the developer for at most three rounds, and my open questions are asked once per round. On GitHub a required Review check runs main’s version of the checks and of the team review. I read the preview and merge, from the same conversation if I like.</li>
          </ul>
          <Figure caption="Every change goes from a spec to a build, six reviews by agents that did not write it and a required check on GitHub; I answer the questions and decide the merge."><TeamFlowDiagram /></Figure>
          <p>By my own estimate this cut the time it takes to update my résumé by ten to twenty times. It was also, unexpectedly, an enjoyable conversation: being asked the sharp questions by something that had read everything first, rather than an evening alone with a Word file.</p>
          <Figure caption="A question the assistant could not answer becomes an interview question, a dossier entry, a proposal, a pull request and a change on the site. I decide twice."><LoopDiagram /></Figure>
          <Shot src={pullRequest} width={1440} height={900} host="github.com" alt="A merged pull request on GitHub titled Résumé batch 1, opened by the github-actions bot, with the instruction listing the approved changes" caption="The first batch of résumé changes, as the workflow opened it: the instruction, the approved wording, the checks, and a preview link. Five files changed, seven lines each way." />
          <p>The agent never pushes to production. It has a short list of allowed tools, a turn limit, and the instructions I follow myself: never invent a number, leave a question in a comment when a fact is missing. Of the first six runs, two failed and made nothing and four opened pull requests; the header counts how many are merged by now. The failures cost minutes and showed me where the instructions were vague. The team reviewed its own setup first and found real problems: a pull request could rewrite the rules of its own review, the screenshots showed the dark theme for “light”, and the review would have refused the bot that opens the site’s pull requests. All three were fixed in the same pull request.</p>
          <p className="wx-callout">The site is edited by an AI, reviewed by a team of AIs playing a recruiter, a designer, an engineer, a security engineer and a tester, and answered for by an AI. Every one of them is confined to what I wrote down, and a person decides before anything ships.</p>
        </section>

        <section aria-labelledby="practices">
          <H2 id="practices" kicker="07">Best practices</H2>
          <ol className="wx-practices">
            <li><strong>One source of truth, with a test that fails when outputs drift.</strong> Generated outputs are only trustworthy if something checks them, on every build and in every pull request.</li>
            <li><strong>Turn quality into a score, then gate on the score.</strong> “Is the résumé better?” is an argument. “Does it score at least as well?” is a build step. The findings point at the data, never at the checker.</li>
            <li><strong>Every number needs its evidence next to it.</strong> An impact number must name the bullet that backs it, or the build warns. The rule I held my teams to, applied to myself.</li>
            <li><strong>Count the machines too.</strong> Search engines and AI crawlers are readers with their own needs. Logging them apart turned “should I bother with Markdown copies?” into a yes with evidence.</li>
            <li><strong>Restrict an assistant by what it is given.</strong> A prompt can be talked around; a system prompt built only from published data cannot leak what is not in it. Sign the answers, cap the spend, keep the off-topic path on the server.</li>
            <li><strong>Let the agent open a pull request, and other agents review it.</strong> A branch, a tool allowlist, a turn limit, the full test suite, reviewers that did not write the code, a required check on main’s rules and a human merge make its failures cheap and visible.</li>
          </ol>
        </section>

        <section aria-labelledby="next">
          <H2 id="next" kicker="08">What’s next</H2>
          <p>Three batches of approved résumé changes have landed through the loop, including a role that closes a gap recruiters used to ask about. Next, LinkedIn gets compared against the site after every batch, so the three tell one story, and the assistant’s unanswered questions set the agenda for the next interview; the report card above says how many are waiting. The public MCP server is new, and the dashboard will tell me whether any recruiter’s assistant ever connects.</p>
          <p>The numbers in the header are live, from the site’s own database, as of <span data-feed-date="">{feedDate(feed.asOf)}.</span> The write-up itself is refreshed from the repository after every check-in, by the same loop.</p>
          <div className="wx-end">
            <p>Ask the assistant something a recruiter would ask.</p>
            <div className="wx-actions">
              <button className="primary-button" type="button" onClick={() => openAsk()}>Ask about Steven</button>
              <a className="text-link" href="/steven-wilssens-resume-2026.pdf" download="Steven Wilssens Resume 2026.pdf">Download the résumé ↓</a>
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
