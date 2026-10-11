// Store footer.
//
// Four columns on desktop (brand · shop · help · delivery note), stacked on a
// phone with the language and theme buttons as real 44px controls so they are
// reachable without the announcement bar (which is desktop-only for the theme).

import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { formatPriceFor } from '../config/currency'
import { CURRENCY } from '../config/currency'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function StoreFooter() {
  const { t, lang, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { totalItems } = useCart()
  const { count: savedCount } = useWishlist()
  const ar = lang === 'ar'
  const L = label(t, lang)

  const shopLinks = [
    { label: L('products', 'All products', 'كل المنتجات'), href: '/shop' },
    { label: L('newIn', 'New in', 'وصل حديثاً'), href: '/shop?sort=newest' },
    { label: L('sale', 'Sale', 'تخفيضات'), href: '/shop?sale=1' },
    { label: L('saved', 'Saved', 'المفضلة'), href: '/saved' }
  ]
  const helpLinks = [
    { label: L('aboutUs', 'About', 'عنّا'), href: '/about' },
    { label: L('termsOfService', 'Terms of service', 'شروط الخدمة'), href: '/terms-of-service' },
    { label: L('privacy', 'Privacy', 'الخصوصية'), href: '/privacy' },
    { label: L('cart', 'Bag', 'العربية'), href: '/cart' }
  ]

  const totalGovernorates = 27

  return (
    <footer className="pa-footer">
      <div className="pa-footer__col">
        <div className="pa-footer__brand">
          <b style={{ fontSize: 18, letterSpacing: '.04em' }}>PROACTIVE</b>
        </div>
        <p className="pa-subtitle" style={{ margin: 0, maxWidth: '34ch' }}>
          {L('footerTagline', 'Carefully chosen pieces, delivered to your door.', 'قطع مختارة بعناية، بتوصل لبابك.')}
        </p>
        <div className="pa-footer__toggles">
          <button type="button" className="pa-footer__toggle" onClick={() => toggleLanguage()} aria-label={L('language', 'Language', 'اللغة')}>
            {ar ? 'English' : 'العربية'}
          </button>
          <button type="button" className="pa-footer__toggle" onClick={() => toggleTheme()}
            aria-label={theme === 'dark' ? L('light', 'Light', 'نهاري') : L('dark', 'Dark', 'ليلي')}>
            {theme === 'dark' ? L('light', 'Light', 'نهاري') : L('dark', 'Dark', 'ليلي')}
          </button>
        </div>
      </div>

      <div className="pa-footer__col">
        <div className="pa-footer__title">{L('shop', 'Shop', 'تسوّق')}</div>
        {shopLinks.map((l) => <Link key={l.href} to={l.href}>{l.label}</Link>)}
      </div>

      <div className="pa-footer__col">
        <div className="pa-footer__title">{L('help', 'Help', 'مساعدة')}</div>
        {helpLinks.map((l) => <Link key={l.href} to={l.href}>{l.label}</Link>)}
      </div>

      <div className="pa-footer__col">
        <div className="pa-footer__title">{L('delivery', 'Delivery', 'التوصيل')}</div>
        {/* The delivery promise is a fact about the store, so it is stated
            plainly: cash on delivery, all 27 governorates, free above the
            threshold the setting document carries. */}
        <span className="pa-subtitle">
          {L('codAllGovernorates', 'Cash on delivery', 'الدفع عند الاستلام')} ·{' '}
          {ar ? `لكل الـ ${totalGovernorates} محافظة` : `all ${totalGovernorates} governorates`}
        </span>
        <span className="pa-subtitle">
          {L('freeShippingOver', 'Free shipping over', 'شحن مجاني للطلبات فوق')}{' '}
          <bdi>{formatPriceFor(CURRENCY.freeShippingThreshold, lang)}</bdi>
        </span>
        <span className="pa-subtitle">
          {ar ? `${totalItems} في العربية` : `${totalItems} in bag`}
          {savedCount > 0 && (ar ? ` · ${savedCount} مفضلة` : ` · ${savedCount} saved`)}
        </span>
      </div>
    </footer>
  )
}
