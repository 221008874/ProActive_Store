// Coupon eligibility rules. Separated from the Firestore lookup so the three
// rejection reasons (expired / exhausted / wrong currency) can be tested
// directly, including the edge cases that are awkward to trigger in the UI.

export const COUPON_COLLECTION = 'egp_coupons'

// Firestore stores expiresAt either as a Timestamp or an ISO string depending
// on how the admin dashboard wrote it, so handle both.
export function resolveCouponExpiry(couponData) {
  return couponData.expiresAt?.toDate?.() || new Date(couponData.expiresAt)
}

export function isCouponExpired(couponData, now = new Date()) {
  return resolveCouponExpiry(couponData) < now
}

export function isCouponExhausted(couponData) {
  return couponData.usedCount >= couponData.maxUses
}

export function isCouponCurrencyValid(couponData) {
  return !couponData.currency || couponData.currency === 'EGP'
}

// Returns null when the coupon is usable, otherwise an error key plus the
// English fallback the caller can hand to the translator.
export function assertCouponUsable(couponData, { now = new Date() } = {}) {
  if (isCouponExpired(couponData, now)) {
    return { key: 'couponExpired', fallback: 'Coupon expired' }
  }
  if (isCouponExhausted(couponData)) {
    return { key: 'couponExhausted', fallback: 'Coupon fully used' }
  }
  if (!isCouponCurrencyValid(couponData)) {
    return {
      key: 'couponCurrencyMismatch',
      fallback: `Coupon valid only for ${couponData.currency}`
    }
  }
  return null
}

export function buildAppliedCoupon({ id, couponData, symbol, t }) {
  return {
    id,
    code: couponData.code,
    amount: couponData.amount,
    currency: couponData.currency || 'EGP',
    label: `${symbol} ${couponData.amount} ${t('off') || 'off'}`
  }
}

// The lookup falls back to scanning active coupons so a code typed in the wrong
// case still matches. Callers pass the already-fetched snapshot docs.
export function findCaseInsensitiveMatch(docs, rawInput) {
  const target = rawInput.toLowerCase()
  return docs.find((doc) => doc.data().code.toLowerCase() === target) || null
}

// Normalises the typed code before the exact / uppercase / lowercase attempts.
export function normalizeCouponCode(rawInput) {
  return rawInput.trim()
}