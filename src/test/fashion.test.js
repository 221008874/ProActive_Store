import { describe, it, expect } from 'vitest'
import { loc, isLocalized } from '../utils/i18n'
import {
  newOrderNumber,
  randomSuffix,
  discountForCoupon,
  couponRejection,
  computeOrderTotals,
  messageForError,
  CHECKOUT_ERROR_MESSAGES,
  FREE_SHIPPING_FALLBACK
} from '../utils/orderMath'
import {
  filterProducts,
  DEFAULT_FILTERS,
  SORTERS,
  variantIdFor,
  findVariant,
  isVariantPurchasable,
  availableSizesFor,
  availableColorsFor
} from '../hooks/useCatalog'

const ts = (ms) => ({ toMillis: () => ms })

describe('utils/i18n', () => {
  const field = { ar: 'فستان صيفي', en: 'Summer Dress' }

  it('resolves by language', () => {
    expect(loc(field, 'en')).toBe('Summer Dress')
    expect(loc(field, 'ar')).toBe('فستان صيفي')
  })

  it('defaults to English', () => {
    expect(loc(field)).toBe('Summer Dress')
  })

  it('falls back to the other language when one side is empty', () => {
    expect(loc({ ar: '', en: 'Only English' }, 'ar')).toBe('Only English')
    expect(loc({ ar: 'عربي فقط', en: '' }, 'en')).toBe('عربي فقط')
  })

  it('passes plain strings and numbers through (legacy documents)', () => {
    expect(loc('Legacy Name', 'en')).toBe('Legacy Name')
    expect(loc(42, 'en')).toBe('42')
  })

  it('returns empty string for nothing usable', () => {
    expect(loc(null)).toBe('')
    expect(loc(undefined)).toBe('')
    expect(loc({})).toBe('')
  })

  it('detects whether a field is already bilingual', () => {
    expect(isLocalized(field)).toBe(true)
    expect(isLocalized('plain')).toBe(false)
    expect(isLocalized(null)).toBe(false)
  })
})

describe('utils/orderMath - order numbers', () => {
  it('produces a PA- prefixed number', () => {
    expect(newOrderNumber()).toMatch(/^PA-[A-Z2-9]{6}$/)
  })

  it('avoids ambiguous characters', () => {
    const sample = Array.from({ length: 200 }, () => randomSuffix(20)).join('')
    expect(sample).not.toMatch(/[IO01]/)
  })

  it('does not collide across many draws', () => {
    const seen = new Set(Array.from({ length: 5000 }, () => newOrderNumber()))
    expect(seen.size).toBe(5000)
  })
})

describe('utils/orderMath - coupons', () => {
  const base = { active: true, usedCount: 0, maxUses: null, minOrder: 0, expiresAt: null }

  it('treats a coupon with no type as a FIXED amount, never a percent', () => {
    expect(discountForCoupon({ ...base, value: 10 }, 500)).toBe(10)
  })

  it('applies percent coupons only when explicitly typed', () => {
    expect(discountForCoupon({ ...base, type: 'percent', value: 10 }, 500)).toBe(50)
  })

  it('never discounts below zero or above the subtotal', () => {
    expect(discountForCoupon({ ...base, value: 999 }, 100)).toBe(100)
    expect(discountForCoupon({ ...base, value: -50 }, 100)).toBe(0)
    expect(discountForCoupon({ ...base, type: 'percent', value: 300 }, 100)).toBe(100)
  })

  it('returns zero when there is no coupon', () => {
    expect(discountForCoupon(null, 100)).toBe(0)
  })

  it('accepts a valid coupon', () => {
    expect(couponRejection({ ...base, value: 10 }, 500)).toBeNull()
  })

  it('accepts NO coupon at all (regression: this once rejected every plain order)', () => {
    expect(couponRejection(null, 500)).toBeNull()
    const totals = computeOrderTotals({ lines: [{ unitPrice: 100, qty: 1 }], governorate: { cost: 0 } })
    expect(totals.discount).toBe(0)
  })

  it('rejects inactive coupons', () => {
    expect(couponRejection({ ...base, active: false }, 500)).toBe('COUPON_INVALID')
  })

  it('rejects expired coupons from a Timestamp or a number', () => {
    const past = Date.now() - 1000
    expect(couponRejection({ ...base, expiresAt: ts(past) }, 500)).toBe('COUPON_INVALID')
    expect(couponRejection({ ...base, expiresAt: past }, 500)).toBe('COUPON_INVALID')
  })

  it('accepts a coupon that has not expired yet', () => {
    expect(couponRejection({ ...base, expiresAt: ts(Date.now() + 60_000) }, 500)).toBeNull()
  })

  it('rejects a coupon that is fully used', () => {
    expect(couponRejection({ ...base, maxUses: 1, usedCount: 1 }, 500)).toBe('COUPON_INVALID')
  })

  it('rejects a coupon below its minimum order', () => {
    expect(couponRejection({ ...base, minOrder: 1000 }, 500)).toBe('COUPON_INVALID')
    expect(couponRejection({ ...base, minOrder: 500 }, 500)).toBeNull()
  })
})

describe('utils/orderMath - totals', () => {
  const lines = [
    { unitPrice: 300, qty: 2 },
    { unitPrice: 100, qty: 1 }
  ]

  it('sums the subtotal from lines', () => {
    const totals = computeOrderTotals({
      lines,
      governorate: { cost: 50, minOrder: 0 },
      settings: { freeShippingThreshold: 800 }
    })
    expect(totals.subtotal).toBe(700)
  })

  it('charges shipping below the threshold', () => {
    const totals = computeOrderTotals({
      lines,
      governorate: { cost: 50 },
      settings: { freeShippingThreshold: 800 }
    })
    expect(totals.shippingCost).toBe(50)
    expect(totals.total).toBe(750)
  })

  it('waives shipping at the threshold, judged on the DISCOUNTED total', () => {
    const totals = computeOrderTotals({
      lines,
      coupon: { active: true, usedCount: 0, maxUses: null, minOrder: 0, value: 50 },
      governorate: { cost: 50 },
      settings: { freeShippingThreshold: 650 }
    })
    expect(totals.subtotal).toBe(700)
    expect(totals.discount).toBe(50)
    expect(totals.shippingCost).toBe(0)
    expect(totals.total).toBe(650)
  })

  it('falls back to 800 when the threshold is not configured', () => {
    const cheap = computeOrderTotals({ lines, governorate: { cost: 50 }, settings: {} })
    expect(cheap.shippingCost).toBe(50)
    expect(FREE_SHIPPING_FALLBACK).toBe(800)
  })

  it('rejects an order below the governorate minimum', () => {
    expect(() =>
      computeOrderTotals({ lines, governorate: { cost: 50, minOrder: 1000 } })
    ).toThrow(/BELOW_MIN_ORDER/)
  })

  it('throws COUPON_INVALID for a rejected coupon', () => {
    expect(() =>
      computeOrderTotals({
        lines,
        coupon: { active: false },
        governorate: { cost: 50 }
      })
    ).toThrow(/COUPON_INVALID/)
  })

  it('carries a code on the thrown error', () => {
    try {
      computeOrderTotals({ lines, governorate: { cost: 50, minOrder: 99999 } })
      throw new Error('should have thrown')
    } catch (e) {
      expect(e.code).toBe('BELOW_MIN_ORDER')
    }
  })
})

describe('utils/orderMath - error messages', () => {
  it('maps known codes to shopper-facing text', () => {
    expect(messageForError({ code: 'OUT_OF_STOCK' })).toBe(CHECKOUT_ERROR_MESSAGES.OUT_OF_STOCK)
    expect(messageForError(new Error('COUPON_INVALID'))).toBe(CHECKOUT_ERROR_MESSAGES.COUPON_INVALID)
  })

  it('matches codes carrying a detail suffix', () => {
    expect(messageForError(new Error('OUT_OF_STOCK:p1:red_M'))).toBe(CHECKOUT_ERROR_MESSAGES.OUT_OF_STOCK)
  })

  it('falls back to a generic message for unknown failures', () => {
    expect(messageForError(new Error('kaboom'))).toBe(CHECKOUT_ERROR_MESSAGES.SERVER_ERROR)
    expect(messageForError(null)).toBe(CHECKOUT_ERROR_MESSAGES.SERVER_ERROR)
  })
})

describe('hooks/useCatalog - filtering', () => {
  const products = [
    {
      id: 'dress',
      title: { ar: 'فستان', en: 'Summer Dress' },
      categoryPath: ['women', 'dresses'],
      gender: 'women',
      availableSizes: ['S', 'M'],
      availableColors: ['red'],
      price: 450,
      compareAtPrice: 600,
      discountPct: 25,
      totalStock: 10,
      soldCount: 3,
      tags: ['summer'],
      createdAt: ts(1000)
    },
    {
      id: 'shirt',
      title: { ar: 'قميص', en: 'Linen Shirt' },
      categoryPath: ['men', 'tops'],
      gender: 'men',
      availableSizes: ['L'],
      availableColors: ['blue'],
      price: 300,
      compareAtPrice: null,
      discountPct: 0,
      totalStock: 0,
      soldCount: 10,
      tags: [],
      createdAt: ts(2000)
    }
  ]

  it('defaults to newest first', () => {
    expect(filterProducts(products, {}).map((p) => p.id)).toEqual(['shirt', 'dress'])
  })

  it('filters by category through categoryPath', () => {
    expect(filterProducts(products, { categoryId: 'dresses' }).map((p) => p.id)).toEqual(['dress'])
  })

  it('filters by gender, size and colour', () => {
    expect(filterProducts(products, { gender: 'men' }).map((p) => p.id)).toEqual(['shirt'])
    expect(filterProducts(products, { sizes: ['S'] }).map((p) => p.id)).toEqual(['dress'])
    expect(filterProducts(products, { colors: ['blue'] }).map((p) => p.id)).toEqual(['shirt'])
  })

  it('filters by price range inclusively', () => {
    expect(filterProducts(products, { minPrice: 400 }).map((p) => p.id)).toEqual(['dress'])
    expect(filterProducts(products, { maxPrice: 400 }).map((p) => p.id)).toEqual(['shirt'])
  })

  it('filters sale and in-stock only', () => {
    expect(filterProducts(products, { onSale: true }).map((p) => p.id)).toEqual(['dress'])
    expect(filterProducts(products, { inStockOnly: true }).map((p) => p.id)).toEqual(['dress'])
  })

  it('searches titles in either language', () => {
    expect(filterProducts(products, { q: 'dress' }).map((p) => p.id)).toEqual(['dress'])
    expect(filterProducts(products, { q: 'قميص' }).map((p) => p.id)).toEqual(['shirt'])
  })

  it('sorts by price and by best seller', () => {
    expect(filterProducts(products, { sort: 'priceAsc' }).map((p) => p.id)).toEqual(['shirt', 'dress'])
    expect(filterProducts(products, { sort: 'priceDesc' }).map((p) => p.id)).toEqual(['dress', 'shirt'])
    expect(filterProducts(products, { sort: 'bestselling' }).map((p) => p.id)).toEqual(['shirt', 'dress'])
  })

  it('combines filters', () => {
    const out = filterProducts(products, { gender: 'women', inStockOnly: true, onSale: true })
    expect(out.map((p) => p.id)).toEqual(['dress'])
  })

  it('returns nothing when filters exclude everything', () => {
    expect(filterProducts(products, { gender: 'kids' })).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [...products]
    filterProducts(input, { sort: 'priceAsc' })
    expect(input.map((p) => p.id)).toEqual(['dress', 'shirt'])
  })

  it('exposes the expected sorters', () => {
    expect(Object.keys(SORTERS).sort()).toEqual(
      ['bestselling', 'newest', 'priceAsc', 'priceDesc'].sort()
    )
    expect(DEFAULT_FILTERS.sort).toBe('newest')
  })
})

describe('hooks/useCatalog - variants', () => {
  const product = {
    variants: [
      { id: 'red_M', colorId: 'red', color: 'Red', size: 'M', stock: 5, active: true },
      { id: 'red_L', colorId: 'red', color: 'Red', size: 'L', stock: 0, active: true },
      { id: 'black_M', colorId: 'black', color: 'Black', size: 'M', stock: 2, active: false }
    ]
  }

  it('builds a variant id from colour and size', () => {
    expect(variantIdFor('red', 'M')).toBe('red_M')
  })

  it('finds a variant by colour and size', () => {
    expect(findVariant(product, 'red', 'L').stock).toBe(0)
    expect(findVariant(product, 'red', 'XXL')).toBeNull()
    expect(findVariant(null, 'red', 'M')).toBeNull()
  })

  it('treats zero stock and inactive variants as unpurchasable', () => {
    expect(isVariantPurchasable({ stock: 1, active: true })).toBe(true)
    expect(isVariantPurchasable({ stock: 0, active: true })).toBe(false)
    expect(isVariantPurchasable({ stock: 5, active: false })).toBe(false)
    expect(isVariantPurchasable(null)).toBe(false)
  })

  it('lists sizes for a colour', () => {
    expect(availableSizesFor(product, 'red').sort()).toEqual(['L', 'M'])
    expect(availableSizesFor(product, 'nope')).toEqual([])
  })

  it('lists only colours that have purchasable stock', () => {
    expect(availableColorsFor(product)).toEqual(['red'])
  })
})