// Order document pipeline: render a bill for an order and archive it.
//
// The flow is deliberately the same shape as the notification outbox: an
// order is placed (server-side transaction), then a best-effort archival step
// runs AFTER the transaction commits - never inside it, and never at the
// cost of the order itself. If GitHub is down or the render fails, the order
// stands, the metadata row records the failure, and either the admin retry
// endpoint or the backfill script picks it up.
//
// What gets stored:
//   bytes      -> a private GitHub repository (githubStore.js)
//   metadata   -> orders_egp/{orderId}/order_documents/{docType} in Firestore
//
// The path is built by documentPath.js and can only ever address a file this
// app wrote. The metadata row is idempotent: an order that already has a
// ready document is not re-rendered, which is what makes a checkout retry
// (double tap, duplicate claim replay) safe.

import { createHash } from "node:crypto";
import { buildRepositoryPath } from "./documentPath.js";
import { renderInvoice } from "./invoiceDoc.js";
import { githubStore } from "./githubStore.js";

const DOCUMENTS_SUBCOLLECTION = "order_documents";

export const DOC_TYPES = {
  invoice: {
    module: "orders_egp",
    referenceType: "invoice",
    format: "pdf",
    mimeType: "application/pdf",
    fileName: (order) => `INV-${order.orderNumber ?? "order"}.pdf`,
    render: ({ order, orderId }) => renderInvoice({ order, orderId })
  }
};

function metaRef(db, orderId, docType) {
  return db.doc(`orders_egp/${orderId}/${DOCUMENTS_SUBCOLLECTION}/${docType}`);
}

export function documentRepositoryPath(docType, order, now) {
  const spec = DOC_TYPES[docType];
  return buildRepositoryPath({
    module: spec.module,
    referenceType: spec.referenceType,
    referenceId: order.orderNumber || "unknown-order",
    fileName: spec.fileName(order),
    now
  });
}

// The whole step for one order. Resolves with the metadata row when the
// document was archived or already existed; throws only when the caller
// should retry later (the retry endpoint and backfill use the throw).
export async function generateOrderDocument(db, orderId, { docType = "invoice", store, now = Date.now() } = {}) {
  const spec = DOC_TYPES[docType];
  if (!spec) throw new Error(`UNKNOWN_DOC_TYPE:${docType}`);

  const fileStore = store ?? githubStore;

  const orderSnap = await db.doc(`orders_egp/${orderId}`).get();
  if (!orderSnap.exists) throw new Error("ORDER_NOT_FOUND");
  const order = orderSnap.data();

  // Idempotency: a ready row means the order (or a replay of it) has already
  // been archived, and re-rendering would archive a second file.
  const metaDocRef = metaRef(db, orderId, docType);
  const existingSnap = await metaDocRef.get();
  if (existingSnap.exists) {
    const existing = existingSnap.data();
    if (existing.status === "ready" && existing.repositoryPath) {
      return { status: "skipped", reason: "exists", document: existing };
    }
  }

  const rendered = await spec.render({ order, orderId: orderSnap.id ?? orderId });
  const bytes = Buffer.isBuffer(rendered.buffer) ? rendered.buffer : Buffer.from(rendered.buffer);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const repositoryPath = documentRepositoryPath(docType, order, now);

  const failure = async (error) => {
    // Recorded, not thrown silently: the admin retry endpoint and the
    // backfill script both look at this row.
    const batch = db.batch();
    batch.set(
      metaDocRef,
      {
        docType,
        status: "failed",
        lastError: String(error?.message ?? error).slice(0, 300),
        failedAt: now
      },
      { merge: true }
    );
    await batch.commit();
    throw error;
  };

  let uploaded;
  try {
    uploaded = await fileStore.putFile(
      repositoryPath,
      bytes.toString("base64"),
      `Archive ${docType} for order ${order.orderNumber ?? orderId}`
    );
  } catch (error) {
    return failure(error);
  }

  const document = {
    docType,
    format: spec.format,
    mimeType: spec.mimeType,
    status: "ready",
    repositoryPath,
    bytes: bytes.length,
    sha256,
    orderNumber: order.orderNumber ?? null,
    invoiceNumber: rendered.invoiceNumber ?? null,
    securityHash: rendered.securityHash ?? null,
    customerName: order.customer?.name ?? null,
    uploadedBy: "system",
    uploadedAt: now,
    commitSha: uploaded?.commit?.sha ?? uploaded?.content?.sha ?? null
  };

  const batch = db.batch();
  batch.set(metaDocRef, document);
  // Same audit trail as every other server-side write the admin panel reads.
  batch.set(db.collection("admin_logs").doc(), {
    who: "system",
    whoEmail: null,
    action: "order_document_archived",
    target: orderId,
    before: null,
    after: { docType, repositoryPath, bytes: bytes.length },
    at: now
  });
  await batch.commit();

  return { status: "ready", document };
}

// Reads the metadata row only (no bytes) - what the admin list shows.
export async function getOrderDocumentMeta(db, orderId, docType = "invoice") {
  const snap = await metaRef(db, orderId, docType).get();
  if (!snap.exists) return null;
  return { id: docType, orderId, ...snap.data() };
}
