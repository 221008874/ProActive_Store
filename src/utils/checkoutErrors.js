// Checkout error mapping.
//
// /api/placeOrder returns structured codes rather than sentences, so the UI
// owns the wording. Every code the server can return is mapped here, and an
// unmapped one falls back to a generic line rather than showing a raw code.
//
// `step` says where the shopper has to go to fix it: OUT_OF_STOCK sends them
// back to the bag because that is where the line they must change lives, while
// BELOW_MIN_ORDER is fixable once they add something (also the bag).

/** code -> { key, step, fixable } */
export const CHECKOUT_REJECTIONS = {
  BAD_CART: { key: 'cartEmpty', step: 1, fixable: true },
  BAD_QTY: { key: 'badQuantity', step: 1, fixable: true },
  BAD_CUSTOMER: { key: 'badCustomer', step: 2, fixable: true },
  BAD_ADDRESS: { key: 'badAddress', step: 2, fixable: true },
  OUT_OF_STOCK: { key: 'outOfStock', step: 1, fixable: true },
  UNAVAILABLE: { key: 'unavailable', step: 1, fixable: true },
  GOVERNORATE_UNAVAILABLE: { key: 'governorateUnavailable', step: 2, fixable: true },
  COUPON_INVALID: { key: 'couponInvalid', step: 1, fixable: true },
  BELOW_MIN_ORDER: { key: 'belowMinimum', step: 1, fixable: true },
  RATE_LIMITED: { key: 'rateLimited', step: 0, fixable: false },
  BLOCKED: { key: 'blocked', step: 0, fixable: false },
  ORDERS_CLOSED: { key: 'ordersClosed', step: 0, fixable: false },
  CAPTCHA_REQUIRED: { key: 'captchaRequired', step: 0, fixable: false },
  CAPTCHA_FAILED: { key: 'captchaFailed', step: 0, fixable: false },
  // A server-side failure is not the shopper's mistake, so it says so and
  // reassures them nothing was charged — cash on delivery means nothing was.
  INTERNAL: { key: 'internal', step: 0, fixable: false }
}

/**
 * The message key and destination step for a thrown checkout error.
 * Accepts either an Error with `.code` or a plain code string.
 */
export function classifyCheckoutError(error) {
  const code = (typeof error === 'string' ? error : error?.code) ?? ''
  const known = CHECKOUT_REJECTIONS[code]
  return {
    code,
    key: known?.key ?? 'generic',
    step: known?.step ?? 0,
    fixable: known?.fixable ?? false,
    // The server names the offending line so the bag can mark the exact row
    // rather than every line in red.
    detail: typeof error?.detail === 'string' ? error.detail : ''
  }
}

/**
 * Which cart lines a rejection names. `detail` is "productId:variantId" for
 * stock rejections and a bare id for availability, so both shapes resolve.
 */
export function linesForRejection(rejection, cart = []) {
  const detail = rejection?.detail ?? ''
  if (!detail) return []
  const [productId, variantId] = detail.split(':')

  return cart
    .filter((item) => {
      const itemProduct = item.productId ?? String(item.id).split(':')[0]
      const itemVariant = item.variantId ?? (item.id.includes(':') ? item.id.split(':')[1] : null)
      return itemProduct === productId && (!variantId || itemVariant === variantId)
    })
    .map((item) => item.id)
}

/** True when the rejection can be fixed by going back and changing something. */
export function isFixable(rejection) {
  return Boolean(CHECKOUT_REJECTIONS[rejection?.code]?.fixable)
}
