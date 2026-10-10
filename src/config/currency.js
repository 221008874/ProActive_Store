// Store configuration: currency, Firestore collections and shipping policy.
// The store sells in Egypt only, so EGP is the single supported currency and
// this module is a plain constant rather than a per-currency lookup.

export const CURRENCY = {
  symbol: 'EGP',
  code: 'EGP',
  collection: 'products_egp',
  orderCollection: 'orders_egp',
  freeShippingThreshold: 800
}

export const DEFAULT_CURRENCY = CURRENCY.code

// Kept for call sites that used to pass a detected currency around. There is
// no currency choice left to make, so it always returns the single config.
export function getCurrencyConfig() {
  return CURRENCY
}

// EGP prices per governorate (config/egypt.js) rather than shipping zones, so
// there is nothing to localise here any more. Signature kept so existing call
// sites do not need changing.
export function localizeCurrencyConfig() {
  return CURRENCY
}

export function formatPrice(price) {
  return `${Number(price).toFixed(2)} EGP`
}