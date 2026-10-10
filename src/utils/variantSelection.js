// Variant selection for the product page.
//
// A shopper picks a colour then a size; the pair identifies a variant and
// therefore a stock number. The rules live here, pure and tested, so the page
// component only has to render them.

import { variantIdFor, findVariant, isVariantPurchasable } from '../hooks/useCatalog.js';

// Shown as "Only N left" from here down.
export const LOW_STOCK_THRESHOLD = 3;

export function purchasableVariants(product) {
  if (!product?.variants) return [];
  return product.variants.filter((v) => isVariantPurchasable(v));
}

export function colorsOf(product) {
  if (!product?.variants) return [];

  const stocked = new Set(purchasableVariants(product).map((v) => v.colorId));
  const toColor = (c) => {
    const id = typeof c === 'string' ? c : c.id;
    return {
      id,
      name: typeof c === 'string' ? c : c.name ?? { en: id, ar: id },
      hex: typeof c === 'string' ? null : c.hex ?? null,
      inStock: stocked.has(id)
    };
  };

  // Prefer the product's own colour list (translated names + hex swatches);
  // fall back to whatever the variants declare.
  const declared = product.colors ?? [];
  return declared.length > 0
    ? declared.map(toColor)
    : [...new Set(product.variants.map((v) => v.colorId))].map((id) =>
        toColor({ id, name: { en: id, ar: id }, hex: null })
      );
}

export function sizesOf(product, colorId) {
  if (!product?.variants || !colorId) return [];
  return product.variants
    .filter((v) => v.colorId === colorId)
    .map((v) => ({
      size: v.size,
      stock: Number(v.stock ?? 0),
      inStock: isVariantPurchasable(v)
    }));
}

// Picks a sensible starting pair so the page is not born unselected, but only
// when one actually exists.
export function initialSelection(product) {
  const colors = colorsOf(product).filter((c) => c.inStock);
  if (colors.length === 0) return { colorId: null, size: null };

  for (const color of colors) {
    const sizes = sizesOf(product, color.id).filter((s) => s.inStock);
    if (sizes.length > 0) return { colorId: color.id, size: sizes[0].size };
  }

  return { colorId: null, size: null };
}

// Changing colour usually invalidates the size, so keep it only if that pair
// still exists and is purchasable.
export function selectColor(product, current, colorId) {
  const sizes = sizesOf(product, colorId);
  if (sizes.length === 0) return { colorId, size: null };

  const stillValid = sizes.find((s) => s.size === current?.size && s.inStock);
  if (stillValid) return { colorId, size: stillValid.size };

  const firstAvailable = sizes.find((s) => s.inStock);
  return { colorId, size: firstAvailable ? firstAvailable.size : null };
}

export function selectSize(product, colorId, size) {
  const match = sizesOf(product, colorId).find((s) => s.size === size);
  if (!match || !match.inStock) return { colorId, size: match ? match.size : null };
  return { colorId, size: match.size };
}

export function selectedVariant(product, selection) {
  if (!selection?.colorId || !selection?.size) return null;
  return findVariant(product, selection.colorId, selection.size);
}

export function selectionIsComplete(product, selection) {
  const variant = selectedVariant(product, selection);
  return isVariantPurchasable(variant);
}

export function stockOf(product, selection) {
  return Number(selectedVariant(product, selection)?.stock ?? 0);
}

export function maxAddableQuantity(product, selection, alreadyInCart = 0) {
  const stock = stockOf(product, selection);
  return Math.max(0, stock - alreadyInCart);
}

// The gallery narrows to the selected colour, falling back to everything when
// the product has no per-colour images.
export function imagesForColor(product, colorId) {
  const images = product?.images ?? [];
  if (!colorId || images.length === 0) return images;

  const forColor = images.filter((img) => img.color === colorId);
  return forColor.length > 0 ? forColor : images;
}

export function primaryImage(product, colorId) {
  const images = imagesForColor(product, colorId);
  if (images.length === 0) return null;
  return (images.find((i) => i.isPrimary) ?? images[0]).url ?? null;
}

export function isLowStock(product, selection) {
  const stock = stockOf(product, selection);
  return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
}

// Everything the order transaction needs, in one object.
export function buildOrderLine(product, selection, quantity = 1) {
  const variant = selectedVariant(product, selection);
  return {
    productId: product.id,
    // Prefer the variant document's own id; fall back to the derived key for
    // a product whose variants were built in memory.
    variantId: variant?.id ?? variantIdFor(selection.colorId, selection.size),
    qty: Math.max(1, Math.floor(Number(quantity) || 1))
  };
}