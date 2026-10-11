# Data model — ProActive fashion store

Canonical reference for the Firestore collections shared by **ProActive_Store** (storefront)
and **ProActive_Admin** (back-office).

Project: `mina-terek-samir-shein` · Currency: EGP · Payment: cash on delivery

> Source: `PROACTIVE_FASHION_MIGRATION.md` sections 2.1–2.6.
> Two corrections were applied to that document and are called out below
> (`CORRECTION 1` order numbers, `CORRECTION 2` coupon types).

---

## Collections at a glance

```
categories/{categoryId}
collections/{collectionId}                      ← homepage sections: "New In", "Sale"
products_egp/{productId}                        ← product (shared info, price, images)
products_egp/{productId}/variants/{variantId}   ← one doc per color × size, holds STOCK
orders_egp/{orderId}                            ← the only order collection
egp_coupons/{CODE}                              ← doc ID = coupon code
egp_governorate_costs/{govId}
egp_settings/general
```

Legacy (read-only, removed after the migration settles):
`confirmedPayments_egp`, `mobile_orders`, `orders`, `order_notifier`.

---

## `categories/{categoryId}`

```js
{
  name: { ar: "فساتين", en: "Dresses" },
  slug: "dresses",
  parentId: "women",          // null for top level
  image: "https://...",
  order: 10,                  // sort order in menus
  active: true
}
```

## `collections/{collectionId}`

```js
{
  title: { ar: "وصل حديثاً", en: "New In" },
  slug: "new-in",
  productIds: ["p1", "p2"],   // manual list, max ~50
  banner: "https://...",
  order: 1,
  active: true
}
```

## `products_egp/{productId}`

```js
{
  title: { ar: "فستان صيفي", en: "Summer Dress" },
  slug: "summer-dress-floral",
  description: { ar: "...", en: "..." },
  categoryId: "dresses",
  categoryPath: ["women", "dresses"],
  gender: "women",                       // women | men | kids | unisex
  brand: "ProActive",
  tags: ["summer", "floral"],
  material: "Cotton 95%, Elastane 5%",
  care: ["machine-wash-cold"],

  price: 450,                            // current price EGP
  compareAtPrice: 600,                   // old price, null if no sale
  discountPct: 25,                       // derived: round((1 - price/compareAtPrice) * 100)

  images: [{ url, publicId, color: "red", isPrimary: true }],
  colors: [{ id: "red", name: { ar: "أحمر", en: "Red" }, hex: "#dd1111" }],
  sizes: ["S", "M", "L", "XL"],
  sizeGuideId: "dresses-women",

  // denormalized — kept in sync by admin save + the order transaction
  totalStock: 37,
  availableColors: ["red", "black"],
  availableSizes: ["S", "M", "L"],

  isNew: true,
  isFeatured: false,
  soldCount: 0,
  status: "active",                      // draft | active | archived
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

`inStock` is **not** stored. The UI computes `totalStock > 0`.
Bilingual fields are `{ar, en}` objects — resolve with `loc(field, lang)`.

## `products_egp/{productId}/variants/{variantId}`

`variantId = "<colorId>_<size>"`, e.g. `red_M`.

```js
{ colorId: "red", color: "Red", size: "M", sku: "SD-RED-M", stock: 5, priceOverride: null, active: true }
```

## `orders_egp/{orderId}`

```js
{
  orderNumber: "PA-LZ3K9X2",
  status: "pending",       // pending | confirmed | shipped | delivered | cancelled | returned
  adminConfirmed: false,   // legacy compatibility for existing admin queries
  paymentMethod: "cod",

  customer: { name, phone, email },
  address: { governorateId, governorate, city, street, building, notes, lat, lng },

  items: [{
    productId, variantId, title, color, size,
    unitPrice, qty, lineTotal, image
  }],

  subtotal, discount, shippingCost, total,
  coupon: { code, type, value } | null,

  statusHistory: [{ status, at, by }],
  createdAt: Timestamp
}
```

Orders store **snapshots** (title, price, image) — never links that can change later.

## `orders_egp/{orderId}/order_documents/{docType}`

The index of a **generated bill**. The bytes live in a private GitHub
repository (`repositoryPath`), so this row is the only Firestore record.
`docType` is the document id (`invoice`; delivery/return slips can join later).

```js
{
  docType: "invoice",
  format: "pdf",
  mimeType: "application/pdf",
  status: "ready",            // ready | failed (a failed row is retried)
  repositoryPath: "orders_egp/invoice/PA-LZ3K9X2/1728000000000-INV-PA-LZ3K9X2.pdf",
  bytes: 42130,               // size of the PDF
  sha256: "...",              // hash of the exact bytes in the repository
  orderNumber: "PA-LZ3K9X2",
  invoiceNumber: "PA-LZ3K9X2",
  securityHash: "2352DA72",   // deterministic: sha256(orderId)[0:8]
  customerName: "Jane Doe",
  uploadedBy: "system",
  uploadedAt: 1728000000000,
  lastError: "...",           // only on a failed row
  failedAt: 1728000000000,    // only on a failed row
  commitSha: "..."            // GitHub commit that stored the file
}
```

Written only by the server (`/api/placeOrder` after checkout, or the admin
retry endpoint); admin-only read in the rules. The storefront never reads
orders. See `docs/ORDER-DOCUMENTS.md`.

### CORRECTION 1 — order numbers

The migration plan defines `orderNumber` two incompatible ways: `PA-LZ3K9X2`
(timestamp + random) in the client transaction, and `PA-1001` (sequential counter)
in the server route.

**We use the random form in both.** A sequential counter needs a
`egp_settings/counters` document and serialises every order through a single hot
document; the random form is collision-safe at this volume and needs no
extra state. The server route therefore does **not** maintain a counter.

## Coupons, governorates, settings

```js
// egp_coupons/{CODE}   (doc ID = uppercase code)
{ code, type: "percent" | "fixed", value, minOrder: 0, maxUses: null,
  usedCount: 0, expiresAt: Timestamp | null, active: true, createdAt }

// egp_governorate_costs/{govId}
{ name: { ar, en }, cost: 60, minOrder: 0, active: true }

// egp_settings/general
{ freeShippingThreshold: 800, currency: "EGP", storeName: "...", whatsapp: "..." }
```

### CORRECTION 2 — coupon types

Existing coupons are a **flat amount**: the admin generator writes
`{ amount: 10 }` and the storefront reads `appliedCoupon.amount` directly.

The plan's migration maps `type: c.type ?? "percent"`, which would silently turn
an existing "10 EGP off" coupon into "10% off". **The migration maps
`type: "fixed"` for existing documents**, and `percent` is opt-in only for newly
generated coupons. Both the admin form and the storefront pricing must read
`type` and branch — never assume a flat amount.

---

## Security model

| Surface | Access |
|---|---|
| `categories`, `collections`, `products_egp`, variants, `egp_governorate_costs`, `egp_settings` | public read |
| `products_egp`, variants | admin write (customers may only decrement, and only inside an order) |
| `egp_coupons` | `get` only by exact code; customers may only `usedCount + 1` |
| `orders_egp` | admin read; customer `create` only, shape-validated |
| `orders_egp/*/order_documents/*` | admin only (index of generated bills; bytes in the private GitHub repo) |
| `mobile_orders`, `confirmedPayments_egp` | admin only |

Admin = `request.auth.token.admin == true`. **The claim must be set before the
matching rules are deployed**, or every admin write fails with permission-denied.