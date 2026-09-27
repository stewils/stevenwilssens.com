import type { Env } from './_lib/env'

const canonicalHost = 'steven.wilssens.com'
const productionPagesHost = 'stevenwilssens.pages.dev'

// Send the production pages.dev address to the custom domain so there is one
// public URL. Preview deployments (<hash>.stevenwilssens.pages.dev) are left alone.
export const onRequest: PagesFunction<Env> = async ({ request, next }) => {
  const url = new URL(request.url)
  if (url.hostname !== productionPagesHost) return next()
  url.hostname = canonicalHost
  url.protocol = 'https:'
  return Response.redirect(url.toString(), 301)
}
