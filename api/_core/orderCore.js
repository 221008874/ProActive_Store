// Order placement, server side.
//
// This module contains no Express and no firebase-admin import: it takes a
// Firestore-like `db` handle, which is what makes the whole thing unit testable
// against a fake. api/placeOrder.js is a thin wrapper that supplies the real db.
//
// Everything that decides money or stock happens inside one transaction, and
// every price is read from the database. The client only states intent:
// "I want 2 of this variant".

import { fieldValue as FieldValue } from "./fieldValueHolder.js";

export const MAX_LINES = 30;
export const MAX_QTY_PER_LINE = 20;
export const FREE_SHIPPING_FALLBACK = 800;
export const MAX_NAME = 80;

const PHONE_RE = /^01[0125]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomSuffix(length = 6, random = Math.random) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return out;
}

// One format everywhere. The original plan also defined a sequential PA-1001
// counter; it is dropped because it funnels every order through one hot
// document and needs extra state kept in step with the client version.
export function newOrderNumber(random = Math.random) {
  return `PA-${randomSuffix(6, random)}`;
}

export function normalizeCode(code) {
  return code ? String(code).trim().toUpperCase() : null;
}

export class CheckoutError extends Error {
  constructor(code, detail = "") {
    super(detail ? `${code}:${detail}` : code);
    this.code = code;
  }
}

// Request-shape validation, before any database work.
export function validateRequest(body = {}) {
  const { cart, customer = {}, address = {} } = body ?? {};

  if (!Array.isArray(cart) || cart.length === 0) throw new CheckoutError("BAD_CART");
  if (cart.length > MAX_LINES) throw new CheckoutError("BAD_CART");

  for (const line of cart) {
    if (!line?.productId || !line?.variantId) throw new CheckoutError("BAD_CART");
    const qty = Math.floor(Number(line.qty));
    if (!(qty >= 1 && qty <= MAX_QTY_PER_LINE)) throw new CheckoutError("BAD_QTY");
  }

  const name = String(customer.name ?? "").trim();
  if (!name) throw new CheckoutError("BAD_CUSTOMER");

  const phone = String(customer.phone ?? "").replace(/[\s\-()]/g, "");
  if (!PHONE_RE.test(phone)) throw new CheckoutError("BAD_CUSTOMER");

  const email = customer.email ? String(customer.email).trim() : null;
  if (email && !EMAIL_RE.test(email)) throw new CheckoutError("BAD_CUSTOMER");

  if (!address?.governorateId) throw new CheckoutError("BAD_ADDRESS");

  return {
    cart: cart.map((l) => ({ productId: String(l.productId), variantId: String(l.variantId), qty: Math.floor(Number(l.qty)) })),
    customer: { name: name.slice(0, MAX_NAME), phone, email },
    address
  };
}

export function discountForCoupon(coupon, subtotal) {
  if (!coupon) return 0;
  if (coupon.type === "percent") {
    return Math.max(0, Math.min(Math.round((subtotal * Number(coupon.value ?? 0)) / 100), subtotal));
  }
  // Missing type means a flat amount. Never treat it as a percentage.
  return Math.max(0, Math.min(Number(coupon.value ?? 0), subtotal));
}

export function couponRejection(coupon, subtotal, now = Date.now()) {
  if (!coupon) return null;
  if (coupon.active === false) return true;

  if (coupon.expiresAt) {
    const ms = typeof coupon.expiresAt.toMillis === "function" ? coupon.expiresAt.toMillis() : Number(coupon.expiresAt);
    if (Number.isFinite(ms) && ms <= now) return true;
  }

  if (coupon.maxUses !== null && coupon.maxUses !== undefined) {
    if ((coupon.usedCount ?? 0) >= Number(coupon.maxUses)) return true;
  }

  if (subtotal < Number(coupon.minOrder ?? 0)) return true;

  return null;
}

export function computeTotals({ lines, coupon, governorate, settings = {} }) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  if (couponRejection(coupon, subtotal)) throw new CheckoutError("COUPON_INVALID");

  const discount = discountForCoupon(coupon, subtotal);
  const discounted = subtotal - discount;

  const freeAt = Number(settings.freeShippingThreshold ?? FREE_SHIPPING_FALLBACK);
  const shippingCost = discounted >= freeAt ? 0 : Number(governorate?.cost ?? 0);

  const minOrder = Number(governorate?.minOrder ?? 0);
  if (subtotal < minOrder) throw new CheckoutError("BELOW_MIN_ORDER");

  return { subtotal, discount, shippingCost, total: discounted + shippingCost };
}

// The whole order, in one transaction.
export async function placeOrderTransaction(db, body, { now = Date.now(), random = Math.random } = {}) {
  const { cart, customer, address } = validateRequest(body);
  const code = normalizeCode(body.couponCode);

  return db.runTransaction(async (tx) => {
    // ---------------- READS (all before the first write) ----------------
    const settingsSnap = await tx.get(db.doc("egp_settings/general"));
    const governorateSnap = await tx.get(db.doc(`egp_governorate_costs/${address.governorateId}`));
    const couponRef = code ? db.doc(`egp_coupons/${code}`) : null;
    const couponSnap = couponRef ? await tx.get(couponRef) : null;

    const lines = [];
    for (const item of cart) {
      const productRef = db.doc(`products_egp/${item.productId}`);
      const variantRef = productRef.collection("variants").doc(item.variantId);

      const [productSnap, variantSnap] = await Promise.all([tx.get(productRef), tx.get(variantRef)]);

      if (!productSnap.exists || productSnap.data.status !== "active") {
        throw new CheckoutError("UNAVAILABLE", item.productId);
      }
      if (!variantSnap.exists || variantSnap.data.active === false) {
        throw new CheckoutError("UNAVAILABLE", item.variantId);
      }
      if (Number(variantSnap.data.stock) < item.qty) {
        throw new CheckoutError("OUT_OF_STOCK", `${item.productId}:${item.variantId}`);
      }

      const product = productSnap.data;
      const variant = variantSnap.data;
      lines.push({
        item,
        productRef,
        variantRef,
        product,
        variant,
        qty: item.qty,
        unitPrice: Number(variant.priceOverride ?? product.price ?? 0)
      });
    }

    // ---------------- COMPUTE ----------------
    if (!governorateSnap.exists || governorateSnap.data.active === false) {
      throw new CheckoutError("GOVERNORATE_UNAVAILABLE");
    }

    if (couponRef && !couponSnap.exists) throw new CheckoutError("COUPON_INVALID");

    const coupon = couponSnap?.exists ? couponSnap.data : null;
    const totals = computeTotals({
      lines,
      coupon,
      governorate: governorateSnap.data,
      settings: settingsSnap.exists ? settingsSnap.data : {}
    });

    // ---------------- WRITES ----------------
    for (const line of lines) {
      tx.update(line.variantRef, { stock: FieldValue.increment(-line.qty) });
      tx.update(line.productRef, {
        soldCount: FieldValue.increment(line.qty),
        totalStock: FieldValue.increment(-line.qty)
      });
    }
    if (couponRef) tx.update(couponRef, { usedCount: FieldValue.increment(1) });

    const orderRef = db.collection("orders_egp").doc();
    const orderNumber = newOrderNumber(random);

    const items = lines.map((l) => ({
      productId: l.item.productId,
      variantId: l.item.variantId,
      title: l.product.title,
      color: l.variant.color,
      size: l.variant.size,
      unitPrice: l.unitPrice,
      qty: l.qty,
      lineTotal: l.unitPrice * l.qty,
      image: l.product.images?.[0]?.url ?? null
    }));

    tx.set(orderRef, {
      orderNumber,
      status: "pending",
      adminConfirmed: false,
      paymentMethod: "cod",
      customer,
      address,
      items,
      ...totals,
      coupon: coupon ? { code, type: coupon.type ?? "fixed", value: coupon.value } : null,
      statusHistory: [{ status: "pending", at: now, by: "customer" }],
      createdAt: FieldValue.serverTimestamp()
    });

    // Returned so the success page can render without the client reading the
    // order back - the hardened rules do not allow public order reads.
    return {
      orderId: orderRef.id,
      orderNumber,
      items,
      ...totals,
      customer,
      address
    };
  });
}

// HTTP status for a thrown error. Known checkout problems are the caller's
// fault (409); anything else is ours (500) and must not leak internals.
export function statusForError(error) {
  const code = String(error?.code ?? error?.message ?? "");
  const known = [
    "OUT_OF_STOCK",
    "UNAVAILABLE",
    "COUPON_INVALID",
    "BELOW_MIN_ORDER",
    "GOVERNORATE_UNAVAILABLE",
    "BAD_CART",
    "BAD_QTY",
    "BAD_CUSTOMER",
    "BAD_ADDRESS"
  ];
  return known.some((k) => code.startsWith(k)) ? 409 : 500;
}