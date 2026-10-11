// Store settings.
//
// egp_settings/general is the single document the owner edits from the admin
// (free-shipping threshold, WhatsApp number, minimum order). It is read by the
// shell for the announcement bar and by checkout for the minimum, so it is
// cached in one place rather than fetched per call site.
//
// The cache is module-level and short-lived: a shopper who leaves the tab open
// for an hour should still see the current threshold, but a page turn should
// not re-read the document.

import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { CURRENCY } from "../config/currency";

const SETTINGS_DOC = "egp_settings/general";
const CACHE_MS = 5 * 60 * 1000;

let cached = null;
let cachedAt = 0;

/**
 * The settings document, or null when it does not exist yet (a fresh install).
 * `force` bypasses the cache after a write.
 */
export async function getSettings({ force = false } = {}) {
  if (!force && cached && Date.now() - cachedAt < CACHE_MS) return cached;

  try {
    const snap = await getDoc(doc(db, "egp_settings", "general"));
    cached = snap.exists() ? snap.data() : null;
    cachedAt = Date.now();
  } catch {
    // An unread settings document must not break the shell: the fallback
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
