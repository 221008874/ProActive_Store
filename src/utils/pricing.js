// Pure pricing maths for checkout. Every function here is side-effect free and
// unit-tested, because these numbers decide what a shopper is charged.

import { GOVERNORATE_FALLBACK_COST, resolveGovernorateName } from '../config/egypt'

export function computeShipping({
  currencyConfig,
  totalPrice,
  selectedGovernorate,
  governorateCosts = {},
  lang = 'en',
  t
}) {
  if (!selectedGovernorate) {
    return { cost: 0, zone: t('selectGovernorate') || 'Select Governorate', isFree: false }
  }

  // `||` (not `??`) is deliberate and preserved from the original inline code:
  // a governorate explicitly priced at 0 falls back to the default cost rather
  // than shipping free. Change it here, deliberately, if that is wrong.
  const governorateCost = governorateCosts[selectedGovernorate] || GOVERNORATE_FALLBACK_COST
  const isFree = totalPrice >= currencyConfig.freeShippingThreshold
  const cost = isFree ? 0 : governorateCost

  return {
    cost,
    zone: resolveGovernorateName(selectedGovernorate, lang),
    isFree
  }
}

/**
 * The checkout money breakdown, mirroring the server exactly.
 *
 * server/_core/orderCore.js `computeTotals` is the authority: the coupon comes
 * off the subtotal first, and free shipping is decided on what is LEFT, not on
 * the pre-discount subtotal. Three step components used to add `subtotal +
 * shipping` on their own, which charged for a delivery the server would not
 * charge and quoted a total the order was never created with.
 *
 * `checkoutTotals.test.js` asserts this function equals the server's for the
 * same inputs, so the two cannot drift.
 */
export function checkoutTotals({ subtotal, couponAmount = 0, shippingCost = 0, freeShippingThreshold = 0 }) {
  const base = Math.max(0, Number(subtotal) || 0)
  const discount = Math.max(0, Math.min(Number(couponAmount) || 0, base))
  const discounted = base - discount
  // A missing threshold means the SAME fallback as the server
  // (FREE_SHIPPING_FALLBACK = 800), not "never free": reading it as 0 would make
  // the client charge shipping on a 5000 EGP order the server ships free.
  const configured = Number(freeShippingThreshold)
  const threshold = Number.isFinite(configured) && configured > 0 ? configured : 800
  const cost = Number(shippingCost) || 0
  const shipping = discounted >= threshold ? 0 : cost
  return { subtotal: base, discount, discounted, shippingCost: shipping, total: discounted + shipping }
}

export function computeTotals({ totalPrice, couponAmount = 0, shippingCost = 0 }) {
  const discountAmount = couponAmount || 0
  const subtotal = Math.max(0, totalPrice - discountAmount)
  return {
    discountAmount,
    subtotal,
    shippingCost,
    finalPrice: subtotal + shippingCost
  }
}

export function freeShippingProgress({ totalPrice, threshold }) {
  if (!threshold) return 100
  return Math.min((totalPrice / threshold) * 100, 100)
}

export function amountToFreeShipping({ totalPrice, threshold }) {
  return Math.max(0, threshold - totalPrice)
}

export function paymentStatusFor(paymentMethod) {
  return paymentMethod === 'cod' ? 'pending' : 'awaiting_payment'
}

export function paymentMethodLabelFor(paymentMethod, t) {
  return paymentMethod === 'cod' ? t('cashOnDelivery') : t('cardPayment')
}