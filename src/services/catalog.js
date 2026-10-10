// Catalog reads for the fashion data model.
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

const withId = (d) => ({ id: d.id, ...d.data() });

export async function fetchActiveProducts() {
  const snap = await getDocs(
    query(collection(db, "products_egp"), where("status", "==", "active"))
  );
  return snap.docs.map(withId);
}

export async function fetchProduct(id) {
  if (!id) return null;

  const snap = await getDoc(doc(db, "products_egp", id));
  if (!snap.exists() || snap.data().status !== "active") return null;

  const variants = await getDocs(collection(db, "products_egp", id, "variants"));
  return { id, ...snap.data(), variants: variants.docs.map(withId) };
}

export async function fetchCategories() {
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
// active products, silently dropping ids that were archived or deleted.
export async function fetchProductsByIds(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const unique = [...new Set(ids)];
  const results = await Promise.all(
    unique.map(async (id) => {
      const snap = await getDoc(doc(db, "products_egp", id));
      return snap.exists() && snap.data().status === "active" ? { id, ...snap.data() } : null;
    })
  );

  const byId = new Map(results.filter(Boolean).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

// Live stock for one variant. The product page shows real availability rather
// than the denormalised totalStock, which the admin only refreshes on save.
export async function fetchVariantStock(productId, variantId) {
  const snap = await getDoc(doc(db, "products_egp", productId, "variants", variantId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}