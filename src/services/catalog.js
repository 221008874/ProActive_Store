// Catalog reads for the fashion data model.
//
// Two paths, in order:
//   1. the catalogue snapshot served by /api/catalog — a handful of documents
//      for the whole store, cached locally by version;
//   2. direct Firestore reads — a last resort for a store that has never built
//      a snapshot at all.
//
// A snapshot that resolves is authoritative *even when it is empty*: "the store
// has published nothing yet" is an answer, not a failure. Only a missing
// snapshot escalates to the Firestore fallback, and a failure there is reported
// as a CatalogError with a short code. See docs/CATALOG_DIAGNOSIS.md for how
// collapsing those two cases produced an error state over an empty catalogue.
//
// Every function returns plain objects with the document `id` merged in, so
// callers never have to remember which fields live on the snapshot versus the
// data. Archived/draft products are filtered at the query, not in the UI, so a
// stale page cannot accidentally show them.
//
// Everything a visitor browses resolves from the snapshot, including the
// product page's variants: a shopper opening a product costs no Firestore read
// at all. Live documents are only consulted when the snapshot cannot answer
// (a product published since the last build), and money is always re-checked
// server-side at checkout.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db } from "../services/firebase";
import { getJson } from "../services/api";
import { loadCachedSnapshot, storeSnapshot } from "../services/snapshotStore";

const withId = (d) => ({ id: d.id, ...d.data() });

/** A failure a shopper (and the owner) can act on. `code` is short and stable
 *  so it can be shown next to the Retry button and quoted in a bug report. */
export class CatalogError extends Error {
  constructor(code, { status = null, detail = null, cause = null } = {}) {
    super(code);
    this.name = "CatalogError";
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.cause = cause;
  }
}

const catalogCode = (err) => {
  // api.js already speaks in short codes (E-API-404, E-CATALOG-503, …). Anything
  // else is a Firestore/SDK error, which has its own stable codes.
  const raw = err?.code;
  if (typeof raw === "string" && /^[A-Z0-9-]+$/.test(raw)) return raw;
  return "E-CATALOG-READ";
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch the catalogue with exponential backoff.
 *
 * Retries only what is worth retrying — a network blip, a timeout, a 5xx, a
 * 429. A 404 (the function is not deployed) or a 200 that is not JSON (the SPA
 * fallback answered) will fail identically three times, and burning 7 seconds
 * to reach the same error state is a worse experience than failing fast.
 *
 * @param fn        the operation to run
 * @param attempts  total tries, including the first
 * @param onRetry   called with (attempt, delayMs) before each retry
 */
export async function withBackoff(fn, { attempts = 3, baseMs = 1000, onRetry } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = !err?.status || err.status >= 500 || err.code === "E-API-NETWORK" || err.code === "E-API-TIMEOUT";
      if (attempt === attempts - 1 || !retryable) break;
      const delay = baseMs * 2 ** attempt; // 1s, 2s, 4s
      onRetry?.(attempt + 1, delay);
      await sleep(delay);
    }
  }
  throw new CatalogError(catalogCode(lastError), {
    status: lastError?.status ?? null,
    detail: lastError?.preview ?? lastError?.detail ?? null,
    cause: lastError
  });
}

// The snapshot plus where it came from.
//
// The snapshot plus where it came from.
//
//   { snapshot, source: "network" }  fresh from /api/catalog
//   { snapshot, source: "current" }  the IndexedDB copy, confirmed by a 304
//   { snapshot, source: "cache"   }  the IndexedDB copy after a network failure
//   { snapshot: null, source: "none" } nothing usable anywhere
//
// `source` exists so the UI can say "showing saved items" instead of pretending
// stale data is live, and — more importantly — so callers can tell "the store
// published nothing" (snapshot present, products empty) apart from "the
// snapshot could not be fetched at all" (snapshot null). Collapsing those two
// is what made an empty catalogue render as a load failure.
//
// Only "cache" is stale. "current" is the server confirming the local copy is
// up to date, which is live data that happened not to need downloading.
async function readSnapshot({ useCache = true, attempts = 3, onRetry } = {}) {
  let cached = null;
  try {
    cached = useCache ? await loadCachedSnapshot() : null;
  } catch {
    cached = null;
  }

  // The retry wraps the NETWORK CALL, not this function. An earlier version
  // wrapped `readSnapshot` itself — and because this function catches the
  // network error and turns it into a return value, withBackoff saw a
  // successful call every time and never retried. The backoff has to be
  // somewhere that can actually observe the failure.
  const outcome = await withBackoff(
    async () => {
      const headers = cached?.version ? { "if-none-match": `"catalog-${cached.version}"` } : {};
      const response = await getJson("/catalog", { headers });

      // 304: the server confirms the cached copy IS the current one. That is
      // not the same as falling back to a cache after a failure — the data is
      // live — so it gets its own source rather than being lumped in with
      // "cache", which the UI would otherwise label "showing saved items".
      if (response.__notModified) {
        return { snapshot: cached ?? null, source: cached ? "current" : "none" };
      }

      if (response && typeof response === "object" && "products" in response) {
        await storeSnapshot(response);
        return { snapshot: response, source: "network" };
      }
      // 200 with a body that is not a snapshot: treat it as "no answer", not
      // as an empty catalogue, so the caller falls through to the fallback.
      return { snapshot: null, source: "none" };
    },
    { attempts, onRetry }
  ).catch((err) => ({ error: err }));

  // The network failed (or answered with something unusable). A cached snapshot
  // beats an error state: a shopper on a flaky connection can still browse, and
  // the "showing saved items" note tells them why the prices may be stale.
  if (outcome?.snapshot) return outcome;
  if (cached) return { snapshot: cached, source: "cache" };
  if (outcome?.error) return { snapshot: null, source: "none", error: outcome.error };
  return { snapshot: null, source: "none" };
}

// Active products for the grid: the snapshot's card data is exactly what the
// filter UI consumes (price, colours, sizes, totalStock, searchText).
//
// A snapshot that resolves — even with an empty `products` array — is the
// authoritative answer. Only when no snapshot could be obtained at all does the
// direct Firestore read run, and a failure there is reported as a CatalogError
// rather than thrown raw. See docs/CATALOG_DIAGNOSIS.md.
export async function fetchActiveProducts({ onRetry, attempts = 3 } = {}) {
  const { snapshot, source, error } = await readSnapshot({ attempts, onRetry });

  if (snapshot) return { products: snapshot.products ?? [], stale: source === "cache" };
  if (!error) return { products: [], stale: false };

  // Last resort: the store has never built a snapshot. Try the documents, and
  // if that is denied too, say so with a code instead of leaking the SDK error.
  try {
    const snap = await getDocs(
      query(collection(db, "products_egp"), where("status", "==", "active"))
    );
    if (snap.docs.length) return { products: snap.docs.map(withId), stale: false };
  } catch (err) {
    throw new CatalogError(catalogCode(error) || "E-CATALOG-READ", {
      status: error?.status ?? null,
      detail: err?.code ?? null,
      cause: error
    });
  }

  throw new CatalogError(catalogCode(error), { status: error?.status ?? null, cause: error });
}

export async function fetchCategories() {
  const { snapshot } = await readSnapshot();
  if (snapshot?.categories) return snapshot.categories;

  try {
    const snap = await getDocs(
      query(
        collection(db, "categories"),
        where("active", "==", true),
        orderBy("order", "asc")
      )
    );
    return snap.docs.map(withId);
  } catch {
    return [];
  }
}

export async function fetchCollections() {
  const { snapshot } = await readSnapshot();
  if (snapshot?.collections) return snapshot.collections;

  try {
    const snap = await getDocs(
      query(
        collection(db, "collections"),
        where("active", "==", true),
        orderBy("order", "asc")
      )
    );
    return snap.docs.map(withId);
  } catch {
    return [];
  }
}

// A collection doc stores a manual productIds list. This resolves them to
// active products, preferring the snapshot and silently dropping ids that
// were archived or deleted.
export async function fetchProductsByIds(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const unique = [...new Set(ids)];
  const { snapshot } = await readSnapshot();

  if (snapshot?.products) {
    const byId = new Map(snapshot.products.map((p) => [p.id, p]));
    return unique.map((id) => byId.get(id)).filter(Boolean);
  }

  const results = await Promise.all(
    unique.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, "products_egp", id));
        return snap.exists() && snap.data().status === "active" ? { id, ...snap.data() } : null;
      } catch {
        return null;
      }
    })
  );

  const byId = new Map(results.filter(Boolean).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

// One product from the snapshot, by id or by slug, with its variants. Returns
// null when the snapshot does not carry it (published since the last build, or
// archived), which is the caller's cue to fall back.
export function findInSnapshot(snapshot, idOrSlug) {
  if (!snapshot?.products?.length || !idOrSlug) return null;
  const key = String(idOrSlug).trim().toLowerCase();
  return (
    snapshot.products.find((p) => p.id === key) ??
    snapshot.products.find((p) => (p.slug ?? "").toLowerCase() === key) ??
    null
  );
}

// The product page. The snapshot carries variants, so this is the path a
// visitor takes and it reads no Firestore documents at all. It falls back to
// /api/product (live, CDN-cached) when the snapshot cannot answer, and to
// direct reads only when that route is unreachable too.
export async function fetchProduct(id) {
  if (!id) return null;

  const { snapshot } = await readSnapshot();
  const fromSnapshot = findInSnapshot(snapshot, id);
  if (fromSnapshot) return { ...fromSnapshot, variants: fromSnapshot.variants ?? [] };

  try {
    const product = await getJson(`/product?id=${encodeURIComponent(id)}`);
    return { variants: [], ...product };
  } catch {
    // Snapshot and API both unavailable: fall back to the documents the rules
    // still allow the storefront to read. Wrapped because the read can be
    // denied, and a product page must render "not found", not crash.
    try {
      const snap = await getDoc(doc(db, "products_egp", id));
      if (!snap.exists() || snap.data().status !== "active") return null;

      const variants = await getDocs(collection(db, "products_egp", id, "variants"));
      return { id, ...snap.data(), variants: variants.docs.map(withId) };
    } catch {
      return null;
    }
  }
}

// Delivery costs and per-governorate minimums, from the snapshot's governorate
// list. The bag would otherwise read all 27 governorate documents on every
// visit, which is the single largest read cost in checkout.
export async function fetchGovernorates() {
  const { snapshot } = await readSnapshot();
  return snapshot?.governorates ?? [];
}

// Public store settings (ordersOpen kill switch, free-shipping threshold,
// minimum order fallback), from the snapshot.
export async function fetchPublicSettings() {
  const { snapshot } = await readSnapshot();
  return snapshot?.settings ?? {};
}

/* -------------------------------------------------------------------------
 * Taxonomy
 *
 * CANONICAL_SIZES is the vocabulary, and it is the single source of truth for
 * both the built-in fallback and the ordering of whatever the catalogue
 * actually carries.
 *
 * "XXL" and "2XL" are the same garment size wearing two hats. Offering both
 * splits one size bucket into two facets that filter identically, which reads
 * as a bug to a shopper ("are these different?") and as a duplicate to
 * everyone else. Canonical is XXL. If real variants arrive labelled "2XL", they
 * are folded onto XXL rather than shown twice.
 * ---------------------------------------------------------------------- */

export const CANONICAL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

// Aliases -> canonical token.
const SIZE_ALIASES = { '2XL': 'XXL', '2xl': 'XXL', 'XXXL': '3XL', '4XL': '3XL' };

/** Fold a raw size label onto its canonical token. */
export const canonicalSize = (size) => {
  const raw = String(size ?? '').trim();
  if (!raw) return '';
  return SIZE_ALIASES[raw] ?? SIZE_ALIASES[raw.toUpperCase()] ?? raw.toUpperCase();
};

/** Sort any list of sizes into canonical order; unknown labels keep to the end,
 *  alphabetically, so a stray label is still visible and still fixable.
 *
 *  Folding happens BEFORE the dedupe. The other order looks identical and is
 *  not: a Set of ['2XL', 'XXL'] holds two entries, both of which then map to
 *  'XXL', so the facet offers XXL twice — precisely the duplicate this function
 *  exists to remove. */
export function sortSizesCanonical(sizes) {
  return [...new Set([...sizes].map(canonicalSize).filter(Boolean))].sort((a, b) => {
    const ia = CANONICAL_SIZES.indexOf(a);
    const ib = CANONICAL_SIZES.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// Built-in default taxonomy for when the settings document is missing. It
// matches egp_settings/taxonomy exactly, so a store with no settings document
// still renders the same facet vocabulary as one that has them.
export const DEFAULT_TAXONOMY = {
  sizes: CANONICAL_SIZES,
  colors: [
    { id: 'black', name: { en: 'Black', ar: 'أسود' }, hex: '#121212' },
    { id: 'white', name: { en: 'White', ar: 'أبيض' }, hex: '#FFFFFF' },
    { id: 'beige', name: { en: 'Beige', ar: 'بيج' }, hex: '#F4F2EE' },
    { id: 'navy', name: { en: 'Navy', ar: 'كحلي' }, hex: '#1F4E8C' },
    { id: 'olive', name: { en: 'Olive', ar: 'زيتي' }, hex: '#6B8E23' },
    { id: 'burgundy', name: { en: 'Burgundy', ar: 'عنابي' }, hex: '#800020' },
    { id: 'grey', name: { en: 'Grey', ar: 'رمادي' }, hex: '#8A8780' },
    { id: 'blue', name: { en: 'Blue', ar: 'أزرق' }, hex: '#3A7BD5' }
  ]
}

// A colour that light enough that its edge disappears against paper still needs
// to be tellable from the next one. Re-exported here so callers that already
// import the taxonomy do not need a second import path.
export { swatchNeedsBorder } from "../utils/color";

// The size and colour vocabulary the filters offer, from egp_settings/taxonomy
// via the snapshot. It is a vocabulary, not a stock list: a size can be offered
// before anything is cut in it, which is why the shop merges it with what the
// catalogue actually carries rather than using either alone.
export async function fetchTaxonomy() {
  const { snapshot } = await readSnapshot();
  const taxonomy = snapshot?.taxonomy ?? {};
  return {
    // Canonicalised here as well as in the fallback, so a settings document
    // that still carries the old "2XL" list cannot reintroduce the duplicate.
    sizes: taxonomy.sizes?.length ? sortSizesCanonical(taxonomy.sizes) : CANONICAL_SIZES,
    colors: taxonomy.colors?.length ? taxonomy.colors : DEFAULT_TAXONOMY.colors
  }
}

