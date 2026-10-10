/**
 * Single source of truth for everything environment-dependent.
 *
 * To move the app to a different Firebase project, currency or Firestore
 * layout, edit this file (or the matching .env.local / Vercel env values)
 * instead of hunting string literals across pages and services.
 */

import { getCurrencyConfig, DEFAULT_CURRENCY } from './currency'

const env = import.meta.env

/* ── Firebase ──────────────────────────────────────────────────────────── */

export const FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
]

/**
 * Fallbacks keep the app bootable when a var is missing, and the warning
 * below makes the omission loud instead of silently running against the
 * wrong project. The fallback is the intended project (mina-terek-samir-
 * shein) so a partial env never produces a mix of two projects - set all
 * six together, or none.
 */
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyB-zDX6AzSZ6ccS6XeqITC8oucFcwlWwDo',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'mina-terek-samir-shein.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'mina-terek-samir-shein',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'mina-terek-samir-shein.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '204099991190',
  appId: env.VITE_FIREBASE_APP_ID || '1:204099991190:web:ba4e9d9a848e64a3f474b7'
}

const missingEnvKeys = FIREBASE_ENV_KEYS.filter((key) => !env[key])

if (missingEnvKeys.length > 0) {
  console.warn(
    `[firebase] Missing ${missingEnvKeys.length} of ${FIREBASE_ENV_KEYS.length} environment values: ` +
    `${missingEnvKeys.join(', ')}\n` +
    `[firebase] Falling back to built-in defaults, so the app is pointed at project ` +
    `"${firebaseConfig.projectId}". Add the missing keys to .env.local to switch projects.`
  )
}

/* ── Firestore collections ─────────────────────────────────────────────── */

/**
 * Shared with the Admin dashboard - both apps must agree on these names or
 * the storefront reads data the admin never writes (and vice versa).
 *
 * Products and orders are deliberately absent: they are per-currency and go
 * through productsCollection() / CURRENCY.orderCollection in ./currency, which
 * is the single place that knows those names.
 */
export const COLLECTIONS = {
  mobileOrders: 'mobile_orders',
  coupons: 'egp_coupons',
  governorateCosts: 'egp_governorate_costs',
  settings: 'egp_settings'
}

/* ── Currency ──────────────────────────────────────────────────────────── */

/**
 * Products live in a per-currency collection; the mapping itself lives in
 * ./currency so there is exactly one place that knows the names. Unknown
 * currencies fall back to the default rather than querying a collection
 * that does not exist.
 */
export function productsCollection(currency = DEFAULT_CURRENCY) {
  return getCurrencyConfig(currency).collection
}

export { DEFAULT_CURRENCY }