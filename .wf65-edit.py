p = 'src/articles/wattfighters/WattFightersArticle.tsx'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert s.count(a) == 1, a
    s = s.replace(a, b)


rep("import { SessionsDiagram } from './Diagrams'", "import { DecideDiagram, FixFlowDiagram, HourDiagram, SessionsDiagram, StatusLegend } from './Diagrams'")
rep("the estimate in section 10 is his own model.", "the estimate in section 13 is his own model.\n// Sections 10 to 12 mark every step Built or Planned: much of that system is written down,\n// with its numbers chosen, but not built yet (as of 1 November 2026).")
rep("  ['wrong', 'What the AI got wrong'],\n", "  ['wrong', 'What the AI got wrong'],\n  ['fixing', 'Keeping it working'],\n  ['alone', 'When a fix may go live on its own'],\n  ['alerts', 'The alerts, and the bell'],\n")
rep("""const Figure = ({ children, caption }: { children: ReactNode; caption: string }) => <figure className="wx-figure wx-diagram"><div className="wx-diagram-scroll" role="group" aria-label={caption} tabIndex={0}>{children}</div><figcaption>{caption}</figcaption></figure>""",
    """// A diagram drawn twice (across and stacked) fits a phone, so it needs no "swipe" hint; one
// that marks steps Built or Planned carries the legend under it.
const Figure = ({ children, caption, fits, legend }: { children: ReactNode; caption: string; fits?: boolean; legend?: boolean }) => <figure className={fits ? 'wx-figure wx-diagram wx-diagram--fits' : 'wx-figure wx-diagram'}><div className="wx-diagram-scroll" role="group" aria-label={caption} tabIndex={0}>{children}</div>{legend && <StatusLegend />}<figcaption>{caption}</figcaption></figure>

const Built = () => <strong>Built.</strong>
const Planned = () => <strong>Planned.</strong>""")
rep("""<a href="#wrong">What the AI got wrong</a></li>
""", """<a href="#wrong">What the AI got wrong</a></li>
            <li><strong>Safe speed needs rules for when a machine may ship.</strong> A fix goes live on its own only when a test shows the problem, every test passes, many players have it, and it touches no protected part. Everything else waits for me. <a href="#fixing">Keeping it working</a></li>
""")
new = open('.wf65-sections.txt', encoding='utf-8').read()
rep('''        <section aria-labelledby="estimate">
          <H2 id="estimate" kicker="10">''', new + '''        <section aria-labelledby="estimate">
          <H2 id="estimate" kicker="13">''')
rep('kicker="11">Best practices', 'kicker="14">Best practices')
rep('kicker="12">What’s next', 'kicker="15">What’s next')
open(p, 'w', encoding='utf-8').write(s)
