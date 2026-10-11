// Store chrome: announcement bar, header, phone tab bar, menu drawer, search.
//
// One layout, mounted by App for every route except the splash, so navigation
// and the bag count are page-independent. Before this existed, Home and
// CartPage each rendered their own header.
//
// Presentational components come from src/ui; the data (language, theme, bag,
// wishlist, categories, settings) comes from the app's own contexts and
// services, so nothing in the design system knows about this store.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { fetchCategories } from '../services/catalog'
import { getFreeShippingThreshold } from '../services/settings'
import { formatPriceFor } from '../config/currency'
import { OfflineBanner } from '../ui/states'
import StoreFooter from './StoreFooter'
import {
  AnnouncementBar, Header, TabBar, IconClose, IconSearch, IconHome, IconShop, IconHeart, IconBag, IconMenu
} from '../ui'

// t() returns the key itself when a translation is missing, which doubles as the
// app's "is this key defined" test. Lets the chrome render sensible copy without
// editing the 208-key table for every label.
const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function StoreChrome({ children }) {
  const { t, lang, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { totalItems } = useCart()
  const { count: savedCount } = useWishlist()
  const location = useLocation()
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState([])
  const [threshold, setThreshold] = useState(null)

  const L = label(t, lang)

  // Free-shipping threshold and the category tree are shell-wide, so they are
  // read once here rather than per page. A failure is not fatal: the store's
  // default threshold and an empty mega-menu are both fine.
  useEffect(() => {
    let alive = true
    getFreeShippingThreshold().then((v) => { if (alive) setThreshold(v) }).catch(() => {})
    fetchCategories().then((list) => { if (alive) setCategories(list) }).catch(() => {})
    return () => { alive = false }
  }, [])

  // Announcement copy. The threshold comes from the settings document, so the
  // store's real number is what a shopper reads.
  const announce = threshold
    ? (lang === 'ar'
      ? `شحن مجاني للطلبات فوق ${formatPriceFor(threshold, lang)}`
      : `Free shipping over ${formatPriceFor(threshold, lang)}`)
    : (lang === 'ar' ? 'شحن مجاني للطلبات الكبيرة' : 'Free shipping on qualifying orders')

  // Desktop nav. The design board lists New in / Women / Men / Kids / Sale;
  // the store's real taxonomy comes from `categories`, so a top-level category
  // becomes a nav entry with its children as a mega-menu rather than inventing
  // a section that has no products behind it.
  const nav = useMemo(() => {
    const byParent = (parentId) =>
      categories.filter((c) => (c.parentId ?? null) === parentId).map((c) => ({
        label: c.name ? (c.name[lang] ?? c.name.en ?? c.id) : c.id,
        href: `/shop?category=${encodeURIComponent(c.id)}`
      }))

    const roots = categories.filter((c) => !c.parentId || !categories.some((p) => p.id === c.parentId))
    const items = roots.slice(0, 4).map((root) => ({
      label: root.name ? (root.name[lang] ?? root.name.en ?? root.id) : root.id,
      href: `/shop?category=${encodeURIComponent(root.id)}`,
      children: byParent(root.id)
    }))

    const newIn = { label: L('newIn', 'New in', 'وصل حديثاً'), href: '/shop?sort=newest' }
    const sale = { label: L('sale', 'Sale', 'تخفيضات'), href: '/shop?sale=1', sale: true }
    return [newIn, ...items, sale]
  }, [categories, lang, L])

  const tabItems = [
    { key: 'home', label: L('home', 'Home', 'الرئيسية'), href: '/home', Icon: IconHome },
    { key: 'shop', label: L('products', 'Shop', 'المنتجات'), href: '/shop', Icon: IconShop },
    { key: 'saved', label: L('saved', 'Saved', 'المفضلة'), href: '/saved', Icon: IconHeart },
    { key: 'bag', label: L('cart', 'Bag', 'العربية'), href: '/cart', Icon: IconBag },
    { key: 'menu', label: L('menu', 'Menu', 'القائمة'), href: '#menu', Icon: IconMenu }
  ]

  const tabActive = (() => {
    const p = location.pathname
    if (p.startsWith('/cart') || p.startsWith('/order-success')) return 'bag'
    if (p.startsWith('/saved')) return 'saved'
    if (p.startsWith('/shop') || p.startsWith('/product')) return 'shop'
    return 'home'
  })()

  // Escape closes an open overlay; the page behind one is locked while it is up.
  useEffect(() => {
    if (!menuOpen && !searchOpen) return
    const onKey = (e) => { if (e.key === 'Escape') { setMenuOpen(false); setSearchOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, searchOpen])

  const runSearch = useCallback((raw) => {
    const q = String(raw ?? '').trim()
    if (!q) return
    navigate(`/shop?q=${encodeURIComponent(q)}`)
    setSearchOpen(false)
  }, [navigate])

  return (
    <>
      <AnnouncementBar
        text={announce}
        lang={lang}
        onLang={toggleLanguage}
        theme={theme}
        onTheme={toggleTheme}
        themeLabels={{ light: L('light', 'Light', 'نهاري'), dark: L('dark', 'Dark', 'ليلي') }}
      />

      <Header
        as={Link}
        bagCount={totalItems}
        savedCount={savedCount}
        nav={nav}
        onMenu={() => setMenuOpen(true)}
        onSearch={() => setSearchOpen(true)}
        onSearchChange={setQuery}
        onSearchSubmit={runSearch}
        searchValue={query}
        searchPlaceholder={L('searchPlaceholder', 'Search dresses, tops, trousers', 'ابحث عن فستان، بلوزة، بنطلون')}
        labels={{
          menu: L('menu', 'Menu', 'القائمة'),
          search: L('search', 'Search', 'بحث'),
          bag: L('cart', 'Cart', 'العربية'),
          saved: L('saved', 'Saved', 'المفضلة')
        }}
      />

      {/* Offline: the catalogue survives in IndexedDB, so say so instead of
          showing a grid that may be stale. */}
      <OfflineBanner message={L('offline', 'You are offline. Showing saved items.', 'انت offline. بنعرض المنتجات المحفوظة.')} />

      {/* pa-has-tabbar reserves the 64px the fixed bottom bar covers. */}
      <div className="pa-has-tabbar">{children}</div>

      <TabBar items={tabItems} active={tabActive} as={Link} onSelect={(k) => k === 'menu' && setMenuOpen(true)} />

      {menuOpen && (
        <MenuDrawer
          onClose={() => setMenuOpen(false)}
          categories={categories}
          nav={nav}
          onLang={toggleLanguage}
          lang={lang}
          theme={theme}
          onTheme={toggleTheme}
        />
      )}
      {searchOpen && <SearchSheet onClose={() => setSearchOpen(false)} onSearch={runSearch} />}

      <StoreFooter />
    </>
  )
}

/* -------------------------------------------------------------------------- */

function MenuDrawer({ onClose, categories, nav, onLang, lang, theme, onTheme }) {
  const { t } = useLanguage()
  const { totalItems } = useCart()
  const L = label(t, lang)

  const childrenOf = (id) => categories.filter((c) => c.parentId === id)

  // Focus starts on the close button so a keyboard user is not dropped into the
  // middle of the tree; Escape and the backdrop both close.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <>
      <div className="pa-drawer-backdrop" onClick={onClose} />
      <aside className="pa-drawer" role="dialog" aria-modal="true" aria-label={L('menu', 'Menu', 'القائمة')}>
        <div className="pa-drawer__head">
          <span className="pa-logo">PROACTIVE</span>
          <button type="button" className="pa-icon-btn" style={{ width: 44, height: 44 }}
            aria-label={L('close', 'Close', 'إغلاق')} onClick={onClose} autoFocus>
            <IconClose width={22} height={22} />
          </button>
        </div>

        <div className="pa-drawer__body">
          <nav className="pa-drawer__group" aria-label={L('shop', 'Shop', 'المنتجات')}>
            {nav.map((n) => (
              <span key={n.href} className="pa-drawer__group">
                <Link to={n.href} className="pa-drawer__row" onClick={onClose}>{n.label}</Link>
                {childrenOf(n.href.split('category=')[1] ?? '').map((c) => (
                  <Link key={c.id} to={`/shop?category=${encodeURIComponent(c.id)}`} className="pa-drawer__sub" onClick={onClose}>
                    {c.name ? (c.name[lang] ?? c.name.en ?? c.id) : c.id}
                  </Link>
                ))}
              </span>
            ))}
          </nav>

          <nav className="pa-drawer__group" aria-label={L('menu', 'Menu', 'القائمة')}>
            <Link to="/home" className="pa-drawer__row" onClick={onClose}>{L('home', 'Home', 'الرئيسية')}</Link>
            <Link to="/shop" className="pa-drawer__row" onClick={onClose}>{L('products', 'Shop', 'المنتجات')}</Link>
            <Link to="/saved" className="pa-drawer__row" onClick={onClose}>{L('saved', 'Saved', 'المفضلة')}</Link>
            <Link to="/cart" className="pa-drawer__row" onClick={onClose}>
              {L('cart', 'Bag', 'العربية')}{totalItems > 0 && <span className="pa-count">{totalItems}</span>}
            </Link>
          </nav>

          <nav className="pa-drawer__group" aria-label={L('help', 'Help', 'مساعدة')}>
            <Link to="/about" className="pa-drawer__row" onClick={onClose}>{L('aboutUs', 'About', 'عنّا')}</Link>
            <Link to="/terms-of-service" className="pa-drawer__row" onClick={onClose}>{L('termsOfService', 'Terms', 'الشروط')}</Link>
            <Link to="/privacy" className="pa-drawer__row" onClick={onClose}>{L('privacy', 'Privacy', 'الخصوصية')}</Link>
          </nav>
        </div>

        <div className="pa-drawer__foot">
          <button type="button" className="pa-footer__toggle" onClick={() => onLang()}>
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          <button type="button" className="pa-footer__toggle" onClick={() => onTheme()}>
            {theme === 'dark' ? L('light', 'Light', 'نهاري') : L('dark', 'Dark', 'ليلي')}
          </button>
        </div>
      </aside>
    </>
  )
}

function SearchSheet({ onClose, onSearch }) {
  const { t, lang } = useLanguage()
  const [q, setQ] = useState('')
  const L = label(t, lang)

  return (
    <>
      <div className="pa-sheet-backdrop" onClick={onClose} />
      <div className="pa-sheet pa-sheet--open" role="dialog" aria-modal="true" aria-label={L('search', 'Search', 'بحث')}>
        <div className="pa-sheet__grip" aria-hidden="true" />
        <div className="pa-sheet__head">
          <h2 className="pa-sheet__title">{L('search', 'Search', 'بحث')}</h2>
          <button type="button" className="pa-icon-btn" style={{ width: 44, height: 44 }}
            aria-label={L('close', 'Close', 'إغلاق')} onClick={onClose}>
            <IconClose width={22} height={22} />
          </button>
        </div>
        {/* Submitting navigates to /shop?q=, which is the single place search
            results are rendered — so the results page is shareable and the
            back button behaves. */}
        <form className="pa-sheet__body" onSubmit={(e) => { e.preventDefault(); onSearch(q) }}>
          <div className="pa-field">
            <label className="pa-label" htmlFor="chrome-search">{L('search', 'Search', 'بحث')}</label>
            <input
              id="chrome-search"
              className="pa-input"
              type="search"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={L('searchPlaceholder', 'Search dresses, tops, trousers', 'ابحث عن فستان، بلوزة، بنطلون')}
            />
          </div>
          <button type="submit" className="pa-btn pa-btn--lg pa-btn--block">
            <IconSearch width={18} height={18} />
            {L('search', 'Search', 'بحث')}
          </button>
        </form>
      </div>
    </>
  )
}
