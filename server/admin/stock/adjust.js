// POST /api/admin/stock/adjust — change a variant's stock with a reason.
//
// Every adjustment writes a stock_movements row, which is the audit trail
// for "why is my stock wrong": damaged, found, manual count, import... An
// adjustment that would drive stock negative is refused rather than clamped.

import { FieldValue } from "../../_core/firebaseAdmin.js";
import { getDb } from "../../_core/serverDb.js";
import { requireAdmin } from "../../_core/authz.js";
import { applyCors, handlePreflight } from "../../_core/cors.js";

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const productId = String(req.body?.productId ?? "").trim();
  const variantId = String(req.body?.variantId ?? "").trim();
  const delta = Math.floor(Number(req.body?.delta));
  const reason = String(req.body?.reason ?? "manual").slice(0, 60);

  if (!productId || !variantId || !Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({ error: "BAD_ADJUSTMENT" });
  }

  try {
    const db = getDb();
    const increment = FieldValue.increment;
    const variantRef = db.doc(`products_egp/${productId}/variants/${variantId}`);
    const productRef = db.doc(`products_egp/${productId}`);
    const now = Date.now();

    const result = await db.runTransaction(async (tx) => {
      // READS first: the current stock decides whether this is legal at all,
      // and an adjustment against a deleted product is a client bug.
      const [variantSnap, productSnap] = await Promise.all([tx.get(variantRef), tx.get(productRef)]);
      if (!productSnap.exists) throw new HttpError(404, "PRODUCT_NOT_FOUND");
      if (!variantSnap.exists) throw new HttpError(404, "VARIANT_NOT_FOUND");

      const currentStock = Number(variantSnap.data().stock ?? 0);
      const nextStock = currentStock + delta;
      if (nextStock < 0) throw new HttpError(409, "NEGATIVE_STOCK");

      tx.update(variantRef, { stock: nextStock });
      // updatedAt is how the catalogue's partial rebuild finds the products it
      // has to re-card; without it this adjustment would only reach the
      // storefront on the next nightly full build.
      tx.update(productRef, { totalStock: increment(delta), updatedAt: FieldValue.serverTimestamp() });
      tx.set(db.collection("stock_movements").doc(), {
        productId,
        variantId,
        delta,
        reason,
        by: auth.uid,
        at: now
      });
      tx.set(db.collection("admin_logs").doc(), {
        who: auth.uid,
        whoEmail: auth.email ?? null,
        action: "stock_adjust",
        target: `${productId}/${variantId}`,
        before: { stock: currentStock },
        after: { stock: nextStock, reason },
        at: now
      });

      tx.set(db.doc("egp_settings/catalog"), { dirty: true, dirtyAt: now }, { merge: true });

      return { productId, variantId, previousStock: currentStock, stock: nextStock };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("stock adjustment failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
