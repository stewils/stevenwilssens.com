// Which address a request should be redirected to, if any.
//
// steven.wilssens.com is the one public address of this site. The production
// pages.dev address redirects to it, and so does everything under wilssens.net:
// Steven's personal domain since 2005, registered again only so the name is not
// taken by someone else. Preview deployments (<hash>.stevenwilssens.pages.dev)
// are left alone.

export const canonicalHost = 'steven.wilssens.com'
export const productionPagesHost = 'stevenwilssens.pages.dev'

const isNetHost = (hostname: string) => hostname === 'wilssens.net' || hostname.endsWith('.wilssens.net')

// steven.wilssens.net was a dasBlog site until 2009; its ASP.NET addresses have
// no equivalent here, so they go to the home page instead of a 404.
const oldBlogPath = /\.(aspx|ashx|asmx)$/i

// The address to redirect to, keeping the path and query, or null to serve the request.
export const redirectTarget = (url: URL): string | null => {
  if (url.hostname !== productionPagesHost && !isNetHost(url.hostname)) return null
  const target = new URL(url)
  target.protocol = 'https:'
  target.hostname = canonicalHost
  target.port = ''
  if (isNetHost(url.hostname) && oldBlogPath.test(url.pathname)) {
    target.pathname = '/'
    target.search = ''
  }
  return target.toString()
}
