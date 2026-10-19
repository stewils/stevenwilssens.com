// The visitor code the analytics use: a one-way hash of the salt, the day, the IP
// address and the browser, so the same browser counts once a day and cannot be
// followed across days (as /privacy says). The assistant's log uses the same code,
// so a person who asked can be found among the day's visitors on /admin.
export const visitorHash = async (salt: string, day: string, ip: string, userAgent: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${day}|${ip}|${userAgent}`))
  return [...new Uint8Array(digest).slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Global Privacy Control or Do Not Track: nothing about the visit is recorded.
export const optedOut = (request: Request) => request.headers.get('Sec-GPC') === '1' || request.headers.get('DNT') === '1'
