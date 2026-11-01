import { useEffect, useRef, type ReactNode } from 'react'
import { openAsk } from '../../ask/open'
import { SessionsDiagram } from './Diagrams'
// The reading tools (progress bar, contents, counters, lightbox) and the styles are
// shared with the wilssens.com write-up; all the write-ups use the same .wx classes.
import { enhanceArticle } from '../wilssens/article'
import { Stats, type Stat } from '../wilssens/Stats'
import feed from './feed.json'
import '../wilssens/article.css'

// The write-up of how Watt Fighters (wattfighters.com) was built, linked from /projects.
// Every fact comes from Steven's own account of the project as of 1 November 2026.
// The numbers in the header are in feed.json; the estimate in section 10 is his own model.

const sections = [
  ['fair', 'A fair race between a kid and a parent'],
  ['track', 'Track racing, not road racing'],
  ['physics', 'Physics a racer believes'],
  ['velodromes', '20 velodromes'],
  ['voice', 'A voice for every race'],
  ['online', 'Online, accounts and the apps'],
  ['business', 'The business around it'],
  ['building', 'Many sessions, one set of rules'],
  ['wrong', 'What the AI got wrong'],
  ['estimate', 'The estimate, and its limits'],
  ['practices', 'Best practices'],
  ['next', 'What’s next'],
] as const

const articleUrl = 'https://steven.wilssens.com/building-wattfighters'
const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`

// [key in the feed, prefix, decimals, label]
const stats: Stat[] = [['days', '', 0, 'days from the first commit (24 October 2026) to the iPhone app in TestFlight'], ['trackEvents', '', 0, 'track events on 20 velodromes'], ['commits', '', 0, 'commits, about 197,000 lines of code and 213 test files'], ['personYears', '~', 0, 'person-years: what a conventional team would need, by a feature-by-feature estimate']]

const Figure = ({ children, caption }: { children: ReactNode; caption: string }) => <figure className="wx-figure wx-diagram"><div className="wx-diagram-scroll" role="group" aria-label={caption} tabIndex={0}>{children}</div><figcaption>{caption}</figcaption></figure>

const H2 = ({ id, kicker, children }: { id: string; kicker: string; children: ReactNode }) => <h2 id={id} className="wx-h2"><span className="wx-kicker">{kicker}</span>{children}</h2>

export default function WattFightersArticle() {
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => enhanceArticle(rootRef.current!), [])

  return <article className="wx" ref={rootRef}>
    <div className="wx-progress" aria-hidden="true"><span /></div>

    <header className="wx-hero">
      <a className="back-link" href="/projects">← Projects</a>
      <p className="wx-eyebrow">Project write-up · wattfighters.com</p>
      <h1 className="is-long">Building Watt Fighters</h1>
      <p className="wx-dek">A track racing game for riders on smart trainers, built in eight days: what a former pro racer and many Claude Code sessions working in parallel can ship, and what still has to be proven.</p>
      <p className="wx-meta">Steven Wilssens · November 2026 · <span data-read-time>11 min read</span></p>
      <Stats project="wattfighters" feed={feed} items={stats} live={false} />
      <div className="wx-actions">
        <a className="primary-button" href="https://wattfighters.com" target="_blank" rel="noreferrer">Visit wattfighters.com ↗</a>
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
          <ul>
            <li><strong>Domain expertise is the fastest spec.</strong> Ten years as a professional track racer and a national track champion meant every racing question (how the neutral lap is judged, what a keirin feels like, which gear a sprinter rides) was answered in one sentence instead of a research project. <a href="#track">Track racing, not road racing</a></li>
            <li><strong>AI-assisted development run like an engineering organisation.</strong> Many Claude Code sessions worked at once on one codebase. A rules file, docs every session must update in the same change, a memory of my decisions, and a rule that each session commits only its own work kept them from breaking each other. <a href="#building">Many sessions, one set of rules</a></li>
            <li><strong>Trust the tests, check with your own eyes.</strong> Every deploy runs the tests and ships only when they pass. Every 3D change is checked close up in screenshots, because the AI reports “done” with the same confidence when it is wrong. <a href="#wrong">What the AI got wrong</a></li>
          </ul>
          <p>I built it with Claude Code, Anthropic’s AI coding tool, starting on 24 October 2026.</p>
        </aside>

        <p className="wx-lede">Watt Fighters is a multiplayer 3D track-cycling game. You ride a smart trainer or a power meter at home, and on the screen you race on a velodrome against bots or other riders, in the events a track racer knows. The first commit is dated 24 October 2026. Eight days later the iPhone app was in TestFlight, Apple’s test release before the App Store.</p>

        <p>I raced track for ten years as a professional and won a national title, and I now have a son who races. The game gives a track racer what is hard to find: a real race, with the tactics of a real race, any evening, without a velodrome or a field of riders at the same level.</p>

        <section aria-labelledby="fair">
          <H2 id="fair" kicker="01">A fair race between a kid and a parent</H2>
          <p>Two riders on power meters race on a velodrome. One is a kid with a 120 W threshold power (FTP). The other is a parent at 340 W. Left alone, the stronger rider simply rides away, and the race is decided before it starts.</p>
          <p>Watt Fighters adds a handicap that learns each rider. It measures a rider’s threshold and their sprint, and adjusts what their power is worth on the track, so the same race is close for both. The race comes down to who rides it better, not who has the bigger engine.</p>
          <p>You only pedal. The game rides the line up and down the banking for you, so nobody has to steer a bike with a trainer and a keyboard at the same time. Racing on a velodrome is a question of power, timing and position, and those are the parts the rider controls.</p>
          <p>The rules of the events did not start from a blank page. They started from the browser games my son Leo built about the sport: the match sprint, the elimination and the points race. Those are copied into the project as they are. <a href="/building-leo">The write-up on Leo’s site</a> describes his games.</p>
        </section>

        <section aria-labelledby="track">
          <H2 id="track" kicker="02">Track racing, not road racing</H2>
          <p>Indoor cycling games are mostly road games: a long ride, a group, a sprint at the end. Track racing is different, and it is a sport with very few places to practise it. A track racer gets one elimination race every few weeks, on a real track, on the right night. In Watt Fighters they can ride three in an evening, and practise what wins races: the draft, the start, where to sit in the bunch, when to go, how to read a race, and the rules.</p>
          <p>The events are the ones from the track programme:</p>
          <ul className="wx-points">
            <li><strong>Match sprint</strong>, two riders, a game of position and nerve.</li>
            <li><strong>Keirin</strong>, behind the derny, the small motorbike that sets the pace and pulls off before the sprint.</li>
            <li><strong>Elimination</strong>, where the last rider across the line every other lap is out.</li>
            <li><strong>Points race</strong> and <strong>scratch race</strong>, and the <strong>unknown distance</strong> race, where nobody is told how many laps are left.</li>
            <li><strong>Time trial</strong> with a standing-start gate, and the <strong>flying 200 m</strong>.</li>
            <li><strong>Open track</strong>, for riding with nobody to race.</li>
          </ul>
          <p>That is nine events. A rider can race one, ride a tournament, or ride a session of races in a row, against bots or online. The bots attack, counter and sit in like real riders, because practising race craft against riders who only ride a line teaches nothing.</p>
          <p>This is where my own background saved the most time. How the neutral lap is judged, what a keirin feels like when the derny pulls off, which gear a sprinter rides on a short track: I knew each answer, and it took one sentence to put it in the instructions. A team without a racer would have spent weeks reading rulebooks, and would still have missed how it feels.</p>
        </section>

        <section aria-labelledby="physics">
          <H2 id="physics" kicker="03">Physics a racer believes</H2>
          <p>A track racer notices when the physics are wrong, so the game puts the effort there:</p>
          <ul className="wx-points">
            <li><strong>Speed from watts.</strong> What a rider pushes on the pedals decides how fast the rider goes.</li>
            <li><strong>Drafting</strong>, tuned to team pursuit data, so sitting behind someone saves what it saves in real life.</li>
            <li><strong>The bends.</strong> A rider needs a minimum speed to stay up on the banking: about 25 km/h at London.</li>
            <li><strong>Gears.</strong> Track gears are fixed, so the game picks a gear per rider and event.</li>
            <li><strong>Tiring and recovering</strong>, modelled with W′, the amount of work a rider can do above threshold before they are empty, and how it comes back.</li>
            <li><strong>No swerving in the final straight.</strong> That is a rule in real sprints.</li>
            <li><strong>Crashes</strong>, with a realism slider, so a young rider can turn them down.</li>
          </ul>
          <p>One of the first bugs shows why this needs a racer. Bunch races start with a neutral lap, ridden together at an easy pace, and a rider who rides away or drops off gets a warning and then is disqualified. The first version judged it by position: the biggest group was the bunch, and anyone outside it was away. When a slow player held up the bots behind, the bots ahead were suddenly “off the front”, and 13 riders were disqualified in one call. A commissaire would not blame them. So the bunch became the first group riding the neutral pace, and only the rider who left a gap gets the blame. In 150 simulated neutral laps after that, no ordinary rider was ever warned.</p>
        </section>

        <section aria-labelledby="velodromes">
          <H2 id="velodromes" kicker="04">20 velodromes, drawn from their real designs</H2>
          <p>There are 20 velodromes in the game, drawn from their real designs: London, Marymoor, Burnaby, ’t Kuipke in Ghent, T-Town, Roubaix, the Vigorelli and more. Each has its own length, its own bends and its own banking, so the same event is a different race on each track.</p>
          <p>Each has a crowd sized to the night, a race-night infield and ads on the fence boards. Five bikes ride in it with made-up names, such as the Sprocketti Zebra and the Zappington Eel. Riders can be a man, a woman or a girl, and a rider can have their own 3D rider, made from four photos.</p>
        </section>

        <section aria-labelledby="voice">
          <H2 id="voice" kicker="05">A voice for every race</H2>
          <p>A race with no sound is a rehearsal. Watt Fighters has a race announcer with four voices (British and American, a man and a woman) and about 4,000 recorded lines. The lines have excitement levels, so a bunch sprint sounds different from a lap behind the derny, and there are stories about the bots, so the announcer has something to say about the rider in front of you.</p>
          <p>Recording is part of the deploy. Every deploy records any lines that are missing, so nobody has to remember to do it.</p>
          <p>Coach Mac is a gruff coach with a voice of his own. He teaches race craft: where to sit, when to hold and when to go. A new rider gets the lesson a club coach would give, in the middle of the race, when it matters.</p>
        </section>

        <section aria-labelledby="online">
          <H2 id="online" kicker="06">Online, accounts and the apps</H2>
          <p>Online racing runs in rooms on Cloudflare Durable Objects. Accounts are on Supabase, with an email link, Google or Apple to sign in. There is a ladder from Cat 5 to Pro with standings. A finished race can be watched again as a replay, and exported as an MP4 for Instagram. Rides can be uploaded to Strava, and the trainer’s resistance can be controlled by the game.</p>
          <p>The game is one codebase, with only a thin platform layer for each app, and a test enforces that thinness. It runs on the web, in Chrome and Edge, as a Windows app, as an Android app, and as an iPhone and iPad app in TestFlight. If a rule about racing lived in the Windows app, the iPhone app would be wrong the next day. The test makes sure the platform layer stays a layer.</p>
          <p>An Apple TV app is planned for the App Store by 14 November 2026.</p>
        </section>

        <section aria-labelledby="business">
          <H2 id="business" kicker="07">The business around it</H2>
          <p>A game that people pay for needs more than a game. Around Watt Fighters there are:</p>
          <ul className="wx-points">
            <li><strong>An admin site with 17 tabs.</strong> Every table exports to Excel: cost per player, service limits, deploys, feedback.</li>
            <li><strong>An ads site</strong> where Claude checks every ad before it runs.</li>
            <li><strong>A clubs site</strong> and a press kit.</li>
            <li><strong>A support assistant</strong> that knows the game.</li>
          </ul>
          <p>The game is free in open beta until at least the end of January 2027. After that it costs $9 a month.</p>
        </section>

        <section aria-labelledby="building">
          <H2 id="building" kicker="08">How it was built: many sessions, one set of rules</H2>
          <p>Several Claude Code sessions ran at once on the same codebase. Left alone, sessions working at the same time on the same files would break each other all day. What kept them apart was a set of rules, written down once, and read by every session before it starts.</p>
          <Figure caption="A rules file, docs and a memory go into each session. Each commits only its own work. The deploy runs from a clean copy of the code and waits for the tests."><SessionsDiagram /></Figure>
          <p>The rules file, CLAUDE.md, says how every session works:</p>
          <ul className="wx-points">
            <li><strong>Ship without asking.</strong> Commit, push, migrate the databases and deploy. No session waits for me to say yes.</li>
            <li><strong>Plain words in every line a player reads,</strong> so a kid on the bike understands it.</li>
            <li><strong>Made-up bike names only.</strong> No session invents a real brand.</li>
            <li><strong>Every screen built the same way,</strong> so the game feels like one game.</li>
            <li><strong>Changes go live first and into the labs only when I ask,</strong> so work does not hide in a side room.</li>
            <li><strong>Docs updated in the same commit.</strong> This is how sessions learn from each other: the next session reads what the last one changed, in the place it will look.</li>
          </ul>
          <p>Two more rules keep sessions from breaking each other. Each session commits only its own changes, so it never commits another session’s half-done work by accident. And the deploy runs from a clean copy of the code, not from the folder a session is working in, so nobody’s unfinished work goes live.</p>
          <p>A memory keeps my decisions across sessions. When I decide something once, such as how a screen looks or what a word means, it is written down, and a session that starts tomorrow already knows.</p>
          <p>There are also twelve lab pages. A lab lets me try a change before it reaches the real races. By the rules, changes go live first, and into the labs only when I ask for it.</p>
          <p className="wx-callout">The rules file is the contract. Every session reads it first, so many sessions behave like one team.</p>
        </section>

        <section aria-labelledby="wrong">
          <H2 id="wrong" kicker="09">What the AI got wrong, and how it was caught</H2>
          <p>The AI says “done” with the same confidence when it is wrong. These are four cases, and none was found by the AI’s own report:</p>
          <ul className="wx-points">
            <li><strong>The rider in a green test suit.</strong> The rider exported for the Apple TV test wore the 3D models’ green test suit. The kit was painted by a shader, and a shader cannot be carried inside a model file. The export did not know that, and no error was raised.</li>
            <li><strong>Backs that sagged.</strong> Riders’ backs dipped in the middle where a cyclist’s back rounds. It looked fine at a glance and wrong to anyone who has ridden a track bike.</li>
            <li><strong>Bots disqualified in the neutral lap,</strong> because judging went by position, as in section 03.</li>
            <li><strong>Invisible riders.</strong> In the Unity test, the riders were not drawn. Only their shadows were.</li>
          </ul>
          <p>Each was found by a test, or by looking at a close-up screenshot. That is why every 3D change gets a close-up, and why the deploy runs the tests. A test does not get tired and does not say “looks good.”</p>
        </section>

        <section aria-labelledby="estimate">
          <H2 id="estimate" kicker="10">The estimate, and its limits</H2>
          <p>How much work is this, for a conventional team? There are two ways to guess.</p>
          <p>By lines of code, the project is about 197,000 lines, which a team would need 15 to 50 person-years to write. The range is wide because lines of code are a poor measure of work.</p>
          <p>Feature by feature is better. Adding up the features, I get about 600 person-weeks to build, and 800 to 900 with design, management and testing. That is roughly 15 to 18 person-years, or a team of 15 to 20 for about a year. The headline figure of about 15 person-years is the low end of that.</p>
          <p>It is a model, not a measurement, and it has two limits. Code written by AI is longer than a careful person’s, so the line count flatters the amount of work. And a team’s estimate includes hardening: real players, real load and real bugs from the field. That has not happened here yet.</p>
        </section>

        <section aria-labelledby="practices">
          <H2 id="practices" kicker="11">Best practices</H2>
          <ol className="wx-practices">
            <li><strong>Write the rules down once, and make every session read them.</strong> A rules file is cheaper than a meeting.</li>
            <li><strong>Let the expert decide fast.</strong> One sentence from someone who has raced beats a week of research.</li>
            <li><strong>Ship without approval gates, but behind tests.</strong> Speed comes from not waiting for people. Safety comes from a deploy that stops when a test fails.</li>
            <li><strong>One shared platform layer instead of a copy per app.</strong> Keep it thin, and test that it stays thin.</li>
            <li><strong>Docs are how sessions learn from each other.</strong> Update them in the same change as the code.</li>
            <li><strong>Look close up before calling visual work done.</strong> The AI’s “done” is not a check.</li>
          </ol>
        </section>

        <section aria-labelledby="next">
          <H2 id="next" kicker="12">What’s next</H2>
          <p>Several things are not proven yet, and I would rather say so than let a count of commits stand in for them:</p>
          <ul className="wx-points">
            <li><strong>Real players, at scale.</strong> The game works. How it holds up with many riders racing at once, on many kinds of computer and phone, is still to be seen.</li>
            <li><strong>Trainer resistance on a real trainer.</strong> The control is built; it has to be proven on the trainers people really own.</li>
            <li><strong>The Android app in Google Play.</strong></li>
            <li><strong>The Apple TV app.</strong> It is a Unity app that draws the online race, and it has to be tested against Apple’s RealityKit on a real Apple TV.</li>
          </ul>
          <p>After that, I will contact velodromes in the US whose own track is already in the game, about a winter league.</p>
          <div className="wx-end">
            <p>Ask the assistant something a recruiter would ask.</p>
            <div className="wx-actions">
              <button className="primary-button" type="button" onClick={() => openAsk()}>Ask about Steven</button>
              <a className="text-link" href="https://wattfighters.com" target="_blank" rel="noreferrer">Visit wattfighters.com ↗</a>
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
