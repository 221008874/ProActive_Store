# Catalogue load failure — diagnosis (fix round 3)

Date: 2026-10-12 · Target: `https://pro-active-store.vercel.app` · Status: **root cause found and fixed**

## Symptom

Home ("وصل حديثاً" rail) and Shop both rendered the **error** state
("تحميل المنتجات فشل" / "Could not load products") with a Retry button. Round 1
showed an empty state; round 2 correctly distinguished empty from failed — but
the state that got shown was still wrong.

## The 2-minute owner check

Per the round-3 brief, `https://pro-active-store.vercel.app/api/catalog` was
opened first. It answered:

```
HTTP 200   content-type: application/json; charset=utf-8
{"version":1,"builtAt":1791727998472,"productCount":0,"products":[], ...}
```

So the table resolved to the **last row**: the function is deployed, it runs, and
it returns valid JSON. This is a **client bug**, not a deployment failure.

## What was actually wrong

`src/services/catalog.js` → `fetchActiveProducts()`:

```js
const snapshot = await readSnapshot();
if (snapshot?.products?.length) return snapshot.products;   // <-- truthiness test
```

`readSnapshot()` had already succeeded and returned a **complete, well-formed
snapshot whose `products` array is legitimately empty**. `.length` of `0` is
falsy, so the code concluded the snapshot was *unusable* and fell through to the
direct Firestore fallback:

```js
getDocs(query(collection(db, "products_egp"), where("status", "==", "active")))
```

That fallback is denied. Verified against the live database:

```
GET https://firestore.googleapis.com/v1/projects/mina-terek-samir-shein/
    databases/default/documents/products_egp
→ 403 PERMISSION_DENIED "Missing or insufficient permissions."
```

The thrown `PERMISSION_DENIED` propagated out of `fetchActiveProducts()`, and
`useCatalog` turned it into `error` — so the shopper saw a **failure** where the
truth was **"the store has published nothing yet"**.

The deployed rules and `firestore.rules` / `firestore.rules.strict` all say
`allow read: if true` on `products_egp`, so the local files do not explain the
403. The deployed ruleset is what answers; either way the storefront has no
business depending on this read at all — `/api/catalog` is the contract, and it
works. Every one of these pages took the fallback only because the snapshot
looked empty.

**The bug class:** "empty" and "unavailable" were both encoded as a falsy
`products.length`, so the one case the code could not represent — *the store is
open and has no products yet* — silently fell through to a code path that fails
loudly. The tri-state the round-2 review asked for was never actually
implemented at the data layer, only at the render layer.

## Why the second Firestore fallback (the legacy `status == null` read) did not
save it

`fetchActiveProducts` has a second fallback that re-reads `products_egp` with
`.limit(200)` and treats a missing `status` as active. It sits *after* the first
one, so it never ran. Even if it had, it would also 403.

## Fix

1. **A resolved snapshot is authoritative, empty or not.**
   `readSnapshot()` now returns `{ snapshot, source }` with `source` one of
   `network` | `cache` | `none`. `fetchActiveProducts` branches on the *presence
   of a snapshot*, not on `products.length`. An empty published catalogue
   therefore returns `[]` and the page renders its **empty** state.
2. **The Firestore fallback is a last resort and can no longer manufacture an
   error.** It only runs when no snapshot could be obtained at all, and a
   failure there is wrapped in a `CatalogError` with a short code
   (`E-CATALOG-…`) instead of a raw SDK exception.
3. **Diagnosable failures.** `src/services/api.js` logs `status`,
   `content-type` and the first 200 characters of the body for any non-OK or
   non-JSON response, and `CatalogError.code` is surfaced next to the Retry
   button (`E-CATALOG-404`, `E-CATALOG-500`, `E-CATALOG-NETWORK`, …).
4. **Retry with exponential backoff** (1 s, 2 s, 4 s) before the error state is
   shown, then an explicit Retry button that re-runs the same sequence.
5. **Three states everywhere**: `loading` (skeleton) / `error` (message + code +
   Retry) / `empty` (message + link to Home). Home's "New in" and "Sale" rails
   **hide themselves** when empty instead of printing an error inside a section.
6. **Cached snapshot wins over the error.** If the network call fails and a
   snapshot is in IndexedDB, the page shows the cached products with a small
   "showing saved items" note rather than an error.
7. **`GET /api/health`** already exists (verified `{"ok":true,...}` on the live
   site) and a post-deploy CI step now asserts `/api/catalog` answers
   `application/json`.

## Verification on the live site

| Check | Before | After |
|---|---|---|
| `GET /api/catalog` | 200 JSON, `productCount: 0` | unchanged (healthy) |
| `GET /api/health` | — | 200 `{"ok":true,"at":…}` |
| Shop state | `role="alert"` error | `role="status"` empty + link to Home |
| Home rails | error text in a section | section hidden |
| Firestore direct read | 403 | no longer attempted |

## Owner action still required (data, not code)

The catalogue is genuinely empty. Nothing is wrong with the code path any more.
To make products appear, **one** of:

- Press **Publish changes** in the Admin (marks `egp_settings/catalog.dirty`
  and triggers the `/api/cron/catalog` rebuild), or
- run the migration from `PROACTIVE_FASHION_MIGRATION.md` against
  `mina-terek-samir-shein`, then hit `/api/admin/catalog/rebuild`, or
- wait for the nightly `0 4 * * *` cron.

Then confirm with `GET /api/catalog` that `productCount > 0`.

## Related finding (not fixed here — deploy order)

`/api/catalog` returns a 200 snapshot, but `catalog_snapshots/*` is
**admin-only** in `firestore.rules.strict`. That is correct and intended (the
server reads it with the Admin SDK, the browser never does). It is called out
here only so nobody "fixes" it later by opening it to the public.
