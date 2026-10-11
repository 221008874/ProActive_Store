import { describe, it, expect } from 'vitest'
import {
  CHECKOUT_REJECTIONS,
  classifyCheckoutError,
  linesForRejection,
  isFixable
} from '../utils/checkoutErrors'
import { checkoutRejectionMessage } from '../utils/checkoutMessages'

// The API answers with codes; the UI turns them into two things a shopper can
// act on — what to do, and which line to do it to. Both are pinned here so a
// new server code cannot arrive as a raw string on screen.

describe('classifyCheckoutError', () => {
  it('maps every documented server code', () => {
    const codes = [
      'BAD_CART', 'BAD_QTY', 'BAD_CUSTOMER', 'BAD_ADDRESS',
      'OUT_OF_STOCK', 'UNAVAILABLE', 'GOVERNORATE_UNAVAILABLE',
      'COUPON_INVALID', 'BELOW_MIN_ORDER', 'RATE_LIMITED', 'BLOCKED',
      'ORDERS_CLOSED', 'INTERNAL'
    ]
    for (const code of codes) {
      const r = classifyCheckoutError({ code })
      expect(r.code).toBe(code)
      expect(r.key).not.toBe('generic')
    }
  })

  it('falls back to a generic message for an unknown code', () => {
    const r = classifyCheckoutError({ code: 'SOMETHING_NEW' })
    expect(r.key).toBe('generic')
    expect(r.fixable).toBe(false)
    expect(r.step).toBe(0)
  })

  it('accepts a bare string as well as an Error', () => {
    expect(classifyCheckoutError('OUT_OF_STOCK').code).toBe('OUT_OF_STOCK')
    expect(classifyCheckoutError(undefined).key).toBe('generic')
  })

  it('sends the shopper to the step where the problem is fixable', () => {
    // A sold-out line is fixable in the bag, a bad address on the delivery
    // step, and a rate limit nowhere — it is not the shopper's mistake.
    expect(classifyCheckoutError({ code: 'OUT_OF_STOCK' }).step).toBe(1)
    expect(classifyCheckoutError({ code: 'BAD_ADDRESS' }).step).toBe(2)
    expect(classifyCheckoutError({ code: 'RATE_LIMITED' }).step).toBe(0)
  })

  it('carries the server detail through so the exact line can be marked', () => {
    expect(classifyCheckoutError({ code: 'OUT_OF_STOCK', detail: 'dress:red_M' }).detail)
      .toBe('dress:red_M')
  })
})

describe('linesForRejection', () => {
  const cart = [
    { id: 'dress:red_M', productId: 'dress', variantId: 'red_M' },
    { id: 'dress:red_L', productId: 'dress', variantId: 'red_L' },
    { id: 'shirt:black_S', productId: 'shirt', variantId: 'black_S' }
  ]

  it('marks only the named variant, not every size of that product', () => {
    const r = classifyCheckoutError({ code: 'OUT_OF_STOCK', detail: 'dress:red_M' })
    expect(linesForRejection(r, cart)).toEqual(['dress:red_M'])
  })

  it('marks every variant of a product when only the id is named', () => {
    const r = classifyCheckoutError({ code: 'UNAVAILABLE', detail: 'dress' })
    expect(linesForRejection(r, cart)).toEqual(['dress:red_M', 'dress:red_L'])
  })

  it('returns nothing when the server named nothing', () => {
    expect(linesForRejection(classifyCheckoutError({ code: 'RATE_LIMITED' }), cart)).toEqual([])
    expect(linesForRejection({ detail: '' }, cart)).toEqual([])
  })

  it('handles legacy cart lines without an explicit productId', () => {
    const legacy = [{ id: 'dress:red_M' }]
    const r = classifyCheckoutError({ code: 'OUT_OF_STOCK', detail: 'dress:red_M' })
    expect(linesForRejection(r, legacy)).toEqual(['dress:red_M'])
  })
})

describe('isFixable / rejection copy', () => {
  it('treats a shopper mistake as fixable and an anti-abuse block as not', () => {
    expect(isFixable(classifyCheckoutError({ code: 'COUPON_INVALID' }))).toBe(true)
    expect(isFixable(classifyCheckoutError({ code: 'RATE_LIMITED' }))).toBe(false)
    expect(isFixable(classifyCheckoutError({ code: 'BLOCKED' }))).toBe(false)
  })

  it('has copy in both languages for every code, and never the raw code', () => {
    for (const [code, meta] of Object.entries(CHECKOUT_REJECTIONS)) {
      const en = checkoutRejectionMessage(meta.key, 'en')
      const ar = checkoutRejectionMessage(meta.key, 'ar')
      expect(en, code).toBeTruthy()
      expect(ar, code).toBeTruthy()
      expect(en, code).not.toBe(code)
      expect(en, code).not.toBe(meta.key)
      expect(ar).not.toBe(en)
    }
  })

  it('falls back to the generic line for an unknown key', () => {
    expect(checkoutRejectionMessage('not-a-key', 'en')).toBe(checkoutRejectionMessage('generic', 'en'))
    expect(checkoutRejectionMessage('not-a-key', 'ar')).toBe(checkoutRejectionMessage('generic', 'ar'))
  })
})
