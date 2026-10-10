// Order placement.
//
// Replaces the dual write in CartPage (which wrote both orders_egp and
// mobile_orders). Everything that decides money or stock happens INSIDE the
// transaction, and every price is read from Firestore - the client only says
// "I want 2 of this variant".
//
// All reads happen before the first write, which Firestore requires.

import { runTransaction, doc, collection, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../services/firebase";
import { newOrderNumber, computeOrderTotals } from "../utils/orderMath";

const MAX_LINES = 30;
const MAX_QTY_PER_LINE = 20;

export async function placeOrder({ cart, customer, address, couponCode }) {
  if (!Array.isArray(cart) || cart.length === 0) {
    const err = new Error("BAD_CART");
    err.code = "BAD_CART";
    throw err;
  }

  const code = couponCode ? String(couponCode).trim().toUpperCase() : null;

  return runTransaction(db, async (tx) => {
    // ---------------- READS ----------------
    const settingsSnap = await tx.get(doc(db, "egp_settings", "general"));
    const governorateSnap = await tx.get(
      doc(db, "egp_governorate_costs", address.governorateId)
    );

    const couponRef = code ? doc(db, "egp_coupons", code) : null;
    const couponSnap = couponRef ? await tx.get(couponRef) : null;

    const lines = [];
    for (const item of cart) {
      const qty = Math.floor(Number(item.qty));
      if (!(qty >= 1 && qty <= MAX_QTY_PER_LINE)) {
        const err = new Error("BAD_QTY");
        err.code = "BAD_QTY";
        throw err;
      }

      const productRef = doc(db, "products_egp", item.productId);
      const variantRef = doc(db, "products_egp", item.productId, "variants", item.variantId);

      const [productSnap, variantSnap] = await Promise.all([
        tx.get(productRef),
        tx.get(variantRef)
      ]);

      if (!productSnap.exists() || productSnap.data().status !== "active") {
        const err = new Error(`UNAVAILABLE:${item.productId}`);
        err.code = "UNAVAILABLE";
        throw err;
      }
      if (!variantSnap.exists() || variantSnap.data().active === false) {
        const err = new Error(`UNAVAILABLE:${item.variantId}`);
        err.code = "UNAVAILABLE";
        throw err;
      }
      if (variantSnap.data().stock < qty) {
        const err = new Error(`OUT_OF_STOCK:${item.productId}:${item.variantId}`);
        err.code = "OUT_OF_STOCK";
        throw err;
      }

      const product = productSnap.data();
      const variant = variantSnap.data();
      lines.push({
        item,
        productRef,
        variantRef,
        product,
        variant,
        qty,
        // price from the database, never from the browser
        unitPrice: variant.priceOverride ?? product.price ?? 0
      });
    }

    // ---------------- COMPUTE ----------------
    if (!governorateSnap.exists() || governorateSnap.data().active === false) {
      const err = new Error("GOVERNORATE_UNAVAILABLE");
      err.code = "GOVERNORATE_UNAVAILABLE";
      throw err;
    }

    const coupon = couponSnap && couponSnap.exists() ? couponSnap.data() : null;
    if (couponRef && !coupon) {
      const err = new Error("COUPON_INVALID");
      err.code = "COUPON_INVALID";
      throw err;
    }

    const totals = computeOrderTotals({
      lines,
      coupon,
      governorate: governorateSnap.data(),
      settings: settingsSnap.exists() ? settingsSnap.data() : {}
    });

    // ---------------- WRITES ----------------
    for (const line of lines) {
      tx.update(line.variantRef, { stock: increment(-line.qty) });
      tx.update(line.productRef, {
        soldCount: increment(line.qty),
        totalStock: increment(-line.qty)
      });
    }
    if (couponRef) tx.update(couponRef, { usedCount: increment(1) });

    const orderRef = doc(collection(db, "orders_egp"));
    const orderNumber = newOrderNumber();

    const items = lines.map((line) => ({
      productId: line.item.productId,
      variantId: line.item.variantId,
      title: line.product.title,
      color: line.variant.color,
      size: line.variant.size,
      unitPrice: line.unitPrice,
      qty: line.qty,
      lineTotal: line.unitPrice * line.qty,
      image: line.product.images?.[0]?.url ?? null
    }));

    tx.set(orderRef, {
      orderNumber,
      status: "pending",
      adminConfirmed: false,
      paymentMethod: "cod",
      customer: {
        name: String(customer.name ?? "").slice(0, 80),
        phone: customer.phone ?? "",
        email: customer.email ?? null
      },
      address,
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      shippingCost: totals.shippingCost,
      total: totals.total,
      coupon: coupon ? { code, type: coupon.type ?? "fixed", value: coupon.value } : null,
      statusHistory: [{ status: "pending", at: Date.now(), by: "customer" }],
      createdAt: serverTimestamp()
    });

    // Returned so the success page can render without reading Firestore
    // back (the hardened rules do not allow the customer to read orders).
    return {
      orderId: orderRef.id,
      orderNumber,
      items,
      ...totals,
      customer: { name: customer.name, phone: customer.phone, email: customer.email ?? null },
      address
    };
  });
}

export { MAX_LINES };