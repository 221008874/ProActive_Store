// Backfill generated bills for existing orders.
//
//   SERVICE_ACCOUNT=./sa.json GITHUB_TOKEN=... GITHUB_OWNER=... GITHUB_REPO=... node scripts/backfill-documents.mjs [--limit=50] [--docType=invoice]
//
// Bills are archived at checkout, but a store that ran before this feature,
// or a GitHub outage, leaves orders without one. This runs the exact same
// pipeline (api/_core/orderDocumentCore.js) over recent orders, skipping the
// ones that already have a ready document, so it is safe to run repeatedly.

import fs from "node:fs";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const docTypeArg = args.find((a) => a.startsWith("--docType="));
const limit = Math.max(1, Math.min(200, Number(limitArg?.split("=")[1] ?? 50)));
const docType = docTypeArg?.split("=")[1] ?? "invoice";

const keyPath = process.env.SERVICE_ACCOUNT;
if (!keyPath) {
  console.error("Set SERVICE_ACCOUNT to the path of the service account key JSON.");
  process.exit(1);
}
if (!fs.existsSync(keyPath)) {
  console.error(`Service account file not found: ${keyPath}`);
  process.exit(1);
}

// serverDb reads the JSON from this variable; point it at the file's content.
process.env.FIREBASE_SERVICE_ACCOUNT = fs.readFileSync(keyPath, "utf8");

if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPO) {
  console.error("Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO (the Vercel values).");
  process.exit(1);
}

const { getDb } = await import("../server/_core/serverDb.js");
const { generateOrderDocument, getOrderDocumentMeta } = await import("../server/_core/orderDocumentCore.js");
const { limit: firestoreLimit } = await import("firebase-admin/firestore");

const db = getDb();

const snapshot = await db
  .collection("orders_egp")
  .orderBy("createdAt", "desc")
  .limit(firestoreLimit(limit))
  .get();

if (snapshot.empty) {
  console.log("no orders found");
  process.exit(0);
}

let ready = 0;
let skipped = 0;
let failed = 0;

for (const orderDoc of snapshot.docs) {
  const meta = await getOrderDocumentMeta(db, orderDoc.id, docType).catch(() => null);
  if (meta?.status === "ready") {
    skipped += 1;
    continue;
  }

  try {
    const result = await generateOrderDocument(db, orderDoc.id, { docType });
    if (result.status === "skipped") skipped += 1;
    else {
      ready += 1;
      console.log(`archived ${docType} for ${orderDoc.data().orderNumber ?? orderDoc.id} (${result.document.bytes} bytes)`);
    }
  } catch (error) {
    failed += 1;
    console.error(`failed [${orderDoc.id}]: ${String(error?.message ?? error)}`);
  }
}

console.log(`backfill done: ${ready} archived, ${skipped} already had one, ${failed} failed (of ${snapshot.size} scanned)`);
