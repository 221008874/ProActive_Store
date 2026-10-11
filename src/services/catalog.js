// Catalog reads for the fashion data model.
//
// Two paths, in order:
//   1. the catalogue snapshot served by /api/catalog — a handful of documents
//      for the whole store, cached locally by version;
//   2. direct Firestore reads — the fallback when the snapshot has not been
//      built yet (the route answers 503 SNAPSHOT_NOT_BUILT).
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

// The snapshot, or null when there is nothing usable. A 304 means the cached
// copy is current, so it is returned as-is; a 503 means the store has never
// built one, and the caller falls back to reading documents directly.
async function readSnapshot({ useCache = true } = {}) {
  try {
    const cached = useCache ? await loadCachedSnapshot() : null;
    const headers = cached?.version ? { "if-none-match": `"catalog-${cached.version}"` } : {};

    const response = await getJson("/catalog", { headers });
    if (response.__notModified) return cached;

    if (response.version) {
      await storeSnapshot(response);
      return response;
    }
    return cached;
  } catch {
    return useCache ? loadCachedSnapshot() : null;
  }
}

// Active products for the grid: the snapshot's card data is exactly what the
// filter UI consumes (price, colours, sizes, totalStock, searchText).
export async function fetchActiveProducts() {
  const snapshot = await readSnapshot();
  if (snapshot?.products?.length) return snapshot.products;

  const snap = await getDocs(
    query(collection(db, "products_egp"), where("status", "==", "active"))
  );
  if (snap.docs.length) return snap.docs.map(withId);

  // TEMPORARY, until PROACTIVE_FASHION_MIGRATION.md has been run against the
  // live database: documents written before the status field existed carry no
  // status at all, so the "status == active" query matches nothing and the shop
  // renders an empty grid over a full catalogue. An empty result therefore gets
  // one second look with a missing status read as active.
  //
  // Bounded to 200 documents: this path only runs when nothing is published, so
  // the cost is paid once per visit and never on a stocked catalogue. Delete it
  // with the migration.
  const legacy = await getDocs(query(collection(db, "products_egp")).limit(200));
  return legacy.docs.map(withId).filter((p) => p.status == null || p.status === "active");
}

export async function fetchCategories() {
  const snapshot = await readSnapshot();
  if (snapshot?.categories?.length) return snapshot.categories;

  const snap = await getDocs(
    query(
      collection(db, "categories"),
      where("active", "==", true),
      orderBy("order", "asc")
    )
  );
  return snap.docs.map(withId);
}

export async function fetchCollections() {
  const snapshot = await readSnapshot();
  if (snapshot?.collections?.length) return snapshot.collections;

  const snap = await getDocs(
    query(
      collection(db, "collections"),
      where("active", "==", true),
      orderBy("order", "asc")
    )
  );
  return snap.docs.map(withId);
}

// A collection doc stores a manual productIds list. This resolves them to
// active products, preferring the snapshot and silently dropping ids that
// were archived or deleted.
export async function fetchProductsByIds(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const unique = [...new Set(ids)];

  const snapshot = await readSnapshot();
  if (snapshot?.products?.length) {
    const byId = new Map(snapshot.products.map((p) => [p.id, p]));
    return unique.map((id) => byId.get(id)).filter(Boolean);
  }

  const results = await Promise.all(
    unique.map(async (id) => {
      const snap = await getDoc(doc(db, "products_egp", id));
      return snap.exists() && snap.data().status === "active" ? { id, ...snap.data() } : null;
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

  const snapshot = await readSnapshot();
  const fromSnapshot = findInSnapshot(snapshot, id);
  if (fromSnapshot) return { ...fromSnapshot, variants: fromSnapshot.variants ?? [] };

  try {
    const product = await getJson(`/product?id=${encodeURIComponent(id)}`);
    return { variants: [], ...product };
  } catch {
    // Snapshot and API both unavailable: fall back to the documents the rules
    // still allow the storefront to read.
    const snap = await getDoc(doc(db, "products_egp", id));
    if (!snap.exists() || snap.data().status !== "active") return null;

    const variants = await getDocs(collection(db, "products_egp", id, "variants"));
    return { id, ...snap.data(), variants: variants.docs.map(withId) };
  }
}

// Delivery costs and per-governorate minimums, from the snapshot's governorate
// list. The bag would otherwise read all 27 governorate documents on every
// visit, which is the single largest read cost in checkout.
export async function fetchGovernorates() {
  const snapshot = await readSnapshot();
  return snapshot?.governorates ?? [];
}

// Public store settings (ordersOpen kill switch, free-shipping threshold,
// minimum order fallback), from the snapshot.
export async function fetchPublicSettings() {
  const snapshot = await readSnapshot();
  return snapshot?.settings ?? {};
}

// Built-in default taxonomy for when the settings document is missing.
const DEFAULT_TAXONOMY = {
  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'],
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

// The size and colour vocabulary the filters offer, from egp_settings/taxonomy
// via the snapshot. It is a vocabulary, not a stock list: a size can be offered
// before anything is cut in it, which is why the shop merges it with what the
// catalogue actually carries rather than using either alone.
export async function fetchTaxonomy() {
  const snapshot = await readSnapshot();
  const taxonomy = snapshot?.taxonomy ?? {};
  return {
    sizes: taxonomy.sizes?.length ? taxonomy.sizes : DEFAULT_TAXONOMY.sizes,
    colors: taxonomy.colors?.length ? taxonomy.colors : DEFAULT_TAXONOMY.colors
  }
}
