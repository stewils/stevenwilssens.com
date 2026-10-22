// Small pieces the admin and ingest routes share: a JSON answer that is never cached and
// carries no CORS header, and a request body read with a cap on the bytes actually read.

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

// True when the request says it carries JSON (any charset).
export const isJson = (request: Request) => (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase() === 'application/json'

// The body, but never more than `max` bytes of it: null when it is longer, whatever
// Content-Length says (or when it says more than `max`, before anything is read).
export const readCapped = async (request: Request, max: number) => {
  if (Number(request.headers.get('Content-Length') ?? 0) > max) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) { await reader.cancel(); return null }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(bytes)
}
