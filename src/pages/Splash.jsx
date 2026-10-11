// src/pages/Splash.jsx — ProActive Fashion design system refactor.
//
// Now the entry screen: the former LocationSplash that used to precede it asked
// for geolocation, which has been removed from the entry flow. What is left is
// the brand screen and the same 3-second forward to /home. The surface is the
// design system's .pa-hero pinned to the ink token — a permanent dark brand
// screen, so it does not follow the light/dark switch.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'

export default function Splash() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { getImage } = useTheme()

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/home')
    }, 3000)

    return () => clearTimeout(timer)
  }, [navigate])

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
          {L('styleDelivered', 'Style, delivered to your door', 'ستايلات مختارة بعناية، بتوصل لبابك.')}
        </p>

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
