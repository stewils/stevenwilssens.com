// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { optedOut, visitorHash } from './visitor'

describe('the visitor code', () => {
  it('is the same code the Traffic data has always used, so a change to it fails here', async () => {
    // sha256('salt|2026-10-19|203.0.113.9|Firefox'), first 8 bytes in hex.
    expect(await visitorHash('salt', '2026-10-19', '203.0.113.9', 'Firefox')).toBe('e10b1cff30509014')
    expect(await visitorHash('salt', '2026-10-20', '203.0.113.9', 'Firefox')).not.toBe('e10b1cff30509014')
  })

  it('reads Global Privacy Control and Do Not Track', () => {
    const request = (headers: Record<string, string>) => new Request('https://steven.wilssens.com/', { headers })
    expect(optedOut(request({ 'Sec-GPC': '1' }))).toBe(true)
    expect(optedOut(request({ DNT: '1' }))).toBe(true)
    expect(optedOut(request({ DNT: '0' }))).toBe(false)
    expect(optedOut(request({}))).toBe(false)
  })
})
