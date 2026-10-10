// Tests for the server-side order path (api/_core/orderCore.js).
//
// These run against a fake Firestore, so they exercise the real transaction
// logic including the guarantee that a thrown error writes nothing.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  placeOrderTransaction,
  validateRequest,
  discountForCoupon,
  couponRejection,
  computeTotals,
  newOrderNumber,
  normalizeCode,
  statusForError,
  CheckoutError,
  MAX_LINES,
  MAX_QTY_PER_LINE
} from '../../api/_core/orderCore.js'
import { createFakeFirestore, seedFixture } from './fakeFirestore'

let db

const CUSTOMER = { name: 'Jane Doe', phone: '01012345678', email: 'jane@example.com' }
const ADDRESS = { governorateId: 'cairo', governorate: 'Cairo', lat: 30.04, lng: 31.23 }
const CART = [{ productId: 'dress', variantId: 'red_M', qty: 2 }]

beforeEach(() => {
  db = createFakeFirestore(seedFixture())
})

const place = (body, opts) => placeOrderTransaction(db, body, opts)

describe('orderCore - request validation', () => {
  it('accepts a well-formed request', () => {
    const out = validateRequest({ cart: CART, customer: CUSTOMER, address: ADDRESS })
    expect(out.cart).toHaveLength(1)
    expect(out.customer.name).toBe('Jane Doe')
  })

  it('normalises the phone, stripping spaces and punctuation', () => {
    const out = validateRequest({
      cart: CART,
      customer: { name: 'Jane', phone: '010 123 456 78' },
      address: ADDRESS
    })
    expect(out.customer.phone).toBe('01012345678')
  })

  it('rejects an Egyptian mobile that is not 010/011/012/015 + 8 digits', () => {
    for (const phone of ['12345', 'abcdefghijk', '0101234', '01912345678']) {
      expect(() => validateRequest({ cart: CART, customer: { name: 'A', phone }, address: ADDRESS })).toThrow(/BAD_CUSTOMER/)
    }
  })

  it('rejects a missing name, cart or governorate', () => {
    expect(() => validateRequest({ cart: [], customer: CUSTOMER, address: ADDRESS })).toThrow(/BAD_CART/)
    expect(() => validateRequest({ cart: CART, customer: { phone: '01012345678' }, address: ADDRESS })).toThrow(/BAD_CUSTOMER/)
    expect(() => validateRequest({ cart: CART, customer: CUSTOMER, address: {} })).toThrow(/BAD_ADDRESS/)
  })

  it('rejects an out-of-range quantity', () => {
    expect(() => validateRequest({ cart: [{ ...CART[0], qty: 0 }], customer: CUSTOMER, address: ADDRESS })).toThrow(/BAD_QTY/)
    expect(() => validateRequest({ cart: [{ ...CART[0], qty: MAX_QTY_PER_LINE + 1 }], customer: CUSTOMER, address: ADDRESS })).toThrow(/BAD_QTY/)
  })

  it('rejects a cart with too many lines', () => {
    const many = Array.from({ length: MAX_LINES + 1 }, (_, i) => ({ productId: 'dress', variantId: `red_M`, qty: 1, i }))
    expect(() => validateRequest({ cart: many, customer: CUSTOMER, address: ADDRESS })).toThrow(/BAD_CART/)
  })

  it('truncates an over-long name', () => {
    const out = validateRequest({ cart: CART, customer: { name: 'x'.repeat(200), phone: '01012345678' }, address: ADDRESS })
    expect(out.customer.name.length).toBe(80)
  })

  it('rejects a malformed email but allows none', () => {
    expect(() => validateRequest({ cart: CART, customer: { ...CUSTOMER, email: 'nope' }, address: ADDRESS })).toThrow(/BAD_CUSTOMER/)
    expect(validateRequest({ cart: CART, customer: { ...CUSTOMER, email: null }, address: ADDRESS }).customer.email).toBeNull()
  })
})

describe('orderCore - coupon maths', () => {
  it('treats a coupon with no type as a flat amount', () => {
    expect(discountForCoupon({ value: 30 }, 500)).toBe(30)
  })

  it('applies a percentage only when explicitly typed', () => {
    expect(discountForCoupon({ type: 'percent', value: 50 }, 500)).toBe(250)
  })

  it('accepts the absence of a coupon', () => {
    expect(couponRejection(null, 100)).toBeNull()
    expect(discountForCoupon(null, 100)).toBe(0)
  })

  it('rejects inactive, exhausted and over-minimum coupons', () => {
    expect(couponRejection({ active: false }, 100)).toBe(true)
    expect(couponRejection({ active: true, usedCount: 5, maxUses: 5 }, 100)).toBe(true)
    expect(couponRejection({ active: true, minOrder: 500 }, 100)).toBe(true)
  })

  it('rejects an expired coupon', () => {
    expect(couponRejection({ active: true, expiresAt: Date.now() - 1000 }, 100)).toBe(true)
  })
})

describe('orderCore - totals', () => {
  const lines = [{ unitPrice: 450, qty: 2 }]

  it('charges shipping below the free threshold', () => {
    const t = computeTotals({
      lines: [{ unitPrice: 450, qty: 1 }],
      governorate: { cost: 60 },
      settings: { freeShippingThreshold: 800 }
    })
    expect(t.subtotal).toBe(450)
    expect(t.shippingCost).toBe(60)
    expect(t.total).toBe(510)
  })

  it('waives shipping at the threshold', () => {
    const t = computeTotals({ lines: [{ unitPrice: 400, qty: 2 }], governorate: { cost: 60 }, settings: {} })
    expect(t.shippingCost).toBe(0)
    expect(t.total).toBe(800)
  })

  it('judges free shipping on the DISCOUNTED subtotal', () => {
    // 900 - 100 = 800 -> free, even though the raw subtotal was above it
    const free = computeTotals({
      lines,
      coupon: { active: true, value: 100 },
      governorate: { cost: 60 },
      settings: { freeShippingThreshold: 800 }
    })
    expect(free.shippingCost).toBe(0)
    expect(free.total).toBe(800)

    // 900 - 160 = 740 -> still charged, because the discount pushed it under
    const charged = computeTotals({
      lines,
      coupon: { active: true, value: 160 },
      governorate: { cost: 60 },
      settings: { freeShippingThreshold: 800 }
    })
    expect(charged.shippingCost).toBe(60)
    expect(charged.total).toBe(800)
  })

  it('throws below the governorate minimum', () => {
    expect(() => computeTotals({ lines, governorate: { cost: 60, minOrder: 5000 } })).toThrow(/BELOW_MIN_ORDER/)
  })
})

describe('orderCore - placing an order', () => {
  it('creates the order with a PA- number and pending status', async () => {
    const result = await place({ cart: CART, customer: CUSTOMER, address: ADDRESS })
    expect(result.orderNumber).toMatch(/^PA-[A-Z2-9]{6}$/)
    expect(result.status).toBeUndefined()

    const order = db.__read(`orders_egp/${result.orderId}`)
    expect(order.status).toBe('pending')
    expect(order.adminConfirmed).toBe(false)
    expect(order.paymentMethod).toBe('cod')
  })

  it('uses the database price, ignoring anything the client sent', async () => {
    const result = await place({
      cart: [{ productId: 'dress', variantId: 'red_M', qty: 1, unitPrice: 1, total: 1 }],
      customer: CUSTOMER,
      address: ADDRESS
    })
    expect(result.subtotal).toBe(450)
    expect(result.total).toBe(510)
  })

  it('honours a variant priceOverride', async () => {
    const result = await place({
      cart: [{ productId: 'override', variantId: 'red_M', qty: 1 }],
      customer: CUSTOMER,
      address: ADDRESS
    })
    expect(result.subtotal).toBe(399)
  })

  it('decrements variant and product stock', async () => {
    await place({ cart: CART, customer: CUSTOMER, address: ADDRESS })
    expect(db.__read('products_egp/dress/variants/red_M').stock).toBe(3)
    expect(db.__read('products_egp/dress').totalStock).toBe(8)
    expect(db.__read('products_egp/dress').soldCount).toBe(2)
  })

  it('decrements stock per variant when one product has two lines', async () => {
    const result = await place({
      cart: [
        { productId: 'dress', variantId: 'red_M', qty: 1 },
        { productId: 'dress', variantId: 'red_L', qty: 1 }
      ],
      customer: CUSTOMER,
      address: ADDRESS
    })
    expect(db.__read('products_egp/dress/variants/red_M').stock).toBe(4)
    expect(db.__read('products_egp/dress/variants/red_L').stock).toBe(0)
    expect(db.__read(`orders_egp/${result.orderId}`).items).toHaveLength(2)
  })

  it('snapshots title, price and image onto the order items', async () => {
    const result = await place({ cart: CART, customer: CUSTOMER, address: ADDRESS })
    const order = db.__read(`orders_egp/${result.orderId}`)
    expect(order.items[0]).toMatchObject({
      productId: 'dress',
      variantId: 'red_M',
      unitPrice: 450,
      qty: 2,
      lineTotal: 900,
      color: 'Red',
      size: 'M',
      image: 'https://img/dress.jpg'
    })
    expect(order.items[0].title).toEqual({ ar: 'فستان', en: 'Dress' })
  })

it('applies a fixed coupon and counts the use', async () => {
    const result = await place({ cart: CART, customer: CUSTOMER, address: ADDRESS, couponCode: 'SAVE10' })
    expect(result.subtotal).toBe(900)
    expect(result.discount).toBe(10)
    // 900 - 10 = 890, still above the 800 threshold, so shipping is waived
    expect(result.shippingCost).toBe(0)
    expect(result.total).toBe(890)
    expect(db.__read('egp_coupons/SAVE10').usedCount).toBe(1)
  })

it('applies a percent coupon', async () => {
    const result = await place({ cart: CART, customer: CUSTOMER, address: ADDRESS, couponCode: 'HALF' })
    expect(result.discount).toBe(450)
    // 900 - 450 = 450, below the threshold, so shipping is charged
    expect(result.shippingCost).toBe(60)
    expect(result.total).toBe(510)
  })

it('charges shipping when a discount pushes the order below the threshold', async () => {
    // 450 item, 10 off -> 440, still under 800
    const result = await place({
      cart: [{ productId: 'dress', variantId: 'red_M', qty: 1 }],
      customer: CUSTOMER,
      address: ADDRESS,
      couponCode: 'SAVE10'
    })
    expect(result.total).toBe(500)
  })

  it('accepts a coupon code in any case', async () => {
    const result = await place({ cart: CART, customer: CUSTOMER, address: ADDRESS, couponCode: ' save10 ' })
    expect(result.discount).toBe(10)
  })

  it('records the coupon used on the order', async () => {
    const result = await place({ cart: CART, customer: CUSTOMER, address: ADDRESS, couponCode: 'SAVE10' })
    const order = db.__read(`orders_egp/${result.orderId}`)
    expect(order.coupon).toEqual({ code: 'SAVE10', type: 'fixed', value: 10 })
  })

  it('records a null coupon when none was used', async () => {
    const result = await place({ cart: CART, customer: CUSTOMER, address: ADDRESS })
    expect(db.__read(`orders_egp/${result.orderId}`).coupon).toBeNull()
  })
})

describe('orderCore - rejections leave nothing behind', () => {
  const snapshot = () => JSON.stringify(db.__store)

  it('rejects an out-of-stock variant and writes nothing', async () => {
    const before = snapshot()
    await expect(
      place({ cart: [{ productId: 'dress', variantId: 'black_M', qty: 1 }], customer: CUSTOMER, address: ADDRESS })
    ).rejects.toThrow(/OUT_OF_STOCK/)
    expect(snapshot()).toBe(before)
  })

  it('rejects ordering more than the remaining stock', async () => {
    const before = snapshot()
    await expect(
      place({ cart: [{ productId: 'dress', variantId: 'red_L', qty: 2 }], customer: CUSTOMER, address: ADDRESS })
    ).rejects.toThrow(/OUT_OF_STOCK/)
    expect(snapshot()).toBe(before)
  })

  it('rejects an archived product', async () => {
    await expect(
      place({ cart: [{ productId: 'archived', variantId: 'red_M', qty: 1 }], customer: CUSTOMER, address: ADDRESS })
    ).rejects.toThrow(/UNAVAILABLE/)
  })

  it('rejects an unknown variant', async () => {
    await expect(
      place({ cart: [{ productId: 'dress', variantId: 'green_XL', qty: 1 }], customer: CUSTOMER, address: ADDRESS })
    ).rejects.toThrow(/UNAVAILABLE/)
  })

  it('rejects an inactive coupon, an exhausted one and an unknown one', async () => {
    for (const code of ['DEAD', 'ONEUSE', 'BIGMIN', 'NOSUCH']) {
      await expect(
        place({ cart: CART, customer: CUSTOMER, address: ADDRESS, couponCode: code })
      ).rejects.toThrow(/COUPON_INVALID/)
    }
  })

  it('does not spend coupon usage when the order is rejected', async () => {
    await expect(
      place({ cart: [{ productId: 'dress', variantId: 'black_M', qty: 1 }], customer: CUSTOMER, address: ADDRESS, couponCode: 'SAVE10' })
    ).rejects.toThrow()
    expect(db.__read('egp_coupons/SAVE10').usedCount).toBe(0)
  })

  it('rejects an inactive governorate', async () => {
    db.__seed('egp_governorate_costs/cairo', { cost: 60, active: false })
    await expect(place({ cart: CART, customer: CUSTOMER, address: ADDRESS })).rejects.toThrow(/GOVERNORATE_UNAVAILABLE/)
  })

  it('rejects an unknown governorate', async () => {
    await expect(
      place({ cart: CART, customer: CUSTOMER, address: { governorateId: 'atlantis' } })
    ).rejects.toThrow(/GOVERNORATE_UNAVAILABLE/)
  })

  it('rejects an order below the governorate minimum, writing nothing', async () => {
    db.__seed('egp_governorate_costs/cairo', { cost: 60, minOrder: 5000, active: true })
    const before = snapshot()
    await expect(place({ cart: CART, customer: CUSTOMER, address: ADDRESS })).rejects.toThrow(/BELOW_MIN_ORDER/)
    expect(snapshot()).toBe(before)
  })
})

describe('orderCore - helpers', () => {
  it('generates order numbers in one format', () => {
    expect(newOrderNumber()).toMatch(/^PA-[A-Z2-9]{6}$/)
  })

  it('normalises coupon codes, treating blank as absent', () => {
    expect(normalizeCode(' save10 ')).toBe('SAVE10')
    expect(normalizeCode('')).toBeNull()
    expect(normalizeCode(undefined)).toBeNull()
  })

  it('maps known problems to 409 and unknown ones to 500', () => {
    expect(statusForError(new CheckoutError('OUT_OF_STOCK'))).toBe(409)
    expect(statusForError(new Error('BAD_CUSTOMER'))).toBe(409)
    expect(statusForError(new Error('kaboom'))).toBe(500)
  })

  it('exposes a stable code on CheckoutError', () => {
    const e = new CheckoutError('OUT_OF_STOCK', 'dress:red_M')
    expect(e.code).toBe('OUT_OF_STOCK')
    expect(e.message).toBe('OUT_OF_STOCK:dress:red_M')
  })
})