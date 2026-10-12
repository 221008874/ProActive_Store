// Regression tests for the fix-round-3 catalogue failure.
//
// The bug: `fetchActiveProducts` tested `snapshot?.products?.length` for truthiness.
// An empty published catalogue has `products.length === 0`, which is falsy, so
// the code concluded the snapshot was unusable, fell through to a direct
// Firestore read that the deployed rules deny (403 PERMISSION_DENIED), and
// rendered an ERROR state where the truth was "the store has nothing published
// yet". See docs/CATALOG_DIAGNOSIS.md.
//
// These tests pin the contract that prevents a recurrence:
//   * a resolved snapshot is authoritative even when empty
//   * the Firestore fallback is unreachable while a snapshot exists
//   * failures carry a short, stable code
//   * transient failures retry with backoff; permanent ones do not
//   * a cached snapshot beats an error state

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the modules BEFORE importing catalog.js, and only those: mocking the
// service itself would test the mock. `src/test/fakeFirestore.js` is not used
// here because the Firestore read must never be reached in the happy paths.
const getJson = vi.fn()
const storeSnapshot = vi.fn(async (s) => s)
let cached = null
const getDocs = vi.fn()
const getDoc = vi.fn()

vi.mock('../services/api.js', () => ({ getJson: (...a) => getJson(...a) }))
vi.mock('../services/snapshotStore.js', () => ({
  loadCachedSnapshot: async () => cached,
  storeSnapshot: async (s) => { cached = s; return storeSnapshot(s); }
}))
vi.mock('../services/firebase.js', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  getDoc: (...a) => getDoc(...a),
  getDocs: (...a) => getDocs(...a),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({})
}))

const {
  fetchActiveProducts,
  CatalogError,
  CANONICAL_SIZES,
  canonicalSize,
  sortSizesCanonical,
  DEFAULT_TAXONOMY
} = await import('../services/catalog.js')

const snapshot = (products = [], extra = {}) => ({
  version: 7, builtAt: 1, productCount: products.length, products,
  categories: [], collections: [], taxonomy: {}, governorates: [], settings: {}, ...extra
})

describe('catalogue read path', () => {
  /* A helper for every test that has to exhaust the retry chain.
   *
   * The `.then(ok, err)` is attached BEFORE the timers are advanced: with fake
   * timers the promise settles inside `advanceTimersByTimeAsync`, and a
   * rejection that lands while nothing is listening is reported by Node as an
   * unhandled rejection — even though the assertion two lines later consumes it.
   * Attaching a handler first makes these tests deterministic and quiet, and
   * lets one helper serve both the resolves and the rejects. */
  const settle = async (promise, advanceMs) => {
    const settled = promise.then(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error })
    );
    await vi.advanceTimersByTimeAsync(advanceMs);
    return settled;
  };

  beforeEach(() => {
    getJson.mockReset()
    storeSnapshot.mockClear()
    getDocs.mockReset()
    getDoc.mockReset()
    cached = null
  })

  afterEach(() => vi.useRealTimers())

  /* --- the actual bug ------------------------------------------------------ */

  it('treats an EMPTY published catalogue as empty, not as a failure', async () => {
    // /api/catalog answers 200 with a complete snapshot carrying zero products.
    getJson.mockResolvedValue(snapshot([]))

    const result = await fetchActiveProducts()

    expect(result.products).toEqual([])
    expect(result.stale).toBe(false)
    // The decisive assertion: the denied Firestore read was never attempted.
    // If this regresses, the shopper sees an error state over an empty shop.
    expect(getDocs).not.toHaveBeenCalled()
  })

  it('returns the snapshot products without touching Firestore', async () => {
    getJson.mockResolvedValue(snapshot([{ id: 'p1' }, { id: 'p2' }]))

    const result = await fetchActiveProducts()

    expect(result.products).toHaveLength(2)
    expect(getDocs).not.toHaveBeenCalled()
  })

  it('caches the snapshot it fetched', async () => {
    getJson.mockResolvedValue(snapshot([{ id: 'p1' }]))

    await fetchActiveProducts()

    expect(storeSnapshot).toHaveBeenCalledTimes(1)
  })

  /* --- stale cache --------------------------------------------------------- */

  it('serves the cached snapshot and flags it stale when the network fails', async () => {
    vi.useFakeTimers()
    cached = snapshot([{ id: 'cached-1' }])
    getJson.mockRejectedValue(Object.assign(new Error('boom'), { code: 'E-API-NETWORK' }))

    const settled = await settle(fetchActiveProducts(), 4000)

    expect(settled.ok).toBe(true)
    expect(settled.value.products).toHaveLength(1)
    expect(settled.value.stale).toBe(true)
    expect(getDocs).not.toHaveBeenCalled()
  })

  it('does not flag a 304-resolved cached copy as stale', async () => {
    // A 304 means the server confirmed the local copy IS current. Flagging it
    // as "showing saved items" would be wrong and would train shoppers to
    // ignore the note — only a copy used *after a failure* is stale.
    cached = snapshot([{ id: 'cached-1' }])
    getJson.mockResolvedValue({ __notModified: true })

    const result = await fetchActiveProducts()

    expect(result.products).toHaveLength(1)
    expect(result.stale).toBe(false)
  })

  it('sends if-none-match from the cached version', async () => {
    cached = snapshot([{ id: 'x' }], { version: 42 })
    getJson.mockResolvedValue({ __notModified: true })

    await fetchActiveProducts()

    expect(getJson).toHaveBeenCalledWith('/catalog', {
      headers: { 'if-none-match': '"catalog-42"' }
    })
  })

  /* --- failure codes ------------------------------------------------------- */

    it('reports a short code when there is no snapshot and no cache', async () => {
    vi.useFakeTimers()
    getJson.mockRejectedValue(
      Object.assign(new Error('nope'), { code: 'E-API-404', status: 404 })
    )
    getDocs.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }))

    const settled = await settle(fetchActiveProducts(), 1000)

    expect(settled.ok).toBe(false)
    expect(settled.error).toMatchObject({
      name: 'CatalogError',
      code: 'E-API-404',
      status: 404
    })
  })

  it('is a CatalogError instance, so callers can branch on the type', async () => {
    vi.useFakeTimers()
    getJson.mockRejectedValue(Object.assign(new Error('x'), { code: 'E-API-500', status: 500 }))
    getDocs.mockRejectedValue(new Error('denied'))

    const settled = await settle(fetchActiveProducts(), 4000)

    expect(settled.ok).toBe(false)
    expect(settled.error).toBeInstanceOf(CatalogError)
  })

  it('uses the direct read when the store has never built a snapshot', async () => {
    vi.useFakeTimers()
    getJson.mockRejectedValue(Object.assign(new Error('503'), { code: 'E-CATALOG-503', status: 503 }))
    getDocs.mockResolvedValue({ docs: [{ id: 'd1', data: () => ({ title: 'x' }) }] })

    const settled = await settle(fetchActiveProducts(), 4000)

    expect(settled.ok).toBe(true)
    expect(settled.value).toEqual({ products: [{ id: 'd1', title: 'x' }], stale: false })
  })

  /* --- backoff ------------------------------------------------------------- */

  it('retries a 500 three times with exponential backoff', async () => {
    vi.useFakeTimers()
    getJson.mockRejectedValue(Object.assign(new Error('down'), { code: 'E-API-500', status: 500 }))
    getDocs.mockRejectedValue(new Error('denied'))

    // 1s + 2s + 4s of backoff must elapse before it gives up.
    const settled = await settle(fetchActiveProducts(), 7000)

    expect(settled.ok).toBe(false)
    expect(settled.error).toBeInstanceOf(CatalogError)
    expect(getJson).toHaveBeenCalledTimes(3)
  })

  it('recovers when a retry succeeds', async () => {
    vi.useFakeTimers()
    getJson
      .mockRejectedValueOnce(Object.assign(new Error('blip'), { code: 'E-API-NETWORK' }))
      .mockResolvedValueOnce(snapshot([{ id: 'p1' }]))

    const settled = await settle(fetchActiveProducts(), 1200)

    expect(settled.ok).toBe(true)
    expect(settled.value).toMatchObject({ products: [{ id: 'p1' }], stale: false })
    expect(getJson).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry a 404 — the function is not deployed, it will not appear', async () => {
    vi.useFakeTimers()
    getJson.mockRejectedValue(Object.assign(new Error('gone'), { code: 'E-API-404', status: 404 }))
    getDocs.mockRejectedValue(new Error('denied'))

    const settled = await settle(fetchActiveProducts(), 10_000)

    expect(settled.ok).toBe(false)
    // One attempt, not three: burning 7s to reach the same 404 is worse than
    // failing fast.
    expect(getJson).toHaveBeenCalledTimes(1)
  })
})

/* ------------------------------------------------------------------------- */

describe('canonical sizes (P1.6)', () => {
  it('offers each size exactly once, in order', () => {
    expect(CANONICAL_SIZES).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'])
  })

  it('has no 2XL: XXL and 2XL are the same garment size', () => {
    expect(CANONICAL_SIZES).not.toContain('2XL')
  })

  it('the built-in fallback matches the canonical list', () => {
    expect(DEFAULT_TAXONOMY.sizes).toEqual(CANONICAL_SIZES)
  })

  it('folds 2XL onto XXL', () => {
    expect(canonicalSize('2XL')).toBe('XXL')
    expect(canonicalSize('2xl')).toBe('XXL')
  })

  it('deduplicates a list containing both XXL and 2XL', () => {
    expect(sortSizesCanonical(['2XL', 'XXL'])).toEqual(['XXL'])
  })

  it('sorts into canonical order regardless of input order', () => {
    expect(sortSizesCanonical(['3XL', 'S', 'XXL', 'XS', 'M', 'L', 'XL']))
      .toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'])
  })

  it('keeps an unknown label, at the end, rather than dropping it silently', () => {
    // A stray label is still a real size someone cut; hiding it would be worse
    // than showing it out of order.
    expect(sortSizesCanonical(['M', 'TALL', 'S'])).toEqual(['S', 'M', 'TALL'])
  })

  it('upper-cases and trims', () => {
    expect(canonicalSize('  xl ')).toBe('XL')
  })

  it('is empty-safe', () => {
    expect(sortSizesCanonical([])).toEqual([])
    expect(sortSizesCanonical([null, undefined, ''])).toEqual([])
  })
})
