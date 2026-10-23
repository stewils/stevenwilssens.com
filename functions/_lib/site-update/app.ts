// What the site's GitHub App (the site bot) made, and only that (specs/mcp-prs-automation.md,
// AC-11, AC-22, C16, C17). The automations of A and B (redo, merge, fix) trust a pull request,
// a marker or a comment only when these say the App wrote it; the MCP uses them from A0 on.
// Pure functions over data the caller read from GitHub, plus one reader that asks GitHub for
// a pull request's commits and its branch's activity.

// The site bot: the App's slug (the repository variable SITE_BOT_SLUG) and its user's id, which
// GitHub puts in the bot's commit address. Keep in step with the App on GitHub.
export type SiteBot = { slug: string; id: number }
export const siteBot: SiteBot = { slug: 'stevenwilssens-site-bot', id: 345656571 }
// The bot as REST names it (user.login, the activity's actor) and as git records it.
export const botLogin = (bot: SiteBot = siteBot) => `${bot.slug}[bot]`
export const botIdentity = (bot: SiteBot = siteBot) => ({ name: botLogin(bot), email: `${bot.id}+${botLogin(bot)}@users.noreply.github.com` })

// The branches the Site update workflow pushes: update/<slug>-<run number>.
export const appBranch = /^update\/[a-z0-9-]+-[0-9]+$/

// An actor as GitHub gives it: REST says "<slug>[bot]", GraphQL says the slug with __typename Bot.
export type Actor = { login?: string | null; __typename?: string | null; type?: string | null } | null | undefined
export const isBot = (actor: Actor, bot: SiteBot = siteBot) => Boolean(actor?.login) && (actor!.login === botLogin(bot) || (actor!.login === bot.slug && (actor!.__typename === 'Bot' || actor!.type === 'Bot')))

// Text counts as the App's only when the App wrote it and nobody else edited it last: GitHub's
// `editor` is the last editor (null when never edited), and any token with pull-requests: write
// can edit a body or a comment and keep its author (the filter review.yml applies to Steven's replies).
export type Authored = { author?: Actor; editor?: Actor; body?: string | null }
export const appWrote = (text: Authored, bot: SiteBot = siteBot) => isBot(text.author, bot) && (!text.editor || isBot(text.editor, bot))

// The App's own markers and lines: the request marker in a pull request body, and in A and B its
// comments (redo-of, a fix round's note, "Merged by itself", a revert's reverts:). One reader for all.
export const appMarkers = {
  request: /<!--\s*site-update-request\s+([A-Za-z0-9+/=]+)\s*-->/g,
  redoOf: /^redo-of: (\d+) main: ([0-9a-f]{40})$/gm,
  round: /<!--\s*fix-round (\d+)\s*-->/g,
  mergedByItself: /^Merged by itself: checks green and six approvals on ([0-9a-f]{40})/gm,
  reverts: /^reverts: ([0-9a-f]{40})$/gm,
} as const
// The last match of a marker in the App's own unedited texts, or null. The last: the App writes its
// markers at the end, after any text it copies in, so a marker planted in that text comes earlier.
export const appText = (texts: Authored[], pattern: RegExp, bot: SiteBot = siteBot): RegExpMatchArray | null => {
  let found: RegExpMatchArray | null = null
  for (const text of texts) {
    if (!appWrote(text, bot)) continue
    const last = [...(text.body ?? '').matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))].at(-1)
    if (last) found = last
  }
  return found
}

// Whether the label `hold` holds a pull request (AC-9, AC-22). Anyone may put it on: holding is always
// safe. It is lifted only when the label is off and the timeline's last event for it is an `unlabeled`
// by the repository owner; removed by anyone else (a bot, a workflow, the App) it still holds. A
// timeline that cannot be read holds.
export type LabelEvent = { event: 'labeled' | 'unlabeled' | string; label: string | null; actor: string | null }
export const holdLabel = 'hold'
export const holdState = (labels: string[], timeline: LabelEvent[] | null, owner: string) => {
  if (labels.includes(holdLabel)) return true
  if (timeline === null) return true
  const last = timeline.filter((item) => item.label === holdLabel && (item.event === 'labeled' || item.event === 'unlabeled')).at(-1)
  if (!last) return false
  return !(last.event === 'unlabeled' && last.actor === owner)
}

// One commit of a pull request, and one entry of its branch's activity, as the readers shape them.
export type PullCommit = { sha: string; author: { name: string; email: string } | null; committer: { name: string; email: string } | null; parents: number }
export type BranchActivity = { type: string; actor: string | null; before: string | null; after: string | null }
// What the predicate reads: the pull request as listed, its commits and its branch's activity (null when unreadable).
export type AppPullData = { repo: string; headRepo: string | null; branch: string; author: string | null; headSha: string | null; commits: PullCommit[] | null; activity: BranchActivity[] | null }
// GitHub lists at most this many commits of a pull request in one page; a longer one is not vouched for.
export const COMMIT_PAGE = 100

// Why a pull request is not an App pull request, or null when it is: head repository this one; branch
// update/<slug>-<n>; opened by the bot; every commit's author and committer the bot, none of them a merge
// (AC-9a's merge commit is A's, with its own rule); and in the branch's activity every push and its
// creation by the bot, the newest one ending at the head. Activity that cannot be read is a no.
export const appPullProblem = (data: AppPullData, bot: SiteBot = siteBot): string | null => {
  const login = botLogin(bot)
  const { name, email } = botIdentity(bot)
  if (!data.headRepo || data.headRepo.toLowerCase() !== data.repo.toLowerCase()) return 'it comes from another repository'
  if (!appBranch.test(data.branch)) return `its branch ${data.branch} is not one the Site update workflow makes`
  if (data.author !== login) return `it was opened by ${data.author ?? 'someone unknown'}, not by ${login}`
  if (!data.headSha) return 'its head commit is not known'
  if (!data.commits) return 'its commits could not be read'
  if (!data.commits.length || data.commits.length >= COMMIT_PAGE) return `it has ${data.commits.length} commits, which cannot be vouched for`
  for (const commit of data.commits) {
    if (commit.parents !== 1) return `commit ${commit.sha.slice(0, 7)} is a merge commit`
    for (const [role, who] of [['author', commit.author], ['committer', commit.committer]] as const) {
      if (!who || who.name !== name || who.email !== email) return `commit ${commit.sha.slice(0, 7)} has ${who ? `${who.name} <${who.email}>` : 'nobody'} as ${role}`
    }
  }
  if (data.commits.at(-1)!.sha !== data.headSha) return 'its last commit is not its head'
  if (!data.activity) return "its branch's activity could not be read"
  const pushes = data.activity.filter((item) => item.type !== 'branch_deletion')
  if (!pushes.length) return "its branch's activity is empty"
  const other = pushes.find((item) => item.actor !== login)
  if (other) return `${other.actor ?? 'someone unknown'} pushed to its branch (${other.type})`
  if (!pushes.some((item) => item.type === 'branch_creation')) return 'its branch was not created by the bot'
  // The activity API lists the newest first.
  if (pushes[0].after !== data.headSha) return 'its head is not what the bot last pushed'
  return null
}
export const isAppPullRequest = (data: AppPullData, bot: SiteBot = siteBot) => appPullProblem(data, bot) === null

// A pull request made before the App, by the built-in token's bot (the old path): never fixed, redone or
// merged by any automation, and listed to Steven as made the old way.
export const oldWayAuthors = ['github-actions[bot]', 'app/github-actions', 'github-actions']
export const madeTheOldWay = (pull: { author?: string | null; branch: string }) => Boolean(pull.author && oldWayAuthors.includes(pull.author)) && pull.branch.startsWith('update/')

// The reader: what the predicate needs, from GitHub. Any error reads as unreadable (so not an App pull request).
export type AppPullReader = {
  repo: string
  pullCommits(number: number): Promise<PullCommit[] | null>
  activity(branch: string): Promise<BranchActivity[] | null>
}
export const readAppPull = async (github: AppPullReader, pull: { number: number; headRepo: string | null; branch: string; author?: string | null; headSha?: string | null }): Promise<AppPullData> => {
  const safely = async <T>(read: () => Promise<T | null>) => { try { return await read() } catch (error) { console.error('app pull request', String(error)); return null } }
  const [commits, activity] = await Promise.all([safely(() => github.pullCommits(pull.number)), appBranch.test(pull.branch) ? safely(() => github.activity(pull.branch)) : Promise.resolve(null)])
  return { repo: github.repo, headRepo: pull.headRepo, branch: pull.branch, author: pull.author ?? null, headSha: pull.headSha ?? null, commits, activity }
}
