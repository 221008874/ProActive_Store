// Tests for the catalogue snapshot builder (api/_core/catalogCore.js).
//
// The snapshot is what keeps the store inside the free Firestore quota, so
// the sharding maths, the public-settings filter and the stale-shard cleanup
// are the parts worth proving.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  SHARD_SIZE,
  slimCard,
  shardProducts,
  publicSettings,
  normalizeSearchText,
  buildSnapshotData,
  writeSnapshot,
  readSnapshot
} from '../../api/_core/catalogCore.js'
import { createFakeFirestore, seedFixture } from './fakeFirestore'

let db

const docOf = (id, data) => ({ id, data: () => data })

const productDoc = (overrides = {}) => ({
  title: { ar: 'فستان', en: 'Dress' },
  slug: 'dress',
  price: 450,
  compareAtPrice: 600,
  discountPct: 25,
  isNew: true,
  status: 'active',
  gender: 'women',
  categoryId: 'dresses',
  categoryPath: ['women', 'dresses'],
  tags: ['summer'],
  images: [{ url: 'a.jpg', color: 'red' }, { url: 'b.jpg', color: 'blue' }, { url: 'c.jpg' }],
  availableColors: ['red'],
  availableSizes: ['M'],
  totalStock: 5,
  soldCount: 2,
  createdAt: { toMillis: () => 1000 },
  ...overrides
})

beforeEach(() => {
  db = createFakeFirestore(seedFixture())
})

describe('catalogCore - card shape', () => {
  it('keeps only the fields the product grid needs', () => {
    const card = slimCard(productDoc({ description: { en: 'long text' } }), 'dress')
    expect(card).not.toHaveProperty('description')
    expect(card).toMatchObject({ id: 'dress', price: 450, totalStock: 5, soldCount: 2 })
  })

  it('caps images at two so cards stay slim', () => {
    expect(slimCard(productDoc(), 'dress').images).toHaveLength(2)
  })

  it('coerces missing fields instead of propagating undefined', () => {
    const card = slimCard({ title: null }, 'bare')
    expect(card.price).toBe(0)
    expect(card.categoryPath).toEqual([])
    expect(card.images).toEqual([])
  })
})

describe('catalogCore - search text folding', () => {
  it('folds diacritics, alef and ya forms, ta marbuta and Arabic digits', () => {
    const haystack = normalizeSearchText({ ar: 'فُسْتان صَيْفِي ٢٠٢٤', en: 'Summer Dress' }, ['قُماش قُطن'])
    expect(haystack).toContain('فستان') // diacritics stripped
    expect(haystack).toContain('صيفي 2024') // Arabic-Indic digits folded
    expect(haystack).toContain('summer dress')
    expect(haystack).toContain('قماش قطن')
  })

  it('unifies alef forms, ya and ta marbuta', () => {
    expect(normalizeSearchText({ ar: 'أحمد' })).toBe('احمد')
    expect(normalizeSearchText({ ar: 'مصطفى' })).toBe('مصطفي')
    expect(normalizeSearchText({ ar: 'حقيبة' })).toBe('حقيبه')
    expect(normalizeSearchText({ ar: 'آلية' })).toBe('اليه')
  })

  it('lowercases Latin and collapses whitespace', () => {
    expect(normalizeSearchText({ en: '  Summer   DRESS ' })).toBe('summer dress')
  })

  it('folds cards for products that ship without a stored searchText', () => {
    const card = slimCard(productDoc({ searchText: undefined, tags: ['صيفي'] }), 'dress')
    expect(card.searchText).toContain('dress')
    expect(card.searchText).toContain('صيفي')
  })

  it('keeps a stored searchText when the admin wrote one', () => {
    const card = slimCard(productDoc({ searchText: 'curated dress' }), 'dress')
    expect(card.searchText).toBe('curated dress')
  })
})

describe('catalogCore - sharding', () => {  it('splits a large catalogue into shards stamped with the version', () => {
    const cards = Array.from({ length: SHARD_SIZE + 10 }, (_, i) => ({ id: `p${i}` }))
    const shards = shardProducts(cards, 7)

    expect(shards).toHaveLength(2)
    expect(shards[0].products).toHaveLength(SHARD_SIZE)
    expect(shards[1].products).toHaveLength(10)
    expect(shards.every((s) => s.version === 7)).toBe(true)
  })

  it('always produces at least one shard, even when empty', () => {
    const shards = shardProducts([], 1)
    expect(shards).toHaveLength(1)
    expect(shards[0].products).toEqual([])
  })
})

describe('catalogCore - public settings filter', () => {
  it('exposes only storefront-safe settings', () => {
    const settings = publicSettings({
      storeName: 'ProActive',
      freeShippingThreshold: 800,
      ordersOpen: false,
      rateLimits: { perPhoneDay: 3 },
      counters: { orderSeq: 40 }
    })
    expect(settings).toMatchObject({ storeName: 'ProActive', freeShippingThreshold: 800, ordersOpen: false })
    expect(settings).not.toHaveProperty('rateLimits')
    expect(settings).not.toHaveProperty('counters')
  })

  it('treats ordering as open unless explicitly closed', () => {
    expect(publicSettings({}).ordersOpen).toBe(true)
    expect(publicSettings({ ordersOpen: true }).ordersOpen).toBe(true)
  })
})

describe('catalogCore - build and store', () => {
  const build = (overrides = {}) =>
    buildSnapshotData({
      products: [docOf('dress', productDoc()), docOf('gone', productDoc({ status: 'draft' }))],
      categories: [{ id: 'dresses', name: { en: 'Dresses' } }],
      collections: [{ id: 'new-in', productIds: ['dress'] }],
      taxonomy: { sizes: ['S', 'M'] },
      governorates: [{ id: 'cairo', cost: 60 }],
      settings: { freeShippingThreshold: 800, ordersOpen: true },
      currentVersion: 4,
      now: 1234,
      ...overrides
    })

  it('bumps the version and reports shard descriptors', () => {
    const snapshot = build()
    expect(snapshot.version).toBe(5)
    expect(snapshot.builtAt).toBe(1234)
    expect(snapshot.productCount).toBe(2)
    expect(snapshot.shardDescriptors).toEqual([{ id: 'cards_1', count: 2 }])
  })

  it('carries the metadata needed to render the storefront', () => {
    const { meta } = build()
    expect(meta.categories).toHaveLength(1)
    expect(meta.collections).toHaveLength(1)
    expect(meta.taxonomy.sizes).toEqual(['S', 'M'])
    expect(meta.governorates).toHaveLength(1)
    expect(meta.publicSettings.freeShippingThreshold).toBe(800)
  })

  it('writes shards + meta in one commit and clears the dirty flag', async () => {
    const snapshot = build()
    await writeSnapshot(db, snapshot)

    expect(db.__read('catalog_snapshots/meta').version).toBe(5)
    expect(db.__read('catalog_snapshots/cards_1').products).toHaveLength(2)
    expect(db.__read('egp_settings/catalog')).toMatchObject({ dirty: false, version: 5, productCount: 2 })
  })

  it('deletes shards the new build no longer needs', async () => {
    db.__seed('catalog_snapshots/cards_9', { products: [{ id: 'ghost' }], version: 1 })
    await writeSnapshot(db, build())
    expect(db.__read('catalog_snapshots/cards_9')).toBeUndefined()
    expect(db.__read('catalog_snapshots/cards_1')).toBeTruthy()
  })
})

describe('catalogCore - reading the snapshot back', () => {
  it('round-trips products and metadata', async () => {
    await writeSnapshot(db, buildSnapshotData({
      products: [docOf('dress', productDoc())],
      categories: [{ id: 'dresses' }],
      settings: { freeShippingThreshold: 800 },
      currentVersion: 0,
      now: 10
    }))

    const snapshot = await readSnapshot(db)
    expect(snapshot.version).toBe(1)
    expect(snapshot.products).toHaveLength(1)
    expect(snapshot.products[0].id).toBe('dress')
    expect(snapshot.categories).toEqual([{ id: 'dresses' }])
    expect(snapshot.settings.freeShippingThreshold).toBe(800)
  })

  it('refuses to serve a partial build', async () => {
    await writeSnapshot(db, buildSnapshotData({ products: [docOf('a', productDoc())], currentVersion: 0, now: 1 }))
    // Simulate a shard that vanished mid-publish.
    delete db.__store.catalog_snapshots.cards_1
    expect(await readSnapshot(db)).toBeNull()
  })

  it('returns null when nothing was ever built', async () => {
    expect(await readSnapshot(db)).toBeNull()
  })
})
