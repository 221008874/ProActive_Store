// Order placement, server side.
//
// This module contains no Express and no firebase-admin import: it takes a
// Firestore-like `db` handle, which is what makes the whole thing unit testable
// against a fake. api/placeOrder.js is a thin wrapper that supplies the real db.
//
// Everything that decides money or stock happens inside one transaction, and
// every price is read from the database. The client only states intent:
// "I want 2 of this variant".
//
// Abuse controls live here too, because none of them work in the browser:
//   - idempotency     a browser-generated clientOrderId claims the order; a
//                     repeat (double tap, flaky network) gets the same order
//   - rate limits     per IP (hour + day) and per phone (day)
//   - duplicates      the same phone ordering the same items minutes apart
//   - blocklist       phones/IPs that refused or faked orders
//   - ordersOpen      the owner's kill switch (egp_settings/general)
//
// Firestore transactions cannot run queries, so the duplicate check does not
// scan orders: each order writes a small pointer document keyed by a hash of
// the phone number (recent_customers/<hash>). The pointer is read inside the
// transaction, which keeps the check atomic and race-free for the common case.

import { createHash } from "node:crypto";
import { fieldValue as FieldValue } from "./fieldValueHolder.js";

export const MAX_LINES = 30;
export const MAX_QTY_PER_LINE = 20;
export const FREE_SHIPPING_FALLBACK = 800;
export const MAX_NAME = 80;

// Same phone, same items, inside this window -> treated as one order.
export const DUP_WINDOW_MS = 10 * 60 * 1000;

export const DEFAULT_RATE_LIMITS = {
  perIpHour: 5,
  perIpDay: 25,
  perPhoneDay: 3
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// An order at or above this total is flagged for manual confirmation.
export const HIGH_VALUE_FLAG_DEFAULT = 3000;

const PHONE_RE = /^01[0125]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function sha256Hex(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

// Personal data is never stored in the shared anti-abuse collections under a
// raw identifier: the blocklist, rate limits and recent-order pointers are all
// keyed by hashes, so a leak of those collections does not leak customer data.
export function hashPhone(phone) {
  return sha256Hex(`phone:${phone}`);
}

export function hashIp(ip) {
  return sha256Hex(`ip:${String(ip).trim()}`);
}

// Stable, order-independent fingerprint of what is being bought: the same
// lines in a different order are the same order.
export function itemsFingerprint(lines) {
  return [...lines]
    .map((l) => `${l.productId}:${l.variantId}:${l.qty}`)
    .sort()
    .join("|");
}

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

// The idempotency claim is a browser-generated id, kept short enough that it
// can never be a Firestore path or a query injection.
export function normalizeClientOrderId(value) {
  if (!value) return null;
  const id = String(value).trim().slice(0, 64);
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

export function discountForCoupon(coupon, subtotal) {
  if (!coupon) return 0;
  if (coupon.type === "percent") {
    return Math.max(0, Math.min(Math.round((subtotal * Number(coupon.value ?? 0)) / 100), subtotal));
  }
  // Missing type means a flat amount. Never treat it as a percentage.
  return Math.max(0, Math.min(Number(coupon.value ?? 0), subtotal));
}

// Why a coupon would be refused, or null when it stands. `subtotal` may be null
// when there is no order yet (the coupon landing page): the minimum-order rule
// is then deferred to checkout, where the real subtotal is always known.
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

  if (subtotal !== null && subtotal !== undefined && subtotal < Number(coupon.minOrder ?? 0)) return true;

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

// Fixed-window counters. A window that already elapsed starts a fresh one at
// count 1, which is written as an absolute value (no read-modify-write race:
// the whole state is recomputed from the snapshot read in this transaction).
export function nextWindow(prev, limit, now, span) {
  if (!prev || !(prev.reset > now)) return { count: 1, reset: now + span };
  if ((prev.count ?? 0) >= limit) return prev;
  return { count: (prev.count ?? 0) + 1, reset: prev.reset };
}

// How suspicious is this order? Not a fraud engine - a cheap, explainable set
// of flags so a human reviews the right orders before shipping.
export function riskFor({ total, lineCount, isFirstTime, settings = {} }) {
  const highValueAt = Number(settings.highValueThreshold ?? HIGH_VALUE_FLAG_DEFAULT);
  const flags = [];
  if (total >= highValueAt) flags.push("high_value");
  if (lineCount >= 5) flags.push("many_lines");
  if (isFirstTime) flags.push("first_time");

  return { score: Math.min(100, flags.length * 25), flags };
}

// The whole order, in one transaction.
export async function placeOrderTransaction(db, body, { now = Date.now(), random = Math.random, context = {} } = {}) {
  const { cart, customer, address } = validateRequest(body);
  const code = normalizeCode(body.couponCode);
  const clientOrderId = normalizeClientOrderId(body.clientOrderId);

  const phoneHash = hashPhone(customer.phone);
  const ipHash = context.ip ? hashIp(context.ip) : null;
  const userAgentHash = context.userAgent ? sha256Hex(`ua:${context.userAgent}`) : null;
  const source = context.source ? String(context.source).slice(0, 20) : "web";
  const fingerprint = itemsFingerprint(cart);

  return db.runTransaction(async (tx) => {
    // ---------------- READS (all before the first write) ----------------
    const settingsSnap = await tx.get(db.doc("egp_settings/general"));
    const settings = settingsSnap.exists ? settingsSnap.data : {};
    const limits = { ...DEFAULT_RATE_LIMITS, ...(settings.rateLimits ?? {}) };

    const governorateSnap = await tx.get(db.doc(`egp_governorate_costs/${address.governorateId}`));
    const couponRef = code ? db.doc(`egp_coupons/${code}`) : null;
    const couponSnap = couponRef ? await tx.get(couponRef) : null;

    // Idempotency: a claim written by an earlier attempt with the same
    // browser-generated id means this is a retry, so replay that order
    // instead of placing a second one.
    const claimRef = clientOrderId ? db.doc(`client_orders/${clientOrderId}`) : null;
    const claimSnap = claimRef ? await tx.get(claimRef) : null;
    if (claimSnap?.exists) return claimSnap.data.result;

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

    // ---------------- ABUSE READS ----------------
    const blockRefs = [db.doc(`blocklist/${phoneHash}`)];
    if (ipHash) blockRefs.push(db.doc(`blocklist/ip_${ipHash}`));
    const [blockPhoneSnap, blockIpSnap] = await Promise.all(blockRefs.map((ref) => tx.get(ref)));

    const rateIpRef = ipHash ? db.doc(`rate_limits/ip_${ipHash}`) : null;
    const rateIpSnap = rateIpRef ? await tx.get(rateIpRef) : null;
    const ratePhoneRef = db.doc(`rate_limits/phone_${phoneHash}`);
    const ratePhoneSnap = await tx.get(ratePhoneRef);

    const recentRef = db.doc(`recent_customers/${phoneHash}`);
    const recentSnap = await tx.get(recentRef);

    // A blocked phone or IP is refused before anything is decremented.
    for (const snap of [blockPhoneSnap, blockIpSnap]) {
      if (snap?.exists && snap.data.active !== false) {
        throw new CheckoutError("BLOCKED", snap.data.reason ?? "");
      }
    }

    // The owner's kill switch (see the runbook: flip ordersOpen=false).
    if (settings.ordersOpen === false) throw new CheckoutError("ORDERS_CLOSED");

    if (rateIpSnap?.exists) {
      const counts = rateIpSnap.data ?? {};
      if (counts.hour?.reset > now && (counts.hour.count ?? 0) >= limits.perIpHour) {
        throw new CheckoutError("RATE_LIMITED");
      }
      if (counts.day?.reset > now && (counts.day.count ?? 0) >= limits.perIpDay) {
        throw new CheckoutError("RATE_LIMITED");
      }
    }
    if (ratePhoneSnap?.exists) {
      const day = ratePhoneSnap.data?.day;
      if (day?.reset > now && (day.count ?? 0) >= limits.perPhoneDay) {
        throw new CheckoutError("RATE_LIMITED");
      }
    }

    // The same shopper re-buying the same items minutes apart is a double
    // tap or a flaky retry far more often than it is fraud; replay the
    // original order instead of placing a twin.
    if (
      recentSnap?.exists &&
      recentSnap.data?.fingerprint === fingerprint &&
      now - Number(recentSnap.data.at ?? 0) < DUP_WINDOW_MS
    ) {
      return recentSnap.data.result;
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
      settings
    });

    const risk = riskFor({
      total: totals.total,
      lineCount: cart.length,
      isFirstTime: !recentSnap?.exists,
      settings
    });

    // ---------------- WRITES ----------------
    // `updatedAt` is what the catalogue's partial rebuild scans for, so a
    // stock move here is a stock move the storefront will see. Writers that
    // forget to move it are only corrected by the nightly full build.
    for (const line of lines) {
      tx.update(line.variantRef, { stock: FieldValue.increment(-line.qty) });
      tx.update(line.productRef, {
        soldCount: FieldValue.increment(line.qty),
        totalStock: FieldValue.increment(-line.qty),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    if (couponRef) tx.update(couponRef, { usedCount: FieldValue.increment(1) });

    // Anti-abuse documents are pure caches, so each carries the moment it stops
    // being useful. A TTL policy on `expireAt` (Firebase console, one field per
    // collection) keeps them from accumulating forever against the 1 GiB
    // storage quota - see the note in README.md.
    if (rateIpRef) {
      tx.set(rateIpRef, {
        hour: nextWindow(rateIpSnap.exists ? rateIpSnap.data.hour : null, limits.perIpHour, now, HOUR),
        day: nextWindow(rateIpSnap.exists ? rateIpSnap.data.day : null, limits.perIpDay, now, DAY),
        expireAt: new Date(now + 2 * DAY)
      });
    }
    tx.set(ratePhoneRef, {
      day: nextWindow(ratePhoneSnap.exists ? ratePhoneSnap.data.day : null, limits.perPhoneDay, now, DAY),
      expireAt: new Date(now + 2 * DAY)
    });

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
      // Anti-abuse trail: hashes only, never raw IP or user agent.
      phoneHash,
      ipHash,
      userAgentHash,
      source,
      clientOrderId,
      risk,
      statusHistory: [{ status: "pending", at: now, by: "customer" }],
      createdAt: FieldValue.serverTimestamp()
    });

    // Queued for the new-order notification. placeOrder delivers it inline and
    // flips it to `sent`; anything it could not deliver is picked up by the
    // nightly notify cron (Vercel's Hobby plan runs crons once a day, so this
    // cannot be a 5-minute loop).
    const outboxRef = db.collection("outbox").doc();
    tx.set(outboxRef, {
      type: "new_order",
      status: "pending",
      attempts: 0,
      at: now,
      // A row nobody will ever look at again should not outlive its usefulness.
      expireAt: new Date(now + 30 * DAY),
      payload: { orderId: orderRef.id, orderNumber, phone: customer.phone, total: totals.total }
    });

    // Tells the catalogue builder the denormalised stock on the snapshot is now
    // stale. The rebuild happens on the next catalogue read once the cooldown
    // has passed (see refreshSnapshotIfStale), or on the nightly full build.
    tx.set(db.doc("egp_settings/catalog"), { dirty: true, dirtyAt: now }, { merge: true });

    const result = {
      orderId: orderRef.id,
      orderNumber,
      items,
      ...totals,
      risk,
      customer,
      address,
      // Returned to the route so it can mark the outbox row delivered without
      // the client ever seeing this.
      outboxRef
    };

    // The idempotency claim only has to outlive a retry storm, and the
    // duplicate window is ten minutes; a day is generous.
    if (claimRef) tx.set(claimRef, { result: publicResult(result), at: now, expireAt: new Date(now + DAY) });
    tx.set(recentRef, { fingerprint, at: now, result: publicResult(result), expireAt: new Date(now + DAY) });

    // Returned so the success page can render without the client reading the
    // order back - the hardened rules do not allow public order reads.
    return result;
  });
}

// What a shopper (or a retry) is allowed to see: the same order, minus the
// outbox reference the route uses internally. The replay paths below return
// exactly this shape, so a retry answers with the original order and not with
// whatever the route happens to attach now.
export function publicResult(result = {}) {
  const rest = { ...result };
  delete rest.outboxRef;
  return rest;
}

// HTTP status for a thrown error. Known checkout problems are the caller's
// fault (409); rate limiting is 429, a block is 403, and a closed store is
// 503. Anything else is ours (500) and must not leak internals.
export function statusForError(error) {
  const code = String(error?.code ?? error?.message ?? "");
  if (code.startsWith("RATE_LIMITED")) return 429;
  if (code.startsWith("BLOCKED")) return 403;
  if (code.startsWith("ORDERS_CLOSED")) return 503;

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
