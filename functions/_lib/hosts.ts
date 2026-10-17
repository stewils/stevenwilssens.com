// Which address a request should be redirected to, if any.
//
// steven.wilssens.com is the one public address of this site. The production
// pages.dev address redirects to it, and so does every name under wilssens.net,
// which is registered only to protect the name: name.wilssens.net goes to
// name.wilssens.com, and the bare domain (with or without www) goes to the
// family platform at www.wilssens.com. Preview deployments
// (<hash>.stevenwilssens.pages.dev) are left alone.

export const canonicalHost = 'steven.wilssens.com'
export const productionPagesHost = 'stevenwilssens.pages.dev'

const netSuffix = '.wilssens.net'

export const redirectHost = (hostname: string): string | null => {
  if (hostname === productionPagesHost) return canonicalHost
  if (hostname === 'wilssens.net' || hostname === `www${netSuffix}`) return 'www.wilssens.com'
  if (hostname.endsWith(netSuffix)) return `${hostname.slice(0, -netSuffix.length)}.wilssens.com`
  return null
}

// steven.wilssens.net was a dasBlog site until 2009; its ASP.NET addresses have
// no equivalent here, so they go to the home page instead of a 404.
const oldBlogPath = /\.(aspx|ashx|asmx)$/i

// The address to redirect to, keeping the path and query, or null to serve the request.
export const redirectTarget = (url: URL): string | null => {
  const host = redirectHost(url.hostname)
  if (!host) return null
  const target = new URL(url)
  target.protocol = 'https:'
  target.hostname = host
  target.port = ''
  if (url.hostname === `steven${netSuffix}` && oldBlogPath.test(url.pathname)) {
    target.pathname = '/'
    target.search = ''
  }
  return target.toString()
}
