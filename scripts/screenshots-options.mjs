// The options of scripts/screenshots.mjs, kept pure so the rules can be tested
// (scripts/screenshots-options.test.mjs): which pages, which server, and which admin token
// goes where. The implicit token (ADMIN_TOKEN or .dev.vars) only ever goes to a local
// server: a branch preview runs that branch's code, so it only gets a token passed
// explicitly with --token.

// An argument the run cannot go ahead with; the script prints its message alone (no stack).
export class OptionError extends Error {}

export const localHosts = ['localhost', '127.0.0.1', '[::1]']

// KEY=value lines of .dev.vars; blank lines and # comments are skipped.
export const parseDevVars = (text) => Object.fromEntries(text.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]))

// Without the leading slash too (experience, admin#resume): Git Bash rewrites /experience into a Windows path.
export const normalizePaths = (positionals) => (positionals.length ? positionals : ['/']).map((path) => path === 'home' ? '/' : path.startsWith('/') ? path : `/${path}`)

export const resolveOptions = ({ base: givenBase, token: givenToken, port = '8789', positionals = [], env = {}, devVars = {} }) => {
  if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) throw new OptionError(`--port ${port} is not a port number`)
  const base = (givenBase ?? `http://127.0.0.1:${port}`).replace(/\/+$/, '')
  let hostname
  try { hostname = new URL(base).hostname } catch { throw new OptionError(`--base ${givenBase} is not an address (https://…)`) }
  const local = localHosts.includes(hostname)
  const paths = normalizePaths(positionals)
  const token = givenToken ?? (local ? env.ADMIN_TOKEN ?? devVars.ADMIN_TOKEN : undefined) ?? ''
  if (!token && paths.some((path) => path.startsWith('/admin'))) {
    throw new OptionError(local ? 'Admin pages need a token: pass --token, set ADMIN_TOKEN or put it in .dev.vars' : `Admin pages on ${base} need --token (the local token is only used for a local server)`)
  }
  return { base, local, paths, token }
}

// The widths to take: desktop (1440) and phone (390) unless --widths names others, such as
// a 1280 laptop. A phone is taken at 2x with --slices, so text can be read in a slice.
export const viewportsFor = (widths = '1440,390', slices = false) => String(widths).split(',').map((item) => item.trim()).filter(Boolean).map((text) => {
  const width = Number(text)
  if (!/^\d+$/.test(text) || width < 280 || width > 3840) throw new OptionError(`--widths ${widths}: ${text} is not a width from 280 to 3840`)
  const phone = width < 600
  return { name: width === 1440 ? 'desktop' : width === 390 ? 'phone' : `w${width}`, width, height: phone ? 844 : width < 1440 ? 800 : 900, scale: phone && slices ? 2 : 1 }
})

// The admin scrolls its pane (.main), not the window (body:has(.shell) { overflow: hidden }),
// so a screenshot has to scroll whatever scrolls. These two run in the page (Playwright sends
// their source), so each finds the scroller itself: the pane when it scrolls, else the document.
export function measureScroller() {
  const pane = document.querySelector('.main')
  const scroller = pane && pane.scrollHeight > pane.clientHeight ? pane : (document.scrollingElement ?? document.documentElement)
  return { pane: scroller === pane, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight }
}
export function scrollScrollerTo(top) {
  const pane = document.querySelector('.main')
  const scroller = pane && pane.scrollHeight > pane.clientHeight ? pane : (document.scrollingElement ?? document.documentElement)
  scroller.scrollTop = top
  return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(scroller.scrollTop))))
}

// Where each slice starts. In the admin's pane a slice is a screen less the sticky section
// bar (STICKY px), so nothing is hidden under it; the last slice ends at the bottom.
export const STICKY = 60
export const sliceTops = ({ pane, scrollHeight, clientHeight }) => {
  const step = Math.max(1, pane ? clientHeight - STICKY : clientHeight)
  const last = Math.max(0, scrollHeight - clientHeight)
  const tops = []
  for (let top = 0; top < last; top += step) tops.push(top)
  return [...tops, last]
}
