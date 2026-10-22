// What the site-update tools say to Steven. The tools' other fields keep GitHub's ids so they
// can chain; the `say` line is the one or two sentences his assistant tells him, in his words:
// "your update", "ready to check", "live on your site", never a pull request, run or branch.

// Added to every site-update tool's description.
export const speakPlainly = 'Speak to Steven in plain English: say "your update", "ready to check", "live on your site". Never mention pull request numbers, runs, branches, workflows or merges unless he asks. Every answer has a say field: tell him that (in your own words if you like); the other fields are only for calling the next tool.'

const cap = (name: string) => {
  if (name.length <= 60) return name
  const cut = name.slice(0, 60)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 30 ? cut.lastIndexOf(' ') : 60)}…`
}

// An update's short human name, from its title: "Foresight summary" becomes "Foresight summary
// update". Never a number, never markup: the title is chosen by whoever opened the update, and
// the name goes into the line Steven's assistant repeats, so links, tags and control characters go.
export const updateName = (title: string | null | undefined) => {
  const clean = (title ?? '')
    // oxlint-disable-next-line no-control-regex -- control and direction characters never reach the spoken line
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[[\]()<>{}`*_|\\~^]/g, ' ')
    .replace(/\b(?:PR|pull request)\s*#?\d+/gi, ' ')
    .replace(/#\d+/g, ' ')
    .replace(/\s+/g, ' ').replace(/ ([:;,.])/g, '$1').trim()
    .replace(/^[\s.:;,–—-]+|[\s.:;,–—-]+$/g, '')
  if (!/[a-z]/i.test(clean)) return 'site update'
  // The Building refreshes' runs are titled by the workflow (site-update.yml run-name).
  const refresh = /^Refresh the Building write-up about (.+)$/i.exec(clean)
  if (refresh) return cap(`Building ${refresh[1]} write-up refresh`)
  let name = clean.charAt(0).toUpperCase() + clean.slice(1)
  if (!/\b(update|refresh|change|fix)\b/i.test(name)) name = `${name} update`
  return cap(name)
}

// The name keeps its case after "your": its first word may be a name (Foresight, HiPo, ATS).
const yours = (name: string) => `your ${name}`
const Yours = (name: string) => `Your ${name}`

export type ScoreDrop = { before: number | null; after: number } | null
const scoreLine = (score: ScoreDrop) => (score && score.before !== null ? ` Before you say yes: this version of your résumé scores lower with job-application software (from ${score.before} to ${score.after} out of 100) than the one live today.` : '')

export const say = {
  started: (name: string, redo: boolean) => redo
    ? `I'm making ${yours(name)} again on top of what is live now. It takes about 10 minutes; I'll tell you when it's ready to check.`
    : `I've started on ${yours(name)}. It takes about 10 minutes; I'll tell you when it's ready to check.`,
  stillWorking: (name: string) => `${Yours(name)} is still being made.`,
  // The preview link comes last, so no full stop is read as part of it.
  ready: (name: string, preview: string, score: ScoreDrop) => `${Yours(name)} is ready to check.${scoreLine(score)} Want it live? Preview: ${preview}`,
  checksFailed: (name: string) => `${Yours(name)} isn't ready to go live: the team's checks on it haven't passed.`,
  notReadyYet: (name: string) => `${Yours(name)} isn't ready to go live yet: the team's checks on it are still running or haven't passed.`,
  clashes: (name: string) => `${Yours(name)} clashes with an update that went live since. Say yes and I'll make it again on top of that one; it takes about 10 minutes.`,
  alreadyLive: (name: string) => `${Yours(name)} is already live on your site.`,
  setAside: (name: string) => `${Yours(name)} was set aside and is not on your site. Want me to make it again?`,
  nothingToChange: (name: string) => `${Yours(name)} needed no changes: your site already says this.`,
  notCarriedOut: (name: string) => `I couldn't make ${yours(name)}, so nothing on your site changed. Want me to try again?`,
  notFound: (name: string) => `${Yours(name)} is done, but I can't find it to show you yet. Let me look.`,
  failed: (name: string) => `Something went wrong while making ${yours(name)}, and nothing on your site changed. Want me to try again?`,
  live: (name: string, applied: number) => `${Yours(name)} is going live on your site; it shows within a few minutes.${applied ? ` ${applied === 1 ? 'The change you approved is' : `The ${applied} changes you approved are`} now marked done.` : ''}`,
  notLiveYet: (name: string) => `${Yours(name)} didn't go live yet; I'll try again in a moment.`,
  changedSince: (name: string, preview: string) => `${Yours(name)} changed after you looked at it, so I didn't put it live. Have a look at the newer version first. Preview: ${preview}`,
  redoing: (name: string) => `${Yours(name)} clashed with an update that just went live, so I'm redoing it on top of that one. About 10 minutes; I'll tell you when it's ready to check.`,
  remade: (name: string, preview: string) => `${Yours(name)} was already made again on top of what is live. Want the new version live? Preview: ${preview}`,
  closed: (name: string, waiting: number) => `I've set aside ${yours(name)}; nothing on your site changed.${waiting ? ` ${waiting === 1 ? 'The change you approved waits' : 'The changes you approved wait'} for the next update.` : ''}`,
  alreadyClosed: (name: string) => `${Yours(name)} was already set aside.`,
  // site_update_status: what is ready, being made, held back by checks, clashing, scoring lower.
  status: (parts: { ready: string[]; making: string[]; held: string[]; clashing: string[]; lowering: string[] }) => {
    const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)
    const some = (names: string[], one: string, many: string) => (names.length === 1 ? `${Yours(names[0])} ${one}` : `${names.length} updates ${many}`)
    const { ready, making, held, clashing, lowering } = parts
    const lines: string[] = []
    if (ready.length) lines.push(`${some(ready, 'is', 'are')} ready to check${ready.length > 1 ? `: ${list(ready)}` : ''}.`)
    if (making.length) lines.push(`${some(making, 'is', 'are')} still being made.`)
    if (held.length) lines.push(`${some(held, 'is', 'are')} waiting for the team's checks to pass${held.length > 1 ? `: ${list(held)}` : ''}.`)
    if (clashing.length) lines.push(`${some(clashing, 'needs', 'need')} making again before going live${clashing.length > 1 ? `: ${list(clashing)}` : ''}.`)
    if (lowering.length) lines.push(`${list(lowering.map((name, index) => (index ? yours(name) : Yours(name))))} would make your résumé score lower with job-application software.`)
    return lines.length ? lines.join(' ') : 'Nothing is waiting: every update is live or set aside.'
  },
}
