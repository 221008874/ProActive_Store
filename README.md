# ProActive Store

Storefront for the ProActive Fashion Egypt store — React + Vite, cash on
delivery, Arabic-first with an English toggle.

The companion back-office lives in `ProActive_Admin`; both apps share the
Firebase project `mina-terek-samir-shein`.

## What lives here

```
api/              Vercel serverless functions (the ONLY writer of orders)
  placeOrder.js         POST /api/placeOrder — money, stock and coupon decided
                        in one Firestore transaction
  catalog.js            GET  /api/catalog — the catalogue snapshot (sharded)
  product.js            GET  /api/product?id= — product + live variant stock
  cart/check.js         POST /api/cart/check — revalidate the bag
  coupon/preview.js     POST /api/coupon/preview — validate a code, never
                        exposing the coupon document
  geocode.js/reverse.js proxies for the delivery map (1 req/s + 30-day cache,
                        per the Nominatim usage policy)
  admin/**              id-token + `admin` claim required: order transitions,
                        stock adjustments, snapshot rebuild, Cloudinary signing
  cron/**              scheduled jobs: snapshot rebuild, nightly rollups
  _core/               the logic: orderCore (order transaction + abuse
                        controls), catalogCore (snapshot builder), captcha,
                        geocode, authz, serverDb
src/services/      client data layer: snapshot cache (IndexedDB) + /api client
src/test/          vitest — orderCore against a fake Firestore, catalog
                   builder, captcha/cron guards, cart and pricing logic
scripts/           build-catalog (CLI), backup-firestore (daily export),
                   test-rules (security rules on the emulator)
```

## Commands

```bash
npm run dev            # vite dev server
npm run build          # production build
npm run lint           # eslint
npm test               # vitest unit tests
npm run test:rules     # security-rules tests on the Firestore emulator
npm run build:catalog  # rebuild the catalogue snapshot (needs SERVICE_ACCOUNT)
```

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `VITE_FIREBASE_*` | both | public Firebase config (safe to expose) |
| `VITE_API_URL` | client | base for the `/api` routes (default `/api`) |
| `FIREBASE_SERVICE_ACCOUNT` | **server only** | service account JSON; never `VITE_`-prefixed, never in git |
| `CAPTCHA_SECRET` | server | Turnstile secret; when unset the bot gate is open (dev only) |
| `CRON_SECRET` | server | bearer token for the scheduled routes |
| `CLOUDINARY_*` | server | signed-upload credentials for the Admin |
| `SITE_URL` | server | absolute origin for sitemap/OG output |

## Security model

- Firestore rules: `firestore.rules` is the deployed baseline;
  `firestore.rules.strict` is the hardened set (admin claim, orders written
  by the server only). The cutover order is documented at the top of the
  strict file.
- Orders are never written from the browser: `/api/placeOrder` reads prices,
  stock and coupons from the database inside one transaction, idempotent on a
  browser-generated `clientOrderId`, with per-IP/per-phone rate limits,
  duplicate detection and a blocklist.
- The catalogue snapshot means a visitor never downloads the whole database.
