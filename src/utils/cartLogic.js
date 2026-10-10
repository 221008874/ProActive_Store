// Pure cart logic for the fashion model.
//
// A cart line is one VARIANT, not one product: the same dress in M and in L are
// two lines. Every line therefore carries a composite key, which lives in the
// existing `id` field so the many `item.id` call sites in the UI keep working
// unchanged.
//
// Stock is per variant and lives only in Firestore, so a line keeps a snapshot
// for rendering and is reconciled against live stock before checkout.

// Same product, different variant -> different line. Same variant twice ->
// same line, so adding merges instead of duplicating.
export function lineKey(productId, variantId) {
  return variantId ? `${productId}:${variantId}` : `${productId}`;
}

export function sameLine(a, b) {
  return a?.id === b?.id;
}

export function findLine(items, lineId) {
  return items.find((item) => item.id === lineId) ?? null;
}

export function quantityOf(items, lineId) {
  return findLine(items, lineId)?.quantity ?? 0;
}

// Adds qty to an existing line, or appends a new one. Never exceeds the live
// stock; returns {items, error} rather than throwing so the reducer stays pure.
export function addLine(items, line, qty = 1) {
  const amount = Math.floor(Number(qty) || 0);
  if (amount <= 0) return { items, error: null };

  const stock = Number(line.stock ?? 0);
  const existing = findLine(items, line.id);

  if (existing) {
    const next = existing.quantity + amount;
    if (stock >= 0 && next > stock) {
      return {
        items,
        error: {
          type: 'STOCK_LIMIT',
          message: `Only ${stock} available. You already have ${existing.quantity} in cart.`,
          productId: line.productId ?? existing.productId,
          variantId: line.variantId ?? existing.variantId
        }
      };
    }
    return {
      items: items.map((item) => (item.id === line.id ? { ...item, quantity: next } : item)),
      error: null
    };
  }

  if (stock >= 0 && amount > stock) {
    return {
      items,
      error: {
        type: 'STOCK_LIMIT',
        message: `Only ${stock} available.`,
        productId: line.productId,
        variantId: line.variantId
      }
    };
  }

  return { items: [...items, { ...line, quantity: amount }], error: null };
}

export function removeLine(items, lineId) {
  return items.filter((item) => item.id !== lineId);
}

// Quantity changes are clamped to live stock. A line that reaches zero is
// dropped rather than left in the cart as a phantom row.
export function setLineQuantity(items, lineId, quantity, stock) {
  const line = findLine(items, lineId);
  if (!line) return { items, error: null };

  const requested = Math.max(0, Math.floor(Number(quantity) || 0));

  if (requested === 0) return { items: removeLine(items, lineId), error: null };

  const limit = Number.isFinite(Number(stock)) ? Number(stock) : null;
  if (limit !== null && requested > limit) {
    return {
      items,
      error: {
        type: 'STOCK_LIMIT',
        message: `Only ${limit} units available`,
        productId: line.productId,
        variantId: line.variantId
      }
    };
  }

  return {
    items: items.map((item) => (item.id === lineId ? { ...item, quantity: requested } : item)),
    error: null
  };
}

// Refreshes a persisted cart against live Firestore data before checkout.
// A line whose variant has been deleted or deactivated is removed; a line whose
// price changed is repriced; a line now over stock is flagged and clamped.
//
// `catalogue` maps lineId -> { price, stock, active, image, title, ... }.
export function reconcileCart(items, catalogue = {}) {
  const issues = [];
  const kept = [];

  for (const item of items) {
    const live = catalogue[item.id];

    if (!live) {
      issues.push({ id: item.id, reason: 'unavailable', message: `${labelOf(item)} is no longer available.` });
      continue;
    }

    if (live.active === false) {
      issues.push({ id: item.id, reason: 'unavailable', message: `${labelOf(item)} is no longer available.` });
      continue;
    }

    const stock = Number(live.stock ?? 0);
    const quantity = Math.min(item.quantity ?? 1, stock);

    if (quantity <= 0) {
      issues.push({ id: item.id, reason: 'sold_out', message: `${labelOf(item)} just sold out.` });
      continue;
    }

    if (quantity < (item.quantity ?? 1)) {
      issues.push({
        id: item.id,
        reason: 'reduced',
        message: `${labelOf(item)} reduced to ${quantity} (only ${stock} left).`
      });
    }

    kept.push({
      ...item,
      stock,
      quantity,
      // Snapshot refresh: the cart shows what it will actually cost.
      price: Number(live.price ?? item.price ?? 0),
      title: live.title ?? item.title,
      image: live.image ?? item.image
    });
  }

  return { items: kept, issues };
}

function labelOf(item) {
  const title = item.title;
  const text =
    title && typeof title === 'object'
      ? title.en || title.ar || 'Item'
      : title || 'Item';
  const variant = [item.color, item.size].filter(Boolean).join(' / ');
  return variant ? `${text} (${variant})` : text;
}

export function cartSubtotal(items) {
  return items.reduce((sum, item) => sum + Number(item.price ?? 0) * (item.quantity ?? 0), 0);
}

export function cartCount(items) {
  return items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}

// Bumped from the old product-only shape. Old persisted carts are dropped
// rather than reinterpreted, because their lines have no variant.
export const CART_STORAGE_KEY = 'cart_v2';