import { describe, it, expect } from 'vitest'
import { parseStoredWishlist } from '../context/WishlistContext'

// The wishlist is the store's first client-side-only state, so its storage rule
// is pinned here: a malformed or older-shaped store must read as "nothing
// saved" rather than throwing and taking the page down with it, and duplicate
// ids collapse because one product gets one heart.

describe('parseStoredWishlist', () => {
  it('reads a plain array of ids', () => {
    expect(parseStoredWishlist(JSON.stringify(['a', 'b']))).toEqual(['a', 'b'])
  })

  it('collapses duplicates, so one product gets one heart', () => {
    expect(parseStoredWishlist(JSON.stringify(['a', 'b', 'a']))).toEqual(['a', 'b'])
  })

  it('keeps only string ids', () => {
    expect(parseStoredWishlist(JSON.stringify(['a', 42, null, 'b', {}, '']))).toEqual(['a', 'b'])
  })

  it('treats a non-array payload as empty', () => {
    expect(parseStoredWishlist(JSON.stringify({ a: 1 }))).toEqual([])
    expect(parseStoredWishlist(JSON.stringify('nope'))).toEqual([])
    expect(parseStoredWishlist(JSON.stringify(7))).toEqual([])
  })

  it('treats invalid JSON, a missing key and a non-string as empty', () => {
    expect(parseStoredWishlist('not json')).toEqual([])
    expect(parseStoredWishlist('')).toEqual([])
    expect(parseStoredWishlist(null)).toEqual([])
    expect(parseStoredWishlist(undefined)).toEqual([])
  })

  it('does not mutate its input beyond returning a fresh array', () => {
    const raw = JSON.stringify(['a', 'a'])
    const first = parseStoredWishlist(raw)
    const second = parseStoredWishlist(raw)
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
  })
})
