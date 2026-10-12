// Store settings.
//
// The public half of egp_settings/general (free-shipping threshold, WhatsApp
// number, minimum order, ordersOpen) ships inside the catalogue snapshot, which
// the storefront already fetches and caches by version. Reading it from there
// means opening the shell, the product page and checkout costs no extra
// Firestore reads at all.
//
// The snapshot is a cache: the owner can flip the kill switch or change the
// threshold and the storefront picks it up on the next catalogue refresh
// (bounded by the rebuild cooldown). Nothing that decides money reads it —
// checkout re-reads live documents server-side.
//
// The cache below is module-level and short-lived: a shopper who leaves the tab
// open for an hour should still see the current threshold, but a page turn
// should not re-fetch the snapshot.

import { fetchPublicSettings } from "./catalog";
import { CURRENCY } from "../config/currency";

const CACHE_MS = 5 * 60 * 1000;

let cached = null;
let cachedAt = 0;

/**
 * The public settings, or null when the snapshot has not been built yet (a
 * fresh install). `force` bypasses the cache after a write.
 */
export async function getSettings({ force = false } = {}) {
  if (!force && cached && Date.now() - cachedAt < CACHE_MS) return cached;

  try {
    const settings = await fetchPublicSettings();
    cached = settings && Object.keys(settings).length > 0 ? settings : null;
    cachedAt = Date.now();
  } catch {
    // A missing settings snapshot must not break the shell: the fallback
    // threshold is what the store shipped with.
    if (!cached) cached = null;
  }
  return cached;
}

/**
 * Free shipping threshold in EGP. Never 0 — 0 would mean "always free", so an
 * unset or invalid value falls back to the store's default rather than
 * silently giving shipping away.
 */
export async function getFreeShippingThreshold() {
  const settings = await getSettings();
  const value = Number(settings?.freeShippingThreshold);
  return Number.isFinite(value) && value > 0 ? value : CURRENCY.freeShippingThreshold;
}

/** WhatsApp number for the footer/contact, or null. */
export async function getWhatsAppNumber() {
  const settings = await getSettings();
  return settings?.whatsapp ? String(settings.whatsapp) : null;
}

/** Drop the cache after an admin write so the next read is fresh. */
export function invalidateSettings() {
  cached = null;
  cachedAt = 0;
}
