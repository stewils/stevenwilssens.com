// What the site-update tools say to Steven. The tools' other fields keep GitHub's ids so they
// can chain; the `say` line is the one or two sentences his assistant tells him, in his words:
// "your update", "ready to check", "live on your site", never a pull request, run or branch.

// Added to every site-update tool's description.
export const speakPlainly = 'Speak to Steven in plain English: say "your update", "ready to check", "live on your site". Never mention pull request numbers, runs, branches, workflows or merges unless he asks. Every answer has a say field: tell him that (in your own words if you like); the other fields are only for calling the next tool.'

// An update's short human name, from its title: "Foresight summary" becomes "Foresight summary
// update"; a longer title that already reads as a name stays as it is. Never a number.
export const updateName = (title: string | null | undefined) => {
  const clean = (title ?? '').replace(/#\d+/g, ' ').replace(/\s+/g, ' ').replace(/ ([:;,.])/g, '$1').trim().replace(/[\s.:;,–—-]+$/, '')
  if (!clean) return 'site update'
  // The Building refreshes' runs are titled by the workflow (site-update.yml run-name).
  const refresh = /^Refresh the Building write-up about (.+)$/i.exec(clean)
  if (refresh) return `Building ${refresh[1]} write-up refresh`
  let name = clean.charAt(0).toUpperCase() + clean.slice(1)
  if (!/\b(update|refresh|change|fix)\b/i.test(name) && name.split(' ').length <= 4) name = `${name} update`
  if (name.length <= 60) return name
  const cut = name.slice(0, 60)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 30 ? cut.lastIndexOf(' ') : 60)}…`
}

// The name keeps its case after "your": its first word may be a name (Foresight, HiPo, ATS).
const yours = (name: string) => `your ${name}`
const Yours = (name: string) => `Your ${name}`

export type ScoreDrop = { before: number | null; after: number } | null
const scoreLine = (score: ScoreDrop) => (score && score.before !== null ? ` One thing first: this version of your résumé scores lower with job-application software (${score.before} → ${score.after} out of 100) than the one live today.` : '')

export const say = {
  started: (name: string, redo: boolean) => redo
    ? `I'm making ${yours(name)} again on top of what is live now. It takes about 10 minutes; I'll tell you when it's ready to check.`
    : `I've started on ${yours(name)}. It takes about 10 minutes; I'll tell you when it's ready to check.`,
  stillWorking: (name: string) => `${Yours(name)} is still being made.`,
  ready: (name: string, preview: string, score: ScoreDrop) => `${Yours(name)} is ready to check: ${preview}.${scoreLine(score)} Want it live?`,
  alreadyLive: (name: string) => `${Yours(name)} is already live on your site.`,
  setAside: (name: string) => `${Yours(name)} was set aside and is not on your site. Want me to make it again?`,
  nothingToChange: (name: string) => `${Yours(name)} needed no changes: your site already says this.`,
  notCarriedOut: (name: string) => `I couldn't make ${yours(name)}, so nothing on your site changed. Want me to try again?`,
  notFound: (name: string) => `${Yours(name)} is done, but I can't find it to show you yet. Let me look.`,
  failed: (name: string) => `Something went wrong while making ${yours(name)}, and nothing on your site changed. Want me to try again?`,
  live: (name: string, applied: number) => `${Yours(name)} is live on your site; it shows within a few minutes.${applied ? ` ${applied === 1 ? 'The change you approved is' : `The ${applied} changes you approved are`} now marked done.` : ''}`,
  notLiveYet: (name: string) => `${Yours(name)} didn't go live yet; I'll try again.`,
  redoing: (name: string) => `That update clashed with one that just went live, so I'm redoing ${yours(name)} on top of it. About 10 minutes.`,
  closed: (name: string, waiting: number) => `I've set aside ${yours(name)}; nothing on your site changed.${waiting ? ` ${waiting === 1 ? 'The change you approved waits' : 'The changes you approved wait'} for the next update.` : ''}`,
  alreadyClosed: (name: string) => `${Yours(name)} was already set aside.`,
  // site_update_status: what is ready, what is being made, what scores lower, in one or two sentences.
  status: (ready: string[], making: string[], lowering: string[]) => {
    const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)
    const parts: string[] = []
    if (ready.length) parts.push(`${ready.length === 1 ? `${Yours(ready[0])} is` : `${ready.length} updates are`} ready to check${ready.length > 1 ? `: ${list(ready)}` : ''}.`)
    if (making.length) parts.push(`${making.length === 1 ? `${Yours(making[0])} is` : `${making.length} updates are`} still being made.`)
    if (lowering.length) parts.push(`${list(lowering.map((name, index) => (index ? yours(name) : Yours(name))))} would make your résumé score lower with job-application software.`)
    return parts.length ? parts.join(' ') : 'Nothing is waiting: every update is live or set aside.'
  },
}
