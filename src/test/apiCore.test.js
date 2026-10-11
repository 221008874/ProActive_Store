// Tests for the small server-side helpers: the bot gate, the cron guard and
// the geocoding cache keys. The routes around them are thin enough to be
// verified by the request flow, and their logic is what makes them correct.

import { describe, it, expect, vi } from 'vitest'
import { captchaConfigured, verifyCaptcha } from '../../api/_core/captcha.js'
import { isCronAuthorized } from '../../api/_core/cronAuth.js'
import { normalizeQuery, normalizeLatLng, cacheKey } from '../../api/_core/geocode.js'

describe('captcha gate', () => {
  it('is open when no secret is configured (local dev, previews)', async () => {
    expect(captchaConfigured('')).toBe(false)
    await expect(verifyCaptcha(null, null, { secret: '' })).resolves.toEqual({ ok: true })
    await expect(verifyCaptcha('token', '1.2.3.4', { secret: undefined })).resolves.toEqual({ ok: true })
  })

  it('refuses a missing token once the secret is set', async () => {
    await expect(verifyCaptcha('  ', null, { secret: 's3cret' })).resolves.toEqual({ ok: false, reason: 'missing' })
  })

  it('accepts a verified token', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }))
    await expect(verifyCaptcha('tok', '9.9.9.9', { secret: 's3cret', fetchImpl })).resolves.toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('refuses a token the provider rejected, naming the reason', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) }))
    const result = await verifyCaptcha('tok', null, { secret: 's3cret', fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('invalid-input-response')
  })

  it('fails open when the verifier itself is unreachable', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNRESET') })
    await expect(verifyCaptcha('tok', null, { secret: 's3cret', fetchImpl })).resolves.toEqual({ ok: true })
  })

  it('sends the token, secret and remote ip to the provider', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }))
    await verifyCaptcha('tok-123', '10.0.0.1', { secret: 'sk', fetchImpl })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('turnstile')
    expect(init.method).toBe('POST')
    expect(init.body).toContain('response=tok-123')
    expect(init.body).toContain('secret=sk')
    expect(init.body).toContain('remoteip=10.0.0.1')
  })
})

describe('cron guard', () => {
  it('is open when no secret is configured', () => {
    expect(isCronAuthorized({ headers: {} }, '')).toBe(true)
  })

  it('requires the exact bearer token once the secret is set', () => {
    const req = { headers: { authorization: 'Bearer good-secret' } }
    expect(isCronAuthorized(req, 'good-secret')).toBe(true)
    expect(isCronAuthorized({ headers: { authorization: 'Bearer wrong' } }, 'good-secret')).toBe(false)
    expect(isCronAuthorized({ headers: {} }, 'good-secret')).toBe(false)
  })
})

describe('geocode helpers', () => {
  it('normalises queries for the cache key', () => {
    expect(normalizeQuery('  Al   DoSa ')).toBe('al dosa')
    expect(normalizeQuery(null)).toBe('')
  })

  it('rounds coordinates to a metre and rejects nonsense', () => {
    expect(normalizeLatLng(30.044421, 31.235742)).toBe('30.04442,31.23574')
    expect(normalizeLatLng('abc', 10)).toBeNull()
    expect(normalizeLatLng(91, 10)).toBeNull()
  })

  it('keys search and reverse caches separately', () => {
    expect(cacheKey('search', 'Cairo')).not.toBe(cacheKey('reverse', 'Cairo'))
    expect(cacheKey('search', 'CAIRO')).toBe(cacheKey('search', '  cairo  '))
  })
})
