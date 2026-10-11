// GET /api/cron/stuck-orders — hourly reminder for orders nobody touched.
//
// An order sitting in "pending" is usually a shopper who never answered the
// confirmation call: stock is held, cash is not coming. This flags the ones
// that have been pending too long and pushes a reminder into the same outbox
// the new-order notification uses.
//
// It reminds at most once per reminder window per stuck set, tracked on
// egp_settings/stuck_orders, so an abandoned order does not page the owner
// every hour forever.

import { getDb } from "../_core/serverDb.js";
import { isCronAuthorized } from "../_core/cronAuth.js";

const STUCK_AFTER_MS = 6 * 60 * 60 * 1000;
const REMIND_EVERY_MS = 6 * 60 * 60 * 1000;
const MAX_ROWS = 20;

export default async function handler(req, res) {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  try {
    const db = getDb();
    const now = Date.now();
    const cutoff = new Date(now - STUCK_AFTER_MS);

    const snap = await db
      .collection("orders_egp")
      .where("status", "==", "pending")
      .where("createdAt", "<", cutoff)
      .orderBy("createdAt", "asc")
      .limit(MAX_ROWS)
      .get();

    const stateRef = db.doc("egp_settings/stuck_orders");
    const stateSnap = await stateRef.get();
    const state = stateSnap.exists ? stateSnap.data() : {};

    if (snap.empty) {
      await stateRef.set({ lastNotifiedAt: 0, lastOldestOrderId: null }, { merge: true });
      return res.status(200).json({ ok: true, stuck: 0, reminded: false });
    }

    const oldestOrderId = snap.docs[0].id;
    const shouldRemind =
      state.lastOldestOrderId !== oldestOrderId ||
      now - Number(state.lastNotifiedAt ?? 0) >= REMIND_EVERY_MS;

    if (!shouldRemind) {
      return res.status(200).json({ ok: true, stuck: snap.size, reminded: false, reason: "already-reminded" });
    }

    await db.collection("outbox").add({
      type: "stuck_orders",
      status: "pending",
      attempts: 0,
      at: now,
      payload: {
        count: snap.size,
        orders: snap.docs.map((doc) => ({
          orderId: doc.id,
          orderNumber: doc.data().orderNumber ?? null,
          phone: doc.data().customer?.phone ?? null,
          total: Number(doc.data().total ?? 0),
          createdAt: doc.data().createdAt ?? null
        }))
      }
    });

    await stateRef.set({ lastNotifiedAt: now, lastOldestOrderId: oldestOrderId }, { merge: true });

    console.log(`cron stuck-orders: ${snap.size} order(s) pending since before ${cutoff.toISOString()}`);
    return res.status(200).json({ ok: true, stuck: snap.size, reminded: true });
  } catch (error) {
    console.error("cron stuck-orders failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
