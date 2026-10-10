// Client-side catalog filtering.
//
// Intended for catalogs under ~2000 products: fetch once (the app already
// enables IndexedDB persistence, so the cache survives reloads) and filter in
// memory. Split filterProducts into a server query once that ceiling is passed.

import { useEffect, useState } from "react";
import { fetchActiveProducts } from "../services/catalog";

export function useCatalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchActiveProducts()
      .then((list) => {
        if (!cancelled) setProducts(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { products, loading, error };
}

const seconds = (ts) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : Number(ts) || 0);

export const SORTERS = {
  newest: (a, b) => seconds(b.createdAt) - seconds(a.createdAt),
  priceAsc: (a, b) => (a.price ?? 0) - (b.price ?? 0),
  priceDesc: (a, b) => (b.price ?? 0) - (a.price ?? 0),
  bestselling: (a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0)
};

export const DEFAULT_FILTERS = {
  categoryId: "",
  gender: "",
  sizes: [],
  colors: [],
  minPrice: null,
  maxPrice: null,
  onSale: false,
  inStockOnly: false,
  q: "",
  sort: "newest"
};

export function filterProducts(products, filters = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const query = f.q.trim().toLowerCase();

  const out = products.filter((p) => {
    if (f.categoryId && !(p.categoryPath ?? []).includes(f.categoryId)) return false;
    if (f.gender && p.gender !== f.gender) return false;
    if (f.sizes?.length && !f.sizes.some((s) => (p.availableSizes ?? []).includes(s))) return false;
    if (f.colors?.length && !f.colors.some((c) => (p.availableColors ?? []).includes(c))) return false;
    if (f.minPrice != null && (p.price ?? 0) < f.minPrice) return false;
    if (f.maxPrice != null && (p.price ?? 0) > f.maxPrice) return false;
    if (f.onSale && !(p.discountPct > 0)) return false;
    if (f.inStockOnly && !(p.totalStock > 0)) return false;

    if (query) {
      // titles are {ar,en} objects, so match against the serialised pair
      const haystack = JSON.stringify([p.title, p.tags ?? []]).toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  return out.sort(SORTERS[f.sort] ?? SORTERS.newest);
}

// Variant helpers shared by the product page and the cart.
export const variantIdFor = (colorId, size) => `${colorId}_${size}`;

export function findVariant(product, colorId, size) {
  if (!product?.variants) return null;
  return product.variants.find((v) => v.colorId === colorId && v.size === size) ?? null;
}

export function isVariantPurchasable(variant) {
  return Boolean(variant && variant.active !== false && variant.stock > 0);
}

export function availableSizesFor(product, colorId) {
  if (!product?.variants) return [];
  return [...new Set(product.variants.filter((v) => v.colorId === colorId).map((v) => v.size))];
}

export function availableColorsFor(product) {
  if (!product?.variants) return [];
  return [...new Set(product.variants.filter((v) => v.active !== false && v.stock > 0).map((v) => v.colorId))];
}