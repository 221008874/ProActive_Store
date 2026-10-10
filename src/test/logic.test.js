import { describe, it, expect } from 'vitest'
import {
  EGYPT_GOVERNORATES,
  defaultGovernorateCosts,
  getGovernorate,
  isGovernorateId,
  resolveGovernorateName,
  GOVERNORATE_FALLBACK_COST
} from '../config/egypt'
import { getCurrencyConfig, formatPrice, localizeCurrencyConfig, DEFAULT_CURRENCY } from '../config/currency'
import { getColors, COLORS } from '../config/themes'
import {
  computeShipping,
  computeTotals,
  freeShippingProgress,
  amountToFreeShipping,
  paymentStatusFor,
  paymentMethodLabelFor
} from '../utils/pricing'
import { validateDeliveryForm } from '../utils/validation'
import {
  assertCouponUsable,
  isCouponExpired,
  isCouponExhausted,
  isCouponCurrencyValid,
  resolveCouponExpiry,
  buildAppliedCoupon,
  findCaseInsensitiveMatch,
  normalizeCouponCode
} from '../utils/coupon'
import { buildGeocodeUrl, mapGeocodeResults } from '../utils/geo'

const t = (key, fallback) => fallback ?? key
const EGP = getCurrencyConfig('EGP')

describe('config/egypt', () => {
  it('exposes unique governorate ids', () => {
    const ids = EGYPT_GOVERNORATES.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every governorate both an English and Arabic name', () => {
    for (const gov of EGYPT_GOVERNORATES) {
      expect(gov.name).toBeTruthy()
      expect(gov.nameAr).toBeTruthy()
    }
  })

  it('resolves names per language and falls back to the raw id', () => {
    expect(resolveGovernorateName('cairo', 'en')).toBe('Cairo')
    expect(resolveGovernorateName('cairo', 'ar')).toBe('القاهرة')
    expect(resolveGovernorateName('atlantis', 'en')).toBe('atlantis')
    expect(resolveGovernorateName(undefined, 'en')).toBeUndefined()
  })

  it('looks up governorates by id', () => {
    expect(getGovernorate('giza').name).toBe('Giza')
    expect(getGovernorate('nope')).toBeUndefined()
    expect(isGovernorateId('giza')).toBe(true)
    expect(isGovernorateId('nope')).toBe(false)
  })

  it('builds a full fallback cost map', () => {
    const costs = defaultGovernorateCosts()
    expect(Object.keys(costs)).toHaveLength(EGYPT_GOVERNORATES.length)
    expect(costs.cairo).toBe(GOVERNORATE_FALLBACK_COST)
  })
})

describe('config/currency', () => {
  it('returns the single EGP config regardless of input', () => {
    expect(getCurrencyConfig('EGP')).toBe(EGP)
    expect(getCurrencyConfig('XYZ')).toBe(EGP)
    expect(getCurrencyConfig(undefined)).toBe(EGP)
  })

  it('uses the EGP collections', () => {
    expect(EGP.collection).toBe('products_egp')
    expect(EGP.orderCollection).toBe('orders_egp')
    expect(EGP.freeShippingThreshold).toBe(800)
  })

  it('has nothing to localise now the store is EGP only', () => {
    expect(localizeCurrencyConfig('EGP', (k) => `x-${k}`)).toBe(EGP)
    expect(EGP.shippingZones).toBeUndefined()
  })

  it('formats prices as EGP', () => {
    expect(formatPrice(25)).toBe('25.00 EGP')
    expect(formatPrice('25')).toBe('25.00 EGP')
  })
})

describe('config/themes', () => {
  it('returns the requested palette and defaults to light', () => {
    expect(getColors('dark')).toBe(COLORS.dark)
    expect(getColors('light')).toBe(COLORS.light)
    expect(getColors('nonsense')).toBe(COLORS.light)
  })

  it('keeps both palettes shape-identical', () => {
    expect(Object.keys(COLORS.light).sort()).toEqual(Object.keys(COLORS.dark).sort())
  })
})

describe('utils/pricing - computeShipping', () => {
  const egpBase = {
    currencyConfig: EGP,
    governorateCosts: { cairo: 60 },
    t
  }

  it('prices EGP delivery by the chosen governorate', () => {
    const result = computeShipping({ ...egpBase, totalPrice: 100, selectedGovernorate: 'cairo' })
    expect(result.cost).toBe(60)
    expect(result.zone).toBe('Cairo')
  })

  it('falls back to the default cost for an unpriced governorate', () => {
    const result = computeShipping({ ...egpBase, totalPrice: 100, selectedGovernorate: 'luxor' })
    expect(result.cost).toBe(GOVERNORATE_FALLBACK_COST)
  })

  it('treats a zero-cost governorate as unpriced (preserved legacy behaviour)', () => {
    const result = computeShipping({
      ...egpBase,
      totalPrice: 100,
      selectedGovernorate: 'giza',
      governorateCosts: { giza: 0 }
    })
    expect(result.cost).toBe(GOVERNORATE_FALLBACK_COST)
  })

  it('never charges shipping before a governorate is chosen', () => {
    const result = computeShipping({ ...egpBase, totalPrice: 100, selectedGovernorate: '' })
    expect(result.cost).toBe(0)
    expect(result.isFree).toBe(false)
  })

  it('waives EGP shipping at the threshold', () => {
    const result = computeShipping({ ...egpBase, totalPrice: 800, selectedGovernorate: 'cairo' })
    expect(result.cost).toBe(0)
    expect(result.isFree).toBe(true)
  })

  it('localises the governorate zone name', () => {
    const result = computeShipping({
      ...egpBase,
      totalPrice: 100,
      selectedGovernorate: 'cairo',
      lang: 'ar'
    })
    expect(result.zone).toBe('القاهرة')
  })
})

describe('utils/pricing - totals', () => {
  it('applies a coupon to the subtotal', () => {
    expect(computeTotals({ totalPrice: 100, couponAmount: 30, shippingCost: 10 })).toEqual({
      discountAmount: 30,
      subtotal: 70,
      shippingCost: 10,
      finalPrice: 80
    })
  })

  it('never lets the subtotal go negative on an oversized coupon', () => {
    const totals = computeTotals({ totalPrice: 50, couponAmount: 80, shippingCost: 10 })
    expect(totals.subtotal).toBe(0)
    expect(totals.finalPrice).toBe(10)
  })

  it('treats a missing coupon as no discount', () => {
    expect(computeTotals({ totalPrice: 100, shippingCost: 5 }).discountAmount).toBe(0)
  })

  it('reports free-shipping progress, capped at 100', () => {
    expect(freeShippingProgress({ totalPrice: 400, threshold: 800 })).toBe(50)
    expect(freeShippingProgress({ totalPrice: 2000, threshold: 800 })).toBe(100)
    expect(freeShippingProgress({ totalPrice: 100, threshold: 0 })).toBe(100)
  })

  it('reports the remaining amount for free shipping', () => {
    expect(amountToFreeShipping({ totalPrice: 300, threshold: 800 })).toBe(500)
    expect(amountToFreeShipping({ totalPrice: 900, threshold: 800 })).toBe(0)
  })
})

describe('utils/pricing - payment status', () => {
  it('maps cod to pending and card to awaiting_payment', () => {
    expect(paymentStatusFor('cod')).toBe('pending')
    expect(paymentStatusFor('card')).toBe('awaiting_payment')
  })

  it('labels payment methods', () => {
    expect(paymentMethodLabelFor('cod', t)).toBe('cashOnDelivery')
    expect(paymentMethodLabelFor('card', t)).toBe('cardPayment')
  })
})

describe('utils/validation', () => {
  const valid = {
    name: 'Jane',
    phone: '+20 100 000 0000',
    email: 'jane@example.com',
    address: '12 Nile Street, Cairo',
    governorate: 'cairo',
    latitude: 30.0444,
    longitude: 31.2357
  }

  it('accepts a complete EGP form', () => {
    expect(validateDeliveryForm(valid, { currency: 'EGP', t }).isValid).toBe(true)
  })

  it('reports every missing field at once', () => {
    const { errors, isValid } = validateDeliveryForm(
      { name: '', phone: '', email: '', address: '', governorate: '', latitude: null, longitude: null },
      { currency: 'EGP', t }
    )
    expect(isValid).toBe(false)
    expect(Object.keys(errors).sort()).toEqual(
      ['address', 'email', 'governorate', 'location', 'name', 'phone'].sort()
    )
  })

  it('rejects an address shorter than 10 characters', () => {
    expect(validateDeliveryForm({ ...valid, address: 'short' }, { currency: 'EGP', t }).errors.address)
      .toBe('addressTooShort')
  })

  it('rejects malformed phone and email values', () => {
    const result = validateDeliveryForm(
      { ...valid, phone: 'abc', email: 'not-an-email' },
      { currency: 'EGP', t }
    )
    expect(result.errors.phone).toBe('validPhoneRequired')
    expect(result.errors.email).toBe('validEmailRequired')
  })

  it('requires lat and lng together', () => {
    expect(validateDeliveryForm({ ...valid, longitude: null }, { currency: 'EGP', t }).errors.location)
      .toBe('locationRequired')
  })

  it('always requires a governorate', () => {
    const missing = { ...valid, governorate: '' }
    expect(validateDeliveryForm(missing, { currency: 'EGP', t }).errors.governorate).toBeDefined()
  })

  it('never mutates the form data it validates', () => {
    const input = { ...valid }
    validateDeliveryForm(input, { currency: 'EGP', t })
    expect(input).toEqual(valid)
  })
})

describe('utils/coupon', () => {
  const future = new Date(Date.now() + 86_400_000)
  const past = new Date(Date.now() - 86_400_000)
  const usable = { code: 'SAVE10', amount: 10, usedCount: 0, maxUses: 5, expiresAt: future }

  it('reads expiry from a Timestamp or a string', () => {
    expect(resolveCouponExpiry({ expiresAt: { toDate: () => future } })).toEqual(future)
    expect(resolveCouponExpiry({ expiresAt: future.toISOString() })).toEqual(future)
  })

  it('detects expiry in both formats', () => {
    expect(isCouponExpired({ expiresAt: past })).toBe(true)
    expect(isCouponExpired({ expiresAt: { toDate: () => future } })).toBe(false)
  })

  it('detects exhaustion at and above the limit', () => {
    expect(isCouponExhausted({ usedCount: 5, maxUses: 5 })).toBe(true)
    expect(isCouponExhausted({ usedCount: 6, maxUses: 5 })).toBe(true)
    expect(isCouponExhausted({ usedCount: 4, maxUses: 5 })).toBe(false)
  })

  it('accepts coupons with no currency set or an EGP currency', () => {
    expect(isCouponCurrencyValid({ currency: 'EGP' })).toBe(true)
    expect(isCouponCurrencyValid({})).toBe(true)
    expect(isCouponCurrencyValid({ currency: 'USD' })).toBe(false)
  })

  it('returns null for a usable coupon', () => {
    expect(assertCouponUsable(usable, { t })).toBeNull()
  })

  it('rejects in priority order: expired, then exhausted, then currency', () => {
    const expired = { ...usable, expiresAt: past }
    expect(assertCouponUsable(expired, { t }).key).toBe('couponExpired')

    const exhausted = { ...usable, usedCount: 5 }
    expect(assertCouponUsable(exhausted, { t }).key).toBe('couponExhausted')

    const wrongCurrency = { ...usable, currency: 'USD' }
    expect(assertCouponUsable(wrongCurrency, { t }).key).toBe('couponCurrencyMismatch')
  })

  it('builds the applied-coupon record with a localized label', () => {
    const applied = buildAppliedCoupon({
      id: 'doc-1',
      couponData: usable,
      symbol: 'EGP',
      t
    })
    expect(applied).toEqual({
      id: 'doc-1',
      code: 'SAVE10',
      amount: 10,
      currency: 'EGP',
      label: 'EGP 10 off'
    })
  })

  it('trims the typed code', () => {
    expect(normalizeCouponCode('  SAVE10  ')).toBe('SAVE10')
  })

  it('matches a coupon regardless of stored code casing', () => {
    const docs = [
      { id: 'a', data: () => ({ code: 'other' }) },
      { id: 'b', data: () => ({ code: 'save10' }) }
    ]
    expect(findCaseInsensitiveMatch(docs, 'SAVE10').id).toBe('b')
    expect(findCaseInsensitiveMatch(docs, 'nope')).toBeNull()
    expect(findCaseInsensitiveMatch([], 'SAVE10')).toBeNull()
  })
})

describe('utils/geo', () => {
  it('always constrains lookups to Egypt', () => {
    expect(buildGeocodeUrl('Cairo')).toContain('countrycodes=eg')
    expect(buildGeocodeUrl('Boston')).toContain('countrycodes=eg')
  })

  it('encodes the query', () => {
    expect(buildGeocodeUrl('New York')).toContain('q=New%20York')
  })

  it('coerces lat/lon strings to numbers for Leaflet', () => {
    expect(mapGeocodeResults([{ display_name: 'X', lat: '30.04', lon: '31.23' }])).toEqual([
      { display_name: 'X', lat: 30.04, lon: 31.23 }
    ])
  })

  it('returns an empty list for no results', () => {
    expect(mapGeocodeResults([])).toEqual([])
  })
})