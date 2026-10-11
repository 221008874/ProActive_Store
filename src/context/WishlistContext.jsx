// Wishlist.
//
// The design stores it in localStorage for now: no account exists to attach it
// to, and a shopper's saved items should survive a reload without a login. The
// shape is a set of product ids, because a product is what a heart belongs to —
// the colour and size are chosen on the product page, not in the rail.
//
// Keys are versioned (`wishlist_v1`) so a change to the stored shape drops the
// old list instead of mis-reading it.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'wishlist_v1'

/**
 * Parse a stored wishlist. Exported so the rule is testable without a DOM:
 * a malformed store (an older shape, a corrupted value, a non-array) must read
 * as "nothing saved" rather than throwing and taking the page down with it.
 */
export function parseStoredWishlist(raw) {
  if (typeof raw !== 'string' || raw === '') return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((id) => typeof id === 'string' && id))]
  } catch {
    return []
  }
}

const read = () => parseStoredWishlist(localStorage.getItem(STORAGE_KEY))

const write = (ids) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Private mode / quota: the wishlist becomes session-only rather than
    // failing the toggle.
  }
}

const WishlistContext = createContext(null)

export function WishlistProvider({ children }) {
  // Initial state from storage so the first paint already shows saved hearts.
  const [ids, setIds] = useState(read)

  useEffect(() => { write(ids) }, [ids])

  // A second tab may save the same product; mirrored so both agree.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setIds(read()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback((productId) => {
    setIds((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]))
  }, [])

  const remove = useCallback((productId) => {
    setIds((prev) => prev.filter((id) => id !== productId))
  }, [])

  const value = useMemo(() => ({
    ids,
    count: ids.length,
    has: (productId) => ids.includes(productId),
    toggle,
    remove,
    clear: () => setIds([])
  }), [ids, toggle, remove])

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  return useContext(WishlistContext) ?? {
    ids: [], count: 0, has: () => false, toggle: () => {},
    remove: () => {}, clear: () => {}
  }
}
