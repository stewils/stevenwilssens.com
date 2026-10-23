// The résumé data behind the site and the MCP server (functions/_lib/mcp): the
// roles, honors, recommendations, and press coverage. Plain data, no React, so
// the Pages Functions can import it too.

// key: stable id used by the MCP server's tools and the dossier table.
export type Entry = { key: string; role: string; company: string; dates: string; location: string; summary: string; points: string[] }
export const experiences: Entry[] = [
  { key: 'independent-ai-builder', role: 'Independent AI Product Builder', company: 'Independent', dates: 'Oct 2026 - Present', location: 'Seattle, Washington', summary: 'Building AI products independently after Microsoft.', points: ['Building AI Breaker, a Windows app that lets people turn off AI features in graduated levels.', 'Built a multi-tenant hosting and email platform with MCP-based AI apps in 16 days (wilssens.com): isolated server code and database per site, automated mailbox provisioning, and every action available on the web, over MCP and from a command line.', 'Runs juniortrackcycling.com, a content and analytics site for the junior track cycling community.'] },
  { key: 'windows-devices-data', role: 'Principal Group Product Manager - Windows & Devices Data', company: 'Microsoft', dates: 'Dec 2024 - Sep 2026', location: 'Redmond, Washington', summary: 'Led product management for the entire Windows & Devices Data organization: the data, insights, experimentation, and machine learning models that power decision-making across Windows and Devices.', points: ['Led a PM organization of about 20, working with more than 100 developers and data scientists, initially through three people managers, then led its move to a flatter team of about 12 during Microsoft’s cost reductions; roughly half the team was promoted under my leadership.', 'Owned strategy and roadmap for the data platform and insights products Windows engineers and PMs use to ship higher-quality releases.', 'Built the quality measurement framework that underpinned Windows K2, Microsoft’s high-profile push to improve Windows reliability and performance.', 'Ran the weekly ship-readiness quality review where Windows VPs made release decisions based on my team’s data on ship-blocking issues.', 'Scaled experimentation across Windows to hundreds of concurrent experiments, significantly reducing the number of features pulled back after release.', 'Owned the multi-million-dollar Windows data infrastructure budget; shut down a low-adoption on-device model platform and reinvested in platform modernization, cutting costs 30% over two years.', 'Shifted the team to AI-driven analytics and launched the first version, letting people ask business questions in natural language across every source in the data platform instead of relying on fixed queries.', 'Partnered with engineering, data science, and research leadership across telemetry from more than 1.6 billion Windows devices.'] },
  { key: 'csx-data', role: 'Principal Product Manager Lead - Windows Data', company: 'Microsoft', dates: 'Feb 2020 - Dec 2024', location: 'Redmond, Washington', summary: 'Built data products that told the story of the Windows customer experience and informed continuous improvement.', points: ['Redefined Windows quality measurement around end-to-end scenarios like gaming and the shell, creating the Perfect Day metric for issue-free user days.', 'Grew the team from one to five PMs, working with about 20 developers, leading to promotion to Principal Group Product Manager.', 'Drove measurable quality gains, with Perfect Day improving about 5% for gaming and 3–4% for the Windows shell.', 'Provided the data behind Windows release decisions: whether a build was ready to move from internal audiences to Insider preview, which issues had to be fixed, and ultimately whether a release met the quality bar to ship.', 'Built the alerting dashboards Windows teams used to catch customer-impacting issues, and ran the weekly Release Quality Review where area directors acted on them.'] },
  { key: 'azure-devops', role: 'Principal Product Manager Lead - Azure DevOps', company: 'Microsoft', dates: 'Sep 2019 - Feb 2020', location: 'Redmond, Washington', summary: 'Defined new products, go-to-market strategies, and business decisions for the Azure DevOps Platform.', points: ['Authored a DataOps product proposal compelling enough that the team building it was moved to GitHub, as the better home for the product.', 'Chose to stay at Microsoft rather than move to GitHub to lead the team building it.'] },
  { key: 'spatial-audio-lead', role: 'Principal Product Manager Lead - Silicon, Graphics, Media', company: 'Microsoft', dates: 'Jan 2018 - Sep 2019', location: 'Operating System Group · Redmond, Washington', summary: 'Led audio, spatial audio, game streaming, xCloud, Game DVR, broadcast, and casting initiatives.', points: ['Led six PMs, working with about 20 developers.', 'Led the Microsoft Spatial Audio Platform across Windows, Xbox One, and new platforms.', 'Grew monthly active devices playing spatial audio by more than 250% over 1.5 years.', 'Worked with developers and data insights to identify and deliver essential spatial audio features.', 'Partnered with game studios to ship spatial audio in major franchises, including Halo, Forza Horizon, Gears of War and Call of Duty.', 'Shaped Xbox xCloud game streaming strategy, prioritizing low latency over 4K resolution and making it the platform\'s key differentiator.'] },
  { key: 'spatial-audio-principal', role: 'Principal Product Manager - Silicon, Graphics, Media', company: 'Microsoft', dates: 'Sep 2017 - Jan 2018', location: 'Operating System Group · Redmond, Washington', summary: 'Drove the Windows Sonic spatial audio platform for Windows and Xbox One while representing Microsoft at developer and game conferences.', points: ['Drove the launch of Dolby Access v3 and DTS Sound Unbound with new app services, licensing, and customization models.', 'Built partnerships with Surface, Store, Marketing, and Gaming to expand spatial audio to more endpoints and games.', 'Collaborated with Disney+ and Netflix to bring Dolby Atmos to Xbox and Windows.'] },
  { key: 'spatial-audio-senior', role: 'Senior Product Manager - Silicon, Graphics, Media', company: 'Microsoft', dates: 'Oct 2008 - Aug 2017', location: 'Operating Systems Group · Redmond, Washington', summary: 'Led media platform work across casting, conferencing and spatial audio, culminating in the Spatial Audio Platform and Windows Sonic for Windows and Xbox One.', points: ['Brought casting to Windows and Windows Phone, shipping Miracast, DLNA and Play To so people could send media from a PC or phone to a TV.', 'Enabled HD conferencing on Surface RT and drove Media Foundation and Windows SDK work for media developers.', 'Brought spatial sound to Windows and Xbox: Windows Sonic for headphones, plus Dolby Atmos and DTS:X across headphones, home theater, and built-in laptop speakers on Surface, Lenovo and other devices.'] },
  { key: 'devdiv', role: 'Product Manager - Developer Division', company: 'Microsoft', dates: 'Oct 2006 - Sep 2008', location: 'Redmond, Washington', summary: 'Product manager in Microsoft\'s Developer Division working on developer ecosystem and community products.', points: ['Launched the Visual Studio Marketplace, giving developers one place to find and share Visual Studio extensions.', 'Drove CodePlex, Microsoft\'s open-source project hosting site.', 'Released the .NET Framework reference source, so developers could read and debug into the framework code.'] },
  { key: 'compuware', role: 'Lead Developer and Team Lead', company: 'Compuware', dates: 'Jan 2006 - Sep 2006', location: 'Belgium', summary: 'Led a team of about 15 developers and the Project Support Office for Fluxys.', points: ['Owned hiring, evaluation, education, and job assignment for the development team.', 'Implemented a new development process and framework, coached developers and architects, and managed build infrastructure.', 'Presented application development and Visual Studio Team System practices to customers and developer communities.'] },
  { key: 'cosmos', role: 'Software Developer', company: 'Cosmos', dates: 'Jan 2005 - Dec 2005', location: 'Antwerp Area, Belgium', summary: 'Built and supported software components across C# client and Java server systems using CORBA middleware. Joined as a consultant from Info Support, then hired full-time.', points: ['Provided technical guidance, application redesigns, developer support, and code reviews.', 'Worked on the Technical Components team responsible for construction, maintenance, and support.'] },
  { key: 'info-support', role: 'Developer and Trainer', company: 'Info Support', dates: 'Jan 2001 - Dec 2004', location: 'Belgium', summary: 'Developed distributed .NET applications and trained teams across multiple organizations.', points: ['Led a development team at Agfa Gevaert and built C# and Visual Studio .NET applications for several clients.', 'Created scalable ADO.NET and SQL Server solutions and advised project and management teams on .NET architecture.', 'Delivered software development, architecture, and training work across the full delivery lifecycle.'] },
]

export const honors = [['Microsoft Lighthouse Award for Teamwork', 'Issued by Microsoft · Jan 2012'], ['Microsoft Compass Award for Individual Excellence', 'Issued by Microsoft · Jan 2011'], ['Microsoft Gold Star Award', 'Issued by Microsoft · Jan 2011'], ['Most Valuable Professional (MVP): VS Team System', 'Issued by Microsoft · Jan 2006']]
export const news = [
  { title: 'All Xbox One consoles to get Dolby Atmos audio upmixing', publication: 'Alienware Arena', url: 'https://na.alienwarearena.com/ucf/show/1987916/boards/gaming-news/News/all-xbox-one-consoles-to-get-dolby-atmos-audio-upmixing', summary: 'Coverage of the Xbox Insider rollout that brought Dolby Atmos upmixing to Xbox One consoles, converting non-Atmos audio into a more immersive, object-based listening experience.', quote: '“There’ll be an option to toggle it off for those who want to hear non-Atmos audio in its original format.”' },
  { title: 'Xbox One And PC Getting Yet Another Cool New Audio Feature', publication: 'Forbes · John Archer', url: 'https://www.forbes.com/sites/johnarcher/2019/03/31/xbox-one-and-pc-getting-yet-another-cool-new-audio-feature/?', summary: 'A feature story about expanding spatial audio beyond encoded Atmos content, bringing a richer listening experience to Xbox One and PC games and media.', quote: 'Steven Wilssens is identified in the coverage as Xbox Audio Lead, helping shape the audio experience behind the feature.' },
  { title: 'DTS:X spatial surround sound coming to Windows 10 and Xbox One', publication: 'Windows Central', url: 'https://www.windowscentral.com/dtsx-spatial-surround-sound-coming-windows-10-xbox-one', summary: 'Coverage of DTS:X spatial surround sound coming to Windows 10 and Xbox One, part of the broader platform work to make immersive audio available across devices and content.', quote: 'Steven Wilssens is identified in the coverage as a leader of the spatial audio work bringing immersive sound to Windows and Xbox.' },
  { title: 'Spatial Audio with AudioGraph in UWP', publication: 'Microsoft Learn · Build 2016', url: 'https://learn.microsoft.com/en-us/shows/build-2016/p527', summary: 'A Build 2016 session focused on creating spatial audio experiences in Universal Windows Platform applications with AudioGraph.', quote: 'Steven Wilssens is associated with this early developer-facing work on spatial audio for Windows applications.' },
  { title: '“Throwing your voice” with Spatial Audio', publication: 'Windows Developer Blog', url: 'https://blogs.windows.com/windowsdeveloper/2016/09/15/throwing-your-voice-with-spatial-audio/', summary: 'A Windows developer story exploring how spatial audio can place a voice in a three-dimensional environment and make sound feel more present and directional.', quote: 'Steven Wilssens is associated with the Windows spatial-audio work discussed in this developer story.' },
]

export const recommendations = [
  ['Steve Rowe', 'Group Engineering Manager at Microsoft', `I had the privilege of working with Steven for five years. He was relentless in pursuing what he believed the product and our customers truly needed, even when it wasn’t the prevailing trend. Always full of ideas, he continually identified new features and opportunities to create customer value. Steven was also a quick study who could enter an unfamiliar space, rapidly develop a strong understanding of it, and begin generating thoughtful ideas.

Steven’s straightforward style made working with him refreshingly simple: he said what he meant, meant what he said, and readily changed his mind when presented with better ideas. He built strong connections quickly and consistently found the right people to help move work forward. As a leader, he had a clear vision for his team, cared deeply about his people, and invested significant time and energy in their growth and development.`],
  ['Varnitha Sonnegowda', 'Senior Program Manager at Microsoft | Windows Data Decision Intelligence R&D', `I had the privilege of reporting to Steven for over six years, during which time he grew into a Group Product Manager role. Throughout that journey, Steven consistently stood out as one of the most impactful leaders I've worked with.

What sets Steven apart is his rare combination of strategic thinking, product intuition, and willingness to dive deep into the details. He has an exceptional ability to connect customer needs with business outcomes and translate complex problems into clear, actionable plans. Whether driving a new initiative, navigating ambiguity, or helping teams align around a common vision, Steven brings clarity, focus, and momentum.

Steven is also a truly hands-on leader. He never hesitates to roll up his sleeves, challenge assumptions, and work alongside the team to solve difficult problems. His technical depth, product judgment, and bias for action enable him to quickly identify root causes and guide teams toward pragmatic, high-impact solutions.

Beyond his business and technical strengths, Steven is deeply invested in the growth and success of the people around him. He actively creates opportunities for others, advocates for their work, and ensures contributions are recognized. Many of the opportunities I've had in my career can be traced back to Steven's mentorship, trust, and willingness to help others grow. He is also a champion of diversity and inclusion. As I transitioned back to work after maternity leave as a mother of two, Steven's support, flexibility, and encouragement helped me navigate that transition with confidence and continue growing in my career.

I'm grateful for the guidance and support Steven has provided over the years, and I would highly recommend him to any organization looking for a leader who can build strong teams, deliver meaningful business impact, and inspire people to do their best work. Any organization would benefit immensely from Steven's product acumen, leadership, and unwavering commitment to people and results.`],
  ['Ryan Parsell', 'Principal Software Engineering Manager', `Steven has been one of my favorite people to brainstorm with and I'm already missing his intellectual partnership. We met weekly, working together on experimentation, AI, and plenty of hard problems. Steven is one of the people you want in the room when the answer isn't obvious. He’s curious, forward-thinking, and genuinely willing to explore unconventional ideas and approaches rather than immediately shut them down. When working on tough engineering and data science problems, Steven was a champion of not letting perfect be the enemy of good.

Steven brought his deep technical and software engineering experience to the art of product management. And to an extent kept working as a software engineer. Steven completed some large AI projects that even after his departure are having significant impact here.

I really enjoyed working with him and would happily do it again.`],
  ['Vlad Goncharov', 'Senior Software Engineer at Microsoft', `I had the pleasure of working with Steven Wilssens for approximately six years at Microsoft, including during his tenure as Group Product Manager on our team. We collaborated on several significant projects, and I developed a strong appreciation for his judgment, professionalism, and approach to product leadership.

What impressed me most was Steven’s ability to examine an existing product and quickly recognize where it could better serve customers. He brought a clear vision for how a product should evolve, with customer needs consistently guiding his priorities. His recommendations reflected careful consideration of what needed to change and why that change would matter.

Steven was also an excellent communicator. He expressed his ideas with precision and made the reasoning behind his proposals easy to follow. I particularly valued the clarity he brought to our discussions, which helped us work through complex questions and establish a shared understanding of our objectives.

I recommend Steven with confidence for senior product leadership roles. He combines strong product instincts with the ability to articulate a compelling direction, and I would be glad to work with him again.`],
  ['Omari Carter-Thorpe', 'Senior Software Engineer at Microsoft', `I worked with Steven for roughly six years—four while he was a Principal PM Lead and two while he was the Group Product Manager for our PM and SWE team.

Steven is particularly strong at finding a path forward when the obvious approach isn't available. He looks at problems from different angles, identifies alternative routes to the end goal, and is pragmatic about what it takes to get there. He also has a strong ability to build relationships across the broader Windows organization and turn those relationships into productive partnerships—helping teams align, bring the right people together, and move work forward.

He navigates well at different levels of detail. While much of his role has him operating at the broader level of strategy and direction, when the situation calls for it he is equally effective getting into the details, understanding the realities on the ground, and working through complex situations with the team.

Steven is a strong partner and an effective leader. He is particularly good at communicating strategy in writing, bringing clarity to direction, decisions, and priorities and helping teams understand not just where they are going, but why.

I valued the opportunity to work with Steven over those six years and would welcome the opportunity to work with him again.`],
  ['Tom Mereckis', 'Data and AI Leader', `I fully recommend Steven as a great technology, product, and team leader. We worked together for a half decade on the Windows data team, partnering on numerous critical and complex projects. I always found him to be technically deep, able to learn more very quickly, able to apply what he knows to uncertain situations, and an effective leader of both his own people but also others around him. He always works and collaborates with great energy, and always seeks to do the right things. Together we delivered numerous impactful data products and systems for Windows for both customers and internal use. I'd work with him again anytime, anywhere, on anything.`],
  ['Amit Gupte', 'Senior Technical Program Manager - Data & AI Platform at Microsoft', `Steven was a trusted mentor to me for three years and my skip-level manager for two. He pairs a deep commitment to product excellence with a true builder’s mindset, having established the critical data products and rhythms that measured and elevated Windows quality across preview channels and retail scale. His intuitive understanding of customer behavior was second to none, notably demonstrated when he accurately forecast how a key Windows AI feature would land in retail well before broad rollout.

He leads by building rather than just delegating. When a retiring OKR management tool created an operational vacuum, Steven partnered with me to ideate and rapidly stand up a functional replacement from scratch, showing his understanding of modern AI SDLC.

Beyond his strategic acumen, Steven is a dedicated people champion. He was an invaluable sounding board for tough problems, continually advocated for my work, and made sure my work had the right visibility. Any organization would benefit immensely from his vision, energy, and leadership.`],
  ['Jayant Arora', 'Product at Microsoft | AI Product Management', `I’ve had the opportunity to work with Steven for several years, first as my manager and later as my skip-level manager. Throughout that time, he has been one of the most impactful leaders and coaches in my career.

What sets Steven apart is his combination of strong product leadership, technical aptitude, and genuine investment in his team. He leads from a strategic level and gives his team the space to own their work but never shies away from getting into the details when needed. Whether it’s understanding a complex technical problem, working through ambiguity, or helping unblock a difficult initiative, Steven has always been willing to get his hands dirty and help the team find a path forward.

He has led the team through multiple successful projects and consistently demonstrated the grit needed to drive large initiatives forward. His attention to detail, problem-solving ability, and commitment to transparency create an environment where teams can execute with clarity and confidence. He is also someone who will advocate strongly for his people and make sure their contributions are seen.

One of Steven’s greatest strengths is his ability to create opportunities for his team. He actively finds ways for people to grow, represents their work effectively, and ensures they get the visibility and recognition they deserve.

I’m incredibly grateful for the coaching, trust, and opportunities Steven has given me over the years. His leadership has shaped how I approach problems, think about products, and navigate my own career. He is the kind of leader who can see the bigger picture, understand the technical details when it matters, and bring his team along with him.`],
]

export const education = { degree: 'Bachelor’s degree, Computer Science', school: 'Karel de Grote, Belgium', dates: '2000 - 2004' }
export const languages = 'Dutch and English (native), French (intermediate)'

export const recommendationLinks: Record<string, string> = {
  'Steve Rowe': 'https://www.linkedin.com/in/steverowe/?skipRedirect=true',
  'Varnitha Sonnegowda': 'https://www.linkedin.com/in/varnitha/?skipRedirect=true',
  'Ryan Parsell': 'https://www.linkedin.com/in/ryanparsell/?skipRedirect=true',
  'Vlad Goncharov': 'https://www.linkedin.com/in/vlad-goncharov/?skipRedirect=true',
  'Omari Carter-Thorpe': 'https://www.linkedin.com/in/omari-carter-thorpe-b46078159/',
  'Tom Mereckis': 'https://www.linkedin.com/in/tom-mereckis-6651562/?skipRedirect=true',
  'Amit Gupte': 'https://www.linkedin.com/in/amit-gupte/?skipRedirect=true',
  'Jayant Arora': 'https://www.linkedin.com/in/arorajayant/',
}

// The About page in Steven's own words: the line under the title and the paragraphs, in
// reading order (the first one is the green opening). Plain text only: the page renders it
// as text, the site assistant quotes it, and it changes through the MCP's proposals, whose
// guards (functions/_lib/mcp/about.ts) its tests also run on this copy.
export type About = { intro: string; paragraphs: string[] }
export const about: About = {
  intro: 'A product and technology leader beginning a new chapter after Microsoft.',
  paragraphs: [
    'After nearly 20 years at Microsoft, I am now bringing a career in data, AI, product strategy, software, and people leadership into its next chapter.',
    'Most recently, I led the Windows & Devices Data PM team, advancing the Windows ecosystem through data-driven strategies. I care about the space where customer signals, experimentation, machine learning, and strong product judgment meet.',
    'Before leading Windows data teams, I built products and platforms across Azure DevOps, spatial audio, game streaming, and operating systems. Earlier still, I was a developer and team lead in Belgium, where I learned to pair technical depth with practical delivery and the growth of the people around me.',
  ],
}

// Who Steven is, in the words the site, the resume PDF and the MCP server share.
// scripts/resume.mjs builds the PDF from this file and src/resume.test.ts fails when
// the PDF no longer matches it, so a change here always comes with a new resume.
export const profile = {
  name: 'Steven Wilssens',
  headline: 'Product leader who invents new products, using data, experimentation and AI as tools',
  resumeHeadline: 'Product leader who invents new products, using data, experimentation and AI as tools',
  summary: 'Product leader with nearly 20 years at Microsoft, inventing products in areas I was new to: spatial audio for Windows and Xbox, the low-latency approach behind xCloud game streaming, casting, and the data and experimentation systems that decide what ships on more than 1.6 billion Windows devices. Co-inventor on 19 granted US patents spanning spatial audio, game streaming, casting and device telemetry. I lead teams of 10 to 20 product managers, use data, experimentation and AI to find what works, and keep building products myself.',
  lookingFor: 'Product leadership roles building new products, where data, experimentation and AI are tools rather than the job',
  location: 'Seattle, Washington',
  workArrangement: 'Seattle-based, open to remote or hybrid, and to coordinated travel; not relocating.',
  workAuthorization: 'US permanent resident (green card)',
  availability: 'Available now',
  teamSize: '10 to 20 product managers',
  email: 'steven@wilssens.com',
  phone: '425.533.7722',
  linkedin: 'https://www.linkedin.com/in/steven-wilssens-59495889/',
  site: 'https://steven.wilssens.com',
  // The public read-only MCP server (functions/_lib/mcp/): recruiters' AI assistants read the resume, roles, recommendations, patents and public notes as tools.
  mcp: 'https://steven.wilssens.com/mcp',
  resumePdf: '/steven-wilssens-resume-2026.pdf',
  resumeFileName: 'Steven Wilssens Resume 2026.pdf',
}

// The numbers on the home page and in the resume's key achievements. `backing` is the
// key of the role whose bullets explain the number; a number without backing is one a
// hiring manager will ask about, and the recruiter review flags it.
export type Impact = { value: string; label: string; backing?: string }
export const impact: Impact[] = [
  { value: '250%+', label: 'growth in monthly active spatial-audio devices', backing: 'spatial-audio-lead' },
  { value: '1.6B+', label: 'Windows devices informing product decisions', backing: 'windows-devices-data' },
  { value: '+5%', label: 'Perfect Day improvement for Windows gaming', backing: 'csx-data' },
  // TODO(steven): no csx-data bullet states the ~30% yet; should a bullet say it (e.g. "about 30% fewer issue days across Perfect Day scenarios")?
  { value: '~30%', label: 'fewer issue days across Perfect Day scenarios', backing: 'csx-data' },
]

// Keywords the resume carries for applicant tracking systems and recruiter searches.
export const skills = [
  'New product invention, from zero to one',
  'Product strategy and roadmaps',
  'Platform and game partnerships (Dolby, DTS, Netflix, Disney+, Halo, Forza Horizon, Gears of War, Call of Duty)',
  'Data platforms, experimentation and A/B testing',
  'AI and machine learning products',
  'Hands-on AI product building (Claude Code, MCP, Cloudflare)',
  'Leading PM organizations of 10 to 20, including managers of managers',
  'Executive communication',
  'Software engineering background (C#, .NET)',
]

// Selected work: the data and AI chapter (2020 to 2026) first, then the two earlier
// stories recruiters ask about. Outcomes stay within what is public or what colleagues
// wrote in their recommendations; `source` names who said it.
export type Work = { key: string; title: string; period: string; role: string; context: string; work: string; outcome: string; source?: string; link?: { href: string; label: string } }
export const selectedWork: Work[] = [
  { key: 'windows-quality', title: 'Windows quality, measured from preview channels to retail', period: '2020 - 2026', role: 'csx-data', context: 'Windows ships to more than 1.6 billion devices. Engineers needed to know whether a release was healthy before it reached customers, and to find the issues that mattered once it had.', work: 'Led the PM team that built the data products and the review rhythms measuring Windows quality across the Insider preview channels and at retail scale, weaving customer signals and machine learning into insights engineers act on.', outcome: 'Adopted by every Windows team, and behind the roughly 30% drop in issue days across Perfect Day scenarios.' },
  { key: 'experimentation-ai', title: 'Experimentation and AI for how Windows is built', period: '2024 - 2026', role: 'windows-devices-data', context: 'As Group PM for Windows & Devices Data, I set the direction for how experimentation, machine learning and AI are used internally to accelerate Windows product development.', work: 'Met weekly with engineering leadership on experimentation and AI problems, and delivered large AI projects myself alongside the team’s roadmap.', outcome: '“Steven completed some large AI projects that even after his departure are having significant impact here.”', source: 'Ryan Parsell' },
  { key: 'ai-feature-forecast', title: 'Forecasting how a Windows AI feature would land', period: '2024 - 2026', role: 'windows-devices-data', context: 'A key Windows AI feature was heading to retail, and leadership wanted to know how customers would receive it.', work: 'Read the preview-channel signals and forecast the feature’s retail reception well before broad rollout.', outcome: 'The forecast held. Amit Gupte calls it the clearest demonstration of “an intuitive understanding of customer behavior second to none.”', source: 'Amit Gupte' },
  { key: 'okr-tool', title: 'An OKR tool, rebuilt with AI when the old one retired', period: '2024 - 2026', role: 'windows-devices-data', context: 'The organization’s OKR management tool was being retired, leaving the planning rhythm without a home.', work: 'With a member of my team, ideated and stood up a working replacement from scratch using AI coding tools, rather than waiting for a procurement cycle. Built in six months to replace Viva Goals, Microsoft’s acquired OKR product, after it was retired.', outcome: 'The gap was closed with a functional replacement, and the project became the team’s working example of a modern AI development lifecycle.', source: 'Amit Gupte' },
  { key: 'wilssens-com', title: 'wilssens.com: a multi-tenant hosting and email platform built in 16 days', period: '2026', role: 'general', context: 'After Microsoft, I wanted to stay sharp on what platform teams ship by shipping one: email and websites at the family domain for everyone named Wilssens.', work: 'Designed and built the platform with Claude Code: rules enforced by the database, experiments shipped dark and measured, AI help restricted by architecture rather than by prompt, and payments built and switched off.', outcome: 'Live with five sites and the family’s mailboxes, each site on its own isolated Worker and database; the design decisions are written up for hiring managers.', link: { href: '/building-wilssens', label: 'Read the write-up' } },
  { key: 'spatial-audio', title: 'Spatial audio, from a Windows feature to a platform', period: '2016 - 2019', role: 'spatial-audio-lead', context: 'Immersive audio existed in cinemas and on a few headsets. Windows and Xbox needed a platform that developers, Dolby, DTS and streaming services would build on.', work: 'Led the Microsoft Spatial Audio Platform across Windows and Xbox: Windows Sonic, the Dolby Access and DTS Sound Unbound launches, and the partnerships with Disney+ and Netflix that brought Dolby Atmos to both.', outcome: 'Monthly active devices playing spatial audio grew more than 250% in 18 months, and the work produced 19 granted US patents.', link: { href: '/patents', label: 'See the patents' } },
]
