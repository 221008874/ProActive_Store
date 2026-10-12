// Geocoding proxy for the delivery map.
//
// The public Nominatim instance allows about one request per second for the
// whole application, requires an identifying User-Agent, forbids
// search-as-you-type, expects caching, and requires OSM attribution
// (https://operations.osmfoundation.org/policies/nominatim/). All four rules
// are enforced here rather than in the browser:
//
//   1 req/s   a module-level limiter spaces outbound calls on each instance
//   UA        a real contact string, not a browser default
//   caching   results live in geocode_cache for 30 days, so repeat queries
//             (and every visitor of the same area) cost nothing
//   submit    the UI only searches on submit/Enter — see CartPage
//
// For real volume, swap the two upstream functions for a paid geocoder
// (Google / Mapbox / LocationIQ); nothing else changes.

import { createHash } from "node:crypto";
import { getDb } from "./serverDb.js";

const UPSTREAM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "ProActiveStore/1.0 (delivery address search; contact: store-ops@proactive.example)";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 1100;

let lastStartedAt = 0;
let queue = Promise.resolve();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Serialises outbound calls AND enforces the minimum spacing between them,
// so a burst of visitors cannot turn into a burst of Nominatim requests.
export function withNominatimLimit(task) {
  const result = queue.then(async () => {
    const since = Date.now() - lastStartedAt;
    if (lastStartedAt > 0 && since < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - since);
    }
    lastStartedAt = Date.now();
    return task();
  });
  queue = result.catch(() => {});
  return result;
}

export function cacheKey(prefix, value) {
  return createHash("sha256").update(`${prefix}:${String(value).trim().toLowerCase()}`).digest("hex");
}

export function normalizeQuery(q) {
  return String(q ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeLatLng(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  // Five decimals is roughly a metre: good enough for a delivery pin.
  return `${la.toFixed(5)},${lo.toFixed(5)}`;
}

async function readCache(db, key, now) {
  const snap = await db.doc(`geocode_cache/${key}`).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (now - Number(data.at ?? 0) > CACHE_TTL_MS) return null;
  return data.result ?? null;
}

async function writeCache(db, key, result, now) {
  try {
    // expireAt matches the read-side TTL, so a TTL policy on this field reaps
    // the entry at exactly the moment it stops being useful - the cache cannot
    // grow without bound against the storage quota (see README).
    await db.doc(`geocode_cache/${key}`).set({
      at: now,
      expireAt: new Date(now + CACHE_TTL_MS),
      result
    });
  } catch (error) {
    // A cache write failure must never fail the shopper's search.
    console.error("geocode cache write failed:", error.message);
  }
}

async function cachedUpstream(db, key, task) {
  const now = Date.now();
  const hit = await readCache(db, key, now).catch(() => null);
  if (hit) return { result: hit, cached: true };

  const result = await withNominatimLimit(task);
  await writeCache(db, key, result, now);
  return { result, cached: false };
}

export async function geocodeSearch(query, { limit = 5 } = {}) {
  const db = getDb();
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  const key = cacheKey("search", normalized);
  const { result } = await cachedUpstream(db, key, async () => {
    const url = `${UPSTREAM}/search?format=jsonv2&q=${encodeURIComponent(normalized)}&countrycodes=eg&limit=${limit}&addressdetails=0`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "ar,en" } });
    if (!response.ok) throw new Error(`geocoder answered ${response.status}`);
    const items = await response.json();
    return items.map((item) => ({
      display_name: item.display_name,
      lat: Number(item.lat),
      lon: Number(item.lon)
    }));
  });

  return result;
}

export async function reverseGeocode(lat, lng) {
  const db = getDb();
  const normalized = normalizeLatLng(lat, lng);
  if (!normalized) return null;

  const key = cacheKey("reverse", normalized);
  const { result } = await cachedUpstream(db, key, async () => {
    const url = `${UPSTREAM}/reverse?format=jsonv2&lat=${normalized.split(",")[0]}&lon=${normalized.split(",")[1]}&addressdetails=1`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "ar,en" } });
    if (!response.ok) throw new Error(`geocoder answered ${response.status}`);
    const item = await response.json();
    return { display_name: item.display_name ?? null, lat: Number(item.lat), lon: Number(item.lon) };
  });

  return result;
}
