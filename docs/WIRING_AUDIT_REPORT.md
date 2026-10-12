# Wiring Audit Report — ProActive Fashion (Store + Admin)

**Date:** 2026-10-11  
**Auditor:** Automated audit + manual code review  
**Scope:** `E:\ProActive_Store` (Store + Server) + `E:\ProActive_Admin` (Admin panel)

---

## Executive Summary

**The Store is NOT fully wired to the Admin.** While individual write paths exist (Admin writes to Firestore, Server validates orders), **the critical catalog propagation path is broken**: Admin writes do not mark the catalog snapshot as dirty, so the Store serves stale data until the manual "Publish changes" button is pressed or the nightly cron runs.

### Critical Finding
> **Admin saves (products, categories, collections, coupons, settings, governorates) do NOT set `egp_settings/catalog.dirty = true`.**  
> The Store reads from a cached catalog snapshot (`/api/catalog` → `catalog_snapshots/*`). The snapshot is only rebuilt when:
> 1. Admin presses "Publish changes" (manual)
> 2. Nightly cron runs (once/day)
> 3. A visitor triggers a partial rebuild on cache miss (30-min cooldown)
>
> **Result:** Any Admin change (new product, price edit, stock update, coupon, category, governorate cost, free-shipping threshold, WhatsApp number) is **invisible in the Store** until manual publish or next cron.

---

## Wiring Matrix (Section 2 of Test Plan)

| # | Admin Action | Written to (Firestore) | Store Consumer | Visible Result | Status | Evidence |
|---|---|---|---|---|---|---|
| 1 | Create/edit product | `products_egp/{id}` + `variants` subcollection | Catalog snapshot → `useCatalog` | ❌ **FAIL** — Product invisible until catalog rebuild | Admin `saveProduct()` writes to `products_egp` but **does not set `egp_settings/catalog.dirty`** | `E:\ProActive_Admin\src\services\products.js:35-83` |
| 2 | Variant stock grid | `products_egp/{id}/variants/{color_size}` + denormalized fields | Product page (live), cards (snapshot) | ❌ **FAIL** — Stock changes invisible until catalog rebuild | Same as #1 — no dirty flag | `E:\ProActive_Admin\src\services\products.js:86-105` |
| 3 | Photos with colour tags | `products_egp/{id}.images[]` | Card, gallery | ❌ **FAIL** — Photos invisible until catalog rebuild | Same as #1 | `E:\ProActive_Admin\src\services\products.js:50-58` |
| 4 | "Publish changes" | Triggers `/api/admin/catalog/rebuild` → full rebuild | `/api/catalog` | ✅ **PASS** — Manual publish works | `E:\ProActive_Store\server\admin\catalog\rebuild.js` |
| 5 | Product status draft/archived | `products_egp.status` | Snapshot | ❌ **FAIL** — Status changes invisible until rebuild | No dirty flag | `E:\ProActive_Admin\src\services\products.js:124-129` |
| 6 | Categories CRUD | `categories/{id}` | Nav, mega-menu, filter | ❌ **FAIL** — Categories invisible until rebuild | `E:\ProActive_Admin\src\services\categories.js:48-61` |
| 7 | Collections | `collections/{id}` | Home hero, tiles, rows | ❌ **FAIL** — Collections invisible until rebuild | `E:\ProActive_Admin\src\services\categories.js:91-108` |
| 8 | Taxonomy (sizes, colors) | `egp_settings/taxonomy` | Filter facets, product form | ❌ **FAIL** — Taxonomy changes invisible until rebuild | `E:\ProActive_Admin\src\services\settings.js` (not implemented) |
| 9 | Free shipping threshold | `egp_settings/general.freeShippingThreshold` | Announcement bar, Bag progress, `placeOrder` | ❌ **FAIL** — Threshold change invisible until rebuild | Admin writes to `egp_settings/general` but Store reads from snapshot | `E:\ProActive_Admin\src\services\settings.js:32-38` |
| 10 | WhatsApp number | `egp_settings/general.whatsapp` | Footer/contact link | ❌ **FAIL** — Number change invisible until rebuild | Same as #9 | `E:\ProActive_Admin\src\services\settings.js:32-38` |
| 11 | Announcement text | `egp_settings/general.announcement` | Announcement bar | ❌ **FAIL** — Text change invisible until rebuild | Same as #9 | `E:\ProActive_Admin\src\services\settings.js:32-38` |
| 11 | Governorate cost/min/active | `egp_governorate_costs/{id}` | Delivery select, shipping line, `placeOrder` | ❌ **FAIL** — Cost changes invisible until rebuild | `E:\ProActive_Admin\src\services\settings.js:53-65` |
| 12 | Create coupons | `egp_coupons/{CODE}` | Bag coupon box, `/coupon/:code`, `placeOrder` | ❌ **FAIL** — Coupons invisible until rebuild | `E:\ProActive_Admin\src\services\coupons.js:14-44` |
| 13 | Disable/delete coupon | `egp_coupons/{CODE}.active` | Same | ❌ **FAIL** — Coupon status invisible until rebuild | `E:\ProActive_Admin\src\services\coupons.js:46-48` |
| 14 | QR sheet | URL `https://<store>/coupon/<CODE>` | Coupon landing | ✅ **PASS** — QR encodes live URL | `E:\ProActive_Admin\src\services\couponSheet.js` |
| 15 | Store: place order | `orders_egp/{id}`, variant stock −qty, coupon `usedCount+1` | Admin Orders, sidebar badge, Overview | ✅ **PASS** — Server-only write, transactional | `E:\ProActive_Store\server\placeOrder.js` |
| 16 | Admin: Confirm→Ship→Deliver | `orders_egp.status`, `statusHistory` | Admin tabs and counts | ✅ **PASS** — Server transaction, restocks on cancel | `E:\ProActive_Store\server\admin\order\status.js` |
| 17 | Admin: Cancel/Return | Variant stock +qty, coupon `usedCount−1` | Store card/size after next publish | ⚠️ **PARTIAL** — Restock works but Store won't see it until rebuild | `E:\ProActive_Store\server\admin\order\status.js:35-48` |
| 18 | Low-stock threshold | `egp_settings/general.lowStockThreshold` | Admin Low stock page, Store "Only N left" | ❌ **FAIL** — Threshold change invisible until rebuild | Not implemented in Admin |
| 19 | Size guides | `size_guides/{id}` | Product page "Size guide" | ✅ **PASS** — Direct read from Firestore (public) | `E:\ProActive_Store\src\pages\ProductDetail.jsx:354-357` |
| 20 | Packing slip/receipt PDF | Reads order from `orders_egp` | Admin print, Store receipt | ✅ **PASS** — Server reads live order | `E:\ProActive_Store\server\_core\orderDocumentCore.js` |
| 21 | Overview numbers | `stats_daily/*` or counts | Admin Overview | ✅ **PASS** — Direct Firestore reads | `E:\ProActive_Admin\src\pages\OverviewPage.jsx:44-46` |
| 22 | Admin sign-in | Firebase Auth `admin` claim | Admin guard, Firestore rules | ✅ **PASS** — Claim-based access | `E:\ProActive_Admin\src\pages\AdminShell.jsx:71-100` |
| 23 | Firestore Rules | `firestore.rules` | Both | ✅ **PASS** — Admin bypass, client writes blocked | `E:\ProActive_Store\firestore.rules:27-34` |

---

## Red Flag Findings (Section 3 of Test Plan)

| Red Flag | Location | Description |
|---|---|---|
| **Missing dirty flag on all Admin writes** | `E:\ProActive_Admin\src\services\products.js`, `categories.js`, `coupons.js`, `settings.js` | Admin writes to Firestore but never sets `egp_settings/catalog.dirty = true`. This is the **single root cause** of the broken wiring. |
| **Store settings read from snapshot, not live** | `E:\ProActive_Store\src\services\settings.js:30-43` | `getSettings()` reads from catalog snapshot (`fetchPublicSettings()`). Admin writes to `egp_settings/general` but Store won't see changes until catalog rebuild. |
| **Governorate costs read from snapshot** | `E:\ProActive_Store\src\services\catalog.js:174-177` | `fetchGovernorates()` reads from snapshot. Admin writes to `egp_governorate_costs` but Store won't see changes. |
| **Coupons read from snapshot** | `E:\ProActive_Store\src\services\catalog.js:190-195` | Coupons are included in snapshot meta. Admin coupon changes invisible until rebuild. |
| **Categories/Collections read from snapshot** | `E:\ProActive_Store\src\services\catalog.js:80-106` | Same pattern — Admin changes invisible. |
| **No auto-publish** | `E:\ProActive_Admin\src\pages\OperationsPage.jsx` | Only manual "Publish changes" button exists. No auto-publish on save. |
| **Settings cache in Store** | `E:\ProActive_Store\src\services\settings.js:23-43` | 5-minute module-level cache. Even if snapshot updated, Store may serve cached settings for 5 min. |
| **Orders collection name mismatch in config** | `E:\ProActive_Store\src\config\index.js:62` | `mobileOrders: 'mobile_orders'` — legacy name still referenced in config (though not used in code). |
| **Client-side money math in Cart** | `E:\ProActive_Store\src\hooks\useCheckout.js:198-208` | `effectiveMinimum`, `shipping` computed client-side from snapshot data. Server re-validates in `placeOrder`, but UI may show stale numbers. |

---

## Evidence Samples

### 1. Admin Product Save — No Dirty Flag
```javascript
// E:\ProActive_Admin\src\services\products.js:35-83
export async function saveProduct(productId, data, variants) {
  // ... validation, batch setup ...
  batch.set(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  // ... variant writes ...
  await batch.commit();
  return ref.id;
  // ❌ MISSING: batch.set(db.doc("egp_settings/catalog"), { dirty: true, dirtyAt: Date.now() }, { merge: true });
}
```

### 2. Store Settings Read from Snapshot
```javascript
// E:\ProActive_Store\src\services\settings.js:30-43
export async function getSettings({ force = false } = {}) {
  if (!force && cached && Date.now() - cachedAt < CACHE_MS) return cached;
  const settings = await fetchPublicSettings();  // ← reads from catalog snapshot
  // ...
}
```

### 3. Catalog Rebuild Only Manual or Nightly
```javascript
// E:\ProActive_Store\server\admin\catalog\rebuild.js:11-32
export default async function handler(req, res) {
  // Only called by Admin "Publish changes" button or nightly cron
  const snapshot = await collectCatalogData(db);
  await writeSnapshot(db, snapshot);
}
```

### 4. Store Reads Governorates from Snapshot
```javascript
// E:\ProActive_Store\src\services\catalog.js:174-177
export async function fetchGovernorates() {
  const snapshot = await readSnapshot();
  return snapshot?.governorates ?? [];  // ← from snapshot, not live Firestore
}
```

---

## Prioritized Fix List

### P0 — Critical (Blocks all Admin→Store propagation)
1. **Add dirty flag to all Admin writes** — Modify `saveProduct`, `saveCategory`, `saveCollection`, `bulkGenerate`, `setCouponActive`, `saveSettings`, `saveGovernorate` to set `egp_settings/catalog.dirty = true` in the same batch/transaction.
2. **Implement auto-publish** — After any Admin write that affects the catalog, call `/api/admin/catalog/rebuild` (debounced ~5s) or set dirty flag and let visitor-path partial rebuild handle it.

### P1 — High (Settings not propagating)
3. **Make Store settings read live or invalidate cache on rebuild** — Either:
   - Make `getSettings()` read `egp_settings/general` directly (bypass snapshot), OR
   - Clear the 5-min module cache in `invalidateSettings()` when catalog rebuild completes (via webhook or polling).

### P2 — Medium (UX polish)
4. **Auto-publish on save** — Debounced rebuild (5s) after any Admin write, with "N changes not published" indicator on the "Publish changes" button.
5. **Distinguish error from empty in Store lists** — Every Store list (Shop, Home, Product) must show error + Retry when snapshot fetch fails, not empty state.
6. **Admin save feedback** — Each Admin form shows saved/error and reloads saved values from Firestore (not local state).

---

## Test Evidence (Section 4 of Test Plan)

| Test | Matrix Row | Result | Evidence |
|---|---|---|---|
| Create product in Admin, check Store Home | #1 | ❌ FAIL | Product not in `useCatalog()` products until manual publish |
| Edit product price in Admin, check Store Shop | #1 | ❌ FAIL | Old price shown until manual publish |
| Update variant stock in Admin, check Product page | #2 | ❌ FAIL | Stock badge shows old value until manual publish |
| Change free shipping threshold in Admin, check Bag | #9 | ❌ FAIL | Threshold unchanged in `useCheckout` until manual publish |
| Change governorate cost in Admin, check Delivery step | #11 | ❌ FAIL | Shipping cost unchanged in `useCheckout` until manual publish |
| Create coupon in Admin, check Bag coupon box | #12 | ❌ FAIL | Coupon not accepted until manual publish |
| Place order in Store, check Admin Orders | #15 | ✅ PASS | Order appears in Admin Orders with correct items |
| Cancel order in Admin, check Store stock | #17 | ⚠️ PARTIAL | Stock restored in Firestore but Store shows old stock until rebuild |

---

## Conclusion

**The Admin and Store are two separate apps that share a Firestore database but not a live data path.** The Admin writes directly to Firestore; the Store reads from a cached catalog snapshot. The **only propagation mechanism is the manual "Publish changes" button** (or nightly cron).

**Fixing the dirty flag on all Admin writes (P0 item 1) will restore automatic propagation** via the existing partial rebuild mechanism (`refreshSnapshotIfStale` with 30-min cooldown). Adding auto-publish (P0 item 2) makes it immediate.

Without this fix, **every Admin change requires a manual publish step**, which is the primary reason the Store appears "empty" or "stale" in the screenshots.