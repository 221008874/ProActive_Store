// Tests for the catalogue snapshot builder (server/_core/catalogCore.js).
//
// The snapshot is what keeps the store inside the free Firestore quota, so
// the sharding maths, the public-settings filter and the stale-shard cleanup
// are the parts worth proving.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  SHARD_SIZE,
  slimCard,
  slimVariant,
  shardProducts,
  publicSettings,
  normalizeSearchText,
  buildSnapshotData,
  writeSnapshot,
  readSnapshot,
  collectVariants,
  rebuildShardsPartial,
  refreshSnapshotIfStale,
  REBUILD_COOLDOWN_MS
} from '../../server/_core/catalogCore.js'
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

describe('catalogCore - variants in the card', () => {
  const variant = (overrides = {}) => ({
    colorId: 'red', color: 'Red', size: 'M', stock: 5, active: true, ...overrides
  })

  it('slims a variant to the fields the product page needs', () => {
    const row = slimVariant(variant({ cost: 99, barcode: 'x' }), 'red_M')
    expect(row).toEqual({
      id: 'red_M',
      colorId: 'red',
      color: 'Red',
      size: 'M',
      stock: 5,
      active: true,
      priceOverride: null,
      image: null
    })
    expect(row).not.toHaveProperty('cost')
    expect(row).not.toHaveProperty('barcode')
  })

  it('treats a missing active flag as active and keeps a price override', () => {
    const row = slimVariant({ colorId: 'red', stock: '3', priceOverride: '399.5' }, 'red_M')
    expect(row.active).toBe(true)
    expect(row.stock).toBe(3)
    expect(row.priceOverride).toBe(399.5)
  })

  it('accepts raw variant rows and query snapshots alike', () => {
    const card = slimCard(productDoc(), 'dress', [
      { id: 'red_M', colorId: 'red', size: 'M', stock: 2 },
      { id: 'red_L', data: () => ({ colorId: 'red', size: 'L', stock: 1 }) }
    ])
    expect(card.variants.map((v) => v.id)).toEqual(['red_M', 'red_L'])
    expect(card.variants[1].stock).toBe(1)
  })

  it('defaults to no variants rather than undefined', () => {
    expect(slimCard(productDoc(), 'dress').variants).toEqual([])
  })
})

describe('catalogCore - freshness (partial rebuild)', () => {
  // A catalogue with two active products whose variants are seeded, built at a
  // known moment, so a later "stock moved" can be re-carded.
  const seedCatalogue = async ({ now = 1000 } = {}) => {
    db.__seed('egp_settings/catalog', { dirty: false, version: 0, lastBuiltAt: 0 })
    const snapshot = buildSnapshotData({
      products: [
        docOf('dress', productDoc({ updatedAt: new Date(500) })),
        docOf('shirt', productDoc({ slug: 'shirt', title: { en: 'Shirt' }, updatedAt: new Date(500) }))
      ],
      variantsByProduct: {
        dress: [{ id: 'red_M', colorId: 'red', size: 'M', stock: 5 }],
        shirt: [{ id: 'blue_L', colorId: 'blue', size: 'L', stock: 4 }]
      },
      settings: { freeShippingThreshold: 800 },
      currentVersion: 0,
      now
    })
    await writeSnapshot(db, snapshot)
    return snapshot
  }

  it('publishes a shardIndex so the partial build can find a card', async () => {
    await seedCatalogue()
    const meta = db.__read('catalog_snapshots/meta')
    expect(meta.meta.shardIndex).toEqual({ dress: 'cards_1', shirt: 'cards_1' })
  })

  it('re-cards only the products that changed, keeping the rest untouched', async () => {
    await seedCatalogue()

    // Dress sold one: its product and variant both move.
    db.__seed('products_egp/dress', productDoc({ totalStock: 4, updatedAt: new Date(6000) }))
    db.__seed('products_egp/dress/variants/red_M', { colorId: 'red', size: 'M', stock: 4 })

    const result = await rebuildShardsPartial(db, { now: 7000, lastBuiltAt: 1000 })
    expect(result.mode).toBe('partial')
    expect(result.patchedProducts).toBe(1)
    expect(result.version).toBe(2)

    const cards = db.__read('catalog_snapshots/cards_1').products
    const dress = cards.find((c) => c.id === 'dress')
    const shirt = cards.find((c) => c.id === 'shirt')
    expect(dress.totalStock).toBe(4)
    expect(dress.variants[0].stock).toBe(4)
    expect(shirt.totalStock).toBe(productDoc().totalStock) // untouched
    expect(shirt.variants[0].stock).toBe(4)
  })

  it('bumps the version everywhere it is visible (meta, shard, flag)', async () => {
    await seedCatalogue()
    db.__seed('products_egp/dress', productDoc({ updatedAt: new Date(6000) }))

    await rebuildShardsPartial(db, { now: 7000, lastBuiltAt: 1000 })

    expect(db.__read('catalog_snapshots/cards_1').version).toBe(2)
    expect(db.__read('catalog_snapshots/meta').version).toBe(2)
    expect(db.__read('catalog_snapshots/meta').meta.version).toBe(2)
    expect(db.__read('egp_settings/catalog')).toMatchObject({ dirty: false, version: 2, lastBuiltAt: 7000 })
  })

  it('leaves other shards and the product count alone', async () => {
    db.__seed('egp_settings/catalog', { dirty: false, version: 0, lastBuiltAt: 0 })
    const many = Array.from({ length: SHARD_SIZE + 2 }, (_, i) =>
      docOf(`p${i}`, productDoc({ slug: `p${i}`, updatedAt: new Date(500) }))
    )
    await writeSnapshot(db, buildSnapshotData({ products: many, currentVersion: 0, now: 1000 }))

    db.__seed('products_egp/p5', productDoc({ slug: 'p5', updatedAt: new Date(6000) }))
    const result = await rebuildShardsPartial(db, { now: 7000, lastBuiltAt: 1000 })

    expect(result.shards).toBe(1) // only the shard holding p5
    expect(db.__read('catalog_snapshots/cards_1').version).toBe(2)
    expect(db.__read('catalog_snapshots/cards_2').version).toBe(1) // untouched
    expect(db.__read('catalog_snapshots/meta').productCount).toBe(SHARD_SIZE + 2)
  })

  it('asks for a full build when a product the index never saw changed', async () => {
    await seedCatalogue()
    db.__seed('products_egp/newcomer', productDoc({ slug: 'newcomer', updatedAt: new Date(6000) }))
    expect(await rebuildShardsPartial(db, { now: 7000, lastBuiltAt: 1000 })).toBeNull()
  })

  it('asks for a full build when a changed product stopped being active', async () => {
    await seedCatalogue()
    db.__seed('products_egp/dress', productDoc({ status: 'archived', updatedAt: new Date(6000) }))
    expect(await rebuildShardsPartial(db, { now: 7000, lastBuiltAt: 1000 })).toBeNull()
  })

  it('asks for a full build before any shard index exists', async () => {
    db.__seed('catalog_snapshots/cards_1', { products: [{ id: 'dress' }], version: 1 })
    db.__seed('catalog_snapshots/meta', { version: 1, shards: [{ id: 'cards_1', count: 1 }], meta: {} })
    expect(await rebuildShardsPartial(db, { now: 7000, lastBuiltAt: 1000 })).toBeNull()
  })

  it('clears a stale dirty flag without building when nothing moved', async () => {
    await seedCatalogue({ now: 1000 })
    db.__seed('egp_settings/catalog', { dirty: true, version: 1, lastBuiltAt: 1000 })

    const result = await rebuildShardsPartial(db, { now: 5000, lastBuiltAt: 1000 })
    expect(result.mode).toBe('noop')
    expect(db.__read('egp_settings/catalog').dirty).toBe(false)
  })
})

describe('catalogCore - refresh decision', () => {
  const seedDirty = (extra = {}) =>
    db.__seed('egp_settings/catalog', { dirty: true, version: 1, lastBuiltAt: 0, ...extra })

  it('costs one read and builds nothing when the snapshot is clean', async () => {
    db.__seed('egp_settings/catalog', { dirty: false, version: 1, lastBuiltAt: 10 })
    expect(await refreshSnapshotIfStale(db, { now: 99999 })).toEqual({ rebuilt: false, reason: 'not-dirty' })
  })

  it('waits out the cooldown so a burst of orders costs one rebuild', async () => {
    db.__seed('egp_settings/catalog', { dirty: true, version: 1, lastBuiltAt: 1000 })
    const now = 1000 + REBUILD_COOLDOWN_MS - 1
    expect(await refreshSnapshotIfStale(db, { now })).toEqual({ rebuilt: false, reason: 'cooldown' })
  })

  it('rebuilds once the cooldown has passed', async () => {
    db.__seed('products_egp/dress', productDoc({ updatedAt: new Date(2000) }))
    db.__seed('catalog_snapshots/cards_1', { products: [], version: 1 })
    db.__seed('catalog_snapshots/meta', {
      version: 1,
      productCount: 0,
      shards: [{ id: 'cards_1', count: 0 }],
      meta: { shardIndex: { dress: 'cards_1' } }
    })
    seedDirty({ lastBuiltAt: 1000 })

    const result = await refreshSnapshotIfStale(db, { now: 1000 + REBUILD_COOLDOWN_MS })
    expect(result.rebuilt).toBe(true)
    expect(result.mode).toBe('partial')
    expect(db.__read('egp_settings/catalog').dirty).toBe(false)
  })

  it('falls back to a full build when the patch cannot be expressed', async () => {
    db.__seed('products_egp/dress', productDoc({ updatedAt: new Date(2000) }))
    db.__seed('products_egp/shirt', productDoc({ slug: 'shirt', title: { en: 'Shirt' }, updatedAt: new Date(2000) }))
    db.__seed('catalog_snapshots/cards_1', { products: [{ id: 'dress' }], version: 1 })
    db.__seed('catalog_snapshots/meta', {
      version: 1,
      productCount: 1,
      shards: [{ id: 'cards_1', count: 1 }],
      meta: { shardIndex: { dress: 'cards_1' } }
    })
    // shirt was never indexed -> structural change -> full build.
    seedDirty({ lastBuiltAt: 1000 })

    const result = await refreshSnapshotIfStale(db, { now: 1000 + REBUILD_COOLDOWN_MS })
    expect(result.mode).toBe('full')
    const meta = db.__read('catalog_snapshots/meta')
    // The fixture also carries an active `override` product, so a full build
    // publishes every active product, not just the two named here.
    expect(meta.productCount).toBe(3)
    expect(meta.meta.shardIndex).toMatchObject({ dress: 'cards_1', shirt: 'cards_1', override: 'cards_1' })
  })

  it('never throws when the rebuild blows up', async () => {
    db.__seed('egp_settings/catalog', { dirty: true, version: 1, lastBuiltAt: 0 })
    db.collection = () => { throw new Error('firestore is down') }
    expect(await refreshSnapshotIfStale(db, { now: 99999 })).toEqual({ rebuilt: false, reason: 'error' })
  })
})

describe('catalogCore - variant gathering', () => {
  it('returns an entry per product, empty when it has none', async () => {
    const byId = await collectVariants(db, ['dress', 'override', 'archived'])
    expect(Object.keys(byId).sort()).toEqual(['archived', 'dress', 'override'])
    expect(byId.dress).toHaveLength(3)
    expect(byId.dress[0].id).toBe('red_M')
    expect(byId.archived).toEqual([])
  })

  it('skips the read entirely when there is nothing to collect', async () => {
    expect(await collectVariants(db, [])).toEqual({})
  })
})
