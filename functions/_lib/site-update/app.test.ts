// @vitest-environment node
// What the site bot made, and only that (specs/mcp-prs-automation.md, AC-11, AC-22, C16, C17).
import { describe, expect, it, vi } from 'vitest'
import { appMarkers, appPullProblem, appText, appWrote, botIdentity, botLogin, holdState, isAppPullRequest, isBot, madeTheOldWay, readAppPull, siteBot, type AppPullData, type AppPullReader, type BranchActivity, type PullCommit } from './app'

const HEAD = 'c'.repeat(40)
const BOT = botIdentity()
const commit = (sha: string, extra: Partial<PullCommit> = {}): PullCommit => ({ sha, author: { ...BOT }, committer: { ...BOT }, parents: 1, ...extra })
const push = (extra: Partial<BranchActivity> = {}): BranchActivity => ({ type: 'push', actor: botLogin(), before: 'b'.repeat(40), after: HEAD, ...extra })
const data = (extra: Partial<AppPullData> = {}): AppPullData => ({
  repo: 'stewils/stevenwilssens.com', headRepo: 'stewils/stevenwilssens.com', branch: 'update/team-size-47', author: botLogin(), headSha: HEAD,
  commits: [commit(HEAD)], activity: [push({ type: 'branch_creation', before: '0'.repeat(40) })], ...extra,
})

describe('the site bot', () => {
  it('is the App by its slug, as REST and git name it', () => {
    expect(siteBot.slug).toBe('stevenwilssens-site-bot')
    expect(botLogin()).toBe('stevenwilssens-site-bot[bot]')
    expect(BOT).toEqual({ name: 'stevenwilssens-site-bot[bot]', email: '345656571+stevenwilssens-site-bot[bot]@users.noreply.github.com' })
  })

  it('is the bot under its REST login, or its slug only when GraphQL says it is a Bot', () => {
    expect(isBot({ login: 'stevenwilssens-site-bot[bot]' })).toBe(true)
    expect(isBot({ login: 'stevenwilssens-site-bot', __typename: 'Bot' })).toBe(true)
    expect(isBot({ login: 'stevenwilssens-site-bot', type: 'Bot' })).toBe(true)
    // A user could be called like the slug; only the Bot type makes it the App.
    expect(isBot({ login: 'stevenwilssens-site-bot', __typename: 'User' })).toBe(false)
    expect(isBot({ login: 'github-actions', __typename: 'Bot' })).toBe(false)
    expect(isBot(null)).toBe(false)
    expect(isBot({ login: null })).toBe(false)
  })
})

describe('an App pull request (C17)', () => {
  it('passes when every part is the bot\'s', () => {
    expect(appPullProblem(data())).toBeNull()
    expect(isAppPullRequest(data())).toBe(true)
    // Several commits by the bot, the newest push at the head, a force-push by the bot too.
    expect(isAppPullRequest(data({ commits: [commit('a'.repeat(40)), commit(HEAD)], activity: [push(), push({ type: 'force_push', after: 'a'.repeat(40) }), push({ type: 'branch_creation' })] }))).toBe(true)
  })

  it.each([
    ['another head repository', { headRepo: 'someone/fork' }, /another repository/],
    ['a deleted fork', { headRepo: null }, /another repository/],
    ['update/x', { branch: 'update/x' }, /not one the Site update workflow makes/],
    ['update/a-1/b', { branch: 'update/a-1/b' }, /not one/],
    ['upper case', { branch: 'update/Team-47' }, /not one/],
    ['opened by github-actions', { author: 'github-actions[bot]' }, /opened by github-actions\[bot\]/],
    ['opened by Steven', { author: 'stewils' }, /opened by stewils/],
    ['no author', { author: null }, /someone unknown/],
    ['no head', { headSha: null }, /head commit is not known/],
    ['commits unreadable', { commits: null }, /could not be read/],
    ['no commits', { commits: [] }, /0 commits/],
    ['a page full of commits', { commits: Array.from({ length: 100 }, (_x, i) => commit(String(i).padStart(40, '0'))) }, /100 commits/],
    ['a commit by Claude', { commits: [commit(HEAD, { author: { name: 'claude', email: 'noreply@anthropic.com' } })] }, /claude <noreply@anthropic.com> as author/],
    ['a commit by github-actions', { commits: [commit(HEAD, { committer: { name: 'github-actions[bot]', email: '41898282+github-actions[bot]@users.noreply.github.com' } })] }, /as committer/],
    ['one of two commits by someone else', { commits: [commit('a'.repeat(40), { author: { name: 'Steven Wilssens', email: 's@example.com' } }), commit(HEAD)] }, /Steven Wilssens/],
    ['a commit with no committer', { commits: [commit(HEAD, { committer: null })] }, /nobody as committer/],
    ['a merge commit (AC-9a is A\'s)', { commits: [commit(HEAD, { parents: 2 })] }, /merge commit/],
    ['a head that is not the last commit', { commits: [commit('a'.repeat(40))] }, /last commit is not its head/],
    ['activity unreadable', { activity: null }, /activity could not be read/],
    ['empty activity', { activity: [] }, /activity is empty/],
    ['a push by another actor', { activity: [push({ actor: 'stewils' }), push({ type: 'branch_creation' })] }, /stewils pushed/],
    ['a push by an unknown actor', { activity: [push({ actor: null }), push({ type: 'branch_creation' })] }, /someone unknown pushed/],
    ['the branch created by another actor', { activity: [push(), push({ type: 'branch_creation', actor: 'github-actions[bot]' })] }, /github-actions\[bot\] pushed to its branch \(branch_creation\)/],
    ['no creation in the activity', { activity: [push()] }, /not created by the bot/],
    ['a force-push nobody recorded (the last push is not the head)', { activity: [push({ type: 'branch_creation', after: 'd'.repeat(40) })] }, /not what the bot last pushed/],
  ] as [string, Partial<AppPullData>, RegExp][])('refuses %s', (_what, extra, reason) => {
    expect(appPullProblem(data(extra))).toMatch(reason)
    expect(isAppPullRequest(data(extra))).toBe(false)
  })

  it('reads a branch deletion as no push (a branch deleted and made again by the bot)', () => {
    expect(isAppPullRequest(data({ activity: [push({ type: 'branch_creation' }), { type: 'branch_deletion', actor: 'stewils', before: HEAD, after: '0'.repeat(40) }] }))).toBe(true)
  })

  it('reads the commits and the activity from GitHub, and any error as unreadable', async () => {
    const pull = { number: 47, headRepo: 'stewils/stevenwilssens.com', branch: 'update/team-size-47', author: botLogin(), headSha: HEAD }
    const reader = (commits: () => Promise<PullCommit[] | null>, activity: () => Promise<BranchActivity[] | null>): AppPullReader & { branches: string[] } => {
      const branches: string[] = []
      return { repo: 'stewils/stevenwilssens.com', branches, pullCommits: commits, activity: async (branch) => { branches.push(branch); return activity() } }
    }
    const good = reader(async () => [commit(HEAD)], async () => [push({ type: 'branch_creation' })])
    expect(isAppPullRequest(await readAppPull(good, pull))).toBe(true)
    expect(good.branches).toEqual(['update/team-size-47'])
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const status of [403, 404, 500]) {
      const refused = reader(async () => [commit(HEAD)], async () => { throw new Error(`GitHub ${status} on /activity`) })
      expect(await readAppPull(refused, pull)).toMatchObject({ activity: null })
      expect(isAppPullRequest(await readAppPull(refused, pull))).toBe(false)
    }
    const broken = reader(async () => { throw new Error('not JSON') }, async () => [])
    expect(await readAppPull(broken, pull)).toMatchObject({ commits: null })
    error.mockRestore()
    // A branch the workflow does not make is never asked about.
    const other = reader(async () => [commit(HEAD)], async () => [push()])
    expect(await readAppPull(other, { ...pull, branch: 'main', author: undefined, headSha: undefined })).toMatchObject({ activity: null, author: null, headSha: null })
    expect(other.branches).toEqual([])
  })
})

describe('made the old way', () => {
  it('is a Site update pull request opened by the built-in token\'s bot', () => {
    expect(madeTheOldWay({ author: 'github-actions[bot]', branch: 'update/team-sizes-38' })).toBe(true)
    expect(madeTheOldWay({ author: 'app/github-actions', branch: 'update/x-1' })).toBe(true)
    expect(madeTheOldWay({ author: botLogin(), branch: 'update/x-1' })).toBe(false)
    expect(madeTheOldWay({ author: 'github-actions[bot]', branch: 'feature' })).toBe(false)
    expect(madeTheOldWay({ author: null, branch: 'update/x-1' })).toBe(false)
    expect(madeTheOldWay({ branch: 'update/x-1' })).toBe(false)
  })
})

describe("the App's own text (AC-22, C16)", () => {
  const app = { login: 'stevenwilssens-site-bot', __typename: 'Bot' }
  const others = [
    ['Steven', { login: 'stewils', __typename: 'User' }],
    ['github-actions', { login: 'github-actions', __typename: 'Bot' }],
    ['another bot', { login: 'dependabot', __typename: 'Bot' }],
  ] as const
  const kinds = [
    ['the request marker', appMarkers.request, '<!-- site-update-request eyJ0aXRsZSI6IngifQ== -->', 'eyJ0aXRsZSI6IngifQ=='],
    ['a redo-of comment', appMarkers.redoOf, `redo-of: 81 main: ${HEAD}`, '81'],
    ['a round note', appMarkers.round, '<!-- fix-round 2 -->', '2'],
    ['Merged by itself', appMarkers.mergedByItself, `Merged by itself: checks green and six approvals on ${HEAD}`, HEAD],
    ["a revert's reverts:", appMarkers.reverts, `reverts: ${HEAD}`, HEAD],
  ] as const

  describe.each(kinds)('%s', (_kind, pattern, line, value) => {
    it('counts when the App wrote it and nobody edited it, or only the App did', () => {
      expect(appText([{ author: app, editor: null, body: `x\n${line}\n` }], pattern)?.[1]).toBe(value)
      expect(appText([{ author: app, editor: app, body: line }], pattern)?.[1]).toBe(value)
      expect(appText([{ author: { login: 'stevenwilssens-site-bot[bot]' }, body: line }], pattern)?.[1]).toBe(value)
    })
    it.each(others)('does not count when %s edited it', (_who, editor) => {
      expect(appText([{ author: app, editor, body: line }], pattern)).toBeNull()
    })
    it.each(others)('does not count when %s wrote it', (_who, author) => {
      expect(appText([{ author, editor: null, body: line }], pattern)).toBeNull()
    })
  })

  it('takes the last match of the App\'s texts, never one planted earlier or in someone else\'s', () => {
    const planted = `<!-- site-update-request AAAA -->\ntext\n<!-- site-update-request BBBB -->`
    expect(appText([{ author: app, body: planted }], appMarkers.request)?.[1]).toBe('BBBB')
    expect(appText([{ author: app, body: '<!-- site-update-request CCCC -->' }, { author: others[0][1], body: '<!-- site-update-request DDDD -->' }, { author: app, body: 'none' }], appMarkers.request)?.[1]).toBe('CCCC')
    expect(appText([{ author: app }], appMarkers.reverts)).toBeNull()
    // A pattern without the g flag is read the same way.
    expect(appText([{ author: app, body: 'reverts: 1\nreverts: 2' }], /reverts: (\d)/)?.[1]).toBe('2')
    expect(appWrote({ author: app, editor: undefined })).toBe(true)
  })
})

describe('hold (AC-22, C16)', () => {
  const owner = 'stewils'
  const labeled = (actor: string) => ({ event: 'labeled', label: 'hold', actor })
  const unlabeled = (actor: string) => ({ event: 'unlabeled', label: 'hold', actor })
  it('holds while the label is on', () => expect(holdState(['hold'], [labeled('someone')], owner)).toBe(true))
  it('is lifted when the owner removed it', () => expect(holdState([], [labeled('someone'), unlabeled(owner)], owner)).toBe(false))
  it.each(['someone', 'github-actions[bot]', botLogin()])('still holds when %s removed it', (actor) => expect(holdState([], [labeled(owner), unlabeled(actor)], owner)).toBe(true))
  it('holds when the owner removed it and anyone put it back', () => expect(holdState([], [labeled('a'), unlabeled(owner), labeled('someone')], owner)).toBe(true))
  it('holds when it was put on and no removal is recorded', () => expect(holdState([], [labeled('someone')], owner)).toBe(true))
  it('holds when the timeline cannot be read', () => expect(holdState([], null, owner)).toBe(true))
  it('does not hold a pull request that never had it, and reads only hold\'s events', () => {
    expect(holdState(['accept-lower-score'], [], owner)).toBe(false)
    expect(holdState([], [{ event: 'labeled', label: 'other', actor: 'x' }, { event: 'commented', label: 'hold', actor: 'x' }], owner)).toBe(false)
  })
})

describe('git identity alone never proves an update is the bot\'s (C17)', () => {
  it('every commit with the bot as author and committer is not enough without the bot as every pusher', () => {
    const commits = [commit('a'.repeat(40)), commit(HEAD)]
    expect(isAppPullRequest(data({ commits, activity: null }))).toBe(false)
    expect(isAppPullRequest(data({ commits, activity: [] }))).toBe(false)
    expect(isAppPullRequest(data({ commits, activity: [push({ actor: 'stewils' }), push({ type: 'branch_creation' })] }))).toBe(false)
    expect(isAppPullRequest(data({ commits, activity: [push({ type: 'branch_creation', actor: 'github-actions[bot]' })] }))).toBe(false)
    expect(isAppPullRequest(data({ commits, activity: [push({ type: 'branch_creation' })] }))).toBe(true)
  })
})
