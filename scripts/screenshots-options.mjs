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
