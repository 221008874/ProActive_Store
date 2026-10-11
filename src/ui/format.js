// Store override of the design system's format module.
//
// The DS ships a self-contained `format.js` because it must run anywhere. In
// this app two of its helpers would DIFFER from what the store already does:
//
//   * formatEGP  — the store owns money policy in config/currency.js (2 decimals,
//                  always the literal "EGP", regardless of language). The DS
//                  rounds and swaps the label to "ج.م" for Arabic.
//   * loc        — utils/i18n.js handles arrays, null/undefined and cross-language
//                  fallback; the DS's inline copy does not.
//
// Everything else (discountPct, LOW_STOCK_AT, stockLevel, pickImage, thumb) is
// already faithful to the store's data, so it is re-exported untouched. Keeping
// one formatter is the point: two of them drift, and prices disagree.
//
// NOTE this file must keep exporting the SAME names the DS components import.

import { formatPriceFor } from '../config/currency.js';

export { loc, isLocalized } from '../utils/i18n.js';

// "360 EGP" in English, "360 جنيه" in Arabic — whole numbers by default, two
// decimals only when the amount is not round. `lang` is honoured rather than
// ignored: the unit differs between the two languages even though the number
// does not (Latin digits in both, per the store's price policy).
export function formatEGP(amount, lang = 'en') {
  return formatPriceFor(amount, lang)
}

/** discountPct from price + compareAtPrice (same formula as the migration plan). */
export function discountPct(price, compareAtPrice) {
  return compareAtPrice > price ? Math.round((1 - price / compareAtPrice) * 100) : 0;
}

/** "Only N left" threshold from the design: shown at 3 or fewer. */
export const LOW_STOCK_AT = 3;

/** Admin stock-grid cell level: 0 = sold out, <=2 = low (matches the Low stock page rule). */
export const stockLevel = (n) => (n <= 0 ? 'zero' : n <= 2 ? 'low' : 'ok');

/** First image of a product, preferring one tagged with the given colour. */
export function pickImage(product, colorId) {
  const imgs = product?.images ?? [];
  return (colorId && imgs.find((i) => i.color === colorId)) || imgs.find((i) => i.isPrimary) || imgs[0] || null;
}

/** Cloudinary delivery transform (migration 6.9): w_400,q_auto,f_auto for thumbnails. */
export function thumb(url, w = 400) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/w_${w},q_auto,f_auto/`);
}
