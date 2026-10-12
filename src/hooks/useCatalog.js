// Client-side catalog filtering.
//
// Intended for catalogs under ~2000 products: fetch once (the app already
// enables IndexedDB persistence, so the cache survives reloads) and filter in
// memory. Split filterProducts into a server query once that ceiling is passed.

import { useCallback, useEffect, useState } from "react";
import { fetchActiveProducts } from "../services/catalog";

// Three mutually exclusive states, plus a flag for "these came from the cache":
//
//   loading  the grid shows skeletons
//   error    the catalogue could not be read at all (has .code, e.g. E-CATALOG-…)
//   empty    the catalogue was read successfully and contains no products
//
// `stale` is orthogonal: the products are there but they came from IndexedDB, so
// the page says "showing saved items" instead of implying they are live.
//
// The distinction between `error` and `empty` is the whole point of this hook.
// An empty catalogue that renders as an error looks like an outage to a shopper
// and to whoever is on the other end of the support request; one that renders
// as "nothing here yet" is simply true.
export function useCatalog({ attempts = 3 } = {}) {
  // One state object rather than four, because the four fields are only ever
  // written together: a settled load has a product list and no error, a failed
  // one has an error and no products. Splitting them let them disagree (a stale
  // product list next to a fresh error), which is exactly the class of bug the
  // tri-state was introduced to remove.
  const [result, setResult] = useState({
    products: [],
    error: null,
    stale: false,
    settled: false
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // fetchActiveProducts already retries transient failures with exponential
    // backoff (1s, 2s, 4s) before it gives up, so a single blip never reaches
    // the shopper as an error state.
    fetchActiveProducts({ attempts })
      .then(({ products: list, stale: fromCache }) => {
        if (cancelled) return;
        setResult({ products: list ?? [], error: null, stale: Boolean(fromCache), settled: true });
      })
      .catch((e) => {
        if (cancelled) return;
        setResult({
          products: [],
          error: e ?? { code: "E-CATALOG-UNKNOWN" },
          stale: false,
          settled: true
        });
      });

    return () => { cancelled = true; };
  }, [attempt, attempts]);

  // `loading` is derived from `settled` rather than stored, so "start loading"
  // and "the last load finished" can never drift apart. The reset happens in
  // the click handler (an event, not an effect) precisely so React does not
  // have to cascade a render.
  const retry = useCallback(() => {
    setResult({ products: [], error: null, stale: false, settled: false });
    setAttempt((n) => n + 1);
  }, []);

  return {
    products: result.products,
    loading: !result.settled,
    error: result.error,
    stale: result.stale,
    retry
  };
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
      // The snapshot carries a normalised searchText (Arabic + English
      // folded); documents read directly fall back to the serialised pair.
      const haystack = (p.searchText || JSON.stringify([p.title, p.tags ?? []])).toLowerCase()
      if (!haystack.includes(query)) return false
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