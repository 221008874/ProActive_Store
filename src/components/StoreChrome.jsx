// Store chrome: announcement bar, header, phone tab bar and the two sheets the
// header buttons open.
//
// Before this file the chrome did not exist at app level — Home rendered its own
// header over its hero and CartPage rendered another one, so navigation and the
// bag count were page-local. This moves both to a single layout so they are the
// same on every route, and routes `dir`/`lang` through the design system's
// logical properties.
//
// Presentational components come from src/ui (the ProActive Fashion design
// system); the data (lang, bag count, search results) comes from the app's own
// contexts, so nothing in the design system needs to know about this store.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import { db } from '../services/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { CURRENCY, formatPrice } from '../config/currency'
import {
  AnnouncementBar,
  Header,
  TabBar,
  ProductGrid,
  ProductCard,
  IconClose
} from '../ui'

// t() returns the key itself when a translation is missing, which doubles as the
// app's "is this key defined" test. Lets the chrome render sensible copy without
// editing the 550-line translation table for a dozen strings.
const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function StoreChrome({ children }) {
  const { t, lang, toggleLanguage } = useLanguage()
  const { totalItems } = useCart()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const L = label(t, lang)
  const announce = lang === 'ar'
    ? `شحن مجاني للطلبات فوق ${formatPrice(CURRENCY.freeShippingThreshold)}`
    : `Free shipping over ${formatPrice(CURRENCY.freeShippingThreshold)}`

  // Real routes only. The design board's nav (New in / Women / Men / Kids / Sale)
  // has no matching page in this store, so nothing is invented for it.
  const nav = [
    { label: L('backToHome', 'Home', 'الرئيسية'), href: '/home' },
    { label: L('aboutUs', 'About', 'عنّا'), href: '/about' },
    { label: L(null, 'Cart', 'العربية'), href: '/cart' }
  ]
  const navLabels = {
    menu: L('menu', 'Menu', 'القائمة'),
    search: L('search', 'Search', 'بحث'),
    bag: L('cart', 'Cart', 'العربية')
  }

  const tabActive = (() => {
    const p = location.pathname
    if (p.startsWith('/cart')) return 'bag'
    if (p.startsWith('/about') || p.startsWith('/terms-of-service') || p.startsWith('/privacy')) return 'saved'
    return 'home'
  })()

  // Escape closes an open sheet; the page behind it is locked while one is up.
  useEffect(() => {
    if (!menuOpen && !searchOpen) return
    const onKey = (e) => { if (e.key === 'Escape') { setMenuOpen(false); setSearchOpen(false) } }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [menuOpen, searchOpen])

  return (
    <>
      <AnnouncementBar text={announce} lang={lang} onLang={toggleLanguage} />

      <Header
        as={Link}
        bagCount={totalItems}
        nav={nav}
        onMenu={() => setMenuOpen(true)}
        onSearch={() => setSearchOpen(true)}
        searchPlaceholder={L(null, 'Search dresses, tops, trousers', 'ابحث عن فستان، بلوزة، بنطلون')}
        labels={navLabels}
      />

      {/* pa-has-tabbar reserves the 64px the fixed bottom bar covers. */}
      <div className="pa-has-tabbar">{children}</div>

      <TabBar
        as={Link}
        active={tabActive}
        hrefs={{ home: '/home', shop: '/home', saved: '/about', bag: '/cart', menu: '#menu' }}
        labels={{
          home: L('home', 'Home', 'الرئيسية'),
          shop: L('products', 'Shop', 'المنتجات'),
          saved: L('aboutUs', 'About', 'عنّا'),
          bag: L('cart', 'Cart', 'العربية'),
          menu: L('menu', 'Menu', 'القائمة')
        }}
      />

      {menuOpen && <MenuSheet onClose={() => setMenuOpen(false)} nav={nav} onLang={toggleLanguage} />}
      {searchOpen && <SearchSheet onClose={() => setSearchOpen(false)} />}
    </>
  )
}

const Sheet = ({ onClose, title, children }) => (
  <>
    <div className="pa-sheet-backdrop" onClick={onClose} />
    <div className="pa-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pa-sheet__title">
        <span>{title}</span>
        <button type="button" className="pa-icon-btn" style={{ width: 44, height: 44 }} aria-label="Close" onClick={onClose}>
          <IconClose width={22} height={22} />
        </button>
      </div>
      {children}
    </div>
  </>
)

function MenuSheet({ onClose, nav, onLang }) {
  const { t, lang } = useLanguage()
  const { totalItems } = useCart()
  const L = label(t, lang)

  return (
    <Sheet onClose={onClose} title={L('menu', 'Menu', 'القائمة')}>
      <nav style={{ display: 'flex', flexDirection: 'column' }}>
        {nav.map((n) => (
          <Link key={n.href} to={n.href} onClick={onClose} className="pa-btn pa-btn--outline pa-btn--block pa-btn--admin">
            {n.label}
          </Link>
        ))}
        <Link to="/cart" onClick={onClose} className="pa-btn pa-btn--block pa-btn--admin">
          {L('cart', 'Cart', 'العربية')}
          {totalItems > 0 && <span className="pa-count">{totalItems}</span>}
        </Link>
      </nav>
      <button type="button" className="pa-btn pa-btn--outline pa-btn--block pa-btn--admin" onClick={onLang}>
        {lang === 'ar' ? 'English' : 'العربية'}
      </button>
    </Sheet>
  )
}

function SearchSheet({ onClose }) {
  const { t, lang } = useLanguage()
  const L = label(t, lang)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const debounce = useRef(null)

  const search = useCallback(async (term) => {
    const query = term.trim().toLowerCase()
    if (!query) { setResults([]); return }
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, CURRENCY.collection))
      // Titles are {ar,en} objects; match the serialised pair so either script hits.
      const hits = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => JSON.stringify([p.title, p.tags ?? []]).toLowerCase().includes(query))
        .slice(0, 24)
      setResults(hits)
    } catch (err) {
      console.error('Search failed', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(q), 250)
    return () => clearTimeout(debounce.current)
  }, [q, search])

  return (
    <Sheet onClose={onClose} title={L('search', 'Search', 'بحث')}>
      <div className="pa-field">
        <input
          className="pa-input"
          type="search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={L('search', 'Search', 'بحث')}
        />
      </div>
      {loading && <div className="pa-subtitle">{L('loading', 'Loading…', 'جاري التحميل…')}</div>}
      {!loading && q.trim() && results.length === 0 && (
        <div className="pa-subtitle">{L('noProductsAvailable', 'No products found', 'مفيش منتجات')}</div>
      )}
      {/* Closing on click (not preventing it) lets the card's own Link navigate. */}
      <div onClick={onClose}>
        <ProductGrid>
          {results.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              lang={lang}
              as={Link}
              href={`/product/${p.id}`}
            />
          ))}
        </ProductGrid>
      </div>
    </Sheet>
  )
}
