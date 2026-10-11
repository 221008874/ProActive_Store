// POST /api/admin/order/status — move an order through its lifecycle.
//
//   pending -> confirmed -> shipped -> delivered
//   pending|confirmed -> cancelled     (stock comes back)
//   delivered -> returned              (per-item restock decision)
//
// Only these transitions are allowed; anything else is refused with the
// legal targets rather than silently accepted. Cancelling and returning
// restore stock in the same transaction, and every change appends to the
// order's statusHistory so the timeline survives.

import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../../_core/serverDb.js";
import { requireAdmin } from "../../_core/authz.js";

const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["returned"],
  cancelled: [],
  returned: []
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Cancel and return are the two transitions that can put stock back. A
// return is an explicit per-item decision (the item may be damaged); a
// cancel restocks everything unless the caller opts out.
function restockPlanFor(order, nextStatus, body) {
  if (nextStatus === "cancelled" && body.restock !== false) {
    return order.items.map((item) => ({ ...item, restock: true }));
  }
  if (nextStatus === "returned" && Array.isArray(body.restockItems)) {
    return order.items.map((item) => {
      const decision = body.restockItems.find(
        (r) => r.variantId === item.variantId && r.productId === item.productId
      );
      return { ...item, restock: decision?.restock === true };
    });
  }
  return [];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const orderId = String(req.body?.orderId ?? "").trim();
  const nextStatus = String(req.body?.status ?? "").trim();
  if (!orderId || !TRANSITIONS[nextStatus]) {
    return res.status(400).json({ error: "BAD_TRANSITION" });
  }

  try {
    const db = getDb();
    const increment = FieldValue.increment;
    const orderRef = db.doc(`orders_egp/${orderId}`);
    const now = Date.now();

    const result = await db.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw new HttpError(404, "ORDER_NOT_FOUND");

      const order = orderSnap.data();
      const current = order.status ?? "pending";
      if (!(TRANSITIONS[current] ?? []).includes(nextStatus)) {
        throw new HttpError(409, `ILLEGAL_TRANSITION:${current}->${nextStatus}`);
      }

      const restock = restockPlanFor(order, nextStatus, req.body ?? {}).filter((r) => r.restock && r.qty > 0);
      const refs = restock.map((item) => ({
        item,
        variantRef: db.doc(`products_egp/${item.productId}/variants/${item.variantId}`),
        productRef: db.doc(`products_egp/${item.productId}`)
      }));

      // READS: every stock document before the first write.
      const stockSnaps = await Promise.all(refs.map((r) => tx.get(r.variantRef)));

      // WRITES: stock back, movements recorded, order moved.
      stockSnaps.forEach((snap, i) => {
        const { item, productRef } = refs[i];
        // A variant deleted since the order was placed cannot be restocked;
        // the movement row still records the decision.
        if (snap.exists) {
          tx.update(refs[i].variantRef, { stock: increment(item.qty) });
          tx.update(productRef, {
            soldCount: increment(-item.qty),
            totalStock: increment(item.qty)
          });
        }
        tx.set(db.collection("stock_movements").doc(), {
          productId: item.productId,
          variantId: item.variantId,
          delta: item.qty,
          reason: nextStatus === "cancelled" ? "cancel" : "return",
          orderId,
          by: auth.uid,
          at: now
        });
      });

      tx.update(orderRef, {
        status: nextStatus,
        adminConfirmed: nextStatus !== "cancelled",
        internalNotes: req.body?.note ? String(req.body.note).slice(0, 2000) : order.internalNotes ?? null,
        statusHistory: [
          ...(order.statusHistory ?? []),
          { status: nextStatus, at: now, by: auth.email ?? auth.uid }
        ]
      });

      // Restocked variants make the snapshot's "sold out" cards wrong.
      tx.set(db.doc("egp_settings/catalog"), { dirty: true, dirtyAt: now }, { merge: true });

      return { status: nextStatus, restockedLines: refs.length };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(`order status change failed [${orderId}]:`, error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
