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

// Whole Egyptian pounds by default, falling back to two decimals only when
// the amount is not a round number, so a price never reads as "450.00 EGP"
// when 450 is the whole truth. Latin digits in both languages — Egyptian
// price tags use them, and the Arabic-Indic forms are not what the stock and
// totals a shopper compares against are printed in.
export function formatPrice(price) {
  const amount = Number(price) || 0;
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2)} EGP`;
}

// Arabic spelling of the same money: the number stays LTR (wrapped in <bdi>
// at the call site so it does not reorder inside RTL text) and only the unit
// is translated, because the supported currency has one numeric form.
export function formatPriceAr(price) {
  const amount = Number(price) || 0;
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2)} جنيه`;
}

// Locale-aware spelling. Currently only 'ar' differs; kept as a function so
// the language switch has one place to hook into.
export function formatPriceFor(price, lang = 'en') {
  return lang === 'ar' ? formatPriceAr(price) : formatPrice(price);
}