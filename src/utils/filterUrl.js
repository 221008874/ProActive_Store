// Shop filters <-> URL query.
//
// The filter sheet's state lives in the URL so a filtered view is shareable,
// survives a reload, and makes the back button undo a filter rather than leave
// the page. Pure functions, no React, so the rule is testable.

// Canonical key order. Anything not in this list is dropped on the way back in,
// so a hand-edited URL cannot smuggle state the sheet cannot show.
const ORDER = ["category", "gender", "sale", "q", "sort", "sizes", "colors", "min", "max", "stock"];
const SORTS = ["newest", "bestselling", "priceAsc", "priceDesc"];
const LIST_KEYS = ["sizes", "colors"];

/**
 * searchParams (a URLSearchParams or a plain object) -> filter shape for
 * filterProducts(). Missing keys fall back to the defaults.
 */
export function filtersFromParams(params) {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params ?? {});
  const get = (k) => p.get(k);

  const list = (k) => (p.getAll(k).length ? p.getAll(k) : [get(k)].filter(Boolean));
  const num = (v) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const sort = get("sort");

  return {
    categoryId: get("category") ?? "",
    gender: get("gender") ?? "",
    sizes: list("sizes"),
    colors: list("colors"),
    minPrice: num(get("min")),
    maxPrice: num(get("max")),
    onSale: get("sale") === "1",
    inStockOnly: get("stock") === "1",
    q: get("q") ?? "",
    sort: SORTS.includes(sort) ? sort : "newest"
  };
}

/**
 * filter shape -> the params that represent it. Only non-default values are
 * written, so the URL stays short and reads as the shopper's actual choices.
 */
export function paramsFromFilters(filters) {
  const p = new URLSearchParams();
  const f = { ...filters };

  if (f.categoryId) p.set("category", f.categoryId);
  if (f.gender) p.set("gender", f.gender);
  if (f.q?.trim()) p.set("q", f.q.trim());
  if (SORTS.includes(f.sort) && f.sort !== "newest") p.set("sort", f.sort);
  if (f.onSale) p.set("sale", "1");
  if (f.inStockOnly) p.set("stock", "1");
  if (f.minPrice != null) p.set("min", String(f.minPrice));
  if (f.maxPrice != null) p.set("max", String(f.maxPrice));
  for (const k of LIST_KEYS) {
    for (const v of f[k] ?? []) p.append(k, v);
  }
  return p;
}

/** How many filters the shopper has actually narrowed by (excludes sort and query). */
export function activeFilterCount(filters) {
  let n = 0;
  if (filters.categoryId) n++;
  if (filters.gender) n++;
  if (filters.onSale) n++;
  if (filters.inStockOnly) n++;
  if (filters.minPrice != null || filters.maxPrice != null) n++;
  n += (filters.sizes ?? []).length;
  n += (filters.colors ?? []).length;
  return n;
}

/** Human-readable chips for the active-filter scroller under the toolbar. */
export function activeFilterChips(filters, { resolve = {} } = {}) {
  const chips = [];
  const count = activeFilterCount(filters);

  if (filters.categoryId) chips.push({ key: "category", label: resolve.category ?? filters.categoryId });
  if (filters.gender) chips.push({ key: "gender", label: resolve.gender ?? filters.gender });
  for (const s of filters.sizes ?? []) chips.push({ key: `sizes:${s}`, label: resolve.size?.(s) ?? s, remove: { kind: "list", key: "sizes", value: s } });
  for (const c of filters.colors ?? []) chips.push({ key: `colors:${c}`, label: resolve.color?.(c) ?? c, remove: { kind: "list", key: "colors", value: c } });
  if (filters.minPrice != null || filters.maxPrice != null) {
    const label = filters.maxPrice == null
      ? `${resolve.from ?? "from"} ${filters.minPrice}`
      : `${filters.minPrice ?? 0} – ${filters.maxPrice}`;
    chips.push({ key: "price", label, remove: { kind: "keys", keys: ["min", "max"] } });
  }
  if (filters.onSale) chips.push({ key: "sale", label: resolve.sale ?? "On sale", remove: { kind: "key", key: "sale" } });
  if (filters.inStockOnly) chips.push({ key: "stock", label: resolve.stock ?? "In stock", remove: { kind: "key", key: "stock" } });

  return { chips, count };
}

/** Apply one chip's `remove` instruction to the params, returning new params. */
export function removeChip(params, chip) {
  const p = new URLSearchParams(params);
  const r = chip.remove;
  if (!r) {
    p.delete(chip.key);
  } else if (r.kind === "key") {
    p.delete(r.key);
  } else if (r.kind === "keys") {
    for (const k of r.keys) p.delete(k);
  } else if (r.kind === "list") {
    const kept = p.getAll(r.key).filter((v) => v !== r.value);
    p.delete(r.key);
    for (const v of kept) p.append(r.key, v);
  }
  return p;
}

export { SORTS };
