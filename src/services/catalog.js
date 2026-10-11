// Catalog reads for the fashion data model.
//
// Two paths, in order:
//   1. the catalogue snapshot served by /api/catalog — a handful of documents
//      for the whole store, cached locally by version;
//   2. direct Firestore reads — the fallback when the snapshot has not been
//      built yet (the route answers 503 SNAPSHOT_NOT_BUILT), and for the live
//      per-variant stock checks the snapshot deliberately does not carry.
//
// Every function returns plain objects with the document `id` merged in, so
// callers never have to remember which fields live on the snapshot versus the
// data. Archived/draft products are filtered at the query, not in the UI, so a
// stale page cannot accidentally show them.

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
  return snap.docs.map(withId);
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

// The product page reads the live product + variants through the API so a
// cached card can never contradict the page the shopper is about to buy from.
export async function fetchProduct(id) {
  if (!id) return null;

  try {
    const product = await getJson(`/product?id=${encodeURIComponent(id)}`);
    return { variants: [], ...product };
  } catch {
    // Snapshot route unavailable: fall back to the documents the rules still
    // allow the storefront to read.
    const snap = await getDoc(doc(db, "products_egp", id));
    if (!snap.exists() || snap.data().status !== "active") return null;

    const variants = await getDocs(collection(db, "products_egp", id, "variants"));
    return { id, ...snap.data(), variants: variants.docs.map(withId) };
  }
}

// Live stock for one variant: the snapshot's totalStock is a lagging
// aggregate, so availability on the product page and the bag reads this.
export async function fetchVariantStock(productId, variantId) {
  const snap = await getDoc(doc(db, "products_egp", productId, "variants", variantId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
