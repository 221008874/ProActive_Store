// GET /api/cron/rollup — nightly daily statistics.
//
// The Admin Overview reads stats_daily/{yyyy-mm-dd} instead of scanning
// orders, which is what keeps the dashboard cheap. Covers the Egypt day that
// just ended; the rollup also runs on emulator-free deploys as a plain route.

import { getDb } from "../_core/serverDb.js";
import { isCronAuthorized } from "../_core/cronAuth.js";
import { egyptPreviousDay } from "../_core/dayBounds.js";

export default async function handler(req, res) {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  try {
    const db = getDb();
    const { key, start, end } = egyptPreviousDay();

    const snap = await db
      .collection("orders_egp")
      .where("createdAt", ">=", start)
      .where("createdAt", "<", end)
      .get();

    let orders = 0;
    let cancelled = 0;
    let revenue = 0;
    let items = 0;
    const couponUses = {};

    snap.docs.forEach((doc) => {
      const order = doc.data();
      const status = order.status ?? "pending";

      orders += 1;
      if (status === "cancelled") {
        cancelled += 1;
        return;
      }

      revenue += Number(order.total ?? 0);
      items += (order.items ?? []).reduce((sum, item) => sum + Number(item.qty ?? 0), 0);

      if (order.coupon?.code) {
        couponUses[order.coupon.code] = (couponUses[order.coupon.code] ?? 0) + 1;
      }
    });

    // A day with no orders still gets a row, so dashboards can distinguish
    // "zero" from "not computed".
    const stats = { key, orders, cancelled, revenue, items, couponUses, computedAt: new Date().toISOString() };
    await db.doc(`stats_daily/${key}`).set(stats, { merge: true });

    console.log(`cron rollup for ${key}:`, JSON.stringify(stats));
    return res.status(200).json({ ok: true, stats });
  } catch (error) {
    console.error("cron rollup failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
