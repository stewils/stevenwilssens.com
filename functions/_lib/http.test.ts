// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isJson, json, readCapped } from './http'

const url = 'https://steven.wilssens.com/api/x'
const streamed = (chunks: number, size: number) => new Request(url, {
  method: 'POST',
  body: new ReadableStream({ start(controller) { for (let i = 0; i < chunks; i++) controller.enqueue(new TextEncoder().encode('x'.repeat(size))); controller.close() } }),
  duplex: 'half',
} as RequestInit)

describe('the shared HTTP pieces', () => {
  it('answers JSON that is never cached, with the status given', async () => {
    const response = json({ ok: true }, 201)
    expect(response.status).toBe(201)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(await response.json()).toEqual({ ok: true })
    expect(json(null).status).toBe(200)
  })

  it('knows a JSON body by its media type, whatever the charset or case', () => {
    const typed = (type?: string) => new Request(url, { method: 'POST', headers: type ? { 'Content-Type': type } : {}, body: '{}' })
    expect(isJson(typed('application/json'))).toBe(true)
    expect(isJson(typed('Application/JSON; charset=utf-8'))).toBe(true)
    expect(isJson(typed('text/plain'))).toBe(false)
    expect(isJson(new Request(url))).toBe(false)
  })

  it('reads a body up to the cap, by what is sent and by what Content-Length says', async () => {
    expect(await readCapped(new Request(url, { method: 'POST', body: '{"a":1}' }), 16)).toBe('{"a":1}')
    expect(await readCapped(new Request(url), 16)).toBe('')
    expect(await readCapped(streamed(4, 4), 16)).toBe('x'.repeat(16))
    expect(await readCapped(streamed(5, 4), 16)).toBeNull()
    const claimed = new Request(url, { method: 'POST', headers: { 'Content-Length': '20' }, body: '{}' })
    expect(await readCapped(claimed, 16)).toBeNull()
    expect(claimed.bodyUsed).toBe(false)
  })
})
