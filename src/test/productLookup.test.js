// Tests for id-or-slug product resolution (api/_core/productLookup.js) and
// the Egypt day boundaries the nightly jobs share (api/_core/dayBounds.js).

import { describe, it, expect, beforeEach } from 'vitest'
import { findProduct, findPublicProduct } from '../../server/_core/productLookup.js'
import { egyptPreviousDay } from '../../server/_core/dayBounds.js'
import { createFakeFirestore, seedFixture } from './fakeFirestore'

let db

beforeEach(() => {
  db = createFakeFirestore(seedFixture())
  db.__seed('products_egp/summer-dress', {
    title: { ar: 'فستان', en: 'Dress' },
    slug: 'summer-dress',
    status: 'active',
    variants: { red_M: { stock: 3, active: true } }
  })
})

describe('productLookup - id or slug', () => {
  it('resolves a document id first', async () => {
    const snap = await findProduct(db, 'dress')
    expect(snap).not.toBeNull()
    expect(snap.id).toBe('dress')
  })

  it('falls back to the slug when the id misses', async () => {
    const snap = await findProduct(db, 'summer-dress')
    expect(snap.id).toBe('summer-dress')
  })

  it('returns null for an unknown id or slug', async () => {
    expect(await findProduct(db, 'nope')).toBeNull()
    expect(await findProduct(db, '')).toBeNull()
  })

  it('refuses drafts and archived products by either address', async () => {
    db.__seed('products_egp/secret', { slug: 'secret', status: 'draft' })
    db.__seed('products_egp/old', { slug: 'gone', status: 'archived' })

    expect(await findPublicProduct(db, 'secret')).toBeNull()
    expect(await findPublicProduct(db, 'gone')).toBeNull()
  })

  it('attaches live variants to a public product', async () => {
    const product = await findPublicProduct(db, 'summer-dress')
    expect(product.id).toBe('summer-dress')
    expect(product.slug).toBe('summer-dress')
    expect(product.variants).toEqual([{ id: 'red_M', stock: 3, active: true }])
  })
})

describe('dayBounds - Egypt day windows', () => {
  // 2026-10-11T22:30:00Z is 2026-10-12 00:30 Cairo time.
  const afterCairoMidnight = new Date('2026-10-11T22:30:00Z')
  // 2026-10-11T20:00:00Z is 2026-10-11 22:00 Cairo - still the 11th.
  const beforeCairoMidnight = new Date('2026-10-11T20:00:00Z')

  it('rolls over at Cairo midnight, not at UTC midnight', () => {
    const after = egyptPreviousDay(afterCairoMidnight)
    expect(after.key).toBe('2026-10-11') // the Cairo day that just ended
    expect(after.start.toISOString()).toBe('2026-10-10T22:00:00.000Z')
    expect(after.end.toISOString()).toBe('2026-10-11T22:00:00.000Z')

    const before = egyptPreviousDay(beforeCairoMidnight)
    expect(before.key).toBe('2026-10-10') // still working on the 10th's stats
  })

  it('spans exactly 24 hours and keeps the window inside its key', () => {
    const { start, end, key } = egyptPreviousDay(afterCairoMidnight)
    expect(end - start).toBe(24 * 60 * 60 * 1000)
    expect(new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)).toBe(key)
  })
})
