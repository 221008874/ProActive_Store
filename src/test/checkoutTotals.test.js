import { describe, it, expect } from 'vitest'
import { checkoutTotals } from '../utils/pricing'
import { computeTotals } from '../../server/_core/orderCore.js'

// The money a shopper reads and the money an order is created with must be the
// same number.
//
// The server owns the truth (server/_core/orderCore.js computeTotals): coupon
// off the subtotal, then free shipping decided on what is LEFT. The bag, the
// summary card and the review step each used to compute `subtotal + shipping`
// independently, which ignored the coupon they were printing a discount for and
// charged delivery the server would not charge. So the customer was quoted one
// amount and billed another.
//
// This compares the two implementations over a matrix of real bag shapes
// instead of restating the rule twice: if either side changes, this fails.

/** Server-side inputs built to produce a known subtotal. */
const serverTotals = ({ subtotal, coupon, shippingCost, threshold }) => {
  const lines = [{ unitPrice: subtotal, qty: 1 }]
  const { total } = computeTotals({
    lines,
    coupon,
    governorate: { cost: shippingCost, minOrder: 0 },
    settings: { freeShippingThreshold: threshold }
  })
  return total
}

describe('the client total equals the server total', () => {
  const cases = [
    { name: 'no coupon, shipping charged', subtotal: 500, coupon: null, shippingCost: 60, threshold: 800 },
    { name: 'no coupon, free shipping above the threshold', subtotal: 1200, coupon: null, shippingCost: 60, threshold: 800 },
    { name: 'flat coupon, shipping still charged', subtotal: 500, coupon: { type: 'fixed', value: 50 }, shippingCost: 60, threshold: 800 },
    { name: 'flat coupon, drops below the threshold', subtotal: 820, coupon: { type: 'fixed', value: 50 }, shippingCost: 60, threshold: 800 },
    { name: 'percent coupon under the threshold', subtotal: 500, coupon: { type: 'percent', value: 10 }, shippingCost: 60, threshold: 800 },
    { name: 'percent coupon carries it over the threshold', subtotal: 900, coupon: { type: 'percent', value: 20 }, shippingCost: 60, threshold: 800 },
    { name: 'coupon exactly empties the bag', subtotal: 300, coupon: { type: 'fixed', value: 300 }, shippingCost: 60, threshold: 800 },
    { name: 'coupon larger than the bag', subtotal: 300, coupon: { type: 'fixed', value: 999 }, shippingCost: 60, threshold: 800 },
    { name: 'zero shipping governorate stays free', subtotal: 400, coupon: null, shippingCost: 0, threshold: 800 },
    { name: 'an unset threshold falls back to 800, exactly like the server', subtotal: 5000, coupon: null, shippingCost: 60, threshold: 0 },
    { name: 'a huge coupon cannot buy free shipping below the threshold', subtotal: 500, coupon: { type: 'fixed', value: 500 }, shippingCost: 60, threshold: 800 }
  ]

  for (const c of cases) {
    it(c.name, () => {
      const client = checkoutTotals({
        subtotal: c.subtotal,
        couponAmount: c.coupon
          ? c.coupon.type === 'percent'
            ? Math.round((c.subtotal * Number(c.coupon.value)) / 100)
            : Math.min(Number(c.coupon.value), c.subtotal)
          : 0,
        shippingCost: c.shippingCost,
        freeShippingThreshold: c.threshold
      })

      const server = serverTotals({
        subtotal: c.subtotal,
        coupon: c.coupon,
        shippingCost: c.shippingCost,
        threshold: c.threshold
      })

      expect(client.total).toBe(server)
    })
  }
})

describe('the client total is not the naive one', () => {
  it('applies the coupon, which subtotal + shipping would not', () => {
    // 700 - 100 = 600, still under the 800 threshold, so shipping is charged on
    // top: 660. The naive subtotal + shipping would have said 760 and skipped
    // the coupon entirely.
    const { total, discount, shippingCost } = checkoutTotals({
      subtotal: 700,
      couponAmount: 100,
      shippingCost: 60,
      freeShippingThreshold: 800
    })
    expect(discount).toBe(100)
    expect(shippingCost).toBe(60)
    expect(total).toBe(600 + 60)
  })

  it('charges nothing above the threshold, which subtotal + shipping would', () => {
    const { total, shippingCost } = checkoutTotals({
      subtotal: 1000,
      couponAmount: 0,
      shippingCost: 60,
      freeShippingThreshold: 800
    })
    expect(shippingCost).toBe(0)
    expect(total).toBe(1000)
  })
})