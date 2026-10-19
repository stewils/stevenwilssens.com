import { useCallback, useEffect, useRef, useState } from 'react'
import { ignoreKey } from '../analytics'
import { AssistantPage } from './AssistantPage'
import { AudiencePage } from './AudiencePage'
import { CrawlersPage } from './CrawlersPage'
import { formatAgo, formatTime } from './format'
import { LinksPage } from './LinksPage'
import { McpPage } from './McpPage'
import { badgeCounts, computeNeeds, computeSummaries } from './needs'
import { Overview } from './Overview'
import { pageById, pages, type PageDef } from './pages'
import { ResumePage } from './ResumePage'
import { PageSkeleton } from './Skeleton'
import { SourcesPage } from './SourcesPage'
import { SpeedPage } from './SpeedPage'
import { SubNav } from './SubNav'
import { TrafficPage } from './TrafficPage'
import type { AdminData, AskInfo, McpInfo, ResumeInfo, Stats } from './types'

// The dashboard: a menu on the left (a tab bar on narrow screens) with one page per
// area, chosen by the URL hash; the overview lists what needs Steven and links there.
// Same access as before: one shared ADMIN_TOKEN, typed once, kept in this browser's
// localStorage, sent as Authorization: Bearer; a 401 clears it.

const tokenKey = 'sw-admin-token'
const themeKey = 'sw-admin-theme'
const ranges = [[1, 'Today'], [7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '1 year']] as const
// Dark like the site unless Steven picks light or auto (the system); admin.html applies the choice before the first paint.
type Theme = 'dark' | 'light' | 'system'
const themes: [Theme, string][] = [['dark', 'Dark'], ['light', 'Light'], ['system', 'Auto']]
// Numbers older than this are fetched again when the tab comes back into view.
const STALE_MS = 5 * 60_000

const storage = {
  get: (key: string) => { try { return localStorage.getItem(key) } catch { return null } },
  set: (key: string, value: string | null) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* storage unavailable */ } },
}

type Loaded<T> = { data: T | null; error: string; loading: boolean }

// One admin API call, re-run when its path changes (the range, a refresh). Loading
// until the answer for the current path is in.
function useApi<T>(path: string, token: string, onUnauthorized: () => void): Loaded<T> {
  const [state, setState] = useState<{ data: T | null; error: string; answered: string }>({ data: null, error: '', answered: '' })
  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(path, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 401) { onUnauthorized(); return }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as T
        if (!cancelled) setState({ data, error: '', answered: path })
      })
      .catch((error: unknown) => { if (!cancelled) setState((current) => ({ ...current, error: error instanceof Error ? error.message : 'Request failed', answered: path })) })
    return () => { cancelled = true }
  }, [path, token, onUnauthorized])
  return { data: state.data, error: state.error, loading: state.answered !== path }
}

function Login({ onSubmit, error }: { onSubmit: (token: string) => void; error: string }) {
  const [value, setValue] = useState('')
  return (
    <main className="login">
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(value.trim()) }}>
        <h1>Admin</h1>
        <p>Enter the admin token to run steven.wilssens.com: visitors, the résumé score, the assistant and your career MCP.</p>
        <input type="password" autoComplete="current-password" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Admin token" aria-label="Admin token" autoFocus />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary">Sign in</button>
      </form>
    </main>
  )
}

const readHash = () => (typeof location === 'undefined' ? '' : location.hash.slice(1))

export default function Admin() {
  const [token, setToken] = useState(() => storage.get(tokenKey) ?? '')
  const [days, setDays] = useState(30)
  const [refreshCount, setRefreshCount] = useState(0)
  const [loginError, setLoginError] = useState('')
  const [ignored, setIgnored] = useState(() => storage.get(ignoreKey) === '1')
  const [theme, setTheme] = useState<Theme>(() => (themes.some(([value]) => value === storage.get(themeKey)) ? (storage.get(themeKey) as Theme) : 'dark'))
  const [hash, setHash] = useState(readHash)
  const [now, setNow] = useState(() => Date.now())
  const scroller = useRef<HTMLDivElement>(null)

  const signOut = (message = '') => { storage.set(tokenKey, null); setToken(''); setLoginError(message) }
  const rejected = useCallback(() => { storage.set(tokenKey, null); setToken(''); setLoginError('That token was not accepted.') }, [])
  const tz = -new Date().getTimezoneOffset()
  const stats = useApi<Stats>(`/api/stats?days=${days}&tz=${tz}&r=${refreshCount}`, token, rejected)
  const ask = useApi<AskInfo>(`/api/ask/admin?days=${days}&r=${refreshCount}`, token, rejected)
  const mcp = useApi<McpInfo>(`/api/mcp?r=${refreshCount}`, token, rejected)
  const resume = useApi<ResumeInfo>(`/api/resume?r=${refreshCount}`, token, rejected)

  useEffect(() => {
    const onChange = () => setHash(readHash())
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  const page: PageDef = pageById(hash) ?? pages[0]
  useEffect(() => {
    document.title = `${page.title} · Admin · steven.wilssens.com`
    scroller.current?.scrollTo({ top: 0 })
  }, [page])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    storage.set(themeKey, theme === 'dark' ? null : theme)
  }, [theme])
  // "Updated 4 min ago" keeps counting, and numbers that went stale while the tab was
  // in the background are fetched again as soon as it is looked at.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(tick)
  }, [])
  const generatedAt = stats.data?.generatedAt
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && generatedAt && Date.now() - generatedAt > STALE_MS) setRefreshCount((count) => count + 1) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [generatedAt])

  if (!token) return <Login onSubmit={(value) => { storage.set(tokenKey, value); storage.set(ignoreKey, '1'); setIgnored(true); setLoginError(''); setToken(value) }} error={loginError} />

  const data: AdminData = { days, stats: stats.data, mcp: mcp.data, ask: ask.data, resume: resume.data }
  const needs = computeNeeds(data)
  const badges = badgeCounts(needs)
  const summaries = computeSummaries(data)
  const loading = stats.loading || ask.loading || mcp.loading || resume.loading
  const errors = [['visitor data', stats.error], ['the assistant', ask.error], ['the MCP', mcp.error], ['the résumé', resume.error]].filter(([, error]) => error).map(([what, error]) => `Could not load ${what} (${error}).`)
  const version = `${Boolean(stats.data)}${Boolean(ask.data)}${Boolean(mcp.data)}${Boolean(resume.data)}|${days}|${refreshCount}`
  const waiting = (what: string, chart = true) => <PageSkeleton what={what} chart={chart} />

  const content = () => {
    switch (page.id) {
      case 'traffic': return stats.data ? <TrafficPage stats={stats.data} /> : waiting('visitor data')
      case 'sources': return stats.data ? <SourcesPage stats={stats.data} /> : waiting('visitor data', false)
      case 'audience': return stats.data ? <AudiencePage stats={stats.data} /> : waiting('visitor data', false)
      case 'crawlers': return stats.data ? <CrawlersPage stats={stats.data} /> : waiting('crawler data')
      case 'speed': return stats.data ? <SpeedPage vitals={stats.data.vitals} /> : waiting('page speed data', false)
      case 'resume': return resume.data ? <ResumePage resume={resume.data} proposals={mcp.data?.proposals ?? null} /> : waiting('the résumé report', false)
      case 'assistant': return ask.data ? <AssistantPage info={ask.data} days={days} /> : waiting("the assistant's numbers")
      case 'mcp': return mcp.data ? <McpPage info={mcp.data} /> : waiting('the MCP details', false)
      case 'links': return <LinksPage />
      default: return <Overview data={data} needs={needs} summaries={summaries} />
    }
  }

  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="#overview"><span className="mark" aria-hidden="true">SW</span><span>steven.wilssens.com<small>Admin</small></span></a>
        <nav className="tabs" aria-label="Admin pages">
          {pages.map((item) => (
            <a key={item.id} href={`#${item.id}`} aria-current={item.id === page.id ? 'page' : undefined}>
              {item.icon}<span className="lbl">{item.title}</span>
              {(badges[item.id] ?? 0) > 0 && <span className="tab-badge">{badges[item.id]! > 99 ? '99+' : badges[item.id]}</span>}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <a className="site-link" href="/">Open the site ↗</a>
          <label><input type="checkbox" checked={ignored} onChange={() => { storage.set(ignoreKey, ignored ? null : '1'); setIgnored(!ignored) }} /> Don't track this browser</label>
          <div className="theme" role="group" aria-label="Theme">
            {themes.map(([value, label]) => <button type="button" key={value} className={theme === value ? 'active' : ''} aria-pressed={theme === value} onClick={() => setTheme(value)}>{label}</button>)}
          </div>
          <button type="button" onClick={() => signOut()}>Sign out</button>
        </div>
      </aside>

      <main className="main" id="scroller" ref={scroller}>
        <div className="main-in">
          <header className="page-head">
            <div>
              <h1>{page.title}</h1>
              <p className="page-sub">{page.sub}</p>
            </div>
            <div className="head-tools">
              {page.range && (
                <div className="ranges" role="group" aria-label="Time range">
                  {ranges.map(([value, label]) => <button type="button" key={value} className={days === value ? 'active' : ''} aria-pressed={days === value} onClick={() => setDays(value)}>{label}</button>)}
                </div>
              )}
              <button type="button" className="ghost" onClick={() => setRefreshCount((count) => count + 1)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
              {generatedAt && <span className="updated" title={formatTime(generatedAt)}>Updated {formatAgo(generatedAt, now)}</span>}
            </div>
          </header>
          {errors.map((error) => <p key={error} className="banner" role="alert">{error}</p>)}

          <SubNav scroller={scroller} page={page.id} version={version} />

          <div className="page" key={page.id} data-page={page.id}>
            {content()}
          </div>
        </div>
      </main>
    </div>
  )
}
