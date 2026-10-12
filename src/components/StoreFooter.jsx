// Store footer.
//
// Four columns on desktop (brand · shop · help · delivery note), stacked on a
// phone with the language and theme buttons as real 44px controls so they are
// reachable without the announcement bar (which is desktop-only for the theme).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useWishlist } from '../context/WishlistContext'
import { formatPriceFor, CURRENCY } from '../config/currency'
import { getWhatsAppNumber } from '../services/settings'
import { IconGlobe, IconMoon, IconSun, IconWhatsApp } from '../ui'

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
  const { count: savedCount } = useWishlist()
  const ar = lang === 'ar'
  const L = label(t, lang)

  const shopLinks = [
    { label: L('products', 'All products', 'كل المنتجات'), href: '/shop' },
    { label: L('newIn', 'New in', 'وصل حديثاً'), href: '/shop?sort=newest' },
    { label: L('sale', 'Sale', 'تخفيضات'), href: '/shop?sale=1' },
    { label: L('saved', 'Saved', 'المفضلة'), href: '/saved' }
  ]
  /* P1.4: the "Help" column used to end with a link labelled "العربية" /
     "Bag" pointing at /cart. In Arabic that reads as "Arabic" — the same word
     as the language toggle three lines above it — so the footer appeared to
     offer two different language controls, one of which navigated to the bag.
     English was less confusing but still wrong: "Bag" is a shop destination,
     not a help topic, and it duplicates the bag button in the header.

     Language switching belongs to the toggle and nothing else; the bag belongs
     to the header, the tab bar and /cart. Both links are removed rather than
     relabelled, because there was no correct label to relabel them to. */
  const helpLinks = [
    { label: L('aboutUs', 'About', 'عنّا'), href: '/about' },
    { label: L('termsOfService', 'Terms of service', 'شروط الخدمة'), href: '/terms-of-service' },
    { label: L('privacy', 'Privacy', 'الخصوصية'), href: '/privacy' }
  ]

  const totalGovernorates = 27

  const [whatsAppNumber, setWhatsAppNumber] = useState(null)
  useEffect(() => {
    getWhatsAppNumber().then(setWhatsAppNumber)
  }, [])

  return (
    <footer className="pa-footer">
      <div className="pa-container pa-footer__inner">
        <div className="pa-footer__col">
          <div className="pa-footer__brand">
            <b style={{ fontSize: 18, letterSpacing: '.04em' }}>PROACTIVE</b>
          </div>
          <p className="pa-subtitle" style={{ margin: 0, maxWidth: '34ch' }}>
            {L('footerTagline', 'Carefully chosen pieces, delivered to your door.', 'قطع مختارة بعناية، بتوصل لبابك.')}
          </p>
          {/* P1.4: these were bare words — "English" and a bare "ليلي" — with
              no icon, and the theme one carried no pressed state, so a screen
              reader announced a control whose label changed depending on the
              mode it was about to switch *away* from.

              Both now name the ACTION ("switch to Light mode") and expose
              aria-pressed for the state they are in. The visible text names the
              destination too, so the button and the announcement agree. */}
          <div className="pa-footer__toggles">
            <button
              type="button"
              className="pa-footer__toggle"
              onClick={() => toggleLanguage()}
              lang={ar ? 'en' : 'ar'}
              aria-label={ar ? L('switchToEnglish', 'Switch to English', 'التبديل للإنجليزية')
                              : L('switchToArabic', 'Switch to Arabic', 'التبديل للعربية')}
            >
              <IconGlobe width={16} height={16} aria-hidden="true" />
              {ar ? 'English' : 'العربية'}
            </button>
            <button
              type="button"
              className="pa-footer__toggle"
              onClick={() => toggleTheme()}
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
        </div>

        {/* WhatsApp contact column — only renders when the owner has set a number. */}
        {whatsAppNumber && (
          <div className="pa-footer__col">
            <div className="pa-footer__title">{L('contactWhatsApp', 'WhatsApp', 'واتساب')}</div>
            <a
              className="pa-footer__whatsapp"
              href={`https://wa.me/${whatsAppNumber.replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={L('contactWhatsAppAria', 'Message us on WhatsApp', 'راسلنا على واتساب')}
            >
              <IconWhatsApp width={20} height={20} aria-hidden="true" />
              <span>WhatsApp</span>
            </a>
          </div>
        )}

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
          {/* P1.4: a fourth line used to sit here printing the live bag count as
              "0 في العربية". Three problems: it answered a question this column
              does not own, "0" reads as a broken counter rather than an empty
              bag, and the Arabic label is identical to the language toggle's.

              The count has three better homes already — the header badge, the
              tab bar and /cart — and it only ever appears when the bag has
              something in it. Removed rather than relabelled. */}
          {savedCount > 0 && (
            <span className="pa-subtitle">
              {ar ? `${savedCount} في المفضلة` : `${savedCount} saved`}
            </span>
          )}
        </div>
      </div>
    </footer>
  )
}
