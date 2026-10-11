// POST /api/admin/order/document/retry — (re)generate an order's bill.
//
// Archival at checkout is best-effort (see api/placeOrder.js), so an order
// can be sitting with a status:"failed" metadata row - GitHub was down, the
// render failed. This endpoint re-runs the pipeline for one order. It is
// idempotent: an order that already has a ready document is a no-op, so an
// admin can safely press retry more than once.

import { getDb } from "../../../_core/serverDb.js";
import { requireAdmin } from "../../../_core/authz.js";
import { applyCors, handlePreflight } from "../../../_core/cors.js";
import { generateOrderDocument, DOC_TYPES } from "../../../_core/orderDocumentCore.js";
import { DocumentStoreNotConfiguredError } from "../../../_core/githubStore.js";

export default async function handler(req, res) {
  // The admin panel calls this from its own domain, so the preflight is the
  // first thing that reaches this route.
  if (handlePreflight(req, res, "POST, OPTIONS")) return;
  applyCors(req, res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const orderId = String(req.body?.orderId ?? "").trim().slice(0, 128);
  const docType = String(req.body?.docType ?? "invoice").trim().slice(0, 50);

  if (!orderId) {
    return res.status(400).json({ error: "BAD_ORDER_ID" });
  }
  if (!DOC_TYPES[docType]) {
    return res.status(400).json({ error: "UNKNOWN_DOC_TYPE" });
  }

  try {
    const db = getDb();
    const result = await generateOrderDocument(db, orderId, { docType });

    if (result.status === "skipped") {
      return res.status(200).json({ ok: true, status: "skipped", reason: "exists", document: result.document });
    }

    return res.status(200).json({ ok: true, status: "ready", document: result.document });
  } catch (error) {
    if (error instanceof DocumentStoreNotConfiguredError) {
      return res.status(503).json({ error: "DOCUMENT_STORE_NOT_CONFIGURED" });
    }
    if (String(error?.message ?? "").startsWith("ORDER_NOT_FOUND")) {
      return res.status(404).json({ error: "ORDER_NOT_FOUND" });
    }
    console.error(`order document retry failed [${orderId}]:`, error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
