// Client-side pieces of the snapshot-first read path.
//
// These are the functions that decide whether opening the bag or a product page
// costs Firestore reads at all, so they are pure and worth proving directly:
// which card a product id resolves to, and which stock number a bag line shows.

import { describe, it, expect } from 'vitest'
import { stockForLine } from '../hooks/useCheckout.js'
import { findInSnapshot } from '../services/catalog.js'

const snapshot = {
  products: [
    {
      id: 'dress',
      slug: 'summer-dress',
      title: { ar: 'فستان', en: 'Dress' },
      totalStock: 9,
      variants: [
        { id: 'red_M', colorId: 'red', size: 'M', stock: 5 },
        { id: 'red_L', colorId: 'red', size: 'L', stock: 0 }
      ]
    },
    {
      id: 'legacy',
      slug: 'legacy-tee',
      title: { ar: 'تيشيرت', en: 'Tee' },
      totalStock: 3
      // no variants subcollection: a legacy product
    }
  ]
}

describe('findInSnapshot - resolving a product from the cached snapshot', () => {
  it('finds by document id', () => {
    expect(findInSnapshot(snapshot, 'dress').id).toBe('dress')
  })

  it('finds by slug, which is what shared links and the sitemap use', () => {
    expect(findInSnapshot(snapshot, 'summer-dress').id).toBe('dress')
  })

  it('is case-insensitive, because a link is typed by humans', () => {
    expect(findInSnapshot(snapshot, 'SUMMER-DRESS').id).toBe('dress')
  })

  it('returns null for a product that is not in the snapshot', () => {
    // The caller's cue to fall back to the live API.
    expect(findInSnapshot(snapshot, 'nope')).toBeNull()
  })

  it('returns null rather than throwing when there is no snapshot', () => {
    expect(findInSnapshot(null, 'dress')).toBeNull()
    expect(findInSnapshot({}, 'dress')).toBeNull()
    expect(findInSnapshot(snapshot, '')).toBeNull()
  })

  it('carries the variants, so the product page needs no second read', () => {
    expect(findInSnapshot(snapshot, 'dress').variants).toHaveLength(2)
  })
})

describe('stockForLine - what a bag line shows as available', () => {
  it('reads the chosen variant stock, not the product total', () => {
    const card = snapshot.products[0]
    expect(stockForLine(card, { id: 'dress:red_M', variantId: 'red_M' })).toBe(5)
  })

  it('recovers the variant id from a composite line id', () => {
    const card = snapshot.products[0]
    expect(stockForLine(card, { id: 'dress:red_L', productId: 'dress' })).toBe(0)
  })

  it('falls back to the product total for a legacy product with no variants', () => {
    expect(stockForLine(snapshot.products[1], { id: 'legacy:default' })).toBe(3)
  })

  it('falls back to the total when a variant id is not in the card', () => {
    // A line whose variant was archived since the last build.
    expect(stockForLine(snapshot.products[0], { id: 'dress:gone', variantId: 'gone' })).toBe(9)
  })

  it('treats a missing card as nothing available, never as unknown stock', () => {
    expect(stockForLine(null, { id: 'dress:red_M' })).toBe(0)
  })

  it('never reports NaN for a malformed line', () => {
    expect(stockForLine({ variants: [{ id: 'red_M' }] }, { id: 'dress:red_M' })).toBe(0)
  })
})
