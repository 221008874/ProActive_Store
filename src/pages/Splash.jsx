// src/pages/Splash.jsx — ProActive Fashion design system refactor.
//
// Logic is unchanged: the same 3-second forward to /home, the same read of the
// location state handed over by LocationSplash, and the same currency badge
// copy. The full-screen layout is kept, but the decorative layers (sparkles,
// glow, drifting blobs, shimmer bars) are gone; the surface is the design
// system's .pa-hero pinned to the ink token — a permanent dark brand screen, so
// it does not follow the light/dark switch.

import { useEffect } from 'react'
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useLocation } from '../context/LocationContext'

export default function Splash() {
  const navigate = useNavigate()
  const routerLocation = useRouterLocation()
  const { t, lang } = useLanguage()
  const { getImage } = useTheme()
  const { country, setLoading } = useLocation()

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  // Get detected location from navigation state
  const detectedData = routerLocation.state || {}

  useEffect(() => {
    // Update context with detected data if passed
    if (detectedData.detectedCurrency) {
      // Currency is already set in context from LocationSplash
    }

    const timer = setTimeout(() => {
      navigate('/home')
    }, 3000)

    return () => clearTimeout(timer)
  }, [navigate, detectedData])

  const getCurrencyDisplay = () => {
    return { flag: '🇪🇬', text: 'Egypt Store', symbol: 'EGP' }
  }

  const currencyInfo = getCurrencyDisplay()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes pa-spin { to { transform: rotate(360deg); } }`}</style>
      <section
        className="pa-hero"
        style={{
          flex: '1 1 auto',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          gap: 20,
          background: 'var(--pa-ink)',
          color: 'var(--pa-paper)'
        }}
      >
        <img
          src={getImage('logo')}
          alt="ProActive Store Logo"
          style={{ height: 'clamp(150px, 30vh, 280px)', width: 'auto', maxWidth: '90vw', objectFit: 'contain' }}
        />

        <h1 className="pa-hero__title">ProActive Store</h1>

        <p className="pa-hero__eyebrow" style={{ margin: 0, letterSpacing: 'normal', fontSize: 'clamp(1rem, 4vw, 1.5rem)' }}>
          {L('premiumChocolateExperience', 'Your Premium Chocolate Experience', 'تجربة الشوكولاتة الفاخرة')}
        </p>

        {country && (
          <div className="pa-callout" style={{ background: 'rgba(255,255,255,.08)' }}>
            📍 {L('detected', 'Detected', 'تم التعرف على')}: {country}
          </div>
        )}

        <div
          aria-hidden="true"
          style={{
            width: 'clamp(56px, 14vw, 70px)',
            height: 'clamp(56px, 14vw, 70px)',
            borderRadius: '50%',
            border: '5px solid rgba(255,255,255,.18)',
            borderTopColor: 'var(--pa-paper)',
            animation: 'pa-spin 1.2s linear infinite'
          }}
        />

        <p className="pa-hero__eyebrow" style={{ margin: 0 }}>
          {L('loadingStore', `Loading ${currencyInfo.symbol} Store...`, `جاري تحميل متجر ${currencyInfo.symbol}...`)}
        </p>
      </section>
    </div>
  )
}
