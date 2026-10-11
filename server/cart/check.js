// POST /api/cart/check — is every line still buyable, at what price?
//
// The bag shows live prices and stock without opening the checkout: it is
// what the cart reconciles against after a reload or a long-idle tab.

import { getDb } from "../_core/serverDb.js";
import { MAX_LINES, MAX_QTY_PER_LINE, CheckoutError } from "../_core/orderCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const lines = Array.isArray(req.body?.lines) ? req.body.lines : null;
  if (!lines || lines.length === 0 || lines.length > MAX_LINES) {
    return res.status(400).json({ error: "BAD_CART" });
  }

  try {
    const db = getDb();
    const results = await Promise.all(
      lines.map(async (line) => {
        const productId = String(line?.productId ?? "");
        const variantId = String(line?.variantId ?? "");
        const qty = Math.floor(Number(line?.qty));

        if (!productId || !variantId || !(qty >= 1 && qty <= MAX_QTY_PER_LINE)) {
          throw new CheckoutError("BAD_CART");
        }

        const productSnap = await db.doc(`products_egp/${productId}`).get();
        const variantSnap = await db.doc(`products_egp/${productId}/variants/${variantId}`).get();

        if (!productSnap.exists || productSnap.data().status !== "active") {
          return { productId, variantId, available: false, reason: "UNAVAILABLE", stock: 0, unitPrice: 0 };
        }
        if (!variantSnap.exists || variantSnap.data().active === false) {
          return { productId, variantId, available: false, reason: "UNAVAILABLE", stock: 0, unitPrice: 0 };
        }

        const product = productSnap.data();
        const variant = variantSnap.data();
        const stock = Number(variant.stock ?? 0);

        return {
          productId,
          variantId,
          available: stock >= qty,
          reason: stock >= qty ? null : "OUT_OF_STOCK",
          stock,
          unitPrice: Number(variant.priceOverride ?? product.price ?? 0)
        };
      })
    );

    return res.status(200).json({
      lines: results,
      allAvailable: results.every((r) => r.available)
    });
  } catch (error) {
    const code = String(error?.code ?? error?.message ?? "");
    if (code.startsWith("BAD_")) return res.status(400).json({ error: code });
    console.error("cart check failed:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
