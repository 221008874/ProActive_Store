// Store footer. Uses the design system's `.pa-footer` block; the social icons
// stay as the app's own PNG assets because the design system has no social set.

import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import facebookIcon from '../assets/facebook.png'
import instagramIcon from '../assets/instagram.png'
import twitterIcon from '../assets/twitter.png'
import whatsappIcon from '../assets/whatsapp.png'

export default function StoreFooter() {
  const { t, lang } = useLanguage()
  const { getImage } = useTheme()
  const ar = lang === 'ar'

  const env = (v, fb) => (v && v !== undefined ? v : fb)

  const links = [
    { label: t('aboutUs') !== 'aboutUs' ? t('aboutUs') : (ar ? 'عنّا' : 'About'), href: '/about' },
    { label: t('termsOfService') !== 'termsOfService' ? t('termsOfService') : (ar ? 'شروط الخدمة' : 'Terms of service'), href: '/terms-of-service' },
    { label: t('privacy') !== 'privacy' ? t('privacy') : (ar ? 'الخصوصية' : 'Privacy'), href: '/privacy' }
  ]

  const socials = [
    { icon: facebookIcon, name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61584722189527&mibextid=ZbWKwL' },
    { icon: instagramIcon, name: 'Instagram', href: 'https://instagram.com/louable' },
    { icon: twitterIcon, name: 'Twitter', href: 'https://twitter.com/louable' },
    { icon: whatsappIcon, name: 'WhatsApp', href: 'https://wa.me/201234567890' }
  ]

  const tagline = t('footerTagline') !== 'footerTagline'
    ? t('footerTagline')
    : (ar ? 'قطع مختارة بعناية، تصلك إلى بابك.' : 'Carefully chosen pieces, delivered to your door.')

  const phone = t('phoneNumber') !== 'phoneNumber' ? t('phoneNumber') : (ar ? 'تواصل معنا' : 'Contact us')
  const email = env('louablefactory@gmail.com', '')
  const year = new Date().getFullYear()
  const rights = t('allRightsReserved') !== 'allRightsReserved' ? t('allRightsReserved') : (ar ? 'جميع الحقوق محفوظة.' : 'All rights reserved.')
  const brand = t('ProActive Store') !== 'ProActive Store' ? t('ProActive Store') : 'ProActive'

  return (
    <footer className="pa-footer">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <img src={getImage('logo')} alt={brand} style={{ height: 40, width: 'auto' }} />
        <b style={{ fontSize: 18, letterSpacing: '.04em' }}>{brand}</b>
      </div>
      <p className="pa-subtitle" style={{ maxWidth: 520 }}>{tagline}</p>

      <nav className="pa-footer__links" aria-label="Footer">
        {links.map((l) => (
          <Link key={l.href} to={l.href}>{l.label}</Link>
        ))}
      </nav>

      {email && (
        <a className="pa-subtitle" href={`mailto:${email}`} style={{ textDecoration: 'none' }}>{email}</a>
      )}
      <div className="pa-subtitle" style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{phone}</div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {socials.map((s) => (
          <a key={s.name} href={s.href} aria-label={s.name} target="_blank" rel="noreferrer noopener">
            <img src={s.icon} alt={s.name} width={32} height={32} />
          </a>
        ))}
      </div>

      <p className="pa-subtitle">© {year} {brand}. {rights}</p>
    </footer>
  )
}
