// Store chrome: announcement bar, header, phone tab bar, menu drawer, search.
//
// One layout, mounted by App for every route except the splash, so navigation
// and the bag count are page-independent. Before this existed, Home and
// CartPage each rendered their own header.
//
// Presentational components come from src/ui; the data (language, theme, bag,
// wishlist, categories, settings) comes from the app's own contexts and
// services, so nothing in the design system knows about this store.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { fetchCategories } from '../services/catalog'
import { getFreeShippingThreshold } from '../services/settings'
import { formatPriceFor } from '../config/currency'
import { OfflineBanner } from '../ui/states'
import { useOnline } from '../hooks/useOnline'
import StoreFooter from './StoreFooter'
import {
  AnnouncementBar, Header, TabBar, IconChevron, IconClose, IconSearch, IconHome, IconShop,
  IconHeart, IconBag, IconMenu, IconGlobe, IconSun, IconMoon
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

// Offline message - fully translated per language
const OFFLINE_MESSAGES = {
  ar: 'انت غير متصل بالإنترنت. بنعرض المنتجات المحفوظة.',
  en: 'You are offline. Showing saved items.'
}

export default function StoreChrome({ children }) {
  const { t, lang, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { totalItems } = useCart()
  const { count: savedCount } = useWishlist()
  const location = useLocation()
  const navigate = useNavigate()

  const online = useOnline();
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState([])
  const [threshold, setThreshold] = useState(null)
  const [offlineDismissed, setOfflineDismissed] = useState(false)

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
    
    // Find gender categories by common IDs/names
    const genderOrder = ['women', 'men', 'kids']
    const genderRoots = genderOrder
      .map((g) => roots.find((r) => r.id === g || (r.name && (r.name.en?.toLowerCase() === g || r.name.ar?.includes(g)))))
      .filter(Boolean)
    
    // If no gender categories found, use first 3 root categories
    const middleItems = genderRoots.length === 3
      ? genderRoots
      : roots.slice(0, 3)
    
    const items = middleItems.map((root) => ({
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
          themeLabels={{
            light: L('lightMode', 'Light mode', 'الوضع النهاري'),
            dark: L('darkMode', 'Dark mode', 'الوضع الليلي')
          }}
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
          showing a grid that may be stale. Slim bar, dismissible. */}
      {!online && !offlineDismissed && (
        <OfflineBanner message={OFFLINE_MESSAGES[lang]} onDismiss={() => setOfflineDismissed(true)} />
      )}

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
  const panelRef = useRef(null)

  /* P1.8, the category tree.
   *
   * The previous code built the drawer from two sources and lost the shape in
   * between: it took the flat `nav` (New in, the gender roots, Sale) and then
   * tried to recover each root's children by PARSING THE HREF —
   * `n.href.split('category=')[1]`. That is an encodeURIComponent round trip
   * dressed up as data, and it failed twice over: the two synthetic entries
   * have no `category=` at all, and a real category id came back percent-
   * encoded, so the lookup never matched and the sub-links never rendered.
   * With an empty `categories` array the drawer showed two links and no tree,
   * which is what the review saw.
   *
   * `nav` already carries `children` per root — built by the same documents —
   * so the tree is read straight off it. No parsing, no double-decoding, and
   * the drawer cannot disagree with the header, because they are the same
   * object. Depth is capped at two levels (root -> child); a category nested
   * deeper than that is a data problem, not a UI one.
   *
   * Each root is a disclosure rather than a link with a list dumped beneath it:
   * the row stays a link to the category's own listing (so it works with the
   * drawer shut and middle-click does what it should) and a separate 44px
   * button owns the expanded state, announced via aria-expanded. */
  const treeFor = useMemo(
    () =>
      nav
        .map((n) => ({ ...n, kids: n.children ?? [] }))
        .filter((n) => n.kids.length > 0),
    [nav]
  )
  void categories

  const [openRoots, setOpenRoots] = useState(() => new Set())
  const isOpen = (href) => openRoots.has(href)
  const toggle = (href) =>
    setOpenRoots((prev) => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })

  // Scroll lock, so the page behind cannot be scrolled by the wheel while the
  // drawer covers half of it.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  /* Focus trap, and focus restoration.
   *
   * A drawer that declares aria-modal="true" but lets Tab walk out into the
   * page behind it is worse than no drawer at all: a keyboard user tabs past
   * the last control and lands on the header they cannot see, with nothing to
   * tell them they have left. So:
   *   1. Tab and Shift+Tab cycle inside the panel.
   *   2. On close, focus returns to whatever opened the drawer — otherwise it
   *      lands on <body> and the next Tab starts again from the top of the
   *      document, which reads to a screen-reader user as the page reloading.
   * Escape and the backdrop already closed the drawer (the parent owns both);
   * this adds the missing third leg. */
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return undefined

    const opener = document.activeElement

    const focusables = () =>
      [...panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((el) => el.getClientRects().length > 0)

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }

    panel.addEventListener('keydown', onKeyDown)
    return () => {
      panel.removeEventListener('keydown', onKeyDown)
      // Only restore if focus is still inside the drawer or nowhere useful:
      // if the shopper clicked a link and the route changed, moving focus back
      // to the menu button would yank them out of the page they just opened.
      if (opener && document.activeElement && (document.body === document.activeElement)) {
        opener.focus?.()
      } else if (opener && panel.contains(document.activeElement)) {
        opener.focus?.()
      }
    }
  }, [])

  return (
    <>
      <div className="pa-drawer-backdrop" onClick={onClose} />
      <aside
        className="pa-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={L('menu', 'Menu', 'القائمة')}
        ref={panelRef}
      >
        <div className="pa-drawer__head">
          <span className="pa-logo">PROACTIVE</span>
          <button type="button" className="pa-icon-btn" style={{ width: 44, height: 44 }}
            aria-label={L('close', 'Close', 'إغلاق')} onClick={onClose} autoFocus>
            <IconClose width={22} height={22} />
          </button>
        </div>

        <div className="pa-drawer__body">
          <nav className="pa-drawer__group" aria-label={L('shop', 'Shop', 'المنتجات')}>
            {nav.map((n) => {
              const hasKids = treeFor.some((t) => t.href === n.href)
              return (
                <span key={n.href} className="pa-drawer__item">
                  <span className="pa-drawer__item-row">
                    <Link to={n.href} className="pa-drawer__row" onClick={onClose}>{n.label}</Link>
                    {hasKids && (
                      <button
                        type="button"
                        className="pa-drawer__expand"
                        aria-expanded={isOpen(n.href)}
                        onClick={() => toggle(n.href)}
                      >
                        <IconChevron
                          dir="down"
                          width={16}
                          height={16}
                          aria-hidden="true"
                          style={{ transform: isOpen(n.href) ? 'rotate(180deg)' : undefined }}
                        />
                        <span className="pa-sr">
                          {isOpen(n.href)
                            ? L('collapse', 'Collapse', 'طيّ')
                            : L('expand', 'Expand', 'فتح')}
                        </span>
                      </button>
                    )}
                  </span>
                  {hasKids && isOpen(n.href) && (
                    <span className="pa-drawer__tree">
                      {treeFor.find((t) => t.href === n.href).kids.map((c) => (
                        <Link key={c.href} to={c.href} className="pa-drawer__sub" onClick={onClose}>
                          {c.label}
                        </Link>
                      ))}
                    </span>
                  )}
                </span>
              )
            })}
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

        {/* P1.4: the language toggle used to render as a bare "العربية" link
            sitting between "المفضلة" and "عنّا" in the body of the drawer, where
            it read as a fifth navigation destination rather than a control —
            and in Arabic the word is the same one the real toggle uses, so the
            drawer appeared to have two language links.

            It now lives in the drawer's foot, alongside the theme control,
            with an icon and an action-named aria-label. Same rules as the
            footer: language switching happens in exactly one place per screen. */}
        <div className="pa-drawer__foot">
          <button
            type="button"
            className="pa-footer__toggle"
            onClick={() => onLang()}
            lang={lang === 'ar' ? 'en' : 'ar'}
            aria-label={lang === 'ar'
              ? L('switchToEnglish', 'Switch to English', 'التبديل للإنجليزية')
              : L('switchToArabic', 'Switch to Arabic', 'التبديل للعربية')}
          >
            <IconGlobe width={16} height={16} aria-hidden="true" />
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          <button
            type="button"
            className="pa-footer__toggle"
            onClick={() => onTheme()}
            aria-pressed={theme === 'dark'}
            aria-label={theme === 'dark'
              ? L('lightMode', 'Light mode', 'الوضع النهاري')
              : L('darkMode', 'Dark mode', 'الوضع الليلي')}
          >
            {theme === 'dark'
              ? <IconSun width={16} height={16} aria-hidden="true" />
              : <IconMoon width={16} height={16} aria-hidden="true" />}
            {theme === 'dark'
              ? L('lightMode', 'Light mode', 'الوضع النهاري')
              : L('darkMode', 'Dark mode', 'الوضع الليلي')}
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
