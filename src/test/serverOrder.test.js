// Tests for the server-side order path (api/_core/orderCore.js).
//
// These run against a fake Firestore, so they exercise the real transaction
// logic including the guarantee that a thrown error writes nothing.

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  placeOrderTransaction,
  validateRequest,
  discountForCoupon,
  couponRejection,
  computeTotals,
  newOrderNumber,
  normalizeCode,
  normalizeClientOrderId,
  hashPhone,
  hashIp,
  statusForError,
  CheckoutError,
  MAX_LINES,
  MAX_QTY_PER_LINE,
  DUP_WINDOW_MS,
  DEFAULT_RATE_LIMITS
} from '../../server/_core/orderCore.js'
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

  it('keeps every address field the delivery form sends', () => {
    const full = {
      governorateId: 'cairo', governorate: 'القاهرة', street: 'شارع التحرير',
      city: 'الدقي', building: 'عمارة 12', notes: 'الطابق التالت', lat: 30.04, lng: 31.23
    }
    const out = validateRequest({ cart: CART, customer: CUSTOMER, address: full })
    expect(out.address).toEqual(full)
  })

  it('collapses an empty field to null and trims the rest', () => {
    const out = validateRequest({
      cart: CART, customer: CUSTOMER,
      address: { governorateId: ' cairo ', street: '  شارع التحرير  ', city: '', notes: null }
    })
    expect(out.address.governorateId).toBe('cairo')
    expect(out.address.street).toBe('شارع التحرير')
    expect(out.address.city).toBeNull()
    expect(out.address.notes).toBeNull()
  })

  it('drops an unknown address key instead of carrying it into the order', () => {
    const out = validateRequest({
      cart: CART, customer: CUSTOMER, address: { ...ADDRESS, isAdmin: true, secret: 'x' }
    })
    expect(out.address).not.toHaveProperty('isAdmin')
    expect(out.address).not.toHaveProperty('secret')
  })

  it('rejects an address field long enough to threaten the document size', () => {
    // Firestore refuses a document over 1 MiB, so an unbounded free-text field
    // would fail the whole transaction as a 500 after the shopper typed it.
    for (const field of ['street', 'city', 'building', 'notes', 'governorate']) {
      expect(
        () => validateRequest({ cart: CART, customer: CUSTOMER, address: { ...ADDRESS, [field]: 'x'.repeat(5001) } })
      ).toThrow(/BAD_ADDRESS/)
    }
  })

  it('rejects coordinates that are not coordinates', () => {
    expect(() => validateRequest({ cart: CART, customer: CUSTOMER, address: { ...ADDRESS, lat: 130 } })).toThrow(/BAD_ADDRESS/)
    expect(() => validateRequest({ cart: CART, customer: CUSTOMER, address: { ...ADDRESS, lng: -200 } })).toThrow(/BAD_ADDRESS/)
    expect(() => validateRequest({ cart: CART, customer: CUSTOMER, address: { ...ADDRESS, lat: 'abc' } })).toThrow(/BAD_ADDRESS/)
    const out = validateRequest({ cart: CART, customer: CUSTOMER, address: { ...ADDRESS, lat: '30.04' } })
    expect(out.address.lat).toBe(30.04)
  })

  it('rejects a missing governorate or an address that is not an object', () => {
    expect(() => validateRequest({ cart: CART, customer: CUSTOMER, address: {} })).toThrow(/BAD_ADDRESS/)
    expect(() => validateRequest({ cart: CART, customer: CUSTOMER, address: 'Cairo' })).toThrow(/BAD_ADDRESS/)
  })

  it('maps an address rejection to 409, not 500', () => {
    expect(statusForError(new CheckoutError('BAD_ADDRESS'))).toBe(409)
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

  /* --- the price is the server's to defend -------------------------------- */

  // A product document with no usable price. Each of these used to be charged
  // at 0, or produce NaN - which is falsey against every downstream comparison,
  // so a NaN price also meant a variant with no stock field passed the stock
  // gate and a NaN subtotal passed the minimum-order gate.
  for (const [label, price, stock] of [
    ['missing price', undefined, 5],
    ['zero price', 0, 5],
    ['negative price', -100, 5],
    ['non-numeric price', 'abc', 5],
    ['infinite price', Infinity, 5]
  ]) {
    it(`refuses a product with a ${label}`, async () => {
      const product = { title: { en: 'Broken' }, status: 'active' }
      if (price !== undefined) product.price = price
      db.__seed('products_egp/broken', product)
      db.__seed('products_egp/broken/variants/red_M', { colorId: 'red', size: 'M', active: true, stock })

      await expect(
        place({
          cart: [{ productId: 'broken', variantId: 'red_M', qty: 1 }],
          customer: CUSTOMER,
          address: ADDRESS
        })
      ).rejects.toThrow(/BAD_PRICE/)
    })
  }

  it('maps a bad price to 409, not 500', () => {
    expect(statusForError(new CheckoutError('BAD_PRICE', 'p1:red_M'))).toBe(409)
  })

  it('refuses a variant whose priceOverride is not a usable price', async () => {
    db.__seed('products_egp/override0', { title: { en: 'Override broken' }, status: 'active', price: 500 })
    db.__seed('products_egp/override0/variants/red_M', { colorId: 'red', size: 'M', active: true, stock: 5, priceOverride: 0 })

    await expect(
      place({
        cart: [{ productId: 'override0', variantId: 'red_M', qty: 1 }],
        customer: CUSTOMER,
        address: ADDRESS
      })
    ).rejects.toThrow(/BAD_PRICE/)
  })

  it('refuses a variant with a missing stock field rather than selling it', async () => {
    // Number(undefined) is NaN and NaN < qty is false, so the missing field used
    // to read as "plenty".
    db.__seed('products_egp/nostock', { title: { en: 'No stock' }, status: 'active', price: 500 })
    db.__seed('products_egp/nostock/variants/red_M', { colorId: 'red', size: 'M', active: true })

    await expect(
      place({
        cart: [{ productId: 'nostock', variantId: 'red_M', qty: 1 }],
        customer: CUSTOMER,
        address: ADDRESS
      })
    ).rejects.toThrow(/OUT_OF_STOCK/)
  })

  /* --- concurrency --------------------------------------------------------- */

  // What is provable at each layer, stated plainly:
  //
  //   orderCore     - every read happens before every write in the transaction,
  //                   and the decrement is FieldValue.increment, so no lost
  //                   update. THIS is what the code is responsible for.
  //   Firestore SDK - aborts the losing transaction with ABORTED and retries it
  //                   (DEFAULT_MAX_TRANSACTION_ATTEMPTS = 5); on the retry the
  //                   loser re-reads the depleted stock and throws OUT_OF_STOCK.
  //                   This is the property that prevents overselling.
  //   this fake     - stages writes and applies them in completion order, with
  //                   no contention detection. It therefore CANNOT prove the
  //                   SDK's guarantee: two overlapping transactions here simply
  //                   both commit (and drive stock negative), which is not what
  //                   the real Firestore would do. Asserting an outcome here
  //                   would be testing the fake, not the product.
  //
  // The SDK property is verified against the real emulator by
  // scripts/test-rules.mjs (rules) and scripts/verify-publish-path.mjs
  // (publish path), and in production by the deployment's own behaviour.
  it('reads stock before writing it, so the check and the decrement agree', () => {
    // The real Firestore SDK rejects a read that follows a write in the same
    // transaction, so this ordering is the contract the stock guarantee rests
    // on: if it regresses, the SDK itself would start failing every order.
    const source = readFileSync(new URL('../../server/_core/orderCore.js', import.meta.url), 'utf8')
    const txn = source.match(/return db\.runTransaction\(async \(tx\) => \{([\s\S]*?)\n {2}\}\)/)?.[1] ?? ''

    const firstWrite = txn.search(/tx\.(update|set|delete)\(/)
    const lastRead = txn.lastIndexOf('tx.get(')

    expect(firstWrite, 'no write found in the transaction').toBeGreaterThan(-1)
    expect(lastRead, 'no read found in the transaction').toBeGreaterThan(-1)
    expect(lastRead).toBeLessThan(firstWrite)
  })

  it('decrements with an increment, so two writers cannot lose an update', () => {
    const source = readFileSync(new URL('../../server/_core/orderCore.js', import.meta.url), 'utf8')
    const decrement = source.match(/tx\.update\(line\.variantRef, \{[\s\S]{0,120}?\}\)/)?.[0] ?? ''
    expect(decrement).toContain('increment(-line.qty)')
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

// ---------------------------------------------------------------------------
// Abuse controls: idempotency, rate limits, duplicates, blocklist.
// ---------------------------------------------------------------------------

const NOW = 1_800_000_000_000;
const placeAt = (body, context = {}) => placeOrderTransaction(db, body, { now: NOW, context })
const snapshot = () => JSON.stringify(db.__store)

describe('orderCore - idempotency (clientOrderId)', () => {
  it('replays the original order when the same client id is retried', async () => {
    const first = await placeAt({
      cart: CART,
      customer: CUSTOMER,
      address: ADDRESS,
      clientOrderId: 'browser-uuid-1'
    })
    const before = snapshot()

    const second = await placeAt({
      cart: CART,
      customer: CUSTOMER,
      address: ADDRESS,
      clientOrderId: 'browser-uuid-1'
    })

    expect(second.orderId).toBe(first.orderId)
    expect(second.orderNumber).toBe(first.orderNumber)
    expect(db.__read('products_egp/dress/variants/red_M').stock).toBe(3)
    // Nothing but the (identical) replay happened on the second attempt.
    expect(db.__read('egp_coupons/SAVE10').usedCount ?? 0).toBe(0)
    expect(snapshot()).toBe(before)
  })

  it('places a new order for a different client id', async () => {
    const a = await placeAt({ cart: [{ productId: 'dress', variantId: 'red_M', qty: 1 }], customer: CUSTOMER, address: ADDRESS, clientOrderId: 'id-a' })
    const b = await placeAt({ cart: [{ productId: 'dress', variantId: 'red_M', qty: 1 }], customer: { name: 'A', phone: '01112345678' }, address: ADDRESS, clientOrderId: 'id-b' })
    expect(b.orderId).not.toBe(a.orderId)
    expect(db.__read('products_egp/dress/variants/red_M').stock).toBe(3)
  })

  it('ignores a malformed client id instead of trusting it', async () => {
    const result = await placeAt({
      cart: CART,
      customer: CUSTOMER,
      address: ADDRESS,
      clientOrderId: 'not/../a/valid/id'
    })
    expect(result.orderId).toBeTruthy()
    expect(db.__exists('client_orders/not/../a/valid/id')).toBe(false)
  })

  it('normalizes client ids: accepts safe characters, rejects the rest', () => {
    expect(normalizeClientOrderId('aB3-_xY')).toBe('aB3-_xY')
    expect(normalizeClientOrderId('x'.repeat(100))).toHaveLength(64)
    expect(normalizeClientOrderId('bad id')).toBeNull()
    expect(normalizeClientOrderId('')).toBeNull()
    expect(normalizeClientOrderId(undefined)).toBeNull()
  })
})

describe('orderCore - duplicate detection', () => {
  it('replays the order when the same phone buys the same items minutes later', async () => {
    const first = await placeAt({
      cart: [{ productId: 'dress', variantId: 'red_M', qty: 2 }],
      customer: CUSTOMER,
      address: ADDRESS
    })
    const second = await placeAt({
      cart: [{ productId: 'dress', variantId: 'red_M', qty: 2 }],
      customer: CUSTOMER,
      address: ADDRESS
    })
    expect(second.orderId).toBe(first.orderId)
    expect(db.__read('products_egp/dress/variants/red_M').stock).toBe(3)
  })

  it('treats a different cart as a genuinely new order', async () => {
    const first = await placeAt({ cart: [{ productId: 'dress', variantId: 'red_M', qty: 1 }], customer: CUSTOMER, address: ADDRESS })
    const second = await placeAt({ cart: [{ productId: 'dress', variantId: 'red_L', qty: 1 }], customer: CUSTOMER, address: ADDRESS })
    expect(second.orderId).not.toBe(first.orderId)
  })

  it('treats the same items from a different phone as a new order', async () => {
    const first = await placeAt({ cart: CART, customer: CUSTOMER, address: ADDRESS })
    const second = await placeAt({ cart: CART, customer: { name: 'Other', phone: '01512345678' }, address: ADDRESS })
    expect(second.orderId).not.toBe(first.orderId)
  })

  it('does not replay once the duplicate window has passed', async () => {
    const first = await placeOrderTransaction(db, { cart: CART, customer: CUSTOMER, address: ADDRESS }, { now: NOW })
    const second = await placeOrderTransaction(db, { cart: CART, customer: CUSTOMER, address: ADDRESS }, { now: NOW + DUP_WINDOW_MS + 1000 })
    expect(second.orderId).not.toBe(first.orderId)
  })
})

describe('orderCore - rate limits', () => {
  it('stops a phone after the daily limit, then admits a different phone', async () => {
    for (const variantId of ['red_M', 'red_L', 'black_M']) {
      db.__seed(`products_egp/dress/variants/${variantId}`, {
        colorId: 'black', color: 'Black', size: 'M', stock: 5, active: true
      })
    }

    const order = (n) =>
      placeAt({ cart: [{ productId: 'dress', variantId: `v${n}_M`, qty: 1 }], customer: CUSTOMER, address: ADDRESS })
    db.__seed('products_egp/dress/variants/v1_M', { colorId: 'a', color: 'A', size: 'M', stock: 5, active: true })
    db.__seed('products_egp/dress/variants/v2_M', { colorId: 'b', color: 'B', size: 'M', stock: 5, active: true })
    db.__seed('products_egp/dress/variants/v3_M', { colorId: 'c', color: 'C', size: 'M', stock: 5, active: true })
    db.__seed('products_egp/dress/variants/v4_M', { colorId: 'd', color: 'D', size: 'M', stock: 5, active: true })

    await order(1)
    await order(2)
    await order(3)
    await expect(order(4)).rejects.toThrow(/RATE_LIMITED/)

    await placeAt({ cart: [{ productId: 'dress', variantId: 'v4_M', qty: 1 }], customer: { name: 'New', phone: '01212345678' }, address: ADDRESS })
  })

  it('respects limits raised in egp_settings/general', async () => {
    db.__seed('egp_settings/general', { freeShippingThreshold: 800, rateLimits: { perPhoneDay: 1 } })
    await placeAt({ cart: [{ productId: 'dress', variantId: 'red_L', qty: 1 }], customer: CUSTOMER, address: ADDRESS })
    await expect(placeAt({ cart: [{ productId: 'override', variantId: 'red_M', qty: 1 }], customer: { name: 'X', phone: '01066666666' }, address: ADDRESS })).resolves.toBeTruthy()
    await expect(placeAt({ cart: [{ productId: 'dress', variantId: 'red_M', qty: 1 }], customer: { name: 'Y', phone: '01077777777' }, address: ADDRESS })).resolves.toBeTruthy()
    // The first phone already used its single allowance. The rate check runs
    // after the stock reads, so the line must otherwise be orderable.
    await expect(placeAt({ cart: [{ productId: 'dress', variantId: 'red_M', qty: 4 }], customer: CUSTOMER, address: ADDRESS })).rejects.toThrow(/RATE_LIMITED/)
  })

  it('limits the orders per IP across different phones', async () => {
    db.__seed('egp_settings/general', { freeShippingThreshold: 800, rateLimits: { perPhoneDay: 50, perIpHour: 2, perIpDay: 50 } })
    const context = { ip: '41.32.11.9' }

    const from = (n) =>
      placeAt({ cart: [{ productId: 'dress', variantId: `ip${n}_M`, qty: 1 }], customer: { name: `P${n}`, phone: `0101234567${n}`.slice(0, 11) }, address: ADDRESS }, context)
    for (const n of [1, 2, 3, 4]) {
      db.__seed(`products_egp/dress/variants/ip${n}_M`, { colorId: `c${n}`, color: `C${n}`, size: 'M', stock: 5, active: true })
    }

    await from(1)
    await from(2)
    await expect(from(3)).rejects.toThrow(/RATE_LIMITED/)
  })

  it('does not let a rate-limited attempt write anything', async () => {
    db.__seed('egp_settings/general', { freeShippingThreshold: 800, rateLimits: { perPhoneDay: 1 } })
    await placeAt({ cart: CART, customer: CUSTOMER, address: ADDRESS })
    const before = snapshot()
    await expect(placeAt({ cart: [{ productId: 'dress', variantId: 'red_M', qty: 3 }], customer: CUSTOMER, address: ADDRESS })).rejects.toThrow(/RATE_LIMITED/)
    expect(snapshot()).toBe(before)
  })
})

describe('orderCore - blocklist and kill switch', () => {
  it('refuses a phone on the blocklist', async () => {
    db.__seed(`blocklist/${hashPhone(CUSTOMER.phone)}`, { reason: 'refused 3 orders', addedBy: 'admin', active: true })
    const before = snapshot()
    await expect(placeAt({ cart: CART, customer: CUSTOMER, address: ADDRESS })).rejects.toThrow(/BLOCKED/)
    expect(snapshot()).toBe(before)
  })

  it('refuses an IP on the blocklist', async () => {
    db.__seed(`blocklist/ip_${hashIp('9.9.9.9')}`, { reason: 'fraud ring', active: true })
    await expect(placeAt({ cart: CART, customer: { name: 'Z', phone: '01099999999' }, address: ADDRESS }, { ip: '9.9.9.9' })).rejects.toThrow(/BLOCKED/)
  })

  it('allows a blocklist entry that was deactivated', async () => {
    db.__seed(`blocklist/${hashPhone(CUSTOMER.phone)}`, { reason: 'appealed', active: false })
    await expect(placeAt({ cart: CART, customer: CUSTOMER, address: ADDRESS })).resolves.toBeTruthy()
  })

  it('refuses every order while ordersOpen is false (the runbook kill switch)', async () => {
    db.__seed('egp_settings/general', { freeShippingThreshold: 800, ordersOpen: false })
    const before = snapshot()
    await expect(placeAt({ cart: CART, customer: CUSTOMER, address: ADDRESS })).rejects.toThrow(/ORDERS_CLOSED/)
    expect(snapshot()).toBe(before)
  })
})

describe('orderCore - risk flags and side effects', () => {
  it('flags high-value, many-line and first-time orders', async () => {
    db.__seed('egp_settings/general', { freeShippingThreshold: 800, highValueThreshold: 100 })
    const result = await placeAt({
      cart: [
        { productId: 'dress', variantId: 'red_M', qty: 1 },
        { productId: 'dress', variantId: 'red_L', qty: 1 },
        { productId: 'override', variantId: 'red_M', qty: 1 }
      ],
      customer: CUSTOMER,
      address: ADDRESS
    })
    expect(result.risk.flags).toContain('high_value')
    expect(result.risk.flags).toContain('first_time')
    expect(db.__read(`orders_egp/${result.orderId}`).risk.score).toBeGreaterThan(0)
  })

  it('does not flag a small repeat order as first-time', async () => {
    await placeAt({ cart: [{ productId: 'dress', variantId: 'red_M', qty: 1 }], customer: CUSTOMER, address: ADDRESS })
    const second = await placeAt({ cart: [{ productId: 'override', variantId: 'red_M', qty: 1 }], customer: CUSTOMER, address: ADDRESS })
    expect(second.risk.flags).not.toContain('first_time')
  })

  it('marks the catalog dirty and queues a new-order notification', async () => {
    const result = await placeAt({ cart: CART, customer: CUSTOMER, address: ADDRESS })

    expect(db.__read('egp_settings/catalog').dirty).toBe(true)

    const outbox = db.__store.outbox ?? {}
    const entries = Object.entries(outbox).map(([id, doc]) => ({ id, ...doc }))
    expect(entries).toHaveLength(1)
    expect(entries[0].type).toBe('new_order')
    expect(entries[0].status).toBe('pending')
    expect(entries[0].payload).toMatchObject({
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      total: result.total
    })
  })

  it('stores hashes, not raw IP or user agent, on the order', async () => {
    const result = await placeAt(
      { cart: CART, customer: CUSTOMER, address: ADDRESS },
      { ip: '156.199.4.5', userAgent: 'Mozilla/5.0 (test)' }
    )
    const order = db.__read(`orders_egp/${result.orderId}`)
    expect(order.ipHash).toBe(hashIp('156.199.4.5'))
    expect(order.userAgentHash).toHaveLength(64)
    expect(JSON.stringify(order)).not.toContain('156.199.4.5')
    expect(order.phoneHash).toBe(hashPhone(CUSTOMER.phone))
  })

  it('keeps settings that do not exist from breaking the limits', async () => {
    db.__store.egp_settings = {}
    await expect(placeAt({ cart: CART, customer: CUSTOMER, address: ADDRESS })).resolves.toBeTruthy()
    expect(DEFAULT_RATE_LIMITS.perPhoneDay).toBe(3)
  })
})

describe('orderCore - helpers', () => {  it('generates order numbers in one format', () => {
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