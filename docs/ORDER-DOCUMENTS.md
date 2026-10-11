# Order documents (bills) — runbook

Every order gets a tax-invoice PDF archived automatically at checkout. This
document is the archive: the browser download the shopper gets is a separate,
ephemeral copy.

## How it works

```
POST /api/placeOrder
 └─ one Firestore transaction writes orders_egp/{id}        (unchanged)
 └─ after commit: generateOrderDocument(db, orderId)        (best effort)
     1. read the order document (the ONLY source of truth)
     2. render the invoice server-side (api/_core/invoiceDoc.js)
        → real orderNumber, real createdAt, full address, coupon
     3. PUT the PDF to the private GitHub repository (base64 in JSON)
        → orders_egp/invoice/{orderNumber}/{timestamp}-INV-{orderNumber}.pdf
     4. write orders_egp/{orderId}/order_documents/invoice
        → { repositoryPath, bytes, sha256, status: "ready", ... } + admin_logs row
```

The shopper's response is never delayed or failed by this step: any error
leaves a `status: "failed"` metadata row (with `lastError`) and is logged with
the request id.

Two deliberate design points:

- **Idempotent.** A ready row means the pipeline skips — a checkout replay
  (double tap, duplicate `clientOrderId`) never archives twice.
- **Private by construction.** The GitHub repository is private, and there is
  no shareable URL for a bill: the admin panel reads bytes through
  `GET /api/admin/documents/download` (admin token + path allowlist), because
  a bill contains the customer's name, phone, email and home address.

## Setup (owner steps)

1. Create a **private** GitHub repository for the bills (e.g.
   `<owner>/proactive-bills`). It can stay empty.
2. Create a token that can write to it:
   <https://github.com/settings/tokens> → fine-grained token, **Contents:
   read/write** on that one repository.
3. Vercel → project → Environment Variables:
   - `GITHUB_TOKEN` = the token
   - `GITHUB_OWNER` = the repo owner
   - `GITHUB_REPO` = the repo name
   - `GITHUB_BRANCH` = `main` (optional; this is the default)
   - `ADMIN_ALLOWED_ORIGINS` = the admin panel's origin(s), e.g.
     `https://proactive-admin.vercel.app` (comma-separated for more). The
     admin panel is a separate deployment, so its bill calls are cross-origin
     and the browser preflights them; this list is what allows them, and the
     default is to allow none.
4. Done — new orders archive their bill automatically. Existing orders are
   backfilled with the CLI below.

## Retries and backfill

The retry endpoint regenerates the bill for one order (idempotent, safe to
press twice):

```bash
curl -X POST https://<store>/api/admin/order/document/retry \
  -H "Authorization: Bearer <admin-id-token>" \
  -H "content-type: application/json" \
  -d '{"orderId": "<orderId>"}'
```

The CLI does the same for many orders (only the ones missing a ready row):

```bash
SERVICE_ACCOUNT=./sa.json GITHUB_TOKEN=... GITHUB_OWNER=... GITHUB_REPO=... \
  node scripts/backfill-documents.mjs --limit=50 --docType=invoice
```

## Reading a bill (admin panel)

`GET /api/admin/documents/download?path=<repositoryPath>` with an admin
bearer token returns `{ content: <base64>, mimeType, fileName }`. The path
must match the four-segment shape the app writes — the allowlist in
`api/_core/documentPath.js` is the security boundary (no traversal into any
other path in the repository). Bytes are base64 in JSON in both directions;
there are no multipart/form-data endpoints.

## Deletion

`api/_core/githubStore.js` exposes `deleteFile` (read sha → delete) for future
use, but nothing calls it yet: the metadata row is soft-deleted only, and
git history retains the blob by design — a bill is a financial record.

## Size ceiling

The PDF is ~30–60 KB (invoice + watermark). Base64 inflation is ~37%, far
below Vercel's 4.5 MB request-body cap, and the render takes well under a
second — both comfortable on the Hobby plan's 10 s function limit.

## Tests

`src/test/orderDocument.test.js` covers the path allowlist, the GitHub
client (stubbed fetch), the pipeline (render → upload → metadata, idempotency,
failure rows, retries), the invoice content (order number, date, address,
coupon, totals, Arabic font switching, real PDF render) and the CORS
allowlist the admin panel's cross-origin calls depend on.
