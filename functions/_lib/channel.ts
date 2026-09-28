// Groups a visit into a traffic channel. A ?ref= or utm_source tag wins,
// because PDFs, email apps, and the LinkedIn app usually send no referrer.

export type Channel = 'Resume' | 'LinkedIn' | 'Email' | 'Search' | 'Referral' | 'Tagged' | 'Direct'

const taggedChannels: [RegExp, Channel][] = [
  [/^(resume|cv)$/, 'Resume'],
  [/^(linkedin|li)$/, 'LinkedIn'],
  [/^(email|mail|signature|gmail|outlook|newsletter)$/, 'Email'],
]

const referrerChannels: [RegExp, Channel][] = [
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'],
  [/^(mail\.google\.com|outlook\.(live|office|office365)\.com|mail\.yahoo\.com|mail\.proton\.me)$/, 'Email'],
  [/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex)\.[a-z.]+$|^search\.brave\.com$/, 'Search'],
]

export const classifyChannel = (utmSource: string | null, utmMedium: string | null, referrerHost: string | null): Channel => {
  const source = utmSource?.trim().toLowerCase()
  if (source) return taggedChannels.find(([pattern]) => pattern.test(source))?.[1] ?? 'Tagged'
  if (utmMedium?.trim().toLowerCase() === 'email') return 'Email'
  if (referrerHost) return referrerChannels.find(([pattern]) => pattern.test(referrerHost))?.[1] ?? 'Referral'
  return 'Direct'
}
