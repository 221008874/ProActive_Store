// POST /api/coupon/preview — what would this code do to this subtotal?
//
// Validation happens here, not in the browser: the coupon document is never
// sent to the client, and usage counters stay private. The answer is a
// yes/no plus the discount, nothing else.

import { getDb } from "./_core/serverDb.js";
import { normalizeCode, discountForCoupon, couponRejection } from "./_core/orderCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const code = normalizeCode(req.body?.code);
  const subtotal = Number(req.body?.subtotal);

  if (!code) return res.status(400).json({ error: "BAD_CODE" });
  if (!Number.isFinite(subtotal) || subtotal < 0) return res.status(400).json({ error: "BAD_SUBTOTAL" });

  try {
    const db = getDb();
    const snap = await db.doc(`egp_coupons/${code}`).get();

    if (!snap.exists) {
      return res.status(200).json({ valid: false, code, reason: "UNKNOWN" });
    }

    const coupon = snap.data();
    if (couponRejection(coupon, subtotal)) {
      return res.status(200).json({ valid: false, code, reason: rejectionReason(coupon, subtotal) });
    }

    const type = coupon.type ?? "fixed";
    return res.status(200).json({
      valid: true,
      code,
      type,
      value: Number(coupon.value ?? 0),
      discount: discountForCoupon(coupon, subtotal)
    });
  } catch (error) {
    console.error("coupon preview failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

// Which rule refused it. The UI shows a different hint per reason, so the
// server names the rule rather than a single generic "invalid".
function rejectionReason(coupon, subtotal) {
  if (coupon.active === false) return "INACTIVE";
  if (coupon.expiresAt) {
    const ms = typeof coupon.expiresAt.toMillis === "function" ? coupon.expiresAt.toMillis() : Number(coupon.expiresAt);
    if (Number.isFinite(ms) && ms <= Date.now()) return "EXPIRED";
  }
  if (coupon.maxUses !== null && coupon.maxUses !== undefined && (coupon.usedCount ?? 0) >= Number(coupon.maxUses)) {
    return "EXHAUSTED";
  }
  if (subtotal < Number(coupon.minOrder ?? 0)) return "MIN_ORDER";
  return "INVALID";
}
