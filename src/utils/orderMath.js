// Pure maths for order placement, kept out of the transaction so it can be
// unit tested. prices always come from the database via these functions - the
// browser must never be trusted to supply a price or a total.

export const FREE_SHIPPING_FALLBACK = 800;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1

export function randomSuffix(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

// CORRECTION 1: one order-number format everywhere. The original plan also
// defined a sequential "PA-1001" counter in the server route; that is dropped
// because a counter serialises every order through one hot document and needs
// extra state we would then have to keep consistent with the client version.
export function newOrderNumber() {
  return `PA-${randomSuffix(6)}`;
}

// CORRECTION 2: existing coupons are a flat amount ("fixed"). Anything without
// an explicit type is treated as fixed, never as a percentage - defaulting to
// percent would silently reinterpret every existing coupon.
export function discountForCoupon(coupon, subtotal) {
  if (!coupon) return 0;

  if (coupon.type === "percent") {
    const pct = Number(coupon.value ?? 0);
    return Math.max(0, Math.min(Math.round((subtotal * pct) / 100), subtotal));
  }

  return Math.max(0, Math.min(Number(coupon.value ?? 0), subtotal));
}

export function couponRejection(coupon, subtotal, now = Date.now()) {
  // No coupon at all is valid - only a coupon that fails a check is rejected.
  if (!coupon) return null;
  if (coupon.active === false) return "COUPON_INVALID";

  const expiresAt = coupon.expiresAt;
  if (expiresAt) {
    const ms = typeof expiresAt.toMillis === "function" ? expiresAt.toMillis() : Number(expiresAt);
    if (Number.isFinite(ms) && ms <= now) return "COUPON_INVALID";
  }

  if (coupon.maxUses !== null && coupon.maxUses !== undefined) {
    if ((coupon.usedCount ?? 0) >= Number(coupon.maxUses)) return "COUPON_INVALID";
  }

  if (subtotal < Number(coupon.minOrder ?? 0)) return "COUPON_INVALID";

  return null;
}

export function computeOrderTotals({
  lines,
  coupon,
  governorate,
  settings = {},
  freeShippingFallback = FREE_SHIPPING_FALLBACK
}) {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);

  const rejection = couponRejection(coupon, subtotal);
  if (rejection) {
    const err = new Error(rejection);
    err.code = rejection;
    throw err;
  }

  const discount = discountForCoupon(coupon, subtotal);
  const discounted = subtotal - discount;

  const freeAt = Number(settings.freeShippingThreshold ?? freeShippingFallback);
  const shippingCost = discounted >= freeAt ? 0 : Number(governorate?.cost ?? 0);

  const minOrder = Number(governorate?.minOrder ?? 0);
  if (subtotal < minOrder) {
    const err = new Error("BELOW_MIN_ORDER");
    err.code = "BELOW_MIN_ORDER";
    throw err;
  }

  return {
    subtotal,
    discount,
    shippingCost,
    total: discounted + shippingCost
  };
}

// Customer-facing error codes -> messages. The UI should show the message, not
// the code; these are the only strings the shopper sees for a failed checkout.
export const CHECKOUT_ERROR_MESSAGES = {
  OUT_OF_STOCK: "Some items just sold out. Please review your cart.",
  UNAVAILABLE: "Some items are no longer available. Please review your cart.",
  COUPON_INVALID: "This coupon code is no longer valid.",
  BELOW_MIN_ORDER: "Your order is below the minimum for this governorate.",
  GOVERNORATE_UNAVAILABLE: "We cannot deliver to this governorate right now.",
  BAD_QTY: "Invalid quantity.",
  SERVER_ERROR: "Something went wrong. Please try again."
};

export function messageForError(error) {
  const code = String(error?.code ?? error?.message ?? "");
  const match = Object.keys(CHECKOUT_ERROR_MESSAGES).find((k) => code.startsWith(k));
  return match ? CHECKOUT_ERROR_MESSAGES[match] : CHECKOUT_ERROR_MESSAGES.SERVER_ERROR;
}