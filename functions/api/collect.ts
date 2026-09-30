import type { Env } from '../_lib/env'
import { isBot, parseUserAgent } from '../_lib/useragent'

type Payload = {
  type?: string
  pageviewId?: string
  path?: string
  title?: string
  referrer?: string
  utm?: Record<string, string>
  category?: string
  label?: string
  target?: string
  context?: string
  durationMs?: number
  scrollPct?: number
  language?: string
  screen?: string
  viewport?: string
  metric?: string
  value?: number
  rating?: string
}

const eventTypes = new Set(['pageview', 'engagement', 'click', 'vital'])
const metrics = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'])
const ratings = new Set(['good', 'needs-improvement', 'poor'])
const text = (value: unknown, max = 300) => (typeof value === 'string' && value ? value.slice(0, max) : null)
const int = (value: unknown, max: number) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(Math.round(value), max)) : null)

const hash = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest).slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const hostOf = (url: string | null) => {
  if (!url) return null
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return null }
}

const retentionMs = 395 * 86_400_000 // 13 months, as stated on /privacy

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('Origin')
  if (origin && new URL(origin).host !== requestUrl.host) return new Response(null, { status: 403 })

  // Preview deployments share this database; only production and local dev count.
  if (requestUrl.hostname.endsWith('.pages.dev')) return new Response(null, { status: 204 })

  const userAgent = request.headers.get('User-Agent') ?? ''
  if (isBot(userAgent)) return new Response(null, { status: 204 })

  const body = await request.text()
  if (body.length > 8_000) return new Response(null, { status: 413 })
  let payload: Payload
  try { payload = JSON.parse(body) } catch { return new Response(null, { status: 400 }) }
  if (!payload.type || !eventTypes.has(payload.type)) return new Response(null, { status: 400 })

  const now = Date.now()
  const day = new Date(now).toISOString().slice(0, 10)
  const ip = request.headers.get('CF-Connecting-IP') ?? ''
  const visitor = await hash(`${env.HASH_SALT ?? ''}|${day}|${ip}|${userAgent}`)
  const agent = parseUserAgent(userAgent)
  const cf = (request.cf ?? {}) as IncomingRequestCfProperties
  const referrer = text(payload.referrer, 500)
  const referrerHost = hostOf(referrer)
  const utm = payload.utm ?? {}

  await env.DB.prepare(`INSERT INTO events (ts, type, visitor, pageview_id, host, path, title, referrer, referrer_host, utm_source, utm_medium, utm_campaign, utm_term, utm_content, category, label, target, context, duration_ms, scroll_pct, country, region, city, postal_code, timezone, latitude, longitude, asn, as_org, colo, browser, browser_version, os, device, language, screen, viewport, metric, metric_value, metric_rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    now, payload.type, visitor, text(payload.pageviewId, 40), requestUrl.hostname, text(payload.path, 300), text(payload.title, 200),
    referrer, referrerHost === requestUrl.hostname.replace(/^www\./, '') ? null : referrerHost,
    text(utm.source, 100), text(utm.medium, 100), text(utm.campaign, 100), text(utm.term, 100), text(utm.content, 100),
    text(payload.category, 20), text(payload.label, 120), text(payload.target, 500), text(payload.context, 120),
    int(payload.durationMs, 86_400_000), int(payload.scrollPct, 100),
    cf.country ?? null, cf.region ?? null, cf.city ?? null, cf.postalCode ?? null, cf.timezone ?? null,
    cf.latitude ? Number(cf.latitude) : null, cf.longitude ? Number(cf.longitude) : null,
    cf.asn ?? null, cf.asOrganization ?? null, cf.colo ?? null,
    agent.browser, agent.browserVersion, agent.os, agent.device,
    text(payload.language, 20), text(payload.screen, 20), text(payload.viewport, 20),
    metrics.has(payload.metric ?? '') ? payload.metric : null,
    typeof payload.value === 'number' && Number.isFinite(payload.value) ? Math.max(0, Math.min(payload.value, 600_000)) : null,
    ratings.has(payload.rating ?? '') ? payload.rating : null,
  ).run()

  if (Math.random() < 0.02) waitUntil(env.DB.prepare('DELETE FROM events WHERE ts < ?').bind(now - retentionMs).run())

  return new Response(null, { status: 204 })
}
