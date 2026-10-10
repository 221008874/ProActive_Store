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